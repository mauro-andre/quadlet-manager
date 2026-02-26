import { readdir, readFile, writeFile, unlink, access } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { homedir } from "node:os";
import type { QuadletFile, QuadletListItem, QuadletType } from "./quadlet.types.js";
import { daemonReload, getServiceStatus } from "../systemd/systemd.service.js";

const VALID_EXTENSIONS = new Set([".container", ".network", ".volume"]);

const FILENAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(container|network|volume)$/;

function getQuadletDir(): string {
    if (process.env.QUADLET_DIR) return process.env.QUADLET_DIR;

    const rootfulDir = "/etc/containers/systemd";
    const rootlessDir = join(
        process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
        "containers/systemd"
    );

    return process.getuid?.() === 0 ? rootfulDir : rootlessDir;
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

export async function listQuadlets(): Promise<QuadletListItem[]> {
    const dir = getQuadletDir();

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
            return {
                name: basename(filename, extname(filename)),
                type: extensionToType(extname(filename)),
                filename,
                serviceName,
                activeState: status.activeState,
            };
        })
    );

    return results;
}

export async function getQuadlet(filename: string): Promise<QuadletFile> {
    validateFilename(filename);
    const dir = getQuadletDir();
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

export async function saveQuadlet(
    filename: string,
    content: string
): Promise<void> {
    validateFilename(filename);
    const dir = getQuadletDir();
    const filePath = join(dir, filename);
    await writeFile(filePath, content, "utf-8");
    await daemonReload();
}

export async function createQuadlet(
    filename: string,
    content: string
): Promise<void> {
    validateFilename(filename);
    const dir = getQuadletDir();
    const filePath = join(dir, filename);

    try {
        await access(filePath);
        throw new Error(`Quadlet file already exists: ${filename}`);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }

    await writeFile(filePath, content, "utf-8");
    await daemonReload();
}

export async function deleteQuadlet(filename: string): Promise<void> {
    validateFilename(filename);
    const dir = getQuadletDir();
    const filePath = join(dir, filename);
    await unlink(filePath);
    await daemonReload();
}
