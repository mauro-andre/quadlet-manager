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

const processUid = () => process.getuid?.() ?? 0;
const isRoot = () => processUid() === 0;

// Returns command prefix for running as the right user
// - system scope + non-root → sudo -n
// - user scope + different user + root → runuser -u
// - user scope + different user + non-root → sudo -n -u
// - otherwise → [] (direct execution)
function cmdPrefix(scope: Scope, user?: AuthUser): string[] {
    if (scope === "system" && !isRoot()) {
        return ["sudo", "-n"];
    }
    if (scope === "user" && user && user.uid !== processUid()) {
        if (isRoot()) {
            return ["runuser", "-u", user.username, "--"];
        }
        return ["sudo", "-n", "-u", user.username];
    }
    return [];
}

function getQuadletDir(scope: Scope, user: AuthUser): string {
    if (process.env.QUADLET_DIR) return process.env.QUADLET_DIR;

    if (scope === "system") {
        return "/etc/containers/systemd";
    }
    return join(user.homeDir, ".config/containers/systemd");
}

function prefixCmd(prefix: string[], ...args: string[]): [string, string[]] {
    const [cmd, ...rest] = prefix;
    return [cmd!, [...rest, ...args]];
}

async function readFileWithScope(path: string, scope: Scope, user?: AuthUser): Promise<string> {
    const prefix = cmdPrefix(scope, user);
    if (prefix.length > 0) {
        const [cmd, args] = prefixCmd(prefix, "cat", path);
        const { stdout } = await execFile(cmd, args, { encoding: "utf-8" });
        return stdout;
    }
    return readFile(path, "utf-8");
}

async function writeFileWithScope(path: string, content: string, scope: Scope, user?: AuthUser): Promise<void> {
    const prefix = cmdPrefix(scope, user);
    if (prefix.length > 0) {
        const { spawn } = await import("node:child_process");
        const [cmd, args] = prefixCmd(prefix, "tee", path);
        return new Promise((resolve, reject) => {
            const proc = spawn(cmd, args, {
                stdio: ["pipe", "ignore", "pipe"],
            });
            let stderr = "";
            proc.stderr!.on("data", (chunk: Buffer) => { stderr += chunk; });
            proc.on("close", (code: number | null) => {
                if (code === 0) resolve();
                else reject(new Error(`write failed (${cmd}): ${stderr}`));
            });
            proc.stdin!.write(content);
            proc.stdin!.end();
        });
    }
    await writeFile(path, content, "utf-8");
}

async function unlinkWithScope(path: string, scope: Scope, user?: AuthUser): Promise<void> {
    const prefix = cmdPrefix(scope, user);
    if (prefix.length > 0) {
        const [cmd, args] = prefixCmd(prefix, "rm", path);
        await execFile(cmd, args);
        return;
    }
    await unlink(path);
}

async function readdirWithScope(dir: string, scope: Scope, user?: AuthUser): Promise<string[]> {
    const prefix = cmdPrefix(scope, user);
    if (prefix.length > 0) {
        try {
            const [cmd, args] = prefixCmd(prefix, "ls", dir);
            const { stdout } = await execFile(cmd, args, { encoding: "utf-8" });
            return stdout.trim().split("\n").filter(Boolean);
        } catch {
            return [];
        }
    }
    return readdir(dir);
}

async function accessWithScope(path: string, scope: Scope, user?: AuthUser): Promise<boolean> {
    const prefix = cmdPrefix(scope, user);
    if (prefix.length > 0) {
        try {
            const [cmd, args] = prefixCmd(prefix, "test", "-f", path);
            await execFile(cmd, args);
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

async function mkdirWithScope(dir: string, scope: Scope, user?: AuthUser): Promise<void> {
    const prefix = cmdPrefix(scope, user);
    if (prefix.length > 0) {
        const [cmd, args] = prefixCmd(prefix, "mkdir", "-p", dir);
        await execFile(cmd, args);
        return;
    }
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
}

function extensionToType(ext: string): QuadletType {
    return ext.slice(1) as QuadletType;
}

function filenameToServiceName(filename: string): string {
    const name = basename(filename, extname(filename));
    const ext = extname(filename);
    // Podman quadlet generator naming convention:
    // .container → name.service
    // .volume   → name-volume.service
    // .network  → name-network.service
    if (ext === ".volume") return `${name}-volume.service`;
    if (ext === ".network") return `${name}-network.service`;
    return `${name}.service`;
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
        entries = await readdirWithScope(dir, scope, user);
    } catch {
        return [];
    }

    const files = entries
        .filter((f) => VALID_EXTENSIONS.has(extname(f)))
        .sort();

    const results = await Promise.all(
        files.map(async (filename) => {
            const serviceName = filenameToServiceName(filename);
            const status = await getServiceStatus(serviceName, scope, user);
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
    const content = await readFileWithScope(filePath, scope, user);
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
    await writeFileWithScope(filePath, content, scope, user);
    await daemonReload(scope, user);
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

    if (await accessWithScope(filePath, scope, user)) {
        throw new Error(`Quadlet file already exists: ${filename}`);
    }

    await mkdirWithScope(dir, scope, user);
    await writeFileWithScope(filePath, content, scope, user);
    await daemonReload(scope, user);
}

export async function deleteQuadlet(
    filename: string,
    scope: Scope,
    user: AuthUser
): Promise<void> {
    validateFilename(filename);
    const dir = getQuadletDir(scope, user);
    const filePath = join(dir, filename);
    await unlinkWithScope(filePath, scope, user);
    await daemonReload(scope, user);
}
