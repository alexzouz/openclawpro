import { execSync } from 'node:child_process';
import { readFileSync, existsSync, chmodSync, statSync } from 'node:fs';
import { run, runSafe } from './exec.js';
import type { AuditCheck } from '../types.js';

export function generateToken(bytes: number = 36): string {
  return execSync(`openssl rand -hex ${bytes}`).toString().trim();
}

export function generateBasicAuthPassword(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  const randomBytes = execSync(`openssl rand -hex ${length}`).toString().trim();
  for (let i = 0; i < length; i++) {
    const index = parseInt(randomBytes.substring(i * 2, i * 2 + 2), 16) % chars.length;
    password += chars[index];
  }
  return password;
}

export function enforceFilePermissions(path: string, mode: number): void {
  if (existsSync(path)) {
    chmodSync(path, mode);
  }
}

export function enforceDirectoryPermissions(path: string, mode: number): void {
  if (existsSync(path)) {
    chmodSync(path, mode);
  }
}

export function validateSSHConfig(): AuditCheck {
  const configPath = '/etc/ssh/sshd_config';
  const hardeningPath = '/etc/ssh/sshd_config.d/hardening.conf';

  if (!existsSync(configPath)) {
    return { name: 'SSH Hardening', status: 'FAIL', message: 'sshd_config not found' };
  }

  const config = readFileSync(configPath, 'utf-8');
  const hardening = existsSync(hardeningPath) ? readFileSync(hardeningPath, 'utf-8') : '';
  const combined = config + '\n' + hardening;

  const checks: string[] = [];
  if (!/PasswordAuthentication\s+no/i.test(combined)) checks.push('PasswordAuthentication not disabled');
  if (!/PermitRootLogin\s+(no|prohibit-password)/i.test(combined)) checks.push('Root login not restricted');
  if (!/PubkeyAuthentication\s+yes/i.test(combined)) checks.push('PubkeyAuthentication not enabled');
  if (!/MaxAuthTries\s+[1-5]\b/.test(combined)) checks.push('MaxAuthTries not limited');

  if (checks.length === 0) {
    return { name: 'SSH Hardening', status: 'PASS', message: 'SSH properly hardened' };
  }
  return {
    name: 'SSH Hardening',
    status: 'FAIL',
    message: checks.join(', '),
    fix: 'Run: openclawpro add security',
  };
}

export function backupSSHConfig(): string {
  const backupPath = '/etc/ssh/sshd_config.backup';
  run(`cp /etc/ssh/sshd_config ${backupPath}`);
  return backupPath;
}

export function rollbackSSHConfig(): boolean {
  const backupPath = '/etc/ssh/sshd_config.backup';
  if (!existsSync(backupPath)) return false;
  try {
    run(`cp ${backupPath} /etc/ssh/sshd_config`);
    runSafe('systemctl restart ssh') || runSafe('systemctl restart sshd');
    return true;
  } catch {
    return false;
  }
}

export function testSSHConfig(): boolean {
  return runSafe('sshd -t') !== null;
}

export function getFilePermissions(path: string): string | null {
  if (!existsSync(path)) return null;
  const stat = statSync(path);
  return (stat.mode & 0o777).toString(8);
}
