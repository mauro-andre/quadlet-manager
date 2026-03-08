import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { PodmanImage } from "../modules/podman/podman.types.js";
import type { ImageCheckResult } from "../modules/image-update/image-update.service.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import { PullImageModal } from "../components/PullImageModal.js";
import { openPullModal } from "../components/pullImageModal.js";
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

interface PullProgress {
    pullId: string;
    reference: string;
    message: string;
    status: "pulling" | "error";
}

export const loader = async (_: LoaderArgs) => {
    const { listImages } = await import(
        "../modules/podman/podman.client.js"
    );
    const images = await listImages().catch(() => [] as PodmanImage[]);
    return { images } satisfies ImageListData;
};

export const action_prune = async () => {
    const { pruneImages } = await import(
        "../modules/podman/podman.client.js"
    );
    const result = await pruneImages();
    return { ok: true, count: result?.length ?? 0 };
};

export const action_remove = async ({
    body,
}: ActionArgs<{ id: string }>) => {
    const { removeImage } = await import(
        "../modules/podman/podman.client.js"
    );
    await removeImage(body.id, true);
    return { ok: true };
};

const UPDATE_LABELS: Record<string, string> = {
    "update-available": "Update available",
    "restart-pending": "Restart pending",
    "tag-removed": "Tag removed",
    "up-to-date": "Up to date",
    unknown: "Unknown",
};

