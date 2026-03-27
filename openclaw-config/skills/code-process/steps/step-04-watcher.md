# Step 04 -- Watcher

Set up a cron job to monitor the Claude agent and notify on completion.

## Instructions

1. **Create the watcher script** at `/tmp/openclaw-worktrees/$REPO_NAME-$BRANCH_SLUG-watcher.sh`:
   ```bash
   #!/bin/bash
   set -euo pipefail

   REPO_FULL="REPO_FULL_VALUE"
   BRANCH_NAME="BRANCH_NAME_VALUE"
   TASK_DESCRIPTION="TASK_DESCRIPTION_VALUE"
   PID_FILE="/tmp/openclaw-worktrees/PID_FILE_VALUE.pid"
   TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
   TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

   send_telegram() {
     if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
       curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
         -d chat_id="$TELEGRAM_CHAT_ID" \
         -d text="$1"
     fi
   }

   # Check if process is still running
   CLAUDE_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
   if [ -n "$CLAUDE_PID" ] && kill -0 "$CLAUDE_PID" 2>/dev/null; then
     # Still running, do nothing
     exit 0
   fi

   # Process stopped -- check if PR was created
   PR_URL=$(gh pr list --repo "$REPO_FULL" --head "$BRANCH_NAME" --json url --jq '.[0].url' 2>/dev/null || echo "")

   if [ -n "$PR_URL" ]; then
     send_telegram "PR ready for review: $PR_URL -- Task: $TASK_DESCRIPTION"
   else
     send_telegram "Task failed, check logs -- Task: $TASK_DESCRIPTION"
   fi

   # Remove the cron job
   CRON_ID="openclaw-watcher-BRANCH_SLUG_VALUE"
   crontab -l 2>/dev/null | grep -v "$CRON_ID" | crontab - 2>/dev/null || true

   # Clean up watcher script and PID file
   rm -f "$PID_FILE"
   rm -f "/tmp/openclaw-worktrees/WATCHER_SCRIPT_VALUE"
   ```

2. **Replace placeholders** in the watcher script with actual values.

3. **Make the watcher script executable**:
   ```bash
   chmod +x /tmp/openclaw-worktrees/$REPO_NAME-$BRANCH_SLUG-watcher.sh
   ```

4. **Add cron job** to check every 5 minutes:
   ```bash
   CRON_ENTRY="*/5 * * * * /tmp/openclaw-worktrees/$REPO_NAME-$BRANCH_SLUG-watcher.sh # openclaw-watcher-$BRANCH_SLUG"
   (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
   ```

5. **Print status**:
   ```
   Watcher cron job installed (every 5 minutes)
   Watcher script: /tmp/openclaw-worktrees/$REPO_NAME-$BRANCH_SLUG-watcher.sh
   ```

## Next Step

Proceed to [step-05-cleanup](step-05-cleanup.md).
