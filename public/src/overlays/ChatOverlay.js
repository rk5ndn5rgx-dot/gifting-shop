// Medium-style chat overlay for Baby Ray Studio.
// Ensures the chat DOM exists (so existing `script.js` can bind to the same IDs),
// provides show/hide/toggle API and a small slide-in animation.

export function initChatOverlay() {
  let chat = document.getElementById('chat');
  // If markup doesn't exist yet, create the basic structure with the expected IDs
  if (!chat) {
    chat = document.createElement('div');
    chat.id = 'chat';
    chat.className = 'overlay chat-panel hidden';
    chat.innerHTML = `
      <div id="messages"></div>
      <div class="chat-input-row">
        <input id="chatInput" placeholder="Type a message" />
        <button id="sendBtn">Send</button>
        <button id="giftsBtn">Gifts 🎁</button>
        <button id="buyCreditsBtn" title="Buy more credits">Buy Credits</button>
      </div>
    `;
    document.body.appendChild(chat);
  } else {
    // make sure classes are present
    chat.classList.add('overlay', 'chat-panel');
  }

  // helpers to show/hide the chat overlay
  function show() {
    chat.classList.remove('hidden');
    chat.classList.add('show');
  }
  function hide() {
    chat.classList.remove('show');
    chat.classList.add('hidden');
  }
  function toggle() { return chat.classList.contains('hidden') ? show() : hide(); }

  // allow Escape to hide the panel
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') hide();
  });

  // expose a small API for other modules
  window.BabyRayStudio = window.BabyRayStudio || {};
  window.BabyRayStudio.chat = { show, hide, toggle };

  // If send button exists, preserve existing behavior; script.js will bind its handler
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    // no-op: ensure button exists for script.js
  }

  console.log('Chat overlay initialized');
}
