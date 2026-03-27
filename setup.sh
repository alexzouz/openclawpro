#!/bin/bash
set -euo pipefail

# OpenClawPro Enhanced — VPS Bootstrap Script
# Usage: curl -fsSL https://raw.githubusercontent.com/alexzouz/openclawpro/main/setup.sh | bash -s -- [--tailscale] [--caddy] [--egress]

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║       OpenClawPro Enhanced Bootstrap     ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Check root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Please run as root (sudo)${NC}"
  exit 1
fi

# Check OS
if ! grep -qiE 'ubuntu|debian' /etc/os-release 2>/dev/null; then
  echo -e "${RED}Error: Only Ubuntu/Debian supported${NC}"
  exit 1
fi

# Pass-through args
ARGS="$@"

# Step 1: System packages
echo -e "${CYAN}→ Installing system packages...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git

# Step 2: Node.js 22
if ! command -v node &>/dev/null || ! node --version | grep -q "v22\|v24"; then
  echo -e "${CYAN}→ Installing Node.js 22...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
echo -e "${GREEN}  ✓ Node.js $(node --version)${NC}"

# Step 3: Install OpenClawPro CLI from GitHub
INSTALL_DIR="/opt/openclawpro"
echo -e "${CYAN}→ Installing OpenClawPro CLI...${NC}"
if [ -d "$INSTALL_DIR" ]; then
  echo -e "${CYAN}  Updating existing installation...${NC}"
  cd "$INSTALL_DIR"
  git pull --quiet
else
  git clone --quiet https://github.com/alexzouz/openclawpro.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
npm install 2>&1 | tail -1
echo -e "${CYAN}  Building...${NC}"
npx tsc 2>&1 | tail -1 || true
# Create global symlink manually (npm link can fail in pipes)
ln -sf "$INSTALL_DIR/bin/openclawpro.js" /usr/local/bin/openclawpro
chmod +x "$INSTALL_DIR/bin/openclawpro.js"
echo -e "${GREEN}  ✓ OpenClawPro CLI installed${NC}"

# Step 4: Run setup wizard
echo -e "${CYAN}→ Launching setup wizard...${NC}"
node "$INSTALL_DIR/bin/openclawpro.js" setup $ARGS
