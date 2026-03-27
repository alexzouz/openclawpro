import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import type { OpenClawConfig, CLIConfig, ProxyRoute } from '../types.js';
import { getOpenclawDir, getCLIConfigDir, ensureDir } from './system.js';

export function readOpenClawConfig(): OpenClawConfig {
  const path = `${getOpenclawDir()}/openclaw.json`;
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function writeOpenClawConfig(config: OpenClawConfig): void {
  const dir = getOpenclawDir();
  ensureDir(dir);
  const path = `${dir}/openclaw.json`;
  writeFileSync(path, JSON.stringify(config, null, 2));
  chmodSync(path, 0o600);
}

export function readCLIConfig(): CLIConfig {
  const path = `${getCLIConfigDir()}/config.json`;
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function writeCLIConfig(config: CLIConfig): void {
  const dir = getCLIConfigDir();
  ensureDir(dir);
  const path = `${dir}/config.json`;
  writeFileSync(path, JSON.stringify(config, null, 2));
  chmodSync(path, 0o600);
}

export function addHookMapping(name: string, mapping: { type: string; channel: string; path?: string; secret?: string }): void {
  const config = readOpenClawConfig();
  const hooks = config.hooks || {};
  const updated: OpenClawConfig = { ...config, hooks: { ...hooks, [name]: mapping } };
  writeOpenClawConfig(updated);
}

export function readProxyRoutes(): ProxyRoute[] {
  const config = readCLIConfig();
  return config.proxyRoutes || [];
}

export function writeProxyRoutes(routes: ProxyRoute[]): void {
  const config = readCLIConfig();
  writeCLIConfig({ ...config, proxyRoutes: routes });
}
