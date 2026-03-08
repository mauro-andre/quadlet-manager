# Quadlet Manager

A lightweight web UI for managing Podman containers via Quadlets on Linux servers.

No existing tool covers this gap — Portainer doesn't support Quadlets, Cockpit doesn't manage them, and Podman Desktop is desktop-only. Quadlet Manager replaces SSH for day-to-day Podman Quadlet operations.

## Features

- **Dashboard** — Real-time CPU/memory graphs, container stats, and disk usage overview
- **Containers** — List, inspect, start/stop/restart, prune, and monitor with live metrics
- **Quadlet Editor** — Create, edit, and delete `.container`, `.network`, `.volume` quadlet files
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

- **Linux** with **systemd**
- **Node.js** 20+
- **Podman** installed and running
- **Python 3** (for PAM authentication and terminal PTY)

Optional (installed automatically if missing):
- **skopeo** — for image update checks
- **rclone** — for backups

## Installation

Run as your regular user (not root):

```bash
curl -fsSL https://github.com/mauro-andre/quadlet-manager/releases/latest/download/install.sh | bash
```

This will:
1. Download the latest release from GitHub
2. Install to `~/.local/share/quadlet-manager`
3. Generate a JWT secret (saved in `~/.local/share/quadlet-manager/.env`)
4. Enable user linger for persistent services
5. Create and start a systemd user service

After installation:
```bash
# Check status
systemctl --user status quadlet-manager

# View logs
journalctl --user -u quadlet-manager -f
```

Access the UI at `http://your-server:3000` and login with your Linux user credentials.

## Updating

Re-run the install script — it will download the latest version and preserve your data:

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
