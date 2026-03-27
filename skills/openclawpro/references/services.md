# Systemd Services Reference

## OpenClaw Gateway

The main OpenClaw gateway process.

| Property | Value |
|----------|-------|
| Service name | `openclaw-gateway` |
| Port | 18789 |
| Bind | 127.0.0.1 (loopback) |
| Unit file | `/etc/systemd/system/openclaw-gateway.service` |

### Management

```bash
systemctl start openclaw-gateway
systemctl stop openclaw-gateway
systemctl restart openclaw-gateway
systemctl status openclaw-gateway
journalctl -u openclaw-gateway -f      # live logs
journalctl -u openclaw-gateway -e      # recent logs
journalctl -u openclaw-gateway --since "1 hour ago"
```

### Troubleshooting

- Check token is set in `~/.openclaw/openclaw.json`
- Verify port 18789 is not used by another process: `ss -tlnp | grep 18789`
- Check Node.js is available: `which node`

## Hooks Proxy

Receives incoming webhooks and forwards them to the gateway with authentication.

| Property | Value |
|----------|-------|
| Service name | `openclaw-hooks-proxy` |
| Port | 18800 |
| Unit file | `/etc/systemd/system/openclaw-hooks-proxy.service` |
| Env file | `/etc/openclaw/hooks-proxy.env` |
| Script | `~/.openclaw/hooks-proxy.mjs` |

### Management

```bash
systemctl start openclaw-hooks-proxy
systemctl stop openclaw-hooks-proxy
systemctl restart openclaw-hooks-proxy
systemctl status openclaw-hooks-proxy
journalctl -u openclaw-hooks-proxy -f
```

### Configuration

The hooks proxy reads its config from:
- `/etc/openclaw/hooks-proxy.env` -- contains `OPENCLAW_HOOK_TOKEN` and `PORT`
- `~/.openclaw/hooks-proxy.mjs` -- proxy script with route definitions

The env file has mode 0600 (readable by root only) to protect the gateway token.

### Adding Webhook Routes

Use `openclawpro add webhook` to add new routes. Routes are stored in the proxy script and map incoming webhook paths to gateway channels.

## Gmail Watchers

Gmail notification watchers run as systemd services to monitor Gmail accounts via Google Pub/Sub.

| Property | Value |
|----------|-------|
| Service name | `openclaw-gmail-<account>` |
| Unit file | `/etc/systemd/system/openclaw-gmail-<account>.service` |

### Management

```bash
# List all Gmail watcher services
systemctl list-units 'openclaw-gmail-*'

# Manage a specific watcher
systemctl status openclaw-gmail-main
systemctl restart openclaw-gmail-main
journalctl -u openclaw-gmail-main -f
```

## Cloudflare Tunnel

| Property | Value |
|----------|-------|
| Service name | `cloudflared` |
| Config | `~/.cloudflared/config.yml` |

```bash
systemctl status cloudflared
systemctl restart cloudflared
journalctl -u cloudflared -f
```

## Caddy Reverse Proxy

| Property | Value |
|----------|-------|
| Service name | `caddy` |
| Config | `/etc/caddy/Caddyfile` |
| Ports | 80, 443 |

```bash
systemctl status caddy
systemctl restart caddy
systemctl reload caddy    # reload config without downtime
journalctl -u caddy -f
caddy validate --config /etc/caddy/Caddyfile
```

## Tailscale VPN

| Property | Value |
|----------|-------|
| Service name | `tailscaled` |
| Port | 41641/udp (WireGuard) |

```bash
systemctl status tailscaled
tailscale status
tailscale ip -4
```

## Fail2ban

| Property | Value |
|----------|-------|
| Service name | `fail2ban` |
| Config | `/etc/fail2ban/jail.local` |
| Gateway jail | `/etc/fail2ban/jail.d/openclaw-gateway.conf` |

```bash
systemctl status fail2ban
fail2ban-client status
fail2ban-client status sshd
fail2ban-client set sshd unbanip <ip>
```

## Checking All Services at Once

```bash
openclawpro status
```

This shows a dashboard with the status of all services, ports, configuration, and system metrics.
