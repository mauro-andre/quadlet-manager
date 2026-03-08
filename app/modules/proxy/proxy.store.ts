import Datastore, { type Document } from "@seald-io/nedb";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ProxyConfig, DomainMapping, SslMode, TargetType } from "./proxy.types.js";

type Doc<T> = Document<T>;

interface ConfigDoc {
    _key: "config";
    enabled: boolean;
    sslMode: SslMode;
    certPath: string | null;
    keyPath: string | null;
}

interface DomainDoc {
    domain: string;
    containerName: string;
    containerPort: number;
    enabled: boolean;
    targetType: TargetType;
    tls: boolean;
    backendHttps: boolean;
}

const dataDir = join(process.cwd(), ".data", "proxy");
mkdirSync(dataDir, { recursive: true });

const configDb = new Datastore<ConfigDoc>({
    filename: join(dataDir, "config.db"),
    autoload: true,
});

const domains = new Datastore<DomainDoc>({
    filename: join(dataDir, "domains.db"),
    autoload: true,
});

configDb.setAutocompactionInterval(300_000);
domains.setAutocompactionInterval(300_000);

// Ensure unique domain index
domains.ensureIndex({ fieldName: "domain", unique: true });

function toDomain(doc: Doc<DomainDoc>): DomainMapping {
    return {
        id: doc._id,
        domain: doc.domain,
        containerName: doc.containerName,
        containerPort: doc.containerPort,
        enabled: doc.enabled,
        targetType: doc.targetType ?? "container",
        tls: doc.tls ?? true,
        backendHttps: doc.backendHttps ?? false,
    };
}

export const proxyStore = {
    async getConfig(): Promise<ProxyConfig> {
        const doc = await configDb.findOneAsync({ _key: "config" }) as Doc<ConfigDoc> | null;
        if (!doc) {
            return { enabled: false, sslMode: "none", certPath: null, keyPath: null };
        }
        return {
            enabled: doc.enabled,
            sslMode: doc.sslMode,
            certPath: doc.certPath,
            keyPath: doc.keyPath,
        };
    },

    async upsertConfig(sslMode: SslMode, certPath?: string | null, keyPath?: string | null): Promise<void> {
        await configDb.updateAsync(
            { _key: "config" },
            { $set: { sslMode, certPath: certPath ?? null, keyPath: keyPath ?? null } },
            { upsert: true },
        );
    },

    async setEnabled(enabled: boolean): Promise<void> {
        await configDb.updateAsync(
            { _key: "config" },
            { $set: { enabled } },
            { upsert: true },
        );
    },

    async listDomains(): Promise<DomainMapping[]> {
        const docs = await domains.findAsync({}).sort({ domain: 1 }) as unknown as Doc<DomainDoc>[];
        return docs.map(toDomain);
    },

    async addDomain(
        domain: string, containerName: string, containerPort: number,
        targetType: TargetType = "container", tls = true, backendHttps = false,
    ): Promise<DomainMapping> {
        const doc = await domains.insertAsync({
            domain, containerName, containerPort,
            enabled: true, targetType, tls, backendHttps,
        });
        return toDomain(doc);
    },

    async updateDomain(
        id: string, domain: string, containerName: string, containerPort: number,
        targetType: TargetType = "container", tls = true, backendHttps = false,
    ): Promise<void> {
        await domains.updateAsync({ _id: id }, {
            $set: { domain, containerName, containerPort, targetType, tls, backendHttps },
        });
    },

    async deleteDomain(id: string): Promise<void> {
        await domains.removeAsync({ _id: id }, {});
    },

    async toggleDomain(id: string, enabled: boolean): Promise<void> {
        await domains.updateAsync({ _id: id }, { $set: { enabled } });
    },
};
