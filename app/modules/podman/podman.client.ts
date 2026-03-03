import http from "node:http";
import { join } from "node:path";
import type { Scope, AuthUser } from "../auth/auth.types.js";
import type { PodmanContainer, PodmanContainerInspect, PodmanStats, PodmanStatsResponse, PodmanImage, PodmanImageInspect, PodmanImageHistory, PodmanDiskUsage, PodmanNetwork, PodmanVolume } from "./podman.types.js";

function getDefaultSocket(): string {
    // Rootless: $XDG_RUNTIME_DIR/podman/podman.sock
    const xdgRuntime = process.env.XDG_RUNTIME_DIR;
    if (xdgRuntime) {
        return join(xdgRuntime, "podman/podman.sock");
    }
    // Rootful fallback
    return "/run/podman/podman.sock";
}

export function getSocketForScope(scope: Scope, uid?: number): string {
    if (process.env.PODMAN_SOCKET) return process.env.PODMAN_SOCKET;
    if (scope === "system") {
        return "/run/podman/podman.sock";
    }
    // user scope
    if (uid) {
        return `/run/user/${uid}/podman/podman.sock`;
    }
    return getDefaultSocket();
}

const API_BASE = "/v4.0.0/libpod";

async function podmanRequest<T>(
    path: string,
    socketPath: string,
    method: string = "GET",
    body?: unknown
): Promise<T> {
    return new Promise((resolve, reject) => {
        const options: http.RequestOptions = {
            socketPath,
            path: `${API_BASE}${path}`,
            method,
            headers: body
                ? { "Content-Type": "application/json" }
                : undefined,
        };

        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk: Buffer) => (data += chunk));
            res.on("end", () => {
                if (
                    res.statusCode &&
                    res.statusCode >= 200 &&
                    res.statusCode < 300
                ) {
                    if (!data) {
                        resolve(undefined as T);
                        return;
                    }
                    try {
                        resolve(JSON.parse(data) as T);
                    } catch {
                        resolve(data as T);
                    }
                } else {
                    reject(
                        new Error(
                            `Podman API ${method} ${path} returned ${res.statusCode}: ${data}`
                        )
                    );
                }
            });
        });

        req.on("error", (err) => {
            reject(
                new Error(
                    `Podman socket error (${socketPath}): ${err.message}`
                )
            );
        });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

export async function listContainers(
    scope: Scope,
    uid?: number,
    all: boolean = true
): Promise<PodmanContainer[]> {
    const socket = getSocketForScope(scope, uid);
    return podmanRequest<PodmanContainer[]>(
        `/containers/json?all=${all}`,
        socket
    );
}

export async function listAllContainers(user: AuthUser): Promise<(PodmanContainer & { scope: Scope })[]> {
    const [userContainers, systemContainers] = await Promise.all([
        listContainers("user", user.uid).catch(() => []),
        user.hasSudo ? listContainers("system").catch(() => []) : Promise.resolve([]),
    ]);

    return [
        ...userContainers.map((c) => ({ ...c, scope: "user" as Scope })),
        ...systemContainers.map((c) => ({ ...c, scope: "system" as Scope })),
    ];
}

export async function inspectContainer(
    id: string,
    scope: Scope,
    uid?: number
): Promise<PodmanContainerInspect> {
    const socket = getSocketForScope(scope, uid);
    return podmanRequest<PodmanContainerInspect>(
        `/containers/${encodeURIComponent(id)}/json`,
        socket
    );
}

export async function getAllContainerStats(scope: Scope, uid?: number): Promise<PodmanStats[]> {
    const socket = getSocketForScope(scope, uid);
    const res = await podmanRequest<PodmanStatsResponse>(
        `/containers/stats?stream=false`,
        socket
    );
    return res.Stats ?? [];
}

export async function listImages(scope: Scope, uid?: number): Promise<PodmanImage[]> {
    const socket = getSocketForScope(scope, uid);
    return podmanRequest<PodmanImage[]>(`/images/json`, socket);
}

export async function listAllImages(user: AuthUser): Promise<(PodmanImage & { scope: Scope })[]> {
    const [userImages, systemImages] = await Promise.all([
        listImages("user", user.uid).catch(() => []),
        user.hasSudo ? listImages("system").catch(() => []) : Promise.resolve([]),
    ]);

    return [
        ...userImages.map((i) => ({ ...i, scope: "user" as Scope })),
        ...systemImages.map((i) => ({ ...i, scope: "system" as Scope })),
    ];
}

export async function inspectImage(name: string, scope: Scope, uid?: number): Promise<PodmanImageInspect> {
    const socket = getSocketForScope(scope, uid);
    return podmanRequest<PodmanImageInspect>(
        `/images/${encodeURIComponent(name)}/json`,
        socket
    );
}

export async function getImageHistory(name: string, scope: Scope, uid?: number): Promise<PodmanImageHistory[]> {
    const socket = getSocketForScope(scope, uid);
    return podmanRequest<PodmanImageHistory[]>(
        `/images/${encodeURIComponent(name)}/history`,
        socket
    );
}

