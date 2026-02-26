import http from "node:http";
import { join } from "node:path";
import type { PodmanContainer, PodmanContainerInspect, PodmanStats } from "./podman.types.js";

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

export async function getContainerStats(
    id: string
): Promise<PodmanStats> {
    return podmanRequest<PodmanStats>(
        `/containers/${encodeURIComponent(id)}/stats?stream=false`
    );
}
