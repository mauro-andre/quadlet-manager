import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader } from "velojs/hooks";
import type { QuadletListItem } from "../modules/quadlet/quadlet.types.js";
import type { Scope } from "../modules/auth/auth.types.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { ScopeBadge } from "../components/ScopeBadge.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as QuadletEdit from "./QuadletEdit.js";
import * as QuadletNew from "./QuadletNew.js";
import * as css from "./QuadletList.css.js";

interface QuadletListData {
    quadlets: QuadletListItem[];
}

export const loader = async ({ c }: LoaderArgs) => {
    const { listAllQuadlets } = await import(
        "../modules/quadlet/quadlet.service.js"
    );
    const user = c.get("user");
    return { quadlets: await listAllQuadlets(user) } satisfies QuadletListData;
};

export const action_start = async ({
    body, c,
}: ActionArgs<{ serviceName: string; scope: Scope }>) => {
    const { startService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    const user = c!.get("user");
    await startService(body.serviceName, body.scope, user);
    return { ok: true };
};

export const action_stop = async ({
    body, c,
}: ActionArgs<{ serviceName: string; scope: Scope }>) => {
    const { stopService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    const user = c!.get("user");
    await stopService(body.serviceName, body.scope, user);
    return { ok: true };
};

export const action_restart = async ({
    body, c,
}: ActionArgs<{ serviceName: string; scope: Scope }>) => {
    const { restartService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    const user = c!.get("user");
    await restartService(body.serviceName, body.scope, user);
    return { ok: true };
};

export const action_delete = async ({
    body, c,
}: ActionArgs<{ filename: string; scope: Scope }>) => {
    const { stopService, disableService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    const { deleteQuadlet } = await import(
        "../modules/quadlet/quadlet.service.js"
    );

    const user = c!.get("user");
    const serviceName =
        body.filename.replace(/\.[^.]+$/, "") + ".service";
    await stopService(serviceName, body.scope, user).catch(() => {});
    await disableService(serviceName, body.scope, user).catch(() => {});
    await deleteQuadlet(body.filename, body.scope, user);
    return { ok: true };
};

export const Component = () => {
    const { data, loading, refetch } = useLoader<QuadletListData>();

    if (loading.value) return <div>Loading...</div>;

    const quadlets = data.value?.quadlets ?? [];

    const run = (action: Promise<unknown>, msg: string) =>
        action
            .then(() => { toast(msg); refetch(); })
            .catch(() => toast("Action failed", "error"));

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
                                    <th class={css.th}>Scope</th>
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
                                        <tr key={`${q.scope}-${q.filename}`}>
                                            <td class={css.td}>
                                                <Link
                                                    to={QuadletEdit}
                                                    params={{
                                                        name: q.filename,
                                                    }}
                                                    search={{ scope: q.scope }}
                                                    class={css.nameLink}
                                                >
                                                    {q.filename}
                                                </Link>
                                            </td>
                                            <td class={css.td}>
                                                <ScopeBadge scope={q.scope} />
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
                                                                onClick={async () => {
                                                                    if (await confirm(`Stop ${q.filename}?`, { variant: "warning", confirmLabel: "Stop" }))
                                                                        run(action_stop({ body: { serviceName: q.serviceName, scope: q.scope } }), `${q.filename} stopped`);
                                                                }}
                                                            />
                                                            <ActionButton
                                                                label="Restart"
                                                                onClick={() =>
                                                                    run(
                                                                        action_restart({ body: { serviceName: q.serviceName, scope: q.scope } }),
                                                                        `${q.filename} restarted`
                                                                    )
                                                                }
                                                            />
                                                        </>
                                                    ) : (
                                                        <ActionButton
                                                            label="Start"
                                                            variant="primary"
                                                            onClick={() =>
                                                                run(
                                                                    action_start({ body: { serviceName: q.serviceName, scope: q.scope } }),
                                                                    `${q.filename} started`
                                                                )
                                                            }
                                                        />
                                                    )}
                                                    <ActionButton
                                                        label="Delete"
                                                        variant="danger"
                                                        onClick={async () => {
                                                            if (await confirm(`Delete ${q.filename}? This cannot be undone.`, { confirmLabel: "Delete" }))
                                                                run(action_delete({ body: { filename: q.filename, scope: q.scope } }), `${q.filename} deleted`);
                                                        }}
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
