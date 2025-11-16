// Client-side WebRTC + Socket.io signaling with usernames
const socket = io();

const localVideo = document.getElementById('localVideo');
const remoteVideos = document.getElementById('remoteVideos');
const joinBtn = document.getElementById('joinBtn');
const roomInput = document.getElementById('roomId');
const usernameInput = document.getElementById('username');
const localNameLabel = document.getElementById('localName');
const messages = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const buyCreditsBtn = document.getElementById('buyCreditsBtn');
const balanceBadge = document.getElementById('balanceBadge');

// Welcome banner handler
const welcomeBanner = document.getElementById('welcomeBanner');
const getStartedBtn = document.getElementById('getStartedBtn');
if (getStartedBtn) {
	getStartedBtn.addEventListener('click', () => {
		welcomeBanner.classList.add('hidden');
		usernameInput.focus();
	});
}

let localStream = null;
const peers = {}; // peerId -> { pc, username }
let localUsername = '';
let currentRoom = null;

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// UX: disable Buy Credits until the client has a persistent userId (joined)
const userIdLabel = document.getElementById('userIdLabel');
if (buyCreditsBtn) {
	try {
		const stored = localStorage.getItem('rayd_userId');
		buyCreditsBtn.disabled = !stored;
		if (stored && balanceBadge) refreshBalance(stored);
		if (stored && userIdLabel) userIdLabel.textContent = `id: ${stored.slice(0,8)}...`;
	} catch (e) {
		// ignore localStorage errors
		buyCreditsBtn.disabled = true;
	}
}

async function startLocalStream() {
	try {
		// pick constraints based on selected quality
		const qualitySel = document.getElementById('videoQuality');
		const quality = qualitySel ? qualitySel.value : 'medium';
		const constraints = getConstraintsForQuality(quality);
		localStream = await navigator.mediaDevices.getUserMedia(constraints);
		localVideo.srcObject = localStream;
	} catch (err) {
		console.error('getUserMedia error', err);
		alert('Microphone / camera access required to join the room');
	}
}

function getConstraintsForQuality(q) {
	// returns getUserMedia constraints for low/medium/high presets
	if (q === 'low') return { video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } }, audio: true };
	if (q === 'high') return { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: true };
	// default: medium
	return { video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } }, audio: true };
}

// allow switching quality on the fly: restart local stream and replace outgoing tracks
const qualitySelect = document.getElementById('videoQuality');
if (qualitySelect) {
	qualitySelect.addEventListener('change', async () => {
		try {
			// if not started yet, nothing to do
			if (!localStream) return;
			// stop existing tracks
			localStream.getTracks().forEach(t => t.stop());
			// start new stream with selected constraints
			await startLocalStream();
			// replace video sender track in each RTCPeerConnection
			const newVideoTrack = localStream.getVideoTracks()[0];
			for (const id in peers) {
				try {
					const pc = peers[id].pc;
					const senders = pc.getSenders ? pc.getSenders() : [];
					for (const s of senders) {
						if (s.track && s.track.kind === 'video') {
							s.replaceTrack(newVideoTrack).catch(e => console.warn('replaceTrack failed', e));
						}
					}
				} catch (e) { console.warn('Error updating peer tracks', e); }
			}
			// update local video element
			if (localVideo) localVideo.srcObject = localStream;
		} catch (e) {
			console.warn('Failed to change quality', e);
		}
	});
}

function appendMessage(text, fromName) {
	const div = document.createElement('div');
	div.className = 'msg';
	if (fromName) div.textContent = `${fromName}: ${text}`;
	else div.textContent = text;
	messages.appendChild(div);
	messages.scrollTop = messages.scrollHeight;
}

