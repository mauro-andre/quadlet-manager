# Quadlet Manager

A lightweight web UI for managing Podman containers via Quadlets on Linux servers.

No existing tool covers this gap — Portainer doesn't support Quadlets, Cockpit doesn't manage them, and Podman Desktop is desktop-only. Quadlet Manager replaces SSH for day-to-day Podman Quadlet operations.

## Features

- **Dashboard** — Real-time CPU/memory graphs, container stats, and disk usage overview
- **Containers** — List, inspect, start/stop/restart, prune, and monitor with live metrics
- **Quadlet Editor** — Create, edit, and delete `.container`, `.network`, `.volume`, `.pod` quadlet files
- **Systemd Units** — Create and manage custom systemd user services
- **Images** — Pull with real-time progress, check for updates, prune dangling images
- **Volumes** — Manage volumes with size and usage info, prune unused
- **Networks** — View, manage, and prune unused networks
- **Registries** — Configure container registries
- **Domains** — Built-in Caddy reverse proxy with Let's Encrypt, custom certificates, or HTTP-only mode
- **Backups** — Scheduled backups to S3-compatible storage with restore, supports raw volumes, sync, and database dumps
- **Web Terminal** — Full PTY terminal for host shell access and `podman exec` into containers
- **Settings** — Check for updates and self-update from the web UI
- **Authentication** — PAM-based login with JWT sessions, httpOnly cookies
- **Real-time Logs** — Stream journalctl logs directly in the browser

## Requirements

- **Linux** with **systemd** (RHEL/Fedora, Debian/Ubuntu, Arch)

All dependencies are installed automatically by the setup script:
- Node.js 22, Podman, Python 3, skopeo, rclone

## Installation

### First-time server setup

Run as root or a user with sudo. This interactive script installs system dependencies, creates a user, and prepares the server:

```bash
curl -fsSL https://github.com/mauro-andre/quadlet-manager/releases/latest/download/setup.sh | bash
```

The setup will:
1. Let you select an existing user or create a new one (without sudo)
2. Install Node.js 22, Podman, Python 3 if missing (RHEL/Fedora, Debian/Ubuntu, Arch)
3. Install skopeo and rclone if missing
4. Enable user linger and persistent journal

### Install Quadlet Manager

After setup, switch to your user and run the installer (no sudo required):

```bash
su - your-user
curl -fsSL https://github.com/mauro-andre/quadlet-manager/releases/latest/download/install.sh | bash
```

This will:
1. Download the latest release from GitHub
2. Install to `~/.local/share/quadlet-manager`
3. Generate a JWT secret (saved in `~/.local/share/quadlet-manager/.env`)
4. Create and start a systemd user service

After installation:
```bash
# Check status
systemctl --user status quadlet-manager

# View logs
journalctl --user -u quadlet-manager -f
```

Access the UI at `http://your-server:3000` and login with your Linux user credentials.

## Updating

Re-run the install script as your user — no sudo required:

```bash
curl -fsSL https://github.com/mauro-andre/quadlet-manager/releases/latest/download/install.sh | bash
```

Or update directly from the **Settings** page in the web UI.

Your data (databases, backup configs, proxy settings, JWT secret) is preserved between updates.

## Configuration

The systemd service file is at `~/.config/systemd/user/quadlet-manager.service`. Default environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `3000` | Server port |
| `NODE_ENV` | `production` | Environment mode |
| `JWT_SECRET` | Auto-generated | JWT signing secret (in `.env`) |
| `PODMAN_SOCKET` | Auto-detected | Podman Unix socket path |
| `QUADLET_DIR` | `~/.config/containers/systemd` | Quadlet files directory |

To change settings:
```bash
systemctl --user edit quadlet-manager  # creates an override
systemctl --user restart quadlet-manager
```

## License

MIT
