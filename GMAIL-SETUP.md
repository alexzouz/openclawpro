# Gmail Notification Setup

This guide walks through setting up Gmail notifications for OpenClaw using Google Cloud Pub/Sub.

## Prerequisites

- OpenClawPro setup completed (`openclawpro setup`)
- A Google account with Gmail
- A public URL for the hooks proxy (via Cloudflare Tunnel or Caddy with a domain)
- Google Cloud CLI installed (included in the setup)

## Step 1: Create a Google Cloud Project

```bash
# Authenticate with Google Cloud
gcloud auth login

# Create a new project
gcloud projects create openclaw-gmail --name="OpenClaw Gmail"
gcloud config set project openclaw-gmail

# Enable billing (required for Pub/Sub)
# Visit: https://console.cloud.google.com/billing
# Link the project to a billing account
```

## Step 2: Enable APIs

```bash
gcloud services enable gmail.googleapis.com
gcloud services enable pubsub.googleapis.com
```

## Step 3: Create OAuth Credentials

1. Open [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: External
   - App name: OpenClaw Gmail
   - User support email: your email
   - Developer contact: your email
   - Scopes: add `https://www.googleapis.com/auth/gmail.readonly`
   - Test users: add your Gmail address
4. Go back to Credentials > **Create Credentials** > **OAuth client ID**
5. Application type: **Desktop app**
6. Name: OpenClaw
7. Click **Create** and download the JSON file

```bash
# Save the credentials file
mkdir -p ~/.openclaw
mv ~/Downloads/client_secret_*.json ~/.openclaw/gmail-credentials.json
chmod 600 ~/.openclaw/gmail-credentials.json
```

## Step 4: Create Pub/Sub Topic and Subscription

```bash
# Create the topic
gcloud pubsub topics create gmail-notifications

# Grant Gmail permission to publish to the topic
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

# Create a push subscription pointing to your hooks proxy
gcloud pubsub subscriptions create gmail-push \
  --topic=gmail-notifications \
  --push-endpoint=https://hooks.yourdomain.com/gmail \
  --ack-deadline=60
```

Replace `hooks.yourdomain.com` with the actual hostname pointing to your hooks proxy (port 18800).

## Step 5: Authenticate with Gmail via gog

`gog` (Gmail OAuth Gateway) handles the OAuth flow for Gmail API access.

```bash
# Install gog
npm install -g gog

# Run authentication
gog auth --credentials ~/.openclaw/gmail-credentials.json
```

On a headless server, gog will print a URL. Copy it to a browser on your local machine, complete the OAuth flow, and paste the authorization code back into the terminal.

## Step 6: Start Gmail Watch

```bash
# Start watching for new emails
gog watch --topic projects/openclaw-gmail/topics/gmail-notifications
```

The Gmail API watch expires every 7 days. Set up automatic renewal:

```bash
# Add cron job to renew every 6 days
(crontab -l 2>/dev/null; echo "0 0 */6 * * gog watch --topic projects/openclaw-gmail/topics/gmail-notifications > /dev/null 2>&1 # gmail-watch-renewal") | crontab -
```

## Step 7: Configure the Webhook Route

```bash
openclawpro add webhook
```

When prompted:
- Channel: `gmail`
- Path: `/gmail`
- Target: `http://127.0.0.1:18789` (the gateway)

## Step 8: Configure the OpenClaw Channel

Edit `~/.openclaw/openclaw.json` and add a Gmail channel:

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

Restart the gateway:

```bash
systemctl restart openclaw-gateway
```

## Step 9: Verify

1. Send a test email to your configured Gmail address
2. Watch the logs:

```bash
# In one terminal
journalctl -u openclaw-hooks-proxy -f

# In another terminal
journalctl -u openclaw-gateway -f
```

3. You should see the notification arrive at the hooks proxy and get forwarded to the gateway

## Troubleshooting

### "Push endpoint unreachable"

- Verify your Cloudflare Tunnel or Caddy is running and the hostname resolves
- Test the endpoint: `curl -X POST https://hooks.yourdomain.com/gmail -d '{"test": true}'`
- Check hooks proxy logs: `journalctl -u openclaw-hooks-proxy -f`

### "Permission denied" on Pub/Sub

- Verify the service account binding:
  ```bash
  gcloud pubsub topics get-iam-policy gmail-notifications
  ```
- Re-add the binding if missing (see Step 4)

### "Token expired"

- Re-authenticate: `gog auth --credentials ~/.openclaw/gmail-credentials.json`
- Re-start the watch: `gog watch --topic projects/openclaw-gmail/topics/gmail-notifications`

### No notifications after 7 days

- The Gmail watch expires weekly. Check the cron job:
  ```bash
  crontab -l | grep gmail-watch
  ```
- Manually renew: `gog watch --topic projects/openclaw-gmail/topics/gmail-notifications`

### OAuth consent screen "unverified app" warning

- This is normal for apps in testing mode
- Add your Gmail address to the test users list in the OAuth consent screen
- For production, submit the app for verification

## Security Notes

- OAuth credentials file must have restricted permissions (`chmod 600`)
- Use a dedicated Google Cloud project, separate from other workloads
- The `gog` keyring password is stored in `~/.openclaw-vps/config.json` -- protect this file
- Never commit OAuth credentials or tokens to version control
- Consider using a service account for production deployments
