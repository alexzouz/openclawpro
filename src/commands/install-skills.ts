import chalk from 'chalk';
import { existsSync, readdirSync, copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { getHomedir, getWorkspaceDir, ensureDir } from '../utils/system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, '..', '..');

function copyDirRecursive(src: string, dest: string): number {
  if (!existsSync(src)) return 0;

  ensureDir(dest);
  let count = 0;

  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
      count++;
    }
  }

  return count;
}

export async function installSkills(_options?: unknown): Promise<void> {
  console.log(chalk.bold('\n🧠 Install Claude Code Skills\n'));

  const home = getHomedir();
  const claudeSkillsDir = join(home, '.claude', 'skills');
  const workspaceSkillsDir = join(getWorkspaceDir(), 'skills');

  let totalInstalled = 0;

  // Step 1: Copy package skills to ~/.claude/skills/
  const packageSkillsDir = join(PACKAGE_ROOT, 'skills');

  if (existsSync(packageSkillsDir)) {
    console.log(chalk.cyan('→ Installing package skills to ~/.claude/skills/'));
    const count = copyDirRecursive(packageSkillsDir, claudeSkillsDir);
    console.log(chalk.green(`  ✓ ${count} skill file(s) copied to ${claudeSkillsDir}`));
    totalInstalled += count;
  } else {
    console.log(chalk.yellow('  ⚠ No package skills directory found'));
    console.log(chalk.dim(`  Expected at: ${packageSkillsDir}`));
  }

  // Step 2: Copy openclaw-config skills to workspace
  const openclawConfigSkillsDir = join(PACKAGE_ROOT, 'openclaw-config', 'skills');

  if (existsSync(openclawConfigSkillsDir)) {
    console.log(chalk.cyan('\n→ Installing workspace skills to ~/.openclaw/workspace/skills/'));
    const count = copyDirRecursive(openclawConfigSkillsDir, workspaceSkillsDir);
    console.log(chalk.green(`  ✓ ${count} skill file(s) copied to ${workspaceSkillsDir}`));
    totalInstalled += count;
  } else {
    console.log(chalk.yellow('  ⚠ No openclaw-config skills directory found'));
    console.log(chalk.dim(`  Expected at: ${openclawConfigSkillsDir}`));
  }

  // Step 3: Report results
  if (totalInstalled > 0) {
    console.log(chalk.bold.green(`\n✅ ${totalInstalled} skill file(s) installed\n`));
    console.log(chalk.bold('  Installed to:'));
    if (existsSync(claudeSkillsDir)) {
      console.log(chalk.white(`    ${claudeSkillsDir}`));
    }
    if (existsSync(workspaceSkillsDir)) {
      console.log(chalk.white(`    ${workspaceSkillsDir}`));
    }
  } else {
    console.log(chalk.yellow('\n  No skills found to install'));
    console.log(chalk.dim('  Skills directories may not be packaged yet'));
  }
}
