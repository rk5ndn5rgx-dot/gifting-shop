import { initCamera, switchCameraMode } from './camera/CameraCore.js';
import { initChatOverlay } from './overlays/ChatOverlay.js';
import { initGiftShop } from './gifting/GiftShop.js';
import { initZodiacRing } from './council/ZodiacRing.js';
import { initEnterprisePanel } from './enterprise/EnterprisePanel.js';
import { initGhostAura } from './ghost/GhostAura.js';
import { initSceneManager } from './scenes/SceneManager.js';

// Initialize lightweight modules (they currently log readiness)
document.addEventListener('DOMContentLoaded', () => {
  initCamera();
  initChatOverlay();
  initGiftShop();
  initZodiacRing();
  initEnterprisePanel();
  initGhostAura();
  initSceneManager();

  const cameraBorder = document.getElementById('cameraBorder');
  const chatPanel = document.getElementById('chat');
  const giftsBtn = document.getElementById('giftsBtn');

  if (cameraBorder) {
    cameraBorder.addEventListener('click', (ev) => {
      // Determine click region relative to the camera border box
      const rect = cameraBorder.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const w = rect.width;
      const h = rect.height;

      const nx = x / w; // 0..1
      const ny = y / h; // 0..1

      // Regions: right side opens chat; bottom-right opens gifts; top opens council; left opens enterprise; top-left ghost; bottom center scene switch
      if (nx > 0.78 && ny > 0.62) {
        // bottom-right -> gift shop
        if (giftsBtn) giftsBtn.click();
        return;
      }
      if (nx > 0.78) {
        // right side -> toggle chat
        if (chatPanel) chatPanel.classList.toggle('hidden');
        return;
      }
      if (ny < 0.18) {
        // top -> zodiac council (placeholder: toggle a CSS class)
        document.body.classList.toggle('show-council');
        return;
      }
      if (nx < 0.18 && ny < 0.18) {
        // top-left -> ghost mode
        document.body.classList.toggle('ghost-mode');
        return;
      }
      if (ny > 0.88) {
        // bottom center -> switch scenes
        switchCameraMode('cycle');
        return;
      }
      // default: focus camera element
      const v = document.getElementById('localVideo');
      if (v && typeof v.focus === 'function') v.focus();
    });
  }

});

// Expose a small API for debugging from the console
window.BabyRayStudio = {
  switchCameraMode,
};
