import type { LoaderArgs } from "velojs";
import { Link } from "velojs";
import { useLoader } from "velojs/hooks";
import type { PodmanContainer } from "../modules/podman/podman.types.js";
import { AppShell } from "../components/AppShell.js";
import { StatusBadge } from "../components/StatusBadge.js";
import * as ContainerDetail from "./ContainerDetail.js";
import * as css from "./ContainerList.css.js";

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

    if (loading.value) return <AppShell>Loading...</AppShell>;

    const containers = data.value?.containers ?? [];

    return (
        <AppShell>
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
                                                {new Date(
                                                    c.Created * 1000
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
        </AppShell>
    );
};
