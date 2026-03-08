import { execFile as execFileCb, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream } from "node:fs";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { backupStore } from "./backup.store.js";
import type { Storage, BackupType, BackupMode, Policy } from "./backup.types.js";

const execFile = promisify(execFileCb);

const QM_DATA_DIR = join(homedir(), ".local/share/quadlet-manager");
const SCRIPTS_DIR = join(QM_DATA_DIR, "scripts");
const RCLONE_DIR = join(QM_DATA_DIR, "rclone");
const SYSTEMD_USER_DIR = join(homedir(), ".config/systemd/user");

function spawnWithStdin(cmd: string, args: string[], inputPath: string, timeout = 300_000): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { stdio: ["pipe", "ignore", "pipe"], timeout });
        let stderr = "";
        proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
        proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(stderr || `Process exited with code ${code}`));
        });
        proc.on("error", reject);
        createReadStream(inputPath).pipe(proc.stdin!);
    });
}

function rcloneWithProgress(args: string[], onProgress: (line: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn("rclone", [...args, "-v", "--stats", "1s", "--stats-one-line"], {
            stdio: ["ignore", "ignore", "pipe"],
        });
        let stderr = "";
        proc.stderr.on("data", (chunk: Buffer) => {
            const text = chunk.toString();
            stderr += text;
            const match = text.match(/([\d.]+\s?\w+)\s*\/\s*([\d.]+\s?\w+),\s*(\d+)%/);
            if (match) {
                onProgress(`${match[1]} / ${match[2]} (${match[3]}%)`);
            }
        });
        proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(stderr || `rclone exited with code ${code}`));
        });
        proc.on("error", reject);
    });
}

export async function checkRclone(): Promise<boolean> {
    try {
        await execFile("which", ["rclone"]);
        return true;
    } catch {
        return false;
    }
}

// ── Rclone config ───────────────────────────────────────────

function rcloneConfigContent(storage: Storage): string {
    return [
        "[remote]",
        "type = s3",
        "provider = Other",
        `endpoint = ${storage.endpoint}`,
        `access_key_id = ${storage.accessKey}`,
        `secret_access_key = ${storage.secretKey}`,
        storage.region ? `region = ${storage.region}` : "",
        "acl = private",
        "no_check_bucket = true",
    ].filter(Boolean).join("\n") + "\n";
}

function rcloneConfigPath(storageId: string): string {
    return join(RCLONE_DIR, `storage-${storageId}.conf`);
}

export async function saveRcloneConfig(storage: Storage): Promise<string> {
    await mkdir(RCLONE_DIR, { recursive: true });
    const configPath = rcloneConfigPath(storage.id);
    await writeFile(configPath, rcloneConfigContent(storage), { mode: 0o600 });
    return configPath;
}

export async function deleteRcloneConfig(storageId: string): Promise<void> {
    await unlink(rcloneConfigPath(storageId)).catch(() => {});
}

async function withRcloneConfig<T>(storage: Storage, fn: (configPath: string) => Promise<T>): Promise<T> {
    const configPath = join("/tmp", `rclone-qm-${randomBytes(6).toString("hex")}.conf`);
    await writeFile(configPath, rcloneConfigContent(storage), "utf-8");
    try {
        return await fn(configPath);
    } finally {
        await unlink(configPath).catch(() => {});
    }
}

// ── Storage operations ───────────────────────────────────────

export async function testConnection(storage: Storage): Promise<{ ok: boolean; error?: string }> {
    try {
        return await withRcloneConfig(storage, async (configPath) => {
            await execFile("rclone", [
                "--config", configPath,
                "lsd", `remote:${storage.bucket}`,
            ], { timeout: 15_000 });
            return { ok: true };
        });
    } catch (err) {
        return { ok: false, error: (err as Error).message };
    }
}

// ── Volume mountpoint ────────────────────────────────────────

async function getVolumeMountpoint(volumeName: string): Promise<string> {
    const { stdout } = await execFile("podman", [
        "volume", "inspect", volumeName, "--format", "{{.Mountpoint}}",
    ]);
    return stdout.trim();
}

// ── Backup script generation ─────────────────────────────────

function safeName(name: string): string {
    return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_");
}

function scriptPath(policyName: string): string {
    return join(SCRIPTS_DIR, `backup-${safeName(policyName)}.sh`);
}

