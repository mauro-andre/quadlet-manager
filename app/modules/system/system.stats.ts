import { readFile, statfs } from "node:fs/promises";

export interface SystemMemory {
    total: number;     // bytes
    used: number;      // bytes
    available: number; // bytes
}


interface CpuTicks {
    idle: number;
    total: number;
}

let prevTicks: CpuTicks | null = null;

async function readCpuTicks(): Promise<CpuTicks> {
    const stat = await readFile("/proc/stat", "utf-8");
    const line = stat.split("\n")[0]!; // "cpu  user nice system idle iowait irq softirq ..."
    const parts = line.split(/\s+/).slice(1).map(Number);
    const idle = parts[3]! + parts[4]!; // idle + iowait
    const total = parts.reduce((a, b) => a + b, 0);
    return { idle, total };
}

export async function getSystemCpuPercent(): Promise<number> {
    const cur = await readCpuTicks();

    if (!prevTicks) {
        prevTicks = cur;
        return 0;
    }

    const deltaIdle = cur.idle - prevTicks.idle;
    const deltaTotal = cur.total - prevTicks.total;
    prevTicks = cur;

    if (deltaTotal <= 0) return 0;
    return Math.min(100, ((deltaTotal - deltaIdle) / deltaTotal) * 100);
}

export async function getSystemMemory(): Promise<SystemMemory> {
    const meminfo = await readFile("/proc/meminfo", "utf-8");
    const get = (key: string): number => {
        const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
        return match ? parseInt(match[1]!, 10) * 1024 : 0; // kB to bytes
    };

    const total = get("MemTotal");
    const available = get("MemAvailable");

    return {
        total,
        used: total - available,
        available,
    };
}

export interface DiskPartition {
    device: string;
    mountpoint: string;
    total: number;     // bytes
    used: number;      // bytes
    available: number; // bytes
}

export async function getSystemDisks(): Promise<DiskPartition[]> {
    const mounts = await readFile("/proc/mounts", "utf-8");
    // Keep the shortest mountpoint per device (avoids bind mount duplicates)
    const deviceMap = new Map<string, string>();

    for (const line of mounts.split("\n")) {
        const parts = line.split(" ");
        if (!parts[0] || !parts[1]) continue;
        const device = parts[0];
        const mountpoint = parts[1];

        if (!device.startsWith("/dev/")) continue;

        // Skip system/boot partitions
        if (/^\/(boot|efi|recovery)/.test(mountpoint)) continue;

        const existing = deviceMap.get(device);
        if (!existing || mountpoint.length < existing.length) {
            deviceMap.set(device, mountpoint);
        }
    }

    const partitions: DiskPartition[] = [];
    for (const [device, mountpoint] of deviceMap) {
        try {
            const s = await statfs(mountpoint);
            const total = s.blocks * s.bsize;
            if (total === 0) continue;
            const available = s.bavail * s.bsize;
            partitions.push({
                device,
                mountpoint,
                total,
                used: total - available,
                available,
            });
        } catch {
            // skip inaccessible mounts
        }
    }

    // Sort by total size descending
    partitions.sort((a, b) => b.total - a.total);
    return partitions;
}
