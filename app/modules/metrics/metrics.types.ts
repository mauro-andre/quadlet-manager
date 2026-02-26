export interface MetricPoint {
    ts: number;
    cpu: number;
    mem: number;
    memLimit: number;
    netIn: number;
    netOut: number;
    blockIn: number;
    blockOut: number;
}

export type TimeRange = "1h" | "24h" | "7d" | "30d" | "1y";
