import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { MetricPoint, TimeRange } from "./metrics.types.js";

type Listener = (containerId: string, point: MetricPoint) => void;

// Layer config: name, interval (seconds), retention (seconds)
const LAYERS = [
    { name: "raw",   interval: 5,     retention: 3600 },      // 5s, keep 1h
    { name: "m1",    interval: 60,    retention: 86400 },      // 1min, keep 24h
    { name: "m5",    interval: 300,   retention: 604800 },     // 5min, keep 7d
    { name: "m30",   interval: 1800,  retention: 7776000 },    // 30min, keep 90d
    { name: "daily", interval: 86400, retention: 31536000 },   // 1day, keep 1y
] as const;

type LayerName = (typeof LAYERS)[number]["name"];

const RANGE_TO_LAYER: Record<TimeRange, LayerName> = {
    "1h":  "raw",
    "24h": "m1",
    "7d":  "m5",
    "30d": "m30",
    "1y":  "daily",
};

export class MetricsStore {
    private db: Database.Database;
    private listeners: Listener[] = [];
    private insertStmt: Database.Statement;
    private lastRollup = 0;

    constructor(dataDir?: string) {
        const dir = dataDir ?? join(process.cwd(), ".data");
        mkdirSync(dir, { recursive: true });

        const dbPath = join(dir, "metrics.db");
        this.db = new Database(dbPath);

        this.db.pragma("journal_mode = WAL");
        this.db.pragma("synchronous = NORMAL");

        this.createTables();
        this.insertStmt = this.db.prepare(`
            INSERT INTO metrics (container_id, layer, ts, cpu, mem, mem_limit, net_in, net_out, block_in, block_out)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
    }

    private createTables(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS metrics (
                container_id TEXT NOT NULL,
                layer        TEXT NOT NULL,
                ts           INTEGER NOT NULL,
                cpu          REAL NOT NULL,
                mem          REAL NOT NULL,
                mem_limit    REAL NOT NULL,
                net_in       REAL NOT NULL,
                net_out      REAL NOT NULL,
                block_in     REAL NOT NULL,
                block_out    REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_metrics_lookup
                ON metrics (container_id, layer, ts);
        `);
    }

    push(containerId: string, point: MetricPoint): void {
        this.insertStmt.run(
            containerId, "raw", point.ts,
            point.cpu, point.mem, point.memLimit,
            point.netIn, point.netOut, point.blockIn, point.blockOut,
        );

        // Rollup + prune every 60s
        const now = point.ts;
        if (now - this.lastRollup >= 60) {
            this.rollup();
            this.prune(now);
            this.lastRollup = now;
        }

        for (const fn of this.listeners) {
            fn(containerId, point);
        }
    }

    private rollup(): void {
        const rollupFn = this.db.transaction(() => {
            for (let i = 0; i < LAYERS.length - 1; i++) {
                const source = LAYERS[i]!;
                const target = LAYERS[i + 1]!;

                // Find source rows not yet aggregated into target
                const rows = this.db.prepare(`
                    SELECT container_id,
                           (ts / ?) * ? AS bucket_ts,
                           AVG(cpu) AS cpu, AVG(mem) AS mem,
                           MAX(mem_limit) AS mem_limit,
                           AVG(net_in) AS net_in, AVG(net_out) AS net_out,
                           AVG(block_in) AS block_in, AVG(block_out) AS block_out,
                           COUNT(*) AS cnt
                    FROM metrics
                    WHERE layer = ?
                      AND ts > COALESCE(
                          (SELECT MAX(ts) FROM metrics WHERE layer = ? AND container_id = metrics.container_id),
                          0
                      )
                    GROUP BY container_id, bucket_ts
                    HAVING cnt >= ?
                `).all(
                    target.interval, target.interval,
                    source.name,
                    target.name,
                    Math.floor(target.interval / source.interval * 0.8), // 80% threshold
                ) as Array<{
                    container_id: string; bucket_ts: number;
                    cpu: number; mem: number; mem_limit: number;
                    net_in: number; net_out: number; block_in: number; block_out: number;
                }>;

                for (const r of rows) {
                    this.insertStmt.run(
                        r.container_id, target.name, r.bucket_ts,
                        r.cpu, r.mem, r.mem_limit,
                        r.net_in, r.net_out, r.block_in, r.block_out,
                    );
                }
            }
        });

        rollupFn();
    }

    private prune(now: number): void {
        const stmt = this.db.prepare(
            `DELETE FROM metrics WHERE layer = ? AND ts < ?`
        );

        const pruneFn = this.db.transaction(() => {
            for (const layer of LAYERS) {
                stmt.run(layer.name, now - layer.retention);
            }
        });

        pruneFn();
    }

    query(containerId: string, range: TimeRange): MetricPoint[] {
        const layer = RANGE_TO_LAYER[range];
        const retention = LAYERS.find((l) => l.name === layer)!.retention;
        const since = Math.floor(Date.now() / 1000) - retention;

        const rows = this.db.prepare(`
            SELECT ts, cpu, mem, mem_limit, net_in, net_out, block_in, block_out
            FROM metrics
            WHERE container_id = ? OR container_id LIKE ?
            AND layer = ?
            AND ts > ?
            ORDER BY ts ASC
        `).all(containerId, `${containerId}%`, layer, since) as Array<{
            ts: number; cpu: number; mem: number; mem_limit: number;
            net_in: number; net_out: number; block_in: number; block_out: number;
        }>;

        return rows.map((r) => ({
            ts: r.ts,
            cpu: r.cpu,
            mem: r.mem,
            memLimit: r.mem_limit,
            netIn: r.net_in,
            netOut: r.net_out,
            blockIn: r.block_in,
            blockOut: r.block_out,
        }));
    }

    /** Latest raw point per container */
    latestAll(): Record<string, MetricPoint> {
        const rows = this.db.prepare(`
            SELECT container_id, ts, cpu, mem, mem_limit, net_in, net_out, block_in, block_out
            FROM metrics m1
            WHERE layer = 'raw'
              AND ts = (SELECT MAX(ts) FROM metrics m2 WHERE m2.container_id = m1.container_id AND m2.layer = 'raw')
        `).all() as Array<{
            container_id: string; ts: number; cpu: number; mem: number; mem_limit: number;
            net_in: number; net_out: number; block_in: number; block_out: number;
        }>;

        const result: Record<string, MetricPoint> = {};
        for (const r of rows) {
            result[r.container_id] = {
                ts: r.ts, cpu: r.cpu, mem: r.mem, memLimit: r.mem_limit,
                netIn: r.net_in, netOut: r.net_out, blockIn: r.block_in, blockOut: r.block_out,
            };
        }
        return result;
    }

    subscribe(fn: Listener): () => void {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== fn);
        };
    }

    /** Remove metrics for containers that no longer exist */
    purgeContainers(activeIds: Set<string>): number {
        const storedIds = this.db.prepare(
            `SELECT DISTINCT container_id FROM metrics`
        ).pluck().all() as string[];

        const toDelete = storedIds.filter((id) => !activeIds.has(id));
        if (toDelete.length === 0) return 0;

        const deleteFn = this.db.transaction(() => {
            const stmt = this.db.prepare(
                `DELETE FROM metrics WHERE container_id = ?`
            );
            for (const id of toDelete) {
                stmt.run(id);
            }
        });

        deleteFn();
        return toDelete.length;
    }

    close(): void {
        this.db.close();
    }
}
