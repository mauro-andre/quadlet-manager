import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Storage, Policy, BackupHistory, BackupType } from "./backup.types.js";

export class BackupStore {
    private db: Database.Database;

    constructor(dataDir?: string) {
        const dir = dataDir ?? join(process.cwd(), ".data");
        mkdirSync(dir, { recursive: true });

        const dbPath = join(dir, "backup.db");
        this.db = new Database(dbPath);

        this.db.pragma("journal_mode = WAL");
        this.db.pragma("synchronous = NORMAL");

        this.createTables();
        this.migrate();
    }

    private createTables(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS storages (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                endpoint    TEXT NOT NULL,
                bucket      TEXT NOT NULL,
                region      TEXT NOT NULL DEFAULT '',
                access_key  TEXT NOT NULL,
                secret_key  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS policies (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                type        TEXT NOT NULL,
                target      TEXT NOT NULL,
                credentials TEXT,
                database_name TEXT,
                storage_id  INTEGER NOT NULL REFERENCES storages(id),
                frequency   INTEGER NOT NULL,
                retention   INTEGER NOT NULL DEFAULT 24,
                enabled     INTEGER NOT NULL DEFAULT 1,
                last_run_at TEXT,
                last_status TEXT
            );

            CREATE TABLE IF NOT EXISTS backup_history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                policy_id   INTEGER NOT NULL REFERENCES policies(id),
                policy_name TEXT NOT NULL,
                timestamp   TEXT NOT NULL,
                size        INTEGER NOT NULL DEFAULT 0,
                status      TEXT NOT NULL,
                error       TEXT,
                remote_path TEXT NOT NULL
            );
        `);
    }

    private migrate(): void {
        // Future migrations go here
    }

    // ── Storages ─────────────────────────────────────────────────

    listStorages(): Storage[] {
        return this.db.prepare(
            `SELECT id, name, endpoint, bucket, region, access_key AS accessKey, secret_key AS secretKey FROM storages ORDER BY name`
        ).all() as Storage[];
    }

    getStorage(id: number): Storage | undefined {
        const row = this.db.prepare(
            `SELECT id, name, endpoint, bucket, region, access_key, secret_key FROM storages WHERE id = ?`
        ).get(id) as {
            id: number; name: string; endpoint: string; bucket: string;
            region: string; access_key: string; secret_key: string;
        } | undefined;

        if (!row) return undefined;
        return {
            id: row.id,
            name: row.name,
            endpoint: row.endpoint,
            bucket: row.bucket,
            region: row.region,
            accessKey: row.access_key,
            secretKey: row.secret_key,
        };
    }

    addStorage(name: string, endpoint: string, bucket: string, region: string, accessKey: string, secretKey: string): Storage {
        const result = this.db.prepare(`
            INSERT INTO storages (name, endpoint, bucket, region, access_key, secret_key)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(name, endpoint, bucket, region, accessKey, secretKey);

        return {
            id: Number(result.lastInsertRowid),
            name, endpoint, bucket, region, accessKey, secretKey,
        };
    }

    updateStorage(id: number, name: string, endpoint: string, bucket: string, region: string, accessKey: string, secretKey: string): void {
        this.db.prepare(`
            UPDATE storages SET name = ?, endpoint = ?, bucket = ?, region = ?, access_key = ?, secret_key = ? WHERE id = ?
        `).run(name, endpoint, bucket, region, accessKey, secretKey, id);
    }

    deleteStorage(id: number): void {
        this.db.prepare(`DELETE FROM storages WHERE id = ?`).run(id);
    }

    // ── Policies ─────────────────────────────────────────────────

