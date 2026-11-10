import * as THREE from 'three';
import {
  THEMES,
  COSTUMES,
  PUMPKIN_HATS,
  ORNAMENTS,
  CARD_STYLES,
  rollLixiReward,
} from './themes.js';
import { isSolid, buildThemeMap, validMap } from './maps.js';
import { connect, connectLobby, hashPass } from './net.js';
import {
  initPlayer,
  parseYouTube,
  apply as applyMedia,
  isVideoVisible,
  toggleVideoHidden,
  toggleMute,
  forceReloadVideo,
  bypassAdNow,
  stopMedia,
  classifyMediaInput,
  normalizeWebUrl,
} from './media.js';
import { World, TILE } from './world.js';
import { Avatar, loadCharacter, EMOTE_CLIP, hueFor } from './avatar.js';
import { emojiSprite } from './props.js';

const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, t) => {
  const d = (((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
};
const toast = msg => {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 3000);
};

// Movement & Physics constants
const WALK = 2.5,
  RUN = 4.3,
  JUMP_V = 7.2,
  GRAVITY = 20,
  RADIUS = 0.28;
const ACTION_COOLDOWN = 3000; // 3 seconds anti-spam cooldown for all actions/emotes

// ---------- Official Public Plazas (Always visible in Lobby so players gather together) ----------
const OFFICIAL_ROOMS = [
  { id: 'quang-truong-noel', title: 'Quảng Trường Giáng Sinh', theme: 'christmas', official: true },
  { id: 'lau-dai-halloween', title: 'Lâu Đài Halloween', theme: 'halloween', official: true },
  { id: 'pho-hoa-ngay-tet', title: 'Phố Hoa Ngày Tết', theme: 'tet', official: true },
];
const THEME_ICON = { christmas: '🎄', halloween: '🎃', tet: '🧧' };

// ---------- State ----------
let net,
  lobby,
  me,
  state,
  roomName = '',
  roomTitle = '',
  gotState = false,
  isKicked = false,
  loopRunning = false,
  verifiedPassHash = '',
  pendingRoomTarget = null,
  activeLobbyFilter = 'all';
const peers = new Map(); // id -> {name, hue, x, y, tx, ty, r, tr, a, h, costume, pumpkinHat, heldItem, seatId, lean, av}
const floaters = [];
let inbox = JSON.parse(localStorage.getItem('gh_inbox') || '[]');
let mode = 'tps'; // 'tps' | 'fps'
let yaw = 0,
  pitch = -0.25;
const keys = new Set();
let cooldownUntil = 0;
let activeTarget = null; // nearest hotspot / seat / peer for [E] prompt
let lastCoupleHeart = 0;
let nextVampireScareAt = performance.now() + 14000;

// Mouse Sensitivity & Pointer Lock Mode
let mouseSens = parseFloat(localStorage.getItem('gh_sens') || '1.0');
if (Number.isNaN(mouseSens) || mouseSens < 0.2 || mouseSens > 3.0) mouseSens = 1.0;
let lockMode = localStorage.getItem('gh_lock_mode') || 'click';

const isHost = () => !!(state && net && state.hostId === net.selfId);

// FPS Counter state
let frameCount = 0,
  fpsLastTime = performance.now(),
  currentFps = 60;

// ---------- Three.js Setup ----------
let renderer, scene, camera, world;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1, 0.1, 300);
  world = new World(scene);
} catch (e) {
  console.error(e);
  document.addEventListener('DOMContentLoaded', () => toast('Trình duyệt không hỗ trợ WebGL'));
}
function resize() {
  if (!renderer) return;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- Cooldown Helper (3s Anti-Spam) ----------
function checkCooldown() {
  const now = performance.now();
  if (now < cooldownUntil) {
    const rem = ((cooldownUntil - now) / 1000).toFixed(1);
    toast(`⏳ Vui lòng chờ ${rem}s trước khi thực hiện hành động tiếp theo!`);
    return false;
  }
  cooldownUntil = now + ACTION_COOLDOWN;
  return true;
}

// ---------- Landing & Select Menus ----------
for (const [k, t] of Object.entries(THEMES)) {
  for (const selId of ['inTheme', 'topTheme']) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = t.name;
    $(selId).appendChild(o);
  }
}
for (const [k, s] of Object.entries(CARD_STYLES)) {
  const o = document.createElement('option');
  o.value = k;
  o.textContent = s.name;
  $('cardStyle').appendChild(o);
}

// Populate Ornament Grid (Christmas) & Costume Grid (Halloween)
function buildStaticGrids() {
  const og = $('ornamentGrid');
  og.innerHTML = '';
  ORNAMENTS.forEach(orn => {
    const b = document.createElement('button');
    b.textContent = orn.name;
    b.onclick = () => {
      if (!checkCooldown()) return;
      me.heldItem = orn.key;
      me.av?.setHeldItem(orn.key);
      me.av?.playEmote('interact');
      updateStatusBadges();
      syncMyAppearance();
      $('dlgOrnament').classList.add('hidden');
      toast(`🎁 Đã nhặt ${orn.name}! Hãy lại gần Cây Thông Lớn và nhấn [E] để treo lên cây.`);
    };
    og.appendChild(b);
  });

  const cg = $('costumeGrid');
  cg.innerHTML = '';
  for (const [k, cfg] of Object.entries(COSTUMES)) {
    const b = document.createElement('button');
    b.textContent = cfg.name;
    b.dataset.costume = k;
    b.onclick = () => {
      if (!checkCooldown()) return;
      equipCostume(k);
      $('dlgCostume').classList.add('hidden');
    };
    cg.appendChild(b);
  }
}
buildStaticGrids();

// ---------- Lobby & Room Browser System ----------
function slugifyRoom(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

$('inName').value = localStorage.getItem('gh_name') || '';
$('inName').addEventListener('change', () => {
  const n = $('inName').value.trim();
  if (n) {
    localStorage.setItem('gh_name', n);
    if (me) {
      me.name = n;
      syncMyAppearance();
      if (isHost() && state) {
        state.hostName = n;
        broadcastMyRoomToLobby();
      }
    }
  }
});

let manualRoomIdEdited = false;
$('inRoom').addEventListener('input', () => {
  manualRoomIdEdited = !!$('inRoom').value.trim();
});
$('inRoomTitle').addEventListener('input', e => {
  if (!manualRoomIdEdited) {
    $('inRoom').value = slugifyRoom(e.target.value);
  }
});

// Filter chips in Lobby
document.querySelectorAll('.filter-chip').forEach(btn => {
  btn.onclick = () => {
    activeLobbyFilter = btn.dataset.filter || 'all';
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.toggle('active', b === btn));
    renderLobbyRooms();
  };
});

$('btnRefreshLobby').onclick = () => {
  lobby?.requestDiscover();
  renderLobbyRooms();
  toast('🔄 Đã làm mới danh sách phòng trực tuyến!');
};

$('btnCloseLobby').onclick = () => {
  if (me?.started && !isKicked) $('landing').classList.add('hidden');
};

let invitedRoomId = '';

function broadcastMyRoomToLobby() {
  if (!lobby || !state || !me?.started || isKicked || !roomName) return;
  const off = OFFICIAL_ROOMS.find(o => o.id === roomName);
  lobby.announce({
    id: roomName,
    title: state.roomTitle || off?.title || roomTitle || roomName,
    theme: state.theme || 'christmas',
    hostName: state.hostName || me.name,
    count: 1 + peers.size,
    hasPassword: !!state.passHash,
    passHash: state.passHash || '',
  });
  if (isHost()) {
    net?.send('state', state);
  }
}

// Periodically announce active room to Lobby so new visitors see live player counts
setInterval(() => {
  if (me?.started && state && !isKicked) broadcastMyRoomToLobby();
}, 3500);

window.addEventListener('beforeunload', () => {
  if (lobby && roomName && peers.size === 0) {
    net?.clearRetainedState?.();
    lobby.remove(roomName);
  }
});

function updateInviteBanner(liveMap) {
  const banner = $('inviteBanner');
  if (!banner) return;
  if (!invitedRoomId || (me?.started && roomName === invitedRoomId)) {
    banner.classList.add('hidden');
    return;
  }
  const live = liveMap?.get(invitedRoomId);
  const off = OFFICIAL_ROOMS.find(o => o.id === invitedRoomId);
  const displayTitle = live?.title || off?.title || `#${invitedRoomId}`;
  $('inviteRoomName').textContent = `${displayTitle} (#${invitedRoomId})`;
  $('inviteRoomSub').textContent = live
    ? `🟢 Phòng đang mở · 👥 ${live.count} người đang chơi · 👑 Chủ phòng: ${live.hostName || 'Host'}`
    : `Nhấn nút bên phải để tham gia vào phòng #${invitedRoomId} cùng bạn bè!`;
  banner.classList.remove('hidden');

  $('btnJoinInvite').onclick = () => {
    if (live?.hasPassword) {
      promptRoomPassword(live);
    } else {
      joinRoomConfig({
        id: invitedRoomId,
        title: live?.title || off?.title || invitedRoomId,
        theme: live?.theme || off?.theme || 'christmas',
        passHash: '',
      });
    }
  };
}