function timerUnitName(policyName: string): string {
    return `backup-${safeName(policyName)}.timer`;
}

function serviceUnitName(policyName: string): string {
    return `backup-${safeName(policyName)}.service`;
}

async function generateScript(policy: Policy, storage: Storage): Promise<string> {
    const configPath = rcloneConfigPath(storage.id);
    const remotePath = `backups/${safeName(policy.name)}`;
    const remoteTarget = `remote:${storage.bucket}/${remotePath}`;
    const lines: string[] = [
        "#!/bin/bash",
        "set -euo pipefail",
        "",
        `POLICY_ID="${policy.id}"`,
        `RCLONE_CONFIG="${configPath}"`,
        `REMOTE_TARGET="${remoteTarget}"`,
        `QM_PORT=$(cat ${QM_DATA_DIR}/port 2>/dev/null || echo "3000")`,
        'NOTIFY_URL="http://localhost:${QM_PORT}/api/backups/notify"',
        "",
        "# Notify QM (silently fails if QM is down)",
        "notify() {",
        '    local payload="{\\\"policyId\\\": \\\"$POLICY_ID\\\", \\\"phase\\\": \\\"$1\\\"}"',
        '    if [ -n "${2:-}" ]; then',
        '        payload="{\\\"policyId\\\": \\\"$POLICY_ID\\\", \\\"phase\\\": \\\"$1\\\", \\\"file\\\": \\\"$2\\\", \\\"size\\\": ${3:-0}}"',
        '    fi',
        '    curl -s -X POST "$NOTIFY_URL" \\',
        '        -H "Content-Type: application/json" \\',
        '        -d "$payload" \\',
        "        2>/dev/null || true",
        "}",
        "",
        'notify "started"',
        "",
    ];

    if (policy.mode === "sync") {
        const mountpoint = await getVolumeMountpoint(policy.target);
        lines.push(
            `MOUNT="${mountpoint}"`,
            "",
            'notify "Syncing..."',
            'podman unshare rclone sync "$MOUNT" "$REMOTE_TARGET/" --config "$RCLONE_CONFIG" -v --stats 1s --stats-one-line 2>&1 | \\',
            "    while IFS= read -r line; do",
            '        progress=$(echo "$line" | grep -oP "[\\d.]+\\s?\\w+\\s*/\\s*[\\d.]+\\s?\\w+,\\s*\\d+%" || true)',
            '        if [ -n "$progress" ]; then',
            '            notify "Syncing $progress"',
            "        fi",
            "    done",
            "",
            'notify "finished:success"',
        );
    } else {
        const ts='$(date -u +%Y-%m-%dT%H-%M-%S)';
        const ext = policy.type === "postgresql" ? "dump" : policy.type === "mysql" ? "sql" : policy.type === "redis" ? "rdb" : "gz";
        const filename = `${safeName(policy.name)}-${ts}.${ext}`;

        lines.push(`TMPFILE="/tmp/${filename}"`);
        lines.push("");

        lines.push(
            "cleanup() { rm -f \"$TMPFILE\" \"${TMPFILE%.gz}\"; }",
            "trap cleanup EXIT",
            "",
        );

        lines.push('notify "Dumping data..."');

        switch (policy.type) {
            case "raw": {
                lines.push(
                    'TARFILE="${TMPFILE%.gz}"',
                    `podman volume export "${policy.target}" --output "$TARFILE"`,
                    'gzip -f "$TARFILE"',
                );
                break;
            }
            case "mongodb": {
                const mongoArgs = ["exec", policy.target, "mongodump", "--archive", "--gzip"];
                if (policy.credentials) {
                    const parts = policy.credentials.split(":");
                    mongoArgs.push("--username", parts[0] ?? "", "--password", parts.slice(1).join(":"), "--authenticationDatabase", "admin");
                }
                lines.push(`podman ${mongoArgs.map(a => `"${a}"`).join(" ")} > "$TMPFILE"`);
                break;
            }
            case "postgresql": {
                const user = policy.credentials?.split(":")[0] ?? "postgres";
                const pass = policy.credentials?.split(":")[1];
                const db = policy.database ?? "postgres";
                lines.push(`podman exec ${pass ? `-e PGPASSWORD="${pass}"` : ""} "${policy.target}" pg_dump -U "${user}" -Fc "${db}" > "$TMPFILE"`);
                break;
            }
            case "mysql": {
                const user = policy.credentials?.split(":")[0] ?? "root";
                const pass = policy.credentials?.split(":")[1];
                const passArg = pass ? `-p"${pass}"` : "";
                lines.push(`podman exec "${policy.target}" mysqldump -u "${user}" ${passArg} --all-databases > "$TMPFILE"`);
                break;
            }
            case "redis": {
                lines.push(
                    `podman exec "${policy.target}" redis-cli bgsave`,
                    "sleep 2",
                    `podman cp "${policy.target}:/data/dump.rdb" "$TMPFILE"`,
                );
                break;
            }
        }

        lines.push(
            "",
            "# Upload",
            'notify "Uploading..."',
            'rclone copy "$TMPFILE" "$REMOTE_TARGET/" --config "$RCLONE_CONFIG" -v --stats 1s --stats-one-line 2>&1 | \\',
            "    while IFS= read -r line; do",
            '        progress=$(echo "$line" | grep -oP "[\\d.]+\\s?\\w+\\s*/\\s*[\\d.]+\\s?\\w+,\\s*\\d+%" || true)',
            '        if [ -n "$progress" ]; then',
            '            notify "Uploading $progress"',
            "        fi",
            "    done",
            "",
            'FILESIZE=$(stat -c%s "$TMPFILE" 2>/dev/null || echo "0")',
            'BASENAME=$(basename "$TMPFILE")',
            'notify "finished:success" "$BASENAME" "$FILESIZE"',
        );

        if (policy.retention > 0) {
            lines.push(
                "",
                "# Prune old backups (keep last N)",
                `RETENTION=${policy.retention}`,
                'FILES=$(rclone lsf "$REMOTE_TARGET/" --config "$RCLONE_CONFIG" | sort -r)',
                'COUNT=0',
                'echo "$FILES" | while IFS= read -r f; do',
                '    COUNT=$((COUNT + 1))',
                '    if [ "$COUNT" -gt "$RETENTION" ]; then',
                '        rclone deletefile "$REMOTE_TARGET/$f" --config "$RCLONE_CONFIG" 2>/dev/null || true',
                '    fi',
                'done',
            );
        }
    }

    return lines.join("\n") + "\n";
}

