// Gift shop UI scaffolding for the integrated gifting engine.
// Existing server-side /api/purchase and /api/gifts endpoints will continue to power this.

export function initGiftShop() {
  // Ensure gift modal exists and expose show/hide/toggle API.
  let modal = document.getElementById('giftModal');
  let panel = modal ? modal.querySelector('.gift-panel') : null;

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'giftModal';
    modal.className = 'gift-modal';
    modal.innerHTML = `<div class="gift-panel"><h3>Send a Gift</h3><div id="giftList"></div><div id="userList"></div><div class="gift-close-row"><button id="closeGift">Close</button></div></div>`;
    document.body.appendChild(modal);
    panel = modal.querySelector('.gift-panel');
  }

  function show() {
    // prefer existing global openGiftModal if provided by legacy script
    if (typeof window.openGiftModal === 'function') return window.openGiftModal();
    modal.classList.add('open', 'bottom-right');
    if (panel) panel.classList.add('slide-up');
  }

  function hide() {
    if (typeof window.closeGiftModal === 'function') return window.closeGiftModal();
    if (panel) panel.classList.remove('slide-up');
    modal.classList.remove('open', 'bottom-right');
  }

  function toggle() { return modal.classList.contains('open') ? hide() : show(); }

  // close when clicking backdrop (but preserve existing script.js behavior if present)
  modal.addEventListener('click', (ev) => {
    if (ev.target === modal) hide();
  });

  // expose the API on the shared namespace
  window.BabyRayStudio = window.BabyRayStudio || {};
  window.BabyRayStudio.gift = { show, hide, toggle };

  // ensure existing close button id still resolves for script.js bindings
  const closeBtn = document.getElementById('closeGift');
  if (closeBtn && !closeBtn._br_bound) {
    closeBtn.addEventListener('click', hide);
    closeBtn._br_bound = true;
  }

  console.log('GiftShop overlay initialized');
}

// load gifts from server and render into the modal
export async function loadGiftsIntoModal() {
  try {
    const res = await fetch('/api/gifts');
    const gifts = await res.json();
    renderGiftsIntoModal(gifts);
  } catch (err) {
    console.error('Failed to load gifts', err);
    renderGiftsIntoModal([]);
  }
}

function renderGiftsIntoModal(gifts) {
  const giftListEl = document.getElementById('giftList');
  if (!giftListEl) return;
  giftListEl.innerHTML = '';
  gifts.forEach(g => {
    const div = document.createElement('div');
    div.className = 'gift-item';
    div.innerHTML = `<button class="gift-send" data-key="${g.key}">${g.emoji} ${g.name} — ${g.price} credits</button>`;
    giftListEl.appendChild(div);
    const btn = div.querySelector('.gift-send');
    btn.addEventListener('click', async () => {
      const selected = document.querySelector('input[name="giftTarget"]:checked');
      if (!selected) { alert('Select a recipient first'); return; }
      const socketId = selected.value;
      const roomUsers = (window.BabyRayStudio && window.BabyRayStudio.roomUsers) || {};
      const target = roomUsers[socketId];
      const purchaserId = localStorage.getItem('rayd_userId');
      try {
        const res = await fetch('/api/purchase', {
          method: 'POST', headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ 
            purchaserId, 
            purchaserName: (document.getElementById('localName') && document.getElementById('localName').textContent) || 'Anonymous',
            targetUserId: target ? target.userId : null, 
            targetName: target ? target.username : null,
            giftKey: g.key, 
            roomId: (document.getElementById('roomId') && document.getElementById('roomId').value) || 'main'
          })
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Purchase failed');
        // show message in chat if appendMessage exists
        if (typeof window.appendMessage === 'function') window.appendMessage(`You sent ${g.emoji} ${g.name} to ${target ? target.username : 'the room'}`);
        const uid = localStorage.getItem('rayd_userId');
        if (uid && typeof j.balance === 'number') {
          const badge = document.getElementById('balanceBadge'); if (badge) badge.textContent = 'Balance: ' + j.balance;
        }
        // close the modal after success
        if (window.BabyRayStudio && window.BabyRayStudio.gift && window.BabyRayStudio.gift.hide) window.BabyRayStudio.gift.hide();
      } catch (err) { alert('Gift failed: ' + (err.message || err)); }
    });
  });
}

export function renderUserListIntoModal() {
  const userListEl = document.getElementById('userList');
  if (!userListEl) return;
  userListEl.innerHTML = '<p>Select recipient:</p>';
  const selfId = (window.socket && window.socket.id) || (window.io && window.io.id) || null;
  const localName = (document.getElementById('localName') && document.getElementById('localName').textContent) || 'Me';
  const selfDiv = document.createElement('div');
  selfDiv.innerHTML = `<label><input type="radio" name="giftTarget" value="${selfId || 'self'}"/> (You) ${localName}</label>`;
  userListEl.appendChild(selfDiv);

  const roomUsers = (window.BabyRayStudio && window.BabyRayStudio.roomUsers) || {};
  for (const sid in roomUsers) {
    const u = roomUsers[sid];
    if (sid === selfId) continue;
    const d = document.createElement('div');
    d.innerHTML = `<label><input type="radio" name="giftTarget" value="${sid}"/> ${u.username}</label>`;
    userListEl.appendChild(d);
  }
}

// expose convenience names for legacy callers
window.openGiftModal = window.openGiftModal || function() { if (window.BabyRayStudio && window.BabyRayStudio.gift && window.BabyRayStudio.gift.show) window.BabyRayStudio.gift.show(); };
window.closeGiftModal = window.closeGiftModal || function() { if (window.BabyRayStudio && window.BabyRayStudio.gift && window.BabyRayStudio.gift.hide) window.BabyRayStudio.gift.hide(); };
window.loadGifts = window.loadGifts || loadGiftsIntoModal;
window.renderGifts = window.renderGifts || renderGiftsIntoModal;
window.renderUserList = window.renderUserList || renderUserListIntoModal;
