import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

export type CmdSpec = [cmd: string, args: string[]];

function systemctlCmd(args: string[]): CmdSpec {
    return ["systemctl", ["--user", ...args]];
}

function journalctlCmd(args: string[]): CmdSpec {
    return ["journalctl", ["--user", ...args]];
}

async function execCmd(spec: CmdSpec) {
    const [cmd, args] = spec;
    return execFile(cmd, args, { encoding: "utf-8" });
}

export interface ServiceStatus {
    activeState: string;
    subState: string;
    mainPid: number;
}

export async function startService(serviceName: string): Promise<void> {
    await execCmd(systemctlCmd(["start", serviceName]));
}

export async function stopService(serviceName: string): Promise<void> {
    await execCmd(systemctlCmd(["stop", serviceName]));
}

export async function restartService(serviceName: string): Promise<void> {
    await execCmd(systemctlCmd(["restart", serviceName]));
}

export async function enableService(serviceName: string): Promise<void> {
    await execCmd(systemctlCmd(["enable", serviceName]));
}

export async function disableService(serviceName: string): Promise<void> {
    await execCmd(systemctlCmd(["disable", serviceName]));
}

export async function getServiceStatus(serviceName: string): Promise<ServiceStatus> {
    try {
        const { stdout } = await execCmd(systemctlCmd([
            "show",
            serviceName,
            "--property=ActiveState,SubState,MainPID",
            "--no-pager",
        ]));

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

export async function getServiceLogs(serviceName: string, lines: number = 100): Promise<string> {
    try {
        const { stdout } = await execCmd(journalctlCmd([
            "-u",
            serviceName,
            "-n",
            String(lines),
            "--no-pager",
            "--output=short",
        ]));
        return stdout;
    } catch {
        return "";
    }
}

export async function daemonReload(): Promise<void> {
    await execCmd(systemctlCmd(["daemon-reload"]));
}

export { systemctlCmd, journalctlCmd };
