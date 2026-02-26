import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader, useParams } from "velojs/hooks";
import type { PodmanContainerInspect } from "../modules/podman/podman.types.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { ActionButton } from "../components/ActionButton.js";
import { LogStream } from "../components/LogStream.js";
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
    const { data, loading } = useLoader<ContainerDetailData>([params.id]);

    if (loading.value) return <div>Loading...</div>;
    if (!data.value) return <div>Container not found</div>;

    const { container, serviceName } = data.value;
    const name = container.Name.replace(/^\//, "");
    const state = container.State;

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
                                action_start({ body: { serviceName } })
                            }
                        />
                        <ActionButton
                            label="Stop"
                            variant="danger"
                            onClick={() =>
                                action_stop({ body: { serviceName } })
                            }
                        />
                        <ActionButton
                            label="Restart"
                            onClick={() =>
                                action_restart({ body: { serviceName } })
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

                <LogStream
                    url={`/api/logs/container/${encodeURIComponent(name)}`}
                    title="Container Logs"
                />
        </div>
    );
};
