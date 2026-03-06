import http from "node:http";
import { join } from "node:path";
import type { PodmanContainer, PodmanContainerInspect, PodmanStats, PodmanStatsResponse, PodmanImage, PodmanImageInspect, PodmanImageHistory, PodmanDiskUsage, PodmanNetwork, PodmanVolume } from "./podman.types.js";

function getSocket(): string {
    if (process.env.PODMAN_SOCKET) return process.env.PODMAN_SOCKET;
    const xdgRuntime = process.env.XDG_RUNTIME_DIR;
    if (xdgRuntime) {
        return join(xdgRuntime, "podman/podman.sock");
    }
    return "/run/podman/podman.sock";
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

export async function listContainers(all: boolean = true): Promise<PodmanContainer[]> {
    const socket = getSocket();
    return podmanRequest<PodmanContainer[]>(
        `/containers/json?all=${all}`,
        socket
    );
}

export async function inspectContainer(id: string): Promise<PodmanContainerInspect> {
    const socket = getSocket();
    return podmanRequest<PodmanContainerInspect>(
        `/containers/${encodeURIComponent(id)}/json`,
        socket
    );
}

export async function getAllContainerStats(): Promise<PodmanStats[]> {
    const socket = getSocket();
    const res = await podmanRequest<PodmanStatsResponse>(
        `/containers/stats?stream=false`,
        socket
    );
    return res.Stats ?? [];
}

export async function listImages(): Promise<PodmanImage[]> {
    const socket = getSocket();
    return podmanRequest<PodmanImage[]>(`/images/json`, socket);
}

export async function inspectImage(name: string): Promise<PodmanImageInspect> {
    const socket = getSocket();
    return podmanRequest<PodmanImageInspect>(
        `/images/${encodeURIComponent(name)}/json`,
        socket
    );
}

export async function getImageHistory(name: string): Promise<PodmanImageHistory[]> {
    const socket = getSocket();
    return podmanRequest<PodmanImageHistory[]>(
        `/images/${encodeURIComponent(name)}/history`,
        socket
    );
}

export async function removeImage(name: string, force: boolean = false): Promise<void> {
    const socket = getSocket();
    await podmanRequest<unknown>(
        `/images/${encodeURIComponent(name)}?force=${force}`,
        socket,
        "DELETE"
    );
}

export async function getDiskUsage(): Promise<PodmanDiskUsage> {
    const socket = getSocket();
    return podmanRequest<PodmanDiskUsage>(`/system/df`, socket);
}

export async function listContainersByVolume(volumeName: string): Promise<PodmanContainer[]> {
    const socket = getSocket();
    const filters = encodeURIComponent(JSON.stringify({ volume: [volumeName] }));
    return podmanRequest<PodmanContainer[]>(
        `/containers/json?all=true&filters=${filters}`,
        socket
    );
}

export async function listNetworks(): Promise<PodmanNetwork[]> {
    const socket = getSocket();
    return podmanRequest<PodmanNetwork[]>(`/networks/json`, socket);
}

export async function inspectNetwork(name: string): Promise<PodmanNetwork> {
    const socket = getSocket();
    return podmanRequest<PodmanNetwork>(
        `/networks/${encodeURIComponent(name)}/json`,
        socket
    );
}

export async function removeNetwork(name: string): Promise<void> {
    const socket = getSocket();
    await podmanRequest<unknown>(
        `/networks/${encodeURIComponent(name)}`,
        socket,
        "DELETE"
    );
}

export async function listContainersByNetwork(networkName: string): Promise<PodmanContainer[]> {
    const socket = getSocket();
    const filters = encodeURIComponent(JSON.stringify({ network: [networkName] }));
    return podmanRequest<PodmanContainer[]>(
        `/containers/json?all=true&filters=${filters}`,
        socket
    );
}

export async function listVolumes(): Promise<PodmanVolume[]> {
    const socket = getSocket();
    return podmanRequest<PodmanVolume[]>(`/volumes/json`, socket);
}

export async function inspectVolume(name: string): Promise<PodmanVolume> {
    const socket = getSocket();
    return podmanRequest<PodmanVolume>(
        `/volumes/${encodeURIComponent(name)}/json`,
        socket
    );
}

export async function removeVolume(name: string, force: boolean = false): Promise<void> {
    const socket = getSocket();
    await podmanRequest<unknown>(
        `/volumes/${encodeURIComponent(name)}?force=${force}`,
        socket,
        "DELETE"
    );
}

export function podmanStreamPull(
    reference: string,
    onLine: (line: string) => void,
    onEnd: () => void,
    onError: (err: Error) => void,
): () => void {
    const socketPath = getSocket();
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
