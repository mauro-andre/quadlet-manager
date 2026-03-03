import { execFile as execFileCb, spawn } from "node:child_process";
import { promisify } from "node:util";
import { sign, verify } from "hono/jwt";
import type { AuthUser } from "./auth.types.js";

const execFile = promisify(execFileCb);

const USERNAME_PATTERN = /^[a-z_][a-z0-9_-]*$/;

import { randomBytes } from "node:crypto";

const JWT_SECRET =
    process.env.JWT_SECRET ||
    (() => {
        const secret = randomBytes(32).toString("hex");
        console.log("[auth] Generated random JWT secret (set JWT_SECRET env to persist across restarts)");
        return secret;
    })();

function validateUsername(username: string): void {
    if (!USERNAME_PATTERN.test(username)) {
        throw new Error("Invalid username");
    }
}

// Authenticate via `su` using a PTY (avoids pam_fprintd hang)
const SU_AUTH_SCRIPT = `
import pty, os, sys, select

username = sys.argv[1]
password = sys.argv[2]

pid, fd = pty.fork()
if pid == 0:
    os.execvp("su", ["su", "-c", "true", "--", username])

# Parent: wait for password prompt, send password
buf = b""
while True:
    r, _, _ = select.select([fd], [], [], 5)
    if not r:
        os.close(fd)
        os.waitpid(pid, 0)
        sys.exit(1)
    try:
        data = os.read(fd, 4096)
    except OSError:
        break
    if not data:
        break
    buf += data
    lower = buf.lower()
    if b"password:" in lower or b"senha:" in lower:
        os.write(fd, (password + "\\n").encode())
        break

# Wait for process to finish
while True:
    r, _, _ = select.select([fd], [], [], 5)
    if not r:
        break
    try:
        os.read(fd, 4096)
    except OSError:
        break

os.close(fd)
_, status = os.waitpid(pid, 0)
sys.exit(0 if os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0 else 1)
`;

async function pamAuthenticate(username: string, password: string): Promise<void> {
    validateUsername(username);

    return new Promise((resolve, reject) => {
        const proc = spawn("python3", ["-c", SU_AUTH_SCRIPT, username, password], {
            stdio: ["ignore", "pipe", "pipe"],
            timeout: 10_000,
        });

        let stderr = "";
        proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk; });

        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error("Invalid username or password"));
            }
        });

        proc.on("error", (err) => {
            reject(new Error(`Authentication service unavailable: ${err.message}`));
        });
    });
}

export async function getUserInfo(username: string): Promise<Omit<AuthUser, "hasSudo">> {
    validateUsername(username);

    const [uidRes, gidRes, groupsRes, homeRes] = await Promise.all([
        execFile("id", ["-u", username]),
        execFile("id", ["-g", username]),
        execFile("id", ["-Gn", username]),
        execFile("bash", ["-c", `eval echo ~${username}`]),
    ]);

    return {
        username,
        uid: parseInt(uidRes.stdout.trim(), 10),
        gid: parseInt(gidRes.stdout.trim(), 10),
        groups: groupsRes.stdout.trim().split(/\s+/),
        homeDir: homeRes.stdout.trim(),
    };
}

export async function authenticate(username: string, password: string): Promise<AuthUser> {
    await pamAuthenticate(username, password);
    const info = await getUserInfo(username);
    const hasSudo = info.groups.includes("wheel") || info.groups.includes("sudo");
    return { ...info, hasSudo };
}

export async function createToken(user: AuthUser): Promise<string> {
    const payload = {
        sub: user.username,
        uid: user.uid,
        gid: user.gid,
        groups: user.groups,
        hasSudo: user.hasSudo,
        homeDir: user.homeDir,
        exp: Math.floor(Date.now() / 1000) + 86400, // 24h
    };
    return sign(payload, JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthUser> {
    const payload = await verify(token, JWT_SECRET, "HS256");
    return {
        username: payload.sub as string,
        uid: payload.uid as number,
        gid: payload.gid as number,
        groups: payload.groups as string[],
        hasSudo: payload.hasSudo as boolean,
        homeDir: payload.homeDir as string,
    };
}