async function writeScript(policy: Policy, storage: Storage): Promise<string> {
    await mkdir(SCRIPTS_DIR, { recursive: true });
    const path = scriptPath(policy.name);
    const content = await generateScript(policy, storage);
    await writeFile(path, content, { mode: 0o755 });
    return path;
}

async function deleteScript(policyName: string): Promise<void> {
    await unlink(scriptPath(policyName)).catch(() => {});
}

// ── Systemd timer/service management ─────────────────────────

async function createTimerUnits(policy: Policy): Promise<void> {
    await mkdir(SYSTEMD_USER_DIR, { recursive: true });
    const sName = serviceUnitName(policy.name);
    const tName = timerUnitName(policy.name);
    const script = scriptPath(policy.name);

    const serviceContent = [
        "[Unit]",
        `Description=Backup: ${policy.name}`,
        "",
        "[Service]",
        "Type=oneshot",
        `ExecStart=/bin/bash ${script}`,
    ].join("\n") + "\n";

    const timerContent = [
        "[Unit]",
        `Description=Timer for backup: ${policy.name}`,
        "",
        "[Timer]",
        `OnCalendar=${policy.schedule}`,
        "Persistent=true",
        "",
        "[Install]",
        "WantedBy=timers.target",
    ].join("\n") + "\n";

    await writeFile(join(SYSTEMD_USER_DIR, sName), serviceContent);
    await writeFile(join(SYSTEMD_USER_DIR, tName), timerContent);

    const { daemonReload, enableService, startService } = await import("../systemd/systemd.service.js");
    await daemonReload();

    if (policy.enabled) {
        await enableService(tName).catch(() => {});
        await startService(tName).catch(() => {});
    }
}

async function removeTimerUnits(policyName: string): Promise<void> {
    const tName = timerUnitName(policyName);
    const sName = serviceUnitName(policyName);

    const { daemonReload, stopService, disableService } = await import("../systemd/systemd.service.js");
    await stopService(tName).catch(() => {});
    await disableService(tName).catch(() => {});
    await unlink(join(SYSTEMD_USER_DIR, tName)).catch(() => {});
    await unlink(join(SYSTEMD_USER_DIR, sName)).catch(() => {});
    await daemonReload();
}

