import type { Hono } from "hono";
import { addRoutes } from "velojs/server";
import { MetricsStore } from "./modules/metrics/metrics.store.js";
import { startCollector } from "./modules/metrics/metrics.collector.js";
import type { TimeRange } from "./modules/metrics/metrics.types.js";
import { authMiddleware } from "./modules/auth/auth.middleware.js";
import type { AuthUser, Scope } from "./modules/auth/auth.types.js";

const store = new MetricsStore();
startCollector(store);

function getScope(c: { req: { query: (k: string) => string | undefined } }): Scope {
    const s = c.req.query("scope");
    return s === "system" ? "system" : "user";
}

function getUser(c: { get: (k: string) => unknown }): AuthUser {
    return c.get("user") as AuthUser;
}

addRoutes((app: Hono) => {
    // Protect all API routes with auth
    app.use("/api/*", authMiddleware);

    // Logout endpoint
    app.post("/api/auth/logout", async (c) => {
        const { deleteCookie } = await import("velojs/cookie");
        deleteCookie(c, "session", { path: "/" });
        return c.json({ ok: true });
    });

    registerLogStreams(app);
    registerMetricsEndpoints(app);
    registerSystemEndpoints(app);
    registerPodmanEndpoints(app);
    registerPullEndpoints(app);
    registerProxyEndpoints(app);
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
        const scope = getScope(c);
        const user = getUser(c);

        // Use podman with the correct socket for the scope
        const { getSocketForScope } = await import("./modules/podman/podman.client.js");
        const socket = getSocketForScope(scope, user.uid);

        return streamSSE(c, async (stream) => {
            const proc = spawn("podman", [
                "--url", `unix://${socket}`,
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
        const scope = getScope(c);
        const user = getUser(c);

        const { journalctlCmd } = await import("./modules/systemd/systemd.service.js");
        const [cmd, args, env] = journalctlCmd(
            ["-f", "-u", name, "-n", "100", "--no-pager", "-o", "short"],
            scope,
            user
        );

        return streamSSE(c, async (stream) => {
            const proc = spawn(cmd, args, env ? { env: { ...process.env, ...env } } : undefined);

            proc.stdout.on("data", (chunk: Buffer) => {
                stream.writeSSE({ data: chunk.toString() });
            });

            stream.onAbort(() => { proc.kill(); });

            await new Promise<void>((resolve) => proc.on("close", resolve));
        });
    });
}

function registerPullEndpoints(app: Hono) {
    app.post("/api/images/pull", async (c) => {
        const { pullStore } = await import("./modules/podman/pull.store.js");
        const { podmanStreamPull } = await import("./modules/podman/podman.client.js");

        const user = getUser(c);
        const { reference, scope: reqScope } = await c.req.json<{ reference: string; scope?: Scope }>();
        if (!reference || typeof reference !== "string") {
            return c.json({ error: "Missing reference" }, 400);
        }

        const scope: Scope = reqScope === "system" ? "system" : "user";
        const pullId = pullStore.createPull(reference.trim());
        let lastError = "";
        let pulledImages: string[] | null = null;

        podmanStreamPull(
            reference.trim(),
            scope,
            user.uid,
            (line) => {
                try {
                    const parsed = JSON.parse(line);

                    // Track final result fields
                    if (parsed.images && Array.isArray(parsed.images)) {
                        pulledImages = parsed.images;
                    }
                    if (parsed.error) {
                        lastError = parsed.error;
                    }

                    const message = parsed.stream || parsed.error || "";
                    if (message) {
                        pullStore.emit({
                            pullId,
                            reference,
                            type: "progress",
                            message: message.replace(/\n$/, ""),
                            timestamp: Date.now(),
                        });
                    }
                } catch {
                    pullStore.emit({
                        pullId,
                        reference,
                        type: "progress",
                        message: line,
                        timestamp: Date.now(),
                    });
                }
            },
            () => {
                if (lastError || !pulledImages || pulledImages.length === 0) {
                    pullStore.emit({
                        pullId,
                        reference,
                        type: "error",
                        message: lastError || "Pull failed: no images returned",
                        timestamp: Date.now(),
                    });
                } else {
                    pullStore.emit({
                        pullId,
                        reference,
                        type: "complete",
                        message: `Successfully pulled ${reference}`,
                        timestamp: Date.now(),
                    });
                }
            },
            (err) => {
                pullStore.emit({
                    pullId,
                    reference,
                    type: "error",
                    message: err.message,
                    timestamp: Date.now(),
                });
            },
        );

        return c.json({ pullId });
    });

    app.get("/api/images/pull/events", async (c) => {
        const { streamSSE } = await import("hono/streaming");
        const { pullStore } = await import("./modules/podman/pull.store.js");

        return streamSSE(c, async (stream) => {
            const active = pullStore.getActivePulls();
            if (active.length > 0) {
                await stream.writeSSE({
                    event: "snapshot",
                    data: JSON.stringify(active),
                });
            }

            const unsubscribe = pullStore.subscribe((event) => {
                stream.writeSSE({
                    event: event.type === "error" ? "pull-error" : event.type,
                    data: JSON.stringify(event),
                });
            });

            stream.onAbort(() => { unsubscribe(); });
            await new Promise<void>(() => {});
        });
    });
}

function registerPodmanEndpoints(app: Hono) {
    // Image names (for quadlet editor) — scope-aware
    app.get("/api/podman/images", async (c) => {
        const { listImages } = await import("./modules/podman/podman.client.js");
        const scope = getScope(c);
        const user = getUser(c);
        const images = await listImages(scope, user.uid).catch(() => []);
        const tags: string[] = [];
        for (const img of images) {
            if (img.RepoTags) {
                for (const tag of img.RepoTags) {
                    if (tag !== "<none>:<none>") tags.push(tag);
                }
            }
        }
        return c.json(tags);
    });

    // Volume names (for quadlet editor) — scope-aware
    app.get("/api/podman/volumes", async (c) => {
        const { listVolumes } = await import("./modules/podman/podman.client.js");
        const scope = getScope(c);
        const user = getUser(c);
        const volumes = await listVolumes(scope, user.uid).catch(() => []);
        return c.json(volumes.map((v) => v.Name));
    });

    // Network names (for quadlet editor) — scope-aware
    app.get("/api/podman/networks", async (c) => {
        const { listNetworks } = await import("./modules/podman/podman.client.js");
        const scope = getScope(c);
        const user = getUser(c);
        const networks = await listNetworks(scope, user.uid).catch(() => []);
        return c.json(networks.map((n) => n.name).filter(Boolean));
    });
}

function registerSystemEndpoints(app: Hono) {
    // System + container stats overview (for dashboard)
    app.get("/api/system/stats", async (c) => {
        const { getSystemCpuPercent, getSystemMemory } = await import(
            "./modules/system/system.stats.js"
        );
        const { listContainers } = await import(
            "./modules/podman/podman.client.js"
        );

        const user = getUser(c);
        const [cpu, memory, containers] = await Promise.all([
            getSystemCpuPercent(),
            getSystemMemory(),
            listContainers("user", user.uid).catch(() => []),
        ]);

        // Filter collector metrics to only include user's containers
        const containerIds = new Set(containers.map((ct) => ct.Id));
        const allMetrics = store.latestAll();
        let containersCpu = 0;
        let containersMem = 0;
        let containersCount = 0;
        for (const [id, point] of Object.entries(allMetrics)) {
            if (containerIds.has(id)) {
                containersCpu += point.cpu;
                containersMem += point.mem;
                containersCount++;
            }
        }

        return c.json({
            system: { cpu, memUsed: memory.used, memTotal: memory.total },
            containers: { cpu: containersCpu, mem: containersMem, count: containersCount },
            other: { cpu: Math.max(0, cpu - containersCpu), mem: Math.max(0, memory.used - containersMem) },
        });
    });

    // Disk usage (filesystems + Podman) — uses user scope
    app.get("/api/system/disk", async (c) => {
        const { getSystemDisks } = await import(
            "./modules/system/system.stats.js"
        );
        const { getDiskUsage } = await import(
            "./modules/podman/podman.client.js"
        );

        const user = getUser(c);
        const scope = getScope(c);
        const [partitions, podman] = await Promise.all([
            getSystemDisks(),
            getDiskUsage(scope, user.uid),
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

    // SSE live system stats — queries user's Podman socket directly
    app.get("/api/system/stats/live", async (c) => {
        const { streamSSE } = await import("hono/streaming");
        const { getSystemCpuPercent, getSystemMemory } = await import(
            "./modules/system/system.stats.js"
        );
        const { getAllContainerStats } = await import(
            "./modules/podman/podman.client.js"
        );

        const user = getUser(c);
        const prevCpu = new Map<string, { cpuNano: number; systemNano: number }>();

        return streamSSE(c, async (stream) => {
            let running = true;
            stream.onAbort(() => { running = false; });

            while (running) {
                const [cpu, memory, stats] = await Promise.all([
                    getSystemCpuPercent(),
                    getSystemMemory(),
                    getAllContainerStats("user", user.uid).catch(() => []),
                ]);

                let containersCpu = 0;
                let containersMem = 0;
                const containersCount = stats.length;

                for (const s of stats) {
                    let cpuPercent = 0;
                    const prev = prevCpu.get(s.ContainerID);
                    if (prev && prev.systemNano > 0) {
                        const deltaCpu = s.CPUNano - prev.cpuNano;
                        const deltaSystem = s.SystemNano - prev.systemNano;
                        if (deltaSystem > 0) {
                            cpuPercent = Math.min(100, (deltaCpu / deltaSystem) * 100);
                        }
                    }
                    prevCpu.set(s.ContainerID, { cpuNano: s.CPUNano, systemNano: s.SystemNano });

                    containersCpu += cpuPercent;
                    containersMem += s.MemUsage;
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

function registerProxyEndpoints(app: Hono) {
    // Running containers with ports and networks (for domain form)
    app.get("/api/proxy/containers", async (c) => {
        const { getContainersWithPorts } = await import(
            "./modules/proxy/proxy.service.js"
        );
        const user = getUser(c);
        const containers = await getContainersWithPorts(user);
        return c.json(containers);
    });

    // Sysctl check for port 80 binding
    app.get("/api/proxy/sysctl", async (c) => {
        const { checkSysctl } = await import(
            "./modules/proxy/proxy.service.js"
        );
        const result = await checkSysctl();
        return c.json(result);
    });
}
