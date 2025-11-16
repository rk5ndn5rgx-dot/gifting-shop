# RAY D. ENT Gift Shop - Deployment Guide

## 🚀 Recommended Deployment Platforms

Your app requires:
- WebSocket support (Socket.io)
- Persistent Node.js server
- MongoDB connection

### ✅ Best Options (Free Tier Available):

#### 1. **Railway.app** (Recommended)
- ✅ Free $5/month credit
- ✅ Full WebSocket support
- ✅ Easy MongoDB integration
- ✅ One-click deployment

**Deploy to Railway:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

Set environment variables in Railway dashboard:
- `MONGODB_URI` - Your MongoDB connection string
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook secret
- `SMTP_USER` / `SMTP_PASS` - Email credentials
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_PIN` - Admin credentials

#### 2. **Render.com**
- ✅ Free tier (750 hours/month)
- ✅ WebSocket support
- ✅ Auto-deploy from GitHub

**Deploy to Render:**
1. Push code to GitHub
2. Go to render.com
3. New Web Service → Connect your repo
4. Use `render.yaml` config (already included)
5. Persistent uploads: `render.yaml` mounts a disk at `public/gifts_media` so uploaded MP4s persist across deploys/restarts.

#### 3. **Fly.io**
- ✅ Free tier (3 small VMs)
- ✅ Great for real-time apps

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly deploy
```

---

## ❌ NOT Recommended:

**Vercel/Netlify** - Designed for serverless/static sites. Your app needs:
- Persistent WebSocket connections
- Long-running server process

---

## 🎯 Quick Start (Railway - Easiest)

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Deploy:**
   ```bash
   railway init
   railway up
   ```

4. **Set environment variables** in Railway dashboard

5. **Get your URL** and share it!

---

## 📝 Required Environment Variables

```env
# MongoDB
MONGODB_URI=mongodb+srv://your-connection-string
DB_NAME=rayd_ent

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CREDITS_UNIT_USD=0.10

# Email (for password resets)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Admin credentials
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password
ADMIN_PIN=123456
SELLER_USERNAME=rayd_seller

```

---

## 🗂️ Render Persistent Disk for Uploads

Uploads (video gifts) must persist across deploys. This repo includes a Render disk mount in `render.yaml`:

```yaml
disk:
   name: gifts-media
   mountPath: /opt/render/project/src/public/gifts_media
   sizeGB: 1
```

Notes:
- Render will create the disk on first deploy. You can resize in the Render dashboard.
- Files uploaded via the admin UI will be stored under `public/gifts_media` and will persist across restarts.
- Keep `public/gifts_media/**` out of Git (already ignored) to avoid bloating your repository.

---

## 🔔 Stripe Webhook Setup (Production)

After your first successful deploy, configure a Stripe webhook for your Render URL:

1. Copy your Render URL (e.g., `https://gifting-shop.onrender.com`).
2. In Stripe Dashboard → Developers → Webhooks → Add endpoint:
    - Endpoint URL: `https://<your-render-url>/webhook/stripe`
    - Events to send: `checkout.session.completed`
3. Copy the Signing Secret (`whsec_...`) and set it in Render env as `STRIPE_WEBHOOK_SECRET`.
4. Rotate old keys if any were exposed and remove them from your account.

Local testing:

```bash
stripe listen --events checkout.session.completed \
   --forward-to http://localhost:3000/webhook/stripe --print-secret
```
Use the printed `whsec_...` in your local shell:

```powershell
$env:STRIPE_WEBHOOK_SECRET = 'whsec_...'
$env:STRIPE_SECRET_KEY    = 'sk_test_...'
node server.js
```

---

## 🎨 User Experience Improvements

✅ **Added:**
- Welcome banner with features
- "Get Started Free" button
- Visual animations
- Feature highlights (100 free credits!)

---

## 🔗 MongoDB Setup (if you don't have one)

Use **MongoDB Atlas** (free tier):
1. Go to mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string
4. Add to `MONGODB_URI` env variable

---

## Need Help?

Check the console logs after deployment:
```bash
railway logs
# or
render logs
```