async function toggleTimerUnit(policyName: string, enabled: boolean): Promise<void> {
    const tName = timerUnitName(policyName);
    const { enableService, disableService, startService, stopService } = await import("../systemd/systemd.service.js");

    if (enabled) {
        await enableService(tName).catch(() => {});
        await startService(tName).catch(() => {});
    } else {
        await stopService(tName).catch(() => {});
        await disableService(tName).catch(() => {});
    }
}

// ── Remote scan (populate history from existing bucket files) ─

async function scanRemoteBackups(policy: Policy, storage: Storage): Promise<void> {
    if (policy.mode === "sync") return;

    const remotePath = `backups/${safeName(policy.name)}`;
    const configPath = rcloneConfigPath(storage.id);

    let output: string;
    try {
        const result = await execFile("rclone", [
            "lsf", `remote:${storage.bucket}/${remotePath}/`,
            "--config", configPath,
            "--format", "sp",
            "--separator", ";",
        ], { timeout: 30_000 });
        output = result.stdout.trim();
    } catch {
        return;
    }

    if (!output) return;

    for (const line of output.split("\n")) {
        const sep = line.indexOf(";");
        if (sep === -1) continue;
        const sizeStr = line.slice(0, sep);
        const filename = line.slice(sep + 1);
        if (!filename) continue;

        const fullRemotePath = `${remotePath}/${filename}`;

        // Extract timestamp: PolicyName-2026-03-08T01-02-03.ext
        const tsMatch = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})\./);
        const timestamp = tsMatch
            ? `${tsMatch[1]}:${tsMatch[2]}:${tsMatch[3]}.000Z`
            : new Date().toISOString();

        const historyId = await backupStore.addHistory(policy.id, policy.name, fullRemotePath);
        await backupStore.updateHistoryComplete(historyId, Number(sizeStr) || 0, fullRemotePath, timestamp);
    }
}

// ── Policy lifecycle (called by UI actions) ──────────────────

export async function createPolicy(
    name: string, type: BackupType, mode: BackupMode, target: string,
    credentials: string | null, database: string | null,
    storageId: string, schedule: string, retention: number,
): Promise<void> {
    const id = await backupStore.addPolicy(name, type, mode, target, credentials, database, storageId, schedule, retention);
    const policy = await backupStore.getPolicy(id);
    if (!policy) throw new Error("Failed to create policy");
    const storage = await backupStore.getStorage(storageId);
    if (!storage) throw new Error("Storage not found");

    await saveRcloneConfig(storage);
    await writeScript(policy, storage);
    await createTimerUnits(policy);
    await scanRemoteBackups(policy, storage);
}

export async function updatePolicy(
    id: string, name: string, type: BackupType, mode: BackupMode, target: string,
    credentials: string | null, database: string | null,
    storageId: string, schedule: string, retention: number,
): Promise<void> {
    const oldPolicy = await backupStore.getPolicy(id);
    if (oldPolicy) {
        await removeTimerUnits(oldPolicy.name);
        await deleteScript(oldPolicy.name);
    }

    await backupStore.updatePolicy(id, name, type, mode, target, credentials, database, storageId, schedule, retention);
    const policy = await backupStore.getPolicy(id);
    if (!policy) throw new Error("Policy not found");
    const storage = await backupStore.getStorage(storageId);
    if (!storage) throw new Error("Storage not found");

    await saveRcloneConfig(storage);
    await writeScript(policy, storage);
    await createTimerUnits(policy);
}

export async function deletePolicy(id: string): Promise<void> {
    const policy = await backupStore.getPolicy(id);
    if (policy) {
        await removeTimerUnits(policy.name);
        await deleteScript(policy.name);
    }
    await backupStore.deletePolicy(id);
}

export async function togglePolicy(id: string, enabled: boolean): Promise<void> {
    const policy = await backupStore.getPolicy(id);
    await backupStore.togglePolicy(id, enabled);
    if (policy) {
        await toggleTimerUnit(policy.name, enabled);
    }
}

// ── Run state tracking ───────────────────────────────────────

const runningPolicies = new Set<string>();
const restoringBackups = new Set<string>();

export function isRunning(policyId: string): boolean {
    return runningPolicies.has(policyId);
}

export function getRunningPolicies(): string[] {
    return [...runningPolicies];
}

export function getRestoringBackups(): string[] {
    return [...restoringBackups];
}

