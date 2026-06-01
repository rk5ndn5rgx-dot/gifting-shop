const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: ['https://raydent-16571.web.app', 'https://studio-9757662699-74931.web.app', 'https://studio-2fb13.web.app', 'http://localhost:3000'],
		methods: ['GET', 'POST'],
		credentials: true
	},
	transports: ['websocket', 'polling'],
	allowUpgrades: true
});

const PUBLIC_DIR = path.join(__dirname, 'public');
// Use conditional JSON parser: skip for Stripe webhook raw body
app.use((req, res, next) => {
	if (req.originalUrl === '/webhook/stripe') return next();
	return express.json()(req, res, next);
});

// Email configuration (use environment variables in production)
const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
};

// Create reusable transporter
const transporter = nodemailer.createTransport(emailConfig);

// Stripe configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const CREDITS_UNIT_USD = Number(process.env.CREDITS_UNIT_USD || '0.10'); // $ per 1 credit
const stripe = STRIPE_SECRET_KEY ? Stripe(STRIPE_SECRET_KEY) : null;

// Cloudinary configuration (CLOUDINARY_URL env var auto-configures)
if (process.env.CLOUDINARY_URL) {
	cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
}

// Default gifts (used when DB unavailable or to seed DB)
const DEFAULT_GIFTS = [
	{ key: 'rose', name: 'Rose', price: 5, emoji: '🌹' },
	{ key: 'star', name: 'Star', price: 10, emoji: '⭐' },
	{ key: 'trophy', name: 'Trophy', price: 25, emoji: '🏆' }
];

// Seller + PIN config
const SELLER_USERNAME = process.env.SELLER_USERNAME || 'Seller';
const ADMIN_PIN = process.env.ADMIN_PIN || '1234'; // set a secure value in production

function requireAdminPin(req) {
	const pin = (req.headers['x-admin-pin'] || (req.body && req.body.pin) || '').toString();
	return pin === ADMIN_PIN;
}

// helper to read cookies (simple)
function getCookie(req, name) {
    const header = req.headers.cookie;
    if (!header) return null;
    const parts = header.split(';').map(p => p.trim());
    for (const p of parts) {
        const [k, ...v] = p.split('=');
        if (k === name) return decodeURIComponent(v.join('='));
    }
    return null;
}

// helper to set cookie
function setCookie(res, name, value, options = {}) {
    const opts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        ...options
    };
    
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (opts.httpOnly) parts.push('HttpOnly');
    if (opts.secure) parts.push('Secure');
    if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
    if (opts.maxAge) parts.push(`Max-Age=${Math.floor(opts.maxAge / 1000)}`);
    if (opts.path) parts.push(`Path=${opts.path}`);
    
    res.setHeader('Set-Cookie', parts.join('; '));
}

async function isAdminReq(req) {
    if (!db) return false;
    const sessionId = getCookie(req, 'admin_session');
    if (!sessionId) return false;
    
    // Check session in database
    const session = await db.collection('adminSessions').findOne({ 
        _id: sessionId,
        expiresAt: { $gt: new Date() }
    });
    
    return !!session;
}

// Stripe webhook (must receive raw body)
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
	if (!stripe || !STRIPE_WEBHOOK_SECRET) {
		return res.status(503).send('Stripe not configured');
	}
	const sig = req.headers['stripe-signature'];
	let event;
	try {
		event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
	} catch (err) {
		console.error('Stripe webhook signature verification failed:', err.message);
		return res.status(400).send(`Webhook Error: ${err.message}`);
	}

	try {
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object;
				const md = session.metadata || {};
				const userId = md.userId;
				const credits = parseInt(md.credits || '0', 10);
				if (db && userId && credits > 0) {
					try {
						await db.collection('users').updateOne(
							{ _id: new ObjectId(userId) },
							{ $inc: { balance: credits }, $set: { lastSeen: new Date() } }
						);
						await db.collection('topups').insertOne({
							userId: new ObjectId(userId),
							credits,
							sessionId: session.id,
							amount_total: session.amount_total,
							currency: session.currency,
							createdAt: new Date()
						});
					} catch (e) {
						console.error('Failed to credit user from webhook', e);
					}
				}
				break;
			}
			default:
				// ignore other events for now
				break;
		}
	} catch (err) {
		console.error('Webhook handler error', err);
		return res.status(500).send('Webhook handler error');
	}

	res.json({ received: true });
});

