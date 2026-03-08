import Datastore, { type Document } from "@seald-io/nedb";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Storage, Policy, BackupHistory, BackupType, BackupMode } from "./backup.types.js";

type Doc<T> = Document<T>;

interface StorageDoc {
    name: string;
    endpoint: string;
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
}

interface PolicyDoc {
    name: string;
    type: BackupType;
    mode: BackupMode;
    target: string;
    credentials: string | null;
    database: string | null;
    storageId: string;
    schedule: string;
    retention: number;
    enabled: boolean;
    lastRunAt: string | null;
    lastStatus: "success" | "error" | null;
}

interface HistoryDoc {
    policyId: string;
    policyName: string;
    timestamp: string;
    size: number;
    status: "success" | "error" | "running";
    error: string | null;
    remotePath: string;
}

const dataDir = join(process.cwd(), ".data", "backup");
mkdirSync(dataDir, { recursive: true });

function createStore<T>(name: string): Datastore<T> {
    return new Datastore<T>({
        filename: join(dataDir, `${name}.db`),
        autoload: true,
    });
}

const storages = createStore<StorageDoc>("storages");
const policies = createStore<PolicyDoc>("policies");
const history = createStore<HistoryDoc>("history");

// Auto-compact every 5 minutes
storages.setAutocompactionInterval(300_000);
policies.setAutocompactionInterval(300_000);
history.setAutocompactionInterval(300_000);

function toStorage(doc: Doc<StorageDoc>): Storage {
    return {
        id: doc._id,
        name: doc.name,
        endpoint: doc.endpoint,
        bucket: doc.bucket,
        region: doc.region,
        accessKey: doc.accessKey,
        secretKey: doc.secretKey,
    };
}

function toPolicy(doc: Doc<PolicyDoc>, storageName?: string): Policy {
    return {
        id: doc._id,
        name: doc.name,
        type: doc.type,
        mode: doc.mode ?? "copy",
        target: doc.target,
        credentials: doc.credentials,
        database: doc.database,
        storageId: doc.storageId,
        storageName,
        schedule: doc.schedule ?? "daily",
        retention: doc.retention,
        enabled: doc.enabled,
        lastRunAt: doc.lastRunAt,
        lastStatus: doc.lastStatus,
    };
}

function toHistory(doc: Doc<HistoryDoc>): BackupHistory {
    return {
        id: doc._id,
        policyId: doc.policyId,
        policyName: doc.policyName,
        timestamp: doc.timestamp,
        size: doc.size,
        status: doc.status,
        error: doc.error,
        remotePath: doc.remotePath,
    };
}

