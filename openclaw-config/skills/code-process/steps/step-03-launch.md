# Step 03 -- Launch

Launch the Claude Code agent in background to implement the task.

## Instructions

1. **Prepare the prompt** for Claude:
   ```
   CLAUDE_PROMPT="Implement this: $TASK_DESCRIPTION. Create a PR when done referencing issue #$ISSUE_NUMBER. The PR should be created against the main branch of $REPO_FULL."
   ```

2. **Launch Claude in background**:
   ```bash
   cd "$WORKTREE_DIR" && claude --dangerously-skip-permissions -p "$CLAUDE_PROMPT" > /tmp/openclaw-worktrees/$REPO_NAME-$BRANCH_SLUG.log 2>&1 &
   CLAUDE_PID=$!
   ```

3. **Save the PID** for monitoring:
   ```bash
   echo "$CLAUDE_PID" > /tmp/openclaw-worktrees/$REPO_NAME-$BRANCH_SLUG.pid
   ```

4. **Send Telegram notification** (if configured):
   ```bash
   if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
     curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
       -d chat_id="$TELEGRAM_CHAT_ID" \
       -d text="Started working on: $TASK_DESCRIPTION (issue #$ISSUE_NUMBER)"
   fi
   ```

5. **Print status**:
   ```
   Claude agent launched (PID: $CLAUDE_PID)
   Logs: /tmp/openclaw-worktrees/$REPO_NAME-$BRANCH_SLUG.log
   ```

## Next Step

Proceed to [step-04-watcher](step-04-watcher.md).
