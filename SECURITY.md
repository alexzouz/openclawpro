# Security Layers

OpenClawPro applies 18 security layers during setup. Run `openclawpro audit` to verify their status.

## Layer 1: Gateway Loopback Binding

**What it does:** Binds the OpenClaw gateway to `127.0.0.1` so it only accepts local connections. External access must go through a reverse proxy (Caddy or Cloudflare Tunnel).

**Config:** `gateway.bind: "loopback"` in `~/.openclaw/openclaw.json`

**Inspired by:** openclaw-deploy

## Layer 2: UFW Firewall

**What it does:** Enables the Uncomplicated Firewall with a default-deny-incoming policy. Only SSH (22), HTTP (80), and HTTPS (443) are allowed inbound.

**Config:** `ufw status`

**Inspired by:** clincher, clawbot

## Layer 3: Fail2ban (SSH Jail)

**What it does:** Monitors SSH login attempts and bans IPs after 3 failed attempts for 24 hours.

**Config:** `/etc/fail2ban/jail.local`

**Inspired by:** clawbot

## Layer 4: Fail2ban (Gateway Jail)

**What it does:** Monitors the OpenClaw gateway for failed authentication attempts and bans IPs after 5 failures for 1 hour.

**Config:** `/etc/fail2ban/jail.d/openclaw-gateway.conf`

**Inspired by:** clawbot

## Layer 5: SSH Key-Only Authentication

**What it does:** Disables password authentication for SSH. Only public key authentication is accepted.

**Config:** `/etc/ssh/sshd_config.d/hardening.conf`

**Inspired by:** zuocharles, secure-setup

## Layer 6: SSH Strong Ciphers

**What it does:** Restricts SSH to modern, strong cryptographic algorithms:
- Ciphers: chacha20-poly1305, aes256-gcm, aes128-gcm
- MACs: hmac-sha2-512-etm, hmac-sha2-256-etm
- Key exchange: curve25519-sha256

**Config:** `/etc/ssh/sshd_config.d/hardening.conf`

**Inspired by:** zuocharles, secure-setup

## Layer 7: SSH Config Rollback Safety

**What it does:** Before modifying SSH config, creates a timestamped backup. If `sshd -t` config test fails, the original config is restored automatically. Prevents SSH lockouts.

**Inspired by:** secure-setup

## Layer 8: Kernel ASLR

**What it does:** Enables full Address Space Layout Randomization (`kernel.randomize_va_space = 2`), making memory-based exploits harder.

**Config:** `/etc/sysctl.d/99-openclaw-hardening.conf`

**Inspired by:** clincher

## Layer 9: Kernel Ptrace and BPF Restrictions

**What it does:** Restricts `ptrace` to root only (`kernel.yama.ptrace_scope = 2`) and disables unprivileged BPF (`kernel.unprivileged_bpf_disabled = 1`). Prevents container escape attacks.

**Config:** `/etc/sysctl.d/99-openclaw-hardening.conf`

**Inspired by:** clincher, clawbot

## Layer 10: Network Hardening

**What it does:** Applies kernel-level network protections:
- SYN flood protection (SYN cookies)
- IP spoofing protection (reverse path filtering)
- ICMP redirect disabled (MITM prevention)
- Source routing disabled
- Broadcast ping ignored
- Martian packet logging

**Config:** `/etc/sysctl.d/99-openclaw-hardening.conf`

**Inspired by:** clincher

## Layer 11: Unattended Security Upgrades

**What it does:** Automatically installs security patches daily without manual intervention.

**Config:** `/etc/apt/apt.conf.d/20auto-upgrades`

**Inspired by:** zuocharles

## Layer 12: Avahi/mDNS Disabled

**What it does:** Stops and masks the Avahi daemon to prevent leaking network topology information via mDNS.

**Inspired by:** zuocharles

## Layer 13: Gateway Token Authentication

**What it does:** Generates a 72-character hex token for gateway authentication. The token is stored with restricted file permissions and not exposed in systemd unit files.

**Config:** `~/.openclaw/openclaw.json` and `/etc/openclaw/hooks-proxy.env` (mode 0600)

**Inspired by:** openclaw-deploy

## Layer 14: DM Allowlist

**What it does:** Restricts which users can message the bot via direct messages. Uses an allowlist policy so only specified user IDs can interact.

**Config:** `channels.*.dm.policy: "allowlist"` in `~/.openclaw/openclaw.json`

**Inspired by:** Melvynx

## Layer 15: Anti Prompt Injection

**What it does:** Installs a security protocol in the agent's `MEMORY.md` that instructs the agent to scan for malicious patterns, review dependencies, detect prompt injection attempts, and stop execution if suspicious code is found.

**Config:** `~/.openclaw/agents/main/MEMORY.md`

**Inspired by:** RunClawd

## Layer 16: Egress Firewall

**What it does:** Creates an iptables chain that blocks all outbound connections except to whitelisted API domains (Anthropic, OpenAI, Google, GitHub, etc.). Uses ipset with DNS re-resolution every 15 minutes to handle CDN IP changes.

**Config:** `/etc/openclaw/egress-allowlist.conf`

**Inspired by:** secure-kit

## Layer 17: Tailscale VPN (Optional)

**What it does:** Installs Tailscale to create a private WireGuard network. Optionally restricts SSH to the Tailscale network only, making the server completely invisible on the public internet.

**Inspired by:** zuocharles

## Layer 18: Encrypted Backups

**What it does:** Creates daily backups of OpenClaw configuration, workspace, and agent data. Supports GPG AES-256 encryption. Old backups are automatically pruned after 7 days.

**Config:** Cron job at 3:30 AM daily

**Inspired by:** openclaw-deploy

## Auditing

Run the security audit to check all layers:

```bash
# Interactive output with PASS/WARN/FAIL
openclawpro audit

# Machine-readable JSON
openclawpro audit --json

# Auto-fix simple issues (permissions, etc.)
openclawpro audit --fix
```
