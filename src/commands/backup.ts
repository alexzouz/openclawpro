import chalk from 'chalk';
import { run, runSafe, runWithSpinner } from '../utils/exec.js';
import { getOpenclawDir, getHomedir, ensureDir } from '../utils/system.js';
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';

export async function backup(options?: { encrypt?: boolean; installCron?: boolean }): Promise<void> {
  console.log(chalk.bold('\n💾 Backup\n'));

  const oclawDir = getOpenclawDir();
  const backupDir = `${oclawDir}/backups`;
  ensureDir(backupDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `openclaw-backup-${timestamp}.tar.gz`;
  const filepath = `${backupDir}/${filename}`;

  // Create backup
  console.log(chalk.cyan('→ Creating backup...'));
  const includes = [
    `${oclawDir}/openclaw.json`,
    `${oclawDir}/workspace`,
    `${oclawDir}/agents`,
    `${getHomedir()}/.openclaw-vps`,
    '/etc/openclaw',
  ].filter(p => existsSync(p));

  const includeArgs = includes.map(p => `"${p}"`).join(' ');
  await runWithSpinner('Archiving...', `tar -czf "${filepath}" ${includeArgs} 2>/dev/null || true`);

  // Encrypt if requested
  if (options?.encrypt) {
    console.log(chalk.cyan('→ Encrypting backup...'));
    await runWithSpinner('Encrypting with GPG...', `gpg --symmetric --cipher-algo AES256 "${filepath}"`);
    unlinkSync(filepath);
    const encryptedPath = `${filepath}.gpg`;
    const size = statSync(encryptedPath).size;
    console.log(chalk.green(`  ✓ Encrypted backup: ${encryptedPath} (${formatSize(size)})`));
  } else {
    const size = statSync(filepath).size;
    console.log(chalk.green(`  ✓ Backup created: ${filepath} (${formatSize(size)})`));
  }

  // Cleanup old backups (keep 7 days)
  const retention = 7;
  const cutoff = Date.now() - retention * 24 * 60 * 60 * 1000;
  const files = readdirSync(backupDir).filter(f => f.startsWith('openclaw-backup-'));
  let removed = 0;
  for (const file of files) {
    const stat = statSync(`${backupDir}/${file}`);
    if (stat.mtimeMs < cutoff) {
      unlinkSync(`${backupDir}/${file}`);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(chalk.dim(`  Cleaned up ${removed} backup(s) older than ${retention} days`));
  }

  // Install cron if requested
  if (options?.installCron) {
    const cronEntry = `30 3 * * * openclawpro backup > /dev/null 2>&1 # openclaw-backup`;
    const existingCron = runSafe('crontab -l') || '';
    if (!existingCron.includes('openclaw-backup')) {
      const newCron = existingCron ? `${existingCron}\n${cronEntry}\n` : `${cronEntry}\n`;
      run(`echo '${newCron.replace(/'/g, "'\\''")}' | crontab -`);
      console.log(chalk.green('  ✓ Daily backup cron installed (3:30 AM)'));
    } else {
      console.log(chalk.green('  ✓ Backup cron already installed'));
    }
  }

  console.log(chalk.bold.green('\n✅ Backup complete'));
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