export const backupStore = {
    // ── Storages ─────────────────────────────────────────────────

    async listStorages(): Promise<Storage[]> {
        const docs = await storages.findAsync({}).sort({ name: 1 }) as unknown as Doc<StorageDoc>[];
        return docs.map(toStorage);
    },

    async getStorage(id: string): Promise<Storage | undefined> {
        const doc = await storages.findOneAsync({ _id: id }) as Doc<StorageDoc> | null;
        return doc ? toStorage(doc) : undefined;
    },

    async addStorage(name: string, endpoint: string, bucket: string, region: string, accessKey: string, secretKey: string): Promise<Storage> {
        const doc = await storages.insertAsync({ name, endpoint, bucket, region, accessKey, secretKey });
        return toStorage(doc);
    },

    async updateStorage(id: string, name: string, endpoint: string, bucket: string, region: string, accessKey: string, secretKey: string): Promise<void> {
        await storages.updateAsync({ _id: id }, { $set: { name, endpoint, bucket, region, accessKey, secretKey } });
    },

    async deleteStorage(id: string): Promise<void> {
        await storages.removeAsync({ _id: id }, {});
    },

    // ── Policies ─────────────────────────────────────────────────

    async listPolicies(): Promise<Policy[]> {
        const docs = await policies.findAsync({}).sort({ name: 1 }) as unknown as Doc<PolicyDoc>[];
        const allStorageDocs = await storages.findAsync({}) as unknown as Doc<StorageDoc>[];
        const storageMap = new Map(allStorageDocs.map((s) => [s._id, s.name]));

        return docs.map((d) => toPolicy(d, storageMap.get(d.storageId)));
    },

    async getPolicy(id: string): Promise<Policy | undefined> {
        const doc = await policies.findOneAsync({ _id: id }) as Doc<PolicyDoc> | null;
        if (!doc) return undefined;
        const s = await storages.findOneAsync({ _id: doc.storageId }) as Doc<StorageDoc> | null;
        return toPolicy(doc, s?.name);
    },

    async addPolicy(
        name: string, type: BackupType, mode: BackupMode, target: string,
        credentials: string | null, database: string | null,
        storageId: string, schedule: string, retention: number,
    ): Promise<string> {
        const doc = await policies.insertAsync({
            name, type, mode, target, credentials, database,
            storageId, schedule, retention,
            enabled: true, lastRunAt: null, lastStatus: null,
        });
        return doc._id;
    },

    async updatePolicy(
        id: string, name: string, type: BackupType, mode: BackupMode, target: string,
        credentials: string | null, database: string | null,
        storageId: string, schedule: string, retention: number,
    ): Promise<void> {
        await policies.updateAsync({ _id: id }, {
            $set: { name, type, mode, target, credentials, database, storageId, schedule, retention },
        });
    },

    async deletePolicy(id: string): Promise<void> {
        await history.removeAsync({ policyId: id }, { multi: true });
        await policies.removeAsync({ _id: id }, {});
    },

    async togglePolicy(id: string, enabled: boolean): Promise<void> {
        await policies.updateAsync({ _id: id }, { $set: { enabled } });
    },

    async updatePolicyStatus(id: string, status: "success" | "error"): Promise<void> {
        await policies.updateAsync({ _id: id }, {
            $set: { lastRunAt: new Date().toISOString(), lastStatus: status },
        });
    },

    // ── History ──────────────────────────────────────────────────

    async listHistory(limit = 50): Promise<BackupHistory[]> {
        const docs = await history.findAsync({}).sort({ timestamp: -1 }).limit(limit) as unknown as Doc<HistoryDoc>[];
        return docs.map(toHistory);
    },

    async listHistoryByPolicy(policyId: string): Promise<BackupHistory[]> {
        const docs = await history.findAsync({ policyId }).sort({ timestamp: -1 }) as unknown as Doc<HistoryDoc>[];
        return docs.map(toHistory);
    },

    async getHistory(id: string): Promise<BackupHistory | undefined> {
        const doc = await history.findOneAsync({ _id: id }) as Doc<HistoryDoc> | null;
        return doc ? toHistory(doc) : undefined;
    },

    async addHistory(policyId: string, policyName: string, remotePath: string): Promise<string> {
        const doc = await history.insertAsync({
            policyId, policyName,
            timestamp: new Date().toISOString(),
            size: 0, status: "running" as const,
            error: null, remotePath,
        });
        return doc._id;
    },

    async updateHistorySuccess(id: string, size: number): Promise<void> {
        await history.updateAsync({ _id: id }, { $set: { status: "success", size } });
    },

    async updateHistoryComplete(id: string, size: number, remotePath: string, timestamp?: string): Promise<void> {
        const fields: Record<string, unknown> = { status: "success", size, remotePath };
        if (timestamp) fields.timestamp = timestamp;
        await history.updateAsync({ _id: id }, { $set: fields });
    },

    async updateHistoryError(id: string, error: string): Promise<void> {
        await history.updateAsync({ _id: id }, { $set: { status: "error", error } });
    },

    async deleteHistory(id: string): Promise<void> {
        await history.removeAsync({ _id: id }, {});
    },

    async pruneHistory(policyId: string, retention: number): Promise<BackupHistory[]> {
        const all = await history.findAsync({ policyId, status: "success" }).sort({ timestamp: -1 }) as unknown as Doc<HistoryDoc>[];
        const excess = all.slice(retention);

        if (excess.length > 0) {
            const ids = excess.map((e) => e._id);
            await history.removeAsync({ _id: { $in: ids } }, { multi: true });
        }

        return excess.map(toHistory);
    },

    async cleanupStaleRunning(): Promise<void> {
        await history.updateAsync(
            { status: "running" },
            { $set: { status: "error", error: "Interrupted (server restart)" } },
            { multi: true },
        );
    },
};

// Cleanup stale entries on load
backupStore.cleanupStaleRunning();
