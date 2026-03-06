import { execFile as execFileCb, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream } from "node:fs";
import { writeFile, unlink, stat, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { backupStore } from "./backup.store.js";
import type { Storage, BackupType } from "./backup.types.js";

const execFile = promisify(execFileCb);

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

// ── Rclone config helper ─────────────────────────────────────

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

// ── Backup execution ─────────────────────────────────────────

function backupFilename(policyName: string, type: BackupType): string {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = policyName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const ext = type === "postgresql" ? "dump" : type === "mysql" ? "sql" : type === "redis" ? "rdb" : "gz";
    return `${safeName}-${ts}.${ext}`;
}

async function dumpRaw(volumeName: string): Promise<string> {
    const filename = backupFilename(volumeName, "raw");
    const tmpPath = join("/tmp", filename);

    const tarPath = tmpPath.replace(/\.gz$/, "");
    await execFile("podman", [
        "volume", "export", volumeName, "--output", tarPath,
    ], { timeout: 0 });

    await execFile("gzip", ["-f", tarPath], { timeout: 0 });
    await rename(`${tarPath}.gz`, tmpPath).catch(() => {});

    return tmpPath;
}

async function dumpMongodb(container: string, credentials: string | null): Promise<string> {
    const filename = backupFilename(container, "mongodb");
    const tmpPath = join("/tmp", filename);

    const args = ["exec", container, "mongodump", "--archive", "--gzip"];
    if (credentials) {
        const parts = credentials.split(":");
        args.push("--username", parts[0] ?? "", "--password", parts.slice(1).join(":"), "--authenticationDatabase", "admin");
    }

    const { stdout } = await execFile("podman", args, {
        timeout: 0,
        encoding: "buffer",
        maxBuffer: 1024 * 1024 * 1024,
    });

    await writeFile(tmpPath, stdout);
    return tmpPath;
}

async function dumpPostgresql(container: string, credentials: string | null, database: string | null): Promise<string> {
    const filename = backupFilename(container, "postgresql");
    const tmpPath = join("/tmp", filename);

    const user = credentials?.split(":")[0] ?? "postgres";
    const pass = credentials?.split(":")[1];
    const db = database ?? "postgres";

    const args = ["exec"];
    if (pass) args.push("-e", `PGPASSWORD=${pass}`);
    args.push(container, "pg_dump", "-U", user, "-Fc", db);

    const { stdout } = await execFile("podman", args, {
        timeout: 0,
        encoding: "buffer",
        maxBuffer: 1024 * 1024 * 1024,
    });

    await writeFile(tmpPath, stdout);
    return tmpPath;
}

async function dumpMysql(container: string, credentials: string | null): Promise<string> {
    const filename = backupFilename(container, "mysql");
    const tmpPath = join("/tmp", filename);

    const user = credentials?.split(":")[0] ?? "root";
    const pass = credentials?.split(":")[1];

    const args = ["exec", container, "mysqldump", "-u", user];
    if (pass) args.push(`-p${pass}`);
    args.push("--all-databases");

    const { stdout } = await execFile("podman", args, {
        timeout: 0,
        encoding: "buffer",
        maxBuffer: 1024 * 1024 * 1024,
    });

    await writeFile(tmpPath, stdout);
    return tmpPath;
}

async function dumpRedis(container: string): Promise<string> {
    const filename = backupFilename(container, "redis");
    const tmpPath = join("/tmp", filename);

    await execFile("podman", ["exec", container, "redis-cli", "bgsave"], { timeout: 30_000 });
    // Wait for save to complete
    await new Promise((r) => setTimeout(r, 2000));

    await execFile("podman", ["cp", `${container}:/data/dump.rdb`, tmpPath], { timeout: 60_000 });
    return tmpPath;
}

async function createDump(type: BackupType, target: string, credentials: string | null, database: string | null): Promise<string> {
    switch (type) {
        case "raw": return dumpRaw(target);
        case "mongodb": return dumpMongodb(target, credentials);
        case "postgresql": return dumpPostgresql(target, credentials, database);
        case "mysql": return dumpMysql(target, credentials);
        case "redis": return dumpRedis(target);
    }
}

const runningPolicies = new Set<number>();
const restoringBackups = new Set<number>();

export function isRunning(policyId: number): boolean {
    return runningPolicies.has(policyId);
}

export function getRunningPolicies(): number[] {
    return [...runningPolicies];
}

export function getRestoringBackups(): number[] {
    return [...restoringBackups];
}

// ── SSE pub/sub ─────────────────────────────────────────────

export type BackupEvent =
    | { type: "started"; policyId: number }
    | { type: "progress"; policyId: number; phase: string }
    | { type: "finished"; policyId: number; status: "success" | "error" }
    | { type: "restore-started"; historyId: number }
    | { type: "restore-progress"; historyId: number; phase: string }
    | { type: "restore-finished"; historyId: number; status: "success" | "error" };

type BackupEventListener = (event: BackupEvent) => void;
const listeners = new Set<BackupEventListener>();

export function subscribe(fn: BackupEventListener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}

function emit(event: BackupEvent): void {
    for (const fn of listeners) fn(event);
}

export async function runBackup(policyId: number): Promise<void> {
    if (runningPolicies.has(policyId)) throw new Error("Backup already running for this policy");
    const policy = backupStore.getPolicy(policyId);
    if (!policy) throw new Error("Policy not found");

    const storage = backupStore.getStorage(policy.storageId);
    if (!storage) throw new Error("Storage not found");

    runningPolicies.add(policyId);
    emit({ type: "started", policyId });
    const remotePath = `backups/${policy.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const historyId = backupStore.addHistory(policyId, policy.name, remotePath);

    let tmpPath: string | null = null;

    try {
        // 1. Create dump
        emit({ type: "progress", policyId, phase: "Dumping data…" });
        tmpPath = await createDump(policy.type, policy.target, policy.credentials, policy.database);

        // 2. Get file size
        const fileStat = await stat(tmpPath);
        const size = fileStat.size;

        // 3. Upload to remote
        emit({ type: "progress", policyId, phase: "Uploading…" });
        const filename = tmpPath.split("/").pop()!;
        await withRcloneConfig(storage, async (configPath) => {
            await rcloneWithProgress(
                ["--config", configPath, "copy", tmpPath!, `remote:${storage.bucket}/${remotePath}/`],
                (phase) => emit({ type: "progress", policyId, phase: `Uploading ${phase}` }),
            );
        });

        // 4. Update history + policy status
        const fullRemotePath = `${remotePath}/${filename}`;
        backupStore.updateHistoryComplete(historyId, size, fullRemotePath);
        backupStore.updatePolicyStatus(policyId, "success");

        // 5. Prune old backups
        const excess = backupStore.pruneHistory(policyId, policy.retention);
        for (const old of excess) {
            await deleteRemoteFile(storage, old.remotePath).catch(() => {});
        }
        emit({ type: "finished", policyId, status: "success" });
    } catch (err) {
        backupStore.updateHistoryError(historyId, (err as Error).message);
        backupStore.updatePolicyStatus(policyId, "error");
        emit({ type: "finished", policyId, status: "error" });
    } finally {
        runningPolicies.delete(policyId);
        if (tmpPath) await unlink(tmpPath).catch(() => {});
    }
}

// ── Restore ──────────────────────────────────────────────────

export async function restoreBackup(historyId: number): Promise<void> {
    if (restoringBackups.has(historyId)) throw new Error("Restore already in progress");

    const history = backupStore.getHistory(historyId);
    if (!history) throw new Error("Backup not found");

    const policy = backupStore.getPolicy(history.policyId);
    if (!policy) throw new Error("Policy not found");

    const storage = backupStore.getStorage(policy.storageId);
    if (!storage) throw new Error("Storage not found");

    restoringBackups.add(historyId);
    emit({ type: "restore-started", historyId });

    const filename = history.remotePath.split("/").pop()!;
    const tmpPath = join("/tmp", filename);

    try {
        // 1. Download from remote
        emit({ type: "restore-progress", historyId, phase: "Downloading…" });
        await withRcloneConfig(storage, async (configPath) => {
            await rcloneWithProgress(
                ["--config", configPath, "copy", `remote:${storage.bucket}/${history.remotePath}`, "/tmp/"],
                (phase) => emit({ type: "restore-progress", historyId, phase: `Downloading ${phase}` }),
            );
        });

        // 2. Restore based on type
        emit({ type: "restore-progress", historyId, phase: "Restoring…" });
        switch (policy.type) {
            case "raw": {
                // Decompress .gz → .tar, then import
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
                // systemd will restart the container and Redis loads the dump
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

export async function deleteBackup(historyId: number): Promise<void> {
    const history = backupStore.getHistory(historyId);
    if (!history) throw new Error("Backup not found");

    // Only try to delete from remote if backup succeeded (file exists remotely)
    if (history.status === "success") {
        const policy = backupStore.getPolicy(history.policyId);
        const storage = policy ? backupStore.getStorage(policy.storageId) : undefined;

        if (storage && history.remotePath) {
            await deleteRemoteFile(storage, history.remotePath);
        }
    }

    backupStore.deleteHistory(historyId);
}

// ── Scheduler ────────────────────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
    if (schedulerInterval) return;

    schedulerInterval = setInterval(async () => {
        try {
            const due = backupStore.getDuePolicies().filter((p) => !runningPolicies.has(p.id));
            for (const policy of due) {
                await runBackup(policy.id).catch((err) => {
                    console.error(`[backup] Failed to run policy "${policy.name}":`, err.message);
                });
            }
        } catch (err) {
            console.error("[backup] Scheduler error:", (err as Error).message);
        }
    }, 60_000);
}

export function stopScheduler(): void {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
}