// protect admin static pages (redirect to login if not authorized)
app.use(async (req, res, next) => {
	if (req.path === '/admin.html' || req.path === '/admin.js' || req.path === '/admin-gifts.html' || req.path === '/admin-gifts.js') {
		const ok = await isAdminReq(req);
		if (!ok) return res.redirect('/admin-login.html');
	}
	next();
});

app.use(express.static(PUBLIC_DIR));

// --- Admin auth & password reset endpoints ---
app.post('/api/admin/login', async (req, res) => {
	if (!db) return res.status(503).json({ error: 'Database not available' });
	const { email, password } = req.body || {};
	if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

	try {
		const admin = await db.collection('admins').findOne({ email });
		if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
		const match = await bcrypt.compare(password, admin.password);
		if (!match) return res.status(401).json({ error: 'Invalid credentials' });

		const sessionId = crypto.randomBytes(32).toString('hex');
		await db.collection('adminSessions').insertOne({
			_id: sessionId,
			adminId: admin._id,
			createdAt: new Date(),
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
		});
		setCookie(res, 'admin_session', sessionId);
		res.json({ message: 'Logged in' });
	} catch (err) {
		console.error('Login error', err);
		res.status(500).json({ error: 'Internal server error' });
	}
});

app.post('/api/admin/logout', async (req, res) => {
	if (!db) return res.status(503).json({ error: 'Database not available' });
	const sessionId = getCookie(req, 'admin_session');
	if (sessionId) await db.collection('adminSessions').deleteOne({ _id: sessionId });
	setCookie(res, 'admin_session', '', { maxAge: 0 });
	res.json({ message: 'Logged out' });
});

// Rate-limited password reset request
app.post('/api/admin/request-reset', async (req, res) => {
	if (!db) return res.status(503).json({ error: 'Database not available' });
	const { email } = req.body || {};
	if (!email) return res.status(400).json({ error: 'Email required' });

	try {
		const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
		const windowMs = 60 * 60 * 1000; // 1 hour
		const windowStart = new Date(Date.now() - windowMs);

		// Find admin if one exists
		const admin = await db.collection('admins').findOne({ email });

		// Count recent requests by adminId (if exists) and by IP
		let adminRecent = 0;
		if (admin) {
			adminRecent = await db.collection('passwordResets').countDocuments({ adminId: admin._id, createdAt: { $gt: windowStart } });
		}
		const ipRecent = await db.collection('passwordResets').countDocuments({ requestIp: ip, createdAt: { $gt: windowStart } });

		// Limits: max 3 per email per hour, max 6 per IP per hour
		if ((admin && adminRecent >= 3) || ipRecent >= 6) {
			return res.status(429).json({ error: 'Too many password reset requests. Please try again later.' });
		}

		// Generate token and persist (even if admin not found, persist a record to track abuse by IP)
		const token = crypto.randomBytes(32).toString('hex');
		const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

		await db.collection('passwordResets').insertOne({
			token,
			adminId: admin ? admin._id : null,
			email,
			requestIp: ip,
			createdAt: new Date(),
			expiresAt
		});

		// Only send email if admin exists
		if (admin) {
			const resetUrl = `${req.protocol}://${req.get('host')}/admin-reset.html?token=${token}`;
			try {
				await transporter.sendMail({
					from: emailConfig.auth.user,
					to: email,
					subject: 'Password Reset Request',
					text: `Reset your password: ${resetUrl}\nThis link expires in 1 hour.`,
					html: `<p>Reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Link expires in 1 hour.</p>`
				});
			} catch (mailErr) {
				console.error('Failed to send reset email', mailErr);
				// don't reveal to caller; continue
			}
		}

		// Always return a generic success message
		res.json({ message: 'If an account exists, a reset link will be sent' });
	} catch (err) {
		console.error('request-reset error', err);
		res.status(500).json({ error: 'Internal server error' });
	}
});

