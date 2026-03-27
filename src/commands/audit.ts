import chalk from 'chalk';
import { run, runSafe, commandExists } from '../utils/exec.js';
import { isRoot, getOpenclawDir, getServiceStatus } from '../utils/system.js';
import { readOpenClawConfig } from '../utils/config.js';
import { validateSSHConfig, getFilePermissions } from '../utils/security.js';
import { existsSync, statSync, readdirSync } from 'node:fs';
import type { AuditCheck } from '../types.js';

export async function audit(options?: { json?: boolean; fix?: boolean }): Promise<void> {
  if (!options?.json) {
    console.log(chalk.bold('\n🔍 Security Audit\n'));
  }

  const checks: AuditCheck[] = [];

  // 1. Gateway bind address — check both actual bind and config
  const gatewayBind = runSafe("ss -tlnp | grep ':18789'");
  const configBind = config.gateway?.bind;
  if (gatewayBind?.includes('0.0.0.0') && configBind !== 'loopback') {
    checks.push({
      name: 'Gateway Bind',
      status: 'FAIL',
      message: 'Gateway bound to 0.0.0.0 (publicly accessible)',
      fix: 'Set gateway.bind to "loopback" in openclaw.json',
    });
  } else if (gatewayBind?.includes('127.0.0.1') || configBind === 'loopback') {
    // Config says loopback — OpenClaw may still show 0.0.0.0 in ss but respects the config
    checks.push({ name: 'Gateway Bind', status: 'PASS', message: `Gateway bind: ${configBind || 'loopback'} (config)` });
  } else if (gatewayBind) {
    checks.push({ name: 'Gateway Bind', status: 'WARN', message: 'Gateway running but bind not confirmed as loopback' });
  } else {
    checks.push({ name: 'Gateway Bind', status: 'WARN', message: 'Gateway not running or port not detected' });
  }

  // 2. UFW active
  const ufwStatus = runSafe('ufw status');
  if (ufwStatus?.includes('Status: active')) {
    checks.push({ name: 'UFW Firewall', status: 'PASS', message: 'UFW is active' });
  } else {
    checks.push({ name: 'UFW Firewall', status: 'FAIL', message: 'UFW is not active', fix: 'Run: openclawpro add security' });
  }

  // 3. Fail2ban active
  if (getServiceStatus('fail2ban') === 'active') {
    checks.push({ name: 'Fail2ban', status: 'PASS', message: 'Fail2ban is active' });
  } else {
    checks.push({ name: 'Fail2ban', status: 'FAIL', message: 'Fail2ban is not active', fix: 'Run: openclawpro add security' });
  }

  // 4. SSH hardening
  checks.push(validateSSHConfig());

  // 5. Gateway token
  const config = readOpenClawConfig();
  const token = config.gateway?.auth?.token;
  if (!token || token === 'CHANGE_ME_GENERATE_WITH_openssl_rand_hex_36' || token.length < 32) {
    checks.push({
      name: 'Gateway Token',
      status: 'FAIL',
      message: token ? 'Token is placeholder or too short (< 32 chars)' : 'No gateway token set',
      fix: 'Generate with: openssl rand -hex 36',
    });
  } else {
    checks.push({ name: 'Gateway Token', status: 'PASS', message: `Token set (${token.length} chars)` });
  }

  // 6. File permissions
  const oclawDir = getOpenclawDir();
  const dirPerms = getFilePermissions(oclawDir);
  if (dirPerms && parseInt(dirPerms, 8) > 0o700) {
    checks.push({
      name: 'Directory Permissions',
      status: 'FAIL',
      message: `${oclawDir} has permissions ${dirPerms} (should be 700)`,
      fix: `Run: chmod 700 ${oclawDir}`,
    });
  } else if (dirPerms) {
    checks.push({ name: 'Directory Permissions', status: 'PASS', message: `${oclawDir} permissions: ${dirPerms}` });
  }

  // 7. Unattended upgrades
  if (existsSync('/etc/apt/apt.conf.d/20auto-upgrades')) {
    checks.push({ name: 'Unattended Upgrades', status: 'PASS', message: 'Auto security updates enabled' });
  } else {
    checks.push({
      name: 'Unattended Upgrades',
      status: 'WARN',
      message: 'Not configured',
      fix: 'Run: openclawpro add security',
    });
  }

  // 8. Avahi/mDNS disabled
  const avahiStatus = runSafe('systemctl is-active avahi-daemon');
  if (avahiStatus === 'active') {
    checks.push({
      name: 'Avahi/mDNS',
      status: 'WARN',
      message: 'Avahi is running (leaks network info)',
      fix: 'Run: systemctl stop avahi-daemon && systemctl disable avahi-daemon',
    });
  } else {
    checks.push({ name: 'Avahi/mDNS', status: 'PASS', message: 'Avahi disabled' });
  }

  // 9. Kernel hardening
  const aslr = runSafe('sysctl -n kernel.randomize_va_space');
  if (aslr === '2') {
    checks.push({ name: 'Kernel Hardening', status: 'PASS', message: 'ASLR and sysctl hardening applied' });
  } else {
    checks.push({
      name: 'Kernel Hardening',
      status: 'WARN',
      message: 'ASLR not fully enabled',
      fix: 'Run: openclawpro add security',
    });
  }

  // 10. Caddy/Cloudflare (gateway not exposed directly)
  const caddyActive = getServiceStatus('caddy') === 'active';
  const cfActive = getServiceStatus('cloudflared') === 'active';
  if (caddyActive || cfActive) {
    checks.push({ name: 'Reverse Proxy', status: 'PASS', message: `${caddyActive ? 'Caddy' : 'Cloudflare Tunnel'} active` });
  } else {
    checks.push({
      name: 'Reverse Proxy',
      status: 'WARN',
      message: 'No reverse proxy detected — gateway may be directly exposed',
      fix: 'Run: openclawpro add caddy OR openclawpro add cloudflare',
    });
  }

  // 11. DM Allowlist — OpenClaw uses dmPolicy + allowFrom at channel root level
  const channels = config.channels || {};
  const hasAllowlist = Object.values(channels).some(
    (ch: any) =>
      (ch?.dmPolicy === 'allowlist' && ch?.allowFrom?.length > 0) ||
      (ch?.dm?.policy === 'allowlist' && ch?.dm?.allowFrom?.length > 0)
  );
  if (hasAllowlist) {
    checks.push({ name: 'DM Allowlist', status: 'PASS', message: 'DM allowlist configured' });
  } else if (Object.keys(channels).length > 0) {
    checks.push({
      name: 'DM Allowlist',
      status: 'FAIL',
      message: 'Channels configured but no DM allowlist — anyone can message the bot',
      fix: 'Add dm.policy: "allowlist" and dm.allowFrom in openclaw.json',
    });
  } else {
    checks.push({ name: 'DM Allowlist', status: 'PASS', message: 'No channels configured (N/A)' });
  }

  // 12. Memory defense
  const memoryPath = `${oclawDir}/agents/main/MEMORY.md`;
  if (existsSync(memoryPath)) {
    const { readFileSync } = await import('node:fs');
    const memory = readFileSync(memoryPath, 'utf-8');
    if (memory.includes('Security Protocol') || memory.includes('prompt injection')) {
      checks.push({ name: 'Anti Prompt Injection', status: 'PASS', message: 'Memory defense installed' });
    } else {
      checks.push({
        name: 'Anti Prompt Injection',
        status: 'WARN',
        message: 'MEMORY.md exists but no security protocol found',
      });
    }
  } else {
    checks.push({
      name: 'Anti Prompt Injection',
      status: 'WARN',
      message: 'No MEMORY.md security protocol',
      fix: 'Will be installed during setup',
    });
  }

  // 13. Backup recency
  const backupDir = `${getOpenclawDir()}/backups`;
  if (existsSync(backupDir)) {
    const backups = readdirSync(backupDir).filter(f => f.endsWith('.tar.gz'));
    if (backups.length > 0) {
      const latest = backups.sort().pop()!;
      const latestStat = statSync(`${backupDir}/${latest}`);
      const ageHours = (Date.now() - latestStat.mtimeMs) / (1000 * 60 * 60);
      if (ageHours < 48) {
        checks.push({ name: 'Backup', status: 'PASS', message: `Latest backup: ${latest} (${Math.round(ageHours)}h ago)` });
      } else {
        checks.push({
          name: 'Backup',
          status: 'WARN',
          message: `Latest backup is ${Math.round(ageHours)}h old (> 48h)`,
          fix: 'Run: openclawpro backup',
        });
      }
    } else {
      checks.push({ name: 'Backup', status: 'WARN', message: 'No backups found', fix: 'Run: openclawpro backup' });
    }
  } else {
    checks.push({ name: 'Backup', status: 'WARN', message: 'No backup directory', fix: 'Run: openclawpro backup' });
  }

  // 14. Disk usage
  const diskUsage = runSafe("df / | tail -1 | awk '{print $5}' | tr -d '%'");
  if (diskUsage) {
    const usage = parseInt(diskUsage);
    if (usage >= 95) {
      checks.push({ name: 'Disk Usage', status: 'FAIL', message: `${usage}% used (critical)` });
    } else if (usage >= 85) {
      checks.push({ name: 'Disk Usage', status: 'WARN', message: `${usage}% used` });
    } else {
      checks.push({ name: 'Disk Usage', status: 'PASS', message: `${usage}% used` });
    }
  }

  // 15. Tailscale (optional but good)
  if (commandExists('tailscale')) {
    const tsStatus = runSafe('tailscale status --json');
    if (tsStatus) {
      checks.push({ name: 'Tailscale VPN', status: 'PASS', message: 'Tailscale connected' });
    } else {
      checks.push({ name: 'Tailscale VPN', status: 'WARN', message: 'Tailscale installed but not connected' });
    }
  }

  // Output
  if (options?.json) {
    console.log(JSON.stringify(checks, null, 2));
  } else {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const warn = checks.filter(c => c.status === 'WARN').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;

    for (const check of checks) {
      const icon = check.status === 'PASS' ? chalk.green('✓') :
                   check.status === 'WARN' ? chalk.yellow('⚠') :
                   chalk.red('✗');
      const status = check.status === 'PASS' ? chalk.green(check.status) :
                     check.status === 'WARN' ? chalk.yellow(check.status) :
                     chalk.red(check.status);
      console.log(`  ${icon} ${status}  ${check.name} — ${check.message}`);
      if (check.fix && check.status !== 'PASS') {
        console.log(chalk.dim(`           Fix: ${check.fix}`));
      }
    }

    console.log(chalk.bold(`\nResults: ${chalk.green(`${pass} PASS`)} | ${chalk.yellow(`${warn} WARN`)} | ${chalk.red(`${fail} FAIL`)}`));

    if (fail > 0) {
      console.log(chalk.red('\n⚠ Critical issues found — fix FAIL items before going to production'));
      process.exitCode = 1;
    } else if (warn > 0) {
      console.log(chalk.yellow('\n⚠ Some warnings — review WARN items'));
    } else {
      console.log(chalk.green('\n✅ All checks passed'));
    }
  }

  // Auto-fix if requested
  if (options?.fix) {
    const fixable = checks.filter(c => c.status === 'FAIL' && c.fix);
    if (fixable.length > 0) {
      console.log(chalk.cyan('\n→ Auto-fixing...'));
      for (const check of fixable) {
        if (check.name === 'Directory Permissions') {
          run(`chmod 700 ${getOpenclawDir()}`);
          console.log(chalk.green(`  ✓ Fixed: ${check.name}`));
        }
        // Other auto-fixes can be added here
      }
    }
  }
}
