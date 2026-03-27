# Step 01 -- Worktree

Create a git worktree with a feature branch for isolated development.

## Instructions

1. **Determine the base repo directory**:
   - Check if a local clone already exists at `~/Documents/github/$REPO_NAME`
   - If not, clone the repo:
     ```bash
     git clone "$REPO_URL" ~/Documents/github/"$REPO_NAME"
     ```
   - Set `REPO_DIR=~/Documents/github/$REPO_NAME`

2. **Ensure main branch is up to date**:
   ```bash
   cd "$REPO_DIR"
   git checkout main
   git pull origin main
   ```

3. **Create the feature branch**:
   ```bash
   git branch "$BRANCH_NAME" main
   ```

4. **Create the worktree directory**:
   ```bash
   mkdir -p /tmp/openclaw-worktrees
   git worktree add "$WORKTREE_DIR" "$BRANCH_NAME"
   ```

5. **Install dependencies** using the setup script:
   ```bash
   bash openclaw-config/skills/code-process/scripts/setup-worktree.sh "$WORKTREE_DIR"
   ```

6. **Verify** the worktree was created successfully:
   ```bash
   cd "$WORKTREE_DIR"
   git status
   git branch --show-current
   ```

## Next Step

Proceed to [step-02-issue](step-02-issue.md).
