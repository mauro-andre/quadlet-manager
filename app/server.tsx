import type { Hono } from "hono";
import { addRoutes } from "velojs/server";

addRoutes((app: Hono) => {
    registerLogStreams(app);
});

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
