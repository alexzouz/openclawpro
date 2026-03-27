#!/bin/bash
# OpenClawPro Security Audit — Standalone Bash Version
# Works even if Node.js is broken

PASS=0; WARN=0; FAIL=0

check() {
  local status="$1" name="$2" msg="$3"
  case "$status" in
    PASS) echo -e "  \033[32m✓ PASS\033[0m  $name — $msg"; ((PASS++)) ;;
    WARN) echo -e "  \033[33m⚠ WARN\033[0m  $name — $msg"; ((WARN++)) ;;
    FAIL) echo -e "  \033[31m✗ FAIL\033[0m  $name — $msg"; ((FAIL++)) ;;
  esac
}

echo -e "\n\033[1m🔍 Security Audit (Bash)\033[0m\n"

# 1. Gateway bind
if ss -tlnp 2>/dev/null | grep -q ':18789.*0.0.0.0'; then
  check FAIL "Gateway Bind" "Bound to 0.0.0.0 (publicly accessible)"
elif ss -tlnp 2>/dev/null | grep -q ':18789.*127.0.0.1'; then
  check PASS "Gateway Bind" "Bound to 127.0.0.1"
else
  check WARN "Gateway Bind" "Not running or not detected"
fi

# 2. UFW
if ufw status 2>/dev/null | grep -q "Status: active"; then
  check PASS "UFW Firewall" "Active"
else
  check FAIL "UFW Firewall" "Not active"
fi

# 3. Fail2ban
if systemctl is-active fail2ban &>/dev/null; then
  check PASS "Fail2ban" "Active"
else
  check FAIL "Fail2ban" "Not active"
fi

# 4. SSH
if grep -q "PasswordAuthentication no" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/* 2>/dev/null; then
  check PASS "SSH Hardening" "Password auth disabled"
else
  check FAIL "SSH Hardening" "Password auth may be enabled"
fi

# 5. Gateway token
CONFIG="$HOME/.openclaw/openclaw.json"
if [ -f "$CONFIG" ]; then
  TOKEN=$(jq -r '.gateway.auth.token // empty' "$CONFIG" 2>/dev/null)
  if [ -n "$TOKEN" ] && [ "$TOKEN" != "CHANGE_ME_GENERATE_WITH_openssl_rand_hex_36" ] && [ ${#TOKEN} -ge 32 ]; then
    check PASS "Gateway Token" "Set (${#TOKEN} chars)"
  else
    check FAIL "Gateway Token" "Missing or placeholder"
  fi
else
  check WARN "Gateway Token" "Config file not found"
fi

# 6. Unattended upgrades
if [ -f /etc/apt/apt.conf.d/20auto-upgrades ]; then
  check PASS "Unattended Upgrades" "Configured"
else
  check WARN "Unattended Upgrades" "Not configured"
fi

# 7. Kernel hardening
if [ "$(sysctl -n kernel.randomize_va_space 2>/dev/null)" = "2" ]; then
  check PASS "Kernel Hardening" "ASLR enabled"
else
  check WARN "Kernel Hardening" "ASLR not fully enabled"
fi

# 8. Disk
DISK_PCT=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_PCT" -ge 95 ]; then
  check FAIL "Disk Usage" "${DISK_PCT}% used (critical)"
elif [ "$DISK_PCT" -ge 85 ]; then
  check WARN "Disk Usage" "${DISK_PCT}% used"
else
  check PASS "Disk Usage" "${DISK_PCT}% used"
fi

echo ""
echo -e "\033[1mResults: \033[32m${PASS} PASS\033[0m | \033[33m${WARN} WARN\033[0m | \033[31m${FAIL} FAIL\033[0m"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
