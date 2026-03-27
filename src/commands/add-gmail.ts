import chalk from 'chalk';
import { input, confirm } from '@inquirer/prompts';
import { commandExists, runSafe, runInteractive, runWithSpinner } from '../utils/exec.js';
import { isRoot, getServiceStatus, writeSystemdService, enableAndStartService, getHomedir } from '../utils/system.js';
import { readCLIConfig, addHookMapping } from '../utils/config.js';
import { generateToken } from '../utils/security.js';
import { existsSync, writeFileSync } from 'node:fs';

export async function addGmail(_options?: unknown): Promise<void> {
  console.log(chalk.bold('\n📧 Gmail Integration Setup\n'));

  if (!isRoot()) {
    console.log(chalk.red('This command must be run as root'));
    process.exit(1);
  }

  // Step 1: Check prerequisites
  console.log(chalk.cyan('→ Checking prerequisites...\n'));

  if (!commandExists('cloudflared')) {
    console.log(chalk.red('  ✗ cloudflared not found'));
    console.log(chalk.yellow('  Run `openclawpro add cloudflare` first'));
    process.exit(1);
  }
  console.log(chalk.green('  ✓ cloudflared installed'));

  if (!commandExists('gcloud')) {
    console.log(chalk.red('  ✗ gcloud CLI not found'));
    console.log(chalk.yellow('  Install Google Cloud CLI: https://cloud.google.com/sdk/docs/install'));
    process.exit(1);
  }
  console.log(chalk.green('  ✓ gcloud CLI installed'));

  const cliConfig = readCLIConfig();
  if (!cliConfig.hooksDomain) {
    console.log(chalk.red('  ✗ Hooks domain not configured'));
    console.log(chalk.yellow('  Run `openclawpro add cloudflare` first'));
    process.exit(1);
  }
  console.log(chalk.green(`  ✓ Hooks domain: ${cliConfig.hooksDomain}`));

  const openclawStatus = getServiceStatus('openclaw');
  if (openclawStatus !== 'active') {
    console.log(chalk.yellow(`  ⚠ OpenClaw service status: ${openclawStatus}`));
    console.log(chalk.yellow('  Gmail integration works best with OpenClaw running'));
  } else {
    console.log(chalk.green('  ✓ OpenClaw service active'));
  }

  // Step 2: Get email address
  console.log(chalk.cyan('\n→ Gmail configuration\n'));

  const email = await input({
    message: 'Gmail address to watch:',
    validate: (val: string) => {
      if (!val.includes('@')) return 'Enter a valid email address';
      return true;
    },
  });

  // Step 3: Google Cloud authentication
  console.log(chalk.cyan('\n→ Google Cloud authentication\n'));
  console.log(chalk.dim('  A browser window will open for authentication'));
  console.log(chalk.dim('  Sign in with the Google account that owns the Gmail\n'));

  const doLogin = await confirm({
    message: 'Proceed with gcloud auth login?',
    default: true,
  });

  if (doLogin) {
    runInteractive('gcloud auth login --no-launch-browser');
  }

  // Step 4: GCP project selection
  console.log(chalk.cyan('\n→ GCP Project Setup\n'));
  console.log(chalk.dim('  You need a GCP project with billing enabled'));
  console.log(chalk.dim('  List projects: gcloud projects list\n'));

  const projectId = await input({
    message: 'GCP Project ID:',
    validate: (val: string) => val.trim().length > 0 || 'Project ID is required',
  });

  runInteractive(`gcloud config set project ${projectId.trim()}`);
  console.log(chalk.green(`  ✓ Project set to: ${projectId.trim()}`));

  // Step 5: Enable APIs
  console.log(chalk.cyan('\n→ Enabling required APIs...'));

  try {
    await runWithSpinner('Enabling Gmail API', `gcloud services enable gmail.googleapis.com --project=${projectId.trim()}`);
    console.log(chalk.green('  ✓ Gmail API enabled'));
  } catch {
    console.log(chalk.yellow('  ⚠ Gmail API may already be enabled'));
  }

  try {
    await runWithSpinner('Enabling Pub/Sub API', `gcloud services enable pubsub.googleapis.com --project=${projectId.trim()}`);
    console.log(chalk.green('  ✓ Pub/Sub API enabled'));
  } catch {
    console.log(chalk.yellow('  ⚠ Pub/Sub API may already be enabled'));
  }

  // Step 6: Guide OAuth credential creation
  console.log(chalk.cyan('\n→ OAuth Credentials\n'));
  console.log(chalk.bold('  Create OAuth 2.0 credentials:'));
  console.log(chalk.white('  1. Go to https://console.cloud.google.com/apis/credentials'));
  console.log(chalk.white(`  2. Select project: ${projectId.trim()}`));
  console.log(chalk.white('  3. Click "Create Credentials" > "OAuth client ID"'));
  console.log(chalk.white('  4. Application type: "Desktop app"'));
  console.log(chalk.white('  5. Download the JSON file\n'));

  const credentialsPath = await input({
    message: 'Path to downloaded OAuth credentials JSON:',
    validate: (val: string) => {
      if (!val.trim()) return 'Path is required';
      if (!existsSync(val.trim())) return 'File not found';
      return true;
    },
  });

  // Step 7: Configure gog (Gmail OAuth watcher)
  console.log(chalk.cyan('\n→ Configuring Gmail watcher (gog)...\n'));

  const gogDir = `${getHomedir()}/.config/gog`;
  runSafe(`mkdir -p ${gogDir}`);
  runSafe(`cp ${credentialsPath.trim()} ${gogDir}/credentials.json`);
  console.log(chalk.green('  ✓ OAuth credentials copied'));

  // Generate a keyring password for gog
  const keyringPassword = generateToken(24);
  const updatedConfig = readCLIConfig();
  const configWithKeyring = { ...updatedConfig, gogKeyringPassword: keyringPassword };
  const { writeCLIConfig } = await import('../utils/config.js');
  writeCLIConfig(configWithKeyring);

  // Write gog config
  const gogConfig = {
    email: email.trim(),
    webhook_url: `http://localhost:3001/hooks/gmail`,
    project_id: projectId.trim(),
    labels: ['INBOX'],
  };
  writeFileSync(`${gogDir}/config.json`, JSON.stringify(gogConfig, null, 2));
  console.log(chalk.green('  ✓ gog config written'));

  // Step 8: Add hook mapping
  const hookSecret = generateToken(32);
  addHookMapping('gmail', {
    type: 'gmail',
    channel: 'gmail',
    path: '/hooks/gmail',
    secret: hookSecret,
  });
  console.log(chalk.green('  ✓ Hook mapping added to openclaw.json'));

  // Step 9: Create systemd service
  const serviceContent = `[Unit]
Description=Gmail OAuth Watcher (gog)
After=network.target openclaw.service

[Service]
Type=simple
User=root
Environment=GOG_KEYRING_PASSWORD=${keyringPassword}
ExecStart=/usr/local/bin/gog watch
Restart=on-failure
RestartSec=10
WorkingDirectory=${getHomedir()}

[Install]
WantedBy=multi-user.target
`;

  writeSystemdService('gog-watcher', serviceContent);
  console.log(chalk.green('  ✓ systemd service created: gog-watcher'));

  // Step 10: Ask whether to start the service
  const startService = await confirm({
    message: 'Start the Gmail watcher service now?',
    default: false,
  });

  if (startService) {
    try {
      enableAndStartService('gog-watcher');
      console.log(chalk.green('  ✓ gog-watcher service started'));
    } catch {
      console.log(chalk.yellow('  ⚠ Could not start gog-watcher'));
      console.log(chalk.yellow('  You may need to run gog auth first'));
    }
  }

  // Step 11: Show next steps
  console.log(chalk.bold.green('\n✅ Gmail integration configured\n'));
  console.log(chalk.bold('  Next steps:'));
  console.log(chalk.white('  1. Run `gog auth` to complete OAuth flow'));
  console.log(chalk.white('  2. Run `systemctl start gog-watcher` to start watching'));
  console.log(chalk.white('  3. Ensure Cloudflare tunnel routes to hooks-proxy on port 3001'));
  console.log(chalk.white(`  4. Webhook URL: https://${cliConfig.hooksDomain}/hooks/gmail`));
  console.log(chalk.dim(`\n  Monitor: journalctl -u gog-watcher -f`));
}
