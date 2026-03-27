# Troubleshooting

Common issues and fixes for OpenClawPro deployments.

## Cannot SSH into the Server

### Symptoms
- `ssh: connect to host ... port 22: Connection refused`
- `Permission denied (publickey)`

### Fixes

**Connection refused:**
1. Check if SSH is running via VPS provider console: `systemctl status ssh`
2. Check UFW allows SSH: `ufw status | grep 22`
3. If you restricted SSH to Tailscale, you must connect via Tailscale IP: `ssh root@<tailscale-ip>`
4. If the VPS has a firewall in the provider's dashboard, ensure port 22 is open there too

**Permission denied:**
1. SSH key auth is enforced -- password login is disabled
2. Verify your key is in `~/.ssh/authorized_keys` on the server
3. Check file permissions: `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`
4. If locked out, use VPS provider console access to fix

**SSH config broken:**
1. Access via VPS console
2. Find the backup: `ls /etc/ssh/sshd_config.bak.*`
3. Restore: `cp /etc/ssh/sshd_config.bak.TIMESTAMP /etc/ssh/sshd_config`
4. Remove hardening: `rm /etc/ssh/sshd_config.d/hardening.conf`
5. Restart: `systemctl restart ssh`

## Gateway Won't Start

### Symptoms
- `systemctl status openclaw-gateway` shows `failed`
- Port 18789 not listening

### Fixes

1. **Check logs:**
   ```bash
   journalctl -u openclaw-gateway -e
   ```

2. **Token not set:**
   ```bash
   cat ~/.openclaw/openclaw.json | jq .gateway.auth.token
   ```
   If null or "CHANGE_ME", generate a new token:
   ```bash
   TOKEN=$(openssl rand -hex 36)
   # Edit ~/.openclaw/openclaw.json and set gateway.auth.token to $TOKEN
   systemctl restart openclaw-gateway
   ```

3. **Port already in use:**
   ```bash
   ss -tlnp | grep 18789
   ```
   Kill the conflicting process or change the gateway port.

4. **Node.js not found:**
   ```bash
   which node
   node --version
   ```
   If missing, reinstall: `curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs`

5. **OpenClaw not installed:**
   ```bash
   which openclaw
   ```
   If missing: `npm install -g openclaw`

## Cloudflare Tunnel Not Working

### Symptoms
- External requests to your domain return 502 or timeout
- `systemctl status cloudflared` shows errors

### Fixes

1. **Check tunnel status:**
   ```bash
   cloudflared tunnel info openclaw
   journalctl -u cloudflared -f
   ```

2. **Credentials expired:**
   ```bash
   cloudflared tunnel login
   # Re-authenticate and update credentials
   systemctl restart cloudflared
   ```

3. **Config file missing or wrong:**
   ```bash
   cat ~/.cloudflared/config.yml
   ```
   Verify the tunnel ID, credentials file path, and ingress rules match your setup.

4. **DNS not pointed:**
   ```bash
   dig openclaw.yourdomain.com
   ```
   Should return a CNAME to `<tunnel-id>.cfargotunnel.com`. If not, re-run:
   ```bash
   cloudflared tunnel route dns openclaw openclaw.yourdomain.com
   ```

5. **Gateway not running:**
   The tunnel proxies to `http://127.0.0.1:18789`. If the gateway is down, the tunnel returns 502.
   ```bash
   systemctl status openclaw-gateway
   curl -s http://127.0.0.1:18789/health
   ```

## Hooks Proxy Not Receiving Webhooks

### Symptoms
- Webhooks from GitHub/Gmail are not processed
- `journalctl -u openclaw-hooks-proxy -f` shows no activity

### Fixes

1. **Check the proxy is running:**
   ```bash
   systemctl status openclaw-hooks-proxy
   curl -s http://127.0.0.1:18800/health
   ```

2. **Token mismatch:**
   Compare the token in `/etc/openclaw/hooks-proxy.env` with `~/.openclaw/openclaw.json`:
   ```bash
   cat /etc/openclaw/hooks-proxy.env
   cat ~/.openclaw/openclaw.json | jq .gateway.auth.token
   ```
   They must match. If not, update the env file and restart:
   ```bash
   systemctl restart openclaw-hooks-proxy
   ```

3. **Public endpoint not reachable:**
   Test from outside: `curl -X POST https://hooks.yourdomain.com/test -d '{}'`
   If this fails, check your Cloudflare Tunnel or Caddy config.

