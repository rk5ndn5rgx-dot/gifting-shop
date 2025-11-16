// Admin UI: list users and allow editing username
async function fetchUsers() {
  const res = await fetch('/api/users');
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleString();
}

function renderUsers(users) {
  const tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '';
  users.forEach(u => {
    const tr = document.createElement('tr');
    const idTd = document.createElement('td'); idTd.textContent = u._id;
    const nameTd = document.createElement('td');
  const input = document.createElement('input'); input.value = u.username || '';
  input.classList.add('input-wide');
    nameTd.appendChild(input);
    const createdTd = document.createElement('td'); createdTd.textContent = fmtDate(u.createdAt);
    const seenTd = document.createElement('td'); seenTd.textContent = fmtDate(u.lastSeen);
    const actionTd = document.createElement('td');
    const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save'; saveBtn.className = 'btn-small';
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      try {
        const res = await fetch('/api/users/' + u._id, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ username: input.value }) });
        if (!res.ok) throw new Error('Save failed');
        const updated = await res.json();
        input.value = updated.username;
        document.getElementById('status').textContent = 'Saved ' + updated._id;
      } catch (err) {
        document.getElementById('status').textContent = 'Save error: ' + err.message;
      } finally { saveBtn.disabled = false; setTimeout(()=>document.getElementById('status').textContent='',2000); }
    });
    actionTd.appendChild(saveBtn);

    tr.appendChild(idTd);
    tr.appendChild(nameTd);
    tr.appendChild(createdTd);
    tr.appendChild(seenTd);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function init() {
  try {
    document.getElementById('status').textContent = 'Loading...';
    const users = await fetchUsers();
    renderUsers(users);
    document.getElementById('status').textContent = '';
  } catch (err) {
    document.getElementById('status').textContent = 'Error: ' + err.message;
  }
}

init();
