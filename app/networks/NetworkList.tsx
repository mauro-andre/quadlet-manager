import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader } from "velojs/hooks";
import type { PodmanNetwork } from "../modules/podman/podman.types.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as NetworkDetail from "./NetworkDetail.js";
import * as css from "./NetworkList.css.js";

interface NetworkListData {
    networks: PodmanNetwork[];
}

export const loader = async (_: LoaderArgs) => {
    const { listNetworks } = await import(
        "../modules/podman/podman.client.js"
    );
    const networks = await listNetworks().catch(() => [] as PodmanNetwork[]);

    return { networks } satisfies NetworkListData;
};

export const action_remove = async ({
    body,
}: ActionArgs<{ name: string }>) => {
    const { removeNetwork } = await import(
        "../modules/podman/podman.client.js"
    );
    await removeNetwork(body.name);
    return { ok: true };
};

export const Component = () => {
    const { data, loading, refetch } = useLoader<NetworkListData>();

    if (loading.value) return <div>Loading...</div>;

    const networks = data.value?.networks ?? [];

    const run = (action: Promise<unknown>, msg: string) =>
        action
            .then(() => { toast(msg); refetch(); })
            .catch(() => toast("Action failed", "error"));

    return (
        <div class={css.page}>
            <h1 class={css.title}>Networks</h1>
            <div class={css.tableWrapper}>
                {networks.length === 0 ? (
                    <div class={css.empty}>
                        No networks found. Is the Podman socket accessible?
                    </div>
                ) : (
                    <table class={css.table}>
                        <thead>
                            <tr>
                                <th class={css.th}>Name</th>
                                <th class={css.th}>Driver</th>
                                <th class={css.th}>Subnet</th>
                                <th class={css.th}>Gateway</th>
                                <th class={css.th}>DNS</th>
                                <th class={css.th}>Internal</th>
                                <th class={css.th}>Created</th>
                                <th class={css.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {networks.map((net) => {
                                const subnet = net.subnets?.[0]?.subnet ?? "-";
                                const gateway = net.subnets?.[0]?.gateway ?? "-";
                                return (
                                    <tr key={net.name}>
                                        <td class={css.td}>
                                            <Link
                                                to={NetworkDetail}
                                                params={{ name: net.name }}
                                                class={css.nameLink}
                                            >
                                                {net.name}
                                            </Link>
                                        </td>
                                        <td class={css.td}>{net.driver}</td>
                                        <td class={css.td}>{subnet}</td>
                                        <td class={css.td}>{gateway}</td>
                                        <td class={css.td}>
                                            <span class={`${css.badge} ${net.dns_enabled ? css.badgeEnabled : css.badgeDisabled}`}>
                                                {net.dns_enabled ? "Enabled" : "Disabled"}
                                            </span>
                                        </td>
                                        <td class={css.td}>
                                            <span class={`${css.badge} ${net.internal ? css.badgeEnabled : css.badgeDisabled}`}>
                                                {net.internal ? "Yes" : "No"}
                                            </span>
                                        </td>
                                        <td class={css.td}>
                                            {new Date(net.created).toLocaleString()}
                                        </td>
                                        <td class={css.td}>
                                            <div class={css.actionsCell}>
                                                <ActionButton
                                                    label="Remove"
                                                    variant="danger"
                                                    onClick={async () => {
                                                        if (await confirm(`Remove network ${net.name}?`, { confirmLabel: "Remove" }))
                                                            run(action_remove({ body: { name: net.name } }), "Network removed");
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