    listPolicies(): Policy[] {
        const rows = this.db.prepare(`
            SELECT p.id, p.name, p.type, p.target, p.credentials, p.database_name,
                   p.storage_id, s.name as storage_name,
                   p.frequency, p.retention, p.enabled, p.last_run_at, p.last_status
            FROM policies p
            LEFT JOIN storages s ON s.id = p.storage_id
            ORDER BY p.name
        `).all() as Array<{
            id: number; name: string; type: BackupType; target: string;
            credentials: string | null; database_name: string | null;
            storage_id: number; storage_name: string | null;
            frequency: number; retention: number; enabled: number;
            last_run_at: string | null; last_status: string | null;
        }>;

        return rows.map((r) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            target: r.target,
            credentials: r.credentials,
            database: r.database_name,
            storageId: r.storage_id,
            storageName: r.storage_name ?? undefined,
            frequency: r.frequency,
            retention: r.retention,
            enabled: r.enabled === 1,
            lastRunAt: r.last_run_at,
            lastStatus: r.last_status as "success" | "error" | null,
        }));
    }

    getPolicy(id: number): Policy | undefined {
        const rows = this.listPolicies();
        return rows.find((p) => p.id === id);
    }

    addPolicy(
        name: string, type: BackupType, target: string,
        credentials: string | null, database: string | null,
        storageId: number, frequency: number, retention: number,
    ): void {
        this.db.prepare(`
            INSERT INTO policies (name, type, target, credentials, database_name, storage_id, frequency, retention)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(name, type, target, credentials, database, storageId, frequency, retention);
    }

    updatePolicy(
        id: number, name: string, type: BackupType, target: string,
        credentials: string | null, database: string | null,
        storageId: number, frequency: number, retention: number,
    ): void {
        this.db.prepare(`
            UPDATE policies SET name = ?, type = ?, target = ?, credentials = ?,
                   database_name = ?, storage_id = ?, frequency = ?, retention = ?
            WHERE id = ?
        `).run(name, type, target, credentials, database, storageId, frequency, retention, id);
    }

    deletePolicy(id: number): void {
        this.db.prepare(`DELETE FROM backup_history WHERE policy_id = ?`).run(id);
        this.db.prepare(`DELETE FROM policies WHERE id = ?`).run(id);
    }

    togglePolicy(id: number, enabled: boolean): void {
        this.db.prepare(`UPDATE policies SET enabled = ? WHERE id = ?`).run(enabled ? 1 : 0, id);
    }

    updatePolicyStatus(id: number, status: "success" | "error"): void {
        this.db.prepare(`
            UPDATE policies SET last_run_at = ?, last_status = ? WHERE id = ?
        `).run(new Date().toISOString(), status, id);
    }

    getDuePolicies(): Policy[] {
        const all = this.listPolicies().filter((p) => p.enabled);
        const now = Date.now();
        return all.filter((p) => {
            if (!p.lastRunAt) return true;
            const elapsed = (now - new Date(p.lastRunAt).getTime()) / 60_000;
            return elapsed >= p.frequency;
        });
    }

    // ── History ──────────────────────────────────────────────────

    listHistory(limit = 50): BackupHistory[] {
        return this.db.prepare(`
            SELECT id, policy_id AS policyId, policy_name AS policyName, timestamp,
                   size, status, error, remote_path AS remotePath
            FROM backup_history ORDER BY timestamp DESC LIMIT ?
        `).all(limit) as BackupHistory[];
    }

    listHistoryByPolicy(policyId: number): BackupHistory[] {
        return this.db.prepare(`
            SELECT id, policy_id AS policyId, policy_name AS policyName, timestamp,
                   size, status, error, remote_path AS remotePath
            FROM backup_history WHERE policy_id = ? ORDER BY timestamp DESC
        `).all(policyId) as BackupHistory[];
    }

    getHistory(id: number): BackupHistory | undefined {
        return this.db.prepare(`
            SELECT id, policy_id AS policyId, policy_name AS policyName, timestamp,
                   size, status, error, remote_path AS remotePath
            FROM backup_history WHERE id = ?
        `).get(id) as BackupHistory | undefined;
    }

    addHistory(policyId: number, policyName: string, remotePath: string): number {
        const result = this.db.prepare(`
            INSERT INTO backup_history (policy_id, policy_name, timestamp, size, status, remote_path)
            VALUES (?, ?, ?, 0, 'running', ?)
        `).run(policyId, policyName, new Date().toISOString(), remotePath);
        return Number(result.lastInsertRowid);
    }

    updateHistorySuccess(id: number, size: number): void {
        this.db.prepare(`
            UPDATE backup_history SET status = 'success', size = ? WHERE id = ?
        `).run(size, id);
    }

    updateHistoryComplete(id: number, size: number, remotePath: string): void {
        this.db.prepare(`
            UPDATE backup_history SET status = 'success', size = ?, remote_path = ? WHERE id = ?
        `).run(size, remotePath, id);
    }

    updateHistoryError(id: number, error: string): void {
        this.db.prepare(`
            UPDATE backup_history SET status = 'error', error = ? WHERE id = ?
        `).run(error, id);
    }

    deleteHistory(id: number): void {
        this.db.prepare(`DELETE FROM backup_history WHERE id = ?`).run(id);
    }

    pruneHistory(policyId: number, retention: number): BackupHistory[] {
        const excess = this.db.prepare(`
            SELECT id, policy_id AS policyId, policy_name AS policyName, timestamp,
                   size, status, error, remote_path AS remotePath
            FROM backup_history
            WHERE policy_id = ? AND status = 'success'
            ORDER BY timestamp DESC
            LIMIT -1 OFFSET ?
        `).all(policyId, retention) as BackupHistory[];

        if (excess.length > 0) {
            const ids = excess.map((e) => e.id);
            this.db.prepare(
                `DELETE FROM backup_history WHERE id IN (${ids.map(() => "?").join(",")})`
            ).run(...ids);
        }

        return excess;
    }

    /** Mark any stale "running" entries as error (e.g. after server restart) */
    cleanupStaleRunning(): void {
        this.db.prepare(`
            UPDATE backup_history SET status = 'error', error = 'Interrupted (server restart)'
            WHERE status = 'running'
        `).run();
    }

    close(): void {
        this.db.close();
    }
}

export const backupStore = new BackupStore();
backupStore.cleanupStaleRunning();
