import { readFile as fsReadFile, writeFile as fsWriteFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { AuthUser } from "../auth/auth.types.js";
import type { SslMode, ProxyConfig, DomainMapping, ContainerOption } from "./proxy.types.js";

// Data directory for Caddyfile, certs, etc.
function getDataDir(): string {
    return join(process.cwd(), ".data", "proxy");
}

function getQuadletDir(user: AuthUser): string {
    if (process.env.QUADLET_DIR) return process.env.QUADLET_DIR;
    return join(user.homeDir, ".config/containers/systemd");
}

// ── Sysctl check ──────────────────────────────────────────────

export async function checkSysctl(): Promise<{ canBindPort80: boolean; currentValue: number }> {
    try {
        const content = await fsReadFile(
            "/proc/sys/net/ipv4/ip_unprivileged_port_start",
            "utf-8"
        );
        const value = parseInt(content.trim(), 10);
        return { canBindPort80: value <= 80, currentValue: value };
    } catch {
        return { canBindPort80: false, currentValue: 1024 };
    }
}

// ── Caddyfile generation ──────────────────────────────────────

export function generateCaddyfile(domains: DomainMapping[], config: ProxyConfig): string {
    const enabled = domains.filter((d) => d.enabled);

    if (enabled.length === 0) {
        return `:80 {
    respond "Caddy is running. Configure domains in Quadlet Manager." 200
}
`;
    }

    const parts: string[] = [];

    if (config.sslMode === "custom") {
        parts.push(`{
    auto_https off
}`);
    }

    for (const d of enabled) {
        const host = d.targetType === "host"
            ? "host.containers.internal"
            : d.containerName;

        let reverseProxyLine: string;
        if (d.targetType === "host" && d.backendHttps) {
            reverseProxyLine = `    reverse_proxy https://${host}:${d.containerPort} {
        transport http {
            tls_insecure_skip_verify
        }
    }`;
        } else {
            reverseProxyLine = `    reverse_proxy ${host}:${d.containerPort}`;
        }

        const useTls = config.sslMode !== "none" && d.tls;

        let siteAddress: string;
        let tlsLine = "";

        if (!useTls) {
            siteAddress = `http://${d.domain}`;
        } else if (config.sslMode === "custom") {
            siteAddress = d.domain;
            tlsLine = "    tls /etc/caddy/certs/cert.pem /etc/caddy/certs/key.pem";
        } else {
            siteAddress = d.domain;
        }

        const lines = [`${siteAddress} {`];
        if (tlsLine) lines.push(tlsLine);
        lines.push(reverseProxyLine);
        lines.push("}");

        parts.push(lines.join("\n"));
    }

    return parts.join("\n\n") + "\n";
}

// ── Quadlet content generators ────────────────────────────────

function caddyNetworkQuadlet(): string {
    return `[Network]
`;
}

function caddyDataVolumeQuadlet(): string {
    return `[Volume]
`;
}

function caddyConfigVolumeQuadlet(): string {
    return `[Volume]
`;
}

function caddyContainerQuadlet(dataDir: string): string {
    return `[Unit]
Description=Caddy reverse proxy (Quadlet Manager)

[Container]
Image=docker.io/library/caddy:2-alpine
PublishPort=80:80
PublishPort=443:443
PublishPort=443:443/udp
Volume=${dataDir}/Caddyfile:/etc/caddy/Caddyfile:ro,Z
Volume=${dataDir}/certs:/etc/caddy/certs:ro,Z
Volume=caddy-data.volume:/data
Volume=caddy-config.volume:/config
Network=caddy.network
AddHost=host.containers.internal:host-gateway

[Service]
Restart=always

[Install]
WantedBy=default.target
`;
}

// ── File helpers ──────────────────────────────────────────────

async function writeProxyFile(path: string, content: string): Promise<void> {
    await fsWriteFile(path, content, "utf-8");
}

async function ensureDir(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true });
}

// ── Enable / Disable lifecycle ────────────────────────────────

