import type { Hono } from "hono";
import { addRoutes } from "velojs/server";
import { MetricsStore } from "./modules/metrics/metrics.store.js";
import { startCollector } from "./modules/metrics/metrics.collector.js";
import type { TimeRange } from "./modules/metrics/metrics.types.js";

const store = new MetricsStore();
startCollector(store);

addRoutes((app: Hono) => {
    registerLogStreams(app);
    registerMetricsEndpoints(app);
    registerSystemEndpoints(app);
});

function registerMetricsEndpoints(app: Hono) {
    // Latest metrics for all containers
    app.get("/api/metrics/current", (c) => {
        return c.json(store.latestAll());
    });

    // Live stream for all containers
    app.get("/api/metrics/live", async (c) => {
        const { streamSSE } = await import("hono/streaming");

        return streamSSE(c, async (stream) => {
            const unsubscribe = store.subscribe((containerId, point) => {
                stream.writeSSE({
                    data: JSON.stringify({ containerId, ...point }),
                });
            });

            stream.onAbort(() => { unsubscribe(); });
            await new Promise<void>(() => {});
        });
    });

    // Historical metrics
    app.get("/api/metrics/:id", (c) => {
        const id = c.req.param("id");
        const range = (c.req.query("range") ?? "1h") as TimeRange;
        const points = store.query(id, range);
        return c.json(points);
    });

    // Live metrics stream
    app.get("/api/metrics/:id/live", async (c) => {
        const { streamSSE } = await import("hono/streaming");
        const id = c.req.param("id");

        return streamSSE(c, async (stream) => {
            const unsubscribe = store.subscribe((containerId, point) => {
                if (containerId === id || containerId.startsWith(id)) {
                    stream.writeSSE({ data: JSON.stringify(point) });
                }
            });

            stream.onAbort(() => { unsubscribe(); });

            // Keep alive until client disconnects
            await new Promise<void>(() => {});
        });
    });
}

function registerLogStreams(app: Hono) {
    // SSE: container logs via podman logs -f
    app.get("/api/logs/container/:name", async (c) => {
        const { streamSSE } = await import("hono/streaming");
        const { spawn } = await import("node:child_process");

        const name = c.req.param("name");
        return streamSSE(c, async (stream) => {
            const proc = spawn("podman", [
                "logs",
                "-f",
                "--tail",
                "100",
                name,
            ]);

            const onData = (chunk: Buffer) => {
                stream.writeSSE({ data: chunk.toString() });
            };

            proc.stdout.on("data", onData);
            proc.stderr.on("data", onData);

            stream.onAbort(() => { proc.kill(); });

            await new Promise<void>((resolve) => proc.on("close", resolve));
        });
    });

    // SSE: service logs via journalctl -f -u
    app.get("/api/logs/service/:name", async (c) => {
        const { streamSSE } = await import("hono/streaming");
        const { spawn } = await import("node:child_process");

        const name = c.req.param("name");
        const isRootless = (process.getuid?.() ?? 0) !== 0;
        const args = [
            ...(isRootless ? ["--user"] : []),
            "-f",
            "-u",
            name,
            "-n",
            "100",
            "--no-pager",
            "-o",
            "short",
        ];

        return streamSSE(c, async (stream) => {
            const proc = spawn("journalctl", args);

            proc.stdout.on("data", (chunk: Buffer) => {
                stream.writeSSE({ data: chunk.toString() });
            });

            stream.onAbort(() => { proc.kill(); });

            await new Promise<void>((resolve) => proc.on("close", resolve));
        });
    });
}

function registerSystemEndpoints(app: Hono) {
    // System + container stats overview (for dashboard)
    app.get("/api/system/stats", async (c) => {
        const { getSystemCpuPercent, getSystemMemory } = await import(
            "./modules/system/system.stats.js"
        );

        const [cpu, memory, containerMetrics] = await Promise.all([
            getSystemCpuPercent(),
            getSystemMemory(),
            store.latestAll(),
        ]);

        // Sum container resource usage
        let containersCpu = 0;
        let containersMem = 0;
        let containersCount = 0;
        for (const point of Object.values(containerMetrics)) {
            containersCpu += point.cpu;
            containersMem += point.mem;
            containersCount++;
        }

        return c.json({
            system: { cpu, memUsed: memory.used, memTotal: memory.total },
            containers: { cpu: containersCpu, mem: containersMem, count: containersCount },
            other: { cpu: Math.max(0, cpu - containersCpu), mem: Math.max(0, memory.used - containersMem) },
        });
    });

    // Disk usage (filesystems + Podman)
    app.get("/api/system/disk", async (c) => {
        const { getSystemDisks } = await import(
            "./modules/system/system.stats.js"
        );
        const { getDiskUsage } = await import(
            "./modules/podman/podman.client.js"
        );

        const [partitions, podman] = await Promise.all([
            getSystemDisks(),
            getDiskUsage(),
        ]);

        let containersSize = 0;
        for (const ct of podman.Containers ?? []) {
            containersSize += ct.RWSize;
        }

        let volumesSize = 0;
        let volumesReclaimable = 0;
        for (const v of podman.Volumes ?? []) {
            volumesSize += v.Size;
            volumesReclaimable += v.ReclaimableSize;
        }

        return c.json({
            partitions,
            images: {
                count: podman.Images?.length ?? 0,
                totalSize: podman.ImagesSize,
            },
            containers: {
                count: podman.Containers?.length ?? 0,
                rwSize: containersSize,
            },
            volumes: {
                count: podman.Volumes?.length ?? 0,
                totalSize: volumesSize,
                reclaimable: volumesReclaimable,
            },
        });
    });

    // SSE live system stats
    app.get("/api/system/stats/live", async (c) => {
        const { streamSSE } = await import("hono/streaming");
        const { getSystemCpuPercent, getSystemMemory } = await import(
            "./modules/system/system.stats.js"
        );

        return streamSSE(c, async (stream) => {
            let running = true;
            stream.onAbort(() => { running = false; });

            while (running) {
                const [cpu, memory] = await Promise.all([
                    getSystemCpuPercent(),
                    getSystemMemory(),
                ]);

                const containerMetrics = store.latestAll();
                let containersCpu = 0;
                let containersMem = 0;
                let containersCount = 0;
                for (const point of Object.values(containerMetrics)) {
                    containersCpu += point.cpu;
                    containersMem += point.mem;
                    containersCount++;
                }

                stream.writeSSE({
                    data: JSON.stringify({
                        system: { cpu, memUsed: memory.used, memTotal: memory.total },
                        containers: { cpu: containersCpu, mem: containersMem, count: containersCount },
                        other: { cpu: Math.max(0, cpu - containersCpu), mem: Math.max(0, memory.used - containersMem) },
                    }),
                });

                await new Promise((r) => setTimeout(r, 5_000));
            }
        });
    });
}