joinBtn.addEventListener('click', async () => {
	// Toggle join / leave. Only one room allowed at a time.
	if (!currentRoom) {
		const roomId = (roomInput && roomInput.value) ? roomInput.value : 'main';
		// check for stored persistent userId
		const storedUserId = localStorage.getItem('rayd_userId');
		localUsername = (usernameInput.value || '').trim() || `User-${Math.random().toString(36).slice(2,8)}`;
		localNameLabel.textContent = localUsername;
		// cleanup any previous peers/UI state (if leftover)
		for (const id in peers) { try { peers[id].pc.close(); } catch (e) {} }
		Object.keys(peers).forEach(k => delete peers[k]);
		if (remoteVideos) remoteVideos.innerHTML = '';
		for (const k in roomUsers) delete roomUsers[k];
		await startLocalStream();
		socket.emit('join', { roomId, username: localUsername, userId: storedUserId });
		// optimistically set UI; will be finalized on 'joined' event
		joinBtn.textContent = 'Leave Room';
		roomInput.disabled = true;
		appendMessage('Joining room: ' + roomId);
	} else {
		// leave current room
		socket.emit('leave');
		// UI will be updated on 'left' event
		appendMessage('Leaving room: ' + currentRoom);
		joinBtn.disabled = true; // avoid duplicate clicks until server ack
	}
});

sendBtn.addEventListener('click', () => {
	const text = chatInput.value.trim();
	if (!text) return;
	socket.emit('chat message', text);
	appendMessage(text, localUsername || 'Me');
	chatInput.value = '';
});

socket.on('chat message', (msg) => {
	// msg: { from: socketId, username, text }
	appendMessage(msg.text, msg.username || msg.from);
});

// server will acknowledge join and send (possibly new) persistent userId
socket.on('joined', (info) => {
	// info: { userId, username }
	if (info && info.userId) {
		try { localStorage.setItem('rayd_userId', info.userId); } catch (e) { /* ignore */ }
        // refresh balance after server assigns/returns persistent id
        refreshBalance(info.userId);
		// enable buy button now that we have a persistent account
		if (buyCreditsBtn) buyCreditsBtn.disabled = false;
		// show userId in the balance badge title and visible label for debugging
		if (balanceBadge && info.userId) {
			balanceBadge.title = 'Your credits — userId: ' + info.userId;
			try { balanceBadge.dataset.userId = info.userId; } catch (e) {}
		}
		if (userIdLabel) userIdLabel.textContent = info.userId ? `id: ${String(info.userId).slice(0,8)}...` : '';
	}
	// mark that we are in the room the user attempted to join
	try { currentRoom = (roomInput && roomInput.value) ? roomInput.value : 'main'; } catch (e) { currentRoom = 'main'; }
	if (joinBtn) { joinBtn.textContent = 'Leave Room'; joinBtn.disabled = false; }
	if (giftsBtn) giftsBtn.disabled = false;
});

// When we join, server sends a list of existing users in the room as [{id, username}, ...]
socket.on('all-users', (users) => {
	console.log('all users in room', users);
	// track users in room (socket id -> { socketId, username, userId }) and create peers
	users.forEach((u) => {
		const uid = u.userId || null;
		roomUsers[u.id] = { socketId: u.id, username: u.username || `User-${u.id.slice(0,6)}`, userId: uid };
		createPeer(u.id, true, u.username);
	});
});

// server ack when left
socket.on('left', (info) => {
	// clear local room state, peers and remote videos
	for (const id in peers) { try { peers[id].pc.close(); } catch (e) {} }
	Object.keys(peers).forEach(k => delete peers[k]);
	// remove remote video elements and labels
	const remoteVideos = document.getElementById('remoteVideos');
	if (remoteVideos) remoteVideos.innerHTML = '';
	// clear roomUsers map
	for (const k in roomUsers) delete roomUsers[k];
	currentRoom = null;
	if (joinBtn) { joinBtn.textContent = 'Join Room'; joinBtn.disabled = false; }
	if (roomInput) roomInput.disabled = false;
	if (giftsBtn) giftsBtn.disabled = true;
	appendMessage('Left room');
});

socket.on('user-joined', (info) => {
	// info: { id, username }
	console.log('user-joined', info);
	appendMessage(`${info.username} joined the room`);
	// create a peer for the new user but do not create an offer
	roomUsers[info.id] = { socketId: info.id, username: info.username, userId: info.userId || null };
	createPeer(info.id, false, info.username);
});

socket.on('user-left', (info) => {
	// info: { id, username }
	console.log('user-left', info);
	if (!info) return;
	const id = info.id;
	if (peers[id]) {
		peers[id].pc.close();
		delete peers[id];
		const el = document.getElementById('video-' + id);
		if (el) el.remove();
	}
	delete roomUsers[id];
	appendMessage(`${info.username || id} left the room`);
});

