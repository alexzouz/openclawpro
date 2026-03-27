# Step 02 -- Issue

Create a GitHub issue to track the task.

## Instructions

1. **Create the GitHub issue**:
   ```bash
   ISSUE_URL=$(gh issue create \
     --repo "$REPO_FULL" \
     --title "$TASK_DESCRIPTION" \
     --body "Automated task created by OpenClaw code-process skill.

## Task
$TASK_DESCRIPTION

## Branch
\`$BRANCH_NAME\`

## Worktree
\`$WORKTREE_DIR\`

---
_This issue was created automatically by the code-process skill._" \
     --label "openclaw-agent" \
     --assignee "$GH_USER")
   ```

2. **Handle label creation** if "openclaw-agent" label does not exist:
   ```bash
   gh label create "openclaw-agent" \
     --repo "$REPO_FULL" \
     --description "Task managed by OpenClaw agent" \
     --color "7057ff" 2>/dev/null || true
   ```
   Run this before creating the issue.

3. **Extract issue number**:
   ```bash
   ISSUE_NUMBER=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
   ```

4. **Print confirmation**:
   ```
   Created issue #$ISSUE_NUMBER: $ISSUE_URL
   ```

## Next Step

Proceed to [step-03-launch](step-03-launch.md).
