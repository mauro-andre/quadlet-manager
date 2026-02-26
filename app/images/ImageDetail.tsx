import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader, useParams, useNavigate } from "velojs/hooks";
import type {
    PodmanImageInspect,
    PodmanImageHistory,
    PodmanContainer,
} from "../modules/podman/podman.types.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as ImageList from "./ImageList.js";
import * as ContainerDetail from "../containers/ContainerDetail.js";
import * as css from "./ImageDetail.css.js";

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function shortId(id: string): string {
    return id.replace(/^sha256:/, "").slice(0, 12);
}

interface ImageDetailData {
    image: PodmanImageInspect;
    history: PodmanImageHistory[];
    containers: PodmanContainer[];
}

export const loader = async ({ params }: LoaderArgs) => {
    const { inspectImage, getImageHistory, listContainers } = await import(
        "../modules/podman/podman.client.js"
    );

    const [image, history, allContainers] = await Promise.all([
        inspectImage(params.id!),
        getImageHistory(params.id!),
        listContainers(true).catch(() => [] as PodmanContainer[]),
    ]);

    const containers = allContainers.filter(
        (c) => c.ImageID === image.Id || c.ImageID.startsWith(params.id!)
    );

    return { image, history, containers } satisfies ImageDetailData;
};

export const action_remove = async ({
    body,
}: ActionArgs<{ id: string; force: boolean }>) => {
    const { removeImage } = await import(
        "../modules/podman/podman.client.js"
    );
    await removeImage(body.id, body.force);
    return { ok: true };
};

export const Component = () => {
    const params = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data, loading } = useLoader<ImageDetailData>([params.id]);

    if (loading.value) return <div>Loading...</div>;
    if (!data.value) return <div>Image not found</div>;

    const { image, history, containers } = data.value;
    const tag =
        image.RepoTags && image.RepoTags.length > 0
            ? image.RepoTags[0]!
            : shortId(image.Id);

    return (
        <div class={css.page}>
            <Link to={ImageList} class={css.backLink}>
                Back to Images
            </Link>

            <div class={css.header}>
                <h1 class={css.title}>{tag}</h1>
                <div class={css.actions}>
                    <ActionButton
                        label="Remove"
                        variant="danger"
                        onClick={async () => {
                            const hasContainers = containers.length > 0;
                            const msg = hasContainers
                                ? `Remove image ${tag}? It is used by ${containers.length} container(s). This will force removal.`
                                : `Remove image ${tag}?`;
                            if (await confirm(msg, { confirmLabel: "Remove" })) {
                                try {
                                    await action_remove({ body: { id: image.Id, force: hasContainers } });
                                    toast("Image removed");
                                    navigate("/images");
                                } catch {
                                    toast("Failed to remove image", "error");
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
                    <span class={css.infoLabel}>ID</span>
                    <span class={css.infoValue}>{shortId(image.Id)}</span>

                    <span class={css.infoLabel}>Tags</span>
                    <span class={css.infoValue}>
                        {image.RepoTags?.join(", ") ?? "<none>"}
                    </span>

                    <span class={css.infoLabel}>Digests</span>
                    <span class={css.infoValue}>
                        {image.RepoDigests
                            ? image.RepoDigests.map((d) => <div key={d}>{d}</div>)
                            : "-"}
                    </span>

                    <span class={css.infoLabel}>Size</span>
                    <span class={css.infoValue}>{formatBytes(image.Size)}</span>

                    <span class={css.infoLabel}>Architecture</span>
                    <span class={css.infoValue}>{image.Architecture}</span>

                    <span class={css.infoLabel}>OS</span>
                    <span class={css.infoValue}>{image.Os}</span>

                    <span class={css.infoLabel}>Created</span>
                    <span class={css.infoValue}>
                        {new Date(image.Created).toLocaleString()}
                    </span>
                </div>
            </div>

            {/* Config */}
            <div class={css.section}>
                <div class={css.sectionTitle}>Config</div>
                <div class={css.infoGrid}>
                    <span class={css.infoLabel}>Entrypoint</span>
                    <span class={css.infoValue}>
                        {image.Config.Entrypoint?.join(" ") ?? "-"}
                    </span>

                    <span class={css.infoLabel}>Cmd</span>
                    <span class={css.infoValue}>
                        {image.Config.Cmd?.join(" ") ?? "-"}
                    </span>

                    <span class={css.infoLabel}>Working Dir</span>
                    <span class={css.infoValue}>
                        {image.Config.WorkingDir || "-"}
                    </span>

                    <span class={css.infoLabel}>User</span>
                    <span class={css.infoValue}>
                        {image.Config.User || "-"}
                    </span>

                    <span class={css.infoLabel}>Exposed Ports</span>
                    <span class={css.infoValue}>
                        {image.Config.ExposedPorts
                            ? Object.keys(image.Config.ExposedPorts).join(", ")
                            : "-"}
                    </span>

                    <span class={css.infoLabel}>Volumes</span>
                    <span class={css.infoValue}>
                        {image.Config.Volumes
                            ? Object.keys(image.Config.Volumes).join(", ")
                            : "-"}
                    </span>

                    <span class={css.infoLabel}>Env</span>
                    <span class={css.infoValue}>
                        {image.Config.Env
                            ? image.Config.Env.map((e) => <div key={e}>{e}</div>)
                            : "-"}
                    </span>
                </div>
            </div>

            {/* Layer History */}
            <div class={css.section}>
                <div class={css.sectionTitle}>Layer History</div>
                <table class={css.historyTable}>
                    <thead>
                        <tr>
                            <th class={css.historyTh}>Created By</th>
                            <th class={css.historyTh}>Size</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((h, i) => (
                            <tr key={i}>
                                <td class={css.historyTd}>{h.createdBy}</td>
                                <td class={css.historyTd}>
                                    {h.emptyLayer ? "-" : formatBytes(h.size)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Containers using this image */}
            {containers.length > 0 && (
                <div class={css.section}>
                    <div class={css.sectionTitle}>
                        Containers ({containers.length})
                    </div>
                    <table class={css.historyTable}>
                        <thead>
                            <tr>
                                <th class={css.historyTh}>Name</th>
                                <th class={css.historyTh}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {containers.map((c) => {
                                const name =
                                    c.Names?.[0]?.replace(/^\//, "") ??
                                    c.Id.slice(0, 12);
                                return (
                                    <tr key={c.Id}>
                                        <td class={css.historyTd}>
                                            <Link
                                                to={ContainerDetail}
                                                params={{ id: c.Id.slice(0, 12) }}
                                                class={css.nameLink}
                                            >
                                                {name}
                                            </Link>
                                        </td>
                                        <td class={css.historyTd}>{c.State}</td>
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