function renderLobbyRooms() {
  const box = $('lobbyRoomList');
  if (!box) return;
  const liveRooms = lobby ? lobby.getRooms() : [];
  const liveMap = new Map(liveRooms.map(r => [r.id, r]));

  updateInviteBanner(liveMap);

  // Merge Official Public Plazas with live active rooms
  const combined = [];
  for (const off of OFFICIAL_ROOMS) {
    const live = liveMap.get(off.id);
    if (live) {
      combined.push({
        ...live,
        title: live.title || off.title,
        official: true,
      });
      liveMap.delete(off.id);
    } else {
      combined.push({
        id: off.id,
        title: off.title,
        theme: off.theme,
        hostName: 'Sảnh chung',
        count: 0,
        hasPassword: false,
        passHash: '',
        official: true,
      });
    }
  }

  for (const r of liveMap.values()) {
    if (r.count > 0) combined.push(r);
  }

  // If the user opened an invite link (#room=...) that isn't in combined yet, pin it at the top
  if (invitedRoomId && !combined.some(r => r.id === invitedRoomId)) {
    combined.unshift({
      id: invitedRoomId,
      title: invitedRoomId,
      theme: 'christmas',
      hostName: 'Link mời',
      count: 0,
      hasPassword: false,
      passHash: '',
      invited: true,
    });
  }

  // Sort: invited room first, then rooms with active players, then official rooms
  combined.sort((a, b) => {
    if (a.id === invitedRoomId && b.id !== invitedRoomId) return -1;
    if (b.id === invitedRoomId && a.id !== invitedRoomId) return 1;
    if ((b.count > 0) !== (a.count > 0)) return b.count - a.count;
    if (!!b.official !== !!a.official) return a.official ? -1 : 1;
    return b.count - a.count;
  });

  const filtered = combined.filter(r => activeLobbyFilter === 'all' || r.theme === activeLobbyFilter);
  box.innerHTML = '';

  if (!filtered.length) {
    box.innerHTML = '<div class="hint" style="padding:18px;text-align:center">Chưa có phòng nào thuộc chủ đề này. Bạn hãy tạo phòng mới ở cột bên phải nhé!</div>';
    return;
  }

  filtered.forEach(r => {
    const isCurrent = me?.started && !isKicked && r.id === roomName;
    const isInvited = r.id === invitedRoomId;
    const card = document.createElement('div');
    card.className = 'room-card' + (isCurrent || isInvited ? ' current-room' : '');

    const icon = THEME_ICON[r.theme] || '🎄';
    const tagHtml = isInvited
      ? '<span class="room-tag public">🎯 Phòng được mời</span>'
      : r.official
      ? '<span class="room-tag official">🌟 Sảnh Chung</span>'
      : r.hasPassword
      ? '<span class="room-tag private">🔒 Riêng tư</span>'
      : '<span class="room-tag public">🌐 Công khai</span>';

    const subHtml =
      r.count > 0
        ? `<span class="active-count">👥 ${r.count} đang chơi</span> · <span>👑 ${r.hostName || 'Host'}</span> · <span>#${r.id}</span>`
        : `<span>👥 Sẵn sàng vào phòng</span> · <span>#${r.id}</span>`;

    const left = document.createElement('div');
    left.className = 'room-card-left';
    left.innerHTML = `
      <div class="room-theme-icon">${icon}</div>
      <div class="room-meta">
        <div class="room-title-row">
          <span class="room-title">${r.title || r.id}</span>
          ${tagHtml}
        </div>
        <div class="room-sub">${subHtml}</div>
      </div>
    `;
    card.appendChild(left);

    const btn = document.createElement('button');
    btn.className = 'room-join-btn ' + (isCurrent ? 'info' : r.hasPassword ? 'warn' : 'primary');
    btn.textContent = isCurrent ? 'Đang ở đây' : r.hasPassword ? '🔒 Nhập mật khẩu' : 'Tham gia →';
    btn.onclick = () => {
      if (isCurrent) {
        $('landing').classList.add('hidden');
        return;
      }
      if (r.hasPassword) {
        promptRoomPassword(r);
      } else {
        joinRoomConfig({
          id: r.id,
          title: r.title || r.id,
          theme: r.theme || 'christmas',
          passHash: '',
        });
      }
    };
    card.appendChild(btn);
    box.appendChild(card);
  });
}

function promptRoomPassword(roomObj, onVerifiedCallback = null) {
  pendingRoomTarget = { roomObj, onVerifiedCallback };
  $('passRoomLabel').textContent = `Phòng "${roomObj.title || roomObj.id}" yêu cầu mật khẩu để tham gia.`;
  $('joinPassInput').value = '';
  $('joinPassErr').classList.add('hidden');
  openDialog('dlgRoomPass');
  setTimeout(() => $('joinPassInput').focus(), 50);
}

$('btnConfirmPass').onclick = () => {
  if (!pendingRoomTarget) return;
  const { roomObj, onVerifiedCallback } = pendingRoomTarget;
  const enteredHash = hashPass($('joinPassInput').value);
  if (roomObj.passHash && enteredHash !== roomObj.passHash) {
    $('joinPassErr').classList.remove('hidden');
    return;
  }
  verifiedPassHash = enteredHash;
  $('dlgRoomPass').classList.add('hidden');
  pendingRoomTarget = null;
  if (onVerifiedCallback) {
    onVerifiedCallback();
  } else {
    joinRoomConfig({
      id: roomObj.id,
      title: roomObj.title || roomObj.id,
      theme: roomObj.theme || 'christmas',
      passHash: enteredHash,
    });
  }
};

$('joinPassInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('btnConfirmPass').click();
});

$('btnCancelPass').onclick = () => {
  $('dlgRoomPass').classList.add('hidden');
  const hadCallback = !!pendingRoomTarget?.onVerifiedCallback;
  pendingRoomTarget = null;
  if (hadCallback) {
    leaveCurrentRoom();
    $('landing').classList.remove('hidden');
  }
};

// Create New Room button in right column of Lobby
$('btnJoin').onclick = () => {
  const rawTitle = $('inRoomTitle').value.trim();
  const rawId = slugifyRoom($('inRoom').value.trim() || rawTitle || 'phong-' + Math.floor(Math.random() * 900 + 100));
  const title = rawTitle || rawId;
  const theme = $('inTheme').value || 'christmas';
  const rawPass = $('inRoomPass').value.trim();
  const pHash = rawPass ? hashPass(rawPass) : '';
  verifiedPassHash = pHash;
  joinRoomConfig({ id: rawId, title, theme, passHash: pHash });
};

function leaveCurrentRoom() {
  if (!net) return;
  const oldRoom = roomName;
  const wasAlone = peers.size === 0;
  if (wasAlone) {
    try {
      net.clearRetainedState?.();
    } catch {}
  }
  try {
    net.leave();
  } catch {}
  net = null;
  peers.forEach(p => {
    if (p.av) scene.remove(p.av.root);
  });
  peers.clear();
  if (me?.av) {
    scene.remove(me.av.root);
    me.av = null;
  }
  if (me) me.started = false;
  state = null;
  gotState = false;
  // Stop the shared TV (YouTube / web) so nothing keeps playing after leaving, closing or being kicked from a room
  stopMedia();
  if (wasAlone && oldRoom) lobby?.remove(oldRoom);
}

let joinTimer = null;
async function joinRoomConfig({ id, title, theme, passHash }) {
  const name = $('inName').value.trim() || 'Bạn Mới ' + Math.floor(Math.random() * 900 + 100);
  $('inName').value = name;
  localStorage.setItem('gh_name', name);

  if (net) leaveCurrentRoom();
  clearTimeout(joinTimer);

  roomName = id;
  invitedRoomId = '';
  const off = OFFICIAL_ROOMS.find(o => o.id === roomName);
  roomTitle = title || off?.title || roomName;
  const selectedTheme = off?.theme || theme || 'christmas';
  isKicked = false;
  gotState = false;

  location.hash = 'room=' + roomName;
  $('landing').classList.add('hidden');
  $('dlgKicked').classList.add('hidden');
  $('btnCloseLobby').classList.remove('hidden');

  me = {
    name,
    hue: hueFor(name),
    x: 14.5,
    y: 18.5,
    r: Math.PI,
    h: 0,
    vy: 0,
    loco: 'idle',
    costume: 'default',
    pumpkinHat: null,
    heldItem: null,
    seatSlot: null,
  };

  net = await connect(roomName, handlers);
  $('roomInfo').textContent = `📍 ${roomTitle}`;
  updateLiveStats();

  initPlayer('yt', onMediaEnded);

  // Wait briefly for existing room state from peers/MQTT; otherwise initialize fresh room state as Host
  joinTimer = setTimeout(() => {
    if (gotState || isKicked || !net) return;
    const now = Date.now();
    state = {
      createdAt: now,
      v: now,
      roomTitle,
      passHash: passHash || '',
      hostId: net.selfId,
      hostName: me.name,
      kickedIds: [],
      theme: selectedTheme,
      map: buildThemeMap(selectedTheme),
      decor: [],
      cards: [],
      treeOrnaments: [
        { id: 'init1', key: 'ball_red', by: 'Santa' },
        { id: 'init2', key: 'star', by: 'Santa' },
        { id: 'init3', key: 'bell', by: 'Santa' },
      ],
      stockingCards: [
        {
          id: 'welcome_card',
          from: 'Ông Già Noel 🎅',
          text: 'Chúc mọi người một mùa lễ hội tràn ngập niềm vui và ấm áp bên nhau!',
          style: 'christmas',
        },
      ],
      mediaCurrent: null,
      mediaQueue: [],
    };
    toast(`👑 Bạn đã mở phòng "${roomTitle}"${passHash ? ' (🔒 Có mật khẩu)' : ''}!`);
    start();
  }, 950);
}

// Initialize Lobby Discovery & Check URL hash for direct room link
(async function initAppLobby() {
  const urlRoom = slugifyRoom(new URLSearchParams(location.hash.slice(1)).get('room') || '');
  if (urlRoom) {
    invitedRoomId = urlRoom;
  }

  lobby = await connectLobby({
    onUpdate: () => renderLobbyRooms(),
    onDiscoverRequest: () => broadcastMyRoomToLobby(),
  });
  renderLobbyRooms();
})();

window.addEventListener('hashchange', () => {
  const urlRoom = slugifyRoom(new URLSearchParams(location.hash.slice(1)).get('room') || '');
  if (urlRoom && urlRoom !== roomName) {
    invitedRoomId = urlRoom;
    openLobbyOverlay();
  }
});

async function start() {
  if (!me || me.started || isKicked || !state) return;

  // If this room has a password and the player hasn't verified it yet (e.g. joined via direct link)
  if (state.passHash && state.hostId !== net.selfId && verifiedPassHash !== state.passHash) {
    promptRoomPassword(
      { id: roomName, title: state.roomTitle || roomName, passHash: state.passHash },
      () => start()
    );
    return;
  }

  me.started = true;
  await loadCharacter();
  const sp = state.map.spawn || [14.5, 18.5];
  me.x = sp[0] + (Math.random() - 0.5) * 1.6;
  me.y = sp[1] + (Math.random() - 0.5) * 0.6;
  me.av = new Avatar(null, {
    name: me.name,
    hue: me.hue,
    costume: me.costume,
    pumpkinHat: me.pumpkinHat,
  });
  me.av.label.visible = false;
  scene.add(me.av.root);

  $('topTheme').value = state.theme;
  net.send('hello', pubInfo());
  applyMedia(state.mediaCurrent);
  updateHud();
  updateHostUI();
  updateStatusBadges();
  updateMediaDialog();
  updateLiveStats();
  broadcastMyRoomToLobby();

  if (!loopRunning) {
    loopRunning = true;
    requestAnimationFrame(loop);
  }
}

const pubInfo = () => ({
  name: me.name,
  hue: me.hue,
  x: me.x,
  y: me.y,
  r: me.r,
  costume: me.costume,
  pumpkinHat: me.pumpkinHat,
  heldItem: me.heldItem,
  seatId: me.seatSlot?.id || null,
});

function syncMyAppearance() {
  if (me?.started && !isKicked) net.send('hello', pubInfo());
}

function openLobbyOverlay() {
  document.exitPointerLock?.();
  lobby?.requestDiscover();
  renderLobbyRooms();
  $('btnCloseLobby').classList.toggle('hidden', !(me?.started && !isKicked));
  $('landing').classList.remove('hidden');
}