app.post('/api/admin/reset-password', async (req, res) => {
	if (!db) return res.status(503).json({ error: 'Database not available' });
	const { token, password } = req.body || {};
	if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
	try {
		const reset = await db.collection('passwordResets').findOne({ token, expiresAt: { $gt: new Date() } });
		if (!reset || !reset.adminId) return res.status(400).json({ error: 'Invalid or expired reset token' });

		const hashed = await bcrypt.hash(password, 10);
		await db.collection('admins').updateOne({ _id: reset.adminId }, { $set: { password: hashed, updatedAt: new Date() } });
		await db.collection('passwordResets').deleteOne({ _id: reset._id });
		res.json({ message: 'Password reset successfully' });
	} catch (err) {
		console.error('reset-password error', err);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Simple admin API to manage persistent users
app.get('/api/users', (req, res) => {
	if (!isAdminReq(req)) return res.status(401).json({ error: 'Unauthorized' });
	if (!db) return res.status(503).json({ error: 'Database not available' });
	db.collection('users').find({}).sort({ createdAt: -1 }).limit(500).toArray()
		.then(users => res.json(users.map(u => ({ ...u, _id: String(u._id) }))))
		.catch(err => { console.error('GET /api/users error', err); res.status(500).json({ error: 'Failed to list users' }); });
});

// --- Admin: manage gifts and view transactions ---
app.get('/api/admin/gifts', (req, res) => {
	if (!isAdminReq(req)) return res.status(401).json({ error: 'Unauthorized' });
	if (!db) return res.json(DEFAULT_GIFTS.map(g => ({ ...g })));
	db.collection('gifts').find({}).sort({ createdAt: -1 }).toArray()
		.then(gifts => res.json(gifts.map(g => ({ key: g.key, name: g.name, price: g.price, emoji: g.emoji }))))
		.catch(err => { console.error('GET /api/admin/gifts error', err); res.status(500).json({ error: 'Failed to list gifts' }); });
});

app.post('/api/admin/gifts', async (req, res) => {
	if (!isAdminReq(req)) return res.status(401).json({ error: 'Unauthorized' });
	if (!requireAdminPin(req)) return res.status(403).json({ error: 'PIN required or invalid' });
	if (!db) return res.status(503).json({ error: 'Database not available' });
	const { key, name, price, emoji } = req.body || {};
	if (!key || !name || typeof price !== 'number') return res.status(400).json({ error: 'key, name and numeric price required' });
	try {
		await db.collection('gifts').updateOne({ key }, { $set: { key, name, price, emoji: emoji || '', updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
		res.json({ message: 'Gift saved' });
	} catch (err) {
		console.error('POST /api/admin/gifts error', err);
		res.status(500).json({ error: 'Failed to save gift' });
	}
});

app.put('/api/admin/gifts/:key', async (req, res) => {
	if (!isAdminReq(req)) return res.status(401).json({ error: 'Unauthorized' });
	if (!requireAdminPin(req)) return res.status(403).json({ error: 'PIN required or invalid' });
	if (!db) return res.status(503).json({ error: 'Database not available' });
	const k = req.params.key;
	const { name, price, emoji } = req.body || {};
	try {
		const update = { $set: { updatedAt: new Date() } };
		if (name !== undefined) update.$set.name = name;
		if (price !== undefined) update.$set.price = price;
		if (emoji !== undefined) update.$set.emoji = emoji;
		const r = await db.collection('gifts').updateOne({ key: k }, update);
		if (!r.matchedCount) return res.status(404).json({ error: 'Gift not found' });
		res.json({ message: 'Gift updated' });
	} catch (err) {
		console.error('PUT /api/admin/gifts/:key error', err);
		res.status(500).json({ error: 'Failed to update gift' });
	}
});

app.delete('/api/admin/gifts/:key', async (req, res) => {
	if (!isAdminReq(req)) return res.status(401).json({ error: 'Unauthorized' });
	if (!requireAdminPin(req)) return res.status(403).json({ error: 'PIN required or invalid' });
	if (!db) return res.status(503).json({ error: 'Database not available' });
	const k = req.params.key;
	try {
		await db.collection('gifts').deleteOne({ key: k });
		res.json({ message: 'Gift deleted' });
	} catch (err) {
		console.error('DELETE /api/admin/gifts/:key error', err);
		res.status(500).json({ error: 'Failed to delete gift' });
	}
});

app.get('/api/admin/transactions', async (req, res) => {
	const ok = await isAdminReq(req);
	if (!ok) return res.status(401).json({ error: 'Unauthorized' });
	if (!db) return res.status(503).json({ error: 'Database not available' });
	try {
		const limit = Math.min(1000, Number(req.query.limit) || 200);
		const pipeline = [
			{ $sort: { createdAt: -1 } },
			{ $limit: limit },
			{ $lookup: { from: 'users', localField: 'purchaserId', foreignField: '_id', as: 'purchaser' } },
			{ $lookup: { from: 'users', localField: 'targetUserId', foreignField: '_id', as: 'target' } },
			{ $addFields: {
				purchaserName: { $ifNull: [ { $arrayElemAt: ['$purchaser.username', 0] }, '' ] },
				targetName: { $ifNull: [ { $arrayElemAt: ['$target.username', 0] }, '' ] }
			} },
			{ $project: {
				_id: 0,
				purchaserId: { $toString: '$purchaserId' },
				purchaserName: 1,
				targetUserId: { $cond: [ { $ifNull: ['$targetUserId', false] }, { $toString: '$targetUserId' }, null ] },
				targetName: 1,
				giftKey: 1,
				price: 1,
				roomId: 1,
				createdAt: 1
			} }
		];
		const out = await db.collection('transactions').aggregate(pipeline).toArray();
		res.json(out);
	} catch (err) {
		console.error('GET /api/admin/transactions error', err);
		res.status(500).json({ error: 'Failed to list transactions' });
	}
});

// Admin: list top-ups with usernames
app.get('/api/admin/topups', async (req, res) => {
	const ok = await isAdminReq(req);
	if (!ok) return res.status(401).json({ error: 'Unauthorized' });
	if (!db) return res.status(503).json({ error: 'Database not available' });
	try {
		const limit = Math.min(1000, Number(req.query.limit) || 200);
		const pipeline = [
			{ $sort: { createdAt: -1 } },
			{ $limit: limit },
			{ $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
			{ $addFields: { username: { $ifNull: [ { $arrayElemAt: ['$user.username', 0] }, '' ] } } },
			{ $project: { _id: 0, userId: { $toString: '$userId' }, username: 1, credits: 1, amount_total: 1, currency: 1, sessionId: '$sessionId', createdAt: 1 } }
		];
		const out = await db.collection('topups').aggregate(pipeline).toArray();
		res.json(out);
	} catch (err) {
		console.error('GET /api/admin/topups error', err);
		res.status(500).json({ error: 'Failed to list topups' });
	}
});

// Admin: balances (seller and users)
app.get('/api/admin/balances', async (req, res) => {
	const ok = await isAdminReq(req);
	if (!ok) return res.status(401).json({ error: 'Unauthorized' });
	if (!db) return res.status(503).json({ error: 'Database not available' });
	try {
		const usersCol = db.collection('users');
		const seller = await usersCol.findOne({ username: SELLER_USERNAME });
		const totalUsers = await usersCol.countDocuments();
		const topUsers = await usersCol
			.find({}, { projection: { username: 1, balance: 1, lastSeen: 1, createdAt: 1 } })
			.sort({ balance: -1 })
			.limit(50)
			.toArray();
		const agg = await usersCol.aggregate([
			{ $group: { _id: null, totalBalance: { $sum: { $ifNull: ['$balance', 0] } } } }
		]).toArray();
		const sumUserBalances = (agg[0] && agg[0].totalBalance) || 0;
		res.json({
			seller: seller ? { id: String(seller._id), username: seller.username, balance: seller.balance || 0 } : null,
			totalUsers,
			sumUserBalances,
			topUsers: topUsers.map(u => ({ id: String(u._id), username: u.username, balance: u.balance || 0, lastSeen: u.lastSeen, createdAt: u.createdAt }))
		});
	} catch (err) {
		console.error('GET /api/admin/balances error', err);
		res.status(500).json({ error: 'Failed to compute balances' });
	}
});

app.get('/api/users/:id', (req, res) => {
	if (!isAdminReq(req)) return res.status(401).json({ error: 'Unauthorized' });
	if (!db) return res.status(503).json({ error: 'Database not available' });
	const id = req.params.id;
	try {
		db.collection('users').findOne({ _id: new ObjectId(id) })
			.then(user => { if (!user) return res.status(404).json({ error: 'User not found' }); user._id = String(user._id); res.json(user); })
			.catch(err => { console.error('GET /api/users/:id error', err); res.status(400).json({ error: 'Invalid id' }); });
	} catch (err) {
		console.error('GET /api/users/:id error', err);
		res.status(400).json({ error: 'Invalid id' });
	}
});

app.put('/api/users/:id', (req, res) => {
	if (!isAdminReq(req)) return res.status(401).json({ error: 'Unauthorized' });
	if (!db) return res.status(503).json({ error: 'Database not available' });
	const id = req.params.id;
	const { username } = req.body || {};
	if (!username || typeof username !== 'string') return res.status(400).json({ error: 'Invalid username' });
	try {
		db.collection('users').findOneAndUpdate(
			{ _id: new ObjectId(id) },
			{ $set: { username, lastSeen: new Date() } },
			{ returnDocument: 'after' }
		).then(result => {
			if (!result.value) return res.status(404).json({ error: 'User not found' });
			const u = result.value; u._id = String(u._id); res.json(u);
		}).catch(err => { console.error('PUT /api/users/:id error', err); res.status(400).json({ error: 'Invalid id or update failed' }); });
	} catch (err) {
		console.error('PUT /api/users/:id error', err);
		res.status(400).json({ error: 'Invalid id or update failed' });
	}
});

// MongoDB setup
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'rayd_ent';
let db = null;

async function initMongo() {
	try {
	const client = new MongoClient(MONGODB_URI);
		await client.connect();
		db = client.db(DB_NAME);
		console.log('Connected to MongoDB', MONGODB_URI, 'db:', DB_NAME);

        // Create indexes
	await db.collection('admins').createIndex({ email: 1 }, { unique: true });
	// sessions expire via TTL on expiresAt
	await db.collection('adminSessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
	// passwordResets: TTL on expiresAt; additional indexes to optimize counts and token lookup
	await db.collection('passwordResets').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
	// Optimize counting queries used for rate limiting: lookups by requestIp and adminId within a time window
	await db.collection('passwordResets').createIndex({ requestIp: 1, createdAt: 1 });
	await db.collection('passwordResets').createIndex({ adminId: 1, createdAt: 1 });
	// Optimize token lookup when consuming reset tokens
	await db.collection('passwordResets').createIndex({ token: 1, expiresAt: 1 });
        
        // Create default admin if none exists
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        const adminExists = await db.collection('admins').findOne({ email: adminEmail });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await db.collection('admins').insertOne({
                email: adminEmail,
                password: hashedPassword,
                createdAt: new Date()
            });
            console.log('Created default admin user:', adminEmail);
        }

		// Seed default gifts if collection empty
		try {
			const giftsCount = await db.collection('gifts').countDocuments();
			if (!giftsCount) {
				await db.collection('gifts').insertMany(DEFAULT_GIFTS.map(g => ({ ...g, createdAt: new Date() })));
				console.log('Seeded default gifts');
			}
		} catch (seedErr) {
			console.error('Failed to seed gifts', seedErr);
		}
	} catch (err) {
		console.error('MongoDB connection failed:', err.message);
		db = null; // fall back to in-memory behavior
	}
}

async function upsertUser({ username, userId }) {
	if (!db) return { _id: userId || null, username };
	const users = db.collection('users');
	const now = new Date();
	try {
		if (userId) {
			// try to update by provided userId
			let filter;
			try { filter = { _id: new ObjectId(userId) }; } catch (e) { filter = null; }
			if (filter) {
				const res = await users.findOneAndUpdate(filter, { $set: { username, lastSeen: now } }, { returnDocument: 'after' });
				if (res.value) return res.value;
			}
		}

		// fall back to find by username or create; give new users a default balance
		const res = await users.findOneAndUpdate(
			{ username },
			{ $set: { username, lastSeen: now }, $setOnInsert: { createdAt: now, balance: 100 } },
			{ upsert: true, returnDocument: 'after' }
		);
		// Sometimes driver may not return .value even on upsert; fall back to an explicit find
		if (res && res.value) return res.value;
		const fallback = await users.findOne({ username });
		if (fallback) return fallback;
		// As a last resort return a minimal object
		return { _id: userId || null, username };
	} catch (err) {
		console.error('upsertUser error', err);
		return { _id: userId || null, username };
	}
}

// Public API: list available gifts
app.get('/api/gifts', async (req, res) => {
	if (!db) return res.json(DEFAULT_GIFTS);
	try {
		const gifts = await db.collection('gifts').find({}).toArray();
		if (!gifts || gifts.length === 0) return res.json(DEFAULT_GIFTS);
		res.json(gifts.map(g => ({ key: g.key, name: g.name, price: g.price, emoji: g.emoji, mediaUrl: g.mediaUrl || null })));
	} catch (err) {
		console.error('GET /api/gifts error', err);
		res.json(DEFAULT_GIFTS);
	}
});

// Configure multer for in-memory uploads (Cloudinary receives buffer)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

// Admin upload endpoint: upload an MP4 (field name 'media') and create/update a gift
app.post('/api/admin/upload-gift', upload.single('media'), async (req, res) => {
	try {
		const ok = await isAdminReq(req);
		if (!ok) return res.status(401).json({ error: 'Unauthorized' });
		if (!requireAdminPin(req)) return res.status(403).json({ error: 'PIN required or invalid' });
		const { key, name, price, emoji } = req.body || {};
		if (!key || !name) return res.status(400).json({ error: 'key and name required' });
		if (!req.file) return res.status(400).json({ error: 'media file required' });
		
		// Upload to Cloudinary if configured; fallback to error if not
		if (!process.env.CLOUDINARY_URL) {
			return res.status(503).json({ error: 'CLOUDINARY_URL not configured' });
		}
		
		const uploadResult = await new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{ resource_type: 'video', folder: 'gifts', public_id: `${Date.now()}-${key}` },
				(error, result) => (error ? reject(error) : resolve(result))
			);
			uploadStream.end(req.file.buffer);
		});
		
		const mediaUrl = uploadResult.secure_url;
		if (!db) return res.status(503).json({ error: 'Database not available' });
		const p = typeof price === 'string' ? Number(price) : price;
		await db.collection('gifts').updateOne({ key }, { $set: { key, name, price: p || 0, emoji: emoji || '', mediaUrl, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
		res.json({ message: 'Uploaded and saved', mediaUrl });
	} catch (err) {
		console.error('upload-gift error', err);
		res.status(500).json({ error: 'Upload failed' });
	}
});

// Public: get minimal user info (username, balance) by id
app.get('/api/me', async (req, res) => {
	if (!db) return res.status(503).json({ error: 'Database not available' });
	const userId = req.query.userId;
	if (!userId) return res.status(400).json({ error: 'userId required' });
	try {
		const u = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { username: 1, balance: 1, createdAt: 1, lastSeen: 1 } });
		if (!u) return res.status(404).json({ error: 'User not found' });
		res.json({ id: String(u._id), username: u.username, balance: u.balance || 0, lastSeen: u.lastSeen, createdAt: u.createdAt });
	} catch (err) {
		res.status(400).json({ error: 'Invalid userId' });
	}
});

// Create Stripe Checkout Session to buy credits
// Body: { credits, userId } -> returns { url }
app.post('/api/credits/checkout', async (req, res) => {
	if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
	if (!db) return res.status(503).json({ error: 'Database not available' });
	const { credits, userId } = req.body || {};
	const qty = parseInt(credits, 10);
	if (!qty || qty <= 0) return res.status(400).json({ error: 'Positive credits required' });
	if (!userId) return res.status(400).json({ error: 'userId required' });
	let user; try { user = await db.collection('users').findOne({ _id: new ObjectId(userId) }); } catch(e){ user=null; }
	if (!user) return res.status(404).json({ error: 'User not found' });
	const unitPrice = Math.round(CREDITS_UNIT_USD * 100); // in cents
	const amount = unitPrice * qty;
	try {
		const session = await stripe.checkout.sessions.create({
			mode: 'payment',
			payment_method_types: ['card'],
			line_items: [
				{
					price_data: {
						currency: 'usd',
						product_data: { name: `${qty} Credits` },
						unit_amount: unitPrice
					},
					quantity: qty
				}
			],
			success_url: `${req.protocol}://${req.get('host')}/?checkout=success`,
			cancel_url: `${req.protocol}://${req.get('host')}/?checkout=cancel`,
			metadata: { userId: userId, credits: String(qty) }
		});
		res.json({ url: session.url });
	} catch (err) {
		console.error('Stripe checkout create error', err);
		res.status(500).json({ error: 'Failed to create checkout session' });
	}
});

// Public: return unit price for credits (USD per credit)
app.get('/api/credits/price', (req, res) => {
	res.json({ unitUsd: CREDITS_UNIT_USD });
});

// Purchase/send a gift. Body: { purchaserId, targetUserId, giftKey, roomId }
app.post('/api/purchase', async (req, res) => {
	const { purchaserId, targetUserId, giftKey, roomId } = req.body || {};
	if (!giftKey) return res.status(400).json({ error: 'giftKey required' });

	// find gift
	let gift = DEFAULT_GIFTS.find(g => g.key === giftKey);
	if (db) {
		try {
			const g = await db.collection('gifts').findOne({ key: giftKey });
			if (g) gift = g;
		} catch (err) { console.error('lookup gift error', err); }
	}

	if (!gift) return res.status(404).json({ error: 'Gift not found' });

	// helper to emit gift event to room
	const emitGift = (fromUser, toUser) => {
		const payload = {
			fromUserId: fromUser && String(fromUser._id || fromUser.userId),
			fromUsername: fromUser && fromUser.username,
			toUserId: toUser && String(toUser._id || toUser.userId),
			toUsername: toUser && toUser.username,
			gift: { key: gift.key, name: gift.name, price: gift.price, emoji: gift.emoji, mediaUrl: gift.mediaUrl || null },
			createdAt: new Date()
		};
		try {
			io.to(roomId || 'main').emit('gift', payload);
		} catch (e) { console.error('emit gift error', e); }
		return payload;
	};

	if (!db) {
		// no DB: emit and return a best-effort success
		const purchaser = { userId: purchaserId, username: req.body.purchaserName || 'Anonymous' };
		const target = { userId: targetUserId, username: req.body.targetName || null };
		const ev = emitGift(purchaser, target);
		return res.json({ success: true, balance: null, event: ev });
	}

	try {
		// resolve purchaser and target from DB
		let purchaser = null;
		try { purchaser = purchaserId ? await db.collection('users').findOne({ _id: new ObjectId(purchaserId) }) : null; } catch (e) { purchaser = null; }
		if (!purchaser) return res.status(400).json({ error: 'Purchaser not found' });

		let target = null;
		if (targetUserId) {
			try { target = await db.collection('users').findOne({ _id: new ObjectId(targetUserId) }); } catch (e) { target = null; }
		}

		// check balance
		const price = Number(gift.price || 0);
		const balance = Number(purchaser.balance || 0);
		if (balance < price) return res.status(402).json({ error: 'Insufficient balance', balance });

		// deduct and persist
		const newBalance = balance - price;
		await db.collection('users').updateOne({ _id: purchaser._id }, { $set: { balance: newBalance } });

		// credit seller account
		let sellerUser = await db.collection('users').findOne({ username: SELLER_USERNAME });
		if (!sellerUser) {
			const ins = await db.collection('users').insertOne({ username: SELLER_USERNAME, createdAt: new Date(), lastSeen: new Date(), balance: 0 });
			sellerUser = await db.collection('users').findOne({ _id: ins.insertedId });
		}
		await db.collection('users').updateOne({ _id: sellerUser._id }, { $inc: { balance: price }, $set: { lastSeen: new Date() } });

		await db.collection('transactions').insertOne({ purchaserId: purchaser._id, targetUserId: target ? target._id : null, giftKey: gift.key, price, roomId: roomId || 'main', createdAt: new Date(), sellerId: sellerUser._id });

		const ev = emitGift(purchaser, target);
		res.json({ success: true, balance: newBalance, event: ev });
	} catch (err) {
		console.error('POST /api/purchase error', err);
		res.status(500).json({ error: 'Internal server error' });
	}
});

io.on('connection', (socket) => {
	console.log('socket connected', socket.id);

	// join can accept either a string roomId or an object { roomId, username, userId }
	socket.on('join', async (payload = 'main') => {
		let roomId = 'main';
		let username = null;
		let userId = null;
		if (typeof payload === 'string') {
			roomId = payload || 'main';
		} else if (typeof payload === 'object' && payload !== null) {
			roomId = payload.roomId || 'main';
			username = payload.username || null;
			userId = payload.userId || null;
		}

		if (!username) username = `User-${socket.id.slice(0,6)}`;

			try {
				// persist user (or update) and get canonical user record
				let user = await upsertUser({ username, userId });
				if (!user) {
					console.warn('upsertUser returned null/undefined for', { username, userId });
					user = { _id: userId || null, username };
				}
				console.log('upsertUser result for socket', socket.id, user && (user._id ? String(user._id) : null), user && user.username);

				socket.data.username = (user && user.username) ? user.username : username;
				socket.data.userId = (user && user._id) ? String(user._id) : (userId || null);

				// If the socket was in a different room before, leave it first so each socket is only in one room at a time
				if (socket.data.room && socket.data.room !== roomId) {
					try {
						socket.leave(socket.data.room);
						socket.to(socket.data.room).emit('user-left', { id: socket.id, username: socket.data.username, userId: socket.data.userId });
					} catch (e) { console.warn('Error leaving previous room', e); }
				}
				socket.join(roomId);
		// get clients in room
		const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
		// send list of existing clients in room to the newly joined socket (excluding itself)
	const otherClients = clients.filter((id) => id !== socket.id).map(id => ({ id, username: io.sockets.sockets.get(id).data.username || `User-${id.slice(0,6)}`, userId: io.sockets.sockets.get(id).data.userId || null }));
		socket.emit('all-users', otherClients);
		// notify others that a new user joined with username and userId
		socket.to(roomId).emit('user-joined', { id: socket.id, username: socket.data.username, userId: socket.data.userId });
		socket.data.room = roomId;

		// acknowledge join with persistent user id
				socket.emit('joined', { userId: socket.data.userId, username: socket.data.username });

				console.log(`${socket.id} (${socket.data.username}) joined ${roomId} userId=${socket.data.userId}`);
			} catch (joinErr) {
				console.error('Error handling join for socket', socket.id, joinErr);
				// still emit a minimal joined ack so client can continue (userId may be null)
				try { socket.emit('joined', { userId: null, username }); } catch (e) {}
			}
	});

	// allow explicit leave so clients can leave the room without disconnecting
	socket.on('leave', (payload) => {
		const roomId = socket.data.room || null;
		if (!roomId) {
			socket.emit('left', { ok: true });
			return;
		}
		try {
			socket.leave(roomId);
			socket.to(roomId).emit('user-left', { id: socket.id, username: socket.data.username, userId: socket.data.userId });
			socket.data.room = null;
			socket.emit('left', { ok: true });
			console.log(`${socket.id} left ${roomId}`);
		} catch (e) {
			console.warn('Error during leave', e);
			socket.emit('left', { ok: false, error: e && e.message });
		}
	});

	socket.on('signal', (payload) => {
		const { to, from, data } = payload;
		if (!to) return;
		io.to(to).emit('signal', { from: socket.id, data });
	});

	// chat messages
	socket.on('chat message', (msg) => {
		const roomId = socket.data.room || 'main';
		io.to(roomId).emit('chat message', { from: socket.id, username: socket.data.username, userId: socket.data.userId, text: msg });
	});

	socket.on('disconnecting', () => {
		const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
		rooms.forEach(roomId => {
			socket.to(roomId).emit('user-left', { id: socket.id, username: socket.data.username, userId: socket.data.userId });
		});
	});

	socket.on('disconnect', () => {
		console.log('socket disconnected', socket.id);
	});
});

const PORT = process.env.PORT || 3000;

initMongo().then(() => {
	server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
}).catch(err => {
	console.error('Failed to initialize MongoDB, starting server without DB:', err);
	server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
});
