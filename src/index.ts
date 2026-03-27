import { Command } from 'commander';

const program = new Command();

program
  .name('openclawpro')
  .description('One-command secure OpenClaw setup for VPS')
  .version('1.0.0');

program
  .command('setup')
  .description('Full VPS setup wizard')
  .option('--tailscale', 'Install Tailscale VPN')
  .option('--caddy', 'Install Caddy reverse proxy')
  .option('--egress', 'Enable egress firewall')
  .option('--no-interactive', 'Non-interactive mode (use defaults)')
  .action(async (options) => {
    const { setup } = await import('./commands/setup.js');
    await setup(options);
  });

const add = program.command('add').description('Add features to your setup');

add
  .command('security')
  .description('Harden server security (UFW, Fail2ban, SSH, kernel)')
  .action(async () => {
    const { addSecurity } = await import('./commands/add-security.js');
    await addSecurity();
  });

add
  .command('tailscale')
  .description('Install and configure Tailscale VPN')
  .action(async () => {
    const { addTailscale } = await import('./commands/add-tailscale.js');
    await addTailscale();
  });

add
  .command('caddy')
  .description('Install Caddy reverse proxy with auto-HTTPS and basic auth')
  .option('--domain <domain>', 'Domain name for HTTPS')
  .action(async (options) => {
    const { addCaddy } = await import('./commands/add-caddy.js');
    await addCaddy(options);
  });

add
  .command('egress')
  .description('Enable egress firewall (whitelist API domains only)')
  .option('--rollback', 'Remove egress firewall rules')
  .action(async (options) => {
    const { addEgress } = await import('./commands/add-egress.js');
    await addEgress(options);
  });

add
  .command('cloudflare')
  .description('Setup Cloudflare tunnel')
  .action(async () => {
    const { addCloudflare } = await import('./commands/add-cloudflare.js');
    await addCloudflare();
  });

add
  .command('gmail')
  .description('Setup Gmail notifications')
  .action(async () => {
    const { addGmail } = await import('./commands/add-gmail.js');
    await addGmail();
  });

add
  .command('webhook')
  .description('Add custom webhook')
  .action(async () => {
    const { addWebhook } = await import('./commands/add-webhook.js');
    await addWebhook();
  });

program
  .command('audit')
  .description('Run security audit (PASS/WARN/FAIL)')
  .option('--json', 'Output as JSON')
  .option('--fix', 'Auto-fix simple issues')
  .action(async (options) => {
    const { audit } = await import('./commands/audit.js');
    await audit(options);
  });

program
  .command('backup')
  .description('Backup OpenClaw config and data')
  .option('--encrypt', 'Encrypt backup with GPG')
  .option('--install-cron', 'Install daily backup cron')
  .action(async (options) => {
    const { backup } = await import('./commands/backup.js');
    await backup(options);
  });

program
  .command('restore')
  .description('Restore from backup')
  .argument('[file]', 'Backup file to restore')
  .option('--dry-run', 'List available backups only')
  .action(async (file, options) => {
    const { restore } = await import('./commands/restore.js');
    await restore(file, options);
  });

program
  .command('update')
  .description('Update all components')
  .action(async () => {
    const { update } = await import('./commands/update.js');
    await update();
  });

program
  .command('install-skills')
  .description('Install Claude Code skills')
  .action(async () => {
    const { installSkills } = await import('./commands/install-skills.js');
    await installSkills();
  });

program
  .command('status')
  .description('Show status dashboard')
  .action(async () => {
    const { status } = await import('./commands/status.js');
    await status();
  });

export function main() {
  program.parse();
}
