#!/bin/bash
set -euo pipefail

WORKTREE_DIR="$1"
cd "$WORKTREE_DIR"

# Detect package manager and install deps
if [ -f "package.json" ]; then
  if command -v bun &>/dev/null; then
    bun install
  elif command -v npm &>/dev/null; then
    npm install
  fi
elif [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
elif [ -f "Pipfile" ]; then
  pipenv install
fi

echo "Dependencies installed in $WORKTREE_DIR"
