import type { MetricPoint } from "./metrics.types.js";
import type { MetricsStore } from "./metrics.store.js";

const POLL_INTERVAL = 5_000; // 5 seconds
const PURGE_INTERVAL = 3600; // 1 hour

interface CpuSnapshot {
    cpuNano: number;
    systemNano: number;
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
            const stats = await getAllContainerStats();

            for (const s of stats) {
                // Calculate instantaneous CPU % from deltas
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
                const allContainers = await listContainers(true);
                const activeIds = new Set(allContainers.map((c) => c.Id));
                const removed = store.purgeContainers(activeIds);
                if (removed > 0) {
                    console.log(`Purged metrics for ${removed} removed containers`);
                }
                lastPurge = now;
            }
        } catch {
            // Podman socket not available or other error — skip this cycle
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