function handleSelfKicked(hostName) {
  if (isKicked) return;
  isKicked = true;
  loopRunning = false;
  document.exitPointerLock?.();
  const closedTitle = roomTitle || roomName;
  leaveCurrentRoom();
  if ($('kickedTitle')) $('kickedTitle').textContent = '🚫 Bạn đã bị mời ra khỏi phòng';
  $('kickedMsg').textContent = `Chủ phòng ${hostName ? `(${hostName}) ` : ''}đã mời bạn rời khỏi phòng "${closedTitle}".`;
  openDialog('dlgKicked');
}

function handleRoomClosed(hostName) {
  if (isKicked) return;
  isKicked = true;
  loopRunning = false;
  document.exitPointerLock?.();
  const closedRoomId = roomName;
  const closedTitle = roomTitle || roomName;
  leaveCurrentRoom();
  if (closedRoomId) lobby?.remove(closedRoomId);
  if ($('kickedTitle')) $('kickedTitle').textContent = '🛑 Phòng đã được đóng';
  $('kickedMsg').textContent = `Chủ phòng ${hostName ? `(${hostName}) ` : ''}đã đóng và giải tán phòng "${closedTitle}".`;
  openDialog('dlgKicked');
}

function closeRoomByHost() {
  if (!isHost()) return toast('⚠️ Chỉ Chủ phòng mới có quyền đóng phòng!');
  const closingId = roomName;
  const closingTitle = state?.roomTitle || roomTitle || roomName;
  try {
    net?.clearRetainedState?.();
    net?.send('op', {
      k: 'closeRoom',
      byHost: net.selfId,
      hostName: me?.name || 'Chủ phòng',
      v: Date.now(),
    });
  } catch {}
  isKicked = true;
  loopRunning = false;
  leaveCurrentRoom();
  if (closingId) lobby?.remove(closingId);
  $('dlgSettings').classList.add('hidden');
  toast(`🛑 Đã đóng phòng "${closingTitle}" thành công!`);
  openLobbyOverlay();
}

function kickPlayer(targetId) {
  if (!isHost()) return toast('⚠️ Chỉ Chủ phòng mới có quyền Kick người chơi!');
  const p = peers.get(targetId);
  if (!p) return;
  emitOp({
    k: 'kick',
    targetId,
    targetName: p.name,
    byHost: net.selfId,
  });
}

function updateHostUI() {
  if (!state || !net) return;
  const hostFlag = isHost();
  const titleText = state.roomTitle || roomTitle || roomName;
  const lockIcon = state.passHash ? ' 🔒' : '';
  $('roomInfo').textContent = `📍 ${titleText}${lockIcon}${hostFlag ? ' · 👑' : ''}`;
  $('roomInfo').title = hostFlag
    ? `Phòng: ${titleText} (#${roomName}) — Bạn là Chủ phòng`
    : `Phòng: ${titleText} (#${roomName}) — Chủ phòng: ${state.hostName || 'Host'}`;
  $('topTheme').disabled = !hostFlag;
  $('topTheme').title = hostFlag
    ? 'Đổi chủ đề bản đồ (Quyền Chủ phòng)'
    : `Chỉ Chủ phòng (${state.hostName || 'Host'}) mới được thay đổi chủ đề phòng`;
  $('hostPasswordSection')?.classList.toggle('hidden', !hostFlag);
  $('btnCloseRoomTop')?.classList.toggle('hidden', !hostFlag);
  $('btnCloseRoomSettings')?.classList.toggle('hidden', !hostFlag);
  renderSettingsModal();
}

function renderSettingsModal() {
  if (!state || !net) return;
  const count = 1 + peers.size;
  if ($('settingsPlayerCount')) $('settingsPlayerCount').textContent = count;
  const hostBox = $('hostInfoBox');
  if (hostBox) {
    const passStatus = state.passHash ? '🔒 Phòng Riêng Tư (Có mật khẩu)' : '🌐 Phòng Công Khai';
    hostBox.innerHTML = isHost()
      ? `<b>👑 Bạn là Chủ phòng hiện tại</b> · <span>${passStatus}</span><br><span class="hint">Bạn có quyền đổi chủ đề phòng, đặt mật khẩu và kick thành viên.</span>`
      : `<b>👑 Chủ phòng:</b> ${state.hostName || 'Ẩn danh'} · <span>${passStatus}</span>`;
  }
  const pList = $('playerList');
  if (!pList) return;
  pList.innerHTML = '';

  // Self row
  const selfRow = document.createElement('div');
  selfRow.className = 'queue-item';
  selfRow.innerHTML = `<span><b>👤 ${me.name} (Bạn)</b> ${state.hostId === net.selfId ? '👑' : ''}</span><span style="color:#4ade80">Đang online</span>`;
  pList.appendChild(selfRow);

  // Peer rows
  peers.forEach((p, id) => {
    const row = document.createElement('div');
    row.className = 'queue-item';
    const left = document.createElement('span');
    left.innerHTML = `👤 <b>${p.name}</b> ${state.hostId === id ? '👑 <small>(Chủ phòng)</small>' : ''}`;
    row.appendChild(left);

    if (isHost() && id !== net.selfId) {
      const btn = document.createElement('button');
      btn.className = 'danger-btn';
      btn.style.padding = '4px 10px';
      btn.style.fontSize = '12px';
      btn.textContent = '🚫 Kick';
      btn.onclick = () => kickPlayer(id);
      row.appendChild(btn);
    } else {
      const tag = document.createElement('span');
      tag.className = 'hint';
      tag.textContent = 'Thành viên';
      row.appendChild(tag);
    }
    pList.appendChild(row);
  });
}

// ---------- Network Handlers ----------
async function addOrUpdatePeer(id, d) {
  if (state?.kickedIds?.includes(id)) return;
  let p = peers.get(id);
  const isNew = !p;
  if (!p) {
    p = { x: d.x ?? 14.5, y: d.y ?? 18.5, r: d.r ?? 0, h: 0, a: 'idle' };
    peers.set(id, p);
  }
  Object.assign(p, {
    name: d.name || p.name || 'Khách',
    hue: d.hue ?? hueFor(d.name || id),
    tx: d.x ?? p.x,
    ty: d.y ?? p.y,
    tr: d.r ?? p.r,
    costume: d.costume || 'default',
    pumpkinHat: d.pumpkinHat || null,
    heldItem: d.heldItem || null,
    seatId: d.seatId || null,
  });
  if (state && id === state.hostId && d.name) {
    state.hostName = d.name;
  }
  refreshRecipients();
  updateLiveStats();
  updateHostUI();
  broadcastMyRoomToLobby();

  if (p.av) {
    p.av.setName(p.name);
    p.av.applyCostume(p.costume);
    p.av.setPumpkinHat(p.pumpkinHat);
    p.av.setHeldItem(p.heldItem);
    return;
  }
  if (p.loading) return;
  p.loading = true;
  await loadCharacter();
  if (!peers.has(id)) return;
  p.av = new Avatar(null, {
    name: p.name,
    hue: p.hue,
    costume: p.costume,
    pumpkinHat: p.pumpkinHat,
  });
  p.av.setHeldItem(p.heldItem);
  scene.add(p.av.root);
  p.loading = false;
  if (isNew) toast(`👋 ${p.name} đã tham gia phòng!`);
}

const handlers = {
  join(id) {
    if (me?.started && !isKicked) {
      if (state?.kickedIds?.includes(id)) {
        net.send('op', { k: 'kick', targetId: id, byHost: state.hostId, v: Date.now() }, id);
        return;
      }
      net.send('hello', pubInfo(), id);
      net.send('state', state, id);
    }
  },
  leave(id) {
    const p = peers.get(id);
    if (p) {
      toast(`${p.name} đã rời phòng`);
      if (p.av) scene.remove(p.av.root);
    }
    peers.delete(id);

    // If the Host left the room, deterministically transfer Host to the remaining player with lowest ID
    if (state && id === state.hostId) {
      const allIds = [net.selfId, ...peers.keys()].sort();
      const nextHostId = allIds[0];
      state.hostId = nextHostId;
      state.hostName = nextHostId === net.selfId ? me.name : peers.get(nextHostId)?.name || 'Chủ phòng';
      if (nextHostId === net.selfId) toast('👑 Chủ phòng trước đã rời đi — Bạn trở thành Chủ phòng mới!');
      else toast(`👑 ${state.hostName} đã trở thành Chủ phòng mới!`);
    }

    refreshRecipients();
    updateLiveStats();
    updateHostUI();
    updateMediaDialog();
    broadcastMyRoomToLobby();
  },
  hello(d, id) {
    addOrUpdatePeer(id, d);
  },
  pos(d, id) {
    if (state?.kickedIds?.includes(id)) return;
    const p = peers.get(id);
    if (p) {
      p.tx = d.x;
      p.ty = d.y;
      p.tr = d.r;
      p.a = d.a;
      p.th = d.h || 0;
      p.seatId = d.seatId || null;
      p.lean = d.lean || 0;
    }
  },
  state(s) {
    if (!validMap(s?.map)) return;
    if (s.kickedIds?.includes(net.selfId)) {
      handleSelfKicked(s.hostName);
      return;
    }

    // Determine whether incoming state is the older (authoritative) room state or a newer update of the same room
    if (state) {
      const sCreated = s.createdAt || s.v || 0;
      const myCreated = state.createdAt || state.v || 0;
      const isOlderRoom = sCreated < myCreated && s.hostId !== net.selfId;
      const isNewerVersion = s.v > state.v;
      if (!isOlderRoom && !isNewerVersion) return;
    }

    const first = !state;
    state = s;
    if (s.roomTitle) roomTitle = s.roomTitle;
    gotState = true;
    if (first) {
      start();
    } else {
      if (state.passHash && state.hostId !== net.selfId && verifiedPassHash !== state.passHash) {
        promptRoomPassword({ id: roomName, title: state.roomTitle || roomName, passHash: state.passHash });
      }
      $('topTheme').value = state.theme;
      applyMedia(state.mediaCurrent);
      updateHostUI();
      updateMediaDialog();
      net.send('hello', pubInfo());
    }
  },
  op(op, id) {
    if (state && !isKicked) applyOp(op, id);
  },
  chat(d, id) {
    if (state?.kickedIds?.includes(id)) return;
    const p = peers.get(id);
    if (p) {
      p.av?.say(d.t);
      logChat(p.name, d.t);
    }
  },
  emote(d, id) {
    if (state?.kickedIds?.includes(id)) return;
    const p = peers.get(id);
    if (!p) return;
    p.av?.playEmote(d.clip || EMOTE_CLIP[d.e] || 'wave');
    floaters.push({ e: d.e || '✨', who: id, t: Date.now() });

    if (d.to === net.selfId) {
      if (d.clip === 'throwTomato') {
        world.spawnTomatoThrow(p.x, p.y, me.x, me.y, () => {
          me.av?.triggerSplat(4500);
          me.av?.playEmote('scared');
          toast(`🍅 Bụp! ${p.name} vừa ném cà chua trúng bạn!`);
        });
      } else if (d.clip === 'handshake') {
        me.av?.playEmote('handshake');
        if (mode !== 'fps') me.r = Math.atan2(p.x - me.x, p.y - me.y);
        toast(`🤝 ${p.name} bắt tay với bạn!`);
      } else if (d.clip === 'hug') {
        me.av?.playEmote('hug');
        floaters.push({ e: '💖', who: net.selfId, t: Date.now() });
        if (mode !== 'fps') me.r = Math.atan2(p.x - me.x, p.y - me.y);
        toast(`🤗 ${p.name} gửi cho bạn một cái ôm ấm áp!`);
      } else if (d.clip === 'trickOrTreat') {
        toast(`🍬 ${p.name} hô vang: "Trick or Treat! Cho kẹo hay bị ghẹo!"`);
      } else {
        toast(`${p.name} ${d.e || '👋'} chào bạn!`);
      }
    } else if (d.clip === 'throwTomato' && d.to && peers.has(d.to)) {
      const targetPeer = peers.get(d.to);
      world.spawnTomatoThrow(p.x, p.y, targetPeer.x, targetPeer.y, () => {
        targetPeer.av?.triggerSplat(4500);
      });
    }
  },
  card(c, id) {
    const p = peers.get(id);
    inbox.unshift({ ...c, from: p?.name || c.from, at: Date.now() });
    saveInbox();
    toast('💌 Bạn vừa nhận được một tấm thiệp riêng!');
  },
};

