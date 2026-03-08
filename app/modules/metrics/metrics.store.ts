import Datastore, { type Document } from "@seald-io/nedb";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
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

interface MetricDoc {
    containerId: string;
    layer: string;
    ts: number;
    cpu: number;
    mem: number;
    memLimit: number;
    netIn: number;
    netOut: number;
    blockIn: number;
    blockOut: number;
}

export class MetricsStore {
    private db: Datastore<MetricDoc>;
    private listeners: Listener[] = [];
    private lastRollup = 0;

    constructor(dataDir?: string) {
        const dir = dataDir ?? join(process.cwd(), ".data", "metrics");
        mkdirSync(dir, { recursive: true });

        this.db = new Datastore<MetricDoc>({
            filename: join(dir, "metrics.db"),
            autoload: true,
        });

        this.db.ensureIndex({ fieldName: "containerId" });
        this.db.ensureIndex({ fieldName: "layer" });
        this.db.ensureIndex({ fieldName: "ts" });

        // Compact every 10 minutes (metrics generates lots of appends)
        this.db.setAutocompactionInterval(600_000);
    }

    push(containerId: string, point: MetricPoint): void {
        this.db.insertAsync({
            containerId, layer: "raw", ts: point.ts,
            cpu: point.cpu, mem: point.mem, memLimit: point.memLimit,
            netIn: point.netIn, netOut: point.netOut,
            blockIn: point.blockIn, blockOut: point.blockOut,
        }).catch(() => {});

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

    private async rollup(): Promise<void> {
        for (let i = 0; i < LAYERS.length - 1; i++) {
            const source = LAYERS[i]!;
            const target = LAYERS[i + 1]!;

            // Get the latest timestamp in the target layer per container
            const targetDocs = await this.db.findAsync({ layer: target.name }) as unknown as Document<MetricDoc>[];
            const latestByContainer = new Map<string, number>();
            for (const doc of targetDocs) {
                const cur = latestByContainer.get(doc.containerId) ?? 0;
                if (doc.ts > cur) latestByContainer.set(doc.containerId, doc.ts);
            }

            // Get source rows newer than latest target
            const sourceDocs = await this.db.findAsync({ layer: source.name }) as unknown as Document<MetricDoc>[];

            // Group by container + bucket
            const buckets = new Map<string, MetricDoc[]>();
            for (const doc of sourceDocs) {
                const latest = latestByContainer.get(doc.containerId) ?? 0;
                if (doc.ts <= latest) continue;

                const bucketTs = Math.floor(doc.ts / target.interval) * target.interval;
                const key = `${doc.containerId}:${bucketTs}`;
                const list = buckets.get(key) ?? [];
                list.push(doc);
                buckets.set(key, list);
            }

            const threshold = Math.floor(target.interval / source.interval * 0.8);

            for (const [key, docs] of buckets) {
                if (docs.length < threshold) continue;
                const [containerId, bucketTsStr] = key.split(":");
                const bucketTs = Number(bucketTsStr);

                const avg = (fn: (d: MetricDoc) => number) =>
                    docs.reduce((sum, d) => sum + fn(d), 0) / docs.length;
                const max = (fn: (d: MetricDoc) => number) =>
                    docs.reduce((m, d) => Math.max(m, fn(d)), 0);

                await this.db.insertAsync({
                    containerId: containerId!,
                    layer: target.name,
                    ts: bucketTs,
                    cpu: avg((d) => d.cpu),
                    mem: avg((d) => d.mem),
                    memLimit: max((d) => d.memLimit),
                    netIn: avg((d) => d.netIn),
                    netOut: avg((d) => d.netOut),
                    blockIn: avg((d) => d.blockIn),
                    blockOut: avg((d) => d.blockOut),
                });
            }
        }
    }

    private async prune(now: number): Promise<void> {
        for (const layer of LAYERS) {
            await this.db.removeAsync(
                { layer: layer.name, ts: { $lt: now - layer.retention } },
                { multi: true },
            );
        }
    }

    async query(containerId: string, range: TimeRange): Promise<MetricPoint[]> {
        const layer = RANGE_TO_LAYER[range];
        const retention = LAYERS.find((l) => l.name === layer)!.retention;
        const since = Math.floor(Date.now() / 1000) - retention;

        const docs = await this.db.findAsync({
            $or: [
                { containerId },
                { containerId: { $regex: new RegExp(`^${containerId}`) } },
            ],
            layer,
            ts: { $gt: since },
        }).sort({ ts: 1 }) as unknown as Document<MetricDoc>[];

        return docs.map((d) => ({
            ts: d.ts, cpu: d.cpu, mem: d.mem, memLimit: d.memLimit,
            netIn: d.netIn, netOut: d.netOut, blockIn: d.blockIn, blockOut: d.blockOut,
        }));
    }

    latestAll(): Record<string, MetricPoint> {
        // Use synchronous getAllData for real-time dashboard
        const allDocs = this.db.getAllData() as unknown as Document<MetricDoc>[];
        const rawDocs = allDocs.filter((d) => d.layer === "raw");

        const result: Record<string, MetricPoint> = {};
        for (const d of rawDocs) {
            const existing = result[d.containerId];
            if (!existing || d.ts > existing.ts) {
                result[d.containerId] = {
                    ts: d.ts, cpu: d.cpu, mem: d.mem, memLimit: d.memLimit,
                    netIn: d.netIn, netOut: d.netOut, blockIn: d.blockIn, blockOut: d.blockOut,
                };
            }
        }
        return result;
    }

    subscribe(fn: Listener): () => void {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== fn);
        };
    }

    async purgeContainers(activeIds: Set<string>): Promise<number> {
        const allDocs = this.db.getAllData() as unknown as Document<MetricDoc>[];
        const storedIds = new Set(allDocs.map((d) => d.containerId));

        const toDelete = [...storedIds].filter((id) => !activeIds.has(id));
        if (toDelete.length === 0) return 0;

        for (const id of toDelete) {
            await this.db.removeAsync({ containerId: id }, { multi: true });
        }
        return toDelete.length;
    }

    close(): void {
        this.db.stopAutocompaction();
    }
}
