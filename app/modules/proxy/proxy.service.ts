import { readFile as fsReadFile, writeFile as fsWriteFile, mkdir, chown } from "node:fs/promises";
import { join } from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import type { AuthUser } from "../auth/auth.types.js";
import type { SslMode, ProxyConfig, DomainMapping, ContainerOption } from "./proxy.types.js";

const execFile = promisify(execFileCb);

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
        // If we can't read it, assume it's not available (e.g. inside a container)
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

    // Custom SSL mode needs auto_https off so Caddy doesn't try to get certs for all domains
    if (config.sslMode === "custom") {
        parts.push(`{
    auto_https off
}`);
    }

    for (const d of enabled) {
        // Determine upstream
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

        // Determine if this domain gets TLS
        const useTls = config.sslMode !== "none" && d.tls;

        let siteAddress: string;
        let tlsLine = "";

        if (!useTls) {
            siteAddress = `http://${d.domain}`;
        } else if (config.sslMode === "custom") {
            siteAddress = d.domain;
            tlsLine = "    tls /etc/caddy/certs/cert.pem /etc/caddy/certs/key.pem";
        } else {
            // letsencrypt — Caddy handles ACME automatically
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

// ── File helpers (user scope only for proxy) ──────────────────

async function writeProxyFile(path: string, content: string, user?: AuthUser): Promise<void> {
    await fsWriteFile(path, content, "utf-8");
    if (user) await chown(path, user.uid, user.gid).catch(() => {});
}

async function ensureDir(dir: string, user?: AuthUser): Promise<void> {
    await mkdir(dir, { recursive: true });
    if (user) await chown(dir, user.uid, user.gid).catch(() => {});
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

    // Ensure data directories (owned by the user so Caddy container can read them)
    await ensureDir(dataDir, user);
    await ensureDir(certsDir, user);

    // Write certs if custom mode
    let certPath: string | null = null;
    let keyPath: string | null = null;
    if (sslMode === "custom" && certContent && keyContent) {
        certPath = join(certsDir, "cert.pem");
        keyPath = join(certsDir, "key.pem");
        await writeProxyFile(certPath, certContent, user);
        await writeProxyFile(keyPath, keyContent, user);
    }

    // Update config in store
    proxyStore.upsertConfig(sslMode, certPath, keyPath);
    proxyStore.setEnabled(true);

    // Generate initial Caddyfile
    const config = proxyStore.getConfig();
    const domains = proxyStore.listDomains();
    const caddyfileContent = generateCaddyfile(domains, config);
    await writeProxyFile(join(dataDir, "Caddyfile"), caddyfileContent, user);

    // Create quadlet files (user scope)
    const quadletFiles = [
        { filename: "caddy.network", content: caddyNetworkQuadlet() },
        { filename: "caddy-data.volume", content: caddyDataVolumeQuadlet() },
        { filename: "caddy-config.volume", content: caddyConfigVolumeQuadlet() },
        { filename: "caddy.container", content: caddyContainerQuadlet(dataDir) },
    ];

    for (const qf of quadletFiles) {
        try {
            await createQuadlet(qf.filename, qf.content, "user", user);
        } catch (err) {
            // If already exists, overwrite it
            if (err instanceof Error && err.message.includes("already exists")) {
                const { saveQuadlet } = await import("../quadlet/quadlet.service.js");
                await saveQuadlet(qf.filename, qf.content, "user", user);
            } else {
                throw err;
            }
        }
    }

    // Start Caddy service
    await startService("caddy.service", "user", user);
}

export async function disableProxy(user: AuthUser): Promise<void> {
    const { proxyStore } = await import("./proxy.store.js");
    const { stopService, disableService } = await import("../systemd/systemd.service.js");
    const { deleteQuadlet } = await import("../quadlet/quadlet.service.js");

    // Stop and disable Caddy service
    await stopService("caddy.service", "user", user).catch(() => {});
    await disableService("caddy.service", "user", user).catch(() => {});

    // Delete quadlet files
    const quadletFiles = [
        "caddy.container",
        "caddy-data.volume",
        "caddy-config.volume",
        "caddy.network",
    ];

    for (const filename of quadletFiles) {
        await deleteQuadlet(filename, "user", user).catch(() => {});
    }

    // Mark as disabled (keep domains and certs for re-enable)
    proxyStore.setEnabled(false);
}

// ── Caddyfile regeneration ────────────────────────────────────

export async function regenerateCaddyfile(user: AuthUser): Promise<void> {
    const { proxyStore } = await import("./proxy.store.js");
    const { restartService } = await import("../systemd/systemd.service.js");

    const config = proxyStore.getConfig();
    const domains = proxyStore.listDomains();
    const dataDir = getDataDir();

    const caddyfileContent = generateCaddyfile(domains, config);
    await ensureDir(dataDir, user);
    await writeProxyFile(join(dataDir, "Caddyfile"), caddyfileContent, user);

    // Restart Caddy to pick up changes
    await restartService("caddy.service", "user", user);
}

// ── Status ────────────────────────────────────────────────────

export async function getProxyStatus(user: AuthUser): Promise<{
    config: ProxyConfig;
    domains: DomainMapping[];
    serviceStatus: string;
}> {
    const { proxyStore } = await import("./proxy.store.js");
    const { getServiceStatus } = await import("../systemd/systemd.service.js");

    const config = proxyStore.getConfig();
    const domains = proxyStore.listDomains();

    let serviceStatus = "inactive";
    if (config.enabled) {
        const status = await getServiceStatus("caddy.service", "user", user);
        serviceStatus = status.activeState;
    }

    return { config, domains, serviceStatus };
}

// ── Container listing ─────────────────────────────────────────

export async function getContainersWithPorts(user: AuthUser): Promise<ContainerOption[]> {
    const { listContainers } = await import("../podman/podman.client.js");
    const { inspectContainer } = await import("../podman/podman.client.js");

    const containers = await listContainers("user", user.uid, false).catch(() => []);
    const results: ContainerOption[] = [];

    for (const ct of containers) {
        const name = ct.Names?.[0] ?? ct.Id.slice(0, 12);
        const ports: number[] = [];
        const networks: string[] = [];

        // Get ports from the container listing
        if (ct.Ports) {
            for (const p of ct.Ports) {
                if (p.container_port && !ports.includes(p.container_port)) {
                    ports.push(p.container_port);
                }
            }
        }

        // Get network info from inspect
        try {
            const inspect = await inspectContainer(ct.Id, "user", user.uid);
            if (inspect.NetworkSettings?.Networks) {
                networks.push(...Object.keys(inspect.NetworkSettings.Networks));
            }
            // Also get exposed ports from inspect if not already found
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
