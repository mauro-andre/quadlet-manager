import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import type { SystemdUnitListItem } from "../modules/systemd/systemd-unit.service.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as SystemdEdit from "./SystemdEdit.js";
import * as SystemdNew from "./SystemdNew.js";
import * as css from "../quadlets/QuadletList.css.js";

interface SystemdListData {
    units: SystemdUnitListItem[];
}

export const loader = async ({ c }: LoaderArgs) => {
    const { listUnits } = await import(
        "../modules/systemd/systemd-unit.service.js"
    );
    const user = c.get("user");
    return { units: await listUnits(user) } satisfies SystemdListData;
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

export const action_enable = async ({
    body,
}: ActionArgs<{ serviceName: string }>) => {
    const { enableService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await enableService(body.serviceName);
    return { ok: true };
};

export const action_delete = async ({
    body, c,
}: ActionArgs<{ filename: string }>) => {
    const { stopService, disableService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    const { deleteUnit } = await import(
        "../modules/systemd/systemd-unit.service.js"
    );

    const user = c!.get("user");
    await stopService(body.filename).catch(() => {});
    await disableService(body.filename).catch(() => {});
    await deleteUnit(body.filename, user);
    return { ok: true };
};

export const Component = () => {
    const { data, loading, refetch } = useLoader<SystemdListData>();
    const search = useSignal("");
    const typeFilter = useSignal("all");

    if (loading.value) return <div>Loading...</div>;

    const allUnits = data.value?.units ?? [];
    const query = search.value.toLowerCase();
    const units = allUnits.filter((u) => {
        if (typeFilter.value !== "all" && u.type !== typeFilter.value) return false;
        if (query && !u.filename.toLowerCase().includes(query)) return false;
        return true;
    });

    const run = (action: Promise<unknown>, msg: string) =>
        action
            .then(() => { toast(msg); refetch(); })
            .catch(() => toast("Action failed", "error"));

    return (
        <div class={css.page}>
                <div class={css.header}>
                    <h1 class={css.title}>Systemd</h1>
                    <div class={css.headerActions}>
                        <Link to={SystemdNew} class={css.newButton}>
                            New Unit
                        </Link>
                    </div>
                </div>
                <div class={css.toolbar}>
                    <input
                        class={css.searchInput}
                        type="text"
                        placeholder="Search units..."
                        value={search.value}
                        onInput={(e) => { search.value = (e.target as HTMLInputElement).value; }}
                    />
                    <select
                        class={css.filterSelect}
                        value={typeFilter.value}
                        onChange={(e) => { typeFilter.value = (e.target as HTMLSelectElement).value; }}
                    >
                        <option value="all">All types</option>
                        <option value="service">Services</option>
                        <option value="timer">Timers</option>
                    </select>
                </div>
                <div class={css.tableWrapper}>
                    {units.length === 0 ? (
                        <div class={css.empty}>
                            No systemd units found.
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
                                {units.map((u) => {
                                    const isActive = u.activeState === "active";
                                    return (
                                        <tr key={u.filename}>
                                            <td class={css.td}>
                                                <Link
                                                    to={SystemdEdit}
                                                    params={{ name: u.filename }}
                                                    class={css.nameLink}
                                                >
                                                    {u.filename}
                                                </Link>
                                            </td>
                                            <td class={css.td}>
                                                <span class={css.typeBadge}>
                                                    {u.type}
                                                </span>
                                            </td>
                                            <td class={css.td}>
                                                <StatusBadge status={u.activeState} />
                                            </td>
                                            <td class={css.td}>
                                                <div class={css.actionsCell}>
                                                    {isActive ? (
                                                        <>
                                                            <ActionButton
                                                                label="Stop"
                                                                onClick={async () => {
                                                                    if (await confirm(`Stop ${u.filename}?`, { variant: "warning", confirmLabel: "Stop" }))
                                                                        run(action_stop({ body: { serviceName: u.serviceName } }), `${u.filename} stopped`);
                                                                }}
                                                            />
                                                            <ActionButton
                                                                label="Restart"
                                                                onClick={() =>
                                                                    run(
                                                                        action_restart({ body: { serviceName: u.serviceName } }),
                                                                        `${u.filename} restarted`
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
                                                                    action_start({ body: { serviceName: u.serviceName } }),
                                                                    `${u.filename} started`
                                                                )
                                                            }
                                                        />
                                                    )}
                                                    <ActionButton
                                                        label="Delete"
                                                        variant="danger"
                                                        onClick={async () => {
                                                            if (await confirm(`Delete ${u.filename}? This cannot be undone.`, { confirmLabel: "Delete" }))
                                                                run(action_delete({ body: { filename: u.filename } }), `${u.filename} deleted`);
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