export async function enableProxy(
    sslMode: SslMode,
    user: AuthUser,
    certContent?: string,
    keyContent?: string
): Promise<void> {
    const { proxyStore } = await import("./proxy.store.js");
    const { createQuadlet } = await import("../quadlet/quadlet.service.js");
    const { startService } = await import("../systemd/systemd.service.js");

    const dataDir = getDataDir();
    const certsDir = join(dataDir, "certs");

    await ensureDir(dataDir);
    await ensureDir(certsDir);

    let certPath: string | null = null;
    let keyPath: string | null = null;
    if (sslMode === "custom" && certContent && keyContent) {
        certPath = join(certsDir, "cert.pem");
        keyPath = join(certsDir, "key.pem");
        await writeProxyFile(certPath, certContent);
        await writeProxyFile(keyPath, keyContent);
    }

    await proxyStore.upsertConfig(sslMode, certPath, keyPath);
    await proxyStore.setEnabled(true);

    const config = await proxyStore.getConfig();
    const domains = await proxyStore.listDomains();
    const caddyfileContent = generateCaddyfile(domains, config);
    await writeProxyFile(join(dataDir, "Caddyfile"), caddyfileContent);

    const quadletFiles = [
        { filename: "caddy.network", content: caddyNetworkQuadlet() },
        { filename: "caddy-data.volume", content: caddyDataVolumeQuadlet() },
        { filename: "caddy-config.volume", content: caddyConfigVolumeQuadlet() },
        { filename: "caddy.container", content: caddyContainerQuadlet(dataDir) },
    ];

    for (const qf of quadletFiles) {
        try {
            await createQuadlet(qf.filename, qf.content, user);
        } catch (err) {
            if (err instanceof Error && err.message.includes("already exists")) {
                const { saveQuadlet } = await import("../quadlet/quadlet.service.js");
                await saveQuadlet(qf.filename, qf.content, user);
            } else {
                throw err;
            }
        }
    }

    await startService("caddy.service");
}

export async function disableProxy(user: AuthUser): Promise<void> {
    const { proxyStore } = await import("./proxy.store.js");
    const { stopService, disableService } = await import("../systemd/systemd.service.js");
    const { deleteQuadlet } = await import("../quadlet/quadlet.service.js");

    await stopService("caddy.service").catch(() => {});
    await disableService("caddy.service").catch(() => {});

    const quadletFiles = [
        "caddy.container",
        "caddy-data.volume",
        "caddy-config.volume",
        "caddy.network",
    ];

    for (const filename of quadletFiles) {
        await deleteQuadlet(filename, user).catch(() => {});
    }

    await proxyStore.setEnabled(false);
}

// ── Caddyfile regeneration ────────────────────────────────────

export async function regenerateCaddyfile(): Promise<void> {
    const { proxyStore } = await import("./proxy.store.js");
    const { restartService } = await import("../systemd/systemd.service.js");

    const config = await proxyStore.getConfig();
    const domains = await proxyStore.listDomains();
    const dataDir = getDataDir();

    const caddyfileContent = generateCaddyfile(domains, config);
    await ensureDir(dataDir);
    await writeProxyFile(join(dataDir, "Caddyfile"), caddyfileContent);

    await restartService("caddy.service");
}

// ── Status ────────────────────────────────────────────────────

export async function getProxyStatus(): Promise<{
    config: ProxyConfig;
    domains: DomainMapping[];
    serviceStatus: string;
}> {
    const { proxyStore } = await import("./proxy.store.js");
    const { getServiceStatus } = await import("../systemd/systemd.service.js");

    const config = await proxyStore.getConfig();
    const domains = await proxyStore.listDomains();

    let serviceStatus = "inactive";
    if (config.enabled) {
        const status = await getServiceStatus("caddy.service");
        serviceStatus = status.activeState;
    }

    return { config, domains, serviceStatus };
}

// ── Container listing ─────────────────────────────────────────

export async function getContainersWithPorts(): Promise<ContainerOption[]> {
    const { listContainers } = await import("../podman/podman.client.js");
    const { inspectContainer } = await import("../podman/podman.client.js");

    const containers = await listContainers(false).catch(() => []);
    const results: ContainerOption[] = [];

    for (const ct of containers) {
        const name = ct.Names?.[0] ?? ct.Id.slice(0, 12);
        const ports: number[] = [];
        const networks: string[] = [];

        if (ct.Ports) {
            for (const p of ct.Ports) {
                if (p.container_port && !ports.includes(p.container_port)) {
                    ports.push(p.container_port);
                }
            }
        }

        try {
            const inspect = await inspectContainer(ct.Id);
            if (inspect.NetworkSettings?.Networks) {
                networks.push(...Object.keys(inspect.NetworkSettings.Networks));
            }
            if (inspect.HostConfig?.PortBindings) {
                for (const portKey of Object.keys(inspect.HostConfig.PortBindings)) {
                    const port = parseInt(portKey, 10);
                    if (port && !ports.includes(port)) {
                        ports.push(port);
                    }
                }
            }
        } catch {
            // Inspect failed, continue with what we have
        }

        results.push({
            id: ct.Id,
            name,
            ports: ports.sort((a, b) => a - b),
            networks,
            state: ct.State,
        });
    }

    return results;
}
