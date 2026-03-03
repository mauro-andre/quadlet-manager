import { execFile as execFileCb } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { AuthUser, Scope } from "../auth/auth.types.js";

const execFile = promisify(execFileCb);

const processUid = () => process.getuid?.() ?? 0;
const isRoot = () => processUid() === 0;

export interface RegistryEntry {
    registry: string;
    username: string;
    scope: Scope;
}

interface AuthJson {
    auths?: Record<string, { auth?: string }>;
}

function getAuthJsonPath(scope: Scope, user: AuthUser): string {
    if (scope === "system") {
        return "/run/containers/0/auth.json";
    }
    return `/run/user/${user.uid}/containers/auth.json`;
}

async function readAuthJson(scope: Scope, user: AuthUser): Promise<AuthJson> {
    const path = getAuthJsonPath(scope, user);
    try {
        let content: string;
        if (scope === "system" && !isRoot()) {
            const { stdout } = await execFile("sudo", ["-n", "cat", path], { encoding: "utf-8" });
            content = stdout;
        } else if (scope === "user" && isRoot() && user.uid !== processUid()) {
            const { stdout } = await execFile("runuser", ["-u", user.username, "--", "cat", path], {
                encoding: "utf-8",
                env: { ...process.env, XDG_RUNTIME_DIR: `/run/user/${user.uid}` },
            });
            content = stdout;
        } else {
            content = await readFile(path, "utf-8");
        }
        return JSON.parse(content) as AuthJson;
    } catch {
        return { auths: {} };
    }
}

function decodeUsername(auth: string): string {
    try {
        const decoded = Buffer.from(auth, "base64").toString("utf-8");
        const colonIdx = decoded.indexOf(":");
        return colonIdx > 0 ? decoded.slice(0, colonIdx) : decoded;
    } catch {
        return "unknown";
    }
}

export async function listRegistries(user: AuthUser): Promise<RegistryEntry[]> {
    const [userAuth, systemAuth] = await Promise.all([
        readAuthJson("user", user),
        user.hasSudo ? readAuthJson("system", user) : Promise.resolve({ auths: {} } as AuthJson),
    ]);

    const entries: RegistryEntry[] = [];

    if (userAuth.auths) {
        for (const [registry, cred] of Object.entries(userAuth.auths)) {
            entries.push({
                registry,
                username: cred.auth ? decodeUsername(cred.auth) : "unknown",
                scope: "user",
            });
        }
    }

    if (systemAuth.auths) {
        for (const [registry, cred] of Object.entries(systemAuth.auths)) {
            entries.push({
                registry,
                username: cred.auth ? decodeUsername(cred.auth) : "unknown",
                scope: "system",
            });
        }
    }

    return entries;
}

function podmanCmd(args: string[], scope: Scope, user: AuthUser): [string, string[], Record<string, string>?] {
    if (scope === "user") {
        if (!isRoot() || user.uid === processUid()) {
            return ["podman", args];
        }
        return ["runuser", ["-u", user.username, "--", "podman", ...args], {
            XDG_RUNTIME_DIR: `/run/user/${user.uid}`,
        }];
    }
    // system scope
    if (isRoot()) {
        return ["podman", args];
    }
    return ["sudo", ["-n", "podman", ...args]];
}

export async function loginRegistry(
    registry: string,
    username: string,
    password: string,
    scope: Scope,
    user: AuthUser,
): Promise<void> {
    const [cmd, args, env] = podmanCmd(
        ["login", registry, "--username", username, "--password-stdin"],
        scope,
        user,
    );
    const proc = execFileCb(cmd, args, {
        encoding: "utf-8",
        ...(env ? { env: { ...process.env, ...env } } : undefined),
    });
    proc.stdin?.write(password);
    proc.stdin?.end();

    await new Promise<void>((resolve, reject) => {
        let stderr = "";
        proc.stderr?.on("data", (chunk: Buffer) => { stderr += chunk; });
        proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(stderr.trim() || `podman login failed with code ${code}`));
        });
        proc.on("error", reject);
    });
}

export async function logoutRegistry(
    registry: string,
    scope: Scope,
    user: AuthUser,
): Promise<void> {
    const [cmd, args, env] = podmanCmd(["logout", registry], scope, user);
    await execFile(cmd, args, {
        encoding: "utf-8",
        ...(env ? { env: { ...process.env, ...env } } : undefined),
    });
}
