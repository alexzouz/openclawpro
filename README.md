# OpenClawPro

One-command secure OpenClaw setup for VPS. Installs, hardens, and manages an OpenClaw deployment with 18 security layers.

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/openclawpro/openclawpro/main/setup.sh | sudo bash
```

This installs Node.js 22, the OpenClawPro CLI, and launches the interactive setup wizard.

## Features

- **18 security layers** applied automatically (firewall, SSH hardening, kernel hardening, egress filtering, and more)
- **Resumable setup** -- interrupted installs pick up where they left off
- **Interactive wizard** with non-interactive mode for automation
- **Security audit** command with PASS/WARN/FAIL checks and auto-fix
- **Encrypted backups** with 7-day retention and daily cron
- **Cloudflare Tunnel** support for zero-trust access
- **Tailscale VPN** for making the server invisible on the public internet
- **Caddy reverse proxy** with auto-HTTPS and basic auth
- **Egress firewall** -- whitelist only the API domains your agents need
- **Anti prompt injection** defense in agent memory
- **Gmail notifications** via Google Pub/Sub
- **Hooks proxy** for receiving webhooks (GitHub, Gmail, custom)
- **Status dashboard** showing services, ports, config, and system metrics
- **Claude Code skills** installed for VPS management

## Quick Start

1. Get a VPS (Ubuntu 22.04+ or Debian 12+) and SSH in as root
2. Run the install command above
3. Follow the setup wizard to choose your options
4. Run `openclawpro audit` to verify your security posture
5. Configure channels in `~/.openclaw/openclaw.json`

## Command Reference

| Command | Description |
|---------|-------------|
| `openclawpro setup` | Full VPS setup wizard |
| `openclawpro add security` | Harden server security (UFW, Fail2ban, SSH, kernel) |
| `openclawpro add tailscale` | Install and configure Tailscale VPN |
| `openclawpro add caddy` | Install Caddy reverse proxy with auto-HTTPS |
| `openclawpro add cloudflare` | Setup Cloudflare tunnel |
| `openclawpro add egress` | Enable egress firewall (whitelist API domains) |
| `openclawpro add gmail` | Setup Gmail notifications |
| `openclawpro add webhook` | Add custom webhook |
| `openclawpro audit` | Run security audit (PASS/WARN/FAIL) |
| `openclawpro audit --json` | Output audit results as JSON |
| `openclawpro audit --fix` | Auto-fix simple issues |
| `openclawpro backup` | Backup OpenClaw config and data |
| `openclawpro backup --encrypt` | Create encrypted backup (GPG AES-256) |
| `openclawpro restore [file]` | Restore from backup |
| `openclawpro update` | Update all components |
| `openclawpro install-skills` | Install Claude Code skills |
| `openclawpro status` | Show status dashboard |

### Shell Aliases

After setup, these shortcuts are available:

| Alias | Command |
|-------|---------|
| `oc-status` | `openclawpro status` |
| `oc-logs` | `journalctl -u openclaw-gateway -f` |
| `oc-restart` | `systemctl restart openclaw-gateway` |
| `oc-stop` | `systemctl stop openclaw-gateway` |
| `oc-start` | `systemctl start openclaw-gateway` |
| `oc-audit` | `openclawpro audit` |
| `hooks-logs` | `journalctl -u openclaw-hooks-proxy -f` |

## Security Features

OpenClawPro applies 18 security layers during setup. See [SECURITY.md](SECURITY.md) for full details.

**Network:**
- UFW firewall (deny incoming by default)
- Egress firewall (whitelist API domains only)
- Tailscale VPN (optional, invisible on public internet)
- Cloudflare Tunnel (zero-trust access)

**Authentication:**
- SSH key-only with strong ciphers
- Gateway token authentication (72-char hex)
- Caddy basic auth
- DM allowlist on channels

**System:**
- Kernel hardening (ASLR, BPF, ptrace, SYN cookies)
- Fail2ban (SSH and gateway jails)
- Unattended security upgrades
- Avahi/mDNS disabled

**Application:**
- Gateway bound to loopback (127.0.0.1)
- Sandbox mode enabled
- Anti prompt injection in MEMORY.md
- Hooks proxy env file restricted (chmod 600)
- Directory permissions audited (chmod 700)
- Backup encryption (GPG AES-256)

## Credits

OpenClawPro combines best practices from these projects:

| Repository | Contribution |
|-----------|--------------|
| [Melvynx](https://github.com/Melvynx) | CLI architecture and setup wizard patterns |
| [clincher](https://github.com/droxey/clincher) | Kernel hardening (sysctl configuration) |
| [zuocharles](https://github.com/zuocharles) | SSH rollback safety, resumable setup, Avahi/mDNS hardening |
| [secure-kit](https://github.com/secure-kit) | Egress firewall and ipset-based domain whitelisting |
| [clawbot](https://github.com/Laso37/clawbot) | Fail2ban gateway jail, kernel hardening additions |
| [openclaw-deploy](https://github.com/openclaw-deploy) | Systemd service templates, hooks proxy architecture |
| [RunClawd](https://github.com/RunClawd) | Anti prompt injection memory defense |
| [secure-setup](https://github.com/secure-setup) | SSH config test-before-apply with automatic rollback |

## License

MIT