function applyOp(op, senderId = null) {
  switch (op.k) {
    case 'theme': {
      // Only accept theme changes initiated by the Room Host
      if (senderId && state.hostId && senderId !== state.hostId && op.byHost !== state.hostId) return;
      if (THEMES[op.theme]) {
        state.theme = op.theme;
        state.map = buildThemeMap(op.theme);
        state.decor = [];
        $('topTheme').value = op.theme;
        leaveSeat();
        broadcastMyRoomToLobby();
        toast(`🗺️ Chủ phòng đã chuyển chủ đề sang: ${THEMES[op.theme].name}`);
      }
      break;
    }
    case 'setPass': {
      if (senderId && state.hostId && senderId !== state.hostId && op.byHost !== state.hostId) return;
      state.passHash = op.passHash || '';
      verifiedPassHash = state.passHash;
      updateHostUI();
      broadcastMyRoomToLobby();
      toast(state.passHash ? '🔒 Chủ phòng đã đặt mật khẩu bảo vệ phòng!' : '🌐 Chủ phòng đã mở phòng Công khai!');
      break;
    }
    case 'closeRoom': {
      if (senderId && state.hostId && senderId !== state.hostId && op.byHost !== state.hostId) return;
      handleRoomClosed(op.hostName || state.hostName);
      return;
    }
    case 'kick': {
      if (senderId && state.hostId && senderId !== state.hostId && op.byHost !== state.hostId) return;
      state.kickedIds = state.kickedIds || [];
      if (!state.kickedIds.includes(op.targetId)) state.kickedIds.push(op.targetId);
      if (op.targetId === net.selfId) {
        handleSelfKicked(state.hostName);
        return;
      }
      const p = peers.get(op.targetId);
      if (p) {
        if (p.av) scene.remove(p.av.root);
        peers.delete(op.targetId);
        refreshRecipients();
        updateLiveStats();
        updateHostUI();
        broadcastMyRoomToLobby();
        toast(`🚫 Chủ phòng đã mời ${op.targetName || p.name} ra khỏi phòng.`);
      }
      break;
    }
    case 'card+':
      state.cards = (state.cards || []).filter(c => c.id !== op.c.id);
      state.cards.push(op.c);
      break;
    case 'ornament+':
      state.treeOrnaments = state.treeOrnaments || [];
      state.treeOrnaments.push(op.o);
      if (op.by) logChat('🎄 Lễ hội', `${op.by} vừa treo ${op.name || 'đồ trang trí'} lên Cây Thông Lớn!`);
      break;
    case 'stocking+':
      state.stockingCards = state.stockingCards || [];
      state.stockingCards.unshift(op.c);
      renderStockingList();
      if (op.c?.from) logChat('🧦 Cây thông', `${op.c.from} vừa bỏ một tấm thiệp chúc mừng vào tất Giáng sinh!`);
      break;
    case 'firework':
      if (op.kind === 'launcher') {
        world.spawnFireworksShow(op.x, op.y);
        if (op.by) toast(`🎆 ${op.by} đã khởi động giàn pháo hoa đại bác!`);
      } else {
        world.spawnFirecrackers(op.x, op.y);
      }
      break;
    case 'vampireScare': {
      world.triggerVampireSwoop(op.x, op.y);
      if (op.who === net.selfId) {
        me.av?.playEmote('scared');
        floaters.push({ e: '🦇', who: net.selfId, t: Date.now() });
        toast('🧛 Bá Tước Ma Cà Rồng lao xuống hù bạn: BOO!! 😱');
      } else {
        const p = peers.get(op.who);
        if (p) {
          p.av?.playEmote('scared');
          floaters.push({ e: '🦇', who: op.who, t: Date.now() });
        }
      }
      break;
    }
    case 'mediaQueue+': {
      state.mediaQueue = state.mediaQueue || [];
      if (!state.mediaCurrent || !state.mediaCurrent.vid) {
        state.mediaCurrent = { ...op.item, playing: true, t: 0, at: Date.now() };
        applyMedia(state.mediaCurrent);
        toast(`🎬 Đang phát video của ${op.item.addedByName}`);
      } else {
        state.mediaQueue.push(op.item);
        toast(`📋 Đã thêm video của ${op.item.addedByName} vào hàng chờ (#${state.mediaQueue.length})`);
      }
      updateMediaDialog();
      break;
    }
    case 'mediaPlayNow': {
      // Replace what is on the TV right now (only host / current owner / anyone when TV is idle)
      if (senderId && !canControlTV(senderId)) return;
      state.mediaCurrent = { ...op.item, playing: true, t: 0, at: Date.now() };
      applyMedia(state.mediaCurrent);
      updateMediaDialog();
      toast(`📺 ${op.item.addedByName} vừa chiếu ${op.item.kind === 'web' ? 'trang web' : 'video'} lên TV`);
      break;
    }
    case 'mediaNext': {
      if (senderId && !canControlTV(senderId)) return;
      state.mediaQueue = state.mediaQueue || [];
      const next = state.mediaQueue.shift() || null;
      state.mediaCurrent = next ? { ...next, playing: true, t: 0, at: Date.now() } : null;
      applyMedia(state.mediaCurrent);
      updateMediaDialog();
      if (next) toast(`⏭ Chuyển sang video tiếp theo của ${next.addedByName}`);
      else toast('⏹ Đã phát hết danh sách chờ video');
      break;
    }
  }
  state.v = Math.max(state.v || 0, op.v || 0);
  if (isHost() && state) {
    net?.send('state', state);
  }
}

function emitOp(op) {
  op.v = Date.now();
  applyOp(op, net.selfId);
  net.send('op', op);
}

// ---------- Live Player Count & FPS Update ----------
function updateLiveStats() {
  const count = 1 + peers.size;
  $('statPlayers').textContent = `👥 ${count}`;
  renderSettingsModal();
}

// ---------- Chat, Emotes & Greeting Cards ----------
function logChat(name, t) {
  const d = document.createElement('div');
  d.textContent = `${name}: ${t}`;
  const l = $('chatLog');
  l.appendChild(d);
  while (l.children.length > 7) l.firstChild.remove();
  setTimeout(() => d.remove(), 18000);
}

$('chatIn').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter' && e.target.value.trim()) {
    const t = e.target.value.trim();
    me.av?.say(t);
    logChat(me.name, t);
    net.send('chat', { t });
    e.target.value = '';
    e.target.blur();
  }
  if (e.key === 'Escape') e.target.blur();
});

const saveInbox = () => {
  localStorage.setItem('gh_inbox', JSON.stringify(inbox.slice(0, 50)));
  $('inboxCount').textContent = inbox.length;
};
saveInbox();

function refreshRecipients() {
  const s = $('cardTo');
  const cur = s.value;
  s.innerHTML = '';
  const add = (v, t) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = t;
    s.appendChild(o);
  };
  if (state?.theme === 'christmas') {
    add('stocking', '🧦 Bỏ vào Tất treo trên Cây Thông Lớn (Mọi người cùng đọc)');
  }
  add('pin', '📌 Ghim phong thư lên mặt đất tại vị trí đang đứng');
  peers.forEach((p, id) => add(id, `👤 Gửi riêng cho ${p.name}`));
  if ([...s.options].some(o => o.value === cur)) s.value = cur;
}

function doSocialAction(emoji, clip, toPeerId = null) {
  if (!checkCooldown()) return;
  me.av?.playEmote(clip);
  floaters.push({ e: emoji, who: net.selfId, t: Date.now() });
  net.send('emote', { e: emoji, clip, to: toPeerId });

  if (toPeerId && peers.has(toPeerId)) {
    const p = peers.get(toPeerId);
    if (mode !== 'fps') me.r = Math.atan2(p.x - me.x, p.y - me.y);
    if (clip === 'throwTomato') {
      world.spawnTomatoThrow(me.x, me.y, p.x, p.y, () => {
        p.av?.triggerSplat(4500);
        toast(`🍅 Bạn đã ném cà chua trúng ${p.name}!`);
      });
    } else if (clip === 'trickOrTreat') {
      const candies = ['🍬 Kẹo ngô Halloween', '🍭 Kẹo mút ma quái', '🍫 Sô-cô-la dơi đêm', '🧁 Bánh quy bí ngô'];
      const gift = candies[Math.floor(Math.random() * candies.length)];
      toast(`🎃 Bạn xin kẹo ${p.name} và nhận được: ${gift}!`);
    }
  }
}

$('cardSend').onclick = () => {
  const text = $('cardText').value.trim();
  if (!text) return toast('Hãy viết lời chúc trước khi gửi nhé!');
  if (!checkCooldown()) return;
  const style = $('cardStyle').value,
    to = $('cardTo').value;
  const card = { id: uid(), from: me.name, text, style };
  if (to === 'stocking') {
    emitOp({ k: 'stocking+', c: card });
    toast('🧦 Đã bỏ tấm thiệp vào chiếc tất trên Cây Thông Lớn!');
  } else if (to === 'pin') {
    emitOp({ k: 'card+', c: { ...card, x: Math.round(me.x), y: Math.round(me.y) } });
    toast('📌 Đã ghim thiệp lên bản đồ!');
  } else {
    net.send('card', card, to);
    toast('💌 Đã gửi thiệp riêng thành công!');
  }
  $('cardText').value = '';
  $('dlgCard').classList.add('hidden');
};

