import { readdir } from "node:fs/promises";
import type { MetricPoint } from "./metrics.types.js";
import type { MetricsStore } from "./metrics.store.js";
import type { Scope } from "../auth/auth.types.js";

const POLL_INTERVAL = 5_000; // 5 seconds
const PURGE_INTERVAL = 3600; // 1 hour

const isRoot = () => (process.getuid?.() ?? 0) === 0;

interface CpuSnapshot {
    cpuNano: number;
    systemNano: number;
}

/**
 * Discover all active Podman sockets to poll.
 * Returns an array of [scope, uid?] tuples.
 */
async function discoverScopes(): Promise<Array<[Scope, number?]>> {
    const scopes: Array<[Scope, number?]> = [];

    if (isRoot()) {
        // System scope
        scopes.push(["system"]);

        // Discover user sockets: /run/user/{uid}/podman/podman.sock
        try {
            const entries = await readdir("/run/user", { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const uid = parseInt(entry.name, 10);
                    if (!isNaN(uid) && uid >= 1000) {
                        scopes.push(["user", uid]);
                    }
                }
            }
        } catch {
            // /run/user not accessible
        }
    } else {
        // Non-root: only user scope with default socket
        scopes.push(["user"]);
    }

    return scopes;
}

export function startCollector(store: MetricsStore): void {
    let running = true;
    let lastPurge = 0;
    const prevCpu = new Map<string, CpuSnapshot>();

    const poll = async () => {
        if (!running) return;

        try {
            const { listContainers, getAllContainerStats } = await import(
                "../podman/podman.client.js"
            );

            const now = Math.floor(Date.now() / 1000);
            const scopes = await discoverScopes();

            for (const [scope, uid] of scopes) {
                let stats;
                try {
                    stats = await getAllContainerStats(scope, uid);
                } catch {
                    continue; // Socket not available for this scope
                }

                for (const s of stats) {
                    let cpu = 0;
                    const prev = prevCpu.get(s.ContainerID);
                    if (prev && prev.systemNano > 0) {
                        const deltaCpu = s.CPUNano - prev.cpuNano;
                        const deltaSystem = s.SystemNano - prev.systemNano;
                        if (deltaSystem > 0) {
                            cpu = Math.min(100, (deltaCpu / deltaSystem) * 100);
                        }
                    }
                    prevCpu.set(s.ContainerID, {
                        cpuNano: s.CPUNano,
                        systemNano: s.SystemNano,
                    });

                    let netIn = 0;
                    let netOut = 0;
                    if (s.Network) {
                        for (const iface of Object.values(s.Network)) {
                            netIn += iface.RxBytes;
                            netOut += iface.TxBytes;
                        }
                    }

                    const point: MetricPoint = {
                        ts: now,
                        cpu,
                        mem: s.MemUsage,
                        memLimit: s.MemLimit,
                        netIn,
                        netOut,
                        blockIn: s.BlockInput,
                        blockOut: s.BlockOutput,
                    };
                    store.push(s.ContainerID, point);
                }

                // Purge metrics for removed containers every hour
                if (now - lastPurge >= PURGE_INTERVAL) {
                    const allContainers = await listContainers(scope, uid);
                    const activeIds = new Set(allContainers.map((c) => c.Id));
                    const removed = store.purgeContainers(activeIds);
                    if (removed > 0) {
                        console.log(`Purged metrics for ${removed} removed containers`);
                    }
                    lastPurge = now;
                }
            }
        } catch {
            // Unexpected error — skip this cycle
        }

        if (running) {
            setTimeout(poll, POLL_INTERVAL);
        }
    };

    console.log("Metrics collector started (5s interval)");
    poll();

    process.on("SIGTERM", () => { running = false; store.close(); });
    process.on("SIGINT", () => { running = false; store.close(); });
}