4. **No routes configured:**
   Check `~/.openclaw/hooks-proxy.mjs` for route definitions. Add routes with `openclawpro add webhook`.

## Caddy Returns 502

### Symptoms
- Browser shows 502 Bad Gateway
- Caddy is running but can't reach the backend

### Fixes

1. **Gateway not running:**
   ```bash
   systemctl status openclaw-gateway
   ```

2. **Wrong upstream in Caddyfile:**
   ```bash
   cat /etc/caddy/Caddyfile
   ```
   Verify the `reverse_proxy` points to `127.0.0.1:18789`.

3. **Validate and reload Caddy config:**
   ```bash
   caddy validate --config /etc/caddy/Caddyfile
   systemctl reload caddy
   ```

4. **TLS certificate issue:**
   ```bash
   journalctl -u caddy -f
   ```
   If using a domain, ensure DNS is pointed to the server and ports 80/443 are open.

## Egress Firewall Blocks Needed Domains

### Symptoms
- Agent API calls fail with connection refused
- `iptables` logs show `OPENCLAW-EGRESS-BLOCKED`

### Fixes

1. **Check what's being blocked:**
   ```bash
   dmesg | grep OPENCLAW-EGRESS-BLOCKED | tail -20
   ```

2. **Add a domain to the allowlist:**
   ```bash
   echo "api.newservice.com" >> /etc/openclaw/egress-allowlist.conf
   /etc/openclaw/refresh-egress.sh
   ```

3. **Temporarily disable egress firewall:**
   ```bash
   iptables -D OUTPUT -j OPENCLAW-EGRESS
   ```

4. **Re-enable:**
   ```bash
   iptables -I OUTPUT -j OPENCLAW-EGRESS
   ```

5. **Full rollback:**
   ```bash
   iptables -D OUTPUT -j OPENCLAW-EGRESS
   iptables -F OPENCLAW-EGRESS
   iptables -X OPENCLAW-EGRESS
   ipset destroy openclaw-egress
   ```

## Fail2ban Banned Legitimate IP

### Symptoms
- You or a service is blocked from connecting
- `fail2ban-client status sshd` shows the IP as banned

### Fixes

```bash
# Check banned IPs
fail2ban-client status sshd

# Unban a specific IP
fail2ban-client set sshd unbanip YOUR_IP

# Check gateway jail
fail2ban-client status openclaw-gateway
fail2ban-client set openclaw-gateway unbanip YOUR_IP
```

## Tailscale Not Connected

### Symptoms
- `tailscale status` shows disconnected
- Cannot reach the server via Tailscale IP

### Fixes

1. **Re-authenticate:**
   ```bash
   tailscale up --ssh
   ```

2. **Check the service:**
   ```bash
   systemctl status tailscaled
   systemctl restart tailscaled
   ```

3. **Firewall blocking WireGuard:**
   ```bash
   ufw status | grep 41641
   ```
   If not listed: `ufw allow 41641/udp comment "Tailscale WireGuard"`

## Backup Failed

### Symptoms
- `openclawpro backup` fails with an error
- No backups in `~/.openclaw/backups/`

### Fixes

1. **Disk full:**
   ```bash
   df -h /
   ```
   Free up space if needed.

2. **GPG encryption fails:**
   ```bash
   # Use unencrypted backup first
   openclawpro backup

   # Then try encrypted
   openclawpro backup --encrypt
   ```

3. **Permission issue:**
   ```bash
   ls -la ~/.openclaw/
   chmod 700 ~/.openclaw
   ```

## Setup Interrupted

### Symptoms
- Setup crashed or was killed mid-way
- Want to restart from where it stopped

### Fix

Just run setup again:

```bash
openclawpro setup
```

It will detect the saved state and offer to resume from the last completed step. To start fresh:

```bash
rm /tmp/openclawpro-setup-state.json
openclawpro setup
```

## Audit Shows FAIL Items

Run auto-fix for simple issues:

```bash
openclawpro audit --fix
```

For remaining FAIL items, the audit output includes specific fix commands. Run them manually and re-audit:

```bash
openclawpro audit
```

## General Debugging

```bash
# Full status dashboard
openclawpro status

# Security audit with details
openclawpro audit

# Service logs (replace SERVICE_NAME)
journalctl -u SERVICE_NAME -f          # live tail
journalctl -u SERVICE_NAME -e          # recent entries
journalctl -u SERVICE_NAME --since "1 hour ago"

# System resources
htop
df -h
free -h
```