function renderInbox() {
  const l = $('inboxList');
  l.innerHTML = '';
  if (!inbox.length) l.textContent = 'Chưa có tấm thiệp nào trong hộp thư.';
  inbox.forEach(c => {
    const st = CARD_STYLES[c.style] || CARD_STYLES.classic;
    const d = document.createElement('div');
    d.className = 'card';
    d.style.cssText = `background:${st.bg};color:${st.fg};border-color:${st.border}`;
    d.textContent = `${c.text}\n\n— Gửi từ: ${c.from}`;
    l.appendChild(d);
  });
}

function renderStockingList() {
  const list = state?.stockingCards || [];
  $('stockingCount').textContent = list.length;
  const box = $('stockingList');
  box.innerHTML = '';
  if (!list.length) {
    box.textContent = 'Chưa có thiệp nào trong tất. Hãy là người đầu tiên bỏ thiệp nhé!';
    return;
  }
  list.forEach(c => {
    const st = CARD_STYLES[c.style] || CARD_STYLES.christmas;
    const d = document.createElement('div');
    d.className = 'card';
    d.style.cssText = `background:${st.bg};color:${st.fg};border-color:${st.border}`;
    d.textContent = `${c.text}\n\n— 🧦 ${c.from}`;
    box.appendChild(d);
  });
}

// ---------- Media Queue, Android-TV style Browser & Skip System ----------
const escHtml = t =>
  String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mediaLabel = item => (item.kind === 'web' ? '🌐 ' + (item.title || item.url) : 'Video YouTube ' + item.vid);

// Who may change / skip what is on the TV: the Host, whoever added the current item, anyone when TV is idle,
// or anyone when the person who added it already left the room.
function canControlTV(userId = net?.selfId) {
  if (!state) return false;
  const cur = state.mediaCurrent;
  if (!cur || !cur.vid) return true;
  if (userId && userId === state.hostId) return true;
  const ownerId = cur.addedBy;
  return ownerId === userId || (!!ownerId && ownerId !== net?.selfId && !peers.has(ownerId));
}

function canSkipCurrentMedia() {
  if (!state?.mediaCurrent?.vid) return false;
  return canControlTV(net?.selfId);
}

function updateMediaDialog() {
  if (!state) return;
  const q = state.mediaQueue || [];
  const cur = state.mediaCurrent;
  $('queueCount').textContent = (cur?.vid ? 1 : 0) + q.length;

  const nowBox = $('nowPlayingBox');
  if (cur && cur.vid) {
    const isMine = cur.addedBy === net?.selfId;
    const perm = canSkipCurrentMedia()
      ? '<span style="color:#4ade80">(Bạn có quyền Skip / thay đổi TV)</span>'
      : '<span style="color:#fbbf24">(Chỉ người thêm hoặc Chủ phòng được Skip)</span>';
    nowBox.innerHTML =
      '<b>▶ Đang chiếu trên màn hình lớn:</b> ' +
      escHtml(mediaLabel(cur)) +
      '<br>Người thêm: <b>' +
      escHtml(cur.addedByName) +
      '</b>' +
      (isMine ? ' (bạn)' : '') +
      ' ' +
      perm;
  } else {
    nowBox.innerHTML = '<i>TV đang trống. Dán link YouTube hoặc một trang web rồi bấm “Phát ngay”!</i>';
  }

  $('mediaSkip').disabled = !canSkipCurrentMedia();
  $('mediaBypassAd').classList.toggle('hidden', !!cur && cur.kind === 'web');
  updateStatusBadges();

  const qBox = $('queueList');
  qBox.innerHTML = '';
  if (!q.length) {
    qBox.innerHTML = '<div class="hint">Hàng chờ đang trống.</div>';
  } else {
    q.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'queue-item';
      row.innerHTML =
        '<span><b>#' + (idx + 1) + '</b> · ' + escHtml(mediaLabel(item)) + '</span><span>👤 ' + escHtml(item.addedByName) + '</span>';
      qBox.appendChild(row);
    });
  }
}

function onMediaEnded(finishedMedia) {
  // Only someone allowed to control the TV triggers the auto-advance op
  if (!state?.mediaCurrent || state.mediaCurrent.id !== finishedMedia?.id) return;
  if (state.mediaCurrent.kind === 'web') return;
  if (canSkipCurrentMedia()) {
    emitOp({ k: 'mediaNext' });
  }
}

function triggerBypassAd() {
  if (bypassAdNow()) {
    toast('⚡ Đã bỏ qua quảng cáo YouTube & đồng bộ lại thời gian phát!');
  } else {
    toast('ℹ️ Hiện chưa có video YouTube nào đang phát trên màn hình TV.');
  }
}

function buildMediaItem(rawInput) {
  const info = classifyMediaInput(rawInput);
  if (!info) {
    toast('⚠️ Link không hợp lệ! Hãy dán link YouTube hoặc địa chỉ website (https://…).');
    return null;
  }
  if (info.kind === 'yt') {
    return { id: uid(), kind: 'yt', vid: info.vid, title: `YouTube (${info.vid})`, addedBy: net.selfId, addedByName: me.name };
  }
  return { id: uid(), kind: 'web', vid: 'web', url: info.url, title: info.title, addedBy: net.selfId, addedByName: me.name };
}

function castToTV(rawInput, { forceQueue = false } = {}) {
  const item = buildMediaItem(rawInput);
  if (!item) return false;
  if (!checkCooldown()) return false;
  const cur = state?.mediaCurrent;
  if (!forceQueue && cur?.vid) {
    if (canControlTV(net.selfId)) {
      emitOp({ k: 'mediaPlayNow', item });
    } else {
      emitOp({ k: 'mediaQueue+', item });
      toast('📋 TV đang được người khác điều khiển — đã xếp nội dung của bạn vào hàng chờ.');
    }
  } else {
    emitOp({ k: 'mediaQueue+', item });
  }
  return true;
}

$('mediaAdd').onclick = () => {
  if (castToTV($('mediaUrl').value, { forceQueue: true })) $('mediaUrl').value = '';
};
$('mediaPlayNow').onclick = () => {
  if (castToTV($('mediaUrl').value)) $('mediaUrl').value = '';
};
$('mediaUrl').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') $('mediaPlayNow').click();
});

$('tileYoutube').onclick = () => {
  $('mediaUrl').placeholder = 'Dán link YouTube rồi bấm “Phát ngay”…';
  $('mediaUrl').focus();
};

// ---- Fullscreen TV Browser (remote): browse privately, then cast the page to the shared TV ----
function openTvBrowser(startUrl = '') {
  const cur = state?.mediaCurrent;
  const initial = startUrl || (cur?.kind === 'web' ? cur.url : '');
  $('tvbUrl').value = initial;
  $('tvbFrame').src = initial || 'about:blank';
  openDialog('dlgTvBrowser');
  setTimeout(() => $('tvbUrl').focus(), 60);
}
function tvbPreview() {
  const u = normalizeWebUrl($('tvbUrl').value);
  if (!u) return toast('⚠️ Địa chỉ không hợp lệ! Ví dụ: wikipedia.org hoặc https://vimeo.com/…');
  $('tvbUrl').value = u;
  $('tvbFrame').src = u;
}
$('tileBrowser').onclick = () => openTvBrowser();
document.querySelectorAll('.tv-tile[data-site]').forEach(b => (b.onclick = () => openTvBrowser(b.dataset.site)));
$('tvbClose').onclick = () => {
  $('dlgTvBrowser').classList.add('hidden');
  $('tvbFrame').src = 'about:blank';
};
$('tvbReload').onclick = () => {
  const src = $('tvbFrame').src;
  if (src && src !== 'about:blank') $('tvbFrame').src = src;
};
$('tvbGo').onclick = tvbPreview;
$('tvbUrl').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') tvbPreview();
});
$('tvbCast').onclick = () => {
  if (castToTV($('tvbUrl').value)) {
    $('dlgTvBrowser').classList.add('hidden');
    $('tvbFrame').src = 'about:blank';
  }
};
$('tvbExternal').onclick = () => {
  const u = normalizeWebUrl($('tvbUrl').value);
  if (u) window.open(u, '_blank', 'noopener');
};

$('mediaBypassAd').onclick = () => triggerBypassAd();
$('btnQuickBypassAd').onclick = () => triggerBypassAd();

$('mediaSkip').onclick = () => {
  if (!canSkipCurrentMedia()) {
    return toast('⚠️ Chỉ người thêm nội dung đang chiếu hoặc Chủ phòng mới có quyền Skip!');
  }
  if (!checkCooldown()) return;
  emitOp({ k: 'mediaNext' });
};

$('mediaMute').onclick = () => {
  const m = toggleMute();
  toast(m ? '🔇 Đã tắt tiếng TV' : '🔊 Đã bật tiếng TV');
};
$('mediaReload').onclick = () => {
  forceReloadVideo();
  toast('🔄 Đang tải lại video trên màn hình lớn…');
};
$('mediaHide').onclick = () => {
  const h = toggleVideoHidden();
  toast(h ? '📺 Đã ẩn video trên màn hình lớn' : '📺 Đã hiện video trên màn hình lớn');
};

// ---------- Topbar, Settings, Pointer Lock, Costume & Campfire Buttons ----------
const openDialog = id => {
  document.exitPointerLock?.();
  $(id).classList.remove('hidden');
};
document.querySelectorAll('[data-close]').forEach(b => (b.onclick = () => b.closest('.overlay').classList.add('hidden')));

// Initialize Mouse Sensitivity & Lock Mode UI
$('mouseSens').value = mouseSens;
$('sensVal').textContent = `${mouseSens.toFixed(1)}x`;
$('mouseSens').oninput = e => {
  mouseSens = parseFloat(e.target.value) || 1.0;
  $('sensVal').textContent = `${mouseSens.toFixed(1)}x`;
  localStorage.setItem('gh_sens', String(mouseSens));
};
$('lockModeSel').value = lockMode;
$('lockModeSel').onchange = e => {
  lockMode = e.target.value;
  localStorage.setItem('gh_lock_mode', lockMode);
  toast(
    lockMode === 'click'
      ? '🖱️ Đã bật tự động khóa chuột khi click vào màn hình game'
      : '🖱️ Đã chuyển sang chế độ chỉ khóa chuột khi bấm phím L / Chuột phải'
  );
};

function togglePointerLock() {
  if (document.pointerLockElement) {
    document.exitPointerLock?.();
  } else {
    $('peerMenu').classList.add('hidden');
    $('game').requestPointerLock?.();
  }
}

function updateLockHud() {
  const locked = !!document.pointerLockElement;
  const lbl = $('lockLabel');
  const btn = $('btnLock');
  if (lbl) {
    lbl.textContent = locked ? '🔒 Khóa' : '🔓 Tự do';
    lbl.style.color = locked ? '#4ade80' : '#38bdf8';
  }
  if (btn) {
    btn.textContent = locked ? '🔒' : '🔓';
  }
  $('crosshair').classList.toggle('hidden', !(mode === 'fps' || locked));
}
document.addEventListener('pointerlockchange', updateLockHud);

