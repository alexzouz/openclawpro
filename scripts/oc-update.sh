#!/bin/bash
# OpenClawPro Update — Standalone Bash Version
set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

UPDATED=0
FAILED=0

update_component() {
  local name="$1" cmd="$2"
  echo -e "${CYAN}→ Updating $name...${NC}"
  if eval "$cmd" 2>/dev/null; then
    echo -e "${GREEN}  ✓ $name updated${NC}"
    ((UPDATED++))
  else
    echo -e "${YELLOW}  ⚠ $name update failed or not installed${NC}"
    ((FAILED++))
  fi
}

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════╗"
echo "║         OpenClawPro Update               ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# 1. System packages
echo -e "${CYAN}→ Updating system packages...${NC}"
if [ "$EUID" -eq 0 ]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq && apt-get upgrade -y -qq
  echo -e "${GREEN}  ✓ System packages updated${NC}"
  ((UPDATED++))
else
  sudo apt-get update -qq && sudo apt-get upgrade -y -qq
  echo -e "${GREEN}  ✓ System packages updated${NC}"
  ((UPDATED++))
fi

# 2. OpenClawPro CLI (npm)
if command -v npm &>/dev/null; then
  update_component "OpenClawPro CLI" "npm install -g openclawpro"
else
  echo -e "${YELLOW}  ⚠ npm not found, skipping OpenClawPro CLI update${NC}"
  ((FAILED++))
fi

# 3. Claude Code
if command -v claude &>/dev/null; then
  update_component "Claude Code" "npm install -g @anthropic-ai/claude-code"
else
  echo -e "${YELLOW}  ⚠ Claude Code not installed, skipping${NC}"
fi

# 4. GitHub CLI
if command -v gh &>/dev/null; then
  update_component "GitHub CLI" "gh extension upgrade --all 2>/dev/null; gh upgrade -y 2>/dev/null || true"
else
  echo -e "${YELLOW}  ⚠ GitHub CLI not installed, skipping${NC}"
fi

# 5. Cloudflared
if command -v cloudflared &>/dev/null; then
  update_component "Cloudflared" "cloudflared update"
else
  echo -e "${YELLOW}  ⚠ Cloudflared not installed, skipping${NC}"
fi

# Restart active services
echo ""
echo -e "${CYAN}→ Restarting active services...${NC}"
SERVICES=("openclaw-gateway" "openclaw-gmail" "openclaw-hooks-proxy")
RESTARTED=0
for svc in "${SERVICES[@]}"; do
  if systemctl is-active "$svc" &>/dev/null; then
    sudo systemctl restart "$svc" 2>/dev/null || true
    echo -e "${GREEN}  ✓ Restarted $svc${NC}"
    ((RESTARTED++))
  fi
done

if [ "$RESTARTED" -eq 0 ]; then
  echo -e "  No active OpenClaw services to restart"
fi

# Summary
echo ""
echo -e "${BOLD}Update complete: ${GREEN}${UPDATED} updated${NC} | ${YELLOW}${FAILED} skipped${NC}"
