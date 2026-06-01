# Firebase Recovery Plan
**Account**: antonioryarbough@gmail.com  
**Projects Found**: 7  
**Goal**: Restore WebRTC + gifting-shop across Firebase

## Projects to Recover

| # | Project ID | Type | Priority |
|---|---|---|---|
| 7 | ai-antonios-intelligence | AI Antonios | | 6 | studio | Generic Studio | | 5 | antonioroschelleyarboughsrttee | Personal | | 4 | RayDEnt | Ray D Ent (variant) | | 3 | raydentraydent-16571 | Ray D Ent | | 2 | studio-2fb13 | AI Enterprise Studio | | 1 | studio-9757662699-74931 | Baby Ray Studio | 
## Recovery Steps

### Step 1: Audit Each Project
For each project above, go to Firebase Console and check:
-  **Hosting**: Is there a `.web.app` domain deployed?
-  **Realtime Database**: Any data in `/` root?
-  **Firestore**: Any collections?
-  **Storage**: Any files?
-  **Functions**: Any deployed functions?

### Step 2: Determine Which is Primary
- Which project has **live traffic** or **active hosting**?
- Which one is for **gifting-shop** (the one in this repo)?

### Step 3: Re-deploy Code
```bash
# Initialize Firebase CLI (if not already done)
firebase login

# Select the primary project
firebase use studio-9757662699-74931  # example

# Deploy hosting
firebase deploy --only hosting

# Deploy functions (if any)
firebase deploy --only functions

# Deploy rules (Realtime DB / Firestore)
firebase deploy --only database,firestore
```

### Step 4: Verify Live URLs
```bash
# Test each hosting domain
curl -I https://studio-9757662699-74931.web.app
curl -I https://studio-2fb13.web.app
```

## Notes
- Code is intact in `/public` directory
- WebRTC setup in `public/script.js` and `public/src/`
- Backend in `server.js` (Express + Socket.io + MongoDB)

---

**Next Action**: Provide the audit results from each project, and I'll proceed with deployment.
