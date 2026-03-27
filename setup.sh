#!/bin/bash
set -euo pipefail

# OpenClawPro Enhanced — VPS Bootstrap Script
# Usage: curl -fsSL https://raw.githubusercontent.com/alexzouz/openclawpro/main/setup.sh | bash

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
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

# Step 1: System packages
echo -e "${CYAN}→ Step 1/5: System packages...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git jq ufw fail2ban \
  unattended-upgrades apt-transport-https lsb-release wget build-essential \
  unzip ipset dnsutils
echo -e "${GREEN}  ✓ System packages installed${NC}"

# Step 2: Node.js 22
echo -e "${CYAN}→ Step 2/5: Node.js...${NC}"
if ! command -v node &>/dev/null || ! node --version | grep -q "v22\|v24"; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
echo -e "${GREEN}  ✓ Node.js $(node --version)${NC}"

# Step 3: OpenClaw
echo -e "${CYAN}→ Step 3/5: OpenClaw...${NC}"
if ! command -v openclaw &>/dev/null; then
  npm install -g openclaw 2>&1 | tail -1
  echo -e "${GREEN}  ✓ OpenClaw installed${NC}"
else
  echo -e "${GREEN}  ✓ OpenClaw already installed$(openclaw --version 2>/dev/null && echo "" || echo "")${NC}"
fi

# Step 4: Dev tools (GitHub CLI, Claude Code, Bun)
echo -e "${CYAN}→ Step 4/5: Dev tools...${NC}"
if ! command -v gh &>/dev/null; then
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  apt-get update -qq && apt-get install -y -qq gh
  echo -e "${GREEN}  ✓ GitHub CLI installed${NC}"
else
  echo -e "${GREEN}  ✓ GitHub CLI already installed${NC}"
fi

if ! command -v claude &>/dev/null; then
  npm install -g @anthropic-ai/claude-code 2>&1 | tail -1
  echo -e "${GREEN}  ✓ Claude Code installed${NC}"
else
  echo -e "${GREEN}  ✓ Claude Code already installed${NC}"
fi

if ! command -v bun &>/dev/null; then
  curl -fsSL https://bun.sh/install | bash 2>/dev/null
  ln -sf ~/.bun/bin/bun /usr/local/bin/bun 2>/dev/null || true
  echo -e "${GREEN}  ✓ Bun installed${NC}"
else
  echo -e "${GREEN}  ✓ Bun already installed${NC}"
fi

# Step 5: OpenClawPro CLI
INSTALL_DIR="/opt/openclawpro"
echo -e "${CYAN}→ Step 5/5: OpenClawPro CLI...${NC}"
if [ -d "$INSTALL_DIR" ]; then
  cd "$INSTALL_DIR"
  git pull --quiet
else
  git clone --quiet https://github.com/alexzouz/openclawpro.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
npm install 2>&1 | tail -1
npx tsc 2>&1 || true
ln -sf "$INSTALL_DIR/bin/openclawpro.js" /usr/local/bin/openclawpro
chmod +x "$INSTALL_DIR/bin/openclawpro.js"
echo -e "${GREEN}  ✓ OpenClawPro CLI installed${NC}"

# Done — show next steps
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║         ✅ Bootstrap Complete!            ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  ${CYAN}1.${NC} Run the interactive setup wizard:"
echo -e "     ${BOLD}openclawpro setup${NC}"
echo ""
echo -e "  ${CYAN}   Or with options:${NC}"
echo -e "     ${BOLD}openclawpro setup --tailscale --caddy --egress${NC}"
echo ""
echo -e "  ${CYAN}2.${NC} After setup, verify your security:"
echo -e "     ${BOLD}openclawpro audit${NC}"
echo ""
echo -e "  ${CYAN}3.${NC} Check the status dashboard:"
echo -e "     ${BOLD}openclawpro status${NC}"
echo ""
echo -e "${YELLOW}Tip:${NC} Run ${BOLD}openclawpro --help${NC} to see all commands"
echo ""