// ── SSE pub/sub ─────────────────────────────────────────────

export type BackupEvent =
    | { type: "started"; policyId: string }
    | { type: "progress"; policyId: string; phase: string }
    | { type: "finished"; policyId: string; status: "success" | "error" }
    | { type: "restore-started"; historyId: string }
    | { type: "restore-progress"; historyId: string; phase: string }
    | { type: "restore-finished"; historyId: string; status: "success" | "error" };

type BackupEventListener = (event: BackupEvent) => void;
const listeners = new Set<BackupEventListener>();

export function subscribe(fn: BackupEventListener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}

function emit(event: BackupEvent): void {
    for (const fn of listeners) fn(event);
}

/** Called by scripts via POST /api/backups/notify */
export async function handleScriptNotify(policyId: string, phase: string, file?: string, size?: number): Promise<void> {
    if (phase === "started") {
        runningPolicies.add(policyId);
        const policy = await backupStore.getPolicy(policyId);
        if (policy) {
            const remotePath = `backups/${safeName(policy.name)}`;
            const historyId = await backupStore.addHistory(policyId, policy.name, remotePath);
            activeHistoryIds.set(policyId, historyId);
        }
        emit({ type: "started", policyId });
    } else if (phase.startsWith("finished:")) {
        const status = phase.split(":")[1] as "success" | "error";
        runningPolicies.delete(policyId);
        await backupStore.updatePolicyStatus(policyId, status);

        const historyId = activeHistoryIds.get(policyId);
        if (historyId) {
            if (status === "success") {
                const policy = await backupStore.getPolicy(policyId);
                const remotePath = file
                    ? `backups/${safeName(policy?.name ?? "unknown")}/${file}`
                    : `backups/${safeName(policy?.name ?? "unknown")}`;
                await backupStore.updateHistoryComplete(historyId, size ?? 0, remotePath);
                // Prune old backups
                if (policy && policy.mode === "copy" && policy.retention > 0) {
                    const excess = await backupStore.pruneHistory(policyId, policy.retention);
                    const storage = await backupStore.getStorage(policy.storageId);
                    if (storage) {
                        for (const old of excess) {
                            await deleteRemoteFile(storage, old.remotePath).catch(() => {});
                        }
                    }
                }
            } else {
                await backupStore.updateHistoryError(historyId, phase.split(":").slice(2).join(":") || "Backup failed");
            }
            activeHistoryIds.delete(policyId);
        }

        emit({ type: "finished", policyId, status });
    } else {
        if (!runningPolicies.has(policyId)) runningPolicies.add(policyId);
        emit({ type: "progress", policyId, phase });
    }
}

// Track active history entries per running policy
const activeHistoryIds = new Map<string, string>();

/** Run Now — starts the systemd service unit */
export async function runBackup(policyId: string): Promise<void> {
    if (runningPolicies.has(policyId)) throw new Error("Backup already running for this policy");
    const policy = await backupStore.getPolicy(policyId);
    if (!policy) throw new Error("Policy not found");

    const sName = serviceUnitName(policy.name);
    const { startService } = await import("../systemd/systemd.service.js");
    await startService(sName);
}

// ── Restore ──────────────────────────────────────────────────

