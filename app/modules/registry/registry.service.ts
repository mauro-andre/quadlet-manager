import { execFile as execFileCb } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { AuthUser } from "../auth/auth.types.js";

const execFile = promisify(execFileCb);

export interface RegistryEntry {
    registry: string;
    username: string;
}

interface AuthJson {
    auths?: Record<string, { auth?: string }>;
}

function getAuthJsonPath(user: AuthUser): string {
    return `/run/user/${user.uid}/containers/auth.json`;
}

async function readAuthJson(user: AuthUser): Promise<AuthJson> {
    const path = getAuthJsonPath(user);
    try {
        const content = await readFile(path, "utf-8");
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
    const authJson = await readAuthJson(user);
    const entries: RegistryEntry[] = [];

    if (authJson.auths) {
        for (const [registry, cred] of Object.entries(authJson.auths)) {
            entries.push({
                registry,
                username: cred.auth ? decodeUsername(cred.auth) : "unknown",
            });
        }
    }

    return entries;
}

export async function loginRegistry(
    registry: string,
    username: string,
    password: string,
): Promise<void> {
    const proc = execFileCb("podman", [
        "login", registry, "--username", username, "--password-stdin",
    ], { encoding: "utf-8" });
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

export async function logoutRegistry(registry: string): Promise<void> {
    await execFile("podman", ["logout", registry], { encoding: "utf-8" });
}
