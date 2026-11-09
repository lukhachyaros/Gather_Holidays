// Serverless multiplayer via Trystero (WebRTC, signaling over public Nostr relays).
// Falls back to an offline single-player stub if the CDN/relays are unreachable.
const TRYSTERO_URL = 'https://cdn.jsdelivr.net/npm/trystero@0.26.0/+esm';
const APP_ID = 'gather-holidays-lukhachyaros';

export async function connect(roomId, handlers) {
  let lib;
  try { lib = await import(TRYSTERO_URL); }
  catch (e) { console.warn('Trystero unavailable, offline mode', e); return offline(); }

  const room = lib.joinRoom({ appId: APP_ID }, 'room-' + roomId);
  const actions = {};
  const names = ['pos', 'hello', 'state', 'op', 'chat', 'emote', 'card', 'media'];
  for (const n of names) {
    const a = room.makeAction(n);
    a.onMessage = (data, ctx) => handlers[n]?.(data, ctx.peerId);
    actions[n] = a;
  }
  room.onPeerJoin = id => handlers.join?.(id);
  room.onPeerLeave = id => handlers.leave?.(id);
  return {
    selfId: lib.selfId,
    online: true,
    send: (n, data, target) => actions[n].send(data, target ? { target } : undefined),
    leave: () => room.leave(),
  };
}

function offline() {
  return { selfId: 'local-' + Math.random().toString(36).slice(2, 8), online: false, send() {}, leave() {} };
}
