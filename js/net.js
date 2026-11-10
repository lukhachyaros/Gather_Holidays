// Hybrid Multiplayer: Trystero P2P WebRTC (over internet) + BroadcastChannel (instant multi-tab sync) + Global Lobby Discovery.
const TRYSTERO_URL = 'https://cdn.jsdelivr.net/npm/trystero@0.26.0/+esm';
const APP_ID = 'gather-holidays-3d-v2';
const LOBBY_STORAGE_KEY = 'gh_lobby_rooms_v2';
const ROOM_TTL_MS = 14000;

let trysteroLibPromise = null;
function loadTrystero() {
  if (!trysteroLibPromise) {
    trysteroLibPromise = Promise.race([
      import(TRYSTERO_URL),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Trystero load timeout')), 2800)),
    ]).catch(e => {
      console.warn('WebRTC P2P fallback to local channel:', e.message || e);
      return null;
    });
  }
  return trysteroLibPromise;
}

// Simple deterministic password hash for private room verification
export function hashPass(str = '') {
  const s = String(str).trim();
  if (!s) return '';
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'h' + (h >>> 0).toString(36);
}

// ---------- Global Room Lobby Discovery ----------
export async function connectLobby(handlers = {}) {
  const rooms = new Map();

  function loadStoredRooms() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOBBY_STORAGE_KEY) || '{}');
      const now = Date.now();
      let changed = false;
      for (const [id, r] of Object.entries(raw)) {
        if (r && now - r.ts < ROOM_TTL_MS && r.count > 0) {
          rooms.set(id, r);
        } else {
          delete raw[id];
          changed = true;
        }
      }
      if (changed) localStorage.setItem(LOBBY_STORAGE_KEY, JSON.stringify(raw));
    } catch {}
  }

  function saveStoredRoom(r) {
    try {
      const raw = JSON.parse(localStorage.getItem(LOBBY_STORAGE_KEY) || '{}');
      raw[r.id] = r;
      localStorage.setItem(LOBBY_STORAGE_KEY, JSON.stringify(raw));
    } catch {}
  }

  function removeStoredRoom(id) {
    try {
      const raw = JSON.parse(localStorage.getItem(LOBBY_STORAGE_KEY) || '{}');
      delete raw[id];
      localStorage.setItem(LOBBY_STORAGE_KEY, JSON.stringify(raw));
    } catch {}
  }

  function notify() {
    const now = Date.now();
    for (const [id, r] of rooms) {
      if (now - r.ts > ROOM_TTL_MS || r.count <= 0) {
        rooms.delete(id);
        removeStoredRoom(id);
      }
    }
    handlers.onUpdate?.([...rooms.values()]);
  }

  function upsertRoom(r) {
    if (!r || !r.id) return;
    if (r.count <= 0) {
      rooms.delete(r.id);
      removeStoredRoom(r.id);
    } else {
      const item = { ...r, ts: Date.now() };
      rooms.set(r.id, item);
      saveStoredRoom(item);
    }
    notify();
  }

  function removeRoom(id) {
    if (!id) return;
    rooms.delete(id);
    removeStoredRoom(id);
    notify();
  }

  loadStoredRooms();
  notify();

  // 1. Local BroadcastChannel for instant multi-tab lobby discovery
  let bc = null;
  try {
    bc = new BroadcastChannel('gh-lobby-global-v2');
    bc.onmessage = ev => {
      const msg = ev.data;
      if (!msg) return;
      if (msg.type === 'ann') upsertRoom(msg.room);
      else if (msg.type === 'rem') removeRoom(msg.id);
      else if (msg.type === 'ask') handlers.onDiscoverRequest?.();
    };
  } catch {}

  window.addEventListener('storage', e => {
    if (e.key === LOBBY_STORAGE_KEY) {
      loadStoredRooms();
      notify();
    }
  });

  // 2. WebRTC Global Lobby via Trystero
  let lobbyRoom = null;
  let sendAnn = null,
    sendRem = null,
    sendAsk = null;

  loadTrystero().then(lib => {
    if (!lib) return;
    try {
      lobbyRoom = lib.joinRoom({ appId: APP_ID }, '__global_lobby_v2__');
      const aAnn = lobbyRoom.makeAction('ann');
      const aRem = lobbyRoom.makeAction('rem');
      const aAsk = lobbyRoom.makeAction('ask');
      aAnn.onMessage = data => upsertRoom(data);
      aRem.onMessage = data => removeRoom(data?.id);
      aAsk.onMessage = () => handlers.onDiscoverRequest?.();
      lobbyRoom.onPeerJoin = () => handlers.onDiscoverRequest?.();
      sendAnn = data => {
        try {
          aAnn.send(data);
        } catch {}
      };
      sendRem = data => {
        try {
          aRem.send(data);
        } catch {}
      };
      sendAsk = () => {
        try {
          aAsk.send({ t: Date.now() });
        } catch {}
      };
      sendAsk();
    } catch (e) {
      console.warn('Lobby WebRTC init error:', e);
    }
  });

  // Periodic cleanup & refresh
  const cleanupTimer = setInterval(notify, 3500);
  setTimeout(() => {
    try {
      bc?.postMessage({ type: 'ask' });
    } catch {}
  }, 60);

  return {
    announce(roomMeta) {
      if (!roomMeta?.id) return;
      const payload = { ...roomMeta, ts: Date.now() };
      upsertRoom(payload);
      try {
        bc?.postMessage({ type: 'ann', room: payload });
      } catch {}
      sendAnn?.(payload);
    },
    remove(roomId) {
      if (!roomId) return;
      removeRoom(roomId);
      try {
        bc?.postMessage({ type: 'rem', id: roomId });
      } catch {}
      sendRem?.({ id: roomId });
    },
    requestDiscover() {
      loadStoredRooms();
      notify();
      try {
        bc?.postMessage({ type: 'ask' });
      } catch {}
      sendAsk?.();
    },
    getRooms() {
      return [...rooms.values()];
    },
    destroy() {
      clearInterval(cleanupTimer);
      try {
        bc?.close();
      } catch {}
      try {
        lobbyRoom?.leave();
      } catch {}
    },
  };
}

