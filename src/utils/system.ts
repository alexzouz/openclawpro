import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { run, runSafe, commandExists } from './exec.js';

export function isRoot(): boolean {
  return process.getuid?.() === 0;
}

export function isLinux(): boolean {
  return process.platform === 'linux';
}

export function isUbuntuOrDebian(): boolean {
  if (!isLinux()) return false;
  const release = runSafe('cat /etc/os-release');
  if (!release) return false;
  return release.includes('ubuntu') || release.includes('debian');
}

export function getNodeVersion(): string | null {
  return runSafe('node --version');
}

export function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

export function isPortInUse(port: number): boolean {
  const result = runSafe(`ss -tlnp | grep :${port}`);
  return result !== null && result.length > 0;
}

export function getServiceStatus(name: string): 'active' | 'inactive' | 'failed' | 'unknown' {
  const result = runSafe(`systemctl is-active ${name}`);
  if (result === 'active') return 'active';
  if (result === 'inactive') return 'inactive';
  if (result === 'failed') return 'failed';
  return 'unknown';
}

export function enableAndStartService(name: string): void {
  run(`systemctl enable ${name}`);
  run(`systemctl start ${name}`);
}

export function restartService(name: string): void {
  run(`systemctl restart ${name}`);
}

export function writeSystemdService(name: string, content: string): void {
  writeFileSync(`/etc/systemd/system/${name}.service`, content);
  run('systemctl daemon-reload');
}

export function readSystemdService(name: string): string | null {
  const path = `/etc/systemd/system/${name}.service`;
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

export function getHomedir(): string {
  return process.env.HOME || '/root';
}

export function getOpenclawDir(): string {
  return `${getHomedir()}/.openclaw`;
}

export function getWorkspaceDir(): string {
  return `${getOpenclawDir()}/workspace`;
}

export function getCLIConfigDir(): string {
  return `${getHomedir()}/.openclaw-vps`;
}
