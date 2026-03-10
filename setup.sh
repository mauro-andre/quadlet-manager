#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()  { echo -e "  ${GREEN}✓${NC} $*"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $*"; }
error() { echo -e "  ${RED}✗${NC} $*"; exit 1; }
step()  { echo -e "\n${CYAN}[$1]${NC} ${BOLD}$2${NC}\n"; }

# ── Header ───────────────────────────────────────────────────

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       Quadlet Manager Setup          ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Privilege check ──────────────────────────────────────────

if [[ $EUID -eq 0 ]]; then
    SUDO=""
else
    if ! command -v sudo >/dev/null 2>&1; then
        error "Run as root or with a user that has sudo access"
    fi
    echo -e "  This script requires elevated privileges."
    echo ""
    if ! sudo true; then
        error "Failed to obtain sudo access"
    fi
    SUDO="sudo"
fi

# ── Step 1: Select user ─────────────────────────────────────

step "1/3" "Select user for Quadlet Manager"

# List real users (UID >= 1000, valid shell, exclude nobody/nfsnobody)
USERS=()
while IFS=: read -r username _ uid _ _ _ shell; do
    if [[ $uid -ge 1000 ]] && [[ "$shell" == */bash || "$shell" == */zsh || "$shell" == */sh ]] && [[ "$username" != "nobody" ]] && [[ "$username" != "nfsnobody" ]]; then
        USERS+=("$username")
    fi
done < /etc/passwd

echo -e "  Available users:"
echo ""
for i in "${!USERS[@]}"; do
    echo -e "    ${BOLD}$((i + 1)))${NC} ${USERS[$i]}"
done
NEW_USER_OPT=$((${#USERS[@]} + 1))
echo -e "    ${BOLD}${NEW_USER_OPT})${NC} Create new user"
echo ""

while true; do
    read -rp "  Choose [1-${NEW_USER_OPT}]: " choice
    if [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le "$NEW_USER_OPT" ]]; then
        break
    fi
    echo -e "  ${RED}Invalid choice${NC}"
done

if [[ "$choice" -eq "$NEW_USER_OPT" ]]; then
    # Create new user
    echo ""
    while true; do
        read -rp "  New username: " QM_USER
        if [[ -z "$QM_USER" ]]; then
            echo -e "  ${RED}Username cannot be empty${NC}"
            continue
        fi
        if id "$QM_USER" &>/dev/null; then
            echo -e "  ${RED}User '$QM_USER' already exists. Choose from the list or pick a different name.${NC}"
            continue
        fi
        if [[ ! "$QM_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]; then
            echo -e "  ${RED}Invalid username. Use lowercase letters, numbers, hyphens and underscores.${NC}"
            continue
        fi
        break
    done

    $SUDO useradd -m -s /bin/bash "$QM_USER"

    echo ""
    echo -e "  Set password for ${BOLD}${QM_USER}${NC}:"
    $SUDO passwd "$QM_USER"

    info "User '${QM_USER}' created"
else
    QM_USER="${USERS[$((choice - 1))]}"
    info "Selected user '${QM_USER}'"
fi

# ── Detect distro family ─────────────────────────────────────

detect_distro() {
    if command -v dnf >/dev/null 2>&1; then
        echo "rhel"
    elif command -v apt-get >/dev/null 2>&1; then
        echo "debian"
    elif command -v pacman >/dev/null 2>&1; then
        echo "arch"
    else
        echo "unknown"
    fi
}

DISTRO=$(detect_distro)

pkg_install() {
    case "$DISTRO" in
        rhel)   $SUDO dnf install -y "$@" >/dev/null 2>&1 ;;
        debian) $SUDO apt-get install -y "$@" >/dev/null 2>&1 ;;
        arch)   $SUDO pacman -S --noconfirm "$@" >/dev/null 2>&1 ;;
        *)      return 1 ;;
    esac
}

# ── Step 2: System dependencies ──────────────────────────────

step "2/3" "Installing system dependencies"

# systemctl
command -v systemctl >/dev/null 2>&1 || error "systemctl is not available. systemd is required."

