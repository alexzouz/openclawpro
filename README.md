# OpenClawPro

**The most secure one-command OpenClaw setup for VPS.**

Combines the best security practices from 8 open-source repos into a single CLI that installs, hardens, and manages an OpenClaw deployment with **18 security layers**.

## Quick Install

```bash
# On a fresh Ubuntu/Debian VPS, as root:
curl -fsSL https://raw.githubusercontent.com/alexzouz/openclawpro/main/setup.sh | bash
```

With options:
```bash
# Install with Tailscale VPN + Caddy reverse proxy + egress firewall
curl -fsSL https://raw.githubusercontent.com/alexzouz/openclawpro/main/setup.sh | bash -s -- --tailscale --caddy --egress
```

This installs Node.js 22, the OpenClawPro CLI, and launches the interactive setup wizard.

## What It Does

```
Fresh VPS ──→ openclawpro setup ──→ Production-ready OpenClaw
                                     ├── OpenClaw + Claude Code + GitHub CLI
                                     ├── UFW + Fail2ban + SSH hardening
                                     ├── Kernel hardening (ASLR, BPF, SYN cookies)
                                     ├── Caddy reverse proxy (auto-HTTPS)
                                     ├── Tailscale VPN (invisible server)
                                     ├── Egress firewall (API domains only)
                                     ├── Anti prompt injection defense
                                     ├── Encrypted daily backups
                                     └── Security audit with auto-fix
```

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
| [Melvynx/openclawpro](https://github.com/Melvynx/openclawpro) | CLI architecture, setup wizard, Gmail/Cloudflare/Webhook integration |
| [droxey/clincher](https://github.com/droxey/clincher) | 9-layer security model, kernel hardening, Smokescreen egress concept |
| [zuocharles/openclaw-aws-secure-deploy](https://github.com/zuocharles/openclaw-aws-secure-deploy) | 10 documented vulnerabilities, resumable setup, anti prompt injection, DM allowlist |
| [NinoSkopac/openclaw-secure-kit](https://github.com/NinoSkopac/openclaw-secure-kit) | Security audit (ocs doctor), DNS allowlisting, nftables, egress firewall |
| [Laso37/clawbot](https://github.com/Laso37/clawbot) | Strong SSH ciphers, kernel hardening sysctl, rate limiting |
| [tardigrde/openclaw-deploy](https://github.com/tardigrde/openclaw-deploy) | SOPS secrets, EnvironmentFile pattern, health monitoring, backup/restore |
| [RunClawd/runclawd](https://github.com/RunClawd/runclawd) | Auto-generated basic auth, Caddy routing, backup cron |
| [rankgnar/openclaw-secure-setup](https://github.com/rankgnar/openclaw-secure-setup) | SSH rollback safety, user verification before SSH changes |

## Standalone Bash Scripts

If Node.js breaks, these scripts work independently:

```bash
scripts/oc-audit.sh      # Security audit
scripts/oc-backup.sh     # Create backup (--encrypt for GPG)
scripts/oc-restore.sh    # Restore from backup
scripts/oc-update.sh     # Update all components
```

## Requirements

- **OS**: Ubuntu 22.04+ or Debian 12+
- **Access**: Root SSH access to a VPS
- **RAM**: 1 GB minimum, 2 GB recommended
- **Disk**: 10 GB minimum

## License

MIT
