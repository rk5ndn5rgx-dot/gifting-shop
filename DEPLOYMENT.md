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

## Render Private Service (recommended for a secure backend)

Render Private Services run inside Render's private network and are not publicly accessible. Use a Private Service for your `gifting-shop` backend when you want the frontend to be public but keep the server, Stripe webhook, and DB access internal.

Steps to create a Private Service on Render:

1. Go to the Render Dashboard → **New** → **Private Service**.
2. Connect your GitHub repo and select the `gifting-shop` repository.
3. Set the build command to:

```bash
npm install
```

4. Set the start command to:

```bash
node server.js
```

5. In the Render UI, under Environment, add the required environment variables (use Render Secrets for sensitive values):

- `MONGODB_URI` (required)
- `DB_NAME` (optional; defaults to `rayd_ent`)
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (required for payments)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (optional, for email)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PIN` (admin credentials)
- `CLOUDINARY_URL` (optional, for uploads)
- `CREDITS_UNIT_USD`, `SELLER_USERNAME` (optional)
- `SOCKET_IO_CORS` — a comma-separated list of origins allowed to open Socket.IO connections (for example: `https://your-frontend.onrender.com,https://your-domain.com`). If omitted, defaults in `server.js` are used.

6. Choose the same region as any public frontend service you run on Render to minimize latency.

7. Create the service. Render will assign an internal DNS hostname (for example `gifting-shop.internal:10000`) reachable by other Render services.

Linking a public frontend to the Private Service:

- Deploy your public frontend as a separate Web Service on Render (or on another host).
- In the frontend's code or environment vars, use the internal hostname provided by Render to call backend APIs from other Render services (network access is allowed between services in the same region).
- If the frontend is external (not hosted on Render), keep the backend public instead of private or set up a secure proxy. Private Services cannot be reached from the public internet.

Stripe webhook note:
- If you keep the service private you must route Stripe webhooks through a publicly reachable endpoint (e.g., a public Render Web Service acting as a small proxy that forwards `/webhook/stripe` to the private service), or run the webhook handler on a public service.

Public Stripe webhook proxy setup:
1. Deploy a separate public Render Web Service named `gifting-shop-webhook-proxy` using `stripe-proxy.js`.
2. Configure the public proxy with:
   - `PRIVATE_SERVICE_HOST=gifting-shop-backend.internal`
   - `PRIVATE_SERVICE_PORT=10000`
   - `PRIVATE_SERVICE_PROTOCOL=http`
3. The proxy accepts `/webhook/stripe` and forwards the raw Stripe payload and `Stripe-Signature` header to the private backend.
4. In Stripe, point the webhook endpoint at the proxy's public URL, for example `https://gifting-shop-webhook-proxy.onrender.com/webhook/stripe`.

Security tips:
- Use Render Secrets for all private keys.
- Set a strong `ADMIN_PIN` and `ADMIN_PASSWORD`.
- Limit allowed Socket origins with `SOCKET_IO_CORS`.

See the `server.js` Socket.IO CORS config (reads `SOCKET_IO_CORS`) for details: [server.js](server.js#L1-L40).

Copy of environment template: see [`.env.example`](.env.example#L1-L200) to populate secrets before adding them to Render.
