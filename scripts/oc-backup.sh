#!/bin/bash
# OpenClawPro Backup — Standalone Bash Version
set -euo pipefail

OCLAW_DIR="$HOME/.openclaw"
BACKUP_DIR="$OCLAW_DIR/backups"
TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)
FILENAME="openclaw-backup-$TIMESTAMP.tar.gz"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "→ Creating backup..."
tar -czf "$BACKUP_DIR/$FILENAME" \
  "$OCLAW_DIR/openclaw.json" \
  "$OCLAW_DIR/workspace" \
  "$OCLAW_DIR/agents" \
  "$HOME/.openclaw-vps" \
  /etc/openclaw \
  2>/dev/null || true

SIZE=$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)
echo "✓ Backup created: $BACKUP_DIR/$FILENAME ($SIZE)"

# Optional GPG encryption
if [ "${1:-}" = "--encrypt" ]; then
  gpg --symmetric --cipher-algo AES256 "$BACKUP_DIR/$FILENAME"
  rm "$BACKUP_DIR/$FILENAME"
  echo "✓ Encrypted: $BACKUP_DIR/$FILENAME.gpg"
fi

# Cleanup old backups
find "$BACKUP_DIR" -name "openclaw-backup-*" -mtime +"$RETENTION_DAYS" -delete
echo "✓ Cleaned backups older than $RETENTION_DAYS days"
