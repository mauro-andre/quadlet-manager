# Backup Feature — Implementation Plan

## Overview

Automated backup system for volumes and databases, with S3-compatible storage destinations and scheduled policies.

## Architecture

```
BackupStore (SQLite)     BackupService (logic)       Scheduler (cron)
├── storages             ├── testConnection()         ├── runs on server start
├── policies             ├── runBackup(policyId)      ├── checks policies every 60s
└── backup_history       ├── restoreBackup(historyId) └── triggers runBackup when due
                         ├── listBackups()
                         └── pruneOldBackups()
```

## Files to Create

### 1. `app/modules/backup/backup.types.ts`

```ts
export type BackupType = "raw" | "mongodb" | "postgresql" | "mysql" | "redis";

export interface Storage {
    id: number;
    name: string;
    endpoint: string;
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;   // stored encrypted? or plain for v1
}

export interface Policy {
    id: number;
    name: string;
    type: BackupType;
    target: string;         // volume name (raw) or container name (database)
    credentials?: string;   // "user:password" for database auth
    database?: string;      // database name (postgresql/mysql)
    storageId: number;
    frequency: number;      // interval in minutes (30, 60, 180, 360, 720, 1440)
    retention: number;      // number of backups to keep
    enabled: boolean;
    lastRunAt: string | null;
    lastStatus: "success" | "error" | null;
}

export interface BackupHistory {
    id: number;
    policyId: number;
    policyName: string;
    timestamp: string;
    size: number;           // bytes
    status: "success" | "error" | "running";
    error: string | null;
    remotePath: string;     // path in the bucket
}

export type Frequency =
    | { label: "Every 30 min", value: 30 }
    | { label: "Every 1 hour", value: 60 }
    | { label: "Every 3 hours", value: 180 }
    | { label: "Every 6 hours", value: 360 }
    | { label: "Every 12 hours", value: 720 }
    | { label: "Every 24 hours", value: 1440 };
```

### 2. `app/modules/backup/backup.store.ts`

SQLite store following ProxyStore pattern.

**Tables:**

```sql
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
    type        TEXT NOT NULL,           -- raw|mongodb|postgresql|mysql|redis
    target      TEXT NOT NULL,           -- volume or container name
    credentials TEXT,                    -- user:password
    database    TEXT,                    -- db name for pg/mysql
    storage_id  INTEGER NOT NULL REFERENCES storages(id),
    frequency   INTEGER NOT NULL,        -- minutes
    retention   INTEGER NOT NULL DEFAULT 24,
    enabled     INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    last_status TEXT                     -- success|error
);

CREATE TABLE IF NOT EXISTS backup_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_id   INTEGER NOT NULL REFERENCES policies(id),
    policy_name TEXT NOT NULL,
    timestamp   TEXT NOT NULL,
    size        INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL,           -- success|error|running
    error       TEXT,
    remote_path TEXT NOT NULL
);
```

**Methods:**
- `addStorage(...)`, `updateStorage(...)`, `deleteStorage(id)`, `listStorages()`, `getStorage(id)`
- `addPolicy(...)`, `updatePolicy(...)`, `deletePolicy(id)`, `listPolicies()`, `getPolicy(id)`
- `addHistory(...)`, `updateHistory(id, ...)`, `listHistory(limit?)`, `listHistoryByPolicy(policyId)`, `deleteHistory(id)`
- `getDuePolicies()` — returns enabled policies where `now - lastRunAt >= frequency`
- `pruneHistory(policyId, retention)` — deletes oldest entries beyond retention count

### 3. `app/modules/backup/backup.service.ts`

**Dependencies:** `rclone` installed on the host.

**Functions:**

#### `checkRclone(): Promise<boolean>`
- `execFile("which", ["rclone"])` — checks if rclone is available

#### `testConnection(storage: Storage): Promise<{ ok: boolean; error?: string }>`
- Writes temporary rclone config
- Runs `rclone lsd remote:bucket` to test connection
- Cleans up temp config

#### `runBackup(policyId: number): Promise<void>`
1. Get policy + storage from store
2. Create history entry with status "running"
3. Execute backup based on type:

**Raw (volume):**
```bash
podman run --rm -v <volume>:/source:ro -v /tmp:/backup alpine \
  tar czf /backup/qm-backup-<timestamp>.tar.gz -C /source .
```

