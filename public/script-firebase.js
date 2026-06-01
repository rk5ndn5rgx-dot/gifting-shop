// Firebase Realtime DB based WebRTC signaling (no Socket.io needed)
import { ref, set, on, off, remove, child, get } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

const db = window.firebaseDb;

// Generate unique peer ID
const peerId = `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let localStream = null;
const peers = {}; // peerId -> { pc, username, videoElement }
let localUsername = '';
let currentRoom = null;

// DOM elements
const localVideo = document.getElementById('localVideo');
const remoteVideos = document.getElementById('remoteVideos');
const joinBtn = document.getElementById('joinBtn');
const roomInput = document.getElementById('roomId');
const usernameInput = document.getElementById('username');
const localNameLabel = document.getElementById('localName');
const messages = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const videoQuality = document.getElementById('videoQuality');

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Start local video stream
async function startLocalStream() {
	try {
		const quality = videoQuality ? videoQuality.value : 'medium';
		const constraints = getConstraintsForQuality(quality);
		localStream = await navigator.mediaDevices.getUserMedia(constraints);
		if (localVideo) localVideo.srcObject = localStream;
	} catch (err) {
		console.error('getUserMedia error', err);
		alert('Camera/microphone access required to join the room');
	}
}

function getConstraintsForQuality(q) {
	// More permissive constraints - let the browser choose best available
	if (q === 'low') return { video: { frameRate: { ideal: 15 } }, audio: true };
	if (q === 'high') return { video: { frameRate: { ideal: 30 } }, audio: true };
	return { video: { frameRate: { ideal: 24 } }, audio: true };
}

// Quality change handler
if (videoQuality) {
	videoQuality.addEventListener('change', async () => {
		if (!localStream) return;
		localStream.getTracks().forEach(t => t.stop());
		await startLocalStream();
		// Replace video track in all peer connections
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
		if (localVideo) localVideo.srcObject = localStream;
	});
}

// Create WebRTC peer connection
function createPeer(remotePeerId, initiator = false) {
	if (peers[remotePeerId]) return;
	
	const pc = new RTCPeerConnection(configuration);
	peers[remotePeerId] = { pc, username: `User-${remotePeerId.slice(0, 6)}`, videoElement: null };
	
	// Add local tracks
	if (localStream) {
		localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
	}
	
	// Handle remote stream
	pc.ontrack = (event) => {
		console.log('Received remote track:', event.track.kind);
		const videoEl = document.createElement('video');
		videoEl.id = `video-${remotePeerId}`;
		videoEl.autoplay = true;
		videoEl.playsinline = true;
		videoEl.style.width = '100%';
		videoEl.style.borderRadius = '8px';
		videoEl.style.margin = '5px';
		videoEl.srcObject = event.streams[0];
		
		if (remoteVideos) {
			const container = document.createElement('div');
			container.className = 'remote-video-container';
			container.appendChild(videoEl);
			const label = document.createElement('div');
			label.textContent = peers[remotePeerId].username;
			label.style.fontSize = '12px';
			label.style.textAlign = 'center';
			container.appendChild(label);
			remoteVideos.appendChild(container);
		}
		peers[remotePeerId].videoElement = videoEl;
	};
	
	// Handle ICE candidates
	pc.onicecandidate = (event) => {
		if (event.candidate) {
			const candidateRef = ref(db, `signaling/${currentRoom}/${peerId}/candidates/${Date.now()}`);
			set(candidateRef, {
				candidate: event.candidate.candidate,
				sdpMLineIndex: event.candidate.sdpMLineIndex,
				sdpMid: event.candidate.sdpMid,
				to: remotePeerId
			});
		}
	};
	
	// Create and send offer if initiator
	if (initiator) {
		pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
			const offerRef = ref(db, `signaling/${currentRoom}/${peerId}/offer`);
			set(offerRef, {
				type: 'offer',
				sdp: pc.localDescription.sdp,
				from: peerId,
				to: remotePeerId
			});
		}).catch(e => console.error('Offer creation failed:', e));
	}
	
	return pc;
}

// Handle incoming offers
function handleOffer(remotePeerId, offer) {
	const pc = createPeer(remotePeerId, false);
	pc.setRemoteDescription(new RTCSessionDescription(offer)).then(() => {
		return pc.createAnswer();
	}).then(answer => pc.setLocalDescription(answer)).then(() => {
		const answerRef = ref(db, `signaling/${currentRoom}/${peerId}/answer`);
		set(answerRef, {
			type: 'answer',
			sdp: pc.localDescription.sdp,
			from: peerId,
			to: remotePeerId
		});
	}).catch(e => console.error('Answer creation failed:', e));
}

// Handle incoming answers
function handleAnswer(remotePeerId, answer) {
	if (peers[remotePeerId]) {
		peers[remotePeerId].pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(e => console.error('Answer handling failed:', e));
	}
}

// Handle ICE candidates
function handleIceCandidate(remotePeerId, candidate) {
	if (peers[remotePeerId]) {
		try {
			peers[remotePeerId].pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn('ICE candidate add failed:', e));
		} catch (e) {
			console.warn('ICE parsing error:', e);
		}
	}
}

// Listen for signaling messages
function listenForSignaling() {
	const signalingRef = ref(db, `signaling/${currentRoom}`);
	on(signalingRef, (snapshot) => {
		if (!snapshot.exists()) return;
		const data = snapshot.val();
		
		for (const remotePeerId in data) {
			if (remotePeerId === peerId) continue;
			
			const peerData = data[remotePeerId];
			
			// Handle offers
			if (peerData.offer && peerData.offer.to === peerId) {
				handleOffer(remotePeerId, peerData.offer);
			}
			
			// Handle answers
			if (peerData.answer && peerData.answer.to === peerId) {
				handleAnswer(remotePeerId, peerData.answer);
			}
			
			// Handle ICE candidates
			if (peerData.candidates) {
				for (const timestamp in peerData.candidates) {
					const candidate = peerData.candidates[timestamp];
					if (candidate.to === peerId) {
						handleIceCandidate(remotePeerId, candidate);
					}
				}
			}
		}
	});
}

// Join room
joinBtn.addEventListener('click', async () => {
	if (!currentRoom) {
		const roomId = (roomInput && roomInput.value) ? roomInput.value : 'main';
		localUsername = (usernameInput.value || '').trim() || `User-${Math.random().toString(36).slice(2, 8)}`;
		localNameLabel.textContent = localUsername;
		
		// Cleanup previous state
		for (const id in peers) { try { peers[id].pc.close(); } catch (e) {} }
		Object.keys(peers).forEach(k => delete peers[k]);
		if (remoteVideos) remoteVideos.innerHTML = '';
		
		await startLocalStream();
		
		currentRoom = roomId;
		
		// Register user in room
		const userRef = ref(db, `rooms/${roomId}/${peerId}`);
		set(userRef, { username: localUsername, peerId, timestamp: Date.now() });
		
		// Listen for other users
		const usersRef = ref(db, `rooms/${roomId}`);
		on(usersRef, (snapshot) => {
			if (!snapshot.exists()) return;
			const users = snapshot.val();
			for (const uid in users) {
				if (uid !== peerId && !peers[uid]) {
					createPeer(uid, true);
					peers[uid].username = users[uid].username;
				}
			}
		});
		
		listenForSignaling();
		
		joinBtn.textContent = 'Leave Room';
		roomInput.disabled = true;
		appendMessage(`Joined room: ${roomId}`);
	} else {
		// Leave room
		const userRef = ref(db, `rooms/${currentRoom}/${peerId}`);
		remove(userRef);
		
		const signalingRef = ref(db, `signaling/${currentRoom}/${peerId}`);
		remove(signalingRef);
		
		for (const id in peers) { try { peers[id].pc.close(); } catch (e) {} }
		Object.keys(peers).forEach(k => delete peers[k]);
		if (remoteVideos) remoteVideos.innerHTML = '';
		
		currentRoom = null;
		joinBtn.textContent = 'Join Room';
		roomInput.disabled = false;
		appendMessage('Left room');
	}
});

// Chat
function appendMessage(text, fromName) {
	const div = document.createElement('div');
	div.className = 'msg';
	if (fromName) div.textContent = `${fromName}: ${text}`;
	else div.textContent = text;
	messages.appendChild(div);
	messages.scrollTop = messages.scrollHeight;
}

sendBtn.addEventListener('click', () => {
	const text = chatInput.value.trim();
	if (!text || !currentRoom) return;
	
	const msgRef = ref(db, `chats/${currentRoom}/${Date.now()}`);
	set(msgRef, { from: peerId, username: localUsername, text, timestamp: Date.now() });
	
	appendMessage(text, 'Me');
	chatInput.value = '';
});

// Listen for chat messages
function listenForChat() {
	const chatRef = ref(db, `chats/${currentRoom}`);
	on(chatRef, (snapshot) => {
		if (!snapshot.exists()) return;
		const messages = snapshot.val();
		// Messages are added via the send handler above
	});
}
