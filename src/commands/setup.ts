import chalk from 'chalk';
import { confirm, input } from '@inquirer/prompts';
import { run, runSafe, runWithSpinner, commandExists, runInteractive } from '../utils/exec.js';
import { isRoot, isLinux, isUbuntuOrDebian, ensureDir, getHomedir, getOpenclawDir, getWorkspaceDir, writeSystemdService } from '../utils/system.js';
import { readOpenClawConfig, writeOpenClawConfig, writeCLIConfig } from '../utils/config.js';
import { generateToken } from '../utils/security.js';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SetupState, SetupOptions } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES = join(__dirname, '..', '..', 'templates');

const STATE_FILE = '/tmp/openclawpro-setup-state.json';

function loadState(): SetupState | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveState(state: SetupState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearState(): void {
  if (existsSync(STATE_FILE)) {
    unlinkSync(STATE_FILE);
  }
}

export async function setup(options: Partial<SetupOptions> = {}): Promise<void> {
  console.log(chalk.bold.cyan(`
╔══════════════════════════════════════════╗
║         OpenClawPro Enhanced Setup       ║
║    Secure OpenClaw for your VPS          ║
╚══════════════════════════════════════════╝
`));

  // Pre-flight checks
  if (!isRoot()) {
    console.log(chalk.red('Error: This must be run as root'));
    console.log(chalk.dim('Run: sudo openclawpro setup'));
    process.exit(1);
  }

  if (!isLinux()) {
    console.log(chalk.red('Error: This setup is for Linux VPS only'));
    process.exit(1);
  }

  if (!isUbuntuOrDebian()) {
    console.log(chalk.yellow('Warning: Only tested on Ubuntu/Debian'));
    const proceed = await confirm({ message: 'Continue anyway?', default: false });
    if (!proceed) process.exit(0);
  }

  // Resume from interrupted state (from zuocharles)
  let state = loadState();
  if (state) {
    console.log(chalk.yellow(`\n⚠ Previous setup was interrupted at step ${state.currentStep}`));
    const resume = await confirm({ message: 'Resume from where you left off?', default: true });
    if (!resume) {
      state = null;
      clearState();
    }
  }

  const setupOptions: SetupOptions = state?.options || {
    tailscale: options.tailscale || false,
    caddy: options.caddy || false,
    egress: options.egress || false,
    noInteractive: options.noInteractive || false,
    domain: undefined,
  };

  // Interactive option selection (if not resuming and not --no-interactive)
  if (!state && !setupOptions.noInteractive) {
    console.log(chalk.cyan('\n📋 Setup Options\n'));

    setupOptions.tailscale = await confirm({
      message: 'Install Tailscale VPN? (makes server invisible on internet)',
      default: true,
    });

    setupOptions.caddy = await confirm({
      message: 'Install Caddy reverse proxy? (auto-HTTPS + basic auth)',
      default: true,
    });

    if (setupOptions.caddy) {
      setupOptions.domain = await input({
        message: 'Domain name for HTTPS (or localhost):',
        default: 'localhost',
      });
    }

    setupOptions.egress = await confirm({
      message: 'Enable egress firewall? (whitelist API domains only)',
      default: false,
    });
  }

  if (!state) {
    state = {
      currentStep: 1,
      completedSteps: [],
      startedAt: new Date().toISOString(),
      options: setupOptions,
    };
  }

  const steps = [
    { id: 'system-packages', name: 'System Packages', fn: installSystemPackages },
    { id: 'nodejs', name: 'Node.js 22', fn: installNodejs },
    { id: 'openclaw', name: 'OpenClaw', fn: installOpenclaw },
    { id: 'tools', name: 'Dev Tools (gh, Claude Code, Bun)', fn: installTools },
    { id: 'cloudflared', name: 'Cloudflared', fn: installCloudflared },
    { id: 'gcloud', name: 'Google Cloud CLI', fn: installGcloud },
    { id: 'security', name: 'Security Hardening', fn: runSecurityHardening },
    { id: 'tailscale', name: 'Tailscale VPN', fn: runTailscale, condition: () => setupOptions.tailscale },
    { id: 'config', name: 'OpenClaw Configuration', fn: configureOpenclaw },
    { id: 'onboard', name: 'OpenClaw Onboard', fn: runOnboard },
    { id: 'caddy', name: 'Caddy Reverse Proxy', fn: runCaddy, condition: () => setupOptions.caddy },
    { id: 'egress', name: 'Egress Firewall', fn: runEgress, condition: () => setupOptions.egress },
    { id: 'gateway-service', name: 'Gateway Service', fn: setupGatewayService },
    { id: 'hooks-proxy', name: 'Hooks Proxy', fn: setupHooksProxy },
    { id: 'memory-defense', name: 'Anti Prompt Injection', fn: installMemoryDefense },
    { id: 'aliases', name: 'Shell Aliases', fn: installAliases },
    { id: 'skills', name: 'Claude Skills', fn: runInstallSkills },
    { id: 'backup-cron', name: 'Backup Cron', fn: installBackupCron },
  ];

  for (let i = state.currentStep - 1; i < steps.length; i++) {
    const step = steps[i];

    // Skip conditional steps
    if (step.condition && !step.condition()) {
      continue;
    }

    // Skip already completed steps
    if (state.completedSteps.includes(step.id)) {
      continue;
    }

    state.currentStep = i + 1;
    saveState(state);

    console.log(chalk.cyan(`\n→ Step ${i + 1}/${steps.length}: ${step.name}`));

    try {
      await step.fn(setupOptions);
      state.completedSteps.push(step.id);
      saveState(state);
      console.log(chalk.green(`  ✓ ${step.name} complete`));
    } catch (error) {
      console.log(chalk.red(`  ✗ ${step.name} failed: ${error}`));
      console.log(chalk.yellow('  Resume later with: openclawpro setup'));
      return;
    }
  }

  // Cleanup state
  clearState();

  // Final summary
  console.log(chalk.bold.green(`
╔══════════════════════════════════════════╗
║         ✅ Setup Complete!               ║
╚══════════════════════════════════════════╝
`));
  console.log(chalk.dim('Useful commands:'));
  console.log(chalk.dim('  openclawpro status        — Dashboard'));
  console.log(chalk.dim('  openclawpro audit         — Security audit'));
  console.log(chalk.dim('  openclawpro backup        — Create backup'));
  console.log(chalk.dim('  oc-logs                   — Gateway logs'));
  console.log(chalk.dim('  oc-restart                — Restart gateway'));
  console.log(chalk.dim('\nRun `openclawpro audit` to verify your security posture'));
}

// Step implementations (each is idempotent)

async function installSystemPackages(): Promise<void> {
  await runWithSpinner('Updating packages', 'apt-get update -qq');
  await runWithSpinner('Installing system packages',
    'DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ' +
    'git curl ca-certificates jq ufw fail2ban unattended-upgrades ' +
    'apt-transport-https gnupg lsb-release wget build-essential unzip ipset dnsutils'
  );
}

async function installNodejs(): Promise<void> {
  if (commandExists('node')) {
    const version = runSafe('node --version');
    if (version?.startsWith('v22') || version?.startsWith('v24')) {
      console.log(chalk.dim(`  Already installed: ${version}`));
      return;
    }
  }
  await runWithSpinner('Adding NodeSource repo',
    'curl -fsSL https://deb.nodesource.com/setup_22.x | bash -'
  );
  await runWithSpinner('Installing Node.js', 'apt-get install -y -qq nodejs');
}

async function installOpenclaw(): Promise<void> {
  if (commandExists('openclaw')) {
    console.log(chalk.dim(`  Already installed: ${runSafe('openclaw --version')}`));
    return;
  }
  await runWithSpinner('Installing OpenClaw', 'npm install -g openclaw');
}

async function installTools(): Promise<void> {
  // GitHub CLI
  if (!commandExists('gh')) {
    await runWithSpinner('Installing GitHub CLI',
      'curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && ' +
      'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && ' +
      'apt-get update -qq && apt-get install -y -qq gh'
    );
  }

  // Claude Code
  if (!commandExists('claude')) {
    await runWithSpinner('Installing Claude Code', 'npm install -g @anthropic-ai/claude-code');
  }

  // Bun
  if (!commandExists('bun')) {
    await runWithSpinner('Installing Bun', 'curl -fsSL https://bun.sh/install | bash');
    runSafe('ln -sf ~/.bun/bin/bun /usr/local/bin/bun');
  }
}

async function installCloudflared(): Promise<void> {
  if (commandExists('cloudflared')) {
    console.log(chalk.dim(`  Already installed`));
    return;
  }
  await runWithSpinner('Installing cloudflared',
    'curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg && ' +
    'echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/cloudflared.list && ' +
    'apt-get update -qq && apt-get install -y -qq cloudflared'
  );
}

async function installGcloud(): Promise<void> {
  if (commandExists('gcloud')) {
    console.log(chalk.dim(`  Already installed`));
    return;
  }
  await runWithSpinner('Installing Google Cloud CLI',
    'curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg && ' +
    'echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee /etc/apt/sources.list.d/google-cloud-sdk.list && ' +
    'apt-get update -qq && apt-get install -y -qq google-cloud-cli'
  );
}

async function runSecurityHardening(): Promise<void> {
  const { addSecurity } = await import('./add-security.js');
  await addSecurity();
}

async function runTailscale(_options: SetupOptions): Promise<void> {
  const { addTailscale } = await import('./add-tailscale.js');
  await addTailscale();
}

async function configureOpenclaw(): Promise<void> {
  const oclawDir = getOpenclawDir();
  ensureDir(oclawDir);
  ensureDir(getWorkspaceDir());
  ensureDir(`${oclawDir}/agents/main`);

  // Generate gateway token if not exists
  let config = readOpenClawConfig();
  if (!config.gateway?.auth?.token || config.gateway.auth.token.includes('CHANGE_ME')) {
    const token = generateToken();
    config = {
      ...config,
      gateway: {
        ...config.gateway,
        port: 18789,
        auth: { token },
        bind: 'loopback',
      },
      agents: {
        ...config.agents,
        defaults: {
          ...config.agents?.defaults,
          workspace: getWorkspaceDir(),
          sandbox: true,
        },
      },
    };
    writeOpenClawConfig(config);
    console.log(chalk.green(`  ✓ Gateway token generated (${token.length} chars)`));
    console.log(chalk.green('  ✓ Gateway bound to loopback (127.0.0.1)'));
  }

  // Create CLI config dir
  writeCLIConfig({});
}

async function runOnboard(): Promise<void> {
  console.log(chalk.yellow('\n  OpenClaw onboarding wizard:'));
  console.log(chalk.dim('  Choose "local" for gateway setup'));
  runInteractive('openclaw onboard');
}

async function runCaddy(options: SetupOptions): Promise<void> {
  const { addCaddy } = await import('./add-caddy.js');
  await addCaddy({ domain: options.domain });
}

async function runEgress(_options: SetupOptions): Promise<void> {
  const { addEgress } = await import('./add-egress.js');
  await addEgress();
}

async function setupGatewayService(): Promise<void> {
  const template = readFileSync(join(TEMPLATES, 'gateway-service.template'), 'utf-8');
  const service = template.replace(/__HOME__/g, getHomedir());
  writeSystemdService('openclaw-gateway', service);
  run('systemctl enable openclaw-gateway');
  run('systemctl start openclaw-gateway');
}

async function setupHooksProxy(): Promise<void> {
  const oclawDir = getOpenclawDir();
  const proxyTemplate = readFileSync(join(TEMPLATES, 'hooks-proxy.mjs'), 'utf-8');
  const config = readOpenClawConfig();
  const token = config.gateway?.auth?.token || '';

  // Write proxy with empty routes initially
  const proxy = proxyTemplate.replace('__ROUTES__', '[]');
  writeFileSync(`${oclawDir}/hooks-proxy.mjs`, proxy);

  // Write env file with restricted permissions (fix: don't leak token in world-readable systemd unit)
  const envFile = '/etc/openclaw/hooks-proxy.env';
  run('mkdir -p /etc/openclaw');
  writeFileSync(envFile, `OPENCLAW_HOOK_TOKEN=${token}\nPORT=18800\n`, { mode: 0o600 });

  // Create systemd service
  const service = `[Unit]
Description=OpenClaw Hooks Proxy
After=network-online.target openclaw-gateway.service

[Service]
Type=simple
ExecStart=/usr/bin/node ${oclawDir}/hooks-proxy.mjs
Restart=always
RestartSec=5
EnvironmentFile=/etc/openclaw/hooks-proxy.env
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
`;
  writeSystemdService('openclaw-hooks-proxy', service);
  run('systemctl enable openclaw-hooks-proxy');
  run('systemctl start openclaw-hooks-proxy');
}

async function installMemoryDefense(): Promise<void> {
  const memoryDir = `${getOpenclawDir()}/agents/main`;
  ensureDir(memoryDir);
  const memoryPath = `${memoryDir}/MEMORY.md`;

  const defense = readFileSync(join(TEMPLATES, 'memory-defense.md'), 'utf-8');

  if (existsSync(memoryPath)) {
    const existing = readFileSync(memoryPath, 'utf-8');
    if (!existing.includes('Security Protocol')) {
      writeFileSync(memoryPath, existing + '\n\n' + defense);
    }
  } else {
    writeFileSync(memoryPath, defense);
  }
}

async function installAliases(): Promise<void> {
  const bashrc = `${getHomedir()}/.bashrc`;
  const aliases = `
# OpenClawPro aliases
alias oc='openclaw'
alias oc-status='openclawpro status'
alias oc-logs='journalctl -u openclaw-gateway -f'
alias oc-restart='systemctl restart openclaw-gateway'
alias oc-stop='systemctl stop openclaw-gateway'
alias oc-start='systemctl start openclaw-gateway'
alias oc-audit='openclawpro audit'
alias hooks-logs='journalctl -u openclaw-hooks-proxy -f'
export PATH="$PATH:$HOME/.bun/bin:$HOME/.local/bin"
`;

  if (existsSync(bashrc)) {
    const existing = readFileSync(bashrc, 'utf-8');
    if (!existing.includes('OpenClawPro aliases')) {
      writeFileSync(bashrc, existing + aliases);
    }
  } else {
    writeFileSync(bashrc, aliases);
  }
}

async function runInstallSkills(): Promise<void> {
  const { installSkills } = await import('./install-skills.js');
  await installSkills();
}

async function installBackupCron(): Promise<void> {
  const cronEntry = '30 3 * * * openclawpro backup > /dev/null 2>&1 # openclaw-backup';
  const existingCron = runSafe('crontab -l') || '';
  if (!existingCron.includes('openclaw-backup')) {
    const newCron = existingCron ? `${existingCron}\n${cronEntry}\n` : `${cronEntry}\n`;
    run(`echo '${newCron.replace(/'/g, "'\\''")}' | crontab -`);
  }
}
