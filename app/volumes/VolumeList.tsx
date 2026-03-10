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
    bindSizes: Record<string, number>;
}

export const loader = async (_: LoaderArgs) => {
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

    // Calculate sizes for bind mount volumes
    const bindSizes: Record<string, number> = {};
    const bindVolumes = volumes.filter((v) => v.Options?.type === "none" && typeof v.Options?.device === "string");
    if (bindVolumes.length > 0) {
        const { execFile: execFileCb } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execFile = promisify(execFileCb);
        await Promise.all(bindVolumes.map(async (v) => {
            try {
                const { stdout } = await execFile("du", ["-sb", v.Options!.device as string]).catch((err: { stdout?: string }) => {
                    return { stdout: err.stdout ?? "" };
                });
                const parsed = parseInt(stdout.split("\t")[0] ?? "0", 10);
                if (parsed > 0) bindSizes[v.Name] = parsed;
            } catch { /* ignore */ }
        }));
    }

    return { volumes, dfMap, bindSizes } satisfies VolumeListData;
};

export const action_prune = async () => {
    const { pruneVolumes } = await import(
        "../modules/podman/podman.client.js"
    );
    const result = await pruneVolumes();
    return { ok: true, count: result?.length ?? 0 };
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
    const bindSizes = data.value?.bindSizes ?? {};

    const run = (action: Promise<unknown>, msg: string) =>
        action
            .then((r: any) => { toast(r?.count != null ? `${msg} (${r.count} removed)` : msg); refetch(); })
            .catch(() => toast("Action failed", "error"));

    return (
        <div class={css.page}>
            <div class={css.header}>
                <h1 class={css.title}>Volumes</h1>
                <ActionButton
                    label="Prune Unused"
                    variant="danger"
                    onClick={async () => {
                        if (await confirm("Remove all unused volumes?", { confirmLabel: "Prune" }))
                            run(action_prune(), "Volumes pruned");
                    }}
                />
            </div>
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
                                const isBind = vol.Options?.type === "none" && typeof vol.Options?.device === "string";
                                const size = isBind ? bindSizes[vol.Name] : df?.Size;
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
                                        <td class={css.td}>{vol.Driver}{isBind ? " (bind)" : ""}</td>
                                        <td class={css.td}>
                                            {size != null ? formatBytes(size) : "-"}
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