$('topTheme').onchange = e => {
  if (!isHost()) {
    e.target.value = state.theme;
    return toast('⚠️ Chỉ Chủ phòng mới có quyền thay đổi chủ đề của phòng!');
  }
  if (!checkCooldown()) {
    e.target.value = state.theme;
    return;
  }
  emitOp({ k: 'theme', theme: e.target.value, byHost: net.selfId });
};

$('btnLobby').onclick = () => openLobbyOverlay();
$('btnOpenLobbyFromSettings').onclick = () => {
  $('dlgSettings').classList.add('hidden');
  openLobbyOverlay();
};
$('btnCloseRoomTop').onclick = () => closeRoomByHost();
$('btnCloseRoomSettings').onclick = () => closeRoomByHost();
$('btnSaveRoomPass').onclick = () => {
  if (!isHost()) return toast('⚠️ Chỉ Chủ phòng mới được cài đặt mật khẩu!');
  const raw = $('setRoomPassInput').value.trim();
  const pHash = raw ? hashPass(raw) : '';
  emitOp({ k: 'setPass', passHash: pHash, byHost: net.selfId });
  $('setRoomPassInput').value = '';
};

$('btnLock').onclick = () => togglePointerLock();
$('lockLabel').onclick = () => togglePointerLock();
$('btnHelpToggle').onclick = () => $('hud').classList.toggle('hidden');
$('btnHudClose').onclick = () => $('hud').classList.add('hidden');

$('btnSettings').onclick = () => {
  renderSettingsModal();
  openDialog('dlgSettings');
};
$('statPlayers').onclick = () => {
  renderSettingsModal();
  openDialog('dlgSettings');
};
$('btnRejoinOther').onclick = () => {
  $('dlgKicked').classList.add('hidden');
  openLobbyOverlay();
};

$('btnCard').onclick = () => {
  refreshRecipients();
  openDialog('dlgCard');
};
$('btnInbox').onclick = () => {
  renderInbox();
  openDialog('dlgInbox');
};
$('btnCopy').onclick = () => {
  navigator.clipboard?.writeText(location.href);
  toast('🔗 Đã copy link phòng vào clipboard!');
};
$('btnMedia').onclick = () => {
  updateMediaDialog();
  openDialog('dlgMedia');
};
$('btnView').onclick = () => toggleView();

// Remove Pumpkin Hat button
$('btnRemovePumpkin').onclick = () => {
  if (!checkCooldown()) return;
  me.pumpkinHat = null;
  me.av?.setPumpkinHat(null);
  me.av?.playEmote('interact');
  updateStatusBadges();
  syncMyAppearance();
  toast('🎃 Đã tháo quả bí ngô khỏi đầu!');
};

// Reset Costume button
$('btnResetCostume').onclick = () => {
  if (!checkCooldown()) return;
  equipCostume('default');
};

// Stand up from seat button
$('btnLeaveSeat').onclick = () => leaveSeat();

// Campfire actions (Roast Marshmallow & Drink Hot Cocoa)
$('btnRoast').onclick = () => {
  if (!checkCooldown()) return;
  me.av?.playEmote('roast');
  net.send('emote', { e: '🍡', clip: 'roast' });
  floaters.push({ e: '🍡', who: net.selfId, t: Date.now() });
  toast('🔥 Bạn đang nướng Marshmallow vàng ươm thơm phức bên lửa trại!');
};

$('btnCocoa').onclick = () => {
  if (!checkCooldown()) return;
  me.av?.playEmote('cocoa');
  net.send('emote', { e: '☕', clip: 'cocoa' });
  floaters.push({ e: '☕', who: net.selfId, t: Date.now() });
  toast('☕ Bạn nhâm nhi tách Ca cao nóng hổi giữa tiết trời Giáng sinh!');
};

// Stocking dialog buttons
$('btnWriteStocking').onclick = () => {
  $('dlgStocking').classList.add('hidden');
  refreshRecipients();
  $('cardTo').value = 'stocking';
  $('cardStyle').value = 'christmas';
  openDialog('dlgCard');
};

$('btnHangNow').onclick = () => {
  hangHeldOrnamentOnTree();
  $('dlgStocking').classList.add('hidden');
};

// Tet Lixi button
$('btnOpenAnotherLixi').onclick = () => pickAndOpenLixi();

function equipCostume(costumeKey) {
  me.costume = costumeKey;
  me.av?.applyCostume(costumeKey);
  me.av?.playEmote('interact');
  updateStatusBadges();
  syncMyAppearance();
  const cfg = COSTUMES[costumeKey] || COSTUMES.default;
  toast(`🎭 Đã hóa trang thành: ${cfg.name}`);
}

function wearPumpkinHat(styleKey) {
  if (!checkCooldown()) return;
  me.pumpkinHat = styleKey;
  me.av?.setPumpkinHat(styleKey);
  me.av?.playEmote('interact');
  updateStatusBadges();
  syncMyAppearance();
  const cfg = PUMPKIN_HATS[styleKey] || PUMPKIN_HATS.classic;
  toast(`🎃 Bạn đã đội "${cfg.name}" lên đầu! (Nhấn nút góc trái để tháo xuống)`);
}

function hangHeldOrnamentOnTree() {
  if (!me.heldItem) return;
  if (!checkCooldown()) return;
  const orn = ORNAMENTS.find(o => o.key === me.heldItem) || ORNAMENTS[0];
  emitOp({
    k: 'ornament+',
    o: { id: uid(), key: orn.key, by: me.name },
    by: me.name,
    name: orn.name,
  });
  me.heldItem = null;
  me.av?.setHeldItem(null);
  me.av?.playEmote('interact');
  floaters.push({ e: '🎄', who: net.selfId, t: Date.now() });
  updateStatusBadges();
  syncMyAppearance();
  toast(`🎄 Tuyệt vời! Bạn đã treo ${orn.name} lên Cây Thông Lớn!`);
}

function pickAndOpenLixi() {
  if (!checkCooldown()) return;
  const reward = rollLixiReward();
  $('lixiTitle').textContent = reward.title;
  $('lixiDetail').textContent = reward.detail;
  openDialog('dlgLixi');
  me.av?.playEmote('interact');
  floaters.push({ e: '🧧', who: net.selfId, t: Date.now() });
  net.send('emote', { e: '🧧', clip: 'interact' });
  const msg = `🧧 Hái lộc Cây Mai Đại Thụ và ${reward.short}`;
  logChat(me.name, msg);
  net.send('chat', { t: msg });
}

function updateStatusBadges() {
  if (!me) return;
  $('btnRemovePumpkin').classList.toggle('hidden', !me.pumpkinHat);
  $('btnResetCostume').classList.toggle('hidden', !me.costume || me.costume === 'default');
  $('btnLeaveSeat').classList.toggle('hidden', !me.seatSlot);
  $('btnQuickBypassAd')?.classList.toggle('hidden', !state?.mediaCurrent?.vid || state.mediaCurrent.kind === 'web');

  const hb = $('heldBadge');
  if (me.heldItem) {
    const orn = ORNAMENTS.find(o => o.key === me.heldItem);
    hb.textContent = `🎄 Đang cầm: ${orn?.name || me.heldItem} (Lại gần Cây Thông nhấn E để treo)`;
    hb.classList.remove('hidden');
  } else {
    hb.classList.add('hidden');
  }
}

// ---------- Views ----------
function toggleView() {
  mode = mode === 'tps' ? 'fps' : 'tps';
  pitch = mode === 'fps' ? 0 : -0.25;
  updateHud();
}

function updateHud() {
  $('viewLabel').textContent = mode === 'fps' ? '👁️ Góc nhìn thứ nhất (FPS)' : '🎥 Góc nhìn thứ ba (TPS)';
  if ($('btnView')) $('btnView').textContent = mode === 'fps' ? '👁️ FPS' : '🎥 TPS';
  if (me?.av) me.av.root.visible = mode !== 'fps';
  updateLockHud();
}

// ---------- Seat & Hotspot Proximity / Interaction ----------
function isSlotOccupied(slotId) {
  for (const p of peers.values()) {
    if (p.seatId === slotId) return true;
  }
  return false;
}

function sitOnSeat(seat) {
  // Find first available slot on this seat/sofa
  const freeSlot = seat.slots.find(s => !isSlotOccupied(s.id)) || seat.slots[0];
  me.seatSlot = { ...freeSlot, kind: seat.kind };
  me.x = freeSlot.x;
  me.y = freeSlot.y;
  me.r = freeSlot.rot;
  me.h = 0;
  me.vy = 0;
  updateStatusBadges();
  syncMyAppearance();

  if (seat.kind === 'couple') {
    const partner = findCouplePartner();
    if (partner) {
      toast(`💑 Bạn đã ngồi bắt cặp cùng ${partner.name} trên ghế Couple! 💕`);
      floaters.push({ e: '💕', who: net.selfId, t: Date.now() });
    } else {
      toast('💑 Đã ngồi lên ghế Couple — Chờ một người nữa ngồi cạnh để bắt cặp nhé!');
    }
  } else if (seat.kind === 'log') {
    toast('🪵 Đã ngồi lên khúc gỗ bên lửa trại ấm áp!');
  } else {
    toast('🪑 Đã ngồi xuống ghế xem TV!');
  }
}

function leaveSeat() {
  if (!me?.seatSlot) return;
  me.seatSlot = null;
  updateStatusBadges();
  syncMyAppearance();
}

function findCouplePartner() {
  if (!me?.seatSlot?.sofaId) return null;
  for (const [id, p] of peers) {
    if (p.seatId && p.seatId.startsWith(me.seatSlot.sofaId + '_') && p.seatId !== me.seatSlot.id) {
      return { id, ...p };
    }
  }
  return null;
}

