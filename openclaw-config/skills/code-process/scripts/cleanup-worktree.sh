#!/bin/bash
set -euo pipefail

REPO_DIR="$1"
BRANCH="$2"

cd "$REPO_DIR"
git worktree remove "/tmp/openclaw-worktrees/$(basename "$REPO_DIR")-$BRANCH" --force 2>/dev/null || true
git branch -D "$BRANCH" 2>/dev/null || true

echo "Cleaned up worktree and branch: $BRANCH"
