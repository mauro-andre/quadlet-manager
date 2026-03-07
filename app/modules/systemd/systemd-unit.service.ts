import { readdir, readFile, writeFile, unlink, access, mkdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import type { AuthUser } from "../auth/auth.types.js";
import { daemonReload, getServiceStatus } from "./systemd.service.js";

export type SystemdUnitType = "service" | "timer";

export interface SystemdUnitListItem {
    name: string;
    type: SystemdUnitType;
    filename: string;
    serviceName: string;
    activeState: string;
}

export interface SystemdUnitFile {
    name: string;
    type: SystemdUnitType;
    filename: string;
    path: string;
    content: string;
    serviceName: string;
}

const VALID_EXTENSIONS = new Set([".service", ".timer"]);
const FILENAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(service|timer)$/;

function getUnitDir(user: AuthUser): string {
    return join(user.homeDir, ".config/systemd/user");
}

function extensionToType(ext: string): SystemdUnitType {
    return ext.slice(1) as SystemdUnitType;
}

function validateFilename(filename: string): void {
    if (!FILENAME_PATTERN.test(filename)) {
        throw new Error(
            `Invalid unit filename: "${filename}". Must match pattern: name.(service|timer)`
        );
    }
}

export async function listUnits(user: AuthUser): Promise<SystemdUnitListItem[]> {
    const dir = getUnitDir(user);

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
            const serviceName = filename; // .service and .timer are used as-is
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

export async function getUnit(filename: string, user: AuthUser): Promise<SystemdUnitFile> {
    validateFilename(filename);
    const dir = getUnitDir(user);
    const filePath = join(dir, filename);
    const content = await readFile(filePath, "utf-8");
    const ext = extname(filename);

    return {
        name: basename(filename, ext),
        type: extensionToType(ext),
        filename,
        path: filePath,
        content,
        serviceName: filename,
    };
}

export async function saveUnit(filename: string, content: string, user: AuthUser): Promise<void> {
    validateFilename(filename);
    const dir = getUnitDir(user);
    const filePath = join(dir, filename);
    await writeFile(filePath, content, "utf-8");
    await daemonReload();
}

export async function createUnit(filename: string, content: string, user: AuthUser): Promise<void> {
    validateFilename(filename);
    const dir = getUnitDir(user);
    const filePath = join(dir, filename);

    try {
        await access(filePath);
        throw new Error(`Unit file already exists: ${filename}`);
    } catch (err) {
        if (err instanceof Error && err.message.includes("already exists")) throw err;
    }

    await mkdir(dir, { recursive: true });
    await writeFile(filePath, content, "utf-8");
    await daemonReload();
}

export async function deleteUnit(filename: string, user: AuthUser): Promise<void> {
    validateFilename(filename);
    const dir = getUnitDir(user);
    const filePath = join(dir, filename);
    await unlink(filePath);
    await daemonReload();
}
