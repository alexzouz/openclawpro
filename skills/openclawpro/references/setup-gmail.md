# Gmail Setup Reference

## Overview

Gmail notifications allow the OpenClaw bot to receive and respond to emails. The setup uses Google Cloud Pub/Sub to watch for new emails and forward them to the gateway via the hooks proxy.

## Prerequisites

- A Google account
- Google Cloud CLI (`gcloud`) installed (done automatically during setup)
- A working hooks proxy with a public URL (via Cloudflare Tunnel or Caddy)

## Step-by-Step Setup

### 1. Create a Google Cloud Project

```bash
gcloud projects create openclaw-gmail --name="OpenClaw Gmail"
gcloud config set project openclaw-gmail
```

### 2. Enable Required APIs

```bash
gcloud services enable gmail.googleapis.com
gcloud services enable pubsub.googleapis.com
```

### 3. Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console > APIs & Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" > "OAuth client ID"
3. Application type: "Desktop app"
4. Download the JSON credentials file
5. Save it as `~/.openclaw/gmail-credentials.json`

### 4. Create a Pub/Sub Topic

```bash
gcloud pubsub topics create gmail-notifications
```

### 5. Grant Gmail Permission to Publish

```bash
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

### 6. Create a Pub/Sub Subscription

Create a push subscription that sends notifications to the hooks proxy:

```bash
gcloud pubsub subscriptions create gmail-push \
  --topic=gmail-notifications \
  --push-endpoint=https://hooks.example.com/gmail \
  --ack-deadline=60
```

Replace `hooks.example.com` with your actual hooks proxy domain.

### 7. Authenticate with Gmail

Use `gog` (Gmail OAuth Gateway) to complete the OAuth flow:

```bash
# Install gog
npm install -g gog

# Authenticate (opens browser)
gog auth --credentials ~/.openclaw/gmail-credentials.json
```

On headless servers, use the `--no-browser` flag and copy the URL to a local browser.

### 8. Set Up Gmail Watch

```bash
gog watch --topic projects/openclaw-gmail/topics/gmail-notifications
```

The watch must be renewed every 7 days. Set up a cron job:

```bash
# Add to crontab
0 0 */6 * * gog watch --topic projects/openclaw-gmail/topics/gmail-notifications > /dev/null 2>&1
```

### 9. Configure the Hooks Proxy

Add a Gmail webhook route to forward notifications to the gateway:

```bash
openclawpro add webhook
# Choose "gmail" as the channel
# Enter the path: /gmail
```

### 10. Configure the OpenClaw Channel

Edit `~/.openclaw/openclaw.json` to add a Gmail channel:

```json
{
  "channels": {
    "gmail": {
      "enabled": true,
      "accounts": {
        "main": {
          "email": "your@gmail.com",
          "credentialsPath": "~/.openclaw/gmail-credentials.json"
        }
      }
    }
  }
}
```

## Verification

1. Send a test email to the configured Gmail account
2. Check hooks proxy logs: `journalctl -u openclaw-hooks-proxy -f`
3. Check gateway logs: `journalctl -u openclaw-gateway -f`
4. The bot should respond to the email

## Troubleshooting

- **No notifications**: Verify the Pub/Sub subscription push endpoint is reachable
- **Auth expired**: Re-run `gog auth` and `gog watch`
- **Permission denied**: Check the service account has `pubsub.publisher` role on the topic
- **Watch expired**: The Gmail watch expires every 7 days -- check the cron job is running

## Security Notes

- Store OAuth credentials with restricted permissions (`chmod 600`)
- Use a dedicated Google Cloud project for OpenClaw
- The `gog` keyring password (if set) is stored in `~/.openclaw-vps/config.json`
- Never share OAuth tokens or credentials files
