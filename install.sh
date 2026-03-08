#!/usr/bin/env bash
set -euo pipefail

VERSION="0.0.0"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE_NAME="quadlet-manager"
INSTALL_DIR="${HOME}/.local/share/quadlet-manager"
SERVICE_DIR="${HOME}/.config/systemd/user"
SERVICE_FILE="${SERVICE_DIR}/${SERVICE_NAME}.service"
ENV_FILE="${INSTALL_DIR}/.env"
REPO="mauro-andre/quadlet-manager"

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --- Checks ---

[[ $EUID -ne 0 ]] || error "Do not run this script as root. Run as the user that will manage Podman containers."

command -v node >/dev/null 2>&1 || error "Node.js is not installed. Install Node.js 20+ first: https://nodejs.org"
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
[[ $NODE_MAJOR -ge 20 ]] || error "Node.js 20+ is required (found $(node -v))"

command -v podman >/dev/null 2>&1 || error "Podman is not installed"
command -v systemctl >/dev/null 2>&1 || error "systemctl is not available"
command -v python3 >/dev/null 2>&1 || error "Python 3 is not installed (required for terminal PTY)"

# --- Install optional dependencies ---

if ! command -v skopeo >/dev/null 2>&1; then
    info "Installing skopeo (required for image update checks)..."
    if command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y skopeo >/dev/null 2>&1 || warn "Failed to install skopeo. Image update checks will not be available."
    elif command -v apt-get >/dev/null 2>&1; then
        sudo apt-get install -y skopeo >/dev/null 2>&1 || warn "Failed to install skopeo. Image update checks will not be available."
    else
        warn "Could not install skopeo — unsupported package manager. Image update checks will not be available."
    fi
fi

if ! command -v rclone >/dev/null 2>&1; then
    info "Installing rclone (required for backups)..."
    command -v unzip >/dev/null 2>&1 || warn "unzip is not installed — rclone installation may fail"
    curl -fsSL https://rclone.org/install.sh | sudo bash >/dev/null 2>&1 || warn "Failed to install rclone. Backups will not be available."
fi

# --- Enable linger ---

info "Enabling lingering for user $(whoami)..."
loginctl enable-linger "$(whoami)" 2>/dev/null || {
    warn "Could not enable linger. Trying with sudo..."
    sudo loginctl enable-linger "$(whoami)" || warn "Failed to enable linger. User services may not survive logout."
}

# --- Ensure persistent journal ---

if [[ ! -d /var/log/journal ]]; then
    info "Enabling persistent journal storage..."
    sudo mkdir -p /var/log/journal
    sudo journalctl --flush 2>/dev/null || true
fi

# --- Download ---

TARBALL_URL="https://github.com/${REPO}/releases/download/${VERSION}/quadlet-manager-${VERSION}-linux-x64.tar.gz"
TARBALL="/tmp/quadlet-manager-${VERSION}-linux-x64.tar.gz"

info "Downloading Quadlet Manager v${VERSION}..."
curl -fSL -o "$TARBALL" "$TARBALL_URL" || error "Failed to download v${VERSION}. Check that the version exists."

# --- Stop existing service ---

if systemctl --user is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    info "Stopping existing service..."
    systemctl --user stop "$SERVICE_NAME"
fi

# --- Install ---

info "Installing to ${INSTALL_DIR}..."
mkdir -p "$INSTALL_DIR"

# Clean previous installation files (preserves .data/ and .env)
rm -rf "${INSTALL_DIR}/dist" "${INSTALL_DIR}/node_modules" "${INSTALL_DIR}/package.json" "${INSTALL_DIR}/velojs"

tar xzf "$TARBALL" --no-same-owner --strip-components=1 -C "$INSTALL_DIR"
rm -f "$TARBALL"

# Stamp installed version into package.json
node -e "const p='${INSTALL_DIR}/package.json';const pkg=JSON.parse(require('fs').readFileSync(p,'utf-8'));pkg.version='${VERSION}';require('fs').writeFileSync(p,JSON.stringify(pkg,null,4)+'\n')"

# --- JWT Secret ---

if [[ ! -f "$ENV_FILE" ]]; then
    info "Generating JWT secret..."
    echo "JWT_SECRET=$(openssl rand -hex 32)" > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
fi

# --- Systemd User Service ---

info "Configuring systemd user service..."
mkdir -p "$SERVICE_DIR"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Quadlet Manager
After=network-online.target podman.socket
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(command -v node) dist/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=SERVER_PORT=3000
EnvironmentFile=${INSTALL_DIR}/.env

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME" --quiet
systemctl --user start "$SERVICE_NAME"

# --- Done ---

echo ""
echo -e "${GREEN}Quadlet Manager v${VERSION} installed successfully!${NC}"
echo ""
echo -e "  ${BLUE}User${NC}:    $(whoami)"
echo -e "  ${BLUE}Dir${NC}:     ${INSTALL_DIR}"
echo -e "  ${BLUE}Status${NC}:  systemctl --user status ${SERVICE_NAME}"
echo -e "  ${BLUE}Logs${NC}:    journalctl --user -u ${SERVICE_NAME} -f"
echo -e "  ${BLUE}Access${NC}:  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):3000"
echo ""
