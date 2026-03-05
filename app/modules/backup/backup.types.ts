export type BackupType = "raw" | "mongodb" | "postgresql" | "mysql" | "redis";

export interface Storage {
    id: number;
    name: string;
    endpoint: string;
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
}

export interface Policy {
    id: number;
    name: string;
    type: BackupType;
    target: string;
    credentials: string | null;
    database: string | null;
    storageId: number;
    storageName?: string;
    frequency: number;
    retention: number;
    enabled: boolean;
    lastRunAt: string | null;
    lastStatus: "success" | "error" | null;
}

export interface BackupHistory {
    id: number;
    policyId: number;
    policyName: string;
    timestamp: string;
    size: number;
    status: "success" | "error" | "running";
    error: string | null;
    remotePath: string;
}

export const FREQUENCIES = [
    { label: "Every 30 min", value: 30 },
    { label: "Every 1 hour", value: 60 },
    { label: "Every 3 hours", value: 180 },
    { label: "Every 6 hours", value: 360 },
    { label: "Every 12 hours", value: 720 },
    { label: "Every 24 hours", value: 1440 },
] as const;

export const RETENTIONS = [
    { label: "Keep last 6", value: 6 },
    { label: "Keep last 12", value: 12 },
    { label: "Keep last 24", value: 24 },
    { label: "Keep last 48", value: 48 },
    { label: "Keep 7 days", value: 168 },
    { label: "Keep 14 days", value: 336 },
    { label: "Keep 30 days", value: 720 },
] as const;

export const BACKUP_TYPES = [
    { label: "Raw Volume", value: "raw" },
    { label: "MongoDB", value: "mongodb" },
    { label: "PostgreSQL", value: "postgresql" },
    { label: "MySQL / MariaDB", value: "mysql" },
    { label: "Redis", value: "redis" },
] as const;