// maintain a map of users in the current room: socketId -> {socketId, username, userId}
const roomUsers = {};

// Gift UI elements
const giftsBtn = document.getElementById('giftsBtn');
const giftModal = document.getElementById('giftModal');
const giftListEl = document.getElementById('giftList');
const userListEl = document.getElementById('userList');
const closeGiftBtn = document.getElementById('closeGift');

giftsBtn && giftsBtn.addEventListener('click', async () => {
	openGiftModal();
});

// Only allow opening gifts when in a room
if (giftsBtn) giftsBtn.disabled = true;

closeGiftBtn && closeGiftBtn.addEventListener('click', () => {
	closeGiftModal();
});

function openGiftModal() {
	if (!giftModal) return;
	giftModal.classList.add('open');
	// block main UI while modal is open
	setAppBlocked(true);
	loadGifts();
	renderUserList();
}

function closeGiftModal() {
	if (!giftModal) return;
	giftModal.classList.remove('open');
	// restore main UI controls
	setAppBlocked(false);
}

// Close modal on ESC key or clicking the backdrop (outside .gift-panel)
window.addEventListener('keydown', (ev) => {
	if (ev.key === 'Escape') {
		if (giftModal && giftModal.classList.contains('open')) {
			closeGiftModal();
		}
	}
});

if (giftModal) {
	giftModal.addEventListener('click', (ev) => {
		// if user clicked the backdrop (not the panel), close
		const panel = giftModal.querySelector('.gift-panel');
		if (!panel) return;
		if (!panel.contains(ev.target)) {
			closeGiftModal();
		}
	});
}

// Helper to disable/enable main UI controls when the modal is open (blocking behavior)
function setAppBlocked(blocked) {
	try {
		const els = [joinBtn, roomInput, usernameInput, chatInput, sendBtn, giftsBtn, buyCreditsBtn];
		els.forEach(el => { if (!el) return; el.disabled = !!blocked; });
		// when unblocking, restore giftsBtn based on whether we're in a room
		if (!blocked) {
			if (currentRoom) giftsBtn && (giftsBtn.disabled = false);
			else giftsBtn && (giftsBtn.disabled = true);
			// buyCreditsBtn depends on persistent user id
			try { const stored = localStorage.getItem('rayd_userId'); buyCreditsBtn && (buyCreditsBtn.disabled = !stored); } catch (e) {}
		}
	} catch (e) { /* defensive: ignore */ }
}

// Always show the gift modal on load and block the app until closed (user must dismiss to proceed)
window.addEventListener('load', () => {
	// slight delay so layout has stabilized
	setTimeout(() => {
		if (giftModal && !giftModal.classList.contains('open')) openGiftModal();
	}, 250);
});

async function loadGifts() {
	try {
		const res = await fetch('/api/gifts');
		const gifts = await res.json();
		renderGifts(gifts);
	} catch (err) {
		console.error('Failed to load gifts', err);
		renderGifts([]);
	}
}

function renderGifts(gifts) {
	if (!giftListEl) return;
	giftListEl.innerHTML = '';
	gifts.forEach(g => {
		const div = document.createElement('div');
		div.className = 'gift-item';
		div.innerHTML = `<button class="gift-send" data-key="${g.key}">${g.emoji} ${g.name} — ${g.price} credits</button>`;
		giftListEl.appendChild(div);
		const btn = div.querySelector('.gift-send');
		btn.addEventListener('click', async () => {
			// require a selected user
			const selected = document.querySelector('input[name="giftTarget"]:checked');
			if (!selected) { alert('Select a recipient first'); return; }
			const socketId = selected.value;
			const target = roomUsers[socketId];
			const purchaserId = localStorage.getItem('rayd_userId');
			try {
				const res = await fetch('/api/purchase', {
					method: 'POST', headers: { 'Content-Type':'application/json' },
					body: JSON.stringify({ 
						purchaserId, 
						purchaserName: localNameLabel.textContent || localUsername || 'Anonymous',
						targetUserId: target ? target.userId : null, 
						targetName: target ? target.username : null,
						giftKey: g.key, 
						roomId: currentRoom || (roomInput ? roomInput.value : 'main') 
					})
				});
				const j = await res.json();
				if (!res.ok) throw new Error(j.error || 'Purchase failed');
				appendMessage(`You sent ${g.emoji} ${g.name} to ${target ? target.username : 'the room'}`);
				// update balance if server returned it
				const uid = localStorage.getItem('rayd_userId');
				if (uid && typeof j.balance === 'number') balanceBadge && (balanceBadge.textContent = 'Balance: ' + j.balance);
				closeGiftModal();
			} catch (err) {
				alert('Gift failed: ' + err.message);
			}
		});
	});
}

