import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import * as css from "./LogStream.css.js";

interface LogStreamProps {
    url: string;
    title?: string;
}

export function LogStream({ url, title = "Logs" }: LogStreamProps) {
    const logs = useSignal("");
    const connected = useSignal(false);
    const preRef = useRef<HTMLPreElement>(null);

    useEffect(() => {
        const es = new EventSource(url);

        es.onopen = () => {
            connected.value = true;
        };

        es.onmessage = (e) => {
            logs.value += e.data;
            const el = preRef.current;
            if (el) {
                requestAnimationFrame(() => {
                    el.scrollTop = el.scrollHeight;
                });
            }
        };

        es.onerror = () => {
            connected.value = false;
        };

        return () => {
            es.close();
            connected.value = false;
        };
    }, [url]);

    return (
        <div class={css.wrapper}>
            <div class={css.header}>
                <span class={css.title}>{title}</span>
                <span class={css.indicator}>
                    <span
                        class={`${css.dot} ${connected.value ? css.dotConnected : ""}`}
                    />
                    {connected.value ? "Live" : "Disconnected"}
                </span>
            </div>
            <pre class={css.logs} ref={preRef}>
                {logs.value || "Waiting for logs..."}
            </pre>
        </div>
    );
}