**MongoDB:**
```bash
podman exec <container> mongodump \
  --username=<user> --password=<pass> --authenticationDatabase=admin \
  --archive --gzip > /tmp/qm-backup-<timestamp>.gz
```

**PostgreSQL:**
```bash
podman exec <container> pg_dump -U <user> -Fc <database> > /tmp/qm-backup-<timestamp>.dump
```
(PGPASSWORD via env or .pgpass)

**MySQL/MariaDB:**
```bash
podman exec <container> mysqldump -u <user> -p<pass> --all-databases > /tmp/qm-backup-<timestamp>.sql
```

**Redis:**
```bash
podman exec <container> redis-cli bgsave
# Wait for completion
podman exec <container> redis-cli lastsave
# Copy dump.rdb from volume
podman cp <container>:/data/dump.rdb /tmp/qm-backup-<timestamp>.rdb
```

4. Get file size
5. Upload via rclone:
```bash
rclone --config <tmpconfig> copy /tmp/qm-backup-<timestamp>.gz remote:bucket/backups/<policy-name>/
```
6. Update history: status "success", size
7. Cleanup `/tmp/qm-backup-*`
8. Update policy: lastRunAt, lastStatus
9. Prune old backups (remote + history) based on retention

#### `restoreBackup(historyId: number): Promise<void>`
1. Get history + policy + storage from store
2. Download from remote:
```bash
rclone --config <tmpconfig> copy remote:bucket/<remotePath> /tmp/
```
3. Restore based on type:

**Raw:**
```bash
podman run --rm -v <volume>:/target -v /tmp:/backup alpine \
  tar xzf /backup/<filename> -C /target
```

**MongoDB:**
```bash
podman exec -i <container> mongorestore \
  --username=<user> --password=<pass> --authenticationDatabase=admin \
  --archive --gzip --drop < /tmp/<filename>
```

**PostgreSQL:**
```bash
podman exec -i <container> pg_restore -U <user> --clean -d <database> < /tmp/<filename>
```

**MySQL:**
```bash
podman exec -i <container> mysql -u <user> -p<pass> < /tmp/<filename>
```

**Redis:**
```bash
podman cp /tmp/<filename> <container>:/data/dump.rdb
podman exec <container> redis-cli shutdown nosave
# Container restarts via systemd, loads the dump
```

4. Cleanup temp files

#### `deleteRemoteBackup(historyId: number): Promise<void>`
- Downloads nothing, just deletes the remote file via rclone

#### `startScheduler(): void`
- `setInterval` every 60 seconds
- Calls `getDuePolicies()` from store
- For each due policy, runs `runBackup(policyId)`
- Catches errors, updates history with error status

#### Rclone config helper
```ts
function writeRcloneConfig(storage: Storage): string {
    // Writes temp file to /tmp/rclone-qm-<random>.conf
    // Returns path
    // Content:
    // [remote]
    // type = s3
    // provider = Other
    // endpoint = <storage.endpoint>
    // access_key_id = <storage.accessKey>
    // secret_access_key = <storage.secretKey>
    // region = <storage.region>
}
```

### 4. `app/backups/BackupList.css.ts`

Follows DomainList.css.ts patterns:
- `page`, `header`, `title`, `headerRight`
- `setupCard`, `setupTitle`, `setupDescription`, `setupButton` (for "no storage" state)
- `inlineForm`, `inlineFormTitle`, `inlineFormRow`, `inlineFormField`, `inlineFormLabel`
- `input`, `select`, `cancelButton`, `submitButton`
- `sectionTitle` — for "Storage Destinations", "Policies", "Recent Backups" headings
- `storageCard`, `storageName`, `storageDetail` — storage destinations display
- `policyCard`, `policyName`, `policyDetail`, `policyMeta` — policy display
- `tableWrapper`, `table`, `th`, `td` — recent backups table
- `statusBadge`, `statusSuccess`, `statusError`, `statusRunning`
- `empty`, `actionsCell`

### 5. `app/backups/BackupList.tsx`

**Loader:**
```ts
export const loader = async ({ c }: LoaderArgs) => {
    const { backupStore } = await import("../modules/backup/backup.store.js");
    const { checkRclone } = await import("../modules/backup/backup.service.js");
    return {
        hasRclone: await checkRclone(),
        storages: backupStore.listStorages(),
        policies: backupStore.listPolicies(),
        history: backupStore.listHistory(50),
    };
};
```

