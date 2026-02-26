import type { LoaderArgs } from "velojs";
import { useLoader } from "velojs/hooks";
import type { PodmanContainer } from "../modules/podman/podman.types.js";
import type { QuadletListItem } from "../modules/quadlet/quadlet.types.js";
import { AppShell } from "../components/AppShell.js";
import * as css from "./Dashboard.css.js";

interface DashboardData {
    containers: PodmanContainer[];
    quadlets: QuadletListItem[];
}

export const loader = async (_args: LoaderArgs) => {
    const { listContainers } = await import(
        "../modules/podman/podman.client.js"
    );
    const { listQuadlets } = await import(
        "../modules/quadlet/quadlet.service.js"
    );

    const [containers, quadlets] = await Promise.all([
        listContainers(true).catch(() => [] as PodmanContainer[]),
        listQuadlets(),
    ]);

    return { containers, quadlets } satisfies DashboardData;
};

export const Component = () => {
    const { data, loading } = useLoader<DashboardData>();

    if (loading.value) return <AppShell>Loading...</AppShell>;

    const containers = data.value?.containers ?? [];
    const quadlets = data.value?.quadlets ?? [];
    const running = containers.filter(
        (c) => c.State === "running"
    ).length;
    const stopped = containers.length - running;

    return (
        <AppShell>
            <div class={css.page}>
                <h1 class={css.title}>Dashboard</h1>
                <div class={css.grid}>
                    <div class={css.card}>
                        <span class={css.cardLabel}>Containers</span>
                        <span class={css.cardValue}>
                            {containers.length}
                        </span>
                    </div>
                    <div class={css.card}>
                        <span class={css.cardLabel}>Running</span>
                        <span class={css.cardValue}>{running}</span>
                    </div>
                    <div class={css.card}>
                        <span class={css.cardLabel}>Stopped</span>
                        <span class={css.cardValue}>{stopped}</span>
                    </div>
                    <div class={css.card}>
                        <span class={css.cardLabel}>Quadlets</span>
                        <span class={css.cardValue}>
                            {quadlets.length}
                        </span>
                    </div>
                </div>
            </div>
        </AppShell>
    );
};
