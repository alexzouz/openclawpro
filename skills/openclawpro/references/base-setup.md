# Base Setup Reference

## System Requirements

- Ubuntu 22.04+ or Debian 12+
- Root access (sudo)
- Minimum 1 GB RAM, 10 GB disk
- Node.js 22 (installed automatically)

## What the Setup Installs

### System Packages

Installed via `apt-get`:
- `git`, `curl`, `wget`, `ca-certificates`, `gnupg`
- `jq` (JSON processing)
- `ufw` (firewall)
- `fail2ban` (brute-force protection)
- `unattended-upgrades` (auto security patches)
- `build-essential` (compilation tools)
- `ipset`, `dnsutils` (egress firewall support)
- `lsb-release`, `apt-transport-https`

### Node.js 22

Installed from NodeSource. The setup checks for existing v22 or v24 installations and skips if present.

### OpenClaw

Installed globally via `npm install -g openclaw`. The gateway runs as a systemd service bound to `127.0.0.1:18789`.

### Dev Tools

- **GitHub CLI** (`gh`) -- repository management and issue tracking
- **Claude Code** (`claude`) -- AI-assisted development
- **Bun** -- fast JavaScript runtime and package manager
- **cloudflared** -- Cloudflare tunnel client
- **Google Cloud CLI** (`gcloud`) -- for Gmail Pub/Sub setup

## Security Hardening Steps

### 1. UFW Firewall

Default deny incoming, allow outgoing. Ports opened:
- 22/tcp (SSH)
- 80/tcp (HTTP)
- 443/tcp (HTTPS)
- 41641/udp (Tailscale WireGuard, if enabled)

### 2. Fail2ban

- SSH jail: 3 retries, 24-hour ban
- Gateway jail: 5 retries, 1-hour ban
- Config: `/etc/fail2ban/jail.local` and `/etc/fail2ban/jail.d/openclaw-gateway.conf`

### 3. SSH Hardening

Applied via `/etc/ssh/sshd_config.d/hardening.conf`:
- Key-only authentication (passwords disabled)
- Root login restricted to key-based
- Max 3 auth tries, 30s login grace time
- X11 forwarding disabled
- Agent/TCP forwarding disabled
- Strong ciphers only (chacha20-poly1305, aes256-gcm, aes128-gcm)
- Strong MACs (hmac-sha2-512-etm, hmac-sha2-256-etm)
- Strong key exchange (curve25519-sha256)

SSH config is backed up before modification. If the config test fails (`sshd -t`), the previous config is restored automatically.

### 4. Kernel Hardening

Applied via `/etc/sysctl.d/99-openclaw-hardening.conf`:
- Full ASLR (`kernel.randomize_va_space = 2`)
- Hidden kernel pointers (`kernel.kptr_restrict = 2`)
- Restricted dmesg (`kernel.dmesg_restrict = 1`)
- Restricted ptrace (`kernel.yama.ptrace_scope = 2`)
- Disabled unprivileged BPF (`kernel.unprivileged_bpf_disabled = 1`)
- IP spoofing protection (reverse path filtering)
- SYN flood protection (SYN cookies)
- ICMP redirect disabled (MITM prevention)
- Source routing disabled
- Broadcast ping ignored
- Martian packet logging

### 5. Unattended Upgrades

Daily automatic security patch installation via `/etc/apt/apt.conf.d/20auto-upgrades`.

### 6. Avahi/mDNS Disabled

Stops and masks `avahi-daemon` to prevent network information leakage.

## OpenClaw Configuration

The gateway config is written to `~/.openclaw/openclaw.json`:
- Gateway token: auto-generated 72-character hex string
- Gateway bind: `loopback` (127.0.0.1 only)
- Sandbox: enabled
- Workspace: `~/.openclaw/workspace`

## Resumable Setup

Setup state is saved to `/tmp/openclawpro-setup-state.json`. If the setup is interrupted, running `openclawpro setup` again resumes from the last completed step. Each step is idempotent.

## Post-Setup Verification

Run `openclawpro audit` to verify all security layers are active. The audit checks 15 items and reports PASS, WARN, or FAIL for each.