function findNearestInteractable() {
  if (!state || !me || !world?.features) return null;

  // 1. Check nearby players (within 2.4 tiles)
  let bestPeer = null,
    bestPeerD = 2.4;
  for (const [id, p] of peers) {
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < bestPeerD && p.av) {
      bestPeerD = d;
      bestPeer = { kind: 'peer', id, peer: p, prompt: `👤 ${p.name} · [E] Tương tác (Chào, Bắt tay, Ôm, Xin kẹo, Ném cà chua)` };
    }
  }

  // 2. Check themed hotspots
  let bestHotspot = null,
    bestHotD = 1e9;
  for (const h of world.features.hotspots) {
    const d = Math.hypot(h.x - me.x, h.y - me.y);
    if (d <= h.radius && d < bestHotD) {
      bestHotD = d;
      let prompt = h.prompt;
      if (h.type === 'xmas_tree' && me.heldItem) {
        const orn = ORNAMENTS.find(o => o.key === me.heldItem);
        prompt = `🎄 Cây Thông Lớn · [E] Treo ngay ${orn?.name || 'đồ trang trí'} lên cây!`;
      }
      bestHotspot = { kind: 'hotspot', hotspot: h, d, prompt };
    }
  }

  // 3. Check nearby seats (if not already sitting)
  let bestSeat = null,
    bestSeatD = 1.35;
  if (!me.seatSlot) {
    for (const s of world.features.seats) {
      const d = Math.hypot(s.x - me.x, s.y - me.y);
      if (d < bestSeatD) {
        bestSeatD = d;
        const label =
          s.kind === 'couple'
            ? '💑 Ghế Couple · [E] Ngồi bắt cặp xem TV'
            : s.kind === 'log'
            ? '🪵 Khúc Gỗ Lửa Trại · [E] Ngồi sưởi ấm & nướng Marshmallow'
            : '🪑 Ghế Xem TV · [E] Ngồi xuống';
        bestSeat = { kind: 'seat', seat: s, d, prompt: label };
      }
    }
  }

  // Prioritize seat if right next to it, then hotspot, then peer
  if (bestSeat && (!bestHotspot || bestSeat.d < bestHotspot.d * 0.7)) return bestSeat;
  if (bestHotspot) return bestHotspot;
  if (bestPeer) return bestPeer;

  // 4. Check ground cards
  const c = (state.cards || []).find(card => Math.hypot(card.x - me.x, card.y - me.y) < 1.5);
  if (c) return { kind: 'card', card: c, prompt: `💌 Thiệp của ${c.from} · [E] Nhặt đọc` };

  return null;
}

function triggerInteract(target = activeTarget) {
  if (!target) {
    toast('Hãy lại gần Cây thông, Bàn trang trí, Lửa trại, Bí ngô, Cây mai, Ghế ngồi hoặc Người chơi khác rồi nhấn [E]!');
    return;
  }
  document.exitPointerLock?.();

  if (target.kind === 'peer') {
    openPeerMenu(target.id, innerWidth / 2, innerHeight / 2);
    return;
  }
  if (target.kind === 'seat') {
    sitOnSeat(target.seat);
    return;
  }
  if (target.kind === 'card') {
    inbox.unshift({ ...target.card, at: Date.now() });
    saveInbox();
    renderInbox();
    openDialog('dlgInbox');
    return;
  }
  if (target.kind === 'hotspot') {
    const h = target.hotspot;
    switch (h.type) {
      case 'screen':
        updateMediaDialog();
        openDialog('dlgMedia');
        break;
      case 'ornament_table':
        openDialog('dlgOrnament');
        break;
      case 'xmas_tree':
        if (me.heldItem) {
          hangHeldOrnamentOnTree();
        } else {
          $('btnHangNow').classList.toggle('hidden', !me.heldItem);
          renderStockingList();
          openDialog('dlgStocking');
        }
        break;
      case 'campfire':
        $('btnRoast').click();
        break;
      case 'small_pumpkin':
        wearPumpkinHat(h.styleKey);
        break;
      case 'giant_pumpkin':
        toast('🎃 Hãy lại gần 1 trong 6 quả bí ngô nhỏ xung quanh chân Đại Bí Ngô để đội lên đầu nhé!');
        break;
      case 'costume_booth':
        equipCostume(h.costumeKey);
        openDialog('dlgCostume');
        break;
      case 'mai_tree':
        pickAndOpenLixi();
        break;
      case 'firework_launcher':
        if (!checkCooldown()) return;
        me.av?.playEmote('interact');
        emitOp({ k: 'firework', x: h.x, y: h.y, kind: 'launcher', by: me.name });
        break;
      case 'firecracker_table':
        if (!checkCooldown()) return;
        me.av?.playEmote('interact');
        emitOp({ k: 'firework', x: h.x, y: h.y, kind: 'cracker', by: me.name });
        toast('🧨 Pháo nổ lách tách rộn ràng góc sân!');
        break;
    }
  }
}

$('interactPrompt').onclick = () => triggerInteract(activeTarget);

// ---------- Input & Pointer Events ----------
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (e.key === 'Enter') {
    document.exitPointerLock?.();
    $('chatIn').focus();
    e.preventDefault();
    return;
  }
  if (k === 'v') toggleView();
  else if (k === 'l') togglePointerLock();
  else if (k === 'h') $('hud').classList.toggle('hidden');
  else if (k === 'b' && state?.mediaCurrent?.vid && state.mediaCurrent.kind !== 'web') triggerBypassAd();
  else if (k === 'alt' && document.pointerLockElement) document.exitPointerLock?.();
  else if (k === 'e') triggerInteract(activeTarget);
  else if (e.key === '1' && me?.av) doSocialAction('👋', 'wave');
  else if (e.key === '2' && me?.av) doSocialAction('🤝', 'handshake');
  else if (e.key === '3' && me?.av) doSocialAction('🤗', 'hug');
  else if (e.key === '4' && me?.av) {
    if (state?.theme === 'halloween') doSocialAction('🍬', 'trickOrTreat');
    else if (state?.theme === 'christmas') $('btnRoast').click();
    else doSocialAction('🧧', 'interact');
  }

  if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
  if (e.key === ' ' && me) {
    if (me.seatSlot) leaveSeat();
    else if (me.h === 0) me.vy = JUMP_V;
  }
  keys.add(k);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const cv = $('game'),
  ray = new THREE.Raycaster(),
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let down = null;

const ndcOf = e =>
  document.pointerLockElement
    ? new THREE.Vector2(0, 0)
    : new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);

const floorPoint = ndc => {
  ray.setFromCamera(ndc, camera);
  const v = new THREE.Vector3();
  if (!ray.ray.intersectPlane(groundPlane, v)) return null;
  return { x: v.x / TILE, y: v.z / TILE, tx: Math.round(v.x / TILE), ty: Math.round(v.z / TILE) };
};

const inMap = t => t && t.tx >= 0 && t.ty >= 0 && t.tx < state.map.w && t.ty < state.map.h;
const tileAt = (x, y) => (x < 0 || y < 0 || x >= state.map.w || y >= state.map.h ? '#' : state.map.rows[y][x]);

function peerAt(ndc) {
  ray.setFromCamera(ndc, camera);
  let best = null,
    bd = 1e9;
  const c = new THREE.Vector3();
  for (const [id, p] of peers) {
    if (!p.av) continue;
    c.set(p.x * TILE, p.h + 0.9, p.y * TILE);
    const d = ray.ray.origin.distanceTo(c);
    if (d < 35 && d < bd && ray.ray.distanceSqToPoint(c) < 0.6 * 0.6) {
      best = id;
      bd = d;
    }
  }
  return best;
}

cv.addEventListener('pointerdown', e => {
  if (!state) return;
  $('peerMenu').classList.add('hidden');
  if (e.button === 2) {
    // Right-click toggles pointer lock immediately
    togglePointerLock();
    return;
  }
  down = { x: e.clientX, y: e.clientY, moved: 0, button: e.button };
  if (!document.pointerLockElement) {
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {}
  }
});

cv.addEventListener('pointermove', e => {
  if (!state) return;
  const locked = !!document.pointerLockElement;
  if (!down && !locked) return;
  const dx = locked ? e.movementX : e.clientX - down.x,
    dy = locked ? e.movementY : e.clientY - down.y;

  // Filter out sudden pointer-lock browser jump spikes
  if (locked && (Math.abs(dx) > 250 || Math.abs(dy) > 250)) return;

  if (!locked) {
    down.x = e.clientX;
    down.y = e.clientY;
    down.moved += Math.abs(dx) + Math.abs(dy);
  }
  const sens = 0.0045 * mouseSens;
  yaw -= dx * sens;
  pitch = clamp(pitch - dy * sens, mode === 'fps' ? -1.45 : -1.2, mode === 'fps' ? 1.45 : 0.8);
});

cv.addEventListener('pointerup', e => {
  if (!state || !down) return;
  const wasClick = down.moved < 6 && down.button === 0;
  down = null;
  if (wasClick) handleClick(ndcOf(e), e.clientX, e.clientY);
});

cv.addEventListener('contextmenu', e => e.preventDefault());

function handleClick(ndc, cx, cy) {
  const id = peerAt(ndc);
  if (id) return openPeerMenu(id, cx, cy);

  const fp = floorPoint(ndc);
  if (!fp) return;

  // Click on a seat or hotspot if within reasonable distance
  if (world?.features) {
    for (const s of world.features.seats) {
      if (Math.hypot(fp.x - s.x, fp.y - s.y) < 0.85 && Math.hypot(me.x - s.x, me.y - s.y) < 4.5) {
        return sitOnSeat(s);
      }
    }
    for (const h of world.features.hotspots) {
      if (Math.hypot(fp.x - h.x, fp.y - h.y) < 1.4 && Math.hypot(me.x - h.x, me.y - h.y) < h.radius + 1.8) {
        return triggerInteract({ kind: 'hotspot', hotspot: h });
      }
    }
  }

  const c = (state.cards || []).find(c => c.x === fp.tx && c.y === fp.ty);
  if (c) {
    inbox.unshift({ ...c, at: Date.now() });
    saveInbox();
    renderInbox();
    openDialog('dlgInbox');
    return;
  }

  // If clicking empty 3D space and lockMode === 'click' (or in FPS mode), lock pointer for smooth look
  const anyDialogOpen = [...document.querySelectorAll('.overlay')].some(m => !m.classList.contains('hidden'));
  if (!anyDialogOpen && (lockMode === 'click' || mode === 'fps') && !document.pointerLockElement) {
    cv.requestPointerLock?.();
  }
}

function openPeerMenu(id, x, y) {
  document.exitPointerLock?.();
  const m = $('peerMenu');
  m.innerHTML = '';
  const p = peers.get(id);
  if (!p) return;
  const h = document.createElement('div');
  h.className = 'menu-title';
  const isPeerHost = state?.hostId === id;
  h.textContent = `${isPeerHost ? '👑' : '👤'} ${p.name}`;
  m.appendChild(h);

  const actions = [
    ['👋', 'wave', 'Vẫy tay chào'],
    ['🤝', 'handshake', 'Bắt tay làm quen'],
    ['🤗', 'hug', 'Ôm ấm áp'],
    ['🍬', 'trickOrTreat', 'Xin kẹo (Trick or Treat)'],
    ['🍅', 'throwTomato', 'Ném cà chua!'],
  ];
  actions.forEach(([em, clip, label]) => {
    const b = document.createElement('button');
    b.textContent = `${em} ${label}`;
    b.onclick = () => {
      doSocialAction(em, clip, id);
      m.classList.add('hidden');
    };
    m.appendChild(b);
  });

  const c = document.createElement('button');
  c.textContent = '💌 Viết thiệp gửi riêng';
  c.onclick = () => {
    refreshRecipients();
    $('cardTo').value = id;
    openDialog('dlgCard');
    m.classList.add('hidden');
  };
  m.appendChild(c);

  if (isHost()) {
    const kBtn = document.createElement('button');
    kBtn.className = 'danger-btn';
    kBtn.textContent = '🚫 Kick khỏi phòng';
    kBtn.onclick = () => {
      kickPlayer(id);
      m.classList.add('hidden');
    };
    m.appendChild(kBtn);
  }

  m.style.left = Math.min(x, innerWidth - 220) + 'px';
  m.style.top = Math.min(y, innerHeight - 290) + 'px';
  m.classList.remove('hidden');
}

