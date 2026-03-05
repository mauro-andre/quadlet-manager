import type { LoaderArgs, ActionArgs } from "velojs";
import { useSignal, useComputed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { useLoader } from "velojs/hooks";
import type {
    Storage, Policy, BackupHistory, BackupType,
} from "../modules/backup/backup.types.js";
import { FREQUENCIES, RETENTIONS, BACKUP_TYPES } from "../modules/backup/backup.types.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as css from "./BackupList.css.js";

// ── Types ────────────────────────────────────────────────────

interface BackupListData {
    hasRclone: boolean;
    storages: Storage[];
    policies: Policy[];
    historyByPolicy: Record<number, BackupHistory[]>;
    volumes: string[];
    containers: string[];
    runningPolicies: number[];
}

// ── Loader ───────────────────────────────────────────────────

export const loader = async ({ c }: LoaderArgs) => {
    const { backupStore } = await import("../modules/backup/backup.store.js");
    const { checkRclone, getRunningPolicies } = await import("../modules/backup/backup.service.js");
    const { listVolumes } = await import("../modules/podman/podman.client.js");
    const { listContainers } = await import("../modules/podman/podman.client.js");

    const user = c.get("user");
    const [hasRclone, volumes, containers] = await Promise.all([
        checkRclone(),
        listVolumes("user", user.uid).catch(() => []),
        listContainers("user", user.uid, true).catch(() => []),
    ]);

    const policies = backupStore.listPolicies();
    const historyByPolicy: Record<number, BackupHistory[]> = {};
    for (const p of policies) {
        historyByPolicy[p.id] = backupStore.listHistoryByPolicy(p.id);
    }

    return {
        hasRclone,
        storages: backupStore.listStorages(),
        policies,
        historyByPolicy,
        volumes: volumes.map((v: { Name: string }) => v.Name),
        containers: containers.map((c: { Names: string[] }) => c.Names?.[0] ?? "").filter(Boolean),
        runningPolicies: getRunningPolicies(),
    } satisfies BackupListData;
};

// ── Actions ──────────────────────────────────────────────────

export const action_addStorage = async ({
    body,
}: ActionArgs<{ name: string; endpoint: string; bucket: string; region: string; accessKey: string; secretKey: string }>) => {
    const { backupStore } = await import("../modules/backup/backup.store.js");
    backupStore.addStorage(body.name, body.endpoint, body.bucket, body.region, body.accessKey, body.secretKey);
    return { ok: true };
};

export const action_updateStorage = async ({
    body,
}: ActionArgs<{ id: number; name: string; endpoint: string; bucket: string; region: string; accessKey: string; secretKey: string }>) => {
    const { backupStore } = await import("../modules/backup/backup.store.js");
    backupStore.updateStorage(body.id, body.name, body.endpoint, body.bucket, body.region, body.accessKey, body.secretKey);
    return { ok: true };
};

export const action_deleteStorage = async ({ body }: ActionArgs<{ id: number }>) => {
    const { backupStore } = await import("../modules/backup/backup.store.js");
    backupStore.deleteStorage(body.id);
    return { ok: true };
};

export const action_testStorage = async ({
    body,
}: ActionArgs<{ endpoint: string; bucket: string; region: string; accessKey: string; secretKey: string }>) => {
    const { testConnection } = await import("../modules/backup/backup.service.js");
    return await testConnection({
        id: 0, name: "", endpoint: body.endpoint, bucket: body.bucket,
        region: body.region, accessKey: body.accessKey, secretKey: body.secretKey,
    });
};

export const action_addPolicy = async ({
    body,
}: ActionArgs<{
    name: string; type: BackupType; target: string; credentials: string;
    database: string; storageId: number; frequency: number; retention: number;
}>) => {
    const { backupStore } = await import("../modules/backup/backup.store.js");
    backupStore.addPolicy(
        body.name, body.type, body.target,
        body.credentials || null, body.database || null,
        body.storageId, body.frequency, body.retention,
    );
    return { ok: true };
};

export const action_updatePolicy = async ({
    body,
}: ActionArgs<{
    id: number; name: string; type: BackupType; target: string; credentials: string;
    database: string; storageId: number; frequency: number; retention: number;
}>) => {
    const { backupStore } = await import("../modules/backup/backup.store.js");
    backupStore.updatePolicy(
        body.id, body.name, body.type, body.target,
        body.credentials || null, body.database || null,
        body.storageId, body.frequency, body.retention,
    );
    return { ok: true };
};

export const action_deletePolicy = async ({ body }: ActionArgs<{ id: number }>) => {
    const { backupStore } = await import("../modules/backup/backup.store.js");
    backupStore.deletePolicy(body.id);
    return { ok: true };
};

export const action_togglePolicy = async ({ body }: ActionArgs<{ id: number; enabled: boolean }>) => {
    const { backupStore } = await import("../modules/backup/backup.store.js");
    backupStore.togglePolicy(body.id, body.enabled);
    return { ok: true };
};

export const action_runNow = async ({ body }: ActionArgs<{ id: number }>) => {
    const { runBackup, isRunning } = await import("../modules/backup/backup.service.js");
    if (isRunning(body.id)) return { error: "Backup already running" };
    // Fire-and-forget — backup runs in background
    runBackup(body.id).catch((err) => {
        console.error(`[backup] Policy ${body.id} failed:`, err.message);
    });
    return { ok: true };
};

export const action_restore = async ({ body }: ActionArgs<{ id: number }>) => {
    const { restoreBackup } = await import("../modules/backup/backup.service.js");
    // Fire-and-forget — restore runs in background
    restoreBackup(body.id).catch((err) => {
        console.error(`[backup] Restore ${body.id} failed:`, err.message);
    });
    return { ok: true };
};

export const action_deleteBackup = async ({ body }: ActionArgs<{ id: number }>) => {
    const { deleteBackup } = await import("../modules/backup/backup.service.js");
    await deleteBackup(body.id);
    return { ok: true };
};

// ── Helpers ──────────────────────────────────────────────────

function formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatFrequency(minutes: number): string {
    return FREQUENCIES.find((f) => f.value === minutes)?.label ?? `${minutes}min`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
}

function formatNextRun(lastRunAt: string | null, frequencyMin: number, enabled: boolean): string {
    if (!enabled) return "Disabled";
    if (!lastRunAt) return "Pending";
    const next = new Date(lastRunAt).getTime() + frequencyMin * 60_000;
    const diff = next - Date.now();
    if (diff <= 0) return "Due now";
    const mins = Math.ceil(diff / 60_000);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    if (hours < 24) return remainMins > 0 ? `in ${hours}h ${remainMins}m` : `in ${hours}h`;
    const days = Math.floor(hours / 24);
    return `in ${days}d ${hours % 24}h`;
}

function run(action: Promise<unknown>, msg: string, refetch: () => void) {
    action
        .then((result) => {
            if (result && typeof result === "object" && "error" in result) {
                toast(String((result as { error: string }).error), "error");
                return;
            }
            toast(msg);
            refetch();
        })
        .catch((err) => toast(err?.message ?? "Action failed", "error"));
}

// ── Component ────────────────────────────────────────────────

export const Component = () => {
    const { data, loading, refetch } = useLoader<BackupListData>();

    // Storage form
    const showStorageForm = useSignal(false);
    const editingStorage = useSignal<Storage | null>(null);
    const sName = useSignal("");
    const sEndpoint = useSignal("");
    const sBucket = useSignal("");
    const sRegion = useSignal("");
    const sAccessKey = useSignal("");
    const sSecretKey = useSignal("");
    const sTesting = useSignal(false);

    // Policy form
    const showPolicyForm = useSignal(false);
    const editingPolicy = useSignal<Policy | null>(null);
    const pName = useSignal("");
    const pType = useSignal<BackupType>("mongodb");
    const pTarget = useSignal("");
    const pCredentials = useSignal("");
    const pDatabase = useSignal("");
    const pStorageId = useSignal(0);
    const pFrequency = useSignal(60);
    const pRetention = useSignal(24);

    const submitting = useSignal(false);

    // SSE: track running backups and restores with phase info
    const runningMap = useSignal<Map<number, string>>(new Map((data.value?.runningPolicies ?? []).map((id: number) => [id, "Running…"])));
    const restoringMap = useSignal<Map<number, string>>(new Map());

    useEffect(() => {
        const es = new EventSource("/api/backups/events");

        es.addEventListener("snapshot", (e) => {
            const { running, restoring } = JSON.parse(e.data);
            runningMap.value = new Map(running.map((id: number) => [id, "Running…"]));
            restoringMap.value = new Map(restoring.map((id: number) => [id, "Restoring…"]));
        });

        es.addEventListener("started", (e) => {
            const { policyId } = JSON.parse(e.data);
            const next = new Map(runningMap.value);
            next.set(policyId, "Starting…");
            runningMap.value = next;
        });

        es.addEventListener("progress", (e) => {
            const { policyId, phase } = JSON.parse(e.data);
            const next = new Map(runningMap.value);
            next.set(policyId, phase);
            runningMap.value = next;
        });

        es.addEventListener("finished", (e) => {
            const { policyId } = JSON.parse(e.data);
            const next = new Map(runningMap.value);
            next.delete(policyId);
            runningMap.value = next;
            refetch();
        });

        es.addEventListener("restore-started", (e) => {
            const { historyId } = JSON.parse(e.data);
            const next = new Map(restoringMap.value);
            next.set(historyId, "Starting…");
            restoringMap.value = next;
        });

        es.addEventListener("restore-progress", (e) => {
            const { historyId, phase } = JSON.parse(e.data);
            const next = new Map(restoringMap.value);
            next.set(historyId, phase);
            restoringMap.value = next;
        });

        es.addEventListener("restore-finished", (e) => {
            const { historyId, status } = JSON.parse(e.data);
            const next = new Map(restoringMap.value);
            next.delete(historyId);
            restoringMap.value = next;
            toast(status === "success" ? "Restore completed" : "Restore failed", status === "success" ? "success" : "error");
        });

        return () => es.close();
    }, []);

    if (loading.value) return <div>Loading...</div>;

    const hasRclone = data.value?.hasRclone ?? false;
    const storages = data.value?.storages ?? [];
    const policies = data.value?.policies ?? [];
    const historyByPolicy = data.value?.historyByPolicy ?? {};
    const volumes = data.value?.volumes ?? [];
    const containers = data.value?.containers ?? [];

    // Track which policies have expanded history
    const expandedPolicies = useSignal<Set<number>>(new Set());

    // ── No rclone ────────────────────────────────────────────

    if (!hasRclone) {
        return (
            <div class={css.page}>
                <h1 class={css.title}>Backups</h1>
                <div class={css.setupCard}>
                    <div class={css.setupTitle}>rclone Required</div>
                    <div class={css.setupDescription}>
                        Backups require rclone to upload files to remote storage. Install it first:
                    </div>
                    <code class={css.warningCode}>
                        curl https://rclone.org/install.sh | sudo bash
                    </code>
                </div>
            </div>
        );
    }

    // ── Storage form helpers ─────────────────────────────────

    const resetStorageForm = () => {
        showStorageForm.value = false;
        editingStorage.value = null;
        sName.value = "";
        sEndpoint.value = "";
        sBucket.value = "";
        sRegion.value = "";
        sAccessKey.value = "";
        sSecretKey.value = "";
        submitting.value = false;
    };

    const openStorageAdd = () => {
        resetStorageForm();
        showStorageForm.value = true;
    };

    const openStorageEdit = (s: Storage) => {
        editingStorage.value = s;
        sName.value = s.name;
        sEndpoint.value = s.endpoint;
        sBucket.value = s.bucket;
        sRegion.value = s.region;
        sAccessKey.value = s.accessKey;
        sSecretKey.value = s.secretKey;
        showStorageForm.value = true;
    };

    const handleTestConnection = async () => {
        sTesting.value = true;
        try {
            const result = await action_testStorage({
                body: {
                    endpoint: sEndpoint.value, bucket: sBucket.value,
                    region: sRegion.value, accessKey: sAccessKey.value, secretKey: sSecretKey.value,
                },
            });
            if (result && typeof result === "object" && "ok" in result && result.ok) {
                toast("Connection successful");
            } else {
                const err = result && typeof result === "object" && "error" in result
                    ? String((result as { error: string }).error) : "Connection failed";
                toast(err, "error");
            }
        } catch {
            toast("Connection failed", "error");
        } finally {
            sTesting.value = false;
        }
    };

    const handleSaveStorage = async () => {
        if (!sName.value.trim() || !sEndpoint.value.trim() || !sBucket.value.trim() || !sAccessKey.value.trim() || !sSecretKey.value.trim()) {
            toast("All fields except Region are required", "error");
            return;
        }
        submitting.value = true;
        const body = {
            name: sName.value.trim(), endpoint: sEndpoint.value.trim(), bucket: sBucket.value.trim(),
            region: sRegion.value.trim(), accessKey: sAccessKey.value.trim(), secretKey: sSecretKey.value.trim(),
        };
        if (editingStorage.value) {
            run(action_updateStorage({ body: { id: editingStorage.value.id, ...body } }), "Storage updated", refetch);
        } else {
            run(action_addStorage({ body }), "Storage added", refetch);
        }
        resetStorageForm();
    };

    // ── Policy form helpers ──────────────────────────────────

    const resetPolicyForm = () => {
        showPolicyForm.value = false;
        editingPolicy.value = null;
        pName.value = "";
        pType.value = "mongodb";
        pTarget.value = "";
        pCredentials.value = "";
        pDatabase.value = "";
        pStorageId.value = storages[0]?.id ?? 0;
        pFrequency.value = 60;
        pRetention.value = 24;
        submitting.value = false;
    };

    const openPolicyAdd = () => {
        resetPolicyForm();
        showPolicyForm.value = true;
    };

    const openPolicyEdit = (p: Policy) => {
        editingPolicy.value = p;
        pName.value = p.name;
        pType.value = p.type;
        pTarget.value = p.target;
        pCredentials.value = p.credentials ?? "";
        pDatabase.value = p.database ?? "";
        pStorageId.value = p.storageId;
        pFrequency.value = p.frequency;
        pRetention.value = p.retention;
        showPolicyForm.value = true;
    };

    const handleSavePolicy = async () => {
        if (!pName.value.trim() || !pTarget.value.trim() || !pStorageId.value) {
            toast("Name, target, and storage are required", "error");
            return;
        }
        submitting.value = true;
        const body = {
            name: pName.value.trim(), type: pType.value, target: pTarget.value.trim(),
            credentials: pCredentials.value, database: pDatabase.value,
            storageId: pStorageId.value, frequency: pFrequency.value, retention: pRetention.value,
        };
        if (editingPolicy.value) {
            run(action_updatePolicy({ body: { id: editingPolicy.value.id, ...body } }), "Policy updated", refetch);
        } else {
            run(action_addPolicy({ body }), "Policy created", refetch);
        }
        resetPolicyForm();
    };

    const isDbType = pType.value !== "raw";
    const targetOptions = isDbType ? containers : volumes;

    // ── No storages → setup ──────────────────────────────────

    if (storages.length === 0 && !showStorageForm.value) {
        return (
            <div class={css.page}>
                <h1 class={css.title}>Backups</h1>
                <div class={css.setupCard}>
                    <div class={css.setupTitle}>Configure Storage</div>
                    <div class={css.setupDescription}>
                        Configure an S3-compatible storage destination to start creating backups.
                        Supports AWS S3, DigitalOcean Spaces, Backblaze B2, Hetzner Object Storage,
                        Cloudflare R2, MinIO, and more.
                    </div>
                    <button class={css.setupButton} onClick={openStorageAdd}>
                        Add Storage
                    </button>
                </div>
            </div>
        );
    }

    // ── Active state ─────────────────────────────────────────

    return (
        <div class={css.page}>
            <h1 class={css.title}>Backups</h1>

            {/* Storage Destinations */}
            <div>
                <div class={css.sectionHeader}>
                    <div class={css.sectionTitle}>Storage Destinations</div>
                    {!showStorageForm.value && (
                        <button class={css.addButton} onClick={openStorageAdd}>Add Storage</button>
                    )}
                </div>

                {showStorageForm.value && (
                    <div class={css.inlineForm} style={{ marginTop: "8px" }}>
                        <div class={css.inlineFormTitle}>
                            {editingStorage.value ? "Edit Storage" : "Add Storage"} (S3 Compatible)
                        </div>
                        <div class={css.inlineFormRow}>
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>Name</div>
                                <input class={css.input} value={sName.value}
                                    onInput={(e) => { sName.value = (e.target as HTMLInputElement).value; }}
                                    placeholder="Hetzner Backup" />
                            </div>
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>Endpoint</div>
                                <input class={css.input} value={sEndpoint.value}
                                    onInput={(e) => { sEndpoint.value = (e.target as HTMLInputElement).value; }}
                                    placeholder="fsn1.your-objectstorage.com" />
                            </div>
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>Bucket</div>
                                <input class={css.input} value={sBucket.value}
                                    onInput={(e) => { sBucket.value = (e.target as HTMLInputElement).value; }}
                                    placeholder="my-backups" />
                            </div>
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>Region</div>
                                <input class={css.input} value={sRegion.value}
                                    onInput={(e) => { sRegion.value = (e.target as HTMLInputElement).value; }}
                                    placeholder="eu-central-1 (optional)" />
                            </div>
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>Access Key</div>
                                <input class={css.input} value={sAccessKey.value}
                                    onInput={(e) => { sAccessKey.value = (e.target as HTMLInputElement).value; }}
                                    placeholder="AK123..." />
                            </div>
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>Secret Key</div>
                                <input class={css.input} type="password" value={sSecretKey.value}
                                    onInput={(e) => { sSecretKey.value = (e.target as HTMLInputElement).value; }}
                                    placeholder="SK456..." />
                            </div>
                        </div>
                        <div class={css.inlineFormActions}>
                            <button class={css.cancelButton} onClick={resetStorageForm}>Cancel</button>
                            <button class={css.cancelButton} onClick={handleTestConnection}
                                disabled={sTesting.value}>
                                {sTesting.value ? "Testing..." : "Test Connection"}
                            </button>
                            <button class={css.submitButton} onClick={handleSaveStorage}
                                disabled={submitting.value}>
                                Save
                            </button>
                        </div>
                    </div>
                )}

                <div class={css.cardList} style={{ marginTop: "8px" }}>
                    {storages.map((s) => (
                        <div key={s.id} class={css.card}>
                            <div class={css.cardInfo}>
                                <div class={css.cardName}>{s.name}</div>
                                <div class={css.cardDetail}>{s.endpoint} / {s.bucket}</div>
                            </div>
                            <div class={css.actionsCell}>
                                <ActionButton label="Edit" onClick={async () => openStorageEdit(s)} />
                                <ActionButton label="Delete" variant="danger" onClick={async () => {
                                    if (await confirm(`Delete storage "${s.name}"?`, { confirmLabel: "Delete" })) {
                                        run(action_deleteStorage({ body: { id: s.id } }), "Storage deleted", refetch);
                                    }
                                }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Policies */}
            <div>
                <div class={css.sectionHeader}>
                    <div class={css.sectionTitle}>Backup Policies</div>
                    {!showPolicyForm.value && storages.length > 0 && (
                        <button class={css.addButton} onClick={openPolicyAdd}>New Policy</button>
                    )}
                </div>

                {showPolicyForm.value && (
                    <div class={css.inlineForm} style={{ marginTop: "8px" }}>
                        <div class={css.inlineFormTitle}>
                            {editingPolicy.value ? "Edit Policy" : "New Backup Policy"}
                        </div>
                        <div class={css.inlineFormRow}>
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>Name</div>
                                <input class={css.input} value={pName.value}
                                    onInput={(e) => { pName.value = (e.target as HTMLInputElement).value; }}
                                    placeholder="MongoDB Hourly" />
                            </div>
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>Type</div>
                                <select class={css.select} value={pType.value}
                                    onChange={(e) => {
                                        pType.value = (e.target as HTMLSelectElement).value as BackupType;
                                        pTarget.value = "";
                                    }}>
                                    {BACKUP_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>{isDbType ? "Container" : "Volume"}</div>
                                <select class={css.select} value={pTarget.value}
                                    onChange={(e) => { pTarget.value = (e.target as HTMLSelectElement).value; }}>
                                    <option value="">Select...</option>
                                    {targetOptions.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            {isDbType && (
                                <div class={css.inlineFormField}>
                                    <div class={css.inlineFormLabel}>Credentials (user:pass)</div>
                                    <input class={css.input} value={pCredentials.value}
                                        onInput={(e) => { pCredentials.value = (e.target as HTMLInputElement).value; }}
                                        placeholder="admin:password" />
                                </div>
                            )}
                            {(pType.value === "postgresql" || pType.value === "mysql") && (
                                <div class={css.inlineFormField}>
                                    <div class={css.inlineFormLabel}>Database</div>
                                    <input class={css.input} value={pDatabase.value}
                                        onInput={(e) => { pDatabase.value = (e.target as HTMLInputElement).value; }}
                                        placeholder="mydb" />
                                </div>
                            )}
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>Frequency</div>
                                <select class={css.select} value={pFrequency.value}
                                    onChange={(e) => { pFrequency.value = Number((e.target as HTMLSelectElement).value); }}>
                                    {FREQUENCIES.map((f) => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>Retention</div>
                                <select class={css.select} value={pRetention.value}
                                    onChange={(e) => { pRetention.value = Number((e.target as HTMLSelectElement).value); }}>
                                    {RETENTIONS.map((r) => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>Destination</div>
                                <select class={css.select} value={pStorageId.value}
                                    onChange={(e) => { pStorageId.value = Number((e.target as HTMLSelectElement).value); }}>
                                    {storages.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div class={css.inlineFormActions}>
                            <button class={css.cancelButton} onClick={resetPolicyForm}>Cancel</button>
                            <button class={css.submitButton} onClick={handleSavePolicy}
                                disabled={submitting.value}>
                                {editingPolicy.value ? "Update" : "Create"}
                            </button>
                        </div>
                    </div>
                )}

                <div class={css.cardList} style={{ marginTop: "8px" }}>
                    {policies.length === 0 && (
                        <div class={css.empty}>No backup policies configured.</div>
                    )}
                    {policies.map((p) => {
                        const pHistory = historyByPolicy[p.id] ?? [];
                        const isExpanded = expandedPolicies.value.has(p.id);
                        const toggleExpand = () => {
                            const next = new Set(expandedPolicies.value);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            expandedPolicies.value = next;
                        };

                        return (
                            <div key={p.id} class={p.enabled ? "" : css.cardDisabled}>
                                <div class={css.card}>
                                    <div class={css.cardInfo}>
                                        <div class={css.cardName}>{p.name}</div>
                                        <div class={css.cardDetail}>
                                            {BACKUP_TYPES.find((t) => t.value === p.type)?.label} · {p.target} · {p.storageName}
                                        </div>
                                        <div class={css.cardMeta}>
                                            <span>{formatFrequency(p.frequency)}</span>
                                            <span>·</span>
                                            <span>Keep {p.retention}</span>
                                            {p.lastRunAt && (
                                                <>
                                                    <span>·</span>
                                                    <span>Last: {formatDate(p.lastRunAt)}</span>
                                                    {p.lastStatus && (
                                                        <span class={`${css.statusBadge} ${p.lastStatus === "success" ? css.statusSuccess : css.statusError}`}>
                                                            {p.lastStatus}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                            <span>·</span>
                                            <span>Next: {formatNextRun(p.lastRunAt, p.frequency, p.enabled)}</span>
                                        </div>
                                    </div>
                                    <div class={css.actionsCell}>
                                        {runningMap.value.has(p.id) ? (
                                            <button class={css.runningButton} disabled>
                                                <span class={css.spinner} /> {runningMap.value.get(p.id)}
                                            </button>
                                        ) : (
                                            <ActionButton label="Run Now" onClick={async () => {
                                                run(action_runNow({ body: { id: p.id } }), "Backup started", () => {});
                                            }} />
                                        )}
                                        <ActionButton label={`History (${pHistory.length})`} onClick={async () => { toggleExpand(); }} />
                                        <ActionButton label="Edit" onClick={async () => openPolicyEdit(p)} />
                                        <ActionButton label={p.enabled ? "Disable" : "Enable"} onClick={async () => {
                                            run(
                                                action_togglePolicy({ body: { id: p.id, enabled: !p.enabled } }),
                                                p.enabled ? "Policy disabled" : "Policy enabled",
                                                refetch,
                                            );
                                        }} />
                                        <ActionButton label="Delete" variant="danger" onClick={async () => {
                                            if (await confirm(`Delete policy "${p.name}" and all its backup history?`, { confirmLabel: "Delete" })) {
                                                run(action_deletePolicy({ body: { id: p.id } }), "Policy deleted", refetch);
                                            }
                                        }} />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div class={css.policyHistory}>
                                        {pHistory.length === 0 ? (
                                            <div class={css.empty}>No backups yet.</div>
                                        ) : (
                                            <table class={css.table}>
                                                <thead>
                                                    <tr>
                                                        <th class={css.th}>Time</th>
                                                        <th class={css.th}>Size</th>
                                                        <th class={css.th}>Status</th>
                                                        <th class={css.th}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pHistory.map((h) => (
                                                        <tr key={h.id}>
                                                            <td class={css.td}>{formatDate(h.timestamp)}</td>
                                                            <td class={css.td}>{h.status === "success" ? formatSize(h.size) : "—"}</td>
                                                            <td class={css.td}>
                                                                {h.status === "success" && (
                                                                    <span class={`${css.statusBadge} ${css.statusSuccess}`}>Success</span>
                                                                )}
                                                                {h.status === "error" && (
                                                                    <div>
                                                                        <span class={`${css.statusBadge} ${css.statusError}`}>Error</span>
                                                                        {h.error && <div class={css.errorDetail}>{h.error}</div>}
                                                                    </div>
                                                                )}
                                                                {h.status === "running" && (
                                                                    <span class={`${css.statusBadge} ${css.statusRunning}`}>
                                                                        <span class={css.spinner} /> Running
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td class={css.td}>
                                                                <div class={css.actionsCell}>
                                                                    {h.status === "success" && (
                                                                        restoringMap.value.has(h.id) ? (
                                                                            <button class={css.runningButton} disabled>
                                                                                <span class={css.spinner} /> {restoringMap.value.get(h.id)}
                                                                            </button>
                                                                        ) : (
                                                                            <ActionButton label="Restore" onClick={async () => {
                                                                                if (await confirm("Restore this backup? Current data may be overwritten.", { confirmLabel: "Restore" })) {
                                                                                    run(action_restore({ body: { id: h.id } }), "Restoring...", () => {});
                                                                                }
                                                                            }} />
                                                                        )
                                                                    )}
                                                                    <ActionButton label="Delete" variant="danger" onClick={async () => {
                                                                        if (await confirm("Delete this backup from remote storage?", { confirmLabel: "Delete" })) {
                                                                            run(action_deleteBackup({ body: { id: h.id } }), "Backup deleted", refetch);
                                                                        }
                                                                    }} />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
