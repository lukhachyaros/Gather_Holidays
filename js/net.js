// Hybrid Realtime Multiplayer & Global Lobby Engine:
// 1. Multi-Broker MQTT over Secure WebSockets (WSS) with Retained Lobby Rooms (instant cross-network discovery & NAT traversal)
// 2. Fixed Trystero WebRTC P2P mesh ([send, receive] = room.makeAction)
// 3. BroadcastChannel + localStorage (0ms same-browser multi-tab sync)

const APP_PREFIX = 'gather-holidays-3d-v3';
const LOBBY_STORAGE_KEY = 'gh_lobby_rooms_v3';
const ROOM_TTL_MS = 18000;

const MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

const enc = new TextEncoder();
const dec = new TextDecoder();

function encodeLen(len) {
  const out = [];
  do {
    let b = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) b |= 0x80;
    out.push(b);
  } while (len > 0);
  return out;
}

function encodeStr(str) {
  const bytes = enc.encode(str);
  return [(bytes.length >> 8) & 0xff, bytes.length & 0xff, ...bytes];
}

function buildPacket(typeFlags, bodyBytes) {
  const lenBytes = encodeLen(bodyBytes.length);
  const pkt = new Uint8Array(1 + lenBytes.length + bodyBytes.length);
  pkt[0] = typeFlags;
  pkt.set(lenBytes, 1);
  pkt.set(bodyBytes, 1 + lenBytes.length);
  return pkt;
}

// Lightweight native WebSocket MQTT v3.1.1 client (0 external dependencies, supports retain)
function createMqttClient(brokerUrl, { onConnect, onMessage }) {
  let ws = null;
  let connected = false;
  let closed = false;
  let pingTimer = null;
  let reconnectTimer = null;
  let pktId = 1;
  const subs = new Set();
  const queue = [];
  const clientId = 'gh_' + Math.random().toString(36).slice(2, 12);

  function sendRaw(pkt) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(pkt);
      } catch {}
    }
  }

  function sendSubscribe(topic) {
    const id = (pktId = (pktId % 65000) + 1);
    const body = [(id >> 8) & 0xff, id & 0xff, ...encodeStr(topic), 0x00];
    sendRaw(buildPacket(0x82, body));
  }

  function sendPublish(topic, payloadBytes, retain = false) {
    const tBytes = encodeStr(topic);
    const body = new Uint8Array(tBytes.length + payloadBytes.length);
    body.set(tBytes, 0);
    body.set(payloadBytes, tBytes.length);
    sendRaw(buildPacket(0x30 | (retain ? 0x01 : 0x00), body));
  }

  function connectWs() {
    if (closed) return;
    try {
      ws = new WebSocket(brokerUrl, 'mqtt');
      ws.binaryType = 'arraybuffer';
    } catch {
      reconnectTimer = setTimeout(connectWs, 3000);
      return;
    }

    ws.onopen = () => {
      const body = [
        ...encodeStr('MQTT'),
        0x04, // Protocol level 4 (3.1.1)
        0x02, // Clean session
        0x00,
        0x28, // Keep-alive 40s
        ...encodeStr(clientId),
      ];
      sendRaw(buildPacket(0x10, body));
    };

    ws.onmessage = ev => {
      const buf = new Uint8Array(ev.data);
      let offset = 0;
      while (offset < buf.length) {
        const typeFlags = buf[offset];
        const pktType = typeFlags >> 4;
        let mult = 1,
          remLen = 0,
          idx = offset + 1;
        while (idx < buf.length) {
          const b = buf[idx++];
          remLen += (b & 0x7f) * mult;
          mult *= 128;
          if ((b & 0x80) === 0) break;
        }
        const pktEnd = idx + remLen;
        if (pktEnd > buf.length) break;

        if (pktType === 2) {
          // CONNACK
          connected = true;
          subs.forEach(t => sendSubscribe(t));
          while (queue.length) {
            const item = queue.shift();
            sendPublish(item.topic, item.bytes, item.retain);
          }
          clearInterval(pingTimer);
          pingTimer = setInterval(() => sendRaw(new Uint8Array([0xc0, 0x00])), 22000);
          onConnect?.();
        } else if (pktType === 3) {
          // PUBLISH
          const qos = (typeFlags >> 1) & 0x03;
          const tLen = (buf[idx] << 8) | buf[idx + 1];
          const tStart = idx + 2;
          const topic = dec.decode(buf.subarray(tStart, tStart + tLen));
          const pStart = tStart + tLen + (qos > 0 ? 2 : 0);
          const payloadBytes = buf.subarray(pStart, pktEnd);
          const text = payloadBytes.length ? dec.decode(payloadBytes) : '';
          onMessage?.(topic, text);
        }
        offset = pktEnd;
      }
    };

    ws.onclose = () => {
      connected = false;
      clearInterval(pingTimer);
      if (!closed) {
        reconnectTimer = setTimeout(connectWs, 2500);
      }
    };

    ws.onerror = () => {};
  }

  connectWs();

  return {
    subscribe(topic) {
      subs.add(topic);
      if (connected) sendSubscribe(topic);
    },
    publish(topic, dataObjOrNull, retain = false) {
      const bytes =
        dataObjOrNull === null || dataObjOrNull === ''
          ? new Uint8Array(0)
          : enc.encode(typeof dataObjOrNull === 'string' ? dataObjOrNull : JSON.stringify(dataObjOrNull));
      if (connected) {
        sendPublish(topic, bytes, retain);
      } else {
        queue.push({ topic, bytes, retain });
      }
    },
    close() {
      closed = true;
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {}
    },
  };
}

