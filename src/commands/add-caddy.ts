import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { run, runSafe, runWithSpinner, commandExists } from '../utils/exec.js';
import { isRoot } from '../utils/system.js';
import { generateBasicAuthPassword } from '../utils/security.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES = join(__dirname, '..', '..', 'templates');

export async function addCaddy(options?: { domain?: string }): Promise<void> {
  console.log(chalk.bold('\n🌐 Caddy Reverse Proxy Setup\n'));

  if (!isRoot()) {
    console.log(chalk.red('This command must be run as root'));
    process.exit(1);
  }

  // Step 1: Install Caddy
  if (!commandExists('caddy')) {
    console.log(chalk.cyan('→ Installing Caddy...'));
    await runWithSpinner('Adding Caddy repository',
      'apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl && ' +
      'curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && ' +
      'curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" | tee /etc/apt/sources.list.d/caddy-stable.list'
    );
    await runWithSpinner('Installing Caddy', 'apt-get update && apt-get install -y caddy');
    console.log(chalk.green('  ✓ Caddy installed'));
  } else {
    console.log(chalk.green('  ✓ Caddy already installed'));
  }

  // Step 2: Get domain
  const domain = options?.domain || await input({
    message: 'Domain name (or leave empty for localhost):',
    default: 'localhost',
  });

  // Step 3: Generate basic auth credentials
  console.log(chalk.cyan('\n→ Generating Basic Auth credentials...'));
  const password = generateBasicAuthPassword();
  const hashedPassword = run(`printf '%s' "${password.replace(/"/g, '\\"')}" | caddy hash-password --stdin`);

  // Step 4: Write Caddyfile
  let caddyfile = readFileSync(join(TEMPLATES, 'Caddyfile'), 'utf-8');
  caddyfile = caddyfile.replace('{$DOMAIN:localhost}', domain);
  caddyfile = caddyfile.replace('{$BASIC_AUTH_USER:admin}', 'admin');
  caddyfile = caddyfile.replace('{$BASIC_AUTH_HASH}', hashedPassword);

  writeFileSync('/etc/caddy/Caddyfile', caddyfile);
  console.log(chalk.green('  ✓ Caddyfile written'));

  // Step 5: Save credentials
  const credFile = '/root/.openclaw-vps/caddy-credentials';
  writeFileSync(credFile, `Username: admin\nPassword: ${password}\n`, { mode: 0o600 });
  console.log(chalk.green(`  ✓ Credentials saved to ${credFile} (chmod 600)`));

  // Step 6: Enable and start
  run('systemctl enable caddy');
  run('systemctl restart caddy');
  console.log(chalk.green('  ✓ Caddy started'));

  // Step 7: Display credentials
  console.log(chalk.bold.green('\n✅ Caddy reverse proxy configured\n'));
  console.log(chalk.bold('  Credentials:'));
  console.log(chalk.white(`    Username: admin`));
  console.log(chalk.white(`    Password: ${password}`));
  console.log(chalk.yellow('\n  ⚠ Save these credentials — they won\'t be shown again'));
  if (domain !== 'localhost') {
    console.log(chalk.dim(`\n  Access: https://${domain}`));
  }
}