// ---------- Collision & Main Simulation Loop ----------
const free = (x, y) => {
  for (const [ox, oy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    if (isSolid(tileAt(Math.floor(x + ox * RADIUS + 0.5), Math.floor(y + oy * RADIUS + 0.5)))) return false;
  }
  if (world?.features?.colliders) {
    for (const c of world.features.colliders) {
      if (Math.hypot(x - c.x, y - c.y) < c.r + RADIUS) return false;
    }
  }
  return true;
};

let last = performance.now(),
  lastSend = 0,
  sent = {};

function loop(now) {
  if (isKicked || !me?.started || !state) {
    loopRunning = false;
    return;
  }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // 1. Update FPS & Live Stats
  frameCount++;
  if (now - fpsLastTime >= 500) {
    currentFps = Math.round((frameCount * 1000) / (now - fpsLastTime));
    $('statFps').textContent = `⚡ ${currentFps} FPS`;
    frameCount = 0;
    fpsLastTime = now;
  }

  // 2. Update Cooldown Badge on HUD
  const cb = $('cooldownBadge');
  if (now < cooldownUntil) {
    cb.textContent = `⏳ Hồi chiêu: ${((cooldownUntil - now) / 1000).toFixed(1)}s`;
    cb.classList.remove('hidden');
  } else {
    cb.classList.add('hidden');
  }

  // 3. Player Locomotion & Sitting State
  const k = keys;
  const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
  const str = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
  const running = k.has('shift');
  let dx = -Math.sin(yaw) * fwd + Math.cos(yaw) * str,
    dz = -Math.cos(yaw) * fwd - Math.sin(yaw) * str;
  const moving = !!(dx || dz);

  if (moving && me.seatSlot) {
    leaveSeat();
  }

  if (moving && !me.seatSlot) {
    const l = Math.hypot(dx, dz),
      sp = (running ? RUN : WALK) * dt;
    dx = (dx / l) * sp;
    dz = (dz / l) * sp;
    if (free(me.x + dx, me.y)) me.x += dx;
    if (free(me.x, me.y + dz)) me.y += dz;
  }

  if (mode === 'fps') me.r = yaw + Math.PI;
  else if (moving && !me.seatSlot) me.r = lerpAngle(me.r, Math.atan2(dx, dz), Math.min(1, dt * 14));

  if (me.h > 0 || me.vy > 0) {
    me.vy -= GRAVITY * dt;
    me.h = Math.max(0, me.h + me.vy * dt);
    if (me.h === 0) me.vy = 0;
  }

  // Check Couple Sofa Pairing & Campfire Proximity
  let myLean = 0;
  if (me.seatSlot) {
    const partner = findCouplePartner();
    if (partner) {
      myLean = me.seatSlot.lean || 0;
      if (now - lastCoupleHeart > 2200) {
        lastCoupleHeart = now;
        floaters.push({ e: '💕', who: net.selfId, t: Date.now() });
      }
    }
    me.loco = partner ? 'couple_sit' : 'sit';
  } else {
    me.loco = me.h > 0 ? 'jump' : moving ? (running ? 'run' : 'walk') : 'idle';
  }

  // Show/hide campfire action bar when sitting on campfire log or standing near campfire
  const nearCampfire =
    state.theme === 'christmas' &&
    (me.seatSlot?.campfire ||
      world.features.hotspots.some(h => h.type === 'campfire' && Math.hypot(h.x - me.x, h.y - me.y) <= h.radius));
  $('campfireBar').classList.toggle('hidden', !nearCampfire);

  // Update my 3D Avatar
  const av = me.av;
  av.root.position.set(me.x * TILE, me.h, me.y * TILE);
  av.root.rotation.y = me.r;
  av.setLocomotion(me.loco, { lean: myLean });
  av.update(dt);

  // 4. Contextual [E] Prompt Update
  activeTarget = findNearestInteractable();
  const promptEl = $('interactPrompt');
  if (activeTarget) {
    promptEl.textContent = activeTarget.prompt;
    promptEl.classList.remove('hidden');
  } else {
    promptEl.classList.add('hidden');
  }

  // 5. Periodic Vampire NPC Scare on Halloween Map
  if (state.theme === 'halloween' && now > nextVampireScareAt) {
    nextVampireScareAt = now + 15000 + Math.random() * 8000;
    // Trigger swoop scare on self (and broadcast to room)
    emitOp({ k: 'vampireScare', who: net.selfId, x: me.x, y: me.y });
  }

  // 6. Network Position Sync
  const cur = {
    x: me.x,
    y: me.y,
    r: me.r,
    a: me.loco,
    h: me.h,
    seatId: me.seatSlot?.id || null,
    lean: myLean,
  };
  if (
    now - lastSend > 85 &&
    (cur.a !== sent.a ||
      cur.seatId !== sent.seatId ||
      cur.lean !== sent.lean ||
      Math.abs(cur.x - sent.x) > 0.005 ||
      Math.abs(cur.y - sent.y) > 0.005 ||
      Math.abs(cur.r - sent.r) > 0.02 ||
      cur.h !== sent.h)
  ) {
    net.send('pos', cur);
    sent = cur;
    lastSend = now;
  }

  // 7. Update Peers
  peers.forEach(p => {
    const a = Math.min(1, dt * 10);
    p.x += (p.tx - p.x) * a;
    p.y += (p.ty - p.y) * a;
    p.h += ((p.th || 0) - p.h) * a;
    p.r = lerpAngle(p.r, p.tr ?? p.r, a);
    if (p.av) {
      p.av.root.position.set(p.x * TILE, p.h, p.y * TILE);
      p.av.root.rotation.y = p.r;
      p.av.setLocomotion(p.a, { lean: p.lean || 0 });
      p.av.update(dt);
    }
  });

  updateFloaters();
  world.sync(state, roomName);
  world.update(dt, { x: me.x * TILE, z: me.y * TILE });
  updateCamera();
  if (world.bgColor) renderer.setClearColor(world.bgColor, 1);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function updateFloaters() {
  const now = Date.now();
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i],
      age = (now - f.t) / 1000,
      who = f.who === net.selfId ? me : peers.get(f.who);
    if (age > 2.2 || !who) {
      if (f.s) scene.remove(f.s);
      floaters.splice(i, 1);
      continue;
    }
    if (!f.s) {
      f.s = emojiSprite(f.e, 0.78);
      scene.add(f.s);
    }
    f.s.position.set(who.x * TILE, (who.h || 0) + 2.2 + age * 0.65, who.y * TILE);
    f.s.material.opacity = 1 - age / 2.2;
  }
}

const solidForCamera = (x, z) => {
  const t = tileAt(Math.round(x / TILE), Math.round(z / TILE));
  return t === '#';
};
const _head = new THREE.Vector3(),
  _want = new THREE.Vector3(),
  _p = new THREE.Vector3(),
  _screenWorld = new THREE.Vector3(14.5 * TILE, 3.2, 2.0 * TILE + 0.27),
  _screenCam = new THREE.Vector3();

const cssEps = v => (Math.abs(v) < 1e-6 ? 0 : Math.round(v * 1e5) / 1e5);
function getCameraCSSMatrix(matrix) {
  const e = matrix.elements;
  return (
    'matrix3d(' +
    cssEps(e[0]) + ',' + cssEps(-e[1]) + ',' + cssEps(e[2]) + ',' + cssEps(e[3]) + ',' +
    cssEps(e[4]) + ',' + cssEps(-e[5]) + ',' + cssEps(e[6]) + ',' + cssEps(e[7]) + ',' +
    cssEps(e[8]) + ',' + cssEps(-e[9]) + ',' + cssEps(e[10]) + ',' + cssEps(e[11]) + ',' +
    cssEps(e[12]) + ',' + cssEps(-e[13]) + ',' + cssEps(e[14]) + ',' + cssEps(e[15]) + ')'
  );
}

// 666x294 px scaled by (11.1 / 666 = 1/60) => 11.1m x 4.9m exact 3D Cinema Screen size at (29, 3.2, 4.27)
const S_SCALE = 11.1 / 666;
const SCREEN_CSS_TRANSFORM =
  `matrix3d(${S_SCALE},0,0,0, 0,${-S_SCALE},0,0, 0,0,${S_SCALE},0, ${14.5 * TILE},3.2,${2.0 * TILE + 0.27},1) translate(-50%,-50%)`;
let lastCamCss = '';

function updateScreen3D() {
  const stage = $('css3d-stage');
  const camEl = $('css3d-camera');
  const box = $('mediaBox');
  if (!stage || !camEl || !box) return;

  camera.updateMatrixWorld();
  _screenCam.copy(_screenWorld).applyMatrix4(camera.matrixWorldInverse);
  const inFront = _screenCam.z < -0.4 && camera.position.z > 2.0 * TILE + 0.2;
  const showHole = isVideoVisible() && inFront;

  // Toggle WebGL depth-buffered transparent punch-out on the 3D screen mesh
  world.screenObj?.userData?.setHoleMode?.(showHole);

  if (!showHole) return;

  const fov = Math.round(camera.projectionMatrix.elements[5] * (innerHeight / 2) * 10) / 10;
  const nextCamCss =
    `translate3d(${innerWidth / 2}px,${innerHeight / 2}px,${fov}px) ` +
    getCameraCSSMatrix(camera.matrixWorldInverse);

  if (nextCamCss !== lastCamCss) {
    lastCamCss = nextCamCss;
    stage.style.perspective = fov + 'px';
    camEl.style.transform = nextCamCss;
  }
  if (box.style.transform !== SCREEN_CSS_TRANSFORM) {
    box.style.transform = SCREEN_CSS_TRANSFORM;
  }
}

function updateCamera() {
  const px = me.x * TILE,
    pz = me.y * TILE;
  const eyeH = me.seatSlot ? 1.25 : 1.55;
  if (mode === 'fps') {
    camera.position.set(px, me.h + eyeH, pz);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  } else {
    _head.set(px, me.h + eyeH, pz);
    const cp = Math.cos(pitch);
    _want
      .set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp)
      .multiplyScalar(-4.6)
      .add(_head);
    _want.x += Math.cos(yaw) * 0.65;
    _want.z += -Math.sin(yaw) * 0.65;
    let t = 1;
    for (let i = 1; i <= 16; i++) {
      _p.lerpVectors(_head, _want, i / 16);
      if (_p.y < 2.6 && solidForCamera(_p.x, _p.z)) {
        t = (i - 1) / 16;
        break;
      }
    }
    camera.position.lerpVectors(_head, _want, Math.max(t, 0.08));
    camera.position.y = Math.max(camera.position.y, 0.35);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }
  updateScreen3D();
}