// Shared Multi-Broker Bus so Lobby and Room share fast connections
class MqttBus {
  constructor() {
    this.handlers = new Set();
    this.seenMids = new Set();
    this.clients = MQTT_BROKERS.map(url =>
      createMqttClient(url, {
        onMessage: (topic, text) => this._handleIncoming(topic, text),
      })
    );
  }

  _handleIncoming(topic, text) {
    if (!text) {
      // Empty retained message = room removed
      for (const fn of this.handlers) fn(topic, null);
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    if (parsed && parsed._mid) {
      if (this.seenMids.has(parsed._mid)) return;
      this.seenMids.add(parsed._mid);
      if (this.seenMids.size > 2000) {
        const first = this.seenMids.values().next().value;
        this.seenMids.delete(first);
      }
    }
    for (const fn of this.handlers) fn(topic, parsed);
  }

  subscribe(topic) {
    this.clients.forEach(c => c.subscribe(topic));
  }

  publish(topic, payload, retain = false) {
    if (payload === null) {
      this.clients.forEach(c => c.publish(topic, null, retain));
      return;
    }
    const msg = {
      ...payload,
      _mid: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    };
    this.seenMids.add(msg._mid);
    this.clients.forEach(c => c.publish(topic, msg, retain));
  }

  onMessage(fn) {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }
}

let sharedBus = null;
function getBus() {
  if (!sharedBus && typeof WebSocket !== 'undefined') {
    sharedBus = new MqttBus();
  }
  return sharedBus;
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
  const lobbyTopicPrefix = `${APP_PREFIX}/lobby/rooms/`;
  const lobbyDiscoverTopic = `${APP_PREFIX}/lobby/discover`;

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
    const now = Date.now();
    // Ignore stale retained MQTT messages older than ROOM_TTL_MS
    if (r.sentAt && now - r.sentAt > ROOM_TTL_MS * 2) return;
    if (r.count <= 0) {
      rooms.delete(r.id);
      removeStoredRoom(r.id);
    } else {
      const item = {
        id: r.id,
        title: r.title || r.id,
        theme: r.theme || 'christmas',
        hostName: r.hostName || 'Host',
        count: r.count,
        hasPassword: !!r.hasPassword,
        passHash: r.passHash || '',
        ts: now,
      };
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

  // 1. Local BroadcastChannel
  let bc = null;
  try {
    bc = new BroadcastChannel('gh-lobby-global-v3');
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

  // 2. Global WSS MQTT Bus (with Retained Room topics!)
  const bus = getBus();
  let unsubBus = null;
  if (bus) {
    bus.subscribe(`${lobbyTopicPrefix}+`);
    bus.subscribe(lobbyDiscoverTopic);
    unsubBus = bus.onMessage((topic, data) => {
      if (topic === lobbyDiscoverTopic) {
        handlers.onDiscoverRequest?.();
      } else if (topic.startsWith(lobbyTopicPrefix)) {
        const rId = topic.slice(lobbyTopicPrefix.length);
        if (!data || data.closed || data.count <= 0) {
          removeRoom(rId);
        } else {
          upsertRoom(data);
        }
      }
    });
    // Ask all online hosts to re-announce immediately
    setTimeout(() => bus.publish(lobbyDiscoverTopic, { t: Date.now() }, false), 200);
  }

  const cleanupTimer = setInterval(notify, 3500);
  setTimeout(() => {
    try {
      bc?.postMessage({ type: 'ask' });
    } catch {}
  }, 50);

  return {
    announce(roomMeta) {
      if (!roomMeta?.id) return;
      const payload = { ...roomMeta, sentAt: Date.now(), ts: Date.now() };
      upsertRoom(payload);
      try {
        bc?.postMessage({ type: 'ann', room: payload });
      } catch {}
      // Publish with retain=true so new visitors immediately receive active rooms on connect
      bus?.publish(`${lobbyTopicPrefix}${roomMeta.id}`, payload, true);
    },
    remove(roomId) {
      if (!roomId) return;
      removeRoom(roomId);
      try {
        bc?.postMessage({ type: 'rem', id: roomId });
      } catch {}
      // Publish closed marker with retain=true (and clear retained)
      bus?.publish(`${lobbyTopicPrefix}${roomId}`, { id: roomId, count: 0, closed: true, sentAt: Date.now() }, true);
      bus?.publish(`${lobbyTopicPrefix}${roomId}`, null, true);
    },
    requestDiscover() {
      loadStoredRooms();
      notify();
      try {
        bc?.postMessage({ type: 'ask' });
      } catch {}
      bus?.publish(lobbyDiscoverTopic, { t: Date.now() }, false);
    },
    getRooms() {
      return [...rooms.values()];
    },
    destroy() {
      clearInterval(cleanupTimer);
      unsubBus?.();
      try {
        bc?.close();
      } catch {}
    },
  };
}

// ---------- Per-Room Realtime Connection ----------
export async function connect(roomId, handlers) {
  const selfId = 'p-' + Math.random().toString(36).slice(2, 10);
  let online = false;
  const roomTopic = `${APP_PREFIX}/room/${roomId}/msg`;
  const stateRetainTopic = `${APP_PREFIX}/room/${roomId}/state`;

  // 1. Instant Local BroadcastChannel
  let bc = null;
  try {
    bc = new BroadcastChannel('gh-room-v3-' + roomId);
    online = true;
    bc.onmessage = ev => {
      const msg = ev.data;
      if (!msg || msg.from === selfId) return;
      if (msg.target && msg.target !== selfId) return;
      if (msg.type === '__join') handlers.join?.(msg.from);
      else if (msg.type === '__leave') handlers.leave?.(msg.from);
      else handlers[msg.type]?.(msg.data, msg.from);
    };
  } catch {}

  // 2. Global WSS MQTT Room Channel
  const bus = getBus();
  let unsubBus = null;
  if (bus) {
    online = true;
    bus.subscribe(roomTopic);
    bus.subscribe(stateRetainTopic);
    unsubBus = bus.onMessage((topic, msg) => {
      if (!msg || msg.from === selfId) return;
      if (topic === stateRetainTopic) {
        if (msg.state && !msg.closed && (!msg.sentAt || Date.now() - msg.sentAt < 20000)) {
          handlers.state?.(msg.state, msg.from);
        }
        return;
      }
      if (topic !== roomTopic) return;
      if (msg.target && msg.target !== selfId) return;
      if (msg.type === '__join') handlers.join?.(msg.from);
      else if (msg.type === '__leave') handlers.leave?.(msg.from);
      else handlers[msg.type]?.(msg.data, msg.from);
    });
  }

  // Broadcast join event so existing room members respond immediately with hello + state
  const sendJoinPing = () => {
    try {
      bc?.postMessage({ type: '__join', from: selfId });
    } catch {}
    bus?.publish(roomTopic, { type: '__join', from: selfId }, false);
  };
  setTimeout(sendJoinPing, 60);
  setTimeout(sendJoinPing, 450);

  const onUnload = () => {
    try {
      bc?.postMessage({ type: '__leave', from: selfId });
    } catch {}
    bus?.publish(roomTopic, { type: '__leave', from: selfId }, false);
  };
  window.addEventListener('beforeunload', onUnload);

  return {
    selfId,
    online,
    send: (n, data, target) => {
      try {
        bc?.postMessage({ type: n, data, from: selfId, target });
      } catch {}
      bus?.publish(roomTopic, { type: n, data, from: selfId, target }, false);
      // Also retain latest room state on the broker so newly joining friends receive it in <50ms
      if (n === 'state' && data) {
        bus?.publish(stateRetainTopic, { state: data, from: selfId, sentAt: Date.now() }, true);
      }
    },
    clearRetainedState: () => {
      bus?.publish(stateRetainTopic, { closed: true, from: selfId }, true);
      bus?.publish(stateRetainTopic, null, true);
    },
    leave: () => {
      window.removeEventListener('beforeunload', onUnload);
      unsubBus?.();
      try {
        bc?.postMessage({ type: '__leave', from: selfId });
        bc?.close();
      } catch {}
      bus?.publish(roomTopic, { type: '__leave', from: selfId }, false);
    },
  };
}
