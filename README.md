# Quadlet Manager

Web interface for managing Podman containers via Quadlets.

No existing tool covers this gap — Portainer doesn't support Quadlets, Cockpit doesn't manage them, and Podman Desktop is desktop-only. Quadlet Manager gives you a lightweight web UI to replace SSH for day-to-day Podman Quadlet operations.

## Features

- **Dashboard** — System overview with real-time CPU/memory graphs, container stats, and disk usage
- **Containers** — List, inspect, start/stop/restart, and monitor containers with live metrics and logs
- **Web Terminal** — Integrated terminal for host shell access and `podman exec` into containers, with full PTY support
- **Quadlets** — Create, edit, and delete `.container`, `.network`, `.volume` files with a built-in editor
- **Images** — Browse local images, pull new ones with real-time progress tracking, remove unused images
- **Volumes** — View and manage volumes with usage information
- **Reverse Proxy** — Built-in Caddy-based domain management with Let's Encrypt, custom certificates, or HTTP-only modes. Route to containers or host services with per-domain TLS control
- **Authentication** — PAM-based login with JWT sessions
- **Dual Scope** — Manage both system and user (rootless) Podman containers

## Requirements

- **Node.js** 20+
- **Python 3** (for PAM authentication and terminal PTY)
- **Podman** installed and running
- **systemd** (systemctl available)

## Installation

Run as root:

```bash
curl -fsSL https://raw.githubusercontent.com/mauro-andre/quadlet-manager/main/install.sh | bash -s -- 0.1.0
```

This will:
1. Download the pre-built release from GitHub
2. Install to `/opt/quadlet-manager`
3. Generate a `JWT_SECRET` (saved in `/opt/quadlet-manager/.env`)
4. Create and start a systemd service

After installation:
```bash
# Check status
systemctl status quadlet-manager

# View logs
journalctl -u quadlet-manager -f
```

Access the UI at `http://your-server:3000`.

## Updating

Run the same command with the new version:

```bash
curl -fsSL https://raw.githubusercontent.com/mauro-andre/quadlet-manager/main/install.sh | bash -s -- 0.2.0
```

Your data (databases, proxy config, certificates, JWT secret) is preserved between updates.

## Configuration

The systemd service file is at `/etc/systemd/system/quadlet-manager.service`. Default environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `3000` | Server port |
| `NODE_ENV` | `production` | Environment mode |
| `JWT_SECRET` | Auto-generated | JWT signing secret (in `.env`) |

To change settings, edit the service file and restart:
```bash
systemctl edit quadlet-manager  # creates an override
systemctl restart quadlet-manager
```

## License

MIT
