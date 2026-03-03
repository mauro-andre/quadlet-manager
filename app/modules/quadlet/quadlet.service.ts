import { readdir, readFile, writeFile, unlink, access } from "node:fs/promises";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { join, extname, basename } from "node:path";
import type { QuadletFile, QuadletListItem, QuadletType } from "./quadlet.types.js";
import type { Scope, AuthUser } from "../auth/auth.types.js";
import { daemonReload, getServiceStatus } from "../systemd/systemd.service.js";

const execFile = promisify(execFileCb);

const VALID_EXTENSIONS = new Set([".container", ".network", ".volume"]);
const FILENAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(container|network|volume)$/;

const isRoot = () => (process.getuid?.() ?? 0) === 0;

function getQuadletDir(scope: Scope, user: AuthUser): string {
    if (process.env.QUADLET_DIR) return process.env.QUADLET_DIR;

    if (scope === "system") {
        return "/etc/containers/systemd";
    }
    // user scope: use the logged-in user's config dir
    return join(user.homeDir, ".config/containers/systemd");
}

// Helpers for scope-aware file operations (uses sudo for system scope when not root)
async function readFileWithScope(path: string, scope: Scope): Promise<string> {
    if (scope === "system" && !isRoot()) {
        const { stdout } = await execFile("sudo", ["-n", "cat", path]);
        return stdout;
    }
    return readFile(path, "utf-8");
}

async function writeFileWithScope(path: string, content: string, scope: Scope): Promise<void> {
    if (scope === "system" && !isRoot()) {
        const { spawn } = await import("node:child_process");
        return new Promise((resolve, reject) => {
            const proc = spawn("sudo", ["-n", "tee", path], { stdio: ["pipe", "ignore", "pipe"] });
            let stderr = "";
            proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk; });
            proc.on("close", (code) => {
                if (code === 0) resolve();
                else reject(new Error(`sudo tee failed: ${stderr}`));
            });
            proc.stdin.write(content);
            proc.stdin.end();
        });
    }
    await writeFile(path, content, "utf-8");
}

async function unlinkWithScope(path: string, scope: Scope): Promise<void> {
    if (scope === "system" && !isRoot()) {
        await execFile("sudo", ["-n", "rm", path]);
        return;
    }
    await unlink(path);
}

async function readdirWithScope(dir: string, scope: Scope): Promise<string[]> {
    if (scope === "system" && !isRoot()) {
        try {
            const { stdout } = await execFile("sudo", ["-n", "ls", dir]);
            return stdout.trim().split("\n").filter(Boolean);
        } catch {
            return [];
        }
    }
    return readdir(dir);
}

async function accessWithScope(path: string, scope: Scope): Promise<boolean> {
    if (scope === "system" && !isRoot()) {
        try {
            await execFile("sudo", ["-n", "test", "-f", path]);
            return true;
        } catch {
            return false;
        }
    }
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function mkdirWithScope(dir: string, scope: Scope): Promise<void> {
    if (scope === "system" && !isRoot()) {
        await execFile("sudo", ["-n", "mkdir", "-p", dir]);
        return;
    }
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
}

function extensionToType(ext: string): QuadletType {
    return ext.slice(1) as QuadletType;
}

function filenameToServiceName(filename: string): string {
    return basename(filename, extname(filename)) + ".service";
}

function validateFilename(filename: string): void {
    if (!FILENAME_PATTERN.test(filename)) {
        throw new Error(
            `Invalid quadlet filename: "${filename}". Must match pattern: name.(container|network|volume)`
        );
    }
}

export async function listQuadlets(scope: Scope, user: AuthUser): Promise<QuadletListItem[]> {
    const dir = getQuadletDir(scope, user);

    let entries: string[];
    try {
        entries = await readdirWithScope(dir, scope);
    } catch {
        return [];
    }

    const files = entries
        .filter((f) => VALID_EXTENSIONS.has(extname(f)))
        .sort();

    const results = await Promise.all(
        files.map(async (filename) => {
            const serviceName = filenameToServiceName(filename);
            const status = await getServiceStatus(serviceName, scope);
            return {
                name: basename(filename, extname(filename)),
                type: extensionToType(extname(filename)),
                filename,
                serviceName,
                activeState: status.activeState,
                scope,
            };
        })
    );

    return results;
}

export async function listAllQuadlets(user: AuthUser): Promise<QuadletListItem[]> {
    const results = await Promise.all([
        listQuadlets("user", user),
        user.hasSudo ? listQuadlets("system", user) : Promise.resolve([]),
    ]);
    return [...results[0], ...results[1]];
}

export async function getQuadlet(filename: string, scope: Scope, user: AuthUser): Promise<QuadletFile> {
    validateFilename(filename);
    const dir = getQuadletDir(scope, user);
    const filePath = join(dir, filename);
    const content = await readFileWithScope(filePath, scope);
    const ext = extname(filename);

    return {
        name: basename(filename, ext),
        type: extensionToType(ext),
        filename,
        path: filePath,
        content,
        serviceName: filenameToServiceName(filename),
        scope,
    };
}

export async function saveQuadlet(
    filename: string,
    content: string,
    scope: Scope,
    user: AuthUser
): Promise<void> {
    validateFilename(filename);
    const dir = getQuadletDir(scope, user);
    const filePath = join(dir, filename);
    await writeFileWithScope(filePath, content, scope);
    await daemonReload(scope);
}

export async function createQuadlet(
    filename: string,
    content: string,
    scope: Scope,
    user: AuthUser
): Promise<void> {
    validateFilename(filename);
    const dir = getQuadletDir(scope, user);
    const filePath = join(dir, filename);

    if (await accessWithScope(filePath, scope)) {
        throw new Error(`Quadlet file already exists: ${filename}`);
    }

    await mkdirWithScope(dir, scope);
    await writeFileWithScope(filePath, content, scope);
    await daemonReload(scope);
}

export async function deleteQuadlet(
    filename: string,
    scope: Scope,
    user: AuthUser
): Promise<void> {
    validateFilename(filename);
    const dir = getQuadletDir(scope, user);
    const filePath = join(dir, filename);
    await unlinkWithScope(filePath, scope);
    await daemonReload(scope);
}
