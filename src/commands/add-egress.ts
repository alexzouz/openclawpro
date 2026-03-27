import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { run, runSafe, runWithSpinner, commandExists } from '../utils/exec.js';
import { isRoot } from '../utils/system.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES = join(__dirname, '..', '..', 'templates');

export async function addEgress(options?: { rollback?: boolean }): Promise<void> {
  console.log(chalk.bold('\n🛡️  Egress Firewall Setup\n'));

  if (!isRoot()) {
    console.log(chalk.red('This command must be run as root'));
    process.exit(1);
  }

  // Step 1: Install ipset if needed
  if (!commandExists('ipset')) {
    await runWithSpinner('Installing ipset', 'apt-get install -y ipset');
  }

  // Step 2: Read allowlist
  const allowlistPath = '/etc/openclaw/egress-allowlist.conf';
  if (!existsSync(allowlistPath)) {
    run('mkdir -p /etc/openclaw');
    const defaultAllowlist = readFileSync(join(TEMPLATES, 'egress-allowlist.conf'), 'utf-8');
    writeFileSync(allowlistPath, defaultAllowlist);
    console.log(chalk.green(`  ✓ Allowlist created at ${allowlistPath}`));
  }

  const allowlist = readFileSync(allowlistPath, 'utf-8');
  const domains = allowlist
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  console.log(chalk.cyan(`  ${domains.length} domains in allowlist`));

  // Step 3: Create ipset and resolve domains
  console.log(chalk.cyan('\n→ Resolving allowed domains...'));
  runSafe('ipset destroy openclaw-egress 2>/dev/null');
  run('ipset create openclaw-egress hash:ip timeout 3600');

  let resolved = 0;
  for (const domain of domains) {
    const ips = runSafe(`dig +short ${domain} A`);
    if (ips) {
      for (const ip of ips.split('\n').filter(Boolean)) {
        if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
          runSafe(`ipset add openclaw-egress ${ip} timeout 3600 2>/dev/null`);
          resolved++;
        }
      }
    }
  }
  console.log(chalk.green(`  ✓ ${resolved} IPs resolved and added`));

  // Step 4: Create iptables rules
  console.log(chalk.cyan('\n→ Applying iptables egress rules...'));

  // Flush existing openclaw chain
  runSafe('iptables -D OUTPUT -j OPENCLAW-EGRESS 2>/dev/null');
  runSafe('iptables -F OPENCLAW-EGRESS 2>/dev/null');
  runSafe('iptables -X OPENCLAW-EGRESS 2>/dev/null');

  // Create chain
  run('iptables -N OPENCLAW-EGRESS');

  // Allow established connections
  run('iptables -A OPENCLAW-EGRESS -m state --state ESTABLISHED,RELATED -j RETURN');

  // Allow loopback
  run('iptables -A OPENCLAW-EGRESS -o lo -j RETURN');

  // Allow DNS (for resolution)
  run('iptables -A OPENCLAW-EGRESS -p udp --dport 53 -j RETURN');
  run('iptables -A OPENCLAW-EGRESS -p tcp --dport 53 -j RETURN');

  // Allow SSH (prevent lockout)
  run('iptables -A OPENCLAW-EGRESS -p tcp --dport 22 -j RETURN');

  // Allow Tailscale (if installed)
  if (commandExists('tailscale')) {
    run('iptables -A OPENCLAW-EGRESS -p udp --dport 41641 -j RETURN');
  }

  // Allow NTP
  run('iptables -A OPENCLAW-EGRESS -p udp --dport 123 -j RETURN');

  // Allow whitelisted IPs
  run('iptables -A OPENCLAW-EGRESS -m set --match-set openclaw-egress dst -j RETURN');

  // Log and reject everything else
  run('iptables -A OPENCLAW-EGRESS -j LOG --log-prefix "OPENCLAW-EGRESS-BLOCKED: " --log-level 4');
  run('iptables -A OPENCLAW-EGRESS -j REJECT');

  // Insert chain into OUTPUT
  run('iptables -I OUTPUT -j OPENCLAW-EGRESS');

  console.log(chalk.green('  ✓ Egress firewall active'));

  // Step 5: Create cron for DNS re-resolution
  const cronScript = `#!/bin/bash
# OpenClawPro egress allowlist refresh
# Re-resolves domains every 15 minutes (CDN IPs change)

ALLOWLIST="/etc/openclaw/egress-allowlist.conf"
ipset flush openclaw-egress 2>/dev/null || ipset create openclaw-egress hash:ip timeout 3600

while IFS= read -r domain; do
  domain=$(echo "$domain" | xargs)
  [[ -z "$domain" || "$domain" == \\#* ]] && continue
  for ip in $(dig +short "$domain" A 2>/dev/null); do
    [[ "$ip" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$ ]] && ipset add openclaw-egress "$ip" timeout 3600 2>/dev/null
  done
done < "$ALLOWLIST"
`;
  writeFileSync('/etc/openclaw/refresh-egress.sh', cronScript, { mode: 0o755 });

  // Install cron
  const cronEntry = '*/15 * * * * /etc/openclaw/refresh-egress.sh > /dev/null 2>&1';
  const existingCron = runSafe('crontab -l') || '';
  if (!existingCron.includes('refresh-egress')) {
    const newCron = existingCron ? `${existingCron}\n${cronEntry}\n` : `${cronEntry}\n`;
    run(`echo '${newCron.replace(/'/g, "'\\''")}' | crontab -`);
    console.log(chalk.green('  ✓ DNS refresh cron installed (every 15 min)'));
  }

  // Step 6: Save iptables rules for persistence
  if (commandExists('iptables-save')) {
    run('mkdir -p /etc/iptables');
    run('iptables-save > /etc/iptables/rules.v4');
    // Install iptables-persistent if not already
    if (!existsSync('/etc/iptables/rules.v4')) {
      runSafe('DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent');
    }
    console.log(chalk.green('  ✓ iptables rules persisted'));
  }

  console.log(chalk.bold.green('\n✅ Egress firewall configured'));
  console.log(chalk.dim(`\nEdit allowlist: ${allowlistPath}`));
  console.log(chalk.dim('Refresh now: /etc/openclaw/refresh-egress.sh'));
  console.log(chalk.dim('Rollback: openclawpro add egress --rollback'));
}
