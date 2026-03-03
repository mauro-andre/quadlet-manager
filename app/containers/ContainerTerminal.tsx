import type { LoaderArgs } from "velojs";
import { Link } from "velojs";
import { useLoader, useParams } from "velojs/hooks";
import type { Scope } from "../modules/auth/auth.types.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { ScopeBadge } from "../components/ScopeBadge.js";
import { TerminalView } from "../components/Terminal.js";
import * as ContainerList from "./ContainerList.js";
import * as tcss from "../components/Terminal.css.js";
import * as css from "./ContainerDetail.css.js";

interface ContainerTerminalData {
    containerId: string;
    containerName: string;
    scope: Scope;
    status: string;
}

export const loader = async ({ params, query, c }: LoaderArgs) => {
    const { inspectContainer } = await import(
        "../modules/podman/podman.client.js"
    );

    const user = c.get("user");
    const scope: Scope = query.scope === "system" ? "system" : "user";
    const container = await inspectContainer(params.id!, scope, user.uid);

    return {
        containerId: container.Id,
        containerName: container.Name.replace(/^\//, ""),
        scope,
        status: container.State.Status,
    } satisfies ContainerTerminalData;
};

export const Component = () => {
    const params = useParams<{ id: string }>();
    const { data, loading } = useLoader<ContainerTerminalData>();

    if (loading.value) return <div>Loading...</div>;
    if (!data.value) return <div>Container not found</div>;

    const { containerName, scope, status } = data.value;
    const wsUrl = `/api/terminal?type=container&name=${encodeURIComponent(containerName)}&scope=${scope}`;

    return (
        <div class={tcss.terminalPage}>
            <Link to={ContainerList} class={css.backLink}>
                Back to Containers
            </Link>

            <div class={css.header}>
                <h1 class={css.title}>{containerName}</h1>
                <ScopeBadge scope={scope} />
                <StatusBadge status={status} />
            </div>

            <div class={tcss.tabs}>
                <Link
                    to={`/containers/${params.id}?scope=${scope}`}
                    class={tcss.tab}
                >
                    Info
                </Link>
                <span class={tcss.tabActive}>Terminal</span>
            </div>

            <TerminalView wsUrl={wsUrl} />
        </div>
    );
};
