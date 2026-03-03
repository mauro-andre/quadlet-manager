import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { AuthUser, Scope } from "../auth/auth.types.js";

// Python script that creates a real PTY and bridges stdin/stdout.
// Resize commands are sent as JSON lines on stdin: {"resize": [cols, rows]}
// All other stdin bytes are forwarded raw to the PTY.
// PTY output is forwarded raw to stdout.
const PTY_SCRIPT = `
import pty, os, sys, select, struct, fcntl, termios, json, signal

def set_winsize(fd, cols, rows):
    winsize = struct.pack('HHHH', rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

# Spawn the command in a PTY
pid, fd = pty.fork()
if pid == 0:
    # Child: exec the command
    os.execvp(sys.argv[1], sys.argv[1:])

# Parent: bridge stdin/stdout <-> PTY fd
# Set stdin to non-blocking raw mode
os.set_blocking(0, False)
os.set_blocking(fd, False)

buf = b""

while True:
    try:
        rfds, _, _ = select.select([0, fd], [], [], 1.0)
    except (select.error, ValueError):
        break

    if 0 in rfds:
        try:
            data = os.read(0, 65536)
        except OSError:
            break
        if not data:
            break

        # Check for JSON resize commands (newline-delimited)
        buf += data
        while b"\\n" in buf:
            line, buf = buf.split(b"\\n", 1)
            try:
                msg = json.loads(line)
                if "resize" in msg:
                    cols, rows = msg["resize"]
                    set_winsize(fd, cols, rows)
                    # Send SIGWINCH to the child process group
                    os.kill(pid, signal.SIGWINCH)
                    continue
            except (json.JSONDecodeError, KeyError, ValueError):
                pass
            # Not a command - forward raw bytes to PTY
            try:
                os.write(fd, line + b"\\n")
            except OSError:
                break

        # Forward any remaining non-newline data as raw input
        if buf:
            # Check if it could be a partial JSON command
            # If it starts with '{', buffer it waiting for newline
            if not buf.startswith(b"{"):
                try:
                    os.write(fd, buf)
                except OSError:
                    break
                buf = b""

    if fd in rfds:
        try:
            data = os.read(fd, 65536)
        except OSError:
            break
        if not data:
            break
        try:
            os.write(1, data)
            sys.stdout.flush() if hasattr(sys.stdout, 'flush') else None
        except OSError:
            break

# Wait for child and exit with its status
try:
    os.close(fd)
except OSError:
    pass
_, status = os.waitpid(pid, 0)
code = os.WEXITSTATUS(status) if os.WIFEXITED(status) else 1
sys.exit(code)
`;

export interface TerminalSession {
    id: string;
    process: ChildProcess;
    cols: number;
    rows: number;
}

const sessions = new Map<string, TerminalSession>();

function generateId(): string {
    return randomBytes(16).toString("hex");
}

function buildEnv(user: AuthUser): Record<string, string> {
    return {
        ...process.env as Record<string, string>,
        HOME: user.homeDir,
        USER: user.username,
        LOGNAME: user.username,
        SHELL: process.env.SHELL || "/bin/bash",
        TERM: "xterm-256color",
    };
}

export function createHostTerminal(
    user: AuthUser,
    cols: number,
    rows: number,
): TerminalSession {
    const id = generateId();
    const shell = process.env.SHELL || "/bin/bash";

    const args = ["-c", PTY_SCRIPT, shell, "--login"];

    // If running as root, use runuser to spawn as the logged-in user
    let cmd: string;
    let cmdArgs: string[];

    if (process.getuid?.() === 0) {
        cmd = "runuser";
        cmdArgs = ["-u", user.username, "--", "python3", ...args];
    } else {
        cmd = "python3";
        cmdArgs = args;
    }

    const proc = spawn(cmd, cmdArgs, {
        stdio: ["pipe", "pipe", "pipe"],
        env: buildEnv(user),
        cwd: user.homeDir,
    });

    // Set initial size
    sendResize(proc, cols, rows);

    const session: TerminalSession = { id, process: proc, cols, rows };
    sessions.set(id, session);

    proc.on("exit", () => {
        sessions.delete(id);
    });

    return session;
}

export function createContainerTerminal(
    user: AuthUser,
    containerName: string,
    scope: Scope,
    cols: number,
    rows: number,
): TerminalSession {
    const id = generateId();

    // Build the podman exec command
    // Try bash first for better UX (readline, tab completion, PS1),
    // fall back to sh for minimal containers (alpine, busybox, etc.)
    const podmanArgs = [
        "exec", "-it",
        "-e", "TERM=xterm-256color",
        containerName,
        "sh", "-c", "bash || exec sh",
    ];
    let execCmd: string[];

    if (scope === "system") {
        execCmd = ["sudo", "-n", "podman", ...podmanArgs];
    } else {
        execCmd = ["podman", ...podmanArgs];
    }

    const args = ["-c", PTY_SCRIPT, ...execCmd];

    let cmd: string;
    let cmdArgs: string[];

    if (process.getuid?.() === 0 && scope === "user") {
        cmd = "runuser";
        cmdArgs = ["-u", user.username, "--", "python3", ...args];
    } else {
        cmd = "python3";
        cmdArgs = args;
    }

    const env = buildEnv(user);
    if (scope === "user") {
        env.XDG_RUNTIME_DIR = `/run/user/${user.uid}`;
    }

    const proc = spawn(cmd, cmdArgs, {
        stdio: ["pipe", "pipe", "pipe"],
        env,
        cwd: user.homeDir,
    });

    // Set initial size
    sendResize(proc, cols, rows);

    const session: TerminalSession = { id, process: proc, cols, rows };
    sessions.set(id, session);

    proc.on("exit", () => {
        sessions.delete(id);
    });

    return session;
}

function sendResize(proc: ChildProcess, cols: number, rows: number): void {
    if (proc.stdin?.writable) {
        proc.stdin.write(JSON.stringify({ resize: [cols, rows] }) + "\n");
    }
}

export function getSession(id: string): TerminalSession | undefined {
    return sessions.get(id);
}

export function resizeSession(id: string, cols: number, rows: number): void {
    const session = sessions.get(id);
    if (!session) return;

    session.cols = cols;
    session.rows = rows;
    sendResize(session.process, cols, rows);
}

export function destroySession(id: string): void {
    const session = sessions.get(id);
    if (!session) return;

    sessions.delete(id);
    session.process.kill();
}
