import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

const isRootless = () => (process.getuid?.() ?? 0) !== 0;

function systemctlArgs(args: string[]): string[] {
    return isRootless() ? ["--user", ...args] : args;
}

function journalctlArgs(args: string[]): string[] {
    return isRootless() ? ["--user", ...args] : args;
}

export interface ServiceStatus {
    activeState: string;
    subState: string;
    mainPid: number;
}

export async function startService(serviceName: string): Promise<void> {
    await execFile("systemctl", systemctlArgs(["start", serviceName]));
}

export async function stopService(serviceName: string): Promise<void> {
    await execFile("systemctl", systemctlArgs(["stop", serviceName]));
}

export async function restartService(serviceName: string): Promise<void> {
    await execFile("systemctl", systemctlArgs(["restart", serviceName]));
}

export async function disableService(serviceName: string): Promise<void> {
    await execFile("systemctl", systemctlArgs(["disable", serviceName]));
}

export async function getServiceStatus(
    serviceName: string
): Promise<ServiceStatus> {
    try {
        const { stdout } = await execFile(
            "systemctl",
            systemctlArgs([
                "show",
                serviceName,
                "--property=ActiveState,SubState,MainPID",
                "--no-pager",
            ])
        );

        const props: Record<string, string> = {};
        for (const line of stdout.split("\n")) {
            const eq = line.indexOf("=");
            if (eq > 0) {
                props[line.slice(0, eq)] = line.slice(eq + 1);
            }
        }

        return {
            activeState: props.ActiveState ?? "unknown",
            subState: props.SubState ?? "unknown",
            mainPid: parseInt(props.MainPID ?? "0", 10),
        };
    } catch {
        return { activeState: "unknown", subState: "unknown", mainPid: 0 };
    }
}

export async function getServiceLogs(
    serviceName: string,
    lines: number = 100
): Promise<string> {
    try {
        const { stdout } = await execFile(
            "journalctl",
            journalctlArgs([
                "-u",
                serviceName,
                "-n",
                String(lines),
                "--no-pager",
                "--output=short",
            ])
        );
        return stdout;
    } catch {
        return "";
    }
}

export async function daemonReload(): Promise<void> {
    await execFile("systemctl", systemctlArgs(["daemon-reload"]));
}
