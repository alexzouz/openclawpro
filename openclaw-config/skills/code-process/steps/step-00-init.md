# Step 00 -- Init

Parse arguments and validate the environment before proceeding.

## Instructions

1. **Parse arguments** from the user command:
   - `REPO_URL` -- the GitHub repository URL (first argument)
   - `TASK_DESCRIPTION` -- the task to implement (remaining arguments)
   - If either is missing, stop and ask the user to provide both

2. **Extract repo info** from the URL:
   - `REPO_OWNER` -- GitHub owner/org
   - `REPO_NAME` -- repository name
   - `REPO_FULL` -- `owner/repo` format

3. **Validate required tools** are installed:
   ```bash
   command -v git || { echo "git is required"; exit 1; }
   command -v gh || { echo "gh CLI is required"; exit 1; }
   command -v claude || { echo "claude CLI is required"; exit 1; }
   ```

4. **Validate GitHub authentication**:
   ```bash
   gh auth status
   ```
   If not authenticated, stop and instruct the user to run `gh auth login`.

5. **Get authenticated user**:
   ```bash
   GH_USER=$(gh api user --jq '.login')
   ```

6. **Slugify the task description** for branch naming:
   - Convert to lowercase
   - Replace spaces and special characters with hyphens
   - Truncate to 50 characters max
   - Store as `BRANCH_SLUG`
   - Full branch name: `feat/$BRANCH_SLUG`

7. **Set variables** for subsequent steps:
   - `BRANCH_NAME=feat/$BRANCH_SLUG`
   - `WORKTREE_DIR=/tmp/openclaw-worktrees/$REPO_NAME-$BRANCH_SLUG`

8. **Print summary** of parsed configuration before proceeding.

## Next Step

Proceed to [step-01-worktree](step-01-worktree.md).
