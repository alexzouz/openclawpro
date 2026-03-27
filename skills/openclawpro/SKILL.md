# OpenClawPro VPS Management

Use this skill when managing an OpenClaw deployment on a VPS. It covers setup, security hardening, backup, monitoring, and troubleshooting.

## Commands

### Initial Setup

```bash
# One-line bootstrap (installs Node.js 22 + CLI)
curl -fsSL https://raw.githubusercontent.com/openclawpro/openclawpro/main/setup.sh | sudo bash

# Or install CLI directly
npm install -g openclawpro

# Run full setup wizard
sudo openclawpro setup

# Non-interactive setup with options
sudo openclawpro setup --tailscale --caddy --egress --no-interactive
```

### Add Features

```bash
# Security hardening (UFW, Fail2ban, SSH, kernel, auto-updates)
sudo openclawpro add security

# Tailscale VPN (makes server invisible on public internet)
sudo openclawpro add tailscale

# Caddy reverse proxy with auto-HTTPS and basic auth
sudo openclawpro add caddy --domain example.com

# Cloudflare tunnel (zero-trust access)
sudo openclawpro add cloudflare

# Egress firewall (whitelist API domains only)
sudo openclawpro add egress

# Gmail notifications
sudo openclawpro add gmail

# Custom webhook
sudo openclawpro add webhook
```

### Operations

```bash
# Status dashboard (services, ports, config, system)
openclawpro status

# Security audit (PASS/WARN/FAIL for each layer)
openclawpro audit
openclawpro audit --json
openclawpro audit --fix

# Backup config and data
openclawpro backup
openclawpro backup --encrypt
openclawpro backup --install-cron

# Restore from backup
openclawpro restore
openclawpro restore backup-file.tar.gz
openclawpro restore --dry-run

# Update all components
openclawpro update

# Install Claude Code skills
openclawpro install-skills
```

### Shell Aliases

After setup, these aliases are available:

```bash
oc-status    # Status dashboard
oc-logs      # Gateway logs (journalctl)
oc-restart   # Restart gateway
oc-stop      # Stop gateway
oc-start     # Start gateway
oc-audit     # Security audit
hooks-logs   # Hooks proxy logs
```

## Security Layers

The setup applies 18 security layers. Run `openclawpro audit` to verify all are active. Key layers:

1. Gateway bound to loopback (127.0.0.1)
2. UFW firewall (deny incoming by default)
3. Fail2ban (SSH: 3 retries/24h ban, Gateway: 5 retries/1h ban)
4. SSH hardening (key-only, strong ciphers)
5. Kernel hardening (ASLR, BPF, ptrace, SYN cookies)
6. Unattended security upgrades
7. DM allowlist on channels
8. Anti prompt injection in MEMORY.md
9. Reverse proxy (Caddy or Cloudflare Tunnel)
10. Egress firewall (whitelist API domains only)
11. Tailscale VPN (optional, makes server invisible)

## Service Management

```bash
# Gateway
systemctl status openclaw-gateway
systemctl restart openclaw-gateway
journalctl -u openclaw-gateway -f

# Hooks proxy
systemctl status openclaw-hooks-proxy
systemctl restart openclaw-hooks-proxy
journalctl -u openclaw-hooks-proxy -f

# Cloudflare tunnel
systemctl status cloudflared
journalctl -u cloudflared -f

# Caddy
systemctl status caddy
journalctl -u caddy -f
```

## Configuration Files

| File | Purpose |
|------|---------|
| `~/.openclaw/openclaw.json` | Main OpenClaw config (gateway, agents, channels) |
| `~/.openclaw-vps/config.json` | CLI config (hooks domain, Cloudflare settings) |
| `/etc/openclaw/egress-allowlist.conf` | Egress firewall domain whitelist |
| `/etc/openclaw/hooks-proxy.env` | Hooks proxy environment (token, port) |
| `/etc/caddy/Caddyfile` | Caddy reverse proxy config |
| `~/.openclaw/agents/main/MEMORY.md` | Agent memory with security protocol |

## Troubleshooting

- If gateway won't start: check `journalctl -u openclaw-gateway -e` and verify the token in `openclaw.json`
- If SSH is locked out: use VPS console to restore from `/etc/ssh/sshd_config.bak.*`
- If egress blocks needed domains: edit `/etc/openclaw/egress-allowlist.conf` then run `/etc/openclaw/refresh-egress.sh`
- If Cloudflare tunnel drops: run `cloudflared tunnel login` again
- Run `openclawpro audit --fix` to auto-fix simple permission issues
