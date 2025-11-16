# 🌐 Custom Domain Setup for Railway

Yes! You can connect **any domain** (from Wix, GoDaddy, Namecheap, etc.) to Railway.

---

## ✅ Quick Answer:
**You CANNOT use a Wix domain directly** because Wix locks their domains. But you can:
1. Buy a domain from **any registrar** (GoDaddy, Namecheap, Google Domains)
2. Point it to Railway using DNS settings
3. Railway handles SSL automatically (free HTTPS)

---

## 🚀 Step-by-Step: Connect Custom Domain to Railway

### Step 1: Deploy to Railway First
```bash
railway login
railway init
railway up
```

You'll get a Railway URL like: `https://your-app.up.railway.app`

### Step 2: Add Custom Domain in Railway

1. Go to your Railway project dashboard
2. Click **Settings** → **Domains**
3. Click **+ Add Domain**
4. Enter your domain (e.g., `giftshop.com`)
5. Railway will show you DNS records to add

### Step 3: Configure DNS at Your Domain Provider

Railway will give you records like:

| Type | Name | Value |
|------|------|-------|
| CNAME | @ (or www) | your-app.up.railway.app |
| CNAME | www | your-app.up.railway.app |

**Where to add these:**

#### GoDaddy:
1. Go to GoDaddy DNS Management
2. Add CNAME records
3. Wait 10-60 minutes for propagation

#### Namecheap:
1. Go to Domain List → Manage → Advanced DNS
2. Add CNAME records
3. Wait 10-60 minutes

#### Google Domains:
1. Go to DNS → Custom records
2. Add CNAME records
3. Wait 5-30 minutes

### Step 4: Wait for SSL Certificate
Railway automatically provisions a free SSL certificate (HTTPS) within 5-15 minutes.

---

## 💡 Domain Options:

### ✅ Recommended Domain Registrars:
1. **Namecheap** - Cheap, easy DNS ($8-12/year)
2. **Google Domains** - Simple interface ($12/year)
3. **GoDaddy** - Popular but upsell-heavy ($12-20/year)
4. **Porkbun** - Cheapest ($5-8/year)

### ❌ NOT Compatible:
- **Wix Domains** - Locked to Wix hosting only
- **Squarespace Domains** - Limited external use

---

## 🎯 Free Subdomain Alternative

Don't want to buy a domain yet? Use Railway's free subdomain:
- Format: `your-app-name.up.railway.app`
- Free HTTPS included
- Perfect for testing and sharing

---

## 📋 Complete Setup Checklist:

- [ ] Deploy app to Railway
- [ ] Buy domain from registrar (or use existing)
- [ ] Add domain in Railway dashboard
- [ ] Copy DNS records from Railway
- [ ] Add CNAME records to domain provider
- [ ] Wait 10-60 minutes for DNS propagation
- [ ] Check domain works with HTTPS

---

## 🔍 Verify DNS Propagation

Check if your DNS is working:
```bash
nslookup your-domain.com
```

Or use online tools:
- https://dnschecker.org
- https://www.whatsmydns.net

---

## 🆘 Troubleshooting:

**Domain not working after 1 hour?**
1. Double-check CNAME records are exact
2. Remove any conflicting A records
3. Make sure @ or www points to Railway URL
4. Contact your domain registrar support

**"SSL Certificate Pending"?**
- Wait 15 minutes, Railway auto-provisions
- Make sure DNS is propagated first

**"Domain Already Used"?**
- Remove the domain from any other Railway projects
- Each domain can only point to one Railway app

---

## 💰 Cost Summary:

| Item | Cost |
|------|------|
| Railway Hosting | $5/month free credit (enough for small app) |
| Custom Domain | $8-15/year (one-time annual) |
| SSL Certificate | FREE (auto from Railway) |
| **Total First Year** | ~$8-15 |

---

## 🎉 Example Final Setup:

**Your domain:** `raydent.com`
**Railway app:** `https://raydent.up.railway.app`

After DNS setup:
- Users visit: `https://raydent.com`
- Automatically secured with HTTPS
- Professional, easy to remember!

---

## 🚀 Ready to Deploy?

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Deploy
railway up

# 5. Add domain in Railway dashboard
# 6. Configure DNS at your registrar
# 7. Share your custom domain!
```

Need help? Railway has great docs: https://docs.railway.app/deploy/exposing-your-app
