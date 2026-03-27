import chalk from 'chalk';
import { input, select } from '@inquirer/prompts';
import { isRoot, restartService, getServiceStatus } from '../utils/system.js';
import { readProxyRoutes, writeProxyRoutes, addHookMapping, readCLIConfig } from '../utils/config.js';
import { generateToken } from '../utils/security.js';
import type { ProxyRoute } from '../types.js';

interface WebhookTemplate {
  name: string;
  path: string;
  defaultTarget: string;
  secretHeader: string;
  secretField: string;
}

const TEMPLATES: Record<string, WebhookTemplate> = {
  codeline: {
    name: 'Codeline',
    path: '/hooks/codeline',
    defaultTarget: 'http://localhost:3000/api/hooks/codeline',
    secretHeader: 'x-codeline-signature',
    secretField: 'CODELINE_WEBHOOK_SECRET',
  },
  stripe: {
    name: 'Stripe',
    path: '/hooks/stripe',
    defaultTarget: 'http://localhost:3000/api/hooks/stripe',
    secretHeader: 'stripe-signature',
    secretField: 'STRIPE_WEBHOOK_SECRET',
  },
  github: {
    name: 'GitHub',
    path: '/hooks/github',
    defaultTarget: 'http://localhost:3000/api/hooks/github',
    secretHeader: 'x-hub-signature-256',
    secretField: 'GITHUB_WEBHOOK_SECRET',
  },
  custom: {
    name: 'Custom',
    path: '',
    defaultTarget: '',
    secretHeader: '',
    secretField: '',
  },
};

export async function addWebhook(_options?: unknown): Promise<void> {
  console.log(chalk.bold('\n🪝 Add Webhook Route\n'));

  if (!isRoot()) {
    console.log(chalk.red('This command must be run as root'));
    process.exit(1);
  }

  const cliConfig = readCLIConfig();
  if (!cliConfig.hooksDomain) {
    console.log(chalk.yellow('  ⚠ No hooks domain configured'));
    console.log(chalk.yellow('  Run `openclawpro add cloudflare` first for external webhooks'));
  }

  // Step 1: Choose template
  const templateKey = await select({
    message: 'Webhook template:',
    choices: [
      { name: 'Codeline', value: 'codeline' },
      { name: 'Stripe', value: 'stripe' },
      { name: 'GitHub', value: 'github' },
      { name: 'Custom', value: 'custom' },
    ],
  });

  const template = TEMPLATES[templateKey];

  // Step 2: Gather webhook details
  const webhookName = templateKey !== 'custom'
    ? template.name.toLowerCase()
    : await input({
        message: 'Webhook name (lowercase, no spaces):',
        validate: (val: string) => {
          if (!val.trim()) return 'Name is required';
          if (/[^a-z0-9-]/.test(val.trim())) return 'Use lowercase letters, numbers, and hyphens only';
          return true;
        },
      });

  const webhookPath = templateKey !== 'custom'
    ? template.path
    : await input({
        message: 'Webhook path (e.g., /hooks/my-service):',
        default: `/hooks/${webhookName}`,
        validate: (val: string) => {
          if (!val.startsWith('/')) return 'Path must start with /';
          return true;
        },
      });

  const targetUrl = templateKey !== 'custom'
    ? template.defaultTarget
    : await input({
        message: 'Target URL (where to forward the webhook):',
        default: `http://localhost:3000/api/hooks/${webhookName}`,
        validate: (val: string) => {
          if (!val.startsWith('http')) return 'Must be a valid URL starting with http:// or https://';
          return true;
        },
      });

  const secretHeader = templateKey !== 'custom'
    ? template.secretHeader
    : await input({
        message: 'Secret verification header (leave empty for none):',
        default: '',
      });

  const secretField = templateKey !== 'custom'
    ? template.secretField
    : await input({
        message: 'Secret env variable name (leave empty for none):',
        default: '',
      });

  // Step 3: Generate secret
  const secret = (secretHeader || secretField) ? generateToken(32) : undefined;

  // Step 4: Add proxy route
  const existingRoutes = readProxyRoutes();
  const routeExists = existingRoutes.some((r) => r.path === webhookPath);

  if (routeExists) {
    console.log(chalk.yellow(`\n  ⚠ Route for path ${webhookPath} already exists, updating...`));
    const updatedRoutes = existingRoutes.map((r) =>
      r.path === webhookPath
        ? { ...r, name: webhookName, target: targetUrl, secretHeader: secretHeader || undefined, secretField: secretField || undefined }
        : r
    );
    writeProxyRoutes(updatedRoutes);
  } else {
    const newRoute: ProxyRoute = {
      name: webhookName,
      path: webhookPath,
      target: targetUrl,
      ...(secretHeader ? { secretHeader } : {}),
      ...(secretField ? { secretField } : {}),
    };
    writeProxyRoutes([...existingRoutes, newRoute]);
  }
  console.log(chalk.green(`  ✓ Proxy route added: ${webhookPath} → ${targetUrl}`));

  // Step 5: Add hook mapping to openclaw.json
  addHookMapping(webhookName, {
    type: 'webhook',
    channel: webhookName,
    path: webhookPath,
    ...(secret ? { secret } : {}),
  });
  console.log(chalk.green('  ✓ Hook mapping added to openclaw.json'));

  // Step 6: Restart hooks-proxy service
  const proxyStatus = getServiceStatus('hooks-proxy');
  if (proxyStatus === 'active') {
    try {
      restartService('hooks-proxy');
      console.log(chalk.green('  ✓ hooks-proxy service restarted'));
    } catch {
      console.log(chalk.yellow('  ⚠ Could not restart hooks-proxy'));
      console.log(chalk.yellow('  Run: systemctl restart hooks-proxy'));
    }
  } else {
    console.log(chalk.yellow('  ⚠ hooks-proxy service is not active'));
    console.log(chalk.yellow('  Start it with: systemctl start hooks-proxy'));
  }

  // Step 7: Display summary
  console.log(chalk.bold.green(`\n✅ Webhook "${webhookName}" configured\n`));
  console.log(chalk.bold('  Route:'));
  console.log(chalk.white(`    Path:   ${webhookPath}`));
  console.log(chalk.white(`    Target: ${targetUrl}`));
  if (cliConfig.hooksDomain) {
    console.log(chalk.white(`    URL:    https://${cliConfig.hooksDomain}${webhookPath}`));
  }
  if (secret) {
    console.log(chalk.bold('\n  Secret:'));
    console.log(chalk.white(`    Header: ${secretHeader}`));
    console.log(chalk.white(`    Value:  ${secret}`));
    if (secretField) {
      console.log(chalk.dim(`\n  Add to your .env: ${secretField}=${secret}`));
    }
    console.log(chalk.yellow('\n  ⚠ Save this secret — it won\'t be shown again'));
  }
}
