# Development Scripts

## `dev.ps1` - Start Development Server

Quick startup script that sets all required environment variables and launches the Node server.

### Usage

```powershell
.\scripts\dev.ps1
```

### What it does

1. Sets default environment variables for local development
2. Loads additional variables from `.env` if present (create from `.env.example`)
3. Checks MongoDB service status
4. Displays configuration summary
5. Starts the Node.js server

### First-time setup

1. **Copy environment template:**
   ```powershell
   Copy-Item .env.example .env
   ```

2. **Edit `.env` with your credentials:**
   - `CLOUDINARY_URL` - Get from https://cloudinary.com/console
   - `STRIPE_SECRET_KEY` - Get from https://dashboard.stripe.com/test/apikeys
   - `STRIPE_WEBHOOK_SECRET` - Get after creating webhook endpoint

3. **Start MongoDB:**
   ```powershell
   Start-Service -Name MongoDB
   ```

4. **Run the server:**
   ```powershell
   .\scripts\dev.ps1
   ```

### Troubleshooting

**MongoDB not running:**
```powershell
Start-Service -Name MongoDB
Get-Service -Name MongoDB  # verify it's running
```

**Port 3000 already in use:**
- Stop other Node processes or set `PORT` env var:
  ```powershell
  $env:PORT = '3001'
  .\scripts\dev.ps1
  ```

**Uploads failing:**
- Ensure `CLOUDINARY_URL` is set in `.env` file
- Format: `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`

**Payments failing:**
- Check `STRIPE_SECRET_KEY` starts with `sk_test_` or `sk_live_`
- Webhook requires public tunnel (ngrok/cloudflared) in production
