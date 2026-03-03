import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ProxyConfig, DomainMapping, SslMode, TargetType } from "./proxy.types.js";

export class ProxyStore {
    private db: Database.Database;

    constructor(dataDir?: string) {
        const dir = dataDir ?? join(process.cwd(), ".data");
        mkdirSync(dir, { recursive: true });

        const dbPath = join(dir, "proxy.db");
        this.db = new Database(dbPath);

        this.db.pragma("journal_mode = WAL");
        this.db.pragma("synchronous = NORMAL");

        this.createTables();
        this.migrate();
    }

    private createTables(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS proxy_config (
                id          INTEGER PRIMARY KEY CHECK (id = 1),
                enabled     INTEGER NOT NULL DEFAULT 0,
                ssl_mode    TEXT NOT NULL DEFAULT 'none',
                cert_path   TEXT,
                key_path    TEXT
            );

            INSERT OR IGNORE INTO proxy_config (id, enabled, ssl_mode) VALUES (1, 0, 'none');

            CREATE TABLE IF NOT EXISTS domains (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                domain          TEXT NOT NULL UNIQUE,
                container_name  TEXT NOT NULL,
                container_port  INTEGER NOT NULL,
                enabled         INTEGER NOT NULL DEFAULT 1
            );
        `);
    }

    private migrate(): void {
        const columns = this.db
            .pragma("table_info(domains)") as Array<{ name: string }>;
        const colNames = new Set(columns.map((c) => c.name));

        if (!colNames.has("target_type")) {
            this.db.exec(`ALTER TABLE domains ADD COLUMN target_type TEXT NOT NULL DEFAULT 'container'`);
        }
        if (!colNames.has("tls")) {
            this.db.exec(`ALTER TABLE domains ADD COLUMN tls INTEGER NOT NULL DEFAULT 1`);
        }
        if (!colNames.has("backend_https")) {
            this.db.exec(`ALTER TABLE domains ADD COLUMN backend_https INTEGER NOT NULL DEFAULT 0`);
        }
    }

    getConfig(): ProxyConfig {
        const row = this.db.prepare(
            `SELECT enabled, ssl_mode, cert_path, key_path FROM proxy_config WHERE id = 1`
        ).get() as {
            enabled: number;
            ssl_mode: SslMode;
            cert_path: string | null;
            key_path: string | null;
        };

        return {
            enabled: row.enabled === 1,
            sslMode: row.ssl_mode,
            certPath: row.cert_path,
            keyPath: row.key_path,
        };
    }

    upsertConfig(sslMode: SslMode, certPath?: string | null, keyPath?: string | null): void {
        this.db.prepare(`
            UPDATE proxy_config SET ssl_mode = ?, cert_path = ?, key_path = ? WHERE id = 1
        `).run(sslMode, certPath ?? null, keyPath ?? null);
    }

    setEnabled(enabled: boolean): void {
        this.db.prepare(
            `UPDATE proxy_config SET enabled = ? WHERE id = 1`
        ).run(enabled ? 1 : 0);
    }

    listDomains(): DomainMapping[] {
        const rows = this.db.prepare(
            `SELECT id, domain, container_name, container_port, enabled, target_type, tls, backend_https FROM domains ORDER BY domain`
        ).all() as Array<{
            id: number;
            domain: string;
            container_name: string;
            container_port: number;
            enabled: number;
            target_type: TargetType;
            tls: number;
            backend_https: number;
        }>;

        return rows.map((r) => ({
            id: r.id,
            domain: r.domain,
            containerName: r.container_name,
            containerPort: r.container_port,
            enabled: r.enabled === 1,
            targetType: r.target_type,
            tls: r.tls === 1,
            backendHttps: r.backend_https === 1,
        }));
    }

    addDomain(
        domain: string,
        containerName: string,
        containerPort: number,
        targetType: TargetType = "container",
        tls: boolean = true,
        backendHttps: boolean = false,
    ): DomainMapping {
        const result = this.db.prepare(`
            INSERT INTO domains (domain, container_name, container_port, enabled, target_type, tls, backend_https)
            VALUES (?, ?, ?, 1, ?, ?, ?)
        `).run(domain, containerName, containerPort, targetType, tls ? 1 : 0, backendHttps ? 1 : 0);

        return {
            id: Number(result.lastInsertRowid),
            domain,
            containerName,
            containerPort,
            enabled: true,
            targetType,
            tls,
            backendHttps,
        };
    }

    updateDomain(
        id: number,
        domain: string,
        containerName: string,
        containerPort: number,
        targetType: TargetType = "container",
        tls: boolean = true,
        backendHttps: boolean = false,
    ): void {
        this.db.prepare(`
            UPDATE domains SET domain = ?, container_name = ?, container_port = ?, target_type = ?, tls = ?, backend_https = ? WHERE id = ?
        `).run(domain, containerName, containerPort, targetType, tls ? 1 : 0, backendHttps ? 1 : 0, id);
    }

    deleteDomain(id: number): void {
        this.db.prepare(`DELETE FROM domains WHERE id = ?`).run(id);
    }

    toggleDomain(id: number, enabled: boolean): void {
        this.db.prepare(`UPDATE domains SET enabled = ? WHERE id = ?`).run(enabled ? 1 : 0, id);
    }

    close(): void {
        this.db.close();
    }
}

export const proxyStore = new ProxyStore();
