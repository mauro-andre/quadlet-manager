import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader } from "velojs/hooks";
import type { PodmanVolume, PodmanDfVolume } from "../modules/podman/podman.types.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as VolumeDetail from "./VolumeDetail.js";
import * as css from "./VolumeList.css.js";

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function isAnonymous(vol: PodmanVolume): boolean {
    return vol.Anonymous === true || /^[0-9a-f]{64}$/.test(vol.Name);
}

function displayName(vol: PodmanVolume): string {
    if (isAnonymous(vol)) {
        return vol.Name.slice(0, 12);
    }
    return vol.Name;
}

interface VolumeListData {
    volumes: PodmanVolume[];
    dfMap: Record<string, PodmanDfVolume>;
}

export const loader = async (_args: LoaderArgs) => {
    const { listVolumes, getDiskUsage } = await import(
        "../modules/podman/podman.client.js"
    );
    const [volumes, df] = await Promise.all([
        listVolumes().catch(() => [] as PodmanVolume[]),
        getDiskUsage().catch(() => null),
    ]);

    const dfMap: Record<string, PodmanDfVolume> = {};
    if (df?.Volumes) {
        for (const v of df.Volumes) {
            dfMap[v.VolumeName] = v;
        }
    }

    return { volumes, dfMap } satisfies VolumeListData;
};

export const action_remove = async ({
    body,
}: ActionArgs<{ name: string }>) => {
    const { removeVolume } = await import(
        "../modules/podman/podman.client.js"
    );
    await removeVolume(body.name);
    return { ok: true };
};

export const Component = () => {
    const { data, loading, refetch } = useLoader<VolumeListData>();

    if (loading.value) return <div>Loading...</div>;

    const volumes = data.value?.volumes ?? [];
    const dfMap = data.value?.dfMap ?? {};

    const run = (action: Promise<unknown>, msg: string) =>
        action
            .then(() => { toast(msg); refetch(); })
            .catch(() => toast("Action failed", "error"));

    return (
        <div class={css.page}>
            <h1 class={css.title}>Volumes</h1>
            <div class={css.tableWrapper}>
                {volumes.length === 0 ? (
                    <div class={css.empty}>
                        No volumes found. Is the Podman socket accessible?
                    </div>
                ) : (
                    <table class={css.table}>
                        <thead>
                            <tr>
                                <th class={css.th}>Name</th>
                                <th class={css.th}>Driver</th>
                                <th class={css.th}>Size</th>
                                <th class={css.th}>Status</th>
                                <th class={css.th}>Created</th>
                                <th class={css.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {volumes.map((vol) => {
                                const df = dfMap[vol.Name];
                                const inUse = (df?.Links ?? 0) > 0;
                                return (
                                    <tr key={vol.Name}>
                                        <td class={css.td}>
                                            <Link
                                                to={VolumeDetail}
                                                params={{ name: vol.Name }}
                                                class={isAnonymous(vol) ? css.anonName : css.nameLink}
                                            >
                                                {displayName(vol)}
                                            </Link>
                                        </td>
                                        <td class={css.td}>{vol.Driver}</td>
                                        <td class={css.td}>
                                            {df ? formatBytes(df.Size) : "-"}
                                        </td>
                                        <td class={css.td}>
                                            <span class={`${css.badge} ${inUse ? css.badgeInUse : css.badgeUnused}`}>
                                                {inUse ? "In use" : "Unused"}
                                            </span>
                                        </td>
                                        <td class={css.td}>
                                            {new Date(vol.CreatedAt).toLocaleString()}
                                        </td>
                                        <td class={css.td}>
                                            <div class={css.actionsCell}>
                                                <ActionButton
                                                    label="Remove"
                                                    variant="danger"
                                                    onClick={async () => {
                                                        if (await confirm(`Remove volume ${displayName(vol)}?`, { confirmLabel: "Remove" }))
                                                            run(action_remove({ body: { name: vol.Name } }), "Volume removed");
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
