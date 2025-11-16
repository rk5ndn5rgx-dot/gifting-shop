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