// ---------- Per-Room Connection ----------
export async function connect(roomId, handlers) {
  let selfId = 'p-' + Math.random().toString(36).slice(2, 10);
  let online = false;
  const actions = {};
  const names = ['pos', 'hello', 'state', 'op', 'chat', 'emote', 'card', 'media'];

  // 1. Instant Local BroadcastChannel (syncs multiple tabs on same browser/PC with 0ms delay)
  let bc = null;
  try {
    bc = new BroadcastChannel('gh-room-' + roomId);
    online = true;
    bc.onmessage = ev => {
      const msg = ev.data;
      if (!msg || msg.from === selfId) return;
      if (msg.target && msg.target !== selfId) return;
      if (msg.type === '__join') handlers.join?.(msg.from);
      else if (msg.type === '__leave') handlers.leave?.(msg.from);
      else handlers[msg.type]?.(msg.data, msg.from);
    };
    setTimeout(() => bc?.postMessage({ type: '__join', from: selfId }), 80);
    window.addEventListener('beforeunload', () => bc?.postMessage({ type: '__leave', from: selfId }));
  } catch (e) {
    console.warn('BroadcastChannel unavailable', e);
  }

  // 2. Remote WebRTC via Trystero
  let room = null;
  const lib = await loadTrystero();
  if (lib) {
    try {
      selfId = lib.selfId || selfId;
      room = lib.joinRoom({ appId: APP_ID }, 'room-' + roomId);
      online = true;
      for (const n of names) {
        const a = room.makeAction(n);
        a.onMessage = (data, ctx) => handlers[n]?.(data, ctx.peerId);
        actions[n] = a;
      }
      room.onPeerJoin = id => handlers.join?.(id);
      room.onPeerLeave = id => handlers.leave?.(id);
    } catch (e) {
      console.warn('Room WebRTC join error:', e.message || e);
    }
  }

  return {
    selfId,
    online,
    send: (n, data, target) => {
      try {
        bc?.postMessage({ type: n, data, from: selfId, target });
      } catch {}
      try {
        actions[n]?.send(data, target ? { target } : undefined);
      } catch {}
    },
    leave: () => {
      try {
        bc?.postMessage({ type: '__leave', from: selfId });
        bc?.close();
      } catch {}
      try {
        room?.leave();
      } catch {}
    },
  };
}
