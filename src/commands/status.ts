import chalk from 'chalk';
import { runSafe, commandExists } from '../utils/exec.js';
import { getServiceStatus, getOpenclawDir, isPortInUse } from '../utils/system.js';
import { readOpenClawConfig } from '../utils/config.js';
import { existsSync, readdirSync, statSync } from 'node:fs';

export async function status(): Promise<void> {
  console.log(chalk.bold('\n📊 OpenClawPro Status Dashboard\n'));

  // Services
  console.log(chalk.cyan('Services:'));
  const services = [
    { name: 'openclaw-gateway', label: 'Gateway' },
    { name: 'openclaw-hooks-proxy', label: 'Hooks Proxy' },
    { name: 'cloudflared', label: 'Cloudflare Tunnel' },
    { name: 'caddy', label: 'Caddy Proxy' },
    { name: 'tailscaled', label: 'Tailscale VPN' },
    { name: 'fail2ban', label: 'Fail2ban' },
  ];

  for (const svc of services) {
    const st = getServiceStatus(svc.name);
    const icon = st === 'active' ? chalk.green('●') :
                 st === 'failed' ? chalk.red('●') :
                 chalk.dim('○');
    console.log(`  ${icon} ${svc.label}: ${st}`);
  }

  // Ports
  console.log(chalk.cyan('\nPorts:'));
  const ports = [18789, 18800, 80, 443];
  for (const port of ports) {
    const inUse = isPortInUse(port);
    console.log(`  ${inUse ? chalk.green('●') : chalk.dim('○')} :${port} ${inUse ? 'listening' : 'closed'}`);
  }

  // Config
  const config = readOpenClawConfig();
  console.log(chalk.cyan('\nConfiguration:'));
  console.log(`  Gateway bind: ${config.gateway?.bind || 'default'}`);
  console.log(`  Gateway token: ${config.gateway?.auth?.token ? `set (${config.gateway.auth.token.length} chars)` : chalk.red('NOT SET')}`);
  console.log(`  Sandbox: ${config.agents?.defaults?.sandbox ? 'enabled' : 'disabled'}`);

  // Channels
  const channels = config.channels || {};
  const enabledChannels = Object.entries(channels).filter(([, v]: [string, any]) => v?.enabled);
  console.log(`  Channels: ${enabledChannels.length > 0 ? enabledChannels.map(([k]) => k).join(', ') : 'none'}`);

  // System
  console.log(chalk.cyan('\nSystem:'));
  const uptime = runSafe('uptime -p');
  const disk = runSafe("df -h / | tail -1 | awk '{print $3 \"/\" $2 \" (\" $5 \")\"}'");
  const memory = runSafe("free -h | grep Mem | awk '{print $3 \"/\" $2}'");
  console.log(`  Uptime: ${uptime || 'unknown'}`);
  console.log(`  Disk: ${disk || 'unknown'}`);
  console.log(`  Memory: ${memory || 'unknown'}`);

  // Tailscale
  if (commandExists('tailscale')) {
    const tsIp = runSafe('tailscale ip -4');
    console.log(`  Tailscale IP: ${tsIp || 'not connected'}`);
  }

  // Last backup
  const backupDir = `${getOpenclawDir()}/backups`;
  if (existsSync(backupDir)) {
    const backups = readdirSync(backupDir).filter(f => f.startsWith('openclaw-backup-')).sort().reverse();
    if (backups.length > 0) {
      const latest = backups[0];
      const stat = statSync(`${backupDir}/${latest}`);
      const ageHours = Math.round((Date.now() - stat.mtimeMs) / (1000 * 60 * 60));
      console.log(`\n  Last backup: ${latest} (${ageHours}h ago)`);
    }
  }

  // Fail2ban stats
  const banned = runSafe('fail2ban-client status sshd 2>/dev/null | grep "Currently banned"');
  if (banned) {
    console.log(`  ${banned.trim()}`);
  }

  console.log('');
}
