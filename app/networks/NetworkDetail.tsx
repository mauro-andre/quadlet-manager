import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader, useParams, useNavigate } from "velojs/hooks";
import type {
    PodmanNetwork,
    PodmanContainer,
} from "../modules/podman/podman.types.js";
import type { Scope } from "../modules/auth/auth.types.js";
import { ActionButton } from "../components/ActionButton.js";
import { ScopeBadge } from "../components/ScopeBadge.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as NetworkList from "./NetworkList.js";
import * as ContainerDetail from "../containers/ContainerDetail.js";
import * as css from "./NetworkDetail.css.js";

interface NetworkDetailData {
    network: PodmanNetwork;
    containers: PodmanContainer[];
    scope: Scope;
}

export const loader = async ({ params, query, c }: LoaderArgs) => {
    const { inspectNetwork, listContainersByNetwork } = await import(
        "../modules/podman/podman.client.js"
    );

    const user = c.get("user");
    const scope: Scope = query.scope === "system" ? "system" : "user";
    const [network, containers] = await Promise.all([
        inspectNetwork(params.name!, scope, user.uid),
        listContainersByNetwork(params.name!, scope, user.uid).catch(() => [] as PodmanContainer[]),
    ]);

    return { network, containers, scope } satisfies NetworkDetailData;
};

export const action_remove = async ({
    body, c,
}: ActionArgs<{ name: string; scope: Scope }>) => {
    const { removeNetwork } = await import(
        "../modules/podman/podman.client.js"
    );
    const user = c!.get("user");
    await removeNetwork(body.name, body.scope, user.uid);
    return { ok: true };
};

export const Component = () => {
    const params = useParams<{ name: string }>();
    const navigate = useNavigate();
    const { data, loading } = useLoader<NetworkDetailData>([params.name]);

    if (loading.value) return <div>Loading...</div>;
    if (!data.value) return <div>Network not found</div>;

    const { network, containers, scope } = data.value;

    return (
        <div class={css.page}>
            <Link to={NetworkList} class={css.backLink}>
                Back to Networks
            </Link>

            <div class={css.header}>
                <h1 class={css.title}>{network.name}</h1>
                <ScopeBadge scope={scope} />
                <div class={css.actions}>
                    <ActionButton
                        label="Remove"
                        variant="danger"
                        onClick={async () => {
                            const msg = containers.length > 0
                                ? `Remove network ${network.name}? It is used by ${containers.length} container(s).`
                                : `Remove network ${network.name}?`;
                            if (await confirm(msg, { confirmLabel: "Remove" })) {
                                try {
                                    await action_remove({ body: { name: network.name, scope } });
                                    toast("Network removed");
                                    navigate("/networks");
                                } catch {
                                    toast("Failed to remove network", "error");
                                }
                            }
                        }}
                    />
                </div>
            </div>

            {/* Info */}
            <div class={css.section}>
                <div class={css.sectionTitle}>Info</div>
                <div class={css.infoGrid}>
                    <span class={css.infoLabel}>Name</span>
                    <span class={css.infoValue}>{network.name}</span>

                    <span class={css.infoLabel}>ID</span>
                    <span class={css.infoValue}>{network.id}</span>

                    <span class={css.infoLabel}>Driver</span>
                    <span class={css.infoValue}>{network.driver}</span>

                    <span class={css.infoLabel}>Interface</span>
                    <span class={css.infoValue}>{network.network_interface || "-"}</span>

                    <span class={css.infoLabel}>Subnet(s)</span>
                    <span class={css.infoValue}>
                        {network.subnets?.length
                            ? network.subnets.map((s) => s.subnet).join(", ")
                            : "-"}
                    </span>

                    <span class={css.infoLabel}>Gateway(s)</span>
                    <span class={css.infoValue}>
                        {network.subnets?.length
                            ? network.subnets.map((s) => s.gateway).join(", ")
                            : "-"}
                    </span>

                    <span class={css.infoLabel}>IPv6</span>
                    <span class={css.infoValue}>{network.ipv6_enabled ? "Enabled" : "Disabled"}</span>

                    <span class={css.infoLabel}>DNS</span>
                    <span class={css.infoValue}>{network.dns_enabled ? "Enabled" : "Disabled"}</span>

                    <span class={css.infoLabel}>Internal</span>
                    <span class={css.infoValue}>{network.internal ? "Yes" : "No"}</span>

                    <span class={css.infoLabel}>Created</span>
                    <span class={css.infoValue}>
                        {new Date(network.created).toLocaleString()}
                    </span>
                </div>
            </div>

            {/* Containers using this network */}
            {containers.length > 0 && (
                <div class={css.section}>
                    <div class={css.sectionTitle}>
                        Containers ({containers.length})
                    </div>
                    <table class={css.table}>
                        <thead>
                            <tr>
                                <th class={css.th}>Name</th>
                                <th class={css.th}>State</th>
                            </tr>
                        </thead>
                        <tbody>
                            {containers.map((c) => {
                                const name =
                                    c.Names?.[0]?.replace(/^\//, "") ??
                                    c.Id.slice(0, 12);
                                return (
                                    <tr key={c.Id}>
                                        <td class={css.td}>
                                            <Link
                                                to={ContainerDetail}
                                                params={{ id: c.Id.slice(0, 12) }}
                                                search={{ scope }}
                                                class={css.nameLink}
                                            >
                                                {name}
                                            </Link>
                                        </td>
                                        <td class={css.td}>{c.State}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
