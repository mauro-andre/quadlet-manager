import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { MetricPoint, ContainerMetrics, TimeRange } from "./metrics.types.js";

// Retention limits
const MAX_RAW = 360;       // 10s × 360 = 1 hour
const MAX_M1 = 1440;       // 1min × 1440 = 24 hours
const MAX_M5 = 2016;       // 5min × 2016 = 7 days
const MAX_M30 = 4320;      // 30min × 4320 = 90 days
const MAX_DAILY = 365;     // 1day × 365 = 1 year

// Rollup intervals in seconds
const INTERVAL_M1 = 60;
const INTERVAL_M5 = 300;
const INTERVAL_M30 = 1800;
const INTERVAL_DAILY = 86400;

type Listener = (containerId: string, point: MetricPoint) => void;

function average(points: MetricPoint[]): MetricPoint {
    const len = points.length;
    if (len === 0) throw new Error("Cannot average empty array");
    if (len === 1) return points[0]!;

    const sum = points.reduce(
        (acc, p) => ({
            ts: 0,
            cpu: acc.cpu + p.cpu,
            mem: acc.mem + p.mem,
            memLimit: p.memLimit,
            netIn: acc.netIn + p.netIn,
            netOut: acc.netOut + p.netOut,
            blockIn: acc.blockIn + p.blockIn,
            blockOut: acc.blockOut + p.blockOut,
        }),
        { ts: 0, cpu: 0, mem: 0, memLimit: 0, netIn: 0, netOut: 0, blockIn: 0, blockOut: 0 }
    );

    return {
        ts: points[len - 1]!.ts,
        cpu: sum.cpu / len,
        mem: sum.mem / len,
        memLimit: sum.memLimit,
        netIn: sum.netIn,
        netOut: sum.netOut,
        blockIn: sum.blockIn,
        blockOut: sum.blockOut,
    };
}

function rollupLayer(
    source: MetricPoint[],
    target: MetricPoint[],
    interval: number,
    maxTarget: number,
): void {
    if (source.length === 0) return;

    const lastTargetTs = target.length > 0 ? target[target.length - 1]!.ts : 0;
    const cutoff = lastTargetTs + interval;

    // Find points in source that belong to the next bucket
    const bucket: MetricPoint[] = [];
    for (const p of source) {
        if (p.ts >= cutoff) {
            if (bucket.length > 0) {
                target.push(average(bucket));
                bucket.length = 0;
            }
            bucket.push(p);
        } else if (p.ts > lastTargetTs) {
            bucket.push(p);
        }
    }

    // Don't push the last incomplete bucket — wait for more data

    // Prune
    while (target.length > maxTarget) {
        target.shift();
    }
}

export class MetricsStore {
    private data = new Map<string, ContainerMetrics>();
    private listeners: Listener[] = [];
    private filePath: string;
    private lastSave = 0;
    private lastRollup: Record<string, number> = {};

    constructor(dataDir?: string) {
        const dir = dataDir ?? join(process.cwd(), "data");
        this.filePath = join(dir, "metrics.json");
    }

    private getOrCreate(containerId: string): ContainerMetrics {
        let metrics = this.data.get(containerId);
        if (!metrics) {
            metrics = { raw: [], m1: [], m5: [], m30: [], daily: [] };
            this.data.set(containerId, metrics);
        }
        return metrics;
    }

    /** Resolve a short ID prefix to the full key in the map */
    private resolveId(id: string): string | undefined {
        if (this.data.has(id)) return id;
        for (const key of this.data.keys()) {
            if (key.startsWith(id)) return key;
        }
        return undefined;
    }

    push(containerId: string, point: MetricPoint): void {
        const metrics = this.getOrCreate(containerId);
        metrics.raw.push(point);

        // Prune raw
        while (metrics.raw.length > MAX_RAW) {
            metrics.raw.shift();
        }

        // Run rollups based on elapsed time
        const now = point.ts;
        const key = containerId;
        const last = this.lastRollup[key] ?? 0;

        if (now - last >= INTERVAL_M1) {
            rollupLayer(metrics.raw, metrics.m1, INTERVAL_M1, MAX_M1);
            rollupLayer(metrics.m1, metrics.m5, INTERVAL_M5, MAX_M5);
            rollupLayer(metrics.m5, metrics.m30, INTERVAL_M30, MAX_M30);
            rollupLayer(metrics.m30, metrics.daily, INTERVAL_DAILY, MAX_DAILY);
            this.lastRollup[key] = now;
        }

        // Notify live listeners
        for (const fn of this.listeners) {
            fn(containerId, point);
        }
    }

    query(containerId: string, range: TimeRange): MetricPoint[] {
        const fullId = this.resolveId(containerId);
        const metrics = fullId ? this.data.get(fullId) : undefined;
        if (!metrics) return [];

        switch (range) {
            case "1h":
                return metrics.raw;
            case "24h":
                return metrics.m1;
            case "7d":
                return metrics.m5;
            case "30d":
                return metrics.m30;
            case "1y":
                return metrics.daily;
            default:
                return metrics.raw;
        }
    }

    subscribe(fn: Listener): () => void {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== fn);
        };
    }

    async save(): Promise<void> {
        const now = Date.now();
        if (now - this.lastSave < 60_000) return; // Max once per minute
        this.lastSave = now;

        const serialized: Record<string, ContainerMetrics> = {};
        for (const [id, metrics] of this.data) {
            serialized[id] = metrics;
        }

        try {
            await mkdir(dirname(this.filePath), { recursive: true });
            await writeFile(this.filePath, JSON.stringify(serialized), "utf-8");
        } catch (err) {
            console.error("Failed to save metrics:", err);
        }
    }

    async load(): Promise<void> {
        try {
            const content = await readFile(this.filePath, "utf-8");
            const parsed = JSON.parse(content) as Record<string, ContainerMetrics>;
            for (const [id, metrics] of Object.entries(parsed)) {
                this.data.set(id, metrics);
            }
            console.log(`Loaded metrics for ${this.data.size} containers`);
        } catch {
            // No file yet or parse error — start fresh
        }
    }

    forceSave(): Promise<void> {
        this.lastSave = 0;
        return this.save();
    }
}
