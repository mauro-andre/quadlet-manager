import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import type { QuadletListItem } from "../modules/quadlet/quadlet.types.js";
import type { ImageCheckResult } from "../modules/image-update/image-update.service.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as QuadletEdit from "./QuadletEdit.js";
import * as QuadletNew from "./QuadletNew.js";
import * as css from "./QuadletList.css.js";

interface QuadletListData {
    quadlets: QuadletListItem[];
}

export const loader = async ({ c }: LoaderArgs) => {
    const { listQuadlets } = await import(
        "../modules/quadlet/quadlet.service.js"
    );
    const user = c.get("user");
    return { quadlets: await listQuadlets(user) } satisfies QuadletListData;
};

export const action_start = async ({
    body,
}: ActionArgs<{ serviceName: string }>) => {
    const { startService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await startService(body.serviceName);
    return { ok: true };
};

export const action_stop = async ({
    body,
}: ActionArgs<{ serviceName: string }>) => {
    const { stopService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await stopService(body.serviceName);
    return { ok: true };
};

export const action_restart = async ({
    body,
}: ActionArgs<{ serviceName: string }>) => {
    const { restartService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await restartService(body.serviceName);
    return { ok: true };
};

export const action_delete = async ({
    body, c,
}: ActionArgs<{ filename: string }>) => {
    const { stopService, disableService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    const { deleteQuadlet } = await import(
        "../modules/quadlet/quadlet.service.js"
    );

    const user = c!.get("user");
    const serviceName =
        body.filename.replace(/\.[^.]+$/, "") + ".service";
    await stopService(serviceName).catch(() => {});
    await disableService(serviceName).catch(() => {});
    await deleteQuadlet(body.filename, user);
    return { ok: true };
};

const UPDATE_LABELS: Record<string, string> = {
    "update-available": "Update available",
    "restart-pending": "Restart pending",
    "tag-removed": "Tag removed",
    "up-to-date": "Up to date",
    unknown: "Unknown",
};

/** Wait for a specific pull to complete via SSE */
function waitForPull(pullId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const es = new EventSource("/api/images/pull/events");
        const timeout = setTimeout(() => {
            es.close();
            reject(new Error("Pull timeout"));
        }, 120_000);

        es.addEventListener("complete", (e: MessageEvent) => {
            const event = JSON.parse(e.data) as { pullId: string };
            if (event.pullId === pullId) {
                clearTimeout(timeout);
                es.close();
                resolve();
            }
        });

        es.addEventListener("pull-error", (e: MessageEvent) => {
            const event = JSON.parse(e.data) as { pullId: string; message: string };
            if (event.pullId === pullId) {
                clearTimeout(timeout);
                es.close();
                reject(new Error(event.message));
            }
        });
    });
}

export const Component = () => {
    const { data, loading, refetch } = useLoader<QuadletListData>();
    const updateResults = useSignal<Record<string, ImageCheckResult> | null>(null);
    const checking = useSignal(false);
    const search = useSignal("");
    const typeFilter = useSignal("all");

    if (loading.value) return <div>Loading...</div>;

    const allQuadlets = data.value?.quadlets ?? [];
    const query = search.value.toLowerCase();
    const quadlets = allQuadlets.filter((q) => {
        if (typeFilter.value !== "all" && q.type !== typeFilter.value) return false;
        if (query && !q.filename.toLowerCase().includes(query)) return false;
        return true;
    });

    const run = (action: Promise<unknown>, msg: string) =>
        action
            .then(() => { toast(msg); refetch(); })
            .catch(() => toast("Action failed", "error"));

    const recheckImage = async (imageRef: string) => {
        try {
            const res = await fetch("/api/images/check-updates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ images: [imageRef], checkContainers: true }),
            });
            if (!res.ok) return;
            const result = await res.json() as Record<string, ImageCheckResult>;
            if (updateResults.value && result[imageRef]) {
                updateResults.value = { ...updateResults.value, [imageRef]: result[imageRef]! };
            }
        } catch {}
    };

    const checkUpdates = async () => {
        const images = allQuadlets
            .filter((q) => q.type === "container" && q.image)
            .map((q) => q.image!);
        if (images.length === 0) {
            toast("No container images to check", "warning");
            return;
        }
        checking.value = true;
        try {
            const res = await fetch("/api/images/check-updates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ images }),
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

    const pullAndRestart = async (imageRef: string, serviceName: string) => {
        try {
            // Start pull
            const pullRes = await fetch("/api/images/pull", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reference: imageRef }),
            });
            if (!pullRes.ok) throw new Error("Failed to start pull");
            const { pullId } = await pullRes.json() as { pullId: string };
            toast(`Pulling ${imageRef}...`);

            // Wait for pull to complete
            await waitForPull(pullId);
            toast(`Pull complete, restarting...`);

            // Restart service
            await action_restart({ body: { serviceName } });
            toast("Service restarted with updated image");
            refetch();

            // Re-check image status
            await recheckImage(imageRef);
        } catch (err) {
            toast(`Update failed: ${(err as Error).message}`, "error");
        }
    };

    const restartAndRecheck = async (imageRef: string, serviceName: string, filename: string) => {
        try {
            await action_restart({ body: { serviceName } });
            toast(`${filename} restarted`);
            refetch();
            await recheckImage(imageRef);
        } catch {
            toast("Restart failed", "error");
        }
    };

    return (
        <div class={css.page}>
                <div class={css.header}>
                    <h1 class={css.title}>Quadlets</h1>
                    <div class={css.headerActions}>
                        <button
                            class={css.checkButton}
                            onClick={checkUpdates}
                            disabled={checking.value}
                        >
                            {checking.value ? "Checking..." : "Check Updates"}
                        </button>
                        <Link to={QuadletNew} class={css.newButton}>
                            New Quadlet
                        </Link>
                    </div>
                </div>
                <div class={css.toolbar}>
                    <input
                        class={css.searchInput}
                        type="text"
                        placeholder="Search quadlets..."
                        value={search.value}
                        onInput={(e) => { search.value = (e.target as HTMLInputElement).value; }}
                    />
                    <select
                        class={css.filterSelect}
                        value={typeFilter.value}
                        onChange={(e) => { typeFilter.value = (e.target as HTMLSelectElement).value; }}
                    >
                        <option value="all">All types</option>
                        <option value="container">Containers</option>
                        <option value="network">Networks</option>
                        <option value="volume">Volumes</option>
                    </select>
                </div>
                <div class={css.tableWrapper}>
                    {quadlets.length === 0 ? (
                        <div class={css.empty}>
                            No quadlet files found.
                        </div>
                    ) : (
                        <table class={css.table}>
                            <thead>
                                <tr>
                                    <th class={css.th}>Name</th>
                                    <th class={css.th}>Type</th>
                                    <th class={css.th}>Status</th>
                                    {updateResults.value && (
                                        <th class={css.th}>Image</th>
                                    )}
                                    <th class={css.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quadlets.map((q) => {
                                    const isActive =
                                        q.activeState === "active";
                                    const update = q.image
                                        ? updateResults.value?.[q.image]
                                        : undefined;
                                    return (
                                        <tr key={q.filename}>
                                            <td class={css.td}>
                                                <Link
                                                    to={QuadletEdit}
                                                    params={{
                                                        name: q.filename,
                                                    }}
                                                    class={css.nameLink}
                                                >
                                                    {q.filename}
                                                </Link>
                                            </td>
                                            <td class={css.td}>
                                                <span
                                                    class={css.typeBadge}
                                                >
                                                    {q.type}
                                                </span>
                                            </td>
                                            <td class={css.td}>
                                                <StatusBadge
                                                    status={
                                                        q.activeState
                                                    }
                                                />
                                            </td>
                                            {updateResults.value && (
                                                <td class={css.td}>
                                                    {update ? (
                                                        <div class={css.imageCell}>
                                                            <span class={css.imageRef}>{q.image}</span>
                                                            <span class={css.updateBadge[update.status]}>
                                                                {UPDATE_LABELS[update.status]}
                                                            </span>
                                                        </div>
                                                    ) : q.image ? (
                                                        <span class={css.imageRef}>{q.image}</span>
                                                    ) : (
                                                        <span class={css.imageRef}>—</span>
                                                    )}
                                                </td>
                                            )}
                                            <td class={css.td}>
                                                <div
                                                    class={
                                                        css.actionsCell
                                                    }
                                                >
                                                    {update?.needsPull && (
                                                        <ActionButton
                                                            label="Pull & Restart"
                                                            variant="primary"
                                                            onClick={() =>
                                                                pullAndRestart(q.image!, q.serviceName)
                                                            }
                                                        />
                                                    )}
                                                    {update?.needsRestart && !update.needsPull && (
                                                        <ActionButton
                                                            label="Restart"
                                                            variant="primary"
                                                            onClick={() =>
                                                                restartAndRecheck(q.image!, q.serviceName, q.filename)
                                                            }
                                                        />
                                                    )}
                                                    {!update?.needsPull && !update?.needsRestart && (
                                                        <>
                                                            {isActive ? (
                                                                <>
                                                                    <ActionButton
                                                                        label="Stop"
                                                                        onClick={async () => {
                                                                            if (await confirm(`Stop ${q.filename}?`, { variant: "warning", confirmLabel: "Stop" }))
                                                                                run(action_stop({ body: { serviceName: q.serviceName } }), `${q.filename} stopped`);
                                                                        }}
                                                                    />
                                                                    <ActionButton
                                                                        label="Restart"
                                                                        onClick={() =>
                                                                            run(
                                                                                action_restart({ body: { serviceName: q.serviceName } }),
                                                                                `${q.filename} restarted`
                                                                            )
                                                                        }
                                                                    />
                                                                </>
                                                            ) : (
                                                                <ActionButton
                                                                    label="Start"
                                                                    variant="primary"
                                                                    onClick={() =>
                                                                        run(
                                                                            action_start({ body: { serviceName: q.serviceName } }),
                                                                            `${q.filename} started`
                                                                        )
                                                                    }
                                                                />
                                                            )}
                                                        </>
                                                    )}
                                                    <ActionButton
                                                        label="Delete"
                                                        variant="danger"
                                                        onClick={async () => {
                                                            if (await confirm(`Delete ${q.filename}? This cannot be undone.`, { confirmLabel: "Delete" }))
                                                                run(action_delete({ body: { filename: q.filename } }), `${q.filename} deleted`);
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
