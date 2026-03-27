import chalk from 'chalk';
import { confirm, input } from '@inquirer/prompts';
import { run, runSafe, runWithSpinner, commandExists, runInteractive } from '../utils/exec.js';
import { isRoot } from '../utils/system.js';
import { backupSSHConfig, rollbackSSHConfig, testSSHConfig } from '../utils/security.js';

export async function addTailscale(): Promise<void> {
  console.log(chalk.bold('\n🔗 Tailscale VPN Setup\n'));

  if (!isRoot()) {
    console.log(chalk.red('This command must be run as root'));
    process.exit(1);
  }

  // Step 1: Install Tailscale
  if (!commandExists('tailscale')) {
    console.log(chalk.cyan('→ Installing Tailscale...'));
    await runWithSpinner('Installing Tailscale', 'curl -fsSL https://tailscale.com/install.sh | sh');
    console.log(chalk.green('  ✓ Tailscale installed'));
  } else {
    console.log(chalk.green('  ✓ Tailscale already installed'));
  }

  // Step 2: Activate with SSH
  console.log(chalk.cyan('\n→ Activating Tailscale with SSH...'));
  console.log(chalk.yellow('  A browser link will appear — authenticate there'));
  console.log(chalk.yellow('  If running headless, copy the URL to your local browser\n'));
  runInteractive('tailscale up --ssh');

  // Step 3: Get Tailscale IP
  const tailscaleIp = runSafe('tailscale ip -4');
  if (!tailscaleIp) {
    console.log(chalk.red('  ✗ Could not get Tailscale IP'));
    console.log(chalk.yellow('  Run `tailscale status` to check'));
    return;
  }
  console.log(chalk.green(`  ✓ Tailscale IP: ${chalk.bold(tailscaleIp)}`));
  console.log(chalk.yellow(`  ⚠ Write this down: ${tailscaleIp}`));

  // Step 4: Enable on boot
  run('systemctl enable tailscaled');
  console.log(chalk.green('  ✓ Tailscale enabled on boot'));

  // Step 5: Open UFW for WireGuard
  if (commandExists('ufw')) {
    runSafe('ufw allow 41641/udp comment "Tailscale WireGuard"');
    console.log(chalk.green('  ✓ UFW: UDP 41641 allowed for WireGuard'));
  }

  // Step 6: Optionally restrict SSH to Tailscale only
  console.log('');
  const restrictSSH = await confirm({
    message: 'Restrict SSH to Tailscale network only? (makes server invisible on public internet)',
    default: false,
  });

  if (restrictSSH) {
    console.log(chalk.yellow('\n  ⚠ IMPORTANT: Keep this terminal open!'));
    console.log(chalk.yellow('  Test SSH via Tailscale in a NEW terminal before closing this one'));
    console.log(chalk.dim(`  ssh root@${tailscaleIp}\n`));

    // Backup SSH config (rollback safety from secure-setup)
    backupSSHConfig();

    // Restrict UFW SSH to Tailscale CGNAT range
    runSafe('ufw delete allow 22/tcp');
    run(`ufw allow from 100.64.0.0/10 to any port 22 comment "SSH via Tailscale only"`);
    console.log(chalk.green('  ✓ SSH restricted to Tailscale network (100.64.0.0/10)'));

    // Verify SSH works
    const sshWorks = await confirm({
      message: 'Have you verified SSH works via Tailscale in a NEW terminal?',
      default: false,
    });

    if (!sshWorks) {
      console.log(chalk.red('\n  Rolling back SSH restriction...'));
      runSafe('ufw delete allow from 100.64.0.0/10 to any port 22');
      run('ufw allow 22/tcp comment "SSH"');
      console.log(chalk.yellow('  ⚠ SSH restriction rolled back — public SSH re-enabled'));
    }
  }

  console.log(chalk.bold.green('\n✅ Tailscale VPN configured'));
  console.log(chalk.dim(`\nConnect from any device on your tailnet:`));
  console.log(chalk.dim(`  ssh root@${tailscaleIp}`));
}
