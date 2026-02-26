import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader } from "velojs/hooks";
import type { QuadletListItem } from "../modules/quadlet/quadlet.types.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { ActionButton } from "../components/ActionButton.js";
import * as QuadletEdit from "./QuadletEdit.js";
import * as QuadletNew from "./QuadletNew.js";
import * as css from "./QuadletList.css.js";

interface QuadletListData {
    quadlets: QuadletListItem[];
}

export const loader = async (_args: LoaderArgs) => {
    const { listQuadlets } = await import(
        "../modules/quadlet/quadlet.service.js"
    );
    return { quadlets: await listQuadlets() } satisfies QuadletListData;
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

export const action_delete = async ({
    body,
}: ActionArgs<{ filename: string }>) => {
    const { stopService, disableService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    const { deleteQuadlet } = await import(
        "../modules/quadlet/quadlet.service.js"
    );

    const serviceName =
        body.filename.replace(/\.[^.]+$/, "") + ".service";
    await stopService(serviceName).catch(() => {});
    await disableService(serviceName).catch(() => {});
    await deleteQuadlet(body.filename);
    return { ok: true };
};

export const Component = () => {
    const { data, loading } = useLoader<QuadletListData>();

    if (loading.value) return <div>Loading...</div>;

    const quadlets = data.value?.quadlets ?? [];

    const reload = () => window.location.reload();

    return (
        <div class={css.page}>
                <div class={css.header}>
                    <h1 class={css.title}>Quadlets</h1>
                    <Link to={QuadletNew} class={css.newButton}>
                        New Quadlet
                    </Link>
                </div>
                <div class={css.tableWrapper}>
                    {quadlets.length === 0 ? (
                        <div class={css.empty}>
                            No quadlet files found.
                        </div>
                    ) : (
                        <table class={css.table}>
                            <thead>
                                <tr>
                                    <th class={css.th}>Name</th>
                                    <th class={css.th}>Type</th>
                                    <th class={css.th}>Status</th>
                                    <th class={css.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quadlets.map((q) => {
                                    const isActive =
                                        q.activeState === "active";
                                    return (
                                        <tr key={q.filename}>
                                            <td class={css.td}>
                                                <Link
                                                    to={QuadletEdit}
                                                    params={{
                                                        name: q.filename,
                                                    }}
                                                    class={css.nameLink}
                                                >
                                                    {q.filename}
                                                </Link>
                                            </td>
                                            <td class={css.td}>
                                                <span
                                                    class={css.typeBadge}
                                                >
                                                    {q.type}
                                                </span>
                                            </td>
                                            <td class={css.td}>
                                                <StatusBadge
                                                    status={
                                                        q.activeState
                                                    }
                                                />
                                            </td>
                                            <td class={css.td}>
                                                <div
                                                    class={
                                                        css.actionsCell
                                                    }
                                                >
                                                    {isActive ? (
                                                        <>
                                                            <ActionButton
                                                                label="Stop"
                                                                onClick={() =>
                                                                    action_stop(
                                                                        {
                                                                            body: {
                                                                                serviceName:
                                                                                    q.serviceName,
                                                                            },
                                                                        }
                                                                    ).then(
                                                                        reload
                                                                    )
                                                                }
                                                            />
                                                            <ActionButton
                                                                label="Restart"
                                                                onClick={() =>
                                                                    action_restart(
                                                                        {
                                                                            body: {
                                                                                serviceName:
                                                                                    q.serviceName,
                                                                            },
                                                                        }
                                                                    ).then(
                                                                        reload
                                                                    )
                                                                }
                                                            />
                                                        </>
                                                    ) : (
                                                        <ActionButton
                                                            label="Start"
                                                            variant="primary"
                                                            onClick={() =>
                                                                action_start(
                                                                    {
                                                                        body: {
                                                                            serviceName:
                                                                                q.serviceName,
                                                                        },
                                                                    }
                                                                ).then(
                                                                    reload
                                                                )
                                                            }
                                                        />
                                                    )}
                                                    <ActionButton
                                                        label="Delete"
                                                        variant="danger"
                                                        onClick={() =>
                                                            action_delete(
                                                                {
                                                                    body: {
                                                                        filename:
                                                                            q.filename,
                                                                    },
                                                                }
                                                            ).then(
                                                                reload
                                                            )
                                                        }
                                                    />
                                                </div>
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