**Actions:**
- `action_addStorage` — add S3 storage destination
- `action_updateStorage` — edit storage
- `action_deleteStorage` — remove storage
- `action_testStorage` — test connection
- `action_addPolicy` — create backup policy
- `action_updatePolicy` — edit policy
- `action_deletePolicy` — remove policy
- `action_togglePolicy` — enable/disable policy
- `action_runNow` — trigger immediate backup
- `action_restore` — restore from backup
- `action_deleteBackup` — delete a backup entry + remote file

**UI States:**

1. **No rclone installed** — show install instructions:
   ```
   "rclone is required. Install it: curl https://rclone.org/install.sh | sudo bash"
   ```

2. **No storages configured** — show setup card:
   ```
   "Configure a storage destination to start creating backups."
   [Add Storage]
   ```

3. **Active** — three sections:
   - **Storage Destinations** — list of configured storages with edit/delete/test
   - **Policies** — list of backup policies with status, run now, edit/delete/toggle
   - **Recent Backups** — table with timestamp, policy, size, status, restore/delete

**Component signals:**
- `showStorageForm` / `editingStorage` — storage add/edit form
- `showPolicyForm` / `editingPolicy` — policy add/edit form
- `submitting` — loading state for forms

**Storage form fields:**
- Name, Endpoint, Access Key, Secret Key, Bucket, Region
- "Test Connection" button

**Policy form fields:**
- Name
- Type (select: Raw Volume / MongoDB / PostgreSQL / MySQL / Redis)
- Target (select: volume list for raw, container list for databases)
- Credentials: Username + Password (for database types)
- Database name (for PostgreSQL/MySQL)
- Frequency (select: 30min, 1h, 3h, 6h, 12h, 24h)
- Retention (select: 6, 12, 24, 48, 7 days, 14 days, 30 days)
- Destination (select: from configured storages)

### 6. Modify `app/routes.tsx`

```ts
import * as BackupList from "./backups/BackupList.js";
// ...
{ path: "/backups", module: BackupList },
```

### 7. Modify `app/layouts/AdminLayout.tsx`

Add to navItems:
```ts
{ path: "/backups", label: "Backups" },
```
Position: after Domains, before Terminal.

### 8. Modify `app/server.tsx`

Start the backup scheduler on server init:
```ts
import("./modules/backup/backup.service.js").then(({ startScheduler }) => {
    startScheduler();
});
```

## Execution Commands Summary

All commands use `execFile` (not `exec`) to avoid shell injection.

| Operation | Command |
|-----------|---------|
| Check rclone | `which rclone` |
| Test storage | `rclone --config <tmp> lsd remote:<bucket>` |
| Raw backup | `podman run --rm -v vol:/source:ro -v /tmp:/backup alpine tar czf ...` |
| MongoDB dump | `podman exec <ct> mongodump --archive --gzip` (stdout redirect) |
| PostgreSQL dump | `podman exec <ct> pg_dump -U user -Fc dbname` (stdout redirect) |
| MySQL dump | `podman exec <ct> mysqldump -u user -ppass --all-databases` |
| Redis dump | `podman exec <ct> redis-cli bgsave` + `podman cp` |
| Upload | `rclone --config <tmp> copy /tmp/file remote:<bucket>/path/` |
| Download | `rclone --config <tmp> copy remote:<bucket>/path /tmp/` |
| Delete remote | `rclone --config <tmp> delete remote:<bucket>/path/file` |
| Prune remote | `rclone --config <tmp> delete remote:<bucket>/path/file` (per old entry) |

## Scope Awareness

Backups need scope awareness for `podman exec` and `podman run`:
- User scope: `podman --url unix:///run/user/{uid}/podman/podman.sock exec ...`
- System scope: `sudo -n podman exec ...`

The policy should store which scope/user the target container belongs to.
Add `scope` and optional user context to the policy type.

## Rclone Config Format

Temporary config file written per operation:
```ini
[remote]
type = s3
provider = Other
endpoint = fsn1.your-objectstorage.com
access_key_id = AK123
secret_access_key = SK456
region = eu-central-1
acl = private
```

## Verification

1. Backups page shows "install rclone" if not available
2. Shows "configure storage" if no storages
3. Add S3 storage + test connection works
4. Create MongoDB backup policy (hourly, keep 24)
5. "Run Now" creates dump, uploads to S3, shows in history
6. Scheduler triggers backups automatically at configured frequency
7. Restore downloads backup and restores to running database
8. Retention prunes old backups (remote + local history)
9. Raw volume backup/restore works with tar.gz
