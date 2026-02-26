import type { LoaderArgs } from "velojs";
import { useLoader } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import type { PodmanContainer } from "../modules/podman/podman.types.js";
import type { QuadletListItem } from "../modules/quadlet/quadlet.types.js";
import * as css from "./Dashboard.css.js";

interface DashboardData {
    containers: PodmanContainer[];
    quadlets: QuadletListItem[];
}

interface SystemStats {
    system: { cpu: number; memUsed: number; memTotal: number };
    containers: { cpu: number; mem: number; count: number };
    other: { cpu: number; mem: number };
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const loader = async (_args: LoaderArgs) => {
    const { listContainers } = await import(
        "../modules/podman/podman.client.js"
    );
    const { listQuadlets } = await import(
        "../modules/quadlet/quadlet.service.js"
    );

    const [containers, quadlets] = await Promise.all([
        listContainers(true).catch(() => [] as PodmanContainer[]),
        listQuadlets(),
    ]);

    return { containers, quadlets } satisfies DashboardData;
};

function ResourceCard({
    title,
    cpu,
    memUsed,
    memTotal,
    color,
}: {
    title: string;
    cpu: number;
    memUsed: number;
    memTotal: number;
    color: string;
}) {
    const memPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

    return (
        <div class={css.resourceCard}>
            <div class={css.resourceCardTitle}>{title}</div>

            <div>
                <div class={css.resourceRow}>
                    <span class={css.resourceLabel}>CPU</span>
                    <span class={css.resourceValue}>{cpu.toFixed(2)}%</span>
                </div>
                <div class={css.progressBar}>
                    <div
                        class={css.progressFill}
                        style={{ width: `${Math.min(100, cpu)}%`, backgroundColor: color }}
                    />
                </div>
            </div>

            <div>
                <div class={css.resourceRow}>
                    <span class={css.resourceLabel}>Memory</span>
                    <span class={css.resourceValue}>
                        {formatBytes(memUsed)}
                        {memTotal > 0 && ` / ${formatBytes(memTotal)}`}
                    </span>
                </div>
                <div class={css.progressBar}>
                    <div
                        class={css.progressFill}
                        style={{ width: `${Math.min(100, memPercent)}%`, backgroundColor: color }}
                    />
                </div>
            </div>
        </div>
    );
}

export const Component = () => {
    const { data, loading } = useLoader<DashboardData>();
    const statsRef = useRef<SystemStats | null>(null);
    const stats = useSignal<SystemStats | null>(null);

    // Live system stats via SSE
    useEffect(() => {
        if (typeof window === "undefined") return;

        fetch("/api/system/stats")
            .then((res) => res.json())
            .then((d: SystemStats) => {
                statsRef.current = d;
                stats.value = d;
            })
            .catch(() => {});

        const es = new EventSource("/api/system/stats/live");
        es.onmessage = (e) => {
            const d: SystemStats = JSON.parse(e.data);
            statsRef.current = d;
            stats.value = d;
        };

        return () => es.close();
    }, []);

    if (loading.value) return <div>Loading...</div>;

    const containers = data.value?.containers ?? [];
    const quadlets = data.value?.quadlets ?? [];
    const running = containers.filter((c) => c.State === "running").length;
    const stopped = containers.length - running;
    const s = stats.value;

    return (
        <div class={css.page}>
            <h1 class={css.title}>Dashboard</h1>

            <div class={css.grid}>
                <div class={css.card}>
                    <span class={css.cardLabel}>Containers</span>
                    <span class={css.cardValue}>{containers.length}</span>
                </div>
                <div class={css.card}>
                    <span class={css.cardLabel}>Running</span>
                    <span class={css.cardValue}>{running}</span>
                </div>
                <div class={css.card}>
                    <span class={css.cardLabel}>Stopped</span>
                    <span class={css.cardValue}>{stopped}</span>
                </div>
                <div class={css.card}>
                    <span class={css.cardLabel}>Quadlets</span>
                    <span class={css.cardValue}>{quadlets.length}</span>
                </div>
            </div>

            {s && (
                <div class={css.resourceSection}>
                    <div class={css.sectionTitle}>Resource Usage</div>
                    <div class={css.resourceGrid}>
                        <ResourceCard
                            title="System"
                            cpu={s.system.cpu}
                            memUsed={s.system.memUsed}
                            memTotal={s.system.memTotal}
                            color="#6c8cff"
                        />
                        <ResourceCard
                            title={`Containers (${s.containers.count})`}
                            cpu={s.containers.cpu}
                            memUsed={s.containers.mem}
                            memTotal={s.system.memTotal}
                            color="#51cf66"
                        />
                        <ResourceCard
                            title="Other Services"
                            cpu={s.other.cpu}
                            memUsed={s.other.mem}
                            memTotal={s.system.memTotal}
                            color="#fcc419"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
