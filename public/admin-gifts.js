// Admin gifts management
async function fetchGifts() {
  const res = await fetch('/api/admin/gifts');
  if (!res.ok) throw new Error('Failed to fetch gifts');
  return res.json();
}

async function fetchTxs() {
  const res = await fetch('/api/admin/transactions');
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

async function fetchTopups() {
  const res = await fetch('/api/admin/topups');
  if (!res.ok) throw new Error('Failed to fetch topups');
  return res.json();
}

async function fetchBalances() {
  const res = await fetch('/api/admin/balances');
  if (!res.ok) throw new Error('Failed to fetch balances');
  return res.json();
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleString();
}

function renderGifts(gifts) {
  const container = document.getElementById('gifts');
  container.innerHTML = '';
  gifts.forEach(g => {
    const div = document.createElement('div');
    div.className = 'gift-item';
    div.innerHTML = `<strong>${g.emoji || ''} ${g.name}</strong> — ${g.price} credits <button data-key="${g.key}" class="edit">Edit</button> <button data-key="${g.key}" class="del">Delete</button>`;
    container.appendChild(div);
    div.querySelector('.edit').addEventListener('click', () => {
      document.getElementById('giftKey').value = g.key;
      document.getElementById('giftName').value = g.name;
      document.getElementById('giftPrice').value = g.price;
      document.getElementById('giftEmoji').value = g.emoji || '';
    });
    div.querySelector('.del').addEventListener('click', async () => {
      if (!confirm('Delete gift ' + g.name + '?')) return;
      const pin = document.getElementById('adminPin').value.trim();
      if (!pin) { alert('PIN required'); return; }
      const res = await fetch('/api/admin/gifts/' + encodeURIComponent(g.key), { method: 'DELETE', headers: { 'x-admin-pin': pin } });
      if (!res.ok) { const j = await res.json().catch(()=>({})); alert('Delete failed: ' + (j.error || res.status)); return; }
      loadGifts();
    });
  });
}

async function renderTxs() {
  try {
    const txs = await fetchTxs();
    const tbody = document.querySelector('#txTable tbody');
    tbody.innerHTML = '';
    txs.forEach(t => {
      const tr = document.createElement('tr');
      const when = document.createElement('td'); when.textContent = fmtDate(t.createdAt);
      const p = document.createElement('td'); p.textContent = t.purchaserId || '';
      const pName = document.createElement('td'); pName.textContent = t.purchaserName || '';
      const target = document.createElement('td'); target.textContent = t.targetUserId || '';
      const tName = document.createElement('td'); tName.textContent = t.targetName || '';
      const gift = document.createElement('td'); gift.textContent = t.giftKey || '';
      const price = document.createElement('td'); price.textContent = t.price || '';
      const room = document.createElement('td'); room.textContent = t.roomId || '';
      tr.appendChild(when);
      tr.appendChild(p);
      tr.appendChild(pName);
      tr.appendChild(target);
      tr.appendChild(tName);
      tr.appendChild(gift);
      tr.appendChild(price);
      tr.appendChild(room);
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('renderTxs error', err);
  }
}

function fmtAmount(amount_total, currency) {
  if (typeof amount_total !== 'number') return '';
  const d = (amount_total / 100).toFixed(2);
  return `${d} ${currency || ''}`.trim();
}

async function renderTopups() {
  try {
    const list = await fetchTopups();
    const tbody = document.querySelector('#topupsTable tbody');
    tbody.innerHTML = '';
    list.forEach(t => {
      const tr = document.createElement('tr');
      const when = document.createElement('td'); when.textContent = fmtDate(t.createdAt);
      const uid = document.createElement('td'); uid.textContent = t.userId || '';
      const uname = document.createElement('td'); uname.textContent = t.username || '';
      const credits = document.createElement('td'); credits.textContent = t.credits || '';
      const amt = document.createElement('td'); amt.textContent = fmtAmount(t.amount_total, t.currency);
      const cur = document.createElement('td'); cur.textContent = (t.currency || '').toUpperCase();
      const sess = document.createElement('td'); sess.textContent = t.sessionId || '';
      tr.appendChild(when);
      tr.appendChild(uid);
      tr.appendChild(uname);
      tr.appendChild(credits);
      tr.appendChild(amt);
      tr.appendChild(cur);
      tr.appendChild(sess);
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('renderTopups error', err);
  }
}

async function renderBalances() {
  try {
    const b = await fetchBalances();
    const el = document.getElementById('balances');
    if (!el) return;
    const sellerLine = b.seller ? `Seller (${b.seller.username}) balance: ${b.seller.balance} credits` : 'Seller not found';
    const totalUsers = `Total users: ${b.totalUsers}`;
    const sumLine = `Sum of user balances: ${b.sumUserBalances} credits`;
    // top users table
    let tableHtml = '';
    if (b.topUsers && b.topUsers.length) {
      tableHtml += '<table><thead><tr><th>UserId</th><th>Username</th><th>Balance</th><th>Last Seen</th></tr></thead><tbody>';
      b.topUsers.forEach(u => {
        tableHtml += `<tr><td>${u.id}</td><td>${u.username || ''}</td><td>${u.balance || 0}</td><td>${fmtDate(u.lastSeen)}</td></tr>`;
      });
      tableHtml += '</tbody></table>';
    }
    el.innerHTML = `<div>${sellerLine}</div><div>${totalUsers}</div><div>${sumLine}</div>${tableHtml}`;
  } catch (err) {
    console.error('renderBalances error', err);
  }
}

async function loadGifts() {
  try {
    const gifts = await fetchGifts();
    renderGifts(gifts);
  } catch (err) {
    document.getElementById('status').textContent = 'Error loading gifts: ' + err.message;
  }
}

document.getElementById('saveGift').addEventListener('click', async () => {
  const key = document.getElementById('giftKey').value.trim();
  const name = document.getElementById('giftName').value.trim();
  const price = Number(document.getElementById('giftPrice').value || 0);
  const emoji = document.getElementById('giftEmoji').value.trim();
  const pin = document.getElementById('adminPin').value.trim();
  if (!pin) { alert('PIN required'); return; }
  if (!key || !name) { alert('Key and name required'); return; }
  try {
    const res = await fetch('/api/admin/gifts', { method: 'POST', headers: { 'Content-Type':'application/json', 'x-admin-pin': pin }, body: JSON.stringify({ key, name, price, emoji, pin }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Save failed');
    document.getElementById('status').textContent = 'Saved';
    setTimeout(()=>document.getElementById('status').textContent='',2000);
    loadGifts();
    renderTxs();
  } catch (err) {
    document.getElementById('status').textContent = 'Save error: ' + err.message;
  }
});

// Upload media file and save gift entry in one request
document.getElementById('uploadGift').addEventListener('click', async () => {
  const pin = document.getElementById('adminPin').value.trim();
  if (!pin) { alert('PIN required'); return; }
  const key = document.getElementById('giftKey').value.trim();
  const name = document.getElementById('giftName').value.trim();
  const price = Number(document.getElementById('giftPrice').value || 0);
  const emoji = document.getElementById('giftEmoji').value.trim();
  const fileEl = document.getElementById('giftMedia');
  if (!fileEl || !fileEl.files || fileEl.files.length === 0) { alert('Select a media file (MP4)'); return; }
  const file = fileEl.files[0];
  const fd = new FormData();
  fd.append('media', file);
  fd.append('key', key);
  fd.append('name', name);
  fd.append('price', String(price));
  fd.append('emoji', emoji);
  try {
    const res = await fetch('/api/admin/upload-gift', { method: 'POST', body: fd, headers: { } });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Upload failed');
    document.getElementById('status').textContent = 'Uploaded and saved';
    setTimeout(()=>document.getElementById('status').textContent='',2000);
    loadGifts();
  } catch (err) {
    document.getElementById('status').textContent = 'Upload error: ' + err.message;
  }
});

async function init() {
  // preload stored PIN (session only)
  try {
    const saved = sessionStorage.getItem('adminPin');
    if (saved) {
      const pinEl = document.getElementById('adminPin');
      if (pinEl) pinEl.value = saved;
    }
    const pinEl2 = document.getElementById('adminPin');
    if (pinEl2) pinEl2.addEventListener('input', (e)=>{
      try { sessionStorage.setItem('adminPin', e.target.value || ''); } catch(_) {}
    });
  } catch (_) {}
  loadGifts();
  renderTxs();
  renderTopups();
  renderBalances();
}

init();