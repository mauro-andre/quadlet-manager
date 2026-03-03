import type { LoaderArgs, ActionArgs } from "velojs";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { useLoader } from "velojs/hooks";
import type { UpdateInfo } from "../modules/update/update.service.js";
import { toast } from "../components/toast.js";
import * as css from "./SettingsPage.css.js";

interface SettingsData {
    update: UpdateInfo;
}

export const loader = async ({ c }: LoaderArgs) => {
    const { checkForUpdate } = await import(
        "../modules/update/update.service.js"
    );
    const update = await checkForUpdate();
    return { update } satisfies SettingsData;
};

export const action_update = async ({
    body,
}: ActionArgs<{ version: string; tarballUrl: string }>) => {
    const { performUpdate } = await import(
        "../modules/update/update.service.js"
    );
    return await performUpdate(body.version, body.tarballUrl);
};

export const Component = () => {
    const { data, loading } = useLoader<SettingsData>();

    const updating = useSignal(false);
    const updateError = useSignal("");
    const pollCount = useSignal(0);

    // Poll for server restart after update
    useEffect(() => {
        if (!updating.value) return;

        const targetVersion = data.value?.update.latestVersion ?? "";
        const maxAttempts = 30; // 60s at 2s intervals
        let attempt = 0;
        let cancelled = false;

        const poll = setInterval(async () => {
            if (cancelled) return;
            attempt++;
            pollCount.value = attempt;

            try {
                const res = await fetch("/api/health");
                if (res.ok) {
                    const { version } = await res.json();
                    if (version === targetVersion) {
                        clearInterval(poll);
                        window.location.reload();
                        return;
                    }
                }
            } catch {
                // Server still restarting
            }

            if (attempt >= maxAttempts) {
                clearInterval(poll);
                updating.value = false;
                updateError.value = "Update timed out. The server may still be restarting — try refreshing the page.";
            }
        }, 2000);

        return () => {
            cancelled = true;
            clearInterval(poll);
        };
    }, [updating.value]);

    if (loading.value) return <div>Loading...</div>;

    const update = data.value?.update;

    const handleUpdate = async () => {
        if (!update?.tarballUrl) {
            toast("No download URL available for this release", "error");
            return;
        }

        updating.value = true;
        updateError.value = "";

        try {
            const result = await action_update({
                body: {
                    version: update.latestVersion,
                    tarballUrl: update.tarballUrl,
                },
            });
            if (result && typeof result === "object" && "error" in result) {
                updating.value = false;
                toast(String((result as { error: string }).error), "error");
            }
            // If success, server will restart — polling handles the rest
        } catch {
            // Connection likely dropped because server restarted — that's expected
        }
    };

    if (updating.value) {
        return (
            <div class={css.page}>
                <h1 class={css.title}>Settings</h1>
                <div class={css.progressCard}>
                    <div class={css.spinner} />
                    <div class={css.progressText}>
                        Updating to v{update?.latestVersion}...
                    </div>
                    <div class={css.progressText}>
                        Waiting for server to restart ({pollCount.value * 2}s)
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div class={css.page}>
            <h1 class={css.title}>Settings</h1>

            <div class={css.card}>
                <div class={css.cardTitle}>Application Version</div>

                <div class={css.versionRow}>
                    <span class={css.versionLabel}>Current</span>
                    <span class={css.versionValue}>v{update?.currentVersion}</span>
                    {update && !update.hasUpdate && (
                        <span class={`${css.badge} ${css.badgeSuccess}`}>
                            Up to date
                        </span>
                    )}
                </div>

                {update?.hasUpdate && (
                    <>
                        <div class={css.versionRow}>
                            <span class={css.versionLabel}>Latest</span>
                            <span class={css.versionValue}>v{update.latestVersion}</span>
                            <span class={`${css.badge} ${css.badgeWarning}`}>
                                Update available
                            </span>
                        </div>

                        {(update.releaseNotes || update.publishedAt) && (
                            <div class={css.releaseInfo}>
                                {update.publishedAt && (
                                    <div class={css.releaseDate}>
                                        Released {new Date(update.publishedAt).toLocaleDateString()}
                                    </div>
                                )}
                                {update.releaseNotes && (
                                    <div class={css.releaseNotes}>
                                        {update.releaseNotes}
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            class={css.updateButton}
                            onClick={handleUpdate}
                            disabled={!update.tarballUrl}
                        >
                            Update to v{update.latestVersion}
                        </button>
                    </>
                )}

                {updateError.value && (
                    <div class={css.errorText}>{updateError.value}</div>
                )}
            </div>
        </div>
    );
};
