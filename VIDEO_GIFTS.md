# 🎥 Video Gift (MP4) Feature Guide

## ✅ Your App Already Supports Video Gifts!

Users can sell and send MP4 videos as premium gifts. When someone receives a video gift, it auto-plays as a beautiful overlay!

---

## 🎬 How to Add Video Gifts (Admin)

### Step 1: Access Admin Panel
Go to: `http://localhost:3000/admin-gifts.html`

### Step 2: Login
Use your admin credentials (set in environment variables):
- Email: `ADMIN_EMAIL`
- Password: `ADMIN_PASSWORD`

### Step 3: Create Video Gift
1. Enter **Admin PIN** (required for security)
2. Fill in gift details:
   - **Key**: Unique ID (e.g., `birthday_video`)
   - **Name**: Display name (e.g., `Birthday Song`)
   - **Price**: Credits (e.g., `50`)
   - **Emoji**: Icon (e.g., `🎂`)
3. **Select MP4 file** (max 30MB)
4. Click **Upload + Save**

### Example Video Gift:
```
Key: dance_video
Name: Victory Dance
Price: 100
Emoji: 💃
MP4: celebration.mp4 (30MB max)
```

---

## 🎁 How Users Experience Video Gifts

### When Sent:
1. User clicks "Gifts 🎁" button
2. Selects video gift (shows emoji + name)
3. Selects recipient
4. Gift is purchased with credits

### When Received:
- ✨ Video appears as **center overlay** on screen
- 🎵 Auto-plays (muted)
- ⏱️ Plays for **5 seconds** then disappears
- 💬 Chat shows: "John gifted Sarah 💃 Victory Dance"

### Features:
✅ Responsive sizing (90% width, 60vh max height)
✅ Works on mobile & desktop
✅ Auto-plays without sound (browser-friendly)
✅ Smooth fade-in animation
✅ Auto-removes after playback

---

## 📁 Video File Requirements

**Format**: MP4
**Max Size**: 30MB
**Recommended**:
- Resolution: 720p or 1080p
- Duration: 3-10 seconds
- Codec: H.264
- Aspect Ratio: 16:9 or 1:1 (square)

**Storage**: Videos saved to `public/gifts_media/`

---

## 💰 Monetization Strategy

### Suggested Pricing:
- **Simple emoji gifts**: 5-25 credits ($0.50-$2.50)
- **Short video clips**: 50-100 credits ($5-$10)
- **Premium videos**: 200-500 credits ($20-$50)

### Video Gift Ideas:
- 🎂 Birthday songs
- 🎉 Celebrations/confetti
- 💃 Dance moves
- 🎵 Music clips
- 🏆 Victory animations
- 💖 Love messages
- 😂 Funny clips

---

## 🎨 Technical Details

### Backend (server.js):
```javascript
// Upload endpoint with multer
app.post('/api/admin/upload-gift', upload.single('media'), ...)

// Stores: { key, name, price, emoji, mediaUrl }
// mediaUrl: /gifts_media/filename.mp4
```

### Frontend (script.js):
```javascript
// On gift received:
if (ev.gift.mediaUrl) {
  const v = document.createElement('video');
  v.src = ev.gift.mediaUrl;
  v.autoplay = true;
  v.muted = true;
  document.body.appendChild(v);
  setTimeout(() => v.remove(), 5000);
}
```

### CSS (style.css):
```css
.gift-media {
  position: fixed;
  max-width: 90%;
  max-height: 60vh;
  /* Auto-sized, centered, responsive */
}
```

---

## 🚀 After Deployment

### Upload Videos:
1. Deploy to Railway
2. Access: `https://your-app.up.railway.app/admin-gifts.html`
3. Upload MP4s via admin panel
4. Share gift catalog with users

### Storage Considerations:
- Railway provides disk storage
- Videos persist across deployments
- Consider CDN for large catalogs (future optimization)

---

## 🧪 Test Video Gifts Locally

1. Start server: `node server.js`
2. Open admin: `http://localhost:3000/admin-gifts.html`
3. Login and upload test MP4
4. Open main app: `http://localhost:3000`
5. Join room, open gifts, send video gift
6. Watch video overlay appear!

---

## 🎯 Example Use Cases

### 1. Birthday Party Room
- Upload "Happy Birthday" song video
- Guests buy and send to birthday person
- Video plays on their screen with celebration

### 2. Live Performance Tips
- Performer in main room
- Fans send animated gifts
- Videos show appreciation in real-time

### 3. Virtual Events
- Sponsor logos as video gifts
- Attendees send branded gifts
- Event monetization

---

Your video gift system is **fully functional** and ready for MP4s! 🎥✨
