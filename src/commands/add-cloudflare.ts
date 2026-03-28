import chalk from 'chalk';
import { input, confirm } from '@inquirer/prompts';
import { commandExists, runWithSpinner, run, runSafe } from '../utils/exec.js';
import { isRoot } from '../utils/system.js';
import { readCLIConfig, writeCLIConfig } from '../utils/config.js';

export async function addCloudflare(_options?: unknown): Promise<void> {
  console.log(chalk.bold('\n☁️  Cloudflare Tunnel Setup\n'));

  if (!isRoot()) {
    console.log(chalk.red('This command must be run as root'));
    process.exit(1);
  }

  // Step 1: Check cloudflared is installed
  if (!commandExists('cloudflared')) {
    console.log(chalk.red('  ✗ cloudflared is not installed'));
    console.log(chalk.yellow('  Run `openclawpro setup` first to install cloudflared'));
    process.exit(1);
  }
  console.log(chalk.green('  ✓ cloudflared is installed'));

  // Step 2: Ask for tunnel token
  console.log(chalk.cyan('\n→ Configure Cloudflare Tunnel\n'));
  console.log(chalk.dim('  To get your tunnel token:'));
  console.log(chalk.dim('  1. Go to https://one.dash.cloudflare.com'));
  console.log(chalk.dim('  2. Navigate to Networks > Tunnels'));
  console.log(chalk.dim('  3. Click "Add a connector" or select existing tunnel'));
  console.log(chalk.dim('  4. Copy the token from the install command\n'));

  const tunnelToken = await input({
    message: 'Cloudflare Tunnel token:',
    validate: (val: string) => val.trim().length > 0 || 'Token is required',
  });

  // Step 3: Force HTTP/2 protocol (QUIC is blocked on many VPS providers)
  console.log(chalk.cyan('\n→ Configuring Cloudflare protocol...'));
  run('mkdir -p /etc/cloudflared');
  const { writeFileSync } = await import('node:fs');
  writeFileSync('/etc/cloudflared/config.yml', 'protocol: http2\n');
  console.log(chalk.green('  ✓ Forced HTTP/2 protocol (QUIC blocked on most VPS)'));

  // Step 4: Install cloudflared as system service
  console.log(chalk.cyan('\n→ Installing cloudflared as system service...'));
  try {
    // Uninstall first in case of previous failed attempt
    runSafe('cloudflared service uninstall 2>/dev/null');
    await runWithSpinner(
      'Installing cloudflared service',
      `cloudflared service install ${tunnelToken.trim()}`
    );
    console.log(chalk.green('  ✓ cloudflared service installed'));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('already installed') || msg.includes('already exists')) {
      console.log(chalk.yellow('  ⚠ cloudflared service already installed'));
    } else {
      console.log(chalk.red(`  ✗ Failed to install service: ${msg}`));
      console.log(chalk.yellow('  Try running: cloudflared service install <token> manually'));
      return;
    }
  }

  // Step 4: Ask for hooks domain
  console.log(chalk.cyan('\n→ Configure hooks domain\n'));
  console.log(chalk.dim('  This is the public domain for receiving webhooks'));
  console.log(chalk.dim('  Example: hooks.example.com\n'));

  const hooksDomain = await input({
    message: 'Hooks domain (e.g., hooks.example.com):',
    validate: (val: string) => {
      if (!val.trim()) return 'Domain is required';
      if (!val.includes('.')) return 'Enter a valid domain name';
      return true;
    },
  });

  // Step 5: Save hooksDomain to CLI config
  const cliConfig = readCLIConfig();
  writeCLIConfig({ ...cliConfig, hooksDomain: hooksDomain.trim() });
  console.log(chalk.green(`  ✓ Hooks domain saved: ${hooksDomain.trim()}`));

  // Step 6: Optionally configure CF API token
  const configureApi = await confirm({
    message: 'Configure Cloudflare API token for programmatic route management?',
    default: false,
  });

  if (configureApi) {
    console.log(chalk.dim('\n  Create an API token at https://dash.cloudflare.com/profile/api-tokens'));
    console.log(chalk.dim('  Required permissions: Zone:DNS:Edit, Account:Cloudflare Tunnel:Edit\n'));

    const apiToken = await input({
      message: 'Cloudflare API token:',
      validate: (val: string) => val.trim().length > 0 || 'Token is required',
    });

    const accountId = await input({
      message: 'Cloudflare Account ID (from dashboard overview):',
      validate: (val: string) => val.trim().length > 0 || 'Account ID is required',
    });

    const tunnelId = await input({
      message: 'Tunnel ID (from Networks > Tunnels):',
      validate: (val: string) => val.trim().length > 0 || 'Tunnel ID is required',
    });

    const updatedConfig = readCLIConfig();
    writeCLIConfig({
      ...updatedConfig,
      cloudflare: {
        apiToken: apiToken.trim(),
        accountId: accountId.trim(),
        tunnelId: tunnelId.trim(),
      },
    });
    console.log(chalk.green('  ✓ Cloudflare API credentials saved'));
  }

  // Step 7: Show next steps
  console.log(chalk.bold.green('\n✅ Cloudflare Tunnel configured\n'));
  console.log(chalk.bold('  Next steps:'));
  console.log(chalk.white('  1. In Cloudflare Dashboard > Networks > Tunnels'));
  console.log(chalk.white('  2. Select your tunnel > Public Hostname tab'));
  console.log(chalk.white('  3. Add a public hostname route:'));
  console.log(chalk.dim(`     Subdomain: ${hooksDomain.trim().split('.')[0]}`));
  console.log(chalk.dim(`     Domain: ${hooksDomain.trim().split('.').slice(1).join('.')}`));
  console.log(chalk.dim('     Type: HTTP'));
  console.log(chalk.dim('     URL: localhost:3001'));
  console.log(chalk.white('  4. Run `openclawpro add webhook` to add webhook routes'));
}
