import http from "node:http";
import { join } from "node:path";
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

const PODMAN_SOCKET = process.env.PODMAN_SOCKET || getDefaultSocket();
const API_BASE = "/v4.0.0/libpod";

async function podmanRequest<T>(
    path: string,
    method: string = "GET",
    body?: unknown
): Promise<T> {
    return new Promise((resolve, reject) => {
        const options: http.RequestOptions = {
            socketPath: PODMAN_SOCKET,
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
                    `Podman socket error (${PODMAN_SOCKET}): ${err.message}`
                )
            );
        });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

export async function listContainers(
    all: boolean = true
): Promise<PodmanContainer[]> {
    return podmanRequest<PodmanContainer[]>(
        `/containers/json?all=${all}`
    );
}

export async function inspectContainer(
    id: string
): Promise<PodmanContainerInspect> {
    return podmanRequest<PodmanContainerInspect>(
        `/containers/${encodeURIComponent(id)}/json`
    );
}

export async function getAllContainerStats(): Promise<PodmanStats[]> {
    const res = await podmanRequest<PodmanStatsResponse>(
        `/containers/stats?stream=false`
    );
    return res.Stats ?? [];
}

export async function listImages(): Promise<PodmanImage[]> {
    return podmanRequest<PodmanImage[]>(`/images/json`);
}

export async function inspectImage(name: string): Promise<PodmanImageInspect> {
    return podmanRequest<PodmanImageInspect>(
        `/images/${encodeURIComponent(name)}/json`
    );
}

export async function getImageHistory(name: string): Promise<PodmanImageHistory[]> {
    return podmanRequest<PodmanImageHistory[]>(
        `/images/${encodeURIComponent(name)}/history`
    );
}

export async function removeImage(name: string, force: boolean = false): Promise<void> {
    await podmanRequest<unknown>(
        `/images/${encodeURIComponent(name)}?force=${force}`,
        "DELETE"
    );
}

export async function getDiskUsage(): Promise<PodmanDiskUsage> {
    return podmanRequest<PodmanDiskUsage>(`/system/df`);
}

export async function listContainersByVolume(
    volumeName: string
): Promise<PodmanContainer[]> {
    const filters = encodeURIComponent(JSON.stringify({ volume: [volumeName] }));
    return podmanRequest<PodmanContainer[]>(
        `/containers/json?all=true&filters=${filters}`
    );
}

export async function listNetworks(): Promise<PodmanNetwork[]> {
    return podmanRequest<PodmanNetwork[]>(`/networks/json`);
}

export async function listVolumes(): Promise<PodmanVolume[]> {
    return podmanRequest<PodmanVolume[]>(`/volumes/json`);
}

export async function inspectVolume(name: string): Promise<PodmanVolume> {
    return podmanRequest<PodmanVolume>(
        `/volumes/${encodeURIComponent(name)}/json`
    );
}

export async function removeVolume(name: string, force: boolean = false): Promise<void> {
    await podmanRequest<unknown>(
        `/volumes/${encodeURIComponent(name)}?force=${force}`,
        "DELETE"
    );
}

export function podmanStreamPull(
    reference: string,
    onLine: (line: string) => void,
    onEnd: () => void,
    onError: (err: Error) => void,
): () => void {
    const options: http.RequestOptions = {
        socketPath: PODMAN_SOCKET,
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
        onError(new Error(`Podman socket error (${PODMAN_SOCKET}): ${err.message}`));
    });

    req.end();

    return () => { req.destroy(); };
}
