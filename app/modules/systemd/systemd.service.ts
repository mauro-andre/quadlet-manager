import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import type { Scope } from "../auth/auth.types.js";

const execFile = promisify(execFileCb);

const isRoot = () => (process.getuid?.() ?? 0) === 0;

function systemctlCmd(args: string[], scope: Scope): [string, string[]] {
    if (scope === "user") {
        return ["systemctl", ["--user", ...args]];
    }
    if (isRoot()) {
        return ["systemctl", args];
    }
    // sudo -n = non-interactive, never prompts for password
    return ["sudo", ["-n", "systemctl", ...args]];
}

function journalctlCmd(args: string[], scope: Scope): [string, string[]] {
    if (scope === "user") {
        return ["journalctl", ["--user", ...args]];
    }
    if (isRoot()) {
        return ["journalctl", args];
    }
    return ["sudo", ["-n", "journalctl", ...args]];
}

export interface ServiceStatus {
    activeState: string;
    subState: string;
    mainPid: number;
}

export async function startService(serviceName: string, scope: Scope): Promise<void> {
    const [cmd, args] = systemctlCmd(["start", serviceName], scope);
    await execFile(cmd, args);
}

export async function stopService(serviceName: string, scope: Scope): Promise<void> {
    const [cmd, args] = systemctlCmd(["stop", serviceName], scope);
    await execFile(cmd, args);
}

export async function restartService(serviceName: string, scope: Scope): Promise<void> {
    const [cmd, args] = systemctlCmd(["restart", serviceName], scope);
    await execFile(cmd, args);
}

export async function disableService(serviceName: string, scope: Scope): Promise<void> {
    const [cmd, args] = systemctlCmd(["disable", serviceName], scope);
    await execFile(cmd, args);
}

export async function getServiceStatus(
    serviceName: string,
    scope: Scope
): Promise<ServiceStatus> {
    try {
        const [cmd, args] = systemctlCmd(
            [
                "show",
                serviceName,
                "--property=ActiveState,SubState,MainPID",
                "--no-pager",
            ],
            scope
        );
        const { stdout } = await execFile(cmd, args);

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
    scope: Scope,
    lines: number = 100
): Promise<string> {
    try {
        const [cmd, args] = journalctlCmd(
            [
                "-u",
                serviceName,
                "-n",
                String(lines),
                "--no-pager",
                "--output=short",
            ],
            scope
        );
        const { stdout } = await execFile(cmd, args);
        return stdout;
    } catch {
        return "";
    }
}

export async function daemonReload(scope: Scope): Promise<void> {
    const [cmd, args] = systemctlCmd(["daemon-reload"], scope);
    await execFile(cmd, args);
}

export { systemctlCmd, journalctlCmd };
