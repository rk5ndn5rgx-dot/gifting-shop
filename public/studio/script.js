// studioDirector.js

class StudioDirector {
  constructor({ chatSource, onBabyRayAction, onAntonioAction, onStageEffect }) {
    this.chatSource = chatSource;           // e.g. Supabase subscription or WebSocket
    this.onBabyRayAction = onBabyRayAction; // function(actionName, payload)
    this.onAntonioAction = onAntonioAction; // function(actionName, payload)
    this.onStageEffect = onStageEffect;     // function(effectName, payload)
  }

  start() {
    if (!this.chatSource) return;
    this.chatSource.on('message', (msg) => this.handleMessage(msg));
  }

  handleMessage(msg) {
    const text = (msg.text || '').toLowerCase();

    // Emoji-based triggers
    if (msg.text?.includes('🔥')) {
      this.onStageEffect('heat_up', { intensity: 'high' });
      this.onBabyRayAction('bounce', { energy: 'max' });
    }

    if (msg.text?.includes('🎤')) {
      this.onAntonioAction('rap_line', { style: 'freestyle' });
    }

    if (msg.text?.includes('💛') || text.includes('ray')) {
      this.onBabyRayAction('glow', { color: 'gold' });
    }

    // Keyword-based triggers
    if (text.includes('dance')) {
      this.onBabyRayAction('dance_loop', { pattern: 'main' });
      this.onStageEffect('lights_pulse', { bpm: 120 });
    }

    if (text.includes('spin')) {
      this.onStageEffect('lights_spin', { speed: 'medium' });
    }

    if (text.includes('antonio')) {
      this.onAntonioAction('highlight', { focus: 'camera' });
    }

    if (text.includes('hype')) {
      this.onStageEffect('crowd_hype', {});
      this.onBabyRayAction('hype_move', {});
      this.onAntonioAction('hype_adlib', {});
    }
  }
}

export default StudioDirector;
// chatSource.js – simple example, replace with Supabase/WebSocket as needed

import { EventEmitter } from 'events';

const chatSource = new EventEmitter();

// Call this when a new chat message arrives from your backend
export function receiveChatMessage(message) {
  chatSource.emit('message', message);
}

export default chatSource;
// main script (e.g. script.js)

import StudioDirector from './studioDirector.js';
import chatSource, { receiveChatMessage } from './chatSource.js';

// These would be your existing animation / WebRTC hooks
function babyRayAction(action, payload) {
  switch (action) {
    case 'bounce':
      // trigger Baby Ray bounce animation
      startBabyRayBounce(payload);
      break;
    case 'dance_loop':
      startBabyRayDanceLoop(payload);
      break;
    case 'glow':
      setBabyRayGlow(payload.color);
      break;
    case 'hype_move':
      startBabyRayHypeMove();
      break;
  }
}

function antonioAction(action, payload) {
  switch (action) {
    case 'rap_line':
      triggerAntonioRap(payload.style);
      break;
    case 'highlight':
      focusCameraOnAntonio();
      break;
    case 'hype_adlib':
      triggerAntonioAdlib();
      break;
  }
}

function stageEffect(effect, payload) {
  switch (effect) {
    case 'heat_up':
      setStageColor('gold', payload.intensity);
      break;
    case 'lights_pulse':
      startLightsPulse(payload.bpm);
      break;
    case 'lights_spin':
      startLightsSpin(payload.speed);
      break;
    case 'crowd_hype':
      showCrowdHypeOverlay();
      break;
  }
}

// Create and start the director
const director = new StudioDirector({
  chatSource,
  onBabyRayAction: babyRayAction,
  onAntonioAction: antonioAction,
  onStageEffect: stageEffect,
});

director.start();

// Example: when a chat message comes from your backend
// receiveChatMessage({ text: "🔥 Baby Ray dance!" });
// supabaseChat.js
import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_KEY = 'sb_publishable_...'; // from Supabase settings

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Local event emitter used by StudioDirector
const chatSource = new EventEmitter();

export function getChatSource() {
  return chatSource;
}

// Subscribe to a Realtime broadcast channel for chat
export async function connectChatChannel(room = 'team-rap-dance') {
  const channel = supabase.channel(`chat:${room}`, {
    config: {
      broadcast: { ack: false, self: true },
    },
  });

  // Receive messages from Supabase Realtime
  channel.on('broadcast', { event: 'message' }, (payload) => {
    // payload: { text, user, ... }
    chatSource.emit('message', payload);
  });

  await channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connected to Supabase chat channel:', room);
    }
  });

  return channel;
}

// Send a chat message into Supabase Realtime
export async function sendChatMessage(channel, message) {
  await channel.send({
    type: 'broadcast',
    event: 'message',
    payload: message, // e.g. { text: "🔥 Baby Ray dance!", user: "antonio" }
  });
}
// script.js (or main entry)
import StudioDirector from './studioDirector.js';
import {
  getChatSource,
  connectChatChannel,
  sendChatMessage,
} from './supabaseChat.js';

// Your existing action handlers
function babyRayAction(action, payload) { /* ... */ }
function antonioAction(action, payload) { /* ... */ }
function stageEffect(effect, payload) { /* ... */ }

// Create director with Supabase-backed chatSource
const director = new StudioDirector({
  chatSource: getChatSource(),
  onBabyRayAction: babyRayAction,
  onAntonioAction: antonioAction,
  onStageEffect: stageEffect,
});

// Connect to Supabase and start listening
let chatChannel;

(async () => {
  chatChannel = await connectChatChannel('team-rap-dance');
  director.start();
})();

// Example: send a message from UI (e.g. chat input)
async function handleUserChatSubmit(text) {
  if (!chatChannel) return;
  await sendChatMessage(chatChannel, {
    text,
    user: 'antonio', // or current user
  });
}
