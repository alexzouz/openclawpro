import chalk from 'chalk';
import { runSafe, runWithSpinner, commandExists } from '../utils/exec.js';
import { getServiceStatus, restartService } from '../utils/system.js';

export async function update(): Promise<void> {
  console.log(chalk.bold('\n🔄 Update Components\n'));

  const updates: { name: string; before: string | null; after: string | null }[] = [];

  // System packages
  console.log(chalk.cyan('→ System packages...'));
  await runWithSpinner('Updating package list', 'apt-get update -qq');
  await runWithSpinner('Upgrading packages', 'DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq');
  console.log(chalk.green('  ✓ System packages updated'));

  // OpenClaw
  console.log(chalk.cyan('\n→ OpenClaw...'));
  const ocBefore = runSafe('openclaw --version');
  await runWithSpinner('Updating OpenClaw', 'npm update -g openclaw');
  const ocAfter = runSafe('openclaw --version');
  updates.push({ name: 'OpenClaw', before: ocBefore, after: ocAfter });

  // Claude Code
  if (commandExists('claude')) {
    console.log(chalk.cyan('\n→ Claude Code...'));
    const ccBefore = runSafe('claude --version');
    await runWithSpinner('Updating Claude Code', 'npm update -g @anthropic-ai/claude-code');
    const ccAfter = runSafe('claude --version');
    updates.push({ name: 'Claude Code', before: ccBefore, after: ccAfter });
  }

  // GitHub CLI
  if (commandExists('gh')) {
    console.log(chalk.cyan('\n→ GitHub CLI...'));
    const ghBefore = runSafe('gh --version | head -1');
    await runWithSpinner('Updating gh', 'apt-get install -y -qq gh 2>/dev/null || true');
    const ghAfter = runSafe('gh --version | head -1');
    updates.push({ name: 'GitHub CLI', before: ghBefore, after: ghAfter });
  }

  // Cloudflared
  if (commandExists('cloudflared')) {
    console.log(chalk.cyan('\n→ Cloudflared...'));
    const cfBefore = runSafe('cloudflared --version');
    await runWithSpinner('Updating cloudflared', 'apt-get install -y -qq cloudflared 2>/dev/null || true');
    const cfAfter = runSafe('cloudflared --version');
    updates.push({ name: 'Cloudflared', before: cfBefore, after: cfAfter });
  }

  // Caddy
  if (commandExists('caddy')) {
    console.log(chalk.cyan('\n→ Caddy...'));
    const caddyBefore = runSafe('caddy version');
    await runWithSpinner('Updating Caddy', 'apt-get install -y -qq caddy 2>/dev/null || true');
    const caddyAfter = runSafe('caddy version');
    updates.push({ name: 'Caddy', before: caddyBefore, after: caddyAfter });
  }

  // Restart services if needed
  console.log(chalk.cyan('\n→ Restarting services...'));
  const services = ['openclaw-gateway', 'openclaw-hooks-proxy', 'caddy', 'cloudflared'];
  for (const svc of services) {
    if (getServiceStatus(svc) === 'active') {
      restartService(svc);
      console.log(chalk.green(`  ✓ Restarted ${svc}`));
    }
  }

  // Summary
  console.log(chalk.bold('\n📋 Update Summary:\n'));
  for (const u of updates) {
    const changed = u.before !== u.after;
    const icon = changed ? chalk.green('↑') : chalk.dim('=');
    console.log(`  ${icon} ${u.name}: ${u.before || 'N/A'} → ${u.after || 'N/A'}`);
  }

  console.log(chalk.bold.green('\n✅ All components updated'));
}
