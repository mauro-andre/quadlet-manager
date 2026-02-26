import { readFile } from "node:fs/promises";

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
