# Cloudflare Tunnel Reference

## Overview

Cloudflare Tunnel provides zero-trust access to the OpenClaw gateway without exposing any ports on the public internet. Traffic flows through Cloudflare's network, so the VPS does not need ports 80 or 443 open.

## Prerequisites

- A Cloudflare account with a domain added
- `cloudflared` installed (done automatically during setup)

## Setup Process

### 1. Authenticate

```bash
cloudflared tunnel login
```

This opens a browser to authenticate with Cloudflare. On headless servers, copy the URL to a local browser.

### 2. Create Tunnel

```bash
cloudflared tunnel create openclaw
```

This generates a tunnel ID and credentials file at `~/.cloudflared/<tunnel-id>.json`.

### 3. Configure Tunnel

Create or edit `~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: openclaw.example.com
    service: http://127.0.0.1:18789
  - hostname: hooks.example.com
    service: http://127.0.0.1:18800
  - service: http_status:404
```

### 4. Create DNS Routes

```bash
cloudflared tunnel route dns openclaw openclaw.example.com
cloudflared tunnel route dns openclaw hooks.example.com
```

### 5. Install as Service

```bash
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
```

## Route Management

### Adding Routes

```bash
# Add a new hostname to the tunnel
cloudflared tunnel route dns <tunnel-name> <hostname>
```

Then update `~/.cloudflared/config.yml` to add the new ingress rule.

### Removing Routes

Remove the hostname from `config.yml` and delete the DNS record from the Cloudflare dashboard.

### Listing Routes

```bash
cloudflared tunnel route list
```

## Monitoring

```bash
# Check service status
systemctl status cloudflared

# View logs
journalctl -u cloudflared -f

# Check tunnel status
cloudflared tunnel info openclaw
```

## Security Notes

- The gateway remains bound to `127.0.0.1` -- Cloudflare Tunnel connects to it locally
- No inbound ports need to be open (not even 80/443)
- Cloudflare applies DDoS protection automatically
- Use Cloudflare Access policies for additional authentication layers
- The tunnel credentials file must be protected (readable by root only)

## Hooks Proxy with Cloudflare

When using webhooks through Cloudflare Tunnel, add a route for the hooks proxy (port 18800):

```yaml
ingress:
  - hostname: hooks.example.com
    service: http://127.0.0.1:18800
```

This allows external services (GitHub, Gmail) to send webhook payloads through the tunnel to the hooks proxy.