export async function restoreBackup(historyId: string): Promise<void> {
    if (restoringBackups.has(historyId)) throw new Error("Restore already in progress");

    const history = await backupStore.getHistory(historyId);
    if (!history) throw new Error("Backup not found");

    const policy = await backupStore.getPolicy(history.policyId);
    if (!policy) throw new Error("Policy not found");

    const storage = await backupStore.getStorage(policy.storageId);
    if (!storage) throw new Error("Storage not found");

    restoringBackups.add(historyId);
    emit({ type: "restore-started", historyId });

    if (policy.mode === "sync") {
        try {
            const mountpoint = await getVolumeMountpoint(policy.target);
            emit({ type: "restore-progress", historyId, phase: "Downloading…" });
            await withRcloneConfig(storage, async (configPath) => {
                await rcloneWithProgress(
                    ["--config", configPath, "copy", `remote:${storage.bucket}/${history.remotePath}/`, mountpoint],
                    (phase) => emit({ type: "restore-progress", historyId, phase: `Downloading ${phase}` }),
                );
            });
            emit({ type: "restore-finished", historyId, status: "success" });
        } catch (err) {
            emit({ type: "restore-finished", historyId, status: "error" });
            throw err;
        } finally {
            restoringBackups.delete(historyId);
        }
        return;
    }

    const filename = history.remotePath.split("/").pop()!;
    const tmpPath = join("/tmp", filename);

    try {
        emit({ type: "restore-progress", historyId, phase: "Downloading…" });
        await withRcloneConfig(storage, async (configPath) => {
            await rcloneWithProgress(
                ["--config", configPath, "copyto", `remote:${storage.bucket}/${history.remotePath}`, tmpPath],
                (phase) => emit({ type: "restore-progress", historyId, phase: `Downloading ${phase}` }),
            );
        });

        emit({ type: "restore-progress", historyId, phase: "Restoring…" });
        switch (policy.type) {
            case "raw": {
                const tarPath = tmpPath.replace(/\.gz$/, "");
                await execFile("gunzip", ["-k", "-f", tmpPath], { timeout: 0 });
                await execFile("podman", ["volume", "import", policy.target, tarPath], { timeout: 0 });
                await unlink(tarPath).catch(() => {});
                break;
            }

            case "mongodb": {
                const mongoArgs = ["exec", "-i", policy.target, "mongorestore", "--archive", "--gzip", "--drop"];
                if (policy.credentials) {
                    const parts = policy.credentials.split(":");
                    mongoArgs.push("--username", parts[0] ?? "", "--password", parts.slice(1).join(":"), "--authenticationDatabase", "admin");
                }
                await spawnWithStdin("podman", mongoArgs, tmpPath);
                break;
            }

            case "postgresql": {
                const pgUser = policy.credentials?.split(":")[0] ?? "postgres";
                const pgPass = policy.credentials?.split(":")[1];
                const db = policy.database ?? "postgres";
                const pgArgs = ["exec", "-i"];
                if (pgPass) pgArgs.push("-e", `PGPASSWORD=${pgPass}`);
                pgArgs.push(policy.target, "pg_restore", "-U", pgUser, "--clean", "-d", db);
                await spawnWithStdin("podman", pgArgs, tmpPath);
                break;
            }

            case "mysql": {
                const myUser = policy.credentials?.split(":")[0] ?? "root";
                const myPass = policy.credentials?.split(":")[1];
                const myArgs = ["exec", "-i", policy.target, "mysql", "-u", myUser];
                if (myPass) myArgs.push(`-p${myPass}`);
                await spawnWithStdin("podman", myArgs, tmpPath);
                break;
            }

            case "redis":
                await execFile("podman", ["cp", tmpPath, `${policy.target}:/data/dump.rdb`], { timeout: 60_000 });
                await execFile("podman", ["exec", policy.target, "redis-cli", "shutdown", "nosave"], { timeout: 10_000 }).catch(() => {});
                break;
        }
        emit({ type: "restore-finished", historyId, status: "success" });
    } catch (err) {
        emit({ type: "restore-finished", historyId, status: "error" });
        throw err;
    } finally {
        restoringBackups.delete(historyId);
        await unlink(tmpPath).catch(() => {});
    }
}

// ── Remote file operations ───────────────────────────────────

async function deleteRemoteFile(storage: Storage, remotePath: string): Promise<void> {
    await withRcloneConfig(storage, async (configPath) => {
        await execFile("rclone", [
            "--config", configPath,
            "deletefile", `remote:${storage.bucket}/${remotePath}`,
        ], { timeout: 30_000 });
    });
}

export async function deleteBackup(historyId: string): Promise<void> {
    const history = await backupStore.getHistory(historyId);
    if (!history) throw new Error("Backup not found");

    if (history.status === "success") {
        const policy = await backupStore.getPolicy(history.policyId);
        const storage = policy ? await backupStore.getStorage(policy.storageId) : undefined;

        if (storage && history.remotePath) {
            await deleteRemoteFile(storage, history.remotePath).catch(() => {});
        }
    }

    await backupStore.deleteHistory(historyId);
}

/** Regenerate all scripts and rclone configs (e.g. after storage update) */
export async function regenerateForStorage(storageId: string): Promise<void> {
    const storage = await backupStore.getStorage(storageId);
    if (!storage) return;

    await saveRcloneConfig(storage);
    const policies = await backupStore.listPolicies();
    const filtered = policies.filter((p) => p.storageId === storageId);
    for (const policy of filtered) {
        await writeScript(policy, storage);
    }
}
