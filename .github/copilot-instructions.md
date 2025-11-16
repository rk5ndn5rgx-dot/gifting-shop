# Copilot instructions for this repo

Purpose: make AI agents productive in this real‑time gifting + WebRTC chat app.

## Architecture in one glance
- Backend: `server.js` (Express + HTTP + Socket.io). REST under `/api/*`, Stripe webhook at `/webhook/stripe`, realtime events (`gift`, `chat message`, signaling).
- Frontend: static `public/` (WebRTC and UI in `public/script.js`; admin UIs in `public/admin*.{html,js}`).
- Data: MongoDB collections `users`, `admins`, `adminSessions`, `passwordResets`, `gifts`, `transactions`, `topups` with TTL indexes on sessions/resets.
- Payments: Stripe Checkout creates sessions; webhook credits users and records `topups`.
- Media: `multer` uploads gift videos to `public/gifts_media/` referenced by gift `mediaUrl`.

## Run and configure
- Start: `npm start` (node 18+ recommended). Port `3000` unless `PORT` set.
- Required env (when used): `MONGODB_URI`, `DB_NAME`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SMTP_*`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PIN`, `CREDITS_UNIT_USD`, `SELLER_USERNAME`.
- Webhook body: keep `/webhook/stripe` on raw body; don’t wrap with `express.json()`.

## Conventions you must follow
- Admin auth: login sets `admin_session` HttpOnly cookie; guard admin routes with `await isAdminReq(req)`.
- Sensitive mutations require PIN: enforce `requireAdminPin(req)` (header `x-admin-pin` or body `pin`).
- Client IDs are strings: convert `_id` with `String(_id)` in all responses.
- Degrade gracefully if `db == null`: serve `DEFAULT_GIFTS`, allow best‑effort gifting, return 503 for Stripe‑dependent routes.
- User persistence: `upsertUser({ username, userId })` gives new users 100 credits; client stores `rayd_userId` in localStorage.
- Room model: each socket is in at most one room; `join` handles leave-from-previous room.

## Typical flows (implementation truth)
- Buy credits: client -> `POST /api/credits/checkout` -> Stripe -> webhook -> DB `users.balance` increment + `topups` row.
- Send gift: client -> `POST /api/purchase` -> balance check, debit purchaser, credit seller (auto‑created), write `transactions`, emit `gift` to room.
- Admin gifts: `GET/POST/PUT/DELETE /api/admin/gifts` and `POST /api/admin/upload-gift` (multipart `media`).

## Extending safely (copy these patterns)
- New admin API: start with `if (!await isAdminReq(req)) return res.status(401).json({ error: 'Unauthorized' });` and add PIN if it mutates pricing/content.
- New collection: add indexes inside `initMongo()` after connecting (see `passwordResets` indexes for examples).
- New realtime feature: `io.to(roomId || 'main').emit('<event>', serializablePayload)`; never send raw `ObjectId`.

## Responses & status codes
- Errors: `{ error: 'message' }` with meaningful HTTP codes (use 503 for dependency outages like MongoDB/Stripe).
- Success: `{ message: '...' }` or domain object with string IDs.

## Security notes
- Keep cookies `HttpOnly`, `SameSite=Lax`, `Secure` (prod). Don’t log secrets or full connection strings.
- Stripe math: compute amounts in cents; unit price from `CREDITS_UNIT_USD`.

Key files to study: `server.js`, `public/script.js`, `public/admin-gifts.js`, `public/admin.js`.

Feedback: If you add new conventions (routes/events/indexes), tell me so I can update this file.
