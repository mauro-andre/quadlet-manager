import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

export type ImageUpdateStatus =
    | "up-to-date"
    | "update-available"
    | "restart-pending"
    | "tag-removed"
    | "unknown";

export interface ImageCheckResult {
    status: ImageUpdateStatus;
    needsPull: boolean;
    needsRestart: boolean;
}

function normalizeImageRef(ref: string): string {
    // localhost/ images are local builds — don't prepend docker.io
    if (ref.startsWith("localhost/")) return ref;

    if (!ref.includes("/")) {
        ref = `docker.io/library/${ref}`;
    } else if (!ref.includes(".") && ref.split("/").length === 2) {
        ref = `docker.io/${ref}`;
    }
    if (!ref.includes(":") && !ref.includes("@")) {
        ref += ":latest";
    }
    return ref;
}

/** Returns true if the image is a local build (no remote registry to check) */
function isLocalImage(ref: string): boolean {
    return ref.startsWith("localhost/");
}

async function getRemoteDigest(
    imageRef: string
): Promise<{ digest: string | null; tagExists: boolean }> {
    try {
        const { stdout } = await execFile(
            "skopeo",
            ["inspect", "--no-tags", `docker://${imageRef}`],
            { encoding: "utf-8", timeout: 30_000 }
        );
        const data = JSON.parse(stdout);
        return { digest: data.Digest ?? null, tagExists: true };
    } catch (err) {
        const msg = (err as Error).message || "";
        if (msg.includes("manifest unknown") || msg.includes("not found")) {
            return { digest: null, tagExists: false };
        }
        return { digest: null, tagExists: true };
    }
}

/**
 * Extract all digests from RepoDigests.
 * RepoDigests entries look like: "docker.io/library/mongo@sha256:abc..."
 */
function extractDigests(repoDigests: string[] | null): string[] {
    if (!repoDigests) return [];
    const digests: string[] = [];
    for (const rd of repoDigests) {
        const atIdx = rd.lastIndexOf("@");
        if (atIdx > 0) digests.push(rd.slice(atIdx + 1));
    }
    return digests;
}

/** Run async tasks with limited concurrency */
async function mapConcurrent<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let idx = 0;

    async function worker() {
        while (idx < items.length) {
            const i = idx++;
            results[i] = await fn(items[i]!);
        }
    }

    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
    );
    return results;
}

export async function checkImageUpdates(
    imageRefs: string[],
    checkContainers: boolean = true
): Promise<Record<string, ImageCheckResult>> {
    const { listImages, listContainers } = await import(
        "../podman/podman.client.js"
    );

    const [images, containers] = await Promise.all([
        listImages(),
        checkContainers ? listContainers() : Promise.resolve([]),
    ]);

    // Deduplicate and filter out local images
    const uniqueRefs = [...new Set(imageRefs)].filter((ref) => !isLocalImage(ref));
    const results: Record<string, ImageCheckResult> = {};

    // Mark local images as skipped
    for (const ref of imageRefs) {
        if (isLocalImage(ref)) {
            results[ref] = { status: "up-to-date", needsPull: false, needsRestart: false };
        }
    }

    // Check remote images with limited concurrency (3 at a time)
    await mapConcurrent(uniqueRefs, 3, async (imageRef) => {
        const normalized = normalizeImageRef(imageRef);

        // Find local image by matching tags
        const localImage = images.find((img) =>
            img.RepoTags?.some(
                (tag) => normalizeImageRef(tag) === normalized
            )
        );

        if (!localImage) {
            results[imageRef] = {
                status: "unknown",
                needsPull: false,
                needsRestart: false,
            };
            return;
        }

        // Get remote digest
        const remote = await getRemoteDigest(normalized);

        if (!remote.tagExists) {
            results[imageRef] = {
                status: "tag-removed",
                needsPull: false,
                needsRestart: false,
            };
            return;
        }

        if (!remote.digest) {
            results[imageRef] = {
                status: "unknown",
                needsPull: false,
                needsRestart: false,
            };
            return;
        }

        const localDigests = extractDigests(localImage.RepoDigests);
        const hasUpdate = !localDigests.includes(remote.digest);

        // Check if any container using this image needs restart
        const container = containers.find(
            (ct) => normalizeImageRef(ct.Image) === normalized
        );
        const needsRestart =
            container != null && container.ImageID !== localImage.Id;

        if (hasUpdate) {
            results[imageRef] = {
                status: "update-available",
                needsPull: true,
                needsRestart: true,
            };
        } else if (needsRestart) {
            results[imageRef] = {
                status: "restart-pending",
                needsPull: false,
                needsRestart: true,
            };
        } else {
            results[imageRef] = {
                status: "up-to-date",
                needsPull: false,
                needsRestart: false,
            };
        }
    });

    return results;
}
