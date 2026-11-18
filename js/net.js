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
  const out = new Uint8Array(2 + bytes.length);
  out[0] = (bytes.length >> 8) & 0xff;
  out[1] = bytes.length & 0xff;
  out.set(bytes, 2);
  return out;
}

function concatBytes(...chunks) {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
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
function createMqttClient(brokerUrl, { onConnect, onMessage, onStatusChange }) {
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
    const tBytes = encodeStr(topic);
    const body = new Uint8Array(2 + tBytes.length + 1);
    body[0] = (id >> 8) & 0xff;
    body[1] = id & 0xff;
    body.set(tBytes, 2);
    body[2 + tBytes.length] = 0x00;
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
      const body = concatBytes(
        encodeStr('MQTT'),
        new Uint8Array([
          0x04, // Protocol level 4 (3.1.1)
          0x02, // Clean session
          0x00,
          0x28, // Keep-alive 40s
        ]),
        encodeStr(clientId)
      );
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
          onStatusChange?.(true);
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
      const wasConnected = connected;
      connected = false;
      clearInterval(pingTimer);
      if (wasConnected) onStatusChange?.(false);
      if (!closed) {
        reconnectTimer = setTimeout(connectWs, 2500);
      }
    };

    ws.onerror = () => {};
  }

  connectWs();

  return {
    isConnected() {
      return connected;
    },
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

// Shared Multi-Broker Bus so Lobby, Site Stats and Room share fast connections
class MqttBus {
  constructor() {
    this.handlers = new Set();
    this.statusHandlers = new Set();
    this.seenMids = new Set();
    this.clients = MQTT_BROKERS.map(url =>
      createMqttClient(url, {
        onMessage: (topic, text) => this._handleIncoming(topic, text),
        onStatusChange: () => {
          const online = this.isAnyConnected();
          for (const fn of this.statusHandlers) fn(online);
        },
      })
    );
  }

  onStatus(fn) {
    this.statusHandlers.add(fn);
    return () => this.statusHandlers.delete(fn);
  }

  isConnected() {
    return this.isAnyConnected();
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

  isAnyConnected() {
    return this.clients.some(c => c.isConnected());
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
    getConnectionStatus() {
      const isOnline = bus ? bus.isAnyConnected() : true;
      return { isOnline, roomCount: rooms.size };
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

// ---------- Global Website Visitor Counter (Live Online + Persistent Total Visits) ----------
const TOTAL_VISITS_KEY = 'gh_site_total_visits_v1';
const RECENT_VIDS_KEY = 'gh_site_recent_vids_v1';
const SESSION_VID_KEY = 'gh_vid';
const SESSION_COUNTED_KEY = 'gh_site_session_counted_v1';
const VISITOR_TTL_MS = 35000;

export function initSiteStats(onChange) {
  let selfVid = '';
  try {
    selfVid = sessionStorage.getItem(SESSION_VID_KEY) || '';
    if (!selfVid) {
      selfVid = 'v-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_VID_KEY, selfVid);
    }
  } catch {
    selfVid = 'v-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  }

  const presenceTopic = `${APP_PREFIX}/site/presence`;
  const totalTopic = `${APP_PREFIX}/site/stats/total`;
  const visitors = new Map([[selfVid, Date.now()]]);

  let totalVisits = 0;
  let recentVids = [];
  try {
    totalVisits = Math.max(0, parseInt(localStorage.getItem(TOTAL_VISITS_KEY) || '0', 10) || 0);
    const parsedRecent = JSON.parse(localStorage.getItem(RECENT_VIDS_KEY) || '[]');
    if (Array.isArray(parsedRecent)) recentVids = parsedRecent.slice(-40);
  } catch {}

  let sessionCounted = false;
  try {
    sessionCounted = sessionStorage.getItem(SESSION_COUNTED_KEY) === '1';
  } catch {}

  let countedAt = 0;
  let collisionResolved = false;
  let closed = false;
  const bus = getBus();
  let bc = null;

  function saveTotalLocal() {
    try {
      localStorage.setItem(TOTAL_VISITS_KEY, String(totalVisits));
      localStorage.setItem(RECENT_VIDS_KEY, JSON.stringify(recentVids.slice(-40)));
    } catch {}
  }

  function pruneVisitors() {
    const now = Date.now();
    visitors.set(selfVid, now);
    for (const [vid, ts] of visitors) {
      if (vid !== selfVid && now - ts > VISITOR_TTL_MS) {
        visitors.delete(vid);
      }
    }
  }

  function getStats() {
    pruneVisitors();
    const online = bus ? bus.isConnected() : false;
    return {
      onlineVisitors: Math.max(1, visitors.size),
      totalVisits: Math.max(1, totalVisits),
      brokerConnected: online,
      connected: online,
    };
  }

  let lastSig = '';
  function emitChange(force = false) {
    if (closed) return;
    const stats = getStats();
    const sig = `${stats.onlineVisitors}:${stats.totalVisits}:${stats.brokerConnected}`;
    if (force || sig !== lastSig) {
      lastSig = sig;
      onChange?.(stats);
    }
  }

  function publishTotal(byId = selfVid) {
    const payload = {
      count: totalVisits,
      recent: recentVids.slice(-40),
      by: byId,
      ts: Date.now(),
    };
    saveTotalLocal();
    try {
      bc?.postMessage({ type: 'total', ...payload });
    } catch {}
    bus?.publish(totalTopic, payload, true);
  }

  function ensureCounted() {
    if (closed || sessionCounted) return;
    sessionCounted = true;
    try {
      sessionStorage.setItem(SESSION_COUNTED_KEY, '1');
    } catch {}

    if (!recentVids.includes(selfVid)) {
      totalVisits = Math.max(totalVisits, 0) + 1;
      recentVids = [...recentVids, selfVid].slice(-40);
      countedAt = Date.now();
      publishTotal(selfVid);
    } else {
      saveTotalLocal();
    }
    emitChange(true);
  }

  function handleTotalPayload(data) {
    if (!data || typeof data.count !== 'number') return;
    const inCount = Math.max(0, Math.floor(data.count));
    const inRecent = Array.isArray(data.recent) ? data.recent : [];

    const merged = new Set([...recentVids, ...inRecent]);
    recentVids = [...merged].slice(-40);

    const prevTotal = totalVisits;
    if (inCount > totalVisits) {
      totalVisits = inCount;
    }

    if (!sessionCounted) {
      ensureCounted();
      return;
    }

    if (
      inCount === prevTotal &&
      data.by &&
      data.by !== selfVid &&
      !inRecent.includes(selfVid) &&
      !collisionResolved &&
      Date.now() - countedAt < 15000 &&
      selfVid > data.by
    ) {
      collisionResolved = true;
      totalVisits += 1;
      if (!recentVids.includes(selfVid)) {
        recentVids = [...recentVids, selfVid].slice(-40);
      }
      publishTotal(selfVid);
    } else {
      saveTotalLocal();
    }
    emitChange();
  }

  function sendPresence(type, extra = {}) {
    if (closed) return;
    const msg = { type, vid: selfVid, ...extra };
    try {
      bc?.postMessage(msg);
    } catch {}
    bus?.publish(presenceTopic, msg, false);
  }

  function handlePresenceMsg(msg) {
    if (!msg || !msg.vid || msg.vid === selfVid) return;
    if (msg.type === 'ping') {
      visitors.set(msg.vid, Date.now());
      emitChange();
    } else if (msg.type === 'ask') {
      visitors.set(msg.vid, Date.now());
      emitChange();
      const delay = 60 + Math.floor(Math.random() * 260);
      setTimeout(() => {
        if (!closed) sendPresence('ping');
      }, delay);
    } else if (msg.type === 'bye') {
      visitors.delete(msg.vid);
      emitChange();
    }
  }

  try {
    bc = new BroadcastChannel('gh-site-stats-v1');
    bc.onmessage = ev => {
      const m = ev.data;
      if (!m) return;
      if (m.type === 'total') handleTotalPayload(m);
      else handlePresenceMsg(m);
    };
  } catch {}

  const onStorage = e => {
    if (e.key === TOTAL_VISITS_KEY) {
      const v = parseInt(e.newValue || '0', 10) || 0;
      if (v > totalVisits) {
        totalVisits = v;
        emitChange();
      }
    } else if (e.key === RECENT_VIDS_KEY) {
      try {
        const arr = JSON.parse(e.newValue || '[]');
        if (Array.isArray(arr)) {
          recentVids = [...new Set([...recentVids, ...arr])].slice(-40);
        }
      } catch {}
    }
  };
  window.addEventListener('storage', onStorage);

  let unsubBus = null;
  let unsubStatus = null;
  if (bus) {
    bus.subscribe(presenceTopic);
    bus.subscribe(totalTopic);
    unsubBus = bus.onMessage((topic, data) => {
      if (topic === presenceTopic) {
        handlePresenceMsg(data);
      } else if (topic === totalTopic) {
        handleTotalPayload(data);
      }
    });
    unsubStatus = bus.onStatus(() => emitChange());
  }

  setTimeout(() => {
    if (closed) return;
    sendPresence('ask');
    sendPresence('ping');
  }, 80);

  const countFallbackTimer = setTimeout(ensureCounted, 1200);
  const heartbeatTimer = setInterval(() => sendPresence('ping'), 12000);
  const pruneTimer = setInterval(() => emitChange(), 8000);

  const onBye = () => {
    sendPresence('bye');
  };
  window.addEventListener('pagehide', onBye);
  window.addEventListener('beforeunload', onBye);

  queueMicrotask(() => emitChange(true));

  return {
    getStats,
    destroy() {
      closed = true;
      clearTimeout(countFallbackTimer);
      clearInterval(heartbeatTimer);
      clearInterval(pruneTimer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pagehide', onBye);
      window.removeEventListener('beforeunload', onBye);
      onBye();
      unsubBus?.();
      unsubStatus?.();
      try {
        bc?.close();
      } catch {}
    },
  };
}