# Podman
if command -v podman >/dev/null 2>&1; then
    info "Podman $(podman --version | awk '{print $NF}') detected"
else
    echo -e "  Installing Podman..."
    if pkg_install podman; then
        info "Podman installed"
    else
        error "Failed to install Podman. Install it manually and re-run this script."
    fi
fi

# Python 3
if command -v python3 >/dev/null 2>&1; then
    info "Python 3 detected"
else
    echo -e "  Installing Python 3..."
    if pkg_install python3; then
        info "Python 3 installed"
    else
        error "Failed to install Python 3. Install it manually and re-run this script."
    fi
fi

# Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v)
    NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
    if [[ $NODE_MAJOR -ge 20 ]]; then
        info "Node.js ${NODE_VER} detected"
    else
        warn "Node.js 20+ is required (found ${NODE_VER}), attempting upgrade..."
        NEED_NODE=true
    fi
else
    NEED_NODE=true
fi

if [[ "${NEED_NODE:-}" == "true" ]]; then
    echo -e "  Installing Node.js..."
    case "$DISTRO" in
        rhel)
            $SUDO dnf module reset -y nodejs 2>/dev/null || true
            $SUDO dnf module enable -y nodejs:22 2>/dev/null || true
            if pkg_install nodejs; then
                info "Node.js $(node -v) installed"
            else
                # Fallback: NodeSource
                curl -fsSL https://rpm.nodesource.com/setup_22.x | $SUDO bash - >/dev/null 2>&1
                pkg_install nodejs && info "Node.js $(node -v) installed" || error "Failed to install Node.js. Install Node.js 20+ manually: https://nodejs.org"
            fi
            ;;
        debian)
            if curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash - >/dev/null 2>&1 && pkg_install nodejs; then
                info "Node.js $(node -v) installed"
            else
                error "Failed to install Node.js. Install Node.js 20+ manually: https://nodejs.org"
            fi
            ;;
        arch)
            if pkg_install nodejs npm; then
                info "Node.js $(node -v) installed"
            else
                error "Failed to install Node.js. Install Node.js 20+ manually: https://nodejs.org"
            fi
            ;;
        *)
            error "Cannot install Node.js on this distribution. Install Node.js 20+ manually: https://nodejs.org"
            ;;
    esac
fi

# skopeo
if command -v skopeo >/dev/null 2>&1; then
    info "skopeo detected"
else
    echo -e "  Installing skopeo..."
    pkg_install skopeo && info "skopeo installed" || warn "Failed to install skopeo. Image update checks will not be available."
fi

# rclone
if command -v rclone >/dev/null 2>&1; then
    info "rclone detected"
else
    echo -e "  Installing rclone..."
    curl -fsSL https://rclone.org/install.sh | $SUDO bash >/dev/null 2>&1 && info "rclone installed" || warn "Failed to install rclone. Backups will not be available."
fi

# Enable linger
$SUDO loginctl enable-linger "$QM_USER" 2>/dev/null && info "Linger enabled for '${QM_USER}'" || warn "Failed to enable linger. User services may not survive logout."

# Persistent journal
if [[ ! -d /var/log/journal ]]; then
    $SUDO mkdir -p /var/log/journal
    $SUDO journalctl --flush 2>/dev/null || true
    info "Journal persistence configured"
else
    info "Journal persistence already configured"
fi

# ── Step 3: Done ─────────────────────────────────────────────

step "3/3" "Setup complete"

INSTALL_CMD="curl -fsSL https://github.com/mauro-andre/quadlet-manager/releases/latest/download/install.sh | bash"
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "your-server")

echo -e "  System is ready. Now switch to the user and install:"
echo ""
echo -e "    ${DIM}\$${NC} ${BOLD}su - ${QM_USER}${NC}"
echo -e "    ${DIM}\$${NC} ${BOLD}${INSTALL_CMD}${NC}"
echo ""
echo -e "  After installation, access Quadlet Manager at:"
echo -e "    ${BLUE}http://${SERVER_IP}:3000${NC}"
echo ""
