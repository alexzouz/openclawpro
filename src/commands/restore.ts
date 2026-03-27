import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { run, runSafe, runWithSpinner } from '../utils/exec.js';
import { getOpenclawDir, ensureDir, getServiceStatus, restartService } from '../utils/system.js';
import { existsSync, readdirSync, statSync } from 'node:fs';

export async function restore(file?: string, options?: { dryRun?: boolean }): Promise<void> {
  console.log(chalk.bold('\n🔄 Restore\n'));

  const backupDir = `${getOpenclawDir()}/backups`;

  // List available backups
  if (!file || options?.dryRun) {
    if (!existsSync(backupDir)) {
      console.log(chalk.yellow('No backup directory found'));
      return;
    }

    const backups = readdirSync(backupDir)
      .filter(f => f.startsWith('openclaw-backup-'))
      .sort()
      .reverse();

    if (backups.length === 0) {
      console.log(chalk.yellow('No backups found'));
      return;
    }

    console.log(chalk.cyan('Available backups:\n'));
    for (const backup of backups) {
      const stat = statSync(`${backupDir}/${backup}`);
      const age = Math.round((Date.now() - stat.mtimeMs) / (1000 * 60 * 60));
      const size = stat.size < 1024 * 1024
        ? `${(stat.size / 1024).toFixed(1)} KB`
        : `${(stat.size / (1024 * 1024)).toFixed(1)} MB`;
      console.log(`  ${backup}  (${size}, ${age}h ago)`);
    }

    if (!file) {
      console.log(chalk.dim('\nRestore with: openclawpro restore <filename>'));
      return;
    }
  }

  // Validate backup file
  const backupPath = file!.startsWith('/') ? file! : `${backupDir}/${file}`;
  if (!existsSync(backupPath)) {
    console.log(chalk.red(`Backup file not found: ${backupPath}`));
    return;
  }

  // Decrypt if encrypted
  let restorePath = backupPath;
  if (backupPath.endsWith('.gpg')) {
    console.log(chalk.cyan('→ Decrypting backup...'));
    restorePath = backupPath.replace('.gpg', '');
    run(`gpg --decrypt --output "${restorePath}" "${backupPath}"`);
  }

  // Confirm
  const proceed = await confirm({
    message: `Restore from ${file}? This will overwrite current config.`,
    default: false,
  });

  if (!proceed) {
    console.log(chalk.yellow('Restore cancelled'));
    return;
  }

  // Safety backup of current state (from openclaw-deploy)
  console.log(chalk.cyan('→ Creating safety backup of current state...'));
  const safetyTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safetyPath = `${backupDir}/safety-before-restore-${safetyTimestamp}.tar.gz`;
  const oclawDir = getOpenclawDir();
  ensureDir(backupDir);
  runSafe(`tar -czf "${safetyPath}" "${oclawDir}/openclaw.json" "${oclawDir}/workspace" "${oclawDir}/agents" 2>/dev/null`);
  console.log(chalk.green(`  ✓ Safety backup: ${safetyPath}`));

  // Stop services
  console.log(chalk.cyan('→ Stopping services...'));
  runSafe('systemctl stop openclaw-gateway');
  runSafe('systemctl stop openclaw-hooks-proxy');

  // Restore
  console.log(chalk.cyan('→ Restoring...'));
  await runWithSpinner('Extracting archive...', `tar -xzf "${restorePath}" -C / 2>/dev/null || true`);

  // Restart services
  console.log(chalk.cyan('→ Restarting services...'));
  runSafe('systemctl start openclaw-gateway');
  runSafe('systemctl start openclaw-hooks-proxy');

  // Verify health (from openclaw-deploy)
  console.log(chalk.cyan('→ Verifying health...'));
  let healthy = false;
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 5000));
    if (getServiceStatus('openclaw-gateway') === 'active') {
      healthy = true;
      break;
    }
  }

  if (healthy) {
    console.log(chalk.bold.green('\n✅ Restore complete — gateway is healthy'));
  } else {
    console.log(chalk.yellow('\n⚠ Gateway did not start — check logs:'));
    console.log(chalk.dim('  journalctl -u openclaw-gateway -f'));
  }

  console.log(chalk.dim(`\nTo undo: openclawpro restore ${safetyPath.split('/').pop()}`));
}
