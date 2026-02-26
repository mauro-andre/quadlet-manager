import type { MetricPoint } from "./metrics.types.js";
import type { MetricsStore } from "./metrics.store.js";
import type { PodmanStats } from "../podman/podman.types.js";

const POLL_INTERVAL = 10_000; // 10 seconds

interface CpuSnapshot {
    totalUsage: number;
    systemUsage: number;
}

function calcCpuPercent(
    prev: CpuSnapshot | undefined,
    stats: PodmanStats,
): number {
    const curTotal = stats.cpu_stats.cpu_usage.total_usage;
    const curSystem = stats.cpu_stats.system_cpu_usage;
    const cpus = stats.cpu_stats.online_cpus || 1;

    if (!prev || prev.systemUsage === 0) return 0;

    const deltaTotal = curTotal - prev.totalUsage;
    const deltaSystem = curSystem - prev.systemUsage;

    if (deltaSystem <= 0) return 0;

    return Math.min(100, (deltaTotal / deltaSystem) * cpus * 100);
}

function sumBlockIo(stats: PodmanStats): { read: number; write: number } {
    let read = 0;
    let write = 0;
    const entries = stats.blkio_stats.io_service_bytes_recursive;
    if (entries) {
        for (const e of entries) {
            if (e.op === "read") read += e.value;
            else if (e.op === "write") write += e.value;
        }
    }
    return { read, write };
}

function sumNetwork(stats: PodmanStats): { rx: number; tx: number } {
    let rx = 0;
    let tx = 0;
    if (stats.networks) {
        for (const iface of Object.values(stats.networks)) {
            rx += iface.rx_bytes;
            tx += iface.tx_bytes;
        }
    }
    return { rx, tx };
}

export function startCollector(store: MetricsStore): void {
    let running = true;
    const prevCpu = new Map<string, CpuSnapshot>();

    const poll = async () => {
        if (!running) return;

        try {
            const { listContainers, getContainerStats } = await import(
                "../podman/podman.client.js"
            );

            const containers = await listContainers(false); // running only
            const now = Math.floor(Date.now() / 1000);

            await Promise.all(
                containers.map(async (c) => {
                    try {
                        const stats = await getContainerStats(c.Id);

                        const cpu = calcCpuPercent(prevCpu.get(c.Id), stats);
                        prevCpu.set(c.Id, {
                            totalUsage: stats.cpu_stats.cpu_usage.total_usage,
                            systemUsage: stats.cpu_stats.system_cpu_usage,
                        });

                        const net = sumNetwork(stats);
                        const blk = sumBlockIo(stats);

                        const point: MetricPoint = {
                            ts: now,
                            cpu,
                            mem: stats.memory_stats.usage ?? 0,
                            memLimit: stats.memory_stats.limit ?? 0,
                            netIn: net.rx,
                            netOut: net.tx,
                            blockIn: blk.read,
                            blockOut: blk.write,
                        };
                        store.push(c.Id, point);
                    } catch {
                        // Container may have stopped between list and stats
                    }
                })
            );

            await store.save();
        } catch {
            // Podman socket not available or other error — skip this cycle
        }

        if (running) {
            setTimeout(poll, POLL_INTERVAL);
        }
    };

    console.log("Metrics collector started (10s interval)");
    poll();

    // Cleanup on process exit
    process.on("SIGTERM", () => {
        running = false;
        store.forceSave();
    });
    process.on("SIGINT", () => {
        running = false;
        store.forceSave();
    });
}
