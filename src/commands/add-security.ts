import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { run, runSafe, runWithSpinner, commandExists } from '../utils/exec.js';
import { isRoot, isLinux } from '../utils/system.js';
import {
  backupSSHConfig,
  rollbackSSHConfig,
  testSSHConfig,
} from '../utils/security.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES = join(__dirname, '..', '..', 'templates');

export async function addSecurity(): Promise<void> {
  console.log(chalk.bold('\n🔒 Security Hardening\n'));

  if (!isRoot()) {
    console.log(chalk.red('This command must be run as root'));
    process.exit(1);
  }

  if (!isLinux()) {
    console.log(chalk.red('This command only works on Linux'));
    process.exit(1);
  }

  // Step 1: UFW Firewall
  console.log(chalk.cyan('\n→ Step 1/6: UFW Firewall'));
  if (commandExists('ufw')) {
    const ufwStatus = runSafe('ufw status');
    if (ufwStatus?.includes('inactive')) {
      await runWithSpinner('Configuring UFW...', 'ufw default deny incoming');
      run('ufw default allow outgoing');
      run('ufw allow 22/tcp comment "SSH"');
      run('ufw allow 80/tcp comment "HTTP"');
      run('ufw allow 443/tcp comment "HTTPS"');
      run('yes | ufw enable');
      console.log(chalk.green('  ✓ UFW enabled (SSH, HTTP, HTTPS allowed)'));
    } else {
      console.log(chalk.green('  ✓ UFW already active'));
    }
  } else {
    await runWithSpinner('Installing UFW...', 'apt-get install -y ufw');
    run('ufw default deny incoming');
    run('ufw default allow outgoing');
    run('ufw allow 22/tcp comment "SSH"');
    run('ufw allow 80/tcp comment "HTTP"');
    run('ufw allow 443/tcp comment "HTTPS"');
    run('yes | ufw enable');
    console.log(chalk.green('  ✓ UFW installed and enabled'));
  }

  // Step 2: Fail2ban
  console.log(chalk.cyan('\n→ Step 2/6: Fail2ban'));
  if (!commandExists('fail2ban-client')) {
    await runWithSpinner('Installing Fail2ban...', 'apt-get install -y fail2ban');
  }
  const jailConfig = `[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
backend  = %(sshd_backend)s
maxretry = 3
bantime  = 24h
`;
  const { writeFileSync } = await import('node:fs');
  writeFileSync('/etc/fail2ban/jail.local', jailConfig);

  // Add gateway jail
  const gatewayJail = readFileSync(join(TEMPLATES, 'jail-gateway.conf'), 'utf-8');
  writeFileSync('/etc/fail2ban/jail.d/openclaw-gateway.conf', gatewayJail);

  run('systemctl enable fail2ban');
  run('systemctl restart fail2ban');
  console.log(chalk.green('  ✓ Fail2ban configured (SSH: 3 retries/24h ban, Gateway: 5 retries/1h ban)'));

  // Step 3: SSH Hardening (with rollback safety from secure-setup)
  console.log(chalk.cyan('\n→ Step 3/6: SSH Hardening'));
  console.log(chalk.yellow('  ⚠ Backup current SSH config before modifying'));

  const backupPath = backupSSHConfig();
  console.log(chalk.dim(`  Backup saved to ${backupPath}`));

  const hardeningConf = readFileSync(join(TEMPLATES, 'sshd-hardening.conf'), 'utf-8');
  run('mkdir -p /etc/ssh/sshd_config.d');
  writeFileSync('/etc/ssh/sshd_config.d/hardening.conf', hardeningConf);

  // Test before applying (SSH rollback safety from secure-setup)
  if (testSSHConfig()) {
    runSafe('systemctl restart ssh') || runSafe('systemctl restart sshd');
    console.log(chalk.green('  ✓ SSH hardened (key-only, root restricted, strong ciphers)'));
  } else {
    console.log(chalk.red('  ✗ SSH config test failed — rolling back'));
    rollbackSSHConfig();
    console.log(chalk.yellow('  ⚠ SSH config restored from backup'));
  }

  // Step 4: Kernel hardening (from clincher + clawbot)
  console.log(chalk.cyan('\n→ Step 4/6: Kernel Hardening'));
  const sysctlConf = readFileSync(join(TEMPLATES, 'sysctl-hardening.conf'), 'utf-8');
  writeFileSync('/etc/sysctl.d/99-openclaw-hardening.conf', sysctlConf);
  run('sysctl --system');
  console.log(chalk.green('  ✓ Kernel hardened (ASLR, BPF, ICMP, SYN cookies, ptrace)'));

  // Step 5: Unattended upgrades
  console.log(chalk.cyan('\n→ Step 5/6: Unattended Upgrades'));
  if (!commandExists('unattended-upgrade')) {
    await runWithSpinner('Installing unattended-upgrades...', 'apt-get install -y unattended-upgrades');
  }
  const autoUpgrades = `APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
`;
  writeFileSync('/etc/apt/apt.conf.d/20auto-upgrades', autoUpgrades);
  console.log(chalk.green('  ✓ Unattended upgrades enabled (daily security patches)'));

  // Step 6: Disable Avahi/mDNS (from zuocharles)
  console.log(chalk.cyan('\n→ Step 6/6: Disable Avahi/mDNS'));
  if (runSafe('systemctl is-active avahi-daemon') === 'active') {
    run('systemctl stop avahi-daemon');
    run('systemctl disable avahi-daemon');
    run('systemctl mask avahi-daemon');
    console.log(chalk.green('  ✓ Avahi/mDNS disabled (prevents network info leakage)'));
  } else {
    console.log(chalk.green('  ✓ Avahi already disabled'));
  }

  console.log(chalk.bold.green('\n✅ Security hardening complete\n'));
  console.log(chalk.dim('Run `openclawpro audit` to verify all checks pass'));
}
