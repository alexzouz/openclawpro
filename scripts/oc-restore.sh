#!/bin/bash
# OpenClawPro Restore — Standalone Bash Version
set -euo pipefail

OCLAW_DIR="$HOME/.openclaw"
BACKUP_DIR="$OCLAW_DIR/backups"

# List available backups if no argument provided
if [ $# -eq 0 ]; then
  echo -e "\033[1mAvailable backups:\033[0m"
  echo ""
  if [ -d "$BACKUP_DIR" ]; then
    BACKUPS=$(ls -1t "$BACKUP_DIR"/openclaw-backup-*.tar.gz* 2>/dev/null || true)
    if [ -z "$BACKUPS" ]; then
      echo "  No backups found in $BACKUP_DIR"
      exit 0
    fi
    INDEX=1
    while IFS= read -r file; do
      SIZE=$(du -h "$file" | cut -f1)
      BASENAME=$(basename "$file")
      echo "  [$INDEX] $BASENAME ($SIZE)"
      ((INDEX++))
    done <<< "$BACKUPS"
    echo ""
    echo "Usage: $0 <backup-file>"
    echo "  e.g. $0 $BACKUP_DIR/openclaw-backup-2026-03-27T12-00-00.tar.gz"
  else
    echo "  Backup directory not found: $BACKUP_DIR"
  fi
  exit 0
fi

BACKUP_FILE="$1"

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "\033[31mError: Backup file not found: $BACKUP_FILE\033[0m"
  exit 1
fi

# Decrypt if GPG-encrypted
if [[ "$BACKUP_FILE" == *.gpg ]]; then
  echo "→ Decrypting backup..."
  DECRYPTED="${BACKUP_FILE%.gpg}"
  gpg --decrypt --output "$DECRYPTED" "$BACKUP_FILE"
  BACKUP_FILE="$DECRYPTED"
  echo "✓ Decrypted"
fi

# Validate it's a valid tar.gz
if ! tar -tzf "$BACKUP_FILE" &>/dev/null; then
  echo -e "\033[31mError: Invalid or corrupted backup file\033[0m"
  exit 1
fi

# Create safety backup before restoring
echo "→ Creating safety backup before restore..."
SAFETY_TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)
SAFETY_FILE="$BACKUP_DIR/openclaw-pre-restore-$SAFETY_TIMESTAMP.tar.gz"
mkdir -p "$BACKUP_DIR"
tar -czf "$SAFETY_FILE" \
  "$OCLAW_DIR/openclaw.json" \
  "$OCLAW_DIR/workspace" \
  "$OCLAW_DIR/agents" \
  "$HOME/.openclaw-vps" \
  /etc/openclaw \
  2>/dev/null || true
echo "✓ Safety backup: $SAFETY_FILE"

# Stop services before restore
echo "→ Stopping OpenClaw services..."
SERVICES=("openclaw-gateway" "openclaw-gmail" "openclaw-hooks-proxy")
for svc in "${SERVICES[@]}"; do
  if systemctl is-active "$svc" &>/dev/null; then
    sudo systemctl stop "$svc" 2>/dev/null || true
    echo "  Stopped $svc"
  fi
done

# Restore
echo "→ Restoring from backup..."
tar -xzf "$BACKUP_FILE" -C / 2>/dev/null || tar -xzf "$BACKUP_FILE" -C "$HOME" 2>/dev/null || true
echo "✓ Files restored"

# Restart services
echo "→ Restarting OpenClaw services..."
for svc in "${SERVICES[@]}"; do
  if systemctl is-enabled "$svc" &>/dev/null; then
    sudo systemctl start "$svc" 2>/dev/null || true
    echo "  Started $svc"
  fi
done

echo ""
echo -e "\033[32m✓ Restore complete\033[0m"
echo "  Safety backup saved at: $SAFETY_FILE"
