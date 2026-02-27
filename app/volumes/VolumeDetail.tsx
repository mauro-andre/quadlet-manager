import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader, useParams, useNavigate } from "velojs/hooks";
import type {
    PodmanVolume,
    PodmanContainer,
    PodmanDfVolume,
} from "../modules/podman/podman.types.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as VolumeList from "./VolumeList.js";
import * as ContainerDetail from "../containers/ContainerDetail.js";
import * as css from "./VolumeDetail.css.js";

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

interface VolumeDetailData {
    volume: PodmanVolume;
    containers: PodmanContainer[];
    df: PodmanDfVolume | null;
}

export const loader = async ({ params }: LoaderArgs) => {
    const { inspectVolume, listContainersByVolume, getDiskUsage } = await import(
        "../modules/podman/podman.client.js"
    );

    const [volume, containers, diskUsage] = await Promise.all([
        inspectVolume(params.name!),
        listContainersByVolume(params.name!).catch(() => [] as PodmanContainer[]),
        getDiskUsage().catch(() => null),
    ]);

    const df = diskUsage?.Volumes?.find((v) => v.VolumeName === volume.Name) ?? null;

    return { volume, containers, df } satisfies VolumeDetailData;
};

export const action_remove = async ({
    body,
}: ActionArgs<{ name: string; force: boolean }>) => {
    const { removeVolume } = await import(
        "../modules/podman/podman.client.js"
    );
    await removeVolume(body.name, body.force);
    return { ok: true };
};

export const Component = () => {
    const params = useParams<{ name: string }>();
    const navigate = useNavigate();
    const { data, loading } = useLoader<VolumeDetailData>([params.name]);

    if (loading.value) return <div>Loading...</div>;
    if (!data.value) return <div>Volume not found</div>;

    const { volume, containers, df } = data.value;
    const inUse = containers.length > 0;

    return (
        <div class={css.page}>
            <Link to={VolumeList} class={css.backLink}>
                Back to Volumes
            </Link>

            <div class={css.header}>
                <h1 class={css.title}>{volume.Name}</h1>
                <div class={css.actions}>
                    <ActionButton
                        label="Remove"
                        variant="danger"
                        onClick={async () => {
                            const msg = inUse
                                ? `Remove volume ${volume.Name}? It is used by ${containers.length} container(s). This will force removal.`
                                : `Remove volume ${volume.Name}?`;
                            if (await confirm(msg, { confirmLabel: "Remove" })) {
                                try {
                                    await action_remove({ body: { name: volume.Name, force: inUse } });
                                    toast("Volume removed");
                                    navigate("/volumes");
                                } catch {
                                    toast("Failed to remove volume", "error");
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
                    <span class={css.infoValue}>{volume.Name}</span>

                    <span class={css.infoLabel}>Driver</span>
                    <span class={css.infoValue}>{volume.Driver}</span>

                    <span class={css.infoLabel}>Mountpoint</span>
                    <span class={css.infoValue}>{volume.Mountpoint}</span>

                    <span class={css.infoLabel}>Size</span>
                    <span class={css.infoValue}>
                        {df ? formatBytes(df.Size) : "-"}
                    </span>

                    <span class={css.infoLabel}>Scope</span>
                    <span class={css.infoValue}>{volume.Scope}</span>

                    <span class={css.infoLabel}>Created</span>
                    <span class={css.infoValue}>
                        {new Date(volume.CreatedAt).toLocaleString()}
                    </span>

                    <span class={css.infoLabel}>Mount Count</span>
                    <span class={css.infoValue}>{volume.MountCount}</span>

                    <span class={css.infoLabel}>Labels</span>
                    <span class={css.infoValue}>
                        {volume.Labels && Object.keys(volume.Labels).length > 0
                            ? Object.entries(volume.Labels).map(([k, v]) => (
                                <div key={k}>{k}={v}</div>
                            ))
                            : "-"}
                    </span>
                </div>
            </div>

            {/* Containers using this volume */}
            {containers.length > 0 && (
                <div class={css.section}>
                    <div class={css.sectionTitle}>
                        Containers ({containers.length})
                    </div>
                    <table class={css.table}>
                        <thead>
                            <tr>
                                <th class={css.th}>Name</th>
                                <th class={css.th}>Status</th>
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
