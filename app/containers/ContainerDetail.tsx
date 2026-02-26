import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader, useParams } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { PodmanContainerInspect } from "../modules/podman/podman.types.js";
import type { MetricPoint, TimeRange } from "../modules/metrics/metrics.types.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { ActionButton } from "../components/ActionButton.js";
import { LogStream } from "../components/LogStream.js";
import { MetricsChart } from "../components/MetricsChart.js";
import { TimeRangeSelector } from "../components/TimeRangeSelector.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as ContainerList from "./ContainerList.js";
import * as css from "./ContainerDetail.css.js";

interface ContainerDetailData {
    container: PodmanContainerInspect;
    serviceName: string;
}

export const loader = async ({ params }: LoaderArgs) => {
    const { inspectContainer } = await import(
        "../modules/podman/podman.client.js"
    );

    const container = await inspectContainer(params.id!);
    const serviceName =
        container.Config?.Labels?.["PODMAN_SYSTEMD_UNIT"] ??
        `${container.Name.replace(/^\//, "")}.service`;

    return { container, serviceName } satisfies ContainerDetailData;
};

export const action_start = async ({
    body,
}: ActionArgs<{ serviceName: string }>) => {
    const { startService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await startService(body.serviceName);
    return { ok: true };
};

export const action_stop = async ({
    body,
}: ActionArgs<{ serviceName: string }>) => {
    const { stopService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await stopService(body.serviceName);
    return { ok: true };
};

export const action_restart = async ({
    body,
}: ActionArgs<{ serviceName: string }>) => {
    const { restartService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await restartService(body.serviceName);
    return { ok: true };
};

export const Component = () => {
    const params = useParams<{ id: string }>();
    const { data, loading, refetch } = useLoader<ContainerDetailData>([params.id]);
    const metrics = useSignal<MetricPoint[]>([]);
    const timeRange = useSignal<TimeRange>("1h");

    // Fetch historical metrics when range changes
    useEffect(() => {
        if (typeof window === "undefined" || !params.id) return;

        fetch(`/api/metrics/${params.id}?range=${timeRange.value}`)
            .then((res) => res.json())
            .then((points: MetricPoint[]) => { metrics.value = points; })
            .catch(() => {});
    }, [params.id, timeRange.value]);

    // Live metrics via SSE
    useEffect(() => {
        if (typeof window === "undefined" || !params.id) return;

        const es = new EventSource(`/api/metrics/${params.id}/live`);
        es.onmessage = (e) => {
            const point: MetricPoint = JSON.parse(e.data);
            metrics.value = [...metrics.value, point];
        };

        return () => es.close();
    }, [params.id]);

    if (loading.value) return <div>Loading...</div>;
    if (!data.value) return <div>Container not found</div>;

    const { container, serviceName } = data.value;
    const name = container.Name.replace(/^\//, "");
    const state = container.State;

    const run = (action: Promise<unknown>, msg: string) =>
        action
            .then(() => { toast(msg); refetch(); })
            .catch(() => toast("Action failed", "error"));

    return (
        <div class={css.page}>
                <Link to={ContainerList} class={css.backLink}>
                    Back to Containers
                </Link>

                <div class={css.header}>
                    <h1 class={css.title}>{name}</h1>
                    <StatusBadge status={state.Status} />
                    <div class={css.actions}>
                        <ActionButton
                            label="Start"
                            variant="primary"
                            onClick={() =>
                                run(
                                    action_start({ body: { serviceName } }),
                                    "Container started"
                                )
                            }
                        />
                        <ActionButton
                            label="Stop"
                            variant="danger"
                            onClick={async () => {
                                if (await confirm(`Stop container ${name}?`, { variant: "warning", confirmLabel: "Stop" }))
                                    run(action_stop({ body: { serviceName } }), "Container stopped");
                            }}
                        />
                        <ActionButton
                            label="Restart"
                            onClick={() =>
                                run(
                                    action_restart({ body: { serviceName } }),
                                    "Container restarted"
                                )
                            }
                        />
                    </div>
                </div>

                <div class={css.section}>
                    <div class={css.sectionTitle}>Info</div>
                    <div class={css.infoGrid}>
                        <span class={css.infoLabel}>ID</span>
                        <span class={css.infoValue}>
                            {container.Id.slice(0, 12)}
                        </span>
                        <span class={css.infoLabel}>Image</span>
                        <span class={css.infoValue}>
                            {container.Config.Image}
                        </span>
                        <span class={css.infoLabel}>Status</span>
                        <span class={css.infoValue}>
                            {state.Status}
                        </span>
                        <span class={css.infoLabel}>Started</span>
                        <span class={css.infoValue}>
                            {state.StartedAt
                                ? new Date(
                                      state.StartedAt
                                  ).toLocaleString()
                                : "-"}
                        </span>
                        <span class={css.infoLabel}>PID</span>
                        <span class={css.infoValue}>{state.Pid || "-"}</span>
                        <span class={css.infoLabel}>Exit Code</span>
                        <span class={css.infoValue}>
                            {state.ExitCode}
                        </span>
                        <span class={css.infoLabel}>Service</span>
                        <span class={css.infoValue}>{serviceName}</span>
                    </div>
                </div>

                <div class={css.metricsSection}>
                    <div class={css.metricsHeader}>
                        <span class={css.sectionTitle}>Metrics</span>
                        <TimeRangeSelector
                            value={timeRange.value}
                            onChange={(r) => { timeRange.value = r; }}
                        />
                    </div>
                    <div class={css.metricsGrid}>
                        <MetricsChart
                            data={metrics.value}
                            type="cpu"
                            title="CPU Usage"
                        />
                        <MetricsChart
                            data={metrics.value}
                            type="memory"
                            title="Memory Usage"
                        />
                    </div>
                </div>

                <LogStream
                    url={`/api/logs/container/${encodeURIComponent(name)}`}
                    title="Container Logs"
                />
        </div>
    );
};