function renderUserList() {
	if (!userListEl) return;
	userListEl.innerHTML = '<p>Select recipient:</p>';
	// include self first
	const selfId = socket.id;
	const selfUserId = localStorage.getItem('rayd_userId') || null;
	const selfDiv = document.createElement('div');
	selfDiv.innerHTML = `<label><input type="radio" name="giftTarget" value="${selfId}"/> (You) ${localNameLabel.textContent || 'Me'}</label>`;
	userListEl.appendChild(selfDiv);

	for (const sid in roomUsers) {
		const u = roomUsers[sid];
		// skip self duplicate
		if (sid === selfId) continue;
		const d = document.createElement('div');
		d.innerHTML = `<label><input type="radio" name="giftTarget" value="${sid}"/> ${u.username}</label>`;
		userListEl.appendChild(d);
	}
}

// show incoming gifts in chat
socket.on('gift', (ev) => {
	// ev: { fromUserId, fromUsername, toUserId, toUsername, gift }
	if (!ev || !ev.gift) return;
	const from = ev.fromUsername || ev.fromUserId || 'Someone';
	const to = ev.toUsername || ev.toUserId || 'the room';
	appendMessage(`${from} gifted ${to} ${ev.gift.emoji || ''} ${ev.gift.name}`);
	// If the gift has a media URL (mp4), show a short autoplaying muted video overlay; otherwise show emoji flash
	if (ev.gift.mediaUrl) {
		const v = document.createElement('video');
		v.className = 'gift-media';
		v.src = ev.gift.mediaUrl;
		v.autoplay = true;
		v.muted = true;
		v.loop = false;
		v.playsInline = true;
		// size is controlled via CSS (.gift-media)
		v.setAttribute('playsinline','');
		document.body.appendChild(v);
		// play (some browsers require explicit play call even if autoplay+muted)
		v.play().catch(()=>{});
		// remove after 5 seconds
		setTimeout(()=>{ try{ v.pause(); v.remove(); }catch(e){} }, 5000);
	} else {
		const m = document.createElement('div'); m.className = 'gift-notice'; m.textContent = `${ev.gift.emoji || '🎁'}`;
		document.body.appendChild(m);
		setTimeout(() => m.remove(), 2500);
	}
});

socket.on('signal', async ({ from, data }) => {
	// ensure peer exists
	if (!peers[from]) createPeer(from, false, 'Guest');
	const pc = peers[from].pc;
	if (data.type === 'offer') {
		await pc.setRemoteDescription(new RTCSessionDescription(data));
		const answer = await pc.createAnswer();
		await pc.setLocalDescription(answer);
		socket.emit('signal', { to: from, data: pc.localDescription });
	} else if (data.type === 'answer') {
		await pc.setRemoteDescription(new RTCSessionDescription(data));
	} else if (data.candidate) {
		try {
			await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
		} catch (e) {
			console.warn('Error adding ice candidate', e);
		}
	}
});

function createPeer(peerId, isInitiator, peerUsername = '') {
	if (peers[peerId]) return peers[peerId];

	const pc = new RTCPeerConnection(configuration);

	// add local tracks
	if (localStream) {
		localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
	}

	// when remote track arrives, create a video element with a label
	pc.addEventListener('track', (ev) => {
		let container = document.getElementById('video-container-' + peerId);
			if (!container) {
				container = document.createElement('div');
				container.id = 'video-container-' + peerId;
				container.className = 'video-container';
				const label = document.createElement('div');
				label.className = 'video-label';
				label.id = 'label-' + peerId;
				label.textContent = peerUsername || peerId;
				const videoEl = document.createElement('video');
				videoEl.id = 'video-' + peerId;
				videoEl.autoplay = true;
				videoEl.playsInline = true;
				videoEl.className = 'remote-video';
				container.appendChild(label);
				container.appendChild(videoEl);
				remoteVideos.appendChild(container);
			}
		const videoEl = container.querySelector('video');
		if (videoEl) videoEl.srcObject = ev.streams[0];
	});

	pc.onicecandidate = (event) => {
		if (event.candidate) {
			socket.emit('signal', { to: peerId, data: { candidate: event.candidate } });
		}
	};

	peers[peerId] = { pc, username: peerUsername };

	if (isInitiator) {
		pc.createOffer().then(offer => pc.setLocalDescription(offer))
			.then(() => {
				socket.emit('signal', { to: peerId, data: pc.localDescription });
			})
			.catch(err => console.error('offer error', err));
	}

	return peers[peerId];
}

