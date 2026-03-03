import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import type { AuthUser, Scope } from "../auth/auth.types.js";

const execFile = promisify(execFileCb);

const processUid = () => process.getuid?.() ?? 0;
const isRoot = () => processUid() === 0;

export type CmdSpec = [cmd: string, args: string[], env?: Record<string, string>];

function systemctlCmd(args: string[], scope: Scope, user?: AuthUser): CmdSpec {
    if (scope === "user") {
        const userArgs = ["--user", ...args];
        // Same user or no user specified — run directly
        if (!user || user.uid === processUid()) {
            return ["systemctl", userArgs];
        }
        // Different user — need to switch context
        const env = { XDG_RUNTIME_DIR: `/run/user/${user.uid}` };
        if (isRoot()) {
            return ["runuser", ["-u", user.username, "--", "systemctl", ...userArgs], env];
        }
        return ["sudo", ["-n", "-u", user.username, "systemctl", ...userArgs], env];
    }
    // system scope
    if (isRoot()) {
        return ["systemctl", args];
    }
    return ["sudo", ["-n", "systemctl", ...args]];
}

function journalctlCmd(args: string[], scope: Scope, user?: AuthUser): CmdSpec {
    if (scope === "user") {
        const userArgs = ["--user", ...args];
        if (!user || user.uid === processUid()) {
            return ["journalctl", userArgs];
        }
        const env = { XDG_RUNTIME_DIR: `/run/user/${user.uid}` };
        if (isRoot()) {
            return ["runuser", ["-u", user.username, "--", "journalctl", ...userArgs], env];
        }
        return ["sudo", ["-n", "-u", user.username, "journalctl", ...userArgs], env];
    }
    if (isRoot()) {
        return ["journalctl", args];
    }
    return ["sudo", ["-n", "journalctl", ...args]];
}

async function execCmd(spec: CmdSpec) {
    const [cmd, args, env] = spec;
    return execFile(cmd, args, { encoding: "utf-8", ...(env ? { env: { ...process.env, ...env } } : undefined) });
}

export interface ServiceStatus {
    activeState: string;
    subState: string;
    mainPid: number;
}

export async function startService(serviceName: string, scope: Scope, user?: AuthUser): Promise<void> {
    await execCmd(systemctlCmd(["start", serviceName], scope, user));
}

export async function stopService(serviceName: string, scope: Scope, user?: AuthUser): Promise<void> {
    await execCmd(systemctlCmd(["stop", serviceName], scope, user));
}

export async function restartService(serviceName: string, scope: Scope, user?: AuthUser): Promise<void> {
    await execCmd(systemctlCmd(["restart", serviceName], scope, user));
}

export async function disableService(serviceName: string, scope: Scope, user?: AuthUser): Promise<void> {
    await execCmd(systemctlCmd(["disable", serviceName], scope, user));
}

export async function getServiceStatus(
    serviceName: string,
    scope: Scope,
    user?: AuthUser
): Promise<ServiceStatus> {
    try {
        const { stdout } = await execCmd(systemctlCmd(
            [
                "show",
                serviceName,
                "--property=ActiveState,SubState,MainPID",
                "--no-pager",
            ],
            scope,
            user
        ));

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
    user?: AuthUser,
    lines: number = 100
): Promise<string> {
    try {
        const { stdout } = await execCmd(journalctlCmd(
            [
                "-u",
                serviceName,
                "-n",
                String(lines),
                "--no-pager",
                "--output=short",
            ],
            scope,
            user
        ));
        return stdout;
    } catch {
        return "";
    }
}

export async function daemonReload(scope: Scope, user?: AuthUser): Promise<void> {
    await execCmd(systemctlCmd(["daemon-reload"], scope, user));
}

export { systemctlCmd, journalctlCmd };
