# VPS Setup Guide

A step-by-step guide to setting up OpenClaw on a VPS from scratch.

## Step 1: Get a VPS

Provision a VPS from any provider (Hetzner, DigitalOcean, Vultr, Linode, AWS EC2, etc.) with:

- **OS:** Ubuntu 22.04+ or Debian 12+
- **RAM:** 1 GB minimum (2 GB recommended)
- **Disk:** 10 GB minimum (20 GB recommended)
- **CPU:** 1 vCPU minimum

During provisioning, add your SSH public key. If you do not have one:

```bash
# On your local machine
ssh-keygen -t ed25519 -C "your@email.com"
cat ~/.ssh/id_ed25519.pub
# Copy this public key into the VPS provider's SSH key field
```

## Step 2: SSH into Your Server

```bash
ssh root@YOUR_SERVER_IP
```

If this is your first connection, accept the host fingerprint.

## Step 3: Run the Bootstrap Script

```bash
curl -fsSL https://raw.githubusercontent.com/openclawpro/openclawpro/main/setup.sh | bash
```

This installs Node.js 22 and the OpenClawPro CLI, then launches the setup wizard.

Alternatively, install the CLI manually:

```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Install OpenClawPro CLI
npm install -g openclawpro

# Run setup
openclawpro setup
```

## Step 4: Follow the Setup Wizard

The wizard asks you about optional features:

1. **Tailscale VPN** -- Recommended. Makes your server invisible on the public internet. You will need a Tailscale account.
2. **Caddy reverse proxy** -- Recommended if you have a domain. Provides auto-HTTPS and basic auth in front of the gateway.
3. **Egress firewall** -- Optional. Restricts outbound connections to whitelisted API domains only. Useful for high-security deployments.

The wizard then runs through 18 steps:

1. System packages
2. Node.js 22
3. OpenClaw
4. Dev tools (gh, Claude Code, Bun)
5. Cloudflared
6. Google Cloud CLI
7. Security hardening (UFW, Fail2ban, SSH, kernel, auto-updates, Avahi)
8. Tailscale VPN (if selected)
9. OpenClaw configuration (token generation, loopback binding)
10. OpenClaw onboard (interactive -- choose "local" for gateway)
11. Caddy reverse proxy (if selected)
12. Egress firewall (if selected)
13. Gateway systemd service
14. Hooks proxy
15. Anti prompt injection
16. Shell aliases
17. Claude Code skills
18. Backup cron

If the setup is interrupted at any point, run `openclawpro setup` again to resume.

## Step 5: Verify Security

```bash
openclawpro audit
```

All checks should show PASS. Fix any FAIL items before continuing.

## Step 6: Configure Channels

Edit `~/.openclaw/openclaw.json` to enable your messaging channels:

### Telegram

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "dm": {
        "enabled": true,
        "policy": "allowlist",
        "allowFrom": ["YOUR_TELEGRAM_USER_ID"]
      }
    }
  }
}
```

Set the `TELEGRAM_BOT_TOKEN` environment variable or add it to the OpenClaw config.

### Discord

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "groupPolicy": "allowlist",
      "guilds": {
        "YOUR_GUILD_ID": {
          "allowFrom": ["YOUR_CHANNEL_ID"]
        }
      },
      "dm": {
        "enabled": true,
        "policy": "allowlist",
        "allowFrom": ["YOUR_DISCORD_USER_ID"]
      }
    }
  }
}
```

After editing, restart the gateway:

```bash
systemctl restart openclaw-gateway
```

## Step 7: Set Up Access (Choose One)

### Option A: Cloudflare Tunnel (Recommended)

```bash
cloudflared tunnel login
cloudflared tunnel create openclaw
```

Edit `~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: openclaw.yourdomain.com
    service: http://127.0.0.1:18789
  - hostname: hooks.yourdomain.com
    service: http://127.0.0.1:18800
  - service: http_status:404
```

```bash
cloudflared tunnel route dns openclaw openclaw.yourdomain.com
cloudflared tunnel route dns openclaw hooks.yourdomain.com
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
```

### Option B: Caddy (Already Set Up)

If you chose Caddy during setup, it is already running with auto-HTTPS. Check your credentials:

```bash
cat /root/.openclaw-vps/caddy-credentials
```

### Option C: Tailscale Only

If you chose Tailscale and restricted SSH to the tailnet, you can access the gateway directly from any device on your Tailscale network:

```bash
# From a device on your tailnet
curl http://TAILSCALE_IP:18789/health
```

## Step 8: Set Up Gmail (Optional)

See [GMAIL-SETUP.md](GMAIL-SETUP.md) for complete instructions on setting up Gmail notifications via Google Pub/Sub.

## Step 9: Verify Everything

```bash
# Check all services are running
openclawpro status

# Run full security audit
openclawpro audit

# Check gateway is responding (from the server)
curl -s http://127.0.0.1:18789/health
```

## Maintenance

```bash
# Update all components
openclawpro update

# Manual backup
openclawpro backup

# Encrypted backup
openclawpro backup --encrypt

# View gateway logs
oc-logs

# Restart gateway
oc-restart
```

## Next Steps

- Set up webhooks for GitHub repos: `openclawpro add webhook`
- Configure additional Gmail accounts: `openclawpro add gmail`
- Review the egress allowlist if agents need to call additional APIs: `/etc/openclaw/egress-allowlist.conf`
- Set up monitoring alerts on your VPS provider's dashboard