// helper: cleanup when page unloads
window.addEventListener('beforeunload', () => {
	for (const id in peers) peers[id].pc.close();
	socket.disconnect();
});

// Position the chat panel just below the header so it doesn't overlap header items
function positionChatBelowHeader() {
	try {
		const chat = document.getElementById('chat');
		const header = document.querySelector('header');
		if (!chat || !header) return;
		const rect = header.getBoundingClientRect();
		const top = Math.ceil(rect.bottom + 12); // 12px gap
		chat.style.top = top + 'px';
		// keep the chat from overflowing the viewport: compute available height
		const available = window.innerHeight - top - 12; // bottom gap
		const minH = 120;
		const maxH = Math.max(minH, Math.floor(available));
		chat.style.height = Math.max(minH, Math.min(maxH, Math.floor(window.innerHeight * 0.7))) + 'px';
	} catch (e) {
		// defensive: ignore positioning errors
		console.warn('positionChatBelowHeader error', e);
	}
}

// adjust on load and resize; call once now in case header already rendered
window.addEventListener('load', positionChatBelowHeader);
window.addEventListener('resize', positionChatBelowHeader);
// also recalc after a short delay to handle fonts/images/layout shifts
setTimeout(positionChatBelowHeader, 250);

// Buy credits flow via Stripe Checkout
buyCreditsBtn && buyCreditsBtn.addEventListener('click', async () => {
	const storedUserId = localStorage.getItem('rayd_userId');
	if (!storedUserId) { alert('Join a room first to create your account'); return; }
	const input = prompt('How many credits would you like to buy?');
	const qty = parseInt((input || '').trim(), 10);
	if (!qty || qty <= 0) return;
	try {
		// fetch unit price from server so we can show USD total before redirect
		const priceRes = await fetch('/api/credits/price');
		let unit = 0.1; // fallback
		if (priceRes.ok) {
			const pj = await priceRes.json();
			if (pj && typeof pj.unitUsd === 'number') unit = pj.unitUsd;
		}
		const total = (unit * qty);
		// show a simple confirmation with computed USD amount
		const ok = confirm(`Buy ${qty} credits for $${total.toFixed(2)} USD (unit $${unit.toFixed(2)})?`);
		if (!ok) return;

		// show a minimal spinner overlay while creating the session
		const spinner = document.createElement('div');
		spinner.id = 'checkout-spinner';
		spinner.innerHTML = '<div class="spinner-panel"><div class="spinner"></div><div>Redirecting to secure checkout…</div></div>';
		document.body.appendChild(spinner);

		const res = await fetch('/api/credits/checkout', {
			method: 'POST', headers: { 'Content-Type':'application/json' },
			body: JSON.stringify({ userId: storedUserId, credits: qty })
		});
		const j = await res.json();
		if (!res.ok) throw new Error(j.error || 'Failed to start checkout');
		if (j.url) {
			window.location.href = j.url;
		} else throw new Error('No checkout URL');
	} catch (err) {
		// remove spinner if present
		const sp = document.getElementById('checkout-spinner'); if (sp) sp.remove();
		alert('Checkout error: ' + err.message);
	}
});

async function refreshBalance(userId) {
	if (!userId || !balanceBadge) return;
	try {
		const res = await fetch('/api/me?userId=' + encodeURIComponent(userId));
		if (!res.ok) throw new Error('Failed to load balance');
		const j = await res.json();
		balanceBadge.textContent = 'Balance: ' + (j.balance ?? 0);
	} catch (e) {
		balanceBadge.textContent = 'Balance: —';
	}
}

