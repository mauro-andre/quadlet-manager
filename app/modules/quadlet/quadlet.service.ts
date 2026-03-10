import { readdir, readFile, writeFile, unlink, access, mkdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import type { QuadletFile, QuadletListItem, QuadletType } from "./quadlet.types.js";
import type { AuthUser } from "../auth/auth.types.js";
import { daemonReload, getServiceStatus } from "../systemd/systemd.service.js";

const VALID_EXTENSIONS = new Set([".container", ".network", ".volume", ".pod"]);
const FILENAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(container|network|volume|pod)$/;

function getQuadletDir(user: AuthUser): string {
    if (process.env.QUADLET_DIR) return process.env.QUADLET_DIR;
    return join(user.homeDir, ".config/containers/systemd");
}

function extensionToType(ext: string): QuadletType {
    return ext.slice(1) as QuadletType;
}

function filenameToServiceName(filename: string): string {
    const name = basename(filename, extname(filename));
    const ext = extname(filename);
    if (ext === ".pod") return `${name}-pod.service`;
    if (ext === ".volume") return `${name}-volume.service`;
    if (ext === ".network") return `${name}-network.service`;
    return `${name}.service`;
}

function validateFilename(filename: string): void {
    if (!FILENAME_PATTERN.test(filename)) {
        throw new Error(
            `Invalid quadlet filename: "${filename}". Must match pattern: name.(container|network|volume|pod)`
        );
    }
}

export async function listQuadlets(user: AuthUser): Promise<QuadletListItem[]> {
    const dir = getQuadletDir(user);

    let entries: string[];
    try {
        entries = await readdir(dir);
    } catch {
        return [];
    }

    const files = entries
        .filter((f) => VALID_EXTENSIONS.has(extname(f)))
        .sort();

    const results = await Promise.all(
        files.map(async (filename) => {
            const serviceName = filenameToServiceName(filename);
            const status = await getServiceStatus(serviceName);

            let image: string | undefined;
            if (extname(filename) === ".container") {
                const content = await readFile(join(dir, filename), "utf-8").catch(() => "");
                const match = content.match(/^Image\s*=\s*(.+)$/m);
                if (match) image = match[1]!.trim();
            }

            return {
                name: basename(filename, extname(filename)),
                type: extensionToType(extname(filename)),
                filename,
                serviceName,
                activeState: status.activeState,
                image,
            };
        })
    );

    return results;
}

export async function getQuadlet(filename: string, user: AuthUser): Promise<QuadletFile> {
    validateFilename(filename);
    const dir = getQuadletDir(user);
    const filePath = join(dir, filename);
    const content = await readFile(filePath, "utf-8");
    const ext = extname(filename);

    return {
        name: basename(filename, ext),
        type: extensionToType(ext),
        filename,
        path: filePath,
        content,
        serviceName: filenameToServiceName(filename),
    };
}

export async function saveQuadlet(filename: string, content: string, user: AuthUser): Promise<void> {
    validateFilename(filename);
    const dir = getQuadletDir(user);
    const filePath = join(dir, filename);
    await writeFile(filePath, content, "utf-8");
    await daemonReload();
}

export async function createQuadlet(filename: string, content: string, user: AuthUser): Promise<void> {
    validateFilename(filename);
    const dir = getQuadletDir(user);
    const filePath = join(dir, filename);

    try {
        await access(filePath);
        throw new Error(`Quadlet file already exists: ${filename}`);
    } catch (err) {
        if (err instanceof Error && err.message.includes("already exists")) throw err;
    }

    await mkdir(dir, { recursive: true });
    await writeFile(filePath, content, "utf-8");
    await daemonReload();
}

export async function deleteQuadlet(filename: string, user: AuthUser): Promise<void> {
    validateFilename(filename);
    const dir = getQuadletDir(user);
    const filePath = join(dir, filename);
    await unlink(filePath);
    await daemonReload();
}
