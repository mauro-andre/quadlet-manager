import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader } from "velojs/hooks";
import type { PodmanImage } from "../modules/podman/podman.types.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as ImageDetail from "./ImageDetail.js";
import * as css from "./ImageList.css.js";

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatTag(image: PodmanImage): string {
    if (image.RepoTags && image.RepoTags.length > 0) {
        return image.RepoTags[0]!;
    }
    return "<none>:<none>";
}

function shortId(id: string): string {
    return id.replace(/^sha256:/, "").slice(0, 12);
}

interface ImageListData {
    images: PodmanImage[];
}

export const loader = async (_args: LoaderArgs) => {
    const { listImages } = await import(
        "../modules/podman/podman.client.js"
    );
    const images = await listImages().catch(() => [] as PodmanImage[]);
    return { images } satisfies ImageListData;
};

export const action_remove = async ({
    body,
}: ActionArgs<{ id: string }>) => {
    const { removeImage } = await import(
        "../modules/podman/podman.client.js"
    );
    await removeImage(body.id);
    return { ok: true };
};

export const Component = () => {
    const { data, loading, refetch } = useLoader<ImageListData>();

    if (loading.value) return <div>Loading...</div>;

    const images = data.value?.images ?? [];

    const run = (action: Promise<unknown>, msg: string) =>
        action
            .then(() => { toast(msg); refetch(); })
            .catch(() => toast("Action failed", "error"));

    return (
        <div class={css.page}>
            <h1 class={css.title}>Images</h1>
            <div class={css.tableWrapper}>
                {images.length === 0 ? (
                    <div class={css.empty}>
                        No images found. Is the Podman socket accessible?
                    </div>
                ) : (
                    <table class={css.table}>
                        <thead>
                            <tr>
                                <th class={css.th}>Repository / Tag</th>
                                <th class={css.th}>ID</th>
                                <th class={css.th}>Size</th>
                                <th class={css.th}>Created</th>
                                <th class={css.th}>Containers</th>
                                <th class={css.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {images.map((img) => {
                                const tag = formatTag(img);
                                return (
                                    <tr key={img.Id}>
                                        <td class={css.td}>
                                            <Link
                                                to={ImageDetail}
                                                params={{ id: shortId(img.Id) }}
                                                class={css.nameLink}
                                            >
                                                {tag}
                                            </Link>
                                        </td>
                                        <td class={css.td}>{shortId(img.Id)}</td>
                                        <td class={css.td}>{formatBytes(img.Size)}</td>
                                        <td class={css.td}>
                                            {new Date(img.Created * 1000).toLocaleString()}
                                        </td>
                                        <td class={css.td}>{img.Containers}</td>
                                        <td class={css.td}>
                                            <div class={css.actionsCell}>
                                                <ActionButton
                                                    label="Remove"
                                                    variant="danger"
                                                    onClick={async () => {
                                                        if (await confirm(`Remove image ${tag}?`, { confirmLabel: "Remove" }))
                                                            run(action_remove({ body: { id: img.Id } }), "Image removed");
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
