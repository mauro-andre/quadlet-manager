import { readFile, writeFile } from "node:fs/promises";
import { execFile as execFileCb, spawn } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const execFile = promisify(execFileCb);

const INSTALL_DIR = "/opt/quadlet-manager";
const GITHUB_API = "https://api.github.com/repos/mauro-andre/quadlet-manager/releases/latest";

export interface UpdateInfo {
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    releaseNotes: string;
    publishedAt: string;
    tarballUrl: string;
}

export async function getCurrentVersion(): Promise<string> {
    const pkg = JSON.parse(
        await readFile(join(INSTALL_DIR, "package.json"), "utf-8").catch(() =>
            readFile(join(process.cwd(), "package.json"), "utf-8")
        )
    );
    return pkg.version;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
    const currentVersion = await getCurrentVersion();

    let data: {
        tag_name: string;
        body?: string;
        published_at?: string;
        assets?: { name: string; browser_download_url: string }[];
    };

    try {
        const { stdout } = await execFile("curl", [
            "-fsSL",
            "-H", "Accept: application/vnd.github+json",
            GITHUB_API,
        ], { encoding: "utf-8", timeout: 15_000 });
        data = JSON.parse(stdout);
    } catch {
        return {
            currentVersion,
            latestVersion: currentVersion,
            hasUpdate: false,
            releaseNotes: "",
            publishedAt: "",
            tarballUrl: "",
        };
    }

    const latestVersion = (data.tag_name ?? "").replace(/^v/, "");
    const tarballAsset = data.assets?.find((a) => a.name.endsWith(".tar.gz"));

    return {
        currentVersion,
        latestVersion,
        hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
        releaseNotes: data.body ?? "",
        publishedAt: data.published_at ?? "",
        tarballUrl: tarballAsset?.browser_download_url ?? "",
    };
}

export async function performUpdate(version: string, tarballUrl: string): Promise<{ ok: boolean; error?: string }> {
    const tmpArchive = "/tmp/qm-update.tar.gz";
    const tmpDir = "/tmp/qm-update";

    try {
        // 1. Download tarball
        await execFile("curl", ["-fSL", "-o", tmpArchive, tarballUrl], {
            timeout: 120_000,
        });

        // 2. Extract
        await execFile("mkdir", ["-p", tmpDir]);
        await execFile("tar", ["xzf", tmpArchive, "--strip-components=1", "-C", tmpDir], {
            timeout: 60_000,
        });

        // 3. Remove old files (preserve .data/ and .env)
        for (const dir of ["dist", "node_modules", "velojs"]) {
            await execFile("rm", ["-rf", join(INSTALL_DIR, dir)]).catch(() => {});
        }
        await execFile("rm", ["-f", join(INSTALL_DIR, "package.json")]).catch(() => {});

        // 4. Copy new files
        for (const item of ["dist", "node_modules", "package.json", "velojs"]) {
            await execFile("cp", ["-a", join(tmpDir, item), join(INSTALL_DIR, item)]).catch(() => {});
        }

        // 5. Stamp installed version into package.json
        const pkgPath = join(INSTALL_DIR, "package.json");
        const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
        pkg.version = version;
        await writeFile(pkgPath, JSON.stringify(pkg, null, 4) + "\n", "utf-8");

        // 6. Cleanup
        await execFile("rm", ["-rf", tmpDir, tmpArchive]).catch(() => {});

        // 7. Restart service (fire-and-forget — this kills us)
        const child = spawn("systemctl", ["restart", "quadlet-manager"], {
            detached: true,
            stdio: "ignore",
        });
        child.unref();

        return { ok: true };
    } catch (err) {
        // Cleanup on failure
        await execFile("rm", ["-rf", tmpDir, tmpArchive]).catch(() => {});
        return { ok: false, error: (err as Error).message };
    }
}

function compareVersions(a: string, b: string): number {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] ?? 0;
        const nb = pb[i] ?? 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}
