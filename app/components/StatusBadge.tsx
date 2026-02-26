import * as css from "./StatusBadge.css.js";

type StatusKey = keyof typeof css.variants;

const statusMap: Record<string, StatusKey> = {
    running: "running",
    active: "running",
    exited: "exited",
    stopped: "exited",
    inactive: "exited",
    dead: "exited",
    created: "created",
    paused: "paused",
    failed: "failed",
    error: "failed",
};

function resolveStatus(status: string): StatusKey {
    return statusMap[status.toLowerCase()] ?? "unknown";
}

export function StatusBadge({ status }: { status: string }) {
    const key = resolveStatus(status);

    return (
        <span class={`${css.base} ${css.variants[key]}`}>
            <span class={`${css.dot} ${css.dotVariants[key]}`} />
            {status}
        </span>
    );
}
