# Step 05 -- Cleanup

Clean up resources after the PR is merged.

## Instructions

This step runs after the PR has been merged (can be triggered manually or automated).

1. **Check PR merge status** (if automating):
   ```bash
   PR_STATE=$(gh pr list --repo "$REPO_FULL" --head "$BRANCH_NAME" --state merged --json state --jq '.[0].state' 2>/dev/null || echo "")
   ```

2. **Run cleanup script**:
   ```bash
   bash openclaw-config/skills/code-process/scripts/cleanup-worktree.sh "$REPO_DIR" "$BRANCH_NAME"
   ```

3. **Remove any remaining temporary files**:
   ```bash
   rm -f /tmp/openclaw-worktrees/$REPO_NAME-$BRANCH_SLUG.log
   rm -f /tmp/openclaw-worktrees/$REPO_NAME-$BRANCH_SLUG.pid
   rm -f /tmp/openclaw-worktrees/$REPO_NAME-$BRANCH_SLUG-watcher.sh
   ```

4. **Remove cron job** (if still present):
   ```bash
   crontab -l 2>/dev/null | grep -v "openclaw-watcher-$BRANCH_SLUG" | crontab - 2>/dev/null || true
   ```

5. **Send notification** (if configured):
   ```bash
   if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
     curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
       -d chat_id="$TELEGRAM_CHAT_ID" \
       -d text="Cleanup complete for: $TASK_DESCRIPTION"
   fi
   ```

6. **Print confirmation**:
   ```
   Cleanup complete:
   - Worktree removed: $WORKTREE_DIR
   - Branch deleted: $BRANCH_NAME
   - Temporary files removed
   ```
