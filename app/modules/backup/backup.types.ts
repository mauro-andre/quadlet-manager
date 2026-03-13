export type BackupType = "raw" | "mongodb" | "postgresql" | "mysql" | "redis";
export type BackupMode = "copy" | "sync";

export interface Storage {
    id: string;
    name: string;
    endpoint: string;
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
}

export interface Policy {
    id: string;
    name: string;
    type: BackupType;
    mode: BackupMode;
    target: string;
    credentials: string | null;
    database: string | null;
    storageId: string;
    storageName?: string;
    schedule: string;
    retention: number;
    enabled: boolean;
    lastRunAt: string | null;
    lastStatus: "success" | "error" | null;
}

export interface BackupHistory {
    id: string;
    policyId: string;
    policyName: string;
    timestamp: string;
    size: number;
    status: "success" | "error" | "running";
    error: string | null;
    remotePath: string;
}

export const SCHEDULES = [
    { label: "Every 30 min", value: "*-*-* *:00/30:00" },
    { label: "Every 1 hour", value: "hourly" },
    { label: "Every 3 hours", value: "*-*-* 00/3:00:00" },
    { label: "Every 6 hours", value: "*-*-* 00/6:00:00" },
    { label: "Every 12 hours", value: "*-*-* 00/12:00:00" },
    { label: "Daily", value: "daily" },
    { label: "Weekly", value: "weekly" },
    { label: "Monthly", value: "monthly" },
] as const;

export const RETENTIONS = [
    { label: "Keep last 3", value: 3 },
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
