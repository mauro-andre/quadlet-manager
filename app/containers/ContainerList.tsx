import type { LoaderArgs } from "velojs";
import { Link } from "velojs";
import { useLoader } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import type { PodmanContainer } from "../modules/podman/podman.types.js";
import type { MetricPoint } from "../modules/metrics/metrics.types.js";
import { StatusBadge } from "../components/StatusBadge.js";
import * as ContainerDetail from "./ContainerDetail.js";
import * as css from "./ContainerList.css.js";

function formatBytes(bytes: number): string {
    if (bytes === 0) return "-";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

interface ContainerListData {
    containers: PodmanContainer[];
}

export const loader = async (_args: LoaderArgs) => {
    const { listContainers } = await import(
        "../modules/podman/podman.client.js"
    );
    const containers = await listContainers(true).catch(
        () => [] as PodmanContainer[]
    );
    return { containers } satisfies ContainerListData;
};

export const Component = () => {
    const { data, loading } = useLoader<ContainerListData>();
    const metricsRef = useRef<Record<string, MetricPoint>>({});
    const liveMetrics = useSignal<Record<string, MetricPoint>>({});

    // Fetch initial current metrics + live SSE
    useEffect(() => {
        if (typeof window === "undefined") return;

        fetch("/api/metrics/current")
            .then((res) => res.json())
            .then((d: Record<string, MetricPoint>) => {
                metricsRef.current = d;
                liveMetrics.value = d;
            })
            .catch(() => {});

        const es = new EventSource("/api/metrics/live");
        es.onmessage = (e) => {
            const { containerId, ...point } = JSON.parse(e.data) as MetricPoint & { containerId: string };
            metricsRef.current = { ...metricsRef.current, [containerId]: point };
            liveMetrics.value = metricsRef.current;
        };

        return () => es.close();
    }, []);

    if (loading.value) return <div>Loading...</div>;

    const containers = data.value?.containers ?? [];

    return (
        <div class={css.page}>
                <h1 class={css.title}>Containers</h1>
                <div class={css.tableWrapper}>
                    {containers.length === 0 ? (
                        <div class={css.empty}>
                            No containers found. Is the Podman socket
                            accessible?
                        </div>
                    ) : (
                        <table class={css.table}>
                            <thead>
                                <tr>
                                    <th class={css.th}>Name</th>
                                    <th class={css.th}>Image</th>
                                    <th class={css.th}>Status</th>
                                    <th class={css.th}>CPU</th>
                                    <th class={css.th}>Memory</th>
                                    <th class={css.th}>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {containers.map((c) => {
                                    const name =
                                        c.Names?.[0]?.replace(
                                            /^\//,
                                            ""
                                        ) ?? c.Id.slice(0, 12);
                                    const m = liveMetrics.value[c.Id];
                                    const isRunning = c.State === "running";
                                    return (
                                        <tr key={c.Id}>
                                            <td class={css.td}>
                                                <Link
                                                    to={ContainerDetail}
                                                    params={{
                                                        id: c.Id.slice(
                                                            0,
                                                            12
                                                        ),
                                                    }}
                                                    class={css.nameLink}
                                                >
                                                    {name}
                                                </Link>
                                            </td>
                                            <td class={css.td}>
                                                {c.Image}
                                            </td>
                                            <td class={css.td}>
                                                <StatusBadge
                                                    status={c.State}
                                                />
                                            </td>
                                            <td class={css.td}>
                                                {isRunning && m ? `${m.cpu.toFixed(2)}%` : "-"}
                                            </td>
                                            <td class={css.td}>
                                                {isRunning && m
                                                    ? `${formatBytes(m.mem)} / ${m.memLimit > 0 ? ((m.mem / m.memLimit) * 100).toFixed(0) : 0}%`
                                                    : "-"}
                                            </td>
                                            <td class={css.td}>
                                                {new Date(
                                                    c.Created
                                                ).toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
        </div>
    );
};