export async function removeImage(name: string, scope: Scope, uid?: number, force: boolean = false): Promise<void> {
    const socket = getSocketForScope(scope, uid);
    await podmanRequest<unknown>(
        `/images/${encodeURIComponent(name)}?force=${force}`,
        socket,
        "DELETE"
    );
}

export async function getDiskUsage(scope: Scope, uid?: number): Promise<PodmanDiskUsage> {
    const socket = getSocketForScope(scope, uid);
    return podmanRequest<PodmanDiskUsage>(`/system/df`, socket);
}

export async function listContainersByVolume(
    volumeName: string,
    scope: Scope,
    uid?: number
): Promise<PodmanContainer[]> {
    const socket = getSocketForScope(scope, uid);
    const filters = encodeURIComponent(JSON.stringify({ volume: [volumeName] }));
    return podmanRequest<PodmanContainer[]>(
        `/containers/json?all=true&filters=${filters}`,
        socket
    );
}

export async function listNetworks(scope: Scope, uid?: number): Promise<PodmanNetwork[]> {
    const socket = getSocketForScope(scope, uid);
    return podmanRequest<PodmanNetwork[]>(`/networks/json`, socket);
}

export async function listAllNetworks(user: AuthUser): Promise<(PodmanNetwork & { scope: Scope })[]> {
    const [userNetworks, systemNetworks] = await Promise.all([
        listNetworks("user", user.uid).catch(() => []),
        user.hasSudo ? listNetworks("system").catch(() => []) : Promise.resolve([]),
    ]);

    return [
        ...userNetworks.map((n) => ({ ...n, scope: "user" as Scope })),
        ...systemNetworks.map((n) => ({ ...n, scope: "system" as Scope })),
    ];
}

export async function inspectNetwork(name: string, scope: Scope, uid?: number): Promise<PodmanNetwork> {
    const socket = getSocketForScope(scope, uid);
    return podmanRequest<PodmanNetwork>(
        `/networks/${encodeURIComponent(name)}/json`,
        socket
    );
}

export async function removeNetwork(name: string, scope: Scope, uid?: number): Promise<void> {
    const socket = getSocketForScope(scope, uid);
    await podmanRequest<unknown>(
        `/networks/${encodeURIComponent(name)}`,
        socket,
        "DELETE"
    );
}

export async function listContainersByNetwork(
    networkName: string,
    scope: Scope,
    uid?: number
): Promise<PodmanContainer[]> {
    const socket = getSocketForScope(scope, uid);
    const filters = encodeURIComponent(JSON.stringify({ network: [networkName] }));
    return podmanRequest<PodmanContainer[]>(
        `/containers/json?all=true&filters=${filters}`,
        socket
    );
}

export async function listVolumes(scope: Scope, uid?: number): Promise<PodmanVolume[]> {
    const socket = getSocketForScope(scope, uid);
    return podmanRequest<PodmanVolume[]>(`/volumes/json`, socket);
}

export async function listAllVolumes(user: AuthUser): Promise<(PodmanVolume & { scope: Scope })[]> {
    const [userVolumes, systemVolumes] = await Promise.all([
        listVolumes("user", user.uid).catch(() => []),
        user.hasSudo ? listVolumes("system").catch(() => []) : Promise.resolve([]),
    ]);

    return [
        ...userVolumes.map((v) => ({ ...v, scope: "user" as Scope })),
        ...systemVolumes.map((v) => ({ ...v, scope: "system" as Scope })),
    ];
}

export async function inspectVolume(name: string, scope: Scope, uid?: number): Promise<PodmanVolume> {
    const socket = getSocketForScope(scope, uid);
    return podmanRequest<PodmanVolume>(
        `/volumes/${encodeURIComponent(name)}/json`,
        socket
    );
}

export async function removeVolume(name: string, scope: Scope, uid?: number, force: boolean = false): Promise<void> {
    const socket = getSocketForScope(scope, uid);
    await podmanRequest<unknown>(
        `/volumes/${encodeURIComponent(name)}?force=${force}`,
        socket
    );
}

export function podmanStreamPull(
    reference: string,
    scope: Scope,
    uid: number | undefined,
    onLine: (line: string) => void,
    onEnd: () => void,
    onError: (err: Error) => void,
): () => void {
    const socketPath = getSocketForScope(scope, uid);
    const options: http.RequestOptions = {
        socketPath,
        path: `${API_BASE}/images/pull?reference=${encodeURIComponent(reference)}`,
        method: "POST",
    };

    const req = http.request(options, (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            let data = "";
            res.on("data", (chunk: Buffer) => (data += chunk));
            res.on("end", () => {
                onError(new Error(`Podman pull returned ${res.statusCode}: ${data}`));
            });
            return;
        }

        let buffer = "";
        res.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop()!;
            for (const line of lines) {
                if (line.trim()) onLine(line);
            }
        });

        res.on("end", () => {
            if (buffer.trim()) onLine(buffer);
            onEnd();
        });
    });

    req.on("error", (err) => {
        onError(new Error(`Podman socket error (${socketPath}): ${err.message}`));
    });

    req.end();

    return () => { req.destroy(); };
}
