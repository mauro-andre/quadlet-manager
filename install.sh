#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="/opt/quadlet-manager"
SERVICE_NAME="quadlet-manager"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
ENV_FILE="${INSTALL_DIR}/.env"
REPO="mauro-andre/quadlet-manager"

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# --- Checks ---

[[ $EUID -eq 0 ]] || error "This script must be run as root"

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
    echo "Usage: $0 <version>"
    echo ""
    echo "  Install:  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash -s -- 0.1.0"
    echo "  Update:   curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash -s -- 0.2.0"
    exit 1
fi

command -v node >/dev/null 2>&1 || error "Node.js is not installed. Install Node.js 20+ first: https://nodejs.org"
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
[[ $NODE_MAJOR -ge 20 ]] || error "Node.js 20+ is required (found $(node -v))"

command -v podman >/dev/null 2>&1 || error "Podman is not installed"
command -v systemctl >/dev/null 2>&1 || error "systemctl is not available"

# --- Download ---

TARBALL_URL="https://github.com/${REPO}/releases/download/v${VERSION}/quadlet-manager-${VERSION}-linux-x64.tar.gz"
TARBALL="/tmp/quadlet-manager-${VERSION}-linux-x64.tar.gz"

info "Downloading Quadlet Manager v${VERSION}..."
curl -fSL -o "$TARBALL" "$TARBALL_URL" || error "Failed to download v${VERSION}. Check that the version exists."

# --- Stop existing service ---

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    info "Stopping existing service..."
    systemctl stop "$SERVICE_NAME"
fi

# --- Install ---

info "Installing to ${INSTALL_DIR}..."
mkdir -p "$INSTALL_DIR"

# Clean previous installation files (preserves .data/ and .env)
rm -rf "${INSTALL_DIR}/dist" "${INSTALL_DIR}/node_modules" "${INSTALL_DIR}/package.json" "${INSTALL_DIR}/velojs"

tar xzf "$TARBALL" --no-same-owner --strip-components=1 -C "$INSTALL_DIR"
rm -f "$TARBALL"

# --- JWT Secret ---

if [[ ! -f "$ENV_FILE" ]]; then
    info "Generating JWT secret..."
    echo "JWT_SECRET=$(openssl rand -hex 32)" > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
fi

# --- Systemd Service ---

info "Configuring systemd service..."
cat > "$SERVICE_FILE" << 'EOF'
[Unit]
Description=Quadlet Manager
After=network-online.target podman.socket
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/quadlet-manager
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=SERVER_PORT=3000
EnvironmentFile=/opt/quadlet-manager/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" --quiet
systemctl start "$SERVICE_NAME"

# --- Done ---

echo ""
echo -e "${GREEN}Quadlet Manager v${VERSION} installed successfully!${NC}"
echo ""
echo -e "  ${BLUE}Status${NC}:  systemctl status ${SERVICE_NAME}"
echo -e "  ${BLUE}Logs${NC}:    journalctl -u ${SERVICE_NAME} -f"
echo -e "  ${BLUE}Access${NC}:  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):3000"
echo ""
