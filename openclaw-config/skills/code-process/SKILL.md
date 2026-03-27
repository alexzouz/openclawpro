# code-process

Autonomous coding workflow -- creates worktree, GitHub issue, launches Claude agent, monitors completion, sends Telegram notification, cleans up after merge.

## Usage

```
/code-process <repo-url> <task-description>
```

## Arguments

- `repo-url` -- The GitHub repository URL (e.g., `https://github.com/user/repo`)
- `task-description` -- A clear description of the task to implement

## Workflow

1. **Init** (step-00) -- Parse arguments, validate environment
2. **Worktree** (step-01) -- Create git worktree and feature branch
3. **Issue** (step-02) -- Create GitHub issue for tracking
4. **Launch** (step-03) -- Launch Claude agent in background
5. **Watcher** (step-04) -- Monitor completion via cron
6. **Cleanup** (step-05) -- Remove worktree after PR merge

## Requirements

- `git` installed and configured
- `gh` CLI authenticated
- `claude` CLI installed
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` environment variables set (for notifications)

## Steps

1. [step-00-init](steps/step-00-init.md)
2. [step-01-worktree](steps/step-01-worktree.md)
3. [step-02-issue](steps/step-02-issue.md)
4. [step-03-launch](steps/step-03-launch.md)
5. [step-04-watcher](steps/step-04-watcher.md)
6. [step-05-cleanup](steps/step-05-cleanup.md)
