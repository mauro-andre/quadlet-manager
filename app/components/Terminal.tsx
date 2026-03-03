import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import * as css from "./Terminal.css.js";

interface TerminalViewProps {
    wsUrl: string;
}

export function TerminalView({ wsUrl }: TerminalViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const exited = useSignal(false);

    useEffect(() => {
        if (typeof window === "undefined" || !containerRef.current) return;

        let term: any;
        let fitAddon: any;
        let ws: WebSocket;
        let resizeObserver: ResizeObserver;
        let disposed = false;

        (async () => {
            const { Terminal } = await import("@xterm/xterm");
            const { FitAddon } = await import("@xterm/addon-fit");

            // Dynamic CSS import — Vite extracts it into the bundle
            await import("@xterm/xterm/css/xterm.css");

            if (disposed) return;

            term = new Terminal({
                cursorBlink: true,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                fontSize: 14,
                theme: {
                    background: "#0f1117",
                    foreground: "#e1e4ed",
                    cursor: "#e1e4ed",
                    selectionBackground: "#3d4470",
                    black: "#0f1117",
                    red: "#ff6b6b",
                    green: "#51cf66",
                    yellow: "#fcc419",
                    blue: "#6c8cff",
                    magenta: "#c792ea",
                    cyan: "#89ddff",
                    white: "#e1e4ed",
                    brightBlack: "#636d83",
                    brightRed: "#ff6b6b",
                    brightGreen: "#51cf66",
                    brightYellow: "#fcc419",
                    brightBlue: "#6c8cff",
                    brightMagenta: "#c792ea",
                    brightCyan: "#89ddff",
                    brightWhite: "#ffffff",
                },
            });

            fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(containerRef.current!);
            fitAddon.fit();

            // Connect WebSocket
            const protocol = location.protocol === "https:" ? "wss:" : "ws:";
            const fullUrl = `${protocol}//${location.host}${wsUrl}`;
            ws = new WebSocket(fullUrl);

            ws.onopen = () => {
                // Send initial resize to trigger PTY creation
                const dims = { cols: term.cols, rows: term.rows };
                ws.send(JSON.stringify({ type: "resize", ...dims }));
            };

            ws.onmessage = (event) => {
                let msg: { type: string; data?: string; code?: number };
                try {
                    msg = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (msg.type === "data" && msg.data) {
                    term.write(msg.data);
                } else if (msg.type === "exit") {
                    term.write(`\r\n\x1b[90m[Process exited with code ${msg.code ?? 0}]\x1b[0m\r\n`);
                    exited.value = true;
                }
            };

            ws.onclose = () => {
                if (!exited.value) {
                    term.write("\r\n\x1b[90m[Connection closed]\x1b[0m\r\n");
                    exited.value = true;
                }
            };

            // Terminal input -> WebSocket
            term.onData((data: string) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "data", data }));
                }
            });

            // Resize handling
            resizeObserver = new ResizeObserver(() => {
                if (disposed) return;
                fitAddon.fit();
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
                }
            });
            resizeObserver.observe(containerRef.current!);
        })();

        return () => {
            disposed = true;
            resizeObserver?.disconnect();
            ws?.close();
            term?.dispose();
        };
    }, [wsUrl]);

    return (
        <div ref={containerRef} class={css.terminalContainer} />
    );
}