export const Component = () => {
    const { data, loading, refetch } = useLoader<ImageListData>();
    const activePulls = useSignal<Map<string, PullProgress>>(new Map());
    const updateResults = useSignal<Record<string, ImageCheckResult> | null>(null);
    const checking = useSignal(false);

    const recheckImage = async (imageRef: string) => {
        try {
            const res = await fetch("/api/images/check-updates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ images: [imageRef], checkContainers: false }),
            });
            if (!res.ok) return;
            const result = await res.json() as Record<string, ImageCheckResult>;
            if (updateResults.value && result[imageRef]) {
                updateResults.value = { ...updateResults.value, [imageRef]: result[imageRef]! };
            }
        } catch {}
    };

    useEffect(() => {
        if (typeof window === "undefined") return;

        const es = new EventSource("/api/images/pull/events");

        es.addEventListener("snapshot", (e: MessageEvent) => {
            const active = JSON.parse(e.data) as Array<{ pullId: string; reference: string; lastMessage: string }>;
            const map = new Map(activePulls.value);
            for (const pull of active) {
                map.set(pull.pullId, {
                    pullId: pull.pullId,
                    reference: pull.reference,
                    message: pull.lastMessage,
                    status: "pulling",
                });
            }
            activePulls.value = map;
        });

        es.addEventListener("progress", (e: MessageEvent) => {
            const event = JSON.parse(e.data) as { pullId: string; reference: string; message: string };
            const map = new Map(activePulls.value);
            map.set(event.pullId, {
                pullId: event.pullId,
                reference: event.reference,
                message: event.message,
                status: "pulling",
            });
            activePulls.value = map;
        });

        es.addEventListener("complete", (e: MessageEvent) => {
            const event = JSON.parse(e.data) as { pullId: string; reference: string; message: string };
            const map = new Map(activePulls.value);
            map.delete(event.pullId);
            activePulls.value = map;
            toast(`Pulled ${event.reference}`);
            refetch();
            recheckImage(event.reference);
        });

        es.addEventListener("pull-error", (e: MessageEvent) => {
            const event = JSON.parse(e.data) as { pullId: string; reference: string; message: string };
            const map = new Map(activePulls.value);
            map.set(event.pullId, {
                pullId: event.pullId,
                reference: event.reference,
                message: event.message,
                status: "error",
            });
            activePulls.value = map;
            toast(`Failed to pull ${event.reference}`, "error");

            setTimeout(() => {
                const m = new Map(activePulls.value);
                m.delete(event.pullId);
                activePulls.value = m;
            }, 10_000);
        });

        return () => es.close();
    }, []);

    if (loading.value) return <div>Loading...</div>;

    const images = data.value?.images ?? [];
    const pulls = Array.from(activePulls.value.values());

    const run = (action: Promise<unknown>, msg: string) =>
        action
            .then((r: any) => { toast(r?.count != null ? `${msg} (${r.count} removed)` : msg); refetch(); })
            .catch(() => toast("Action failed", "error"));

    const checkUpdates = async () => {
        const imageRefs = images
            .filter((img) => img.RepoTags && img.RepoTags.length > 0 && img.RepoTags[0] !== "<none>:<none>")
            .map((img) => img.RepoTags![0]!);
        if (imageRefs.length === 0) {
            toast("No tagged images to check", "warning");
            return;
        }
        checking.value = true;
        try {
            const res = await fetch("/api/images/check-updates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ images: imageRefs, checkContainers: false }),
            });
            if (!res.ok) throw new Error();
            updateResults.value = await res.json();
            toast("Update check complete");
        } catch {
            toast("Failed to check for updates", "error");
        } finally {
            checking.value = false;
        }
    };

    const pullImage = async (imageRef: string) => {
        try {
            const res = await fetch("/api/images/pull", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reference: imageRef }),
            });
            if (!res.ok) throw new Error();
            toast(`Pulling ${imageRef}...`);
        } catch {
            toast("Failed to start pull", "error");
        }
    };

    return (
        <div class={css.page}>
            <div class={css.header}>
                <h1 class={css.title}>Images</h1>
                <div class={css.headerActions}>
                    <ActionButton
                        label="Prune Dangling"
                        variant="danger"
                        onClick={async () => {
                            if (await confirm("Remove all dangling (unused) images?", { confirmLabel: "Prune" }))
                                run(action_prune(), "Images pruned");
                        }}
                    />
                    <button
                        class={css.checkButton}
                        onClick={checkUpdates}
                        disabled={checking.value}
                    >
                        {checking.value ? "Checking..." : "Check Updates"}
                    </button>
                    <button class={css.pullButton} onClick={openPullModal}>
                        Pull Image
                    </button>
                </div>
            </div>

            {pulls.length > 0 && (
                <div class={css.progressSection}>
                    {pulls.map((pull) => (
                        <div
                            key={pull.pullId}
                            class={`${css.progressCard} ${pull.status === "error" ? css.progressCardError : ""}`}
                        >
                            <div class={css.progressHeader}>
                                <span class={css.progressReference}>{pull.reference}</span>
                                <span class={css.progressStatus}>
                                    {pull.status === "pulling" ? "Pulling..." : "Error"}
                                </span>
                            </div>
                            {pull.status === "error" ? (
                                <div class={css.progressError}>{pull.message}</div>
                            ) : (
                                <>
                                    <div class={css.progressMessage}>{pull.message}</div>
                                    <div class={css.progressBar}>
                                        <div class={css.progressFill} />
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

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
                                {updateResults.value && (
                                    <th class={css.th}>Update</th>
                                )}
                                <th class={css.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {images.map((img) => {
                                const tag = formatTag(img);
                                const update = updateResults.value?.[tag];
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
                                        {updateResults.value && (
                                            <td class={css.td}>
                                                {update ? (
                                                    <span class={css.updateBadge[update.status]}>
                                                        {UPDATE_LABELS[update.status]}
                                                    </span>
                                                ) : (
                                                    <span class={css.updateBadge.unknown}>—</span>
                                                )}
                                            </td>
                                        )}
                                        <td class={css.td}>
                                            <div class={css.actionsCell}>
                                                {update?.needsPull && (
                                                    <ActionButton
                                                        label="Pull"
                                                        variant="primary"
                                                        onClick={() => pullImage(tag)}
                                                    />
                                                )}
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

            <PullImageModal />
        </div>
    );
};
