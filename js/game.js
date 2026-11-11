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
  getCurrentTime,
  getDuration,
  isPlayerPlaying,
  playVideo,
  pauseVideo,
  seekPlayer,
  syncPlayback,
} from './media.js';
import { World, TILE } from './world.js';
import { Avatar, loadCharacter, EMOTE_CLIP, hueFor, isAdminUser } from './avatar.js';
import { emojiSprite } from './props.js';
import { RtcManager } from './rtc.js';
import {
  initAudio,
  playBgm,
  toggleBgm,
  setBgmVolume,
  playSfx,
  isBgmMuted,
  getBgmVolume,
} from './audio.js';
import { MinigameManager } from './minigames.js';
import {
  initCasino,
  openRoulette,
  openDuckDerby,
  openBlackjack,
  openSlotMachine,
  openPlinko,
  getChips,
  addChips,
  resetChips,
  redeemCode,
  handleCasinoBroadcast,
  VALID_CODES,
} from './casino.js';

let rtc = null;
let minigames = null;

function initRtc(selfId) {
  if (rtc) {
    try {
      rtc.destroy();
    } catch {}
  }
  rtc = new RtcManager({
    selfId,
    sendSignal: (targetId, signal) => {
      net?.send('rtc_signal', signal, targetId);
    },
    onRemoteScreenTrack: (peerId, stream) => {
      updateScreenShareOnTv();
    },
    onPeerSpeakingChange: (peerId, isSpeaking) => {
      const p = peers.get(peerId);
      if (p?.av) p.av.setSpeaking(isSpeaking);
      updateLiveStats();
      renderSettingsModal();
    },
    onLocalSpeakingChange: isSpeaking => {
      if (me?.av) me.av.setSpeaking(isSpeaking);
      $('btnMic')?.classList.toggle('speaking', isSpeaking);
      $('voiceStatusBadge')?.classList.toggle('hidden', !isSpeaking);
      net?.send('voice_speaking', { speaking: isSpeaking });
      renderSettingsModal();
    },
    onMicStateChange: isEnabled => {
      updateMicUI(isEnabled);
    },
    onScreenShareChange: (isSharing, stream) => {
      updateScreenShareUI(isSharing, stream);
    },
    toast,
  });
}

// Unlock remote WebRTC audio playback on user gesture
window.addEventListener('pointerdown', () => rtc?.unlockAudioPlayback(), { passive: true });
window.addEventListener('keydown', () => rtc?.unlockAudioPlayback(), { passive: true });

function updateMicUI(isEnabled) {
  const btn = $('btnMic');
  if (btn) {
    btn.classList.toggle('mic-active', isEnabled);
    btn.textContent = isEnabled ? '🎙️ Mic' : '🔇 Mic';
    btn.title = isEnabled
      ? 'Microphone: Đang bật (Bấm hoặc nhấn phím M để tắt)'
      : 'Microphone: Đã tắt (Bấm hoặc nhấn phím M để nói)';
  }
  const hint = $('micMeterHint');
  if (hint) {
    hint.textContent = isEnabled ? 'Trạng thái: 🎙️ Micro đang hoạt động' : 'Trạng thái: 🔇 Đã tắt Micro';
    hint.style.color = isEnabled ? '#4ade80' : '#94a3b8';
  }
  const btnSettings = $('btnToggleMicSettings');
  if (btnSettings) {
    btnSettings.textContent = isEnabled ? '🔇 Tắt Micro' : '🎙️ Bật Micro';
  }
  if (!isEnabled) {
    $('voiceStatusBadge')?.classList.add('hidden');
    if (me?.av) me.av.setSpeaking(false);
  }
}

async function toggleMic() {
  if (!rtc) return;
  await rtc.toggleMic();
}

async function startScreenShare() {
  if (!rtc) return;
  if (rtc.isSharingScreen) {
    toast('ℹ️ Bạn đang chia sẻ màn hình rồi.');
    return;
  }
  if (state?.mediaCurrent?.kind === 'screen' && state.mediaCurrent.addedBy !== net?.selfId && !canControlTV(net?.selfId)) {
    toast('⚠️ TV đang được người khác dùng để chiếu màn hình!');
    return;
  }

  const stream = await rtc.startScreenShare();
  if (!stream) return;

  // Broadcast screen play operation to room
  emitOp({
    k: 'mediaPlayNow',
    item: {
      id: 'screen-' + net.selfId,
      kind: 'screen',
      title: 'Màn hình của ' + me.name,
      addedBy: net.selfId,
      addedByName: me.name,
      playing: true,
      at: Date.now(),
    },
  });
}

function stopScreenShare() {
  if (!rtc) return;
  rtc.stopScreenShare();
  if (state?.mediaCurrent?.kind === 'screen' && state.mediaCurrent.addedBy === net?.selfId) {
    emitOp({ k: 'mediaNext' });
  }
}

async function toggleScreenShare() {
  if (rtc?.isSharingScreen) {
    stopScreenShare();
  } else {
    await startScreenShare();
  }
}

function updateScreenShareUI(isSharing, stream) {
  const btnTop = $('btnShareScreen');
  if (btnTop) {
    btnTop.classList.toggle('screen-active', isSharing);
    btnTop.textContent = isSharing ? '🛑 Dừng chiếu TV' : '🖥️ Chiếu TV';
    btnTop.title = isSharing ? 'Đang chiếu màn hình (Bấm hoặc nhấn P để dừng)' : 'Chia sẻ màn hình máy tính lên TV lớn (Phím P)';
  }
  $('btnStopScreenBadge')?.classList.toggle('hidden', !isSharing);
  $('screenShareDialogBox')?.classList.toggle('hidden', !isSharing);
  $('cinemaStopShare')?.classList.toggle('hidden', !isSharing);
  updateScreenShareOnTv();
  updateMediaDialog();
}

function updateScreenShareOnTv() {
  const cur = state?.mediaCurrent;
  const screenVideo = $('screenTv');
  const cinemaVideo = $('cinemaVideo');
  if (!screenVideo) return;

  if (cur && cur.kind === 'screen') {
    const isMine = cur.addedBy === net?.selfId;
    let stream = null;
    if (isMine) {
      stream = rtc?.localScreenStream;
    } else {
      stream = rtc?.getRemoteScreenStream(cur.addedBy);
    }

    if (stream) {
      if (screenVideo.srcObject !== stream) {
        screenVideo.srcObject = stream;
        screenVideo.muted = isMine;
        screenVideo.play().catch(() => {});
      }
      if (cinemaVideo && cinemaVideo.srcObject !== stream) {
        cinemaVideo.srcObject = stream;
        cinemaVideo.muted = isMine;
        cinemaVideo.play().catch(() => {});
      }
      $('cinemaEmpty')?.classList.add('hidden');
    }
  } else {
    if (screenVideo.srcObject) {
      try {
        screenVideo.pause();
        screenVideo.srcObject = null;
      } catch {}
    }
    if (cinemaVideo && cinemaVideo.srcObject) {
      try {
        cinemaVideo.pause();
        cinemaVideo.srcObject = null;
      } catch {}
    }
    $('cinemaEmpty')?.classList.remove('hidden');
  }
}

function openCinemaMode() {
  openDialog('dlgCinema');
  const cur = state?.mediaCurrent;
  const isMine = cur?.addedBy === net?.selfId;
  const titleEl = $('cinemaTitle');
  const subEl = $('cinemaSub');
  if (titleEl) {
    titleEl.textContent = cur
      ? cur.kind === 'screen'
        ? `🖥️ Màn hình: ${cur.title || 'Screen Share'}`
        : `🎬 TV: ${cur.title || cur.vid}`
      : '🖥️ Rạp Chiếu TV — Xem Chung Màn Hình';
  }
  if (subEl) {
    subEl.textContent = cur ? `Người chiếu: ${cur.addedByName || 'Ẩn danh'}` : 'TV hiện chưa chiếu nội dung nào';
  }
  $('cinemaStopShare')?.classList.toggle('hidden', !(cur?.kind === 'screen' && isMine));
  updateScreenShareOnTv();
}

function toggleCinemaSound() {
  const vid = $('cinemaVideo');
  if (!vid) return;
  vid.muted = !vid.muted;
  toast(vid.muted ? '🔇 Đã tắt tiếng TV Theater' : '🔊 Đã bật tiếng TV Theater');
}

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
  JUMP_V = 8.5,
  GRAVITY = 20,
  RADIUS = 0.14;
const ACTION_COOLDOWN = 3000; // 3 seconds anti-spam cooldown for all actions/emotes

// ---------- Official Public Plazas (Always visible in Lobby so players gather together) ----------
const OFFICIAL_ROOMS = [
  { id: 'quang-truong-noel', title: 'Quảng Trường Giáng Sinh', theme: 'christmas', official: true },
  { id: 'lau-dai-halloween', title: 'Lâu Đài Halloween', theme: 'halloween', official: true },
  { id: 'pho-hoa-ngay-tet', title: 'Phố Hoa Ngày Tết', theme: 'tet', official: true },
  { id: 'vuon-tinh-yeu-valentine', title: 'Vườn Tình Yêu Valentine', theme: 'valentine', official: true },
];
const THEME_ICON = { christmas: '🎄', halloween: '🎃', tet: '🧧', valentine: '💝', casino: '🎰' };
export const SECRET_CASINO_ROOM = 'mat-that-casino-hoang-gia';

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
let camDist = 4.6,
  targetCamDist = 4.6;
let justLeftSeat = null;
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

// Admin state variables
let adminSpeedMultiplier = 1.0;
let adminJumpPower = 8.2;
let adminFlying = false;
let adminNoclip = false;
let adminGodMode = false;
window.adminGodMode = false;
let isFrozen = false;
let isJailed = false;
let jailedPos = null;
let currentGravity = 20;
let adminSpinUntil = 0;
let mobileMoveVector = { x: 0, y: 0 };
const adminBanList = new Set();
const adminMuteList = new Set();

const isHost = () => !!(state && net && state.hostId === net.selfId);

// FPS Counter state
let frameCount = 0,
  fpsLastTime = performance.now(),
  currentFps = 60;

// ---------- Three.js Setup ----------
let renderer, scene, camera, world;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: $('game'),
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1, 0.1, 300);
  world = new World(scene);
  minigames = new MinigameManager(scene, camera, () => me, () => peers, emitOp, toast, floaters);
  initAudio();
  initCasino(world, toast, emitOp, () => me, () => peers);
  initMobileControls();
} catch (e) {
  console.error(e);
  document.addEventListener('DOMContentLoaded', () => toast('Trình duyệt không hỗ trợ WebGL'));
}

function initMobileControls() {
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth <= 840;
  const container = $('mobileControls');
  if (!container) return;

  if (isTouch) {
    container.classList.remove('hidden');
  }

  const joystickZone = $('joystickZone');
  const joystickBase = $('joystickBase');
  const joystickThumb = $('joystickThumb');
  let touchId = null;
  let baseRect = null;
  const maxRadius = 38;

  if (joystickZone && joystickBase && joystickThumb) {
    const handleTouchStart = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touchId === null) {
          touchId = touch.identifier;
          baseRect = joystickBase.getBoundingClientRect();
          updateJoystick(touch.clientX, touch.clientY);
          break;
        }
      }
    };

    const handleTouchMove = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchId) {
          updateJoystick(touch.clientX, touch.clientY);
          break;
        }
      }
    };

    const handleTouchEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchId) {
          touchId = null;
          mobileMoveVector.x = 0;
          mobileMoveVector.y = 0;
          joystickThumb.style.transform = 'translate(-50%, -50%)';
          break;
        }
      }
    };

    const updateJoystick = (clientX, clientY) => {
      if (!baseRect) baseRect = joystickBase.getBoundingClientRect();
      const centerX = baseRect.left + baseRect.width / 2;
      const centerY = baseRect.top + baseRect.height / 2;
      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      mobileMoveVector.x = dx / maxRadius;
      mobileMoveVector.y = -dy / maxRadius;
    };

    joystickZone.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  }

  const btnJump = $('btnMobileJump');
  if (btnJump) {
    btnJump.addEventListener('touchstart', (e) => {
      e.preventDefault();
      doPlayerJump();
    });
    btnJump.addEventListener('click', (e) => {
      e.preventDefault();
      doPlayerJump();
    });
  }

  const btnInteract = $('btnMobileInteract');
  if (btnInteract) {
    btnInteract.addEventListener('touchstart', (e) => {
      e.preventDefault();
      triggerInteract(activeTarget);
    });
    btnInteract.addEventListener('click', (e) => {
      e.preventDefault();
      triggerInteract(activeTarget);
    });
  }

  const btnAction = $('btnMobileAction');
  if (btnAction) {
    btnAction.addEventListener('touchstart', (e) => {
      e.preventDefault();
      minigames?.triggerAction();
    });
    btnAction.addEventListener('click', (e) => {
      e.preventDefault();
      minigames?.triggerAction();
    });
  }

  const btnEmote = $('btnMobileEmote');
  if (btnEmote) {
    btnEmote.addEventListener('touchstart', (e) => {
      e.preventDefault();
      toggleEmoteMenu();
    });
    btnEmote.addEventListener('click', (e) => {
      e.preventDefault();
      toggleEmoteMenu();
    });
  }
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
  if (k === 'casino') continue; // Casino là map ẩn / mật thất bí mật, giấu hoàn toàn khỏi menu công khai!
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
  loopRunning = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
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
    if (p.av) {
      scene.remove(p.av.root);
      p.av.destroy?.();
    }
  });
  peers.clear();
  if (me?.av) {
    scene.remove(me.av.root);
    me.av.destroy?.();
    me.av = null;
  }
  if (me) me.started = false;
  state = null;
  gotState = false;
  // Stop WebRTC Voice Chat & Screen Share
  try {
    rtc?.destroy();
  } catch {}
  rtc = null;
  updateMicUI(false);
  updateScreenShareUI(false, null);
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
  const selectedTheme = off ? off.theme : (roomName === SECRET_CASINO_ROOM ? 'casino' : (theme || 'christmas'));
  isKicked = false;
  gotState = false;

  location.hash = 'room=' + roomName;
  $('landing').classList.add('hidden');
  $('dlgKicked').classList.add('hidden');
  $('btnCloseLobby').classList.remove('hidden');

  const savedTitle = localStorage.getItem('gh_selected_title') || (isAdminVerified() ? '👑 ADMIN' : '');
  me = {
    name,
    title: savedTitle,
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
  initRtc(net.selfId);
  $('roomInfo').textContent = `📍 ${roomTitle}`;
  updateLiveStats();

  initPlayer('yt', onMediaEnded, onPlayerStateChanged);

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
    title: me.title,
    hue: me.hue,
    costume: me.costume,
    pumpkinHat: me.pumpkinHat,
  });
  me.av.label.visible = false;
  scene.add(me.av.root);

  const offOfficial = OFFICIAL_ROOMS.find(o => o.id === roomName);
  if (offOfficial && state.theme === 'casino') {
    state.theme = offOfficial.theme;
    state.map = buildThemeMap(offOfficial.theme);
  }

  // Immediately synchronize 3D world before starting animation loop
  world.sync(state, roomName);

  $('topTheme').value = state.theme;
  $('topTheme').classList.toggle('hidden', roomName === SECRET_CASINO_ROOM);
  $('statFps').textContent = '⚡ 60 FPS';
  playBgm(state.theme);
  minigames?.setTheme(state.theme);
  net.send('hello', pubInfo());
  applyMedia(state.mediaCurrent);
  updateHud();
  updateHostUI();
  updateStatusBadges();
  updateMediaDialog();
  updateLiveStats();
  updateCasinoChipsUI();
  updateAdminUIStatus();
  broadcastMyRoomToLobby();

  if (!loopRunning) {
    loopRunning = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }
}

const pubInfo = () => ({
  name: me.name,
  title: me.title || '',
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
  const selfSpeaking = me?.av?.isSpeaking;
  const selfMicLabel = selfSpeaking
    ? '<span style="color:#4ade80;font-weight:700">🎙️ Đang nói…</span>'
    : rtc?.isMicMuted
    ? '<span style="color:#94a3b8">🔇 Mic tắt</span>'
    : '<span style="color:#38bdf8">🎙️ Mic bật</span>';
  selfRow.innerHTML = `<span><b>👤 ${me.name} (Bạn)</b> ${state.hostId === net.selfId ? '👑' : ''} ${selfMicLabel}</span><span style="color:#4ade80">Đang online</span>`;
  pList.appendChild(selfRow);

  // Peer rows
  peers.forEach((p, id) => {
    const row = document.createElement('div');
    row.className = 'queue-item';
    const left = document.createElement('span');
    const peerSpeaking = p.av?.isSpeaking;
    const peerVoiceTag = peerSpeaking ? '<span style="color:#4ade80;font-weight:700"> 🎙️ Đang nói…</span>' : '';
    left.innerHTML = `👤 <b>${p.name}</b> ${state.hostId === id ? '👑 <small>(Chủ phòng)</small>' : ''}${peerVoiceTag}`;
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
  rtc?.getOrCreatePeer(id);
  let p = peers.get(id);
  const isNew = !p;
  if (!p) {
    p = { x: d.x ?? 14.5, y: d.y ?? 18.5, r: d.r ?? 0, h: 0, a: 'idle' };
    peers.set(id, p);
  }
  Object.assign(p, {
    name: d.name || p.name || 'Khách',
    title: d.title || p.title || '',
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
    p.av.setName(p.name, p.title);
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
    title: p.title,
    hue: p.hue,
    costume: p.costume,
    pumpkinHat: p.pumpkinHat,
  });
  p.av.setHeldItem(p.heldItem);
  scene.add(p.av.root);
  p.loading = false;
  if (isNew) {
    toast(`👋 ${p.name} đã tham gia phòng!`);
    logChat('🔔 Hệ thống', `${p.name} đã tham gia phòng!`, { isSystem: true });
  }
}

const handlers = {
  join(id) {
    rtc?.getOrCreatePeer(id);
    if (me?.started && !isKicked) {
      if (state?.kickedIds?.includes(id)) {
        net.send('op', { k: 'kick', targetId: id, byHost: state.hostId, v: Date.now() }, id);
        return;
      }
      net.send('hello', pubInfo(), id);
      if (state?.mediaCurrent?.vid && canControlTV(net.selfId)) {
        const curT = getCurrentTime();
        if (curT != null && curT > 0) {
          state.mediaCurrent.t = curT;
          state.mediaCurrent.at = Date.now();
          state.mediaCurrent.playing = isPlayerPlaying();
        }
      }
      net.send('state', state, id);
    }
  },
  leave(id) {
    rtc?.removePeer(id);
    if (state?.mediaCurrent?.kind === 'screen' && state.mediaCurrent.addedBy === id) {
      state.mediaCurrent = null;
      applyMedia(null);
      updateScreenShareOnTv();
      updateMediaDialog();
      toast('📺 Người chia sẻ màn hình đã rời phòng.');
    }
    const p = peers.get(id);
    if (p) {
      toast(`${p.name} đã rời phòng`);
      logChat('🔔 Hệ thống', `${p.name} đã rời phòng.`, { isSystem: true });
      if (p.av) {
        scene.remove(p.av.root);
        p.av.destroy?.();
      }
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
    rtc?.getOrCreatePeer(id);
  },
  rtc_signal(d, id) {
    rtc?.handleSignal(id, d);
  },
  voice_speaking(d, id) {
    const p = peers.get(id);
    if (p?.av) p.av.setSpeaking(!!d?.speaking);
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

    const offOfficial = OFFICIAL_ROOMS.find(o => o.id === roomName);
    if (offOfficial && state.theme === 'casino') {
      state.theme = offOfficial.theme;
      state.map = buildThemeMap(offOfficial.theme);
    }

    if (first) {
      start();
    } else {
      if (state.passHash && state.hostId !== net.selfId && verifiedPassHash !== state.passHash) {
        promptRoomPassword({ id: roomName, title: state.roomTitle || roomName, passHash: state.passHash });
      }
      $('topTheme').value = state.theme;
      $('topTheme').classList.toggle('hidden', roomName === SECRET_CASINO_ROOM);
      playBgm(state.theme);
      minigames?.setTheme(state.theme);
      applyMedia(state.mediaCurrent);
      updateScreenShareOnTv();
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
      logChat(p.name, d.t, { fromId: id, hue: d.hue || p.hue });
    }
  },
  emote(d, id) {
    if (state?.kickedIds?.includes(id)) return;
    const p = peers.get(id);
    if (!p) return;
    p.av?.playEmote(d.clip || EMOTE_CLIP[d.e] || 'wave', d.hold ?? true);
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
      if (op.theme === 'casino' && roomName !== SECRET_CASINO_ROOM) {
        toast('⚠️ Casino là căn phòng mật thất bí mật, không thể đổi chủ đề phòng sang Casino!');
        return;
      }
      if (THEMES[op.theme]) {
        state.theme = op.theme;
        state.map = buildThemeMap(op.theme);
        state.decor = [];
        if ($('topTheme')) $('topTheme').value = op.theme;
        leaveSeat();
        playBgm(op.theme);
        minigames?.setTheme(op.theme);
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
        if (p.av) {
          scene.remove(p.av.root);
          p.av.destroy?.();
        }
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
      if (!state.mediaCurrent || (!state.mediaCurrent.vid && !state.mediaCurrent.url && state.mediaCurrent.kind !== 'screen')) {
        state.mediaCurrent = { ...op.item, playing: true, t: 0, at: Date.now() };
        applyMedia(state.mediaCurrent);
        updateScreenShareOnTv();
        toast(`🎬 Đang phát ${op.item.kind === 'screen' ? 'màn hình' : 'video'} của ${op.item.addedByName}`);
      } else {
        state.mediaQueue.push(op.item);
        toast(`📋 Đã thêm vào hàng chờ (#${state.mediaQueue.length})`);
      }
      updateMediaDialog();
      break;
    }
    case 'mediaPlayNow': {
      // Replace what is on the TV right now (only host / current owner / anyone when TV is idle)
      if (senderId && !canControlTV(senderId)) return;
      state.mediaCurrent = { ...op.item, playing: true, t: 0, at: Date.now() };
      applyMedia(state.mediaCurrent);
      updateScreenShareOnTv();
      updateMediaDialog();
      const kindLabel = op.item.kind === 'screen' ? 'màn hình máy tính' : op.item.kind === 'web' ? 'trang web' : 'video';
      toast(`📺 ${op.item.addedByName} vừa chiếu ${kindLabel} lên TV`);
      break;
    }
    case 'mediaNext': {
      if (senderId && !canControlTV(senderId)) return;
      state.mediaQueue = state.mediaQueue || [];
      const next = state.mediaQueue.shift() || null;
      state.mediaCurrent = next ? { ...next, playing: true, t: 0, at: Date.now() } : null;
      applyMedia(state.mediaCurrent);
      updateScreenShareOnTv();
      updateMediaDialog();
      if (next) toast(`⏭ Chuyển sang nội dung tiếp theo của ${next.addedByName}`);
      else toast('⏹ Đã dừng chiếu trên TV');
      break;
    }
    case 'mediaPlayPause': {
      if (senderId && !canControlTV(senderId)) return;
      if (!state.mediaCurrent || state.mediaCurrent.id !== op.id) return;
      state.mediaCurrent.playing = op.playing;
      state.mediaCurrent.t = op.t;
      state.mediaCurrent.at = op.at || Date.now();
      if (senderId !== net?.selfId) {
        if (op.playing) playVideo();
        else pauseVideo();
        syncPlayback(state.mediaCurrent);
      }
      updateMediaDialog();
      toast(op.playing ? `▶ ${op.byName || 'Người điều khiển'} đã tiếp tục phát video` : `⏸ ${op.byName || 'Người điều khiển'} đã tạm dừng video`);
      break;
    }
    case 'mediaSeek': {
      if (senderId && !canControlTV(senderId)) return;
      if (!state.mediaCurrent || state.mediaCurrent.id !== op.id) return;
      state.mediaCurrent.t = op.t;
      state.mediaCurrent.playing = op.playing;
      state.mediaCurrent.at = op.at || Date.now();
      if (senderId !== net?.selfId) {
        seekPlayer(op.t);
        syncPlayback(state.mediaCurrent);
      }
      updateMediaProgressUI();
      break;
    }
    case 'mediaSync': {
      if (senderId && !canControlTV(senderId)) return;
      if (!state.mediaCurrent || state.mediaCurrent.id !== op.id) return;
      state.mediaCurrent.t = op.t;
      state.mediaCurrent.playing = op.playing;
      state.mediaCurrent.at = op.at || Date.now();
      if (senderId !== net?.selfId) {
        syncPlayback(state.mediaCurrent);
      }
      updateMediaProgressUI();
      break;
    }
    case 'mediaStop': {
      if (senderId && !canControlTV(senderId)) return;
      state.mediaCurrent = null;
      stopMedia();
      updateMediaDialog();
      toast(`⏹ ${op.byName || 'Người điều khiển'} đã tắt màn hình TV`);
      break;
    }
    case 'tvScroll': {
      if (senderId && !canControlTV(senderId)) return;
      if (state?.mediaCurrent?.kind === 'web') {
        const box = $('mediaBox');
        if (box && senderId !== net?.selfId) {
          box.scrollTo({ top: Math.max(0, op.y || 0), behavior: 'smooth' });
        }
      }
      break;
    }
    case 'admin_sm': {
      showAdminServerBanner(`📢 [ADMIN ${op.by}]: ${op.text}`);
      logChat(`📢 ADMIN ${op.by}`, op.text, { isSystem: true });
      break;
    }
    case 'admin_freeze': {
      if (op.target === me.name || op.target === 'all') {
        isFrozen = !!op.frozen;
        toast(isFrozen ? '🧊 Bạn đã bị Admin đóng băng!' : '🔥 Bạn đã được giải phóng!');
      }
      break;
    }
    case 'admin_jail': {
      if (op.target === me.name || op.target === 'all') {
        isJailed = !!op.jailed;
        if (isJailed) {
          jailedPos = { x: me.x, y: me.y };
          toast('⛓️ Bạn đã bị Admin nhốt vào lồng giam!');
        } else {
          jailedPos = null;
          toast('🔓 Bạn đã được thả tự do khỏi lồng giam!');
        }
      }
      break;
    }
    case 'admin_teleport': {
      if (op.target === me.name || op.target === 'all') {
        me.x = op.toX;
        me.y = op.toY;
        me.h = 0;
        toast(`🌀 Bạn vừa bị Admin ${op.by} dịch chuyển tức thời!`);
      }
      break;
    }
    case 'admin_kill': {
      if (op.target === me.name || op.target === 'all') {
        me.x = 14.5;
        me.y = 18.5;
        me.h = 0;
        toast(`💀 Bạn đã bị Admin ${op.by} hạ gục! Đang hồi sinh tại sảnh...`);
      }
      break;
    }
    case 'admin_respawn': {
      if (op.target === me.name || op.target === 'all') {
        me.x = 14.5;
        me.y = 18.5;
        me.h = 0;
        toast('✨ Bạn đã được hồi sinh!');
      }
      break;
    }
    case 'admin_blind': {
      if (op.target === me.name || op.target === 'all') {
        if (op.blind) {
          document.body.classList.add('blinded-screen');
          toast('🕶️ Bạn đã bị Admin làm mù mắt tạm thời!');
        } else {
          document.body.classList.remove('blinded-screen');
          toast('👀 Mắt bạn đã sáng trở lại!');
        }
      }
      break;
    }
    case 'admin_size': {
      if (op.target === me?.name || op.target === 'all') {
        if (me?.av) me.av.root.scale.set(op.scale, op.scale, op.scale);
      }
      if (op.target !== me?.name) {
        if (op.target === 'all') {
          peers.forEach(p => {
            if (p.av) p.av.root.scale.set(op.scale, op.scale, op.scale);
          });
        } else {
          const pEntry = findPeerByName(op.target);
          if (pEntry && pEntry[1].av) {
            pEntry[1].av.root.scale.set(op.scale, op.scale, op.scale);
          }
        }
      }
      break;
    }
    case 'admin_fire': {
      if (op.target === me?.name || op.target === 'all') {
        playSfx('firecracker', 'tet');
        me.av?.showTomatoSplat?.();
        toast('🔥 Bạn đang bị Admin đốt lửa bốc khói dữ dội!');
      }
      break;
    }
    case 'admin_gravity': {
      currentGravity = op.gravity;
      toast(`🌍 Trọng lực thế giới đã thay đổi: ${currentGravity}`);
      break;
    }
    case 'casino_broadcast': {
      handleCasinoBroadcast(op);
      break;
    }
    case 'admin_spin': {
      if (op.target === me?.name || op.target === 'all') {
        adminSpinUntil = performance.now() + 6500;
        toast('💫 Bạn bị Admin làm xoay mòng mòng chóng mặt!');
      }
      break;
    }
    case 'admin_disco': {
      document.body.classList.toggle('disco-active');
      toast('🪩 Bữa tiệc Disco Admin đã được kích hoạt!');
      break;
    }
    case 'admin_earthquake': {
      document.body.classList.add('earthquake-active');
      playSfx('explosion', 'tet');
      toast('🌋 CẢNH BÁO ĐỘNG ĐẤT TỪ ADMIN! Màn hình rung lắc dữ dội!');
      setTimeout(() => document.body.classList.remove('earthquake-active'), 5500);
      break;
    }
    case 'admin_nuke': {
      const flash = document.createElement('div');
      flash.className = 'nuke-flash-overlay';
      document.body.appendChild(flash);
      playSfx('explosion', 'tet');
      toast('💥 BOM HẠT NHÂN ADMIN VỪA KÍCH NỔ!');
      setTimeout(() => flash.remove(), 2600);
      break;
    }
    case 'admin_rocket': {
      if (op.target === me?.name || op.target === 'all') {
        me.vy = 42;
        me.h += 3;
        playSfx('firework_rocket', 'tet');
        toast('🚀 VÚT! Bạn đã bị Admin phóng lên chín tầng mây!');
      }
      break;
    }
    case 'admin_slap': {
      if (op.target === me?.name || op.target === 'all') {
        me.vy = 6;
        me.h += 0.8;
        me.x += (Math.random() - 0.5) * 4;
        me.y += (Math.random() - 0.5) * 4;
        me.av?.showTomatoSplat?.();
        playSfx('splat', 'halloween');
        toast(`🍅 BỐP! Bạn vừa bị Admin ${op.by} tát lộn mèo + Cà chua dính đầy mặt!`);
      }
      break;
    }
    case 'admin_dance': {
      if (op.target === me?.name || op.target === 'all') {
        me.av?.playEmote?.('dance');
        toast('💃 Nhạc lên là quẩy! Toàn server cùng nhảy múa!');
      }
      break;
    }
    case 'admin_clown': {
      if (op.target === me?.name || op.target === 'all') {
        me.pumpkinHat = me.pumpkinHat ? null : 'classic';
        me.av?.setPumpkinHat?.(me.pumpkinHat);
        syncMyAppearance();
        toast('🤡 Bạn vừa bị Admin phong làm Chú Hề của phòng!');
      }
      break;
    }
    case 'admin_reset_all': {
      adminSpeedMultiplier = 1.0;
      adminJumpPower = 8.2;
      adminFlying = false;
      adminNoclip = false;
      adminGodMode = false;
      window.adminGodMode = false;
      isFrozen = false;
      isJailed = false;
      jailedPos = null;
      currentGravity = 20;
      adminSpinUntil = 0;
      document.body.classList.remove('blinded-screen', 'earthquake-active', 'disco-active');
      if (me?.av) {
        me.av.root.scale.set(1, 1, 1);
        me.av.root.visible = true;
      }
      peers.forEach(p => {
        if (p.av) {
          p.av.root.scale.set(1, 1, 1);
          p.av.root.visible = true;
        }
      });
      toast('✨ Tất cả hiệu ứng troll đã được khôi phục về trạng thái ban đầu!');
      break;
    }
    case 'mg_snowball_throw':
    case 'mg_cupid_shoot':
    case 'mg_tet_cannon':
    case 'mg_pvp_ko': {
      minigames?.handleNetworkOp(op);
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

// ---------- Chat, Chat History & Emotes ----------
const chatHistory = [];
let unreadChatCount = 0;

function formatChatTime(date = new Date()) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function logChat(name, text, { isSystem = false, hue = null, fromId = null } = {}) {
  const isMe = name === me?.name;
  const item = {
    id: uid(),
    time: formatChatTime(),
    name,
    text,
    isMe,
    isSystem,
    hue: hue ?? (isMe ? me?.hue : (peers.get(fromId)?.hue || hueFor(name))),
  };

  chatHistory.push(item);
  if (chatHistory.length > 500) chatHistory.shift();

  // 1. Render in bottom-left floating HUD log
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble' + (isSystem ? ' system' : '');
  const nameSpan = document.createElement('b');
  nameSpan.textContent = name + ': ';
  if (!isSystem && item.hue !== undefined) {
    nameSpan.style.color = `hsl(${item.hue}, 80%, 72%)`;
  }
  bubble.appendChild(nameSpan);
  bubble.appendChild(document.createTextNode(text));

  const logBox = $('chatLog');
  if (logBox) {
    logBox.appendChild(bubble);
    while (logBox.children.length > 10) logBox.firstChild.remove();
    setTimeout(() => {
      if (bubble.parentNode) {
        bubble.style.opacity = '0';
        setTimeout(() => bubble.remove(), 400);
      }
    }, 28000);
  }

  // 2. Update Chat History modal if open or update unread badge if closed
  const dlgOpen = !$('dlgChatHistory')?.classList.contains('hidden');
  if (dlgOpen) {
    appendChatHistoryItem(item);
  } else if (!isMe) {
    unreadChatCount++;
    const badge = $('unreadChatBadge');
    if (badge) {
      badge.textContent = unreadChatCount;
      badge.classList.remove('hidden');
    }
  }

  const countEl = $('chatHistoryCount');
  if (countEl) countEl.textContent = chatHistory.length;
}

function appendChatHistoryItem(item) {
  const list = $('chatHistoryList');
  if (!list) return;

  const emptyHint = list.querySelector('.hint');
  if (emptyHint) emptyHint.remove();

  const el = document.createElement('div');
  el.className = 'chat-history-item' + (item.isMe ? ' is-me' : '') + (item.isSystem ? ' system' : '');

  const meta = document.createElement('div');
  meta.className = 'chat-item-meta';

  const timeEl = document.createElement('span');
  timeEl.className = 'chat-item-time';
  timeEl.textContent = `[${item.time}]`;

  const nameEl = document.createElement('span');
  nameEl.className = 'chat-item-name';
  nameEl.textContent = item.name + (item.isMe ? ' (Bạn)' : '');
  if (!item.isSystem && item.hue !== undefined) {
    nameEl.style.color = `hsl(${item.hue}, 80%, 75%)`;
  }

  meta.appendChild(timeEl);
  meta.appendChild(nameEl);

  const textEl = document.createElement('div');
  textEl.className = 'chat-item-text';
  textEl.textContent = item.text;

  el.appendChild(meta);
  el.appendChild(textEl);
  list.appendChild(el);

  list.scrollTop = list.scrollHeight;
}

function renderChatHistory(filterText = '') {
  const list = $('chatHistoryList');
  if (!list) return;
  list.innerHTML = '';

  const q = (filterText || '').trim().toLowerCase();
  const filtered = q
    ? chatHistory.filter(i => i.text.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
    : chatHistory;

  if (!filtered.length) {
    list.innerHTML = `<div class="hint" style="text-align:center;padding:25px">${
      q ? 'Không tìm thấy tin nhắn phù hợp.' : 'Chưa có tin nhắn nào trong phòng. Hãy bắt đầu trò chuyện! 👋'
    }</div>`;
    return;
  }

  filtered.forEach(item => appendChatHistoryItem(item));
}

function openChatHistory() {
  unreadChatCount = 0;
  $('unreadChatBadge')?.classList.add('hidden');
  if ($('chatHistoryRoomName')) $('chatHistoryRoomName').textContent = roomTitle || roomName || 'Phòng hiện tại';
  if ($('chatHistoryCount')) $('chatHistoryCount').textContent = chatHistory.length;
  openDialog('dlgChatHistory');
  renderChatHistory($('inSearchChat')?.value || '');
  setTimeout(() => $('chatHistoryIn')?.focus(), 60);
}

function sendChatMessage(text) {
  const t = (text || '').trim();
  if (!t || !me) return;
  if (t.startsWith(':') || t.startsWith(';') || t.startsWith('/')) {
    const handled = executeAdminCommand(t);
    if (handled) return;
  }
  if (adminMuteList.has(me.name.toLowerCase())) {
    toast('🔇 Bạn đã bị Admin cấm phát ngôn trong phòng!');
    return;
  }
  me.av?.say(t);
  logChat(me.name, t, { isMe: true, hue: me.hue });
  net?.send('chat', { t, hue: me.hue });
}

$('chatIn').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter' && e.target.value.trim()) {
    sendChatMessage(e.target.value);
    e.target.value = '';
    e.target.blur();
  }
  if (e.key === 'Escape') e.target.blur();
});

$('chatLog').onclick = () => openChatHistory();
$('btnOpenChatHistory').onclick = () => openChatHistory();
$('btnChatHistoryTop').onclick = () => openChatHistory();

$('chatHistoryIn').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter' && e.target.value.trim()) {
    sendChatMessage(e.target.value);
    e.target.value = '';
  }
});
$('btnSendChatHistory').onclick = () => {
  if ($('chatHistoryIn').value.trim()) {
    sendChatMessage($('chatHistoryIn').value);
    $('chatHistoryIn').value = '';
    $('chatHistoryIn').focus();
  }
};
$('inSearchChat').oninput = e => {
  renderChatHistory(e.target.value);
};

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

function doSocialAction(emoji, clip, toPeerId = null, hold = true) {
  // Emotes switch immediately with zero latency; only projectile tomato has cooldown
  if (clip === 'throwTomato' && !checkCooldown()) return;
  me.av?.playEmote(clip, hold);
  floaters.push({ e: emoji, who: 'me', t: Date.now() });
  net.send('emote', { e: emoji, clip, to: toPeerId, hold });

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
const mediaLabel = item => {
  if (item.kind === 'screen') return '🖥️ Màn hình máy tính: ' + (item.title || 'Screen Share');
  if (item.kind === 'web') return '🌐 ' + (item.title || item.url);
  return 'Video YouTube ' + item.vid;
};

// Controller callback when YouTube player state changes on the local machine
function onPlayerStateChanged(newState, time) {
  if (!state?.mediaCurrent?.vid || state.mediaCurrent.kind === 'web') return;
  if (!canControlTV(net?.selfId)) return;
  const isPlaying = newState === 'PLAYING';
  if (state.mediaCurrent.playing !== isPlaying) {
    state.mediaCurrent.playing = isPlaying;
    state.mediaCurrent.t = time;
    state.mediaCurrent.at = Date.now();
    emitOp({
      k: 'mediaPlayPause',
      id: state.mediaCurrent.id,
      playing: isPlaying,
      t: time,
      byName: me.name,
    });
  }
}

// Strictly verify who has permission to control the TV:
// ONLY the person who uploaded / added the current video is allowed to control it!
// Fallback: If the owner left the room, allow the Host or remaining players so TV is not locked.
function canControlTV(userId = net?.selfId) {
  if (!state) return false;
  const cur = state.mediaCurrent;
  if (!cur || (!cur.vid && !cur.url && cur.kind !== 'screen')) return true; // TV is idle: anyone can play
  const ownerId = cur.addedBy;
  if (!ownerId) return true;

  // If the person who added this video is still present in the room:
  // ONLY they are allowed to control it!
  const isOwnerPresent = ownerId === net?.selfId || peers.has(ownerId);
  if (isOwnerPresent) {
    return ownerId === userId;
  }

  // If the original owner has left the room:
  if (userId && userId === state.hostId) return true;
  return true;
}

function canSkipCurrentMedia() {
  if (!state?.mediaCurrent || (!state.mediaCurrent.vid && !state.mediaCurrent.url && state.mediaCurrent.kind !== 'screen')) return false;
  return canControlTV(net?.selfId);
}

function formatMediaTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

let isUserDraggingSeek = false;

function updateMediaProgressUI() {
  const cur = state?.mediaCurrent;
  const bar = $('mediaPlaybackBar');
  if (!bar) return;
  if (!cur || !cur.vid || cur.kind === 'web') {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');

  const canCtrl = canControlTV(net?.selfId);
  $('mediaPlayPause').disabled = !canCtrl;
  $('mediaStop').disabled = !canCtrl;
  $('mediaSeek').disabled = !canCtrl;
  $('mediaPlayPause').textContent = isPlayerPlaying() ? '⏸ Tạm dừng' : '▶ Tiếp tục';

  if (!isUserDraggingSeek) {
    const curTime = getCurrentTime();
    const duration = getDuration() || 100;
    $('mediaSeek').max = Math.floor(duration);
    $('mediaSeek').value = Math.floor(curTime);
    $('mediaTime').textContent = `${formatMediaTime(curTime)} / ${formatMediaTime(duration)}`;
  }
}

setInterval(() => {
  if (state?.mediaCurrent?.vid && !$('dlgMedia').classList.contains('hidden')) {
    updateMediaProgressUI();
  }
}, 500);

// Heartbeat sync loop: controller broadcasts video position & play status to all peers
setInterval(() => {
  if (!net?.selfId || !state?.mediaCurrent?.vid || state.mediaCurrent.kind === 'web') return;
  if (!canControlTV(net.selfId)) return;
  const curTime = getCurrentTime();
  const isPl = isPlayerPlaying();
  state.mediaCurrent.t = curTime;
  state.mediaCurrent.playing = isPl;
  state.mediaCurrent.at = Date.now();
  net.send('op', {
    k: 'mediaSync',
    id: state.mediaCurrent.id,
    vid: state.mediaCurrent.vid,
    t: curTime,
    playing: isPl,
    at: Date.now(),
  });
}, 1500);

function updateMediaDialog() {
  if (!state) return;
  const q = state.mediaQueue || [];
  const cur = state.mediaCurrent;
  const hasMedia = !!(cur && (cur.vid || cur.url || cur.kind === 'screen'));
  $('queueCount').textContent = (hasMedia ? 1 : 0) + q.length;

  const nowBox = $('nowPlayingBox');
  if (hasMedia) {
    const isMine = cur.addedBy === net?.selfId;
    const canCtrl = canControlTV(net?.selfId);
    const perm = canCtrl
      ? '<br><span style="color:#4ade80">👑 <b>Bạn đang điều khiển màn hình này</b> (Tạm dừng, tua, skip, tắt)</span>'
      : `<br><span style="color:#fbbf24">🔒 <b>Đang xem đồng bộ với ${escHtml(cur.addedByName)}</b> (Chỉ người thêm video mới được điều khiển)</span>`;
    nowBox.innerHTML =
      '<b>▶ Đang chiếu trên màn hình lớn:</b> ' +
      escHtml(mediaLabel(cur)) +
      '<br>Người chiếu: <b>' +
      escHtml(cur.addedByName) +
      '</b>' +
      (isMine ? ' (bạn)' : '') +
      ' ' +
      perm;
  } else {
    nowBox.innerHTML = '<i>TV đang trống. Bấm “Share màn hình” hoặc dán link YouTube/Website rồi bấm “Phát ngay”!</i>';
  }

  const isSharing = !!rtc?.isSharingScreen;
  $('screenShareDialogBox')?.classList.toggle('hidden', !isSharing);
  const canCtrl = canControlTV(net?.selfId);
  $('mediaSkip').disabled = !canSkipCurrentMedia();
  $('mediaBypassAd').disabled = !canCtrl;
  $('mediaBypassAd').classList.toggle('hidden', !!cur && (cur.kind === 'web' || cur.kind === 'screen'));
  updateMediaProgressUI();
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
  // Only the person allowed to control the TV triggers the auto-advance op
  if (!state?.mediaCurrent || state.mediaCurrent.id !== finishedMedia?.id) return;
  if (state.mediaCurrent.kind === 'web') return;
  if (canSkipCurrentMedia()) {
    emitOp({ k: 'mediaNext' });
  }
}

function triggerBypassAd() {
  if (!canControlTV(net?.selfId)) {
    return toast(`⚠️ Chỉ ${state.mediaCurrent?.addedByName || 'người thêm video'} mới có quyền điều khiển TV.`);
  }
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
  if (!forceQueue && (cur?.vid || cur?.url)) {
    if (canControlTV(net.selfId)) {
      emitOp({ k: 'mediaPlayNow', item });
    } else {
      emitOp({ k: 'mediaQueue+', item });
      toast(`📋 TV đang do ${cur.addedByName || 'người khác'} điều khiển — đã xếp video của bạn vào hàng chờ.`);
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

// Controls for media playback bar (Play/Pause, Stop, Seek)
$('mediaPlayPause').onclick = () => {
  if (!canControlTV(net?.selfId)) {
    return toast(`⚠️ Chỉ ${state.mediaCurrent?.addedByName || 'người thêm video'} mới có quyền điều khiển màn hình!`);
  }
  if (!state.mediaCurrent?.vid) return;
  const nextPlaying = !isPlayerPlaying();
  const curT = getCurrentTime();
  if (nextPlaying) playVideo();
  else pauseVideo();
  state.mediaCurrent.playing = nextPlaying;
  state.mediaCurrent.t = curT;
  state.mediaCurrent.at = Date.now();
  emitOp({
    k: 'mediaPlayPause',
    id: state.mediaCurrent.id,
    playing: nextPlaying,
    t: curT,
    byName: me.name,
  });
};

$('mediaStop').onclick = () => {
  if (!canControlTV(net?.selfId)) {
    return toast(`⚠️ Chỉ ${state.mediaCurrent?.addedByName || 'người thêm video'} mới có quyền tắt màn hình!`);
  }
  emitOp({ k: 'mediaStop', byName: me.name });
};

$('mediaSeek').addEventListener('mousedown', () => { isUserDraggingSeek = true; });
$('mediaSeek').addEventListener('touchstart', () => { isUserDraggingSeek = true; }, { passive: true });
$('mediaSeek').addEventListener('input', e => {
  const target = parseFloat(e.target.value);
  const duration = getDuration() || 100;
  $('mediaTime').textContent = `${formatMediaTime(target)} / ${formatMediaTime(duration)}`;
});
$('mediaSeek').addEventListener('change', e => {
  isUserDraggingSeek = false;
  if (!canControlTV(net?.selfId)) return;
  const target = parseFloat(e.target.value);
  seekPlayer(target);
  if (state?.mediaCurrent) {
    state.mediaCurrent.t = target;
    state.mediaCurrent.at = Date.now();
    emitOp({
      k: 'mediaSeek',
      id: state.mediaCurrent.id,
      t: target,
      playing: isPlayerPlaying(),
      byName: me.name,
    });
  }
});

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
    return toast(`⚠️ Chỉ ${state.mediaCurrent?.addedByName || 'người thêm nội dung'} mới có quyền Skip!`);
  }
  if (!checkCooldown()) return;
  emitOp({ k: 'mediaNext' });
};

$('mediaMute').onclick = () => {
  const m = toggleMute();
  toast(m ? '🔇 Đã tắt tiếng TV (chỉ trên máy bạn)' : '🔊 Đã bật tiếng TV (chỉ trên máy bạn)');
};
$('mediaReload').onclick = () => {
  forceReloadVideo();
  toast('🔄 Đang tải lại video trên màn hình lớn…');
};
$('mediaHide').onclick = () => {
  const h = toggleVideoHidden();
  toast(h ? '📺 Đã ẩn video trên màn hình lớn (chỉ trên máy bạn)' : '📺 Đã hiện video trên màn hình lớn (chỉ trên máy bạn)');
};

let lastTvScrollSync = 0;
let lastScrollWarnAt = 0;
function scrollTv(deltaY) {
  if (!canControlTV(net?.selfId)) {
    return toast(`⚠️ Chỉ ${state.mediaCurrent?.addedByName || 'người thêm'} mới có quyền cuộn màn hình TV.`);
  }
  const box = $('mediaBox');
  if (!box || state?.mediaCurrent?.kind !== 'web') return;
  if (!canControlTV(net?.selfId)) {
    const now = Date.now();
    if (now - lastScrollWarnAt > 2800) {
      lastScrollWarnAt = now;
      toast('🔒 Chỉ Chủ phòng hoặc Người phát link này mới có quyền cuộn màn hình TV!');
    }
    return;
  }
  const nextY = Math.max(0, box.scrollTop + deltaY);
  box.scrollTo({ top: nextY, behavior: 'smooth' });
  const now = Date.now();
  if (now - lastTvScrollSync > 250) {
    lastTvScrollSync = now;
    emitOp({ k: 'tvScroll', y: nextY });
  }
}
function scrollTvToTop() {
  if (!canControlTV(net?.selfId)) return;
  const box = $('mediaBox');
  if (!box) return;
  box.scrollTo({ top: 0, behavior: 'smooth' });
  emitOp({ k: 'tvScroll', y: 0 });
}

// Direct wheel listener on mediaBox for 100% reliable mouse wheel scroll on 3D TV screen
$('mediaBox')?.addEventListener(
  'wheel',
  e => {
    if (state?.mediaCurrent?.kind === 'web') {
      if (!canControlTV(net?.selfId)) return;
      e.preventDefault();
      scrollTv(e.deltaY * 1.5);
    }
  },
  { passive: false }
);

$('btnTvScrollDown').onclick = () => scrollTv(450);
$('btnTvScrollUp').onclick = () => scrollTv(-450);
$('mediaScrollDown').onclick = () => scrollTv(450);
$('btnTvFullscreen').onclick = () => {
  if (state?.mediaCurrent?.url) openTvBrowser(state.mediaCurrent.url);
};
$('mediaFullscreen').onclick = () => {
  if (state?.mediaCurrent?.url) {
    $('dlgMedia').classList.add('hidden');
    openTvBrowser(state.mediaCurrent.url);
  }
};

// ---------- Topbar, Settings, Pointer Lock, Costume & Campfire Buttons ----------
const openDialog = id => {
  document.exitPointerLock?.();
  keys.clear();
  $(id).classList.remove('hidden');
};
document.querySelectorAll('[data-close]').forEach(b => (b.onclick = () => {
  keys.clear();
  b.closest('.overlay').classList.add('hidden');
}));

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

function toggleVerticalDrawer(open = null) {
  const drawer = $('verticalMenuDrawer');
  const btn = $('btnBrandMenu');
  if (!drawer) return;
  const wantOpen = open !== null ? open : drawer.classList.contains('hidden');
  drawer.classList.toggle('hidden', !wantOpen);
  btn?.classList.toggle('active', wantOpen);
  if (wantOpen) {
    $('emoteQuickPicker')?.classList.add('hidden');
    $('btnEmoteMenu')?.classList.remove('emote-active');
  }
}

function closeVerticalDrawer() {
  toggleVerticalDrawer(false);
}

function toggleEmotePicker(open = null) {
  const pop = $('emoteQuickPicker');
  const btn = $('btnEmoteMenu');
  if (!pop) return;
  const wantOpen = open !== null ? open : pop.classList.contains('hidden');
  pop.classList.toggle('hidden', !wantOpen);
  btn?.classList.toggle('emote-active', wantOpen);
  if (wantOpen) {
    closeVerticalDrawer();
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
    const icon = btn.querySelector('.item-icon');
    const label = btn.querySelector('.item-label');
    if (icon && label) {
      icon.textContent = locked ? '🔒' : '🔓';
      label.textContent = locked ? 'Mở Khóa Chuột (L)' : 'Khóa Chuột Điều Khiển (L)';
    } else {
      btn.textContent = locked ? '🔒' : '🔓';
    }
  }
  const isCombat = state?.theme === 'christmas' || state?.theme === 'valentine' || state?.theme === 'tet';
  $('crosshair').classList.toggle('hidden', !(mode === 'fps' || locked || isCombat));
  updateStatusBadges();
  updateScreen3D();
}
document.addEventListener('pointerlockchange', updateLockHud);

// Top Navigation Brand Drawer & Emote Popover Bindings
$('btnBrandMenu')?.addEventListener('click', e => {
  e.stopPropagation();
  toggleVerticalDrawer();
});
$('btnCloseDrawer')?.addEventListener('click', e => {
  e.stopPropagation();
  closeVerticalDrawer();
});
$('btnEmoteMenu')?.addEventListener('click', e => {
  e.stopPropagation();
  toggleEmotePicker();
});
$('btnCloseEmotePicker')?.addEventListener('click', e => {
  e.stopPropagation();
  toggleEmotePicker(false);
});

document.querySelectorAll('.emote-tile').forEach(tile => {
  tile.addEventListener('click', e => {
    e.stopPropagation();
    const em = tile.dataset.e;
    const clip = tile.dataset.clip;
    doSocialAction(em, clip);
    toggleEmotePicker(false);
  });
});

document.addEventListener('pointerdown', e => {
  const drawer = $('verticalMenuDrawer');
  const brandBtn = $('btnBrandMenu');
  if (drawer && !drawer.classList.contains('hidden')) {
    if (!drawer.contains(e.target) && !brandBtn?.contains(e.target)) {
      closeVerticalDrawer();
    }
  }
  const pop = $('emoteQuickPicker');
  const emoteBtn = $('btnEmoteMenu');
  if (pop && !pop.classList.contains('hidden')) {
    if (!pop.contains(e.target) && !emoteBtn?.contains(e.target)) {
      toggleEmotePicker(false);
    }
  }
});

$('topTheme').onchange = e => {
  if (roomName === SECRET_CASINO_ROOM) {
    e.target.value = 'casino';
    return toast('🎰 Bạn đang ở trong Mật Thất Casino Hoàng Gia!');
  }
  if (!isHost()) {
    e.target.value = state.theme;
    return toast('⚠️ Chỉ Chủ phòng mới có quyền thay đổi chủ đề của phòng!');
  }
  if (e.target.value === 'casino') {
    e.target.value = state.theme;
    return toast('⚠️ Casino là căn phòng mật thất bí mật, không thể đổi chủ đề sang Casino!');
  }
  if (!checkCooldown()) {
    e.target.value = state.theme;
    return;
  }
  emitOp({ k: 'theme', theme: e.target.value, byHost: net.selfId });
};

$('btnLobby').onclick = () => { closeVerticalDrawer(); openLobbyOverlay(); };
$('btnOpenLobbyFromSettings').onclick = () => {
  $('dlgSettings').classList.add('hidden');
  openLobbyOverlay();
};
$('btnCloseRoomTop').onclick = () => { closeVerticalDrawer(); closeRoomByHost(); };
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
$('btnTvScrollHint').onclick = () => {
  if (document.pointerLockElement) {
    document.exitPointerLock?.();
    toast('🖱️ Đã mở chuột tự do! Di chuột vào màn hình TV để cuộn và bấm xem video.');
  } else {
    togglePointerLock();
  }
};
$('btnHelpToggle').onclick = () => $('hud').classList.toggle('hidden');
$('btnHudClose').onclick = () => $('hud').classList.add('hidden');

function toggleSettingsModal(forceState = null) {
  const dlg = $('dlgSettings');
  if (!dlg) return;
  const isHidden = dlg.classList.contains('hidden');
  const shouldOpen = forceState !== null ? forceState : isHidden;
  if (shouldOpen) {
    closeVerticalDrawer();
    document.exitPointerLock?.();
    renderSettingsModal();
    openDialog('dlgSettings');
  } else {
    closeDialog('dlgSettings');
  }
}

$('btnSettings').onclick = () => toggleSettingsModal();
$('statPlayers').onclick = () => toggleSettingsModal();
$('btnRejoinOther').onclick = () => {
  $('dlgKicked').classList.add('hidden');
  openLobbyOverlay();
};

$('btnCard').onclick = () => {
  closeVerticalDrawer();
  refreshRecipients();
  openDialog('dlgCard');
};
$('btnInbox').onclick = () => {
  closeVerticalDrawer();
  renderInbox();
  openDialog('dlgInbox');
};
$('btnCopy').onclick = () => {
  closeVerticalDrawer();
  navigator.clipboard?.writeText(location.href);
  toast('🔗 Đã copy link phòng vào clipboard!');
};
$('btnMedia').onclick = () => {
  closeVerticalDrawer();
  updateMediaDialog();
  openDialog('dlgMedia');
};
$('btnView').onclick = () => toggleView();

// Voice Chat & Screen Share Event Bindings
$('btnMic').onclick = () => toggleMic();
$('btnShareScreen').onclick = () => { closeVerticalDrawer(); toggleScreenShare(); };
$('btnBgm').onclick = () => {
  const on = toggleBgm();
  toast(on ? '🎵 Đã bật nhạc nền lễ hội' : '🔇 Đã tắt nhạc nền');
};
$('btnMinigame').onclick = () => { closeVerticalDrawer(); minigames?.triggerAction(); };

function toggleEmoteMenu(forceState = null) {
  const dlg = $('dlgEmotes');
  if (!dlg) return;
  const isHidden = dlg.classList.contains('hidden');
  const shouldOpen = forceState !== null ? forceState : isHidden;
  if (shouldOpen) {
    document.exitPointerLock?.();
    dlg.classList.remove('hidden');
  } else {
    dlg.classList.add('hidden');
  }
}

function triggerEmoteByKey(clip, emoji) {
  doSocialAction(emoji, clip, null, true);
  const card = document.querySelector(`.emote-card[data-emote="${clip}"]`);
  if (card) {
    document.querySelectorAll('.emote-card').forEach(c => c.classList.remove('active-emote'));
    card.classList.add('active-emote');
    setTimeout(() => card.classList.remove('active-emote'), 350);
  }
  // Auto-close emote menu so player does NOT have to press F again!
  toggleEmoteMenu(false);
}

if ($('btnEmotes')) $('btnEmotes').onclick = () => toggleEmoteMenu();

document.querySelectorAll('.emote-card').forEach(card => {
  card.onclick = () => {
    const clip = card.dataset.emote;
    const emoji = card.dataset.emoji;
    triggerEmoteByKey(clip, emoji);
  };
});

document.querySelectorAll('.extra-emote-btn').forEach(btn => {
  btn.onclick = () => {
    const clip = btn.dataset.emote;
    const emoji = btn.dataset.emoji;
    doSocialAction(emoji, clip, null, true);
    toggleEmoteMenu(false);
  };
});
$('btnStopScreenBadge').onclick = () => stopScreenShare();
$('tileScreenShare').onclick = () => {
  $('dlgMedia').classList.add('hidden');
  toggleScreenShare();
};
$('btnOpenScreenShareFromMedia').onclick = () => {
  $('dlgMedia').classList.add('hidden');
  toggleScreenShare();
};
$('btnStopShareInDialog').onclick = () => stopScreenShare();
$('btnCinemaMode').onclick = () => openCinemaMode();
$('cinemaClose').onclick = () => $('dlgCinema').classList.add('hidden');
$('cinemaToggleSound').onclick = () => toggleCinemaSound();
$('cinemaStopShare').onclick = () => stopScreenShare();

// Voice settings in dlgSettings
$('voiceVolSlider').oninput = e => {
  const v = parseInt(e.target.value, 10);
  $('voiceVolVal').textContent = `${v}%`;
  rtc?.setMasterVoiceVolume(v / 100);
};
$('cbProximityAudio').onchange = e => {
  const en = e.target.checked;
  rtc?.setProximityEnabled(en);
  toast(en ? '🔊 Đã bật âm thanh theo khoảng cách 3D (Proximity)' : '🌐 Đã chuyển sang âm thanh toàn phòng (Global)');
};
$('btnToggleMicSettings').onclick = () => toggleMic();

// BGM settings in dlgSettings
if ($('bgmVolSlider')) {
  $('bgmVolSlider').value = Math.round(getBgmVolume() * 100);
  $('bgmVolVal').textContent = `${$('bgmVolSlider').value}%`;
  $('bgmVolSlider').oninput = e => {
    const v = parseInt(e.target.value, 10);
    $('bgmVolVal').textContent = `${v}%`;
    setBgmVolume(v / 100);
  };
}
if ($('btnToggleBgmSettings')) {
  $('btnToggleBgmSettings').onclick = () => {
    const on = toggleBgm();
    if ($('bgmStatusHint')) {
      $('bgmStatusHint').textContent = on ? 'Trạng thái: Đang phát' : 'Trạng thái: Đang tắt';
    }
    toast(on ? '🎵 Đã bật nhạc nền lễ hội' : '🔇 Đã tắt nhạc nền');
  };
}

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
  playSfx('xmas_bell', 'christmas');
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
  playSfx('tet_lixi', 'tet');
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
  $('btnQuickBypassAd')?.classList.toggle(
    'hidden',
    !state?.mediaCurrent?.vid || state.mediaCurrent.kind === 'web' || state.mediaCurrent.kind === 'screen'
  );

  const isSharing = !!rtc?.isSharingScreen;
  $('btnStopScreenBadge')?.classList.toggle('hidden', !isSharing);
  if ($('btnShareScreen')) {
    $('btnShareScreen').classList.toggle('screen-active', isSharing);
    $('btnShareScreen').textContent = isSharing ? '🛑 Dừng chiếu TV' : '🖥️ Chiếu TV';
  }

  const hasTv = !!(state?.mediaCurrent && (state.mediaCurrent.vid || state.mediaCurrent.url || state.mediaCurrent.kind === 'screen'));
  const isWeb = state?.mediaCurrent?.kind === 'web';
  const canControl = canControlTV(net?.selfId);
  const isLocked = !!document.pointerLockElement;
  const hintBtn = $('btnTvScrollHint');
  if (hintBtn) {
    hintBtn.classList.toggle('hidden', !hasTv || isSharing || !canControl);
    hintBtn.textContent = isLocked ? '🖱️ Phím [L]: Mở chuột cuộn TV' : '🖱️ Chuột tự do: Di vào TV để cuộn & bấm';
  }
  $('tvWebControls')?.classList.toggle('hidden', !isWeb || !canControl);
  $('mediaScrollDown')?.classList.toggle('hidden', !isWeb || !canControl);
  $('mediaFullscreen')?.classList.toggle('hidden', !isWeb);

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
  if (mode === 'tps') {
    mode = 'fps';
    targetCamDist = 0;
    camDist = 0;
    pitch = 0;
  } else {
    mode = 'tps';
    targetCamDist = 4.6;
    camDist = 1.2;
    pitch = -0.25;
  }
  updateHud();
}

function updateHud() {
  if ($('viewLabel')) $('viewLabel').textContent = mode === 'fps' ? '👁️ Góc nhìn thứ nhất (FPS)' : '🎥 Góc nhìn thứ ba (TPS)';
  const btn = $('btnView');
  if (btn) {
    const icon = btn.querySelector('.item-icon');
    const label = btn.querySelector('.item-label');
    if (icon && label) {
      icon.textContent = mode === 'fps' ? '👁️' : '🎥';
      label.textContent = mode === 'fps' ? 'Góc Nhìn Thứ Nhất (FPS)' : 'Góc Nhìn Thứ Ba (TPS)';
    } else {
      btn.textContent = mode === 'fps' ? '👁️ FPS' : '🎥 TPS';
    }
  }
  if (me?.av) me.av.root.visible = mode !== 'fps' && camDist > 0.55;
  updateLockHud();

  if ($('btnCasinoWallet')) {
    const isCasino = state?.theme === 'casino';
    $('btnCasinoWallet').classList.toggle('hidden', !isCasino);
    const countEl = $('btnCasinoWallet').querySelector('.casino-chip-count');
    if (countEl) countEl.textContent = `$${getChips().toLocaleString()}`;
    $('btnCasinoWallet').onclick = () => {
      claimFreeChips();
      updateHud();
    };
  }
}

// ---------- Seat & Hotspot Proximity / Interaction ----------
function isSlotOccupied(slotId) {
  if (me?.seatSlot?.id === slotId) return true;
  for (const p of peers.values()) {
    if (p.seatId === slotId) return true;
  }
  return false;
}

function updateSeatLabels() {
  if (!world?.features?.seats) return;
  const amSitting = !!me?.seatSlot;
  for (const s of world.features.seats) {
    const lbl = s.mesh?.userData?.label;
    if (!lbl) continue;
    if (amSitting) {
      lbl.visible = false;
      continue;
    }
    const hasOccupant = (s.slots || [{ id: s.id }]).some(slot => isSlotOccupied(slot.id));
    lbl.visible = !hasOccupant;
  }
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
  updateSeatLabels();

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

function leaveSeat(isJump = false) {
  if (!me?.seatSlot) return;
  const slot = me.seatSlot;
  justLeftSeat = { id: slot.id, sofaId: slot.sofaId, until: performance.now() + 1200 };
  me.seatSlot = null;

  // Step slightly out in front of the seat so player isn't inside the seat collider
  const rot = slot.rot ?? Math.PI;
  const stepOut = slot.kind === 'couple' ? 0.38 : 0.32;
  const stepX = -Math.sin(rot) * stepOut;
  const stepY = -Math.cos(rot) * stepOut;
  if (!isSolid(tileAt(Math.floor(me.x + stepX + 0.5), Math.floor(me.y + stepY + 0.5)))) {
    me.x += stepX;
    me.y += stepY;
  }

  updateStatusBadges();
  syncMyAppearance();
  updateSeatLabels();
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
    bestSeatD = 1.85;
  if (!me.seatSlot) {
    for (const s of world.features.seats) {
      const d = Math.hypot(s.x - me.x, s.y - me.y);
      if (d < bestSeatD) {
        bestSeatD = d;
        const label =
          s.kind === 'couple'
            ? '💑 Ghế Couple · [E] Ngồi'
            : s.kind === 'log'
            ? '🪵 Khúc Gỗ Lửa Trại · [E] Ngồi'
            : '🪑 Ghế Xem TV · [E] Ngồi';
        bestSeat = { kind: 'seat', seat: s, d, prompt: label };
      }
    }
  }

  // Prioritize seat if near it:
  // If near a seat, the seat ALWAYS takes precedence over the TV screen hotspot (which has a giant 3.8 radius),
  // unless the player is standing right at the stage platform (me.y <= 2.9).
  if (bestSeat) {
    if (!bestHotspot) return bestSeat;
    if (bestHotspot.hotspot.type === 'screen') {
      if (me.y > 2.9) return bestSeat;
    } else if (bestSeat.d <= bestHotspot.d * 1.15) {
      return bestSeat;
    }
  }
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
        playSfx('marshmallow', 'christmas');
        $('btnRoast').click();
        break;
      case 'small_pumpkin':
        wearPumpkinHat(h.styleKey);
        break;
      case 'giant_pumpkin':
        playSfx('spooky_laugh', 'halloween');
        toast('🎃 Hãy lại gần 1 trong 6 quả bí ngô nhỏ xung quanh chân Đại Bí Ngô để đội lên đầu nhé!');
        break;
      case 'costume_booth':
        playSfx('spooky_laugh', 'halloween');
        equipCostume(h.costumeKey);
        openDialog('dlgCostume');
        break;
      case 'heart_tree':
      case 'love_fountain':
        playSfx('wishing_fountain', 'valentine');
        refreshRecipients();
        $('cardStyle').value = 'love';
        openDialog('dlgCard');
        break;
      case 'mai_tree':
        pickAndOpenLixi();
        break;
      case 'firework_launcher':
        if (!checkCooldown()) return;
        playSfx('firework_rocket', 'tet');
        me.av?.playEmote('interact');
        emitOp({ k: 'firework', x: h.x, y: h.y, kind: 'launcher', by: me.name });
        break;
      case 'firecracker_table':
        if (!checkCooldown()) return;
        playSfx('firecracker', 'tet');
        me.av?.playEmote('interact');
        emitOp({ k: 'firework', x: h.x, y: h.y, kind: 'cracker', by: me.name });
        toast('🧨 Pháo nổ lách tách rộn ràng góc sân!');
        break;
      case 'roulette':
        openRoulette();
        break;
      case 'duck_derby':
        openDuckDerby();
        break;
      case 'blackjack':
        openBlackjack();
        break;
      case 'slot_machine':
        openSlotMachine();
        break;
      case 'plinko':
        openPlinko();
        break;
      case 'secret_passage':
        playSfx('wishing_fountain', 'valentine');
        openPassageRiddleDialog(state?.theme || 'christmas');
        break;
      case 'casino_exit':
        playSfx('pop');
        exitSecretCasino();
        break;
      case 'secret_note':
        playSfx('paper_rustle');
        openSecretNote(h.code);
        break;
    }
  }
}

$('interactPrompt').onclick = () => triggerInteract(activeTarget);

function doPlayerJump() {
  if (!me || adminFlying || isFrozen || isJailed) return;
  const jumpV = adminJumpPower || JUMP_V;
  if (me.seatSlot) {
    leaveSeat(true);
    me.vy = jumpV;
  } else if (me.h <= getStandHeight(me.x, me.y) + 0.15) {
    me.vy = jumpV;
    me.loco = 'jump';
    playSfx('step');
  }
}

// ---------- Input & Pointer Events ----------
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const k = e.key ? e.key.toLowerCase() : '';
  const code = e.code || '';
  if (e.key === 'Enter') {
    document.exitPointerLock?.();
    $('chatIn').focus();
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape') {
    closeVerticalDrawer();
    toggleEmotePicker(false);
  }
  if (k === 'v' || code === 'KeyV') toggleView();
  else if (k === 'l' || code === 'KeyL') togglePointerLock();
  else if (k === 'm' || code === 'KeyM') toggleMic();
  else if (k === 'p' || code === 'KeyP') toggleScreenShare();
  else if (k === 'h' || code === 'KeyH') $('hud').classList.toggle('hidden');
  else if (k === 'o' || code === 'KeyO' || k === 'u' || code === 'KeyU') {
    toggleSettingsModal();
    e.preventDefault();
  }
  else if (k === 'f' || code === 'KeyF') {
    toggleEmoteMenu();
    e.preventDefault();
  }
  else if (k === 'c' || code === 'KeyC') {
    openCodeDialog();
    e.preventDefault();
  }
  else if (code === 'Semicolon' || e.key === ';') {
    handleAdminTrigger();
    e.preventDefault();
  }
  else if ((k === 'k' || code === 'KeyK') && state?.mediaCurrent?.kind === 'web') scrollTv(450);
  else if ((k === 'i' || code === 'KeyI') && state?.mediaCurrent?.kind === 'web') scrollTv(-450);
  else if ((k === 'b' || code === 'KeyB') && state?.mediaCurrent?.vid && state.mediaCurrent.kind !== 'web') triggerBypassAd();
  else if ((k === 'alt' || code.startsWith('Alt')) && document.pointerLockElement) document.exitPointerLock?.();
  else if (k === 'e' || code === 'KeyE') triggerInteract(activeTarget);
  else if (k === 'g' || code === 'KeyG') minigames?.triggerAction();
  else if (e.key === 'Escape' && !$('dlgEmotes').classList.contains('hidden')) {
    toggleEmoteMenu(false);
    e.preventDefault();
  }
  else if (e.key === '1' || code === 'Digit1') { triggerEmoteByKey('flex', '💪'); e.preventDefault(); return; }
  else if (e.key === '2' || code === 'Digit2') { triggerEmoteByKey('cheer_jump', '🕺'); e.preventDefault(); return; }
  else if (e.key === '3' || code === 'Digit3') { triggerEmoteByKey('starfish', '⭐'); e.preventDefault(); return; }
  else if (e.key === '4' || code === 'Digit4') { triggerEmoteByKey('head_heart', '🙆'); e.preventDefault(); return; }
  else if (e.key === '5' || code === 'Digit5') { triggerEmoteByKey('despair', '🙇'); e.preventDefault(); return; }
  else if (e.key === '6' || code === 'Digit6') { triggerEmoteByKey('dab', '😎'); e.preventDefault(); return; }
  else if (e.key === '7' || code === 'Digit7') { triggerEmoteByKey('lay_chill', '🛌'); e.preventDefault(); return; }
  else if (e.key === '8' || code === 'Digit8') { triggerEmoteByKey('kneel', '🧎'); e.preventDefault(); return; }

  if (e.key?.startsWith('Arrow') || code.startsWith('Arrow') || e.key === ' ' || code === 'Space') e.preventDefault();
  if ((e.key === ' ' || code === 'Space') && me && !adminFlying && !isFrozen && !isJailed) {
    doPlayerJump();
  }
  if (k) keys.add(k);
  if (code) keys.add(code);
  if (code === 'KeyW' || k === 'w' || k === 'ư') {
    keys.add('w');
    keys.add('KeyW');
  } else if (code === 'KeyA' || k === 'a') {
    keys.add('a');
    keys.add('KeyA');
  } else if (code === 'KeyS' || k === 's') {
    keys.add('s');
    keys.add('KeyS');
  } else if (code === 'KeyD' || k === 'd') {
    keys.add('d');
    keys.add('KeyD');
  }
});

addEventListener('keyup', e => {
  const k = e.key ? e.key.toLowerCase() : '';
  const code = e.code || '';
  if (k) keys.delete(k);
  if (code) keys.delete(code);
  if (code === 'KeyW' || k === 'w' || k === 'ư' || k === 'process') {
    keys.delete('w');
    keys.delete('KeyW');
    keys.delete('ư');
  }
  if (code === 'KeyA' || k === 'a') {
    keys.delete('a');
    keys.delete('KeyA');
  }
  if (code === 'KeyS' || k === 's') {
    keys.delete('s');
    keys.delete('KeyS');
  }
  if (code === 'KeyD' || k === 'd') {
    keys.delete('d');
    keys.delete('KeyD');
  }
  if (code.startsWith('Arrow') || k.startsWith('arrow')) {
    keys.delete(code);
    keys.delete(k);
    keys.delete('arrowup');
    keys.delete('arrowdown');
    keys.delete('arrowleft');
    keys.delete('arrowright');
  }
});

addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) keys.clear();
});
addEventListener('compositionend', () => {
  keys.delete('ư');
  keys.delete('w');
  keys.delete('KeyW');
});

// Roblox-style camera zoom with mouse wheel (smooth TPS distance zoom + seamless FPS transition)
addEventListener(
  'wheel',
  e => {
    if (e.target.closest('#chat, #mediaBox, .overlay:not(.hidden), .dialog:not(.hidden), #dlgCard, #dlgCostume, #dlgMusic, #inboxModal')) {
      return;
    }
    e.preventDefault();

    const zoomStep = Math.sign(e.deltaY) * 0.6; // > 0 scroll down (zoom out), < 0 scroll up (zoom in)
    if (mode === 'fps') {
      if (e.deltaY > 0) {
        mode = 'tps';
        camDist = 0.7;
        targetCamDist = 1.4;
        updateHud();
      }
    } else {
      targetCamDist += zoomStep;
      if (targetCamDist <= 0.45) {
        mode = 'fps';
        targetCamDist = 0;
        camDist = 0;
        updateHud();
      } else {
        targetCamDist = Math.max(0.6, Math.min(9.5, targetCamDist));
      }
    }
  },
  { passive: false }
);

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
  if (e.button === 0 && (document.pointerLockElement || mode === 'fps')) {
    // FPS Left-Click firing with precision crosshair recoil
    minigames?.triggerAction();
    const ch = $('crosshair');
    if (ch) {
      ch.classList.add('crosshair-fire');
      setTimeout(() => ch.classList.remove('crosshair-fire'), 80);
    }
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

  // If clicking open 3D space in combat/festive theme, fire weapon towards click point!
  if (state.theme === 'christmas' || state.theme === 'valentine' || state.theme === 'tet') {
    minigames?.triggerAction();
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

// ---------- Parkour Collision & Main Simulation Loop ----------
function getStandHeight(x, y) {
  if (!state?.map) return 0;
  const tx = Math.floor(x + 0.5);
  const ty = Math.floor(y + 0.5);

  let maxH = 0;

  // Outer perimeter boundary walls: 1.6m height, fully climbable and walkable!
  if (tx <= 0 || ty <= 0 || tx >= state.map.w - 1 || ty >= state.map.h - 1) {
    maxH = Math.max(maxH, 1.6);
  }

  // Check tile type for inner decorative obstacles (trees, pots, low walls)
  const ch = tileAt(tx, ty);
  if (ch === 'T') {
    maxH = Math.max(maxH, 1.05); // Stand on top of decorative trees/pots
  } else if (ch === '#') {
    maxH = Math.max(maxH, 1.6); // Stand on inner partition walls
  }

  // Check colliders (tables, tree planter base, fountain rim, TV stage)
  if (world?.features?.colliders) {
    for (const c of world.features.colliders) {
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < c.r * 0.75 + RADIUS) {
        const colH = c.r > 0.6 ? 1.05 : 0.85;
        maxH = Math.max(maxH, colH);
      }
    }
  }

  // Check seats (chairs, couple sofas, campfire logs)
  if (world?.features?.seats) {
    for (const s of world.features.seats) {
      if (s.kind === 'couple') {
        const dx = Math.abs(x - s.x);
        const dy = Math.abs(y - s.y);
        if (dx < 0.52 && dy < 0.38) {
          maxH = Math.max(maxH, 0.48);
        }
      } else {
        if (Math.hypot(x - s.x, y - s.y) < 0.36) {
          maxH = Math.max(maxH, 0.44);
        }
      }
    }
  }

  return maxH;
}

const free = (x, y, currentH = 0) => {
  // Hard outer perimeter clamp: player can walk on top of the perimeter wall (x down to 0.15),
  // but CAN NEVER step beyond the outer wall edge into the void!
  if (x < 0.15 || x > state.map.w - 1.15 || y < 0.15 || y > state.map.h - 1.15) return false;

  // Ground level perimeter wall collision (no invisible gap! Wall inner face is at 0.5)
  if (currentH < 1.4) {
    if (x < 0.5 + RADIUS || x > state.map.w - 1.5 - RADIUS ||
        y < 0.5 + RADIUS || y > state.map.h - 1.5 - RADIUS) {
      return false;
    }
  }

  for (const [ox, oy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const tx = Math.floor(x + ox * RADIUS + 0.5);
    const ty = Math.floor(y + oy * RADIUS + 0.5);
    const isPerimeter = tx <= 0 || ty <= 0 || tx >= state.map.w - 1 || ty >= state.map.h - 1;
    if (isPerimeter) {
      if (currentH < 1.4) return false;
      continue; // When jumping or standing on top of wall, allowed!
    }

    const t = tileAt(tx, ty);
    if (isSolid(t)) {
      const standH = t === 'T' ? 1.05 : 1.6;
      if (currentH < standH - 0.22) return false;
    }
  }

  // Colliders (tables, tree base, fountain, stage)
  if (world?.features?.colliders) {
    for (const c of world.features.colliders) {
      const colH = c.r > 0.6 ? 1.05 : 0.85;
      if (currentH >= colH - 0.22) continue; // Can jump/stand on top!

      const minD = c.r * 0.75 + RADIUS;
      const nextD = Math.hypot(x - c.x, y - c.y);
      if (nextD < minD) {
        const curD = Math.hypot(me.x - c.x, me.y - c.y);
        if (curD < minD && nextD > curD) continue; // Moving away is allowed
        return false;
      }
    }
  }

  if (world?.features?.seats) {
    const now = performance.now();
    for (const s of world.features.seats) {
      if (me?.seatSlot && (me.seatSlot.id === s.id || me.seatSlot.sofaId === s.id || me.seatSlot.id.startsWith(s.id))) continue;
      if (justLeftSeat && now < justLeftSeat.until && (justLeftSeat.id === s.id || justLeftSeat.sofaId === s.id || justLeftSeat.id.startsWith(s.id))) continue;

      const seatH = s.kind === 'couple' ? 0.48 : 0.44;
      if (currentH >= seatH - 0.15) continue; // Can jump over or walk on top of seat

      if (s.kind === 'couple') {
        const dx = Math.abs(x - s.x);
        const dy = Math.abs(y - s.y);
        const limitX = 0.36 + RADIUS * 0.5;
        const limitY = 0.22 + RADIUS * 0.5;
        if (dx < limitX && dy < limitY) {
          const curDx = Math.abs(me.x - s.x);
          const curDy = Math.abs(me.y - s.y);
          if (curDx < limitX && curDy < limitY && (dx > curDx || dy > curDy)) continue;
          return false;
        }
      } else {
        const minD = 0.16 + RADIUS * 0.5;
        const nextD = Math.hypot(x - s.x, y - s.y);
        if (nextD < minD) {
          const curD = Math.hypot(me.x - s.x, me.y - s.y);
          if (curD < minD && nextD > curD) continue;
          return false;
        }
      }
    }
  }
  return true;
};

let last = performance.now(),
  lastSend = 0,
  sent = {},
  rafId = null;

let lastInteractCheck = 0,
  lastSeatLabelCheck = 0,
  lastWorldSync = 0,
  lastRtcCheck = 0,
  lastCampfireCheck = 0,
  cooldownBadgeEl = null;

function loop(now) {
  if (isKicked || !me?.started || !state) {
    loopRunning = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    return;
  }

  try {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // 1. Update FPS & Live Stats
    frameCount++;
    if (now - fpsLastTime >= 500) {
      currentFps = Math.round((frameCount * 1000) / (now - fpsLastTime));
      const fpsEl = $('statFps');
      if (fpsEl) fpsEl.textContent = `⚡ ${currentFps} FPS`;
      frameCount = 0;
      fpsLastTime = now;
    }

    // 2. Update Cooldown Badge on HUD
    if (now < cooldownUntil) {
      if (!cooldownBadgeEl) cooldownBadgeEl = $('cooldownBadge');
      if (cooldownBadgeEl) {
        cooldownBadgeEl.textContent = `⏳ Hồi chiêu: ${((cooldownUntil - now) / 1000).toFixed(1)}s`;
        cooldownBadgeEl.classList.remove('hidden');
      }
    } else if (cooldownBadgeEl && !cooldownBadgeEl.classList.contains('hidden')) {
      cooldownBadgeEl.classList.add('hidden');
    }

    // 3. Player Locomotion & Sitting State
    let moving = false;
    let running = false;
    let floorH = getStandHeight(me.x, me.y);

    if (isFrozen) {
      me.loco = 'idle';
    } else if (isJailed && jailedPos) {
      me.x = jailedPos.x;
      me.y = jailedPos.y;
      me.loco = 'idle';
    } else {
      const k = keys;
      const isUp = k.has('w') || k.has('KeyW') || k.has('ư') || k.has('arrowup') || k.has('ArrowUp');
      const isDown = k.has('s') || k.has('KeyS') || k.has('arrowdown') || k.has('ArrowDown');
      const isLeft = k.has('a') || k.has('KeyA') || k.has('arrowleft') || k.has('ArrowLeft');
      const isRight = k.has('d') || k.has('KeyD') || k.has('arrowright') || k.has('ArrowRight');
      let fwd = (isUp ? 1 : 0) - (isDown ? 1 : 0);
      let str = (isRight ? 1 : 0) - (isLeft ? 1 : 0);
      if (Math.abs(mobileMoveVector.y) > 0.05 || Math.abs(mobileMoveVector.x) > 0.05) {
        fwd += mobileMoveVector.y;
        str += mobileMoveVector.x;
      }
      running = k.has('shift') || k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(mobileMoveVector.x, mobileMoveVector.y) > 0.85;
      let dx = -Math.sin(yaw) * fwd + Math.cos(yaw) * str,
        dz = -Math.cos(yaw) * fwd - Math.sin(yaw) * str;
      moving = !!(dx || dz);

      if (moving && me.seatSlot) {
        leaveSeat();
      }

      if (moving && !me.seatSlot) {
        const l = Math.hypot(dx, dz),
          sp = (running ? RUN : WALK) * dt * (adminSpeedMultiplier || 1.0);
        dx = (dx / l) * sp;
        dz = (dz / l) * sp;
        if (adminNoclip || free(me.x + dx, me.y, me.h)) me.x += dx;
        if (adminNoclip || free(me.x, me.y + dz, me.h)) me.y += dz;
        // Hard coordinate clamp against any glitching out of map
        me.x = Math.max(0.15, Math.min(state.map.w - 1.15, me.x));
        me.y = Math.max(0.15, Math.min(state.map.h - 1.15, me.y));
      }

      if (adminFlying) {
        me.vy = 0;
        if (k.has(' ') || k.has('Space')) me.h += 8 * dt;
        else if (k.has('shift') || k.has('ShiftLeft') || k.has('ShiftRight')) me.h = Math.max(0, me.h - 8 * dt);
      }

      // Auto-resolve any slight penetration with colliders so player never gets stuck against item tables or obstacles
      if (!adminNoclip && !me.seatSlot && world?.features?.colliders) {
        for (const c of world.features.colliders) {
          const colH = c.r > 0.6 ? 1.05 : 0.85;
          if (me.h >= colH - 0.15) continue; // Standing on top of object!
          const d = Math.hypot(me.x - c.x, me.y - c.y);
          const minD = c.r * 0.75 + RADIUS;
          if (d < minD && d > 0.0001) {
            const overlap = minD - d;
            const pushFactor = Math.min(overlap, dt * 8);
            const px = ((me.x - c.x) / d) * pushFactor;
            const py = ((me.y - c.y) / d) * pushFactor;
            if (!isSolid(tileAt(Math.floor(me.x + px + 0.5), Math.floor(me.y + py + 0.5)))) {
              me.x += px;
              me.y += py;
            }
          }
        }
      }

      if (now < adminSpinUntil) {
        me.r += dt * 35;
      } else if (mode === 'fps') me.r = yaw + Math.PI;
      else if (moving && !me.seatSlot) me.r = lerpAngle(me.r, Math.atan2(dx, dz), Math.min(1, dt * 14));

      // Parkour & Vertical physics with stand-on-obstacle landing
      if (!adminFlying) {
        floorH = getStandHeight(me.x, me.y);
        if (floorH === Infinity) {
          me.x = Math.max(1, Math.min(state.map.w - 2, me.x));
          me.y = Math.max(1, Math.min(state.map.h - 2, me.y));
          me.h = 0;
          me.vy = 0;
          floorH = 0;
        } else if (me.h > floorH || me.vy > 0) {
          me.vy -= (currentGravity || GRAVITY) * dt;
          me.h += me.vy * dt;
          if (me.h <= floorH) {
            me.h = floorH;
            me.vy = 0;
          }
        } else if (me.h < floorH) {
          me.h = floorH;
          me.vy = 0;
        }
      }
    }

    // Check Couple Sofa Pairing & Campfire Proximity
    let myLean = 0;
    if (me.seatSlot) {
      const partner = findCouplePartner();
      if (partner) {
        myLean = me.seatSlot.lean || 0;
        if (now - lastCoupleHeart > 2200) {
          lastCoupleHeart = now;
          floaters.push({ e: '💕', who: net?.selfId || 'me', t: Date.now() });
        }
      }
      me.loco = partner ? 'couple_sit' : 'sit';
    } else {
      const isAirborne = me.h > floorH + 0.08 || me.vy > 0.5;
      me.loco = isAirborne ? 'jump' : moving ? (running ? 'run' : 'walk') : 'idle';
    }

    // Show/hide campfire action bar when sitting on campfire log or standing near campfire (throttled ~5Hz)
    if (now - lastCampfireCheck > 200) {
      lastCampfireCheck = now;
      const nearCampfire =
        state.theme === 'christmas' &&
        (me.seatSlot?.campfire ||
          world?.features?.hotspots?.some(h => h.type === 'campfire' && Math.hypot(h.x - me.x, h.y - me.y) <= h.radius));
      $('campfireBar')?.classList.toggle('hidden', !nearCampfire);
    }

    // Update my 3D Avatar
    const av = me.av;
    if (av?.root) {
      av.root.position.set(me.x * TILE, me.h, me.y * TILE);
      av.root.rotation.y = me.r;
      av.setLocomotion(me.loco, { lean: myLean });
      av.update(dt);
    }

    // 4. Contextual [E] Prompt Update (throttled ~11Hz for high FPS)
    if (now - lastInteractCheck > 88) {
      lastInteractCheck = now;
      activeTarget = findNearestInteractable();
      const promptEl = $('interactPrompt');
      if (promptEl) {
        if (activeTarget) {
          if (promptEl.textContent !== activeTarget.prompt) promptEl.textContent = activeTarget.prompt;
          promptEl.classList.remove('hidden');
        } else {
          promptEl.classList.add('hidden');
        }
      }
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
      net &&
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
    if (rtc && me && now - lastRtcCheck > 120) {
      lastRtcCheck = now;
      rtc.updatePeerDistances(me, peers);
    }
    if (now - lastWorldSync > 180) {
      lastWorldSync = now;
      world?.sync(state, roomName);
    }
    world?.update(dt, { x: me.x * TILE, z: me.y * TILE });
    minigames?.update(dt);
    updateCamera(dt);
    if (world?.bgColor && renderer) renderer.setClearColor(world.bgColor, 1);
    if (renderer && scene && camera) renderer.render(scene, camera);

    // Update HTML speech bubbles on top of TV screen & 3D world
    me.av?.updateBubble(camera);
    peers.forEach(p => p.av?.updateBubble(camera));
    if (now - lastSeatLabelCheck > 220) {
      lastSeatLabelCheck = now;
      updateSeatLabels();
    }
  } catch (err) {
    console.error('Lỗi game loop:', err);
  }

  // Schedule next frame exactly once
  rafId = requestAnimationFrame(loop);
}

function updateFloaters() {
  const now = Date.now();
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i],
      age = (now - f.t) / 1000,
      who = f.who === net?.selfId || f.who === 'me' ? me : peers.get(f.who);
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

// 1110x490 px scaled by (11.1 / 1110 = 0.01) => 11.1m x 4.9m exact 3D Cinema Screen size at (29, 3.2, 4.27)
const S_SCALE = 11.1 / 1110;
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

  box.style.display = showHole ? 'block' : 'none';
  const isLocked = !!document.pointerLockElement;
  const canCtrl = canControlTV(net?.selfId);
  box.style.pointerEvents = showHole && !isLocked && canCtrl ? 'auto' : 'none';

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

function updateCamera(dt = 0.016) {
  const px = me.x * TILE,
    pz = me.y * TILE;
  const eyeH = me.seatSlot ? 1.25 : 1.55;
  if (mode === 'fps') {
    camDist = 0;
    targetCamDist = 0;
    camera.position.set(px, me.h + eyeH, pz);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    if (me?.av) me.av.root.visible = false;
  } else {
    // Smooth Roblox zoom interpolation
    camDist += (targetCamDist - camDist) * Math.min(1, dt * 14);

    if (camDist <= 0.5) {
      mode = 'fps';
      camDist = 0;
      targetCamDist = 0;
      updateHud();
      camera.position.set(px, me.h + eyeH, pz);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
      if (me?.av) me.av.root.visible = false;
      updateScreen3D();
      return;
    }

    if (me?.av) me.av.root.visible = camDist > 0.65;

    _head.set(px, me.h + eyeH, pz);
    const cp = Math.cos(pitch);
    _want
      .set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp)
      .multiplyScalar(-camDist)
      .add(_head);

    // Shoulder offset fades smoothly as camera gets closer to the avatar's head
    const shoulderRatio = Math.max(0, Math.min(1, (camDist - 0.7) / 2.5));
    const shoulderOffset = 0.65 * shoulderRatio;
    _want.x += Math.cos(yaw) * shoulderOffset;
    _want.z += -Math.sin(yaw) * shoulderOffset;

    let t = 1;
    for (let i = 1; i <= 16; i++) {
      _p.lerpVectors(_head, _want, i / 16);
      if (_p.y < 1.6 && solidForCamera(_p.x, _p.z)) {
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

// ============================================================================
// SECRET CASINO & HIDDEN CHAMBER PASSAGE
// ============================================================================
let lastRoomBeforeCasino = null;

function enterSecretCasino() {
  if (roomName === SECRET_CASINO_ROOM) {
    toast('🎰 Bạn đang ở trong Mật Thất Casino rồi!');
    return;
  }
  lastRoomBeforeCasino = {
    id: roomName,
    title: roomTitle,
    theme: state?.theme || 'christmas',
  };
  toast('🌀 Bức màn bí mật hé mở... Đang dịch chuyển vào Mật Thất Casino Hoàng Gia!');
  leaveSeat();
  joinRoomConfig({
    id: SECRET_CASINO_ROOM,
    title: '🎰 Mật Thất Casino Hoàng Gia (Secret Speakeasy)',
    theme: 'casino',
    passHash: '',
  });
}

function exitSecretCasino() {
  const returnRoom = lastRoomBeforeCasino || {
    id: 'quang-truong-noel',
    title: 'Quảng Trường Giáng Sinh',
    theme: 'christmas',
  };
  toast('🚪 Bạn đã bước qua cánh cửa cổ kính trở về thế giới bên trên!');
  leaveSeat();
  joinRoomConfig({
    id: returnRoom.id,
    title: returnRoom.title,
    theme: returnRoom.theme,
    passHash: '',
  });
}

let activeFoundNoteCode = '';

const PASSAGE_RIDDLES = {
  christmas: {
    icon: '🎄',
    title: 'Phong Ấn Cổ Thụ Tuyết',
    sub: 'Giải mật mã dãy số ma thuật để mở cánh cổng dẫn vào Mật Thất Casino',
    question: 'Dãy số ma thuật ẩn giấu dưới gốc Thông Tuyết Noel: 3, 6, 12, 24, ? — Con số tiếp theo để mở khóa phong ấn là gì?',
    options: ['36', '48', '30', '42'],
    correct: 1,
  },
  halloween: {
    icon: '🎃',
    title: 'Ngọn Lửa Huyền Bí Vùng Bí Ngô',
    sub: 'Giải câu đố bí ngô ngàn năm để bước vào Mật Thất Casino',
    question: 'Thứ gì càng ăn càng lớn, uống nước thì chết, không có cánh nhưng nhảy múa trong đêm tối soi đường vào mật thất?',
    options: ['Bóng Đêm', 'Ngọn Lửa', 'Cơn Gió Lạnh', 'Dung Nham Đá'],
    correct: 1,
  },
  tet: {
    icon: '🐉',
    title: 'Phong Ấn Kim Long Tứ Linh',
    sub: 'Giải mật thư truyền thuyết nghìn năm để mở cánh cổng Speakeasy',
    question: 'Trong Tứ Linh (Long - Lân - Quy - Phụng), linh vật nào uốn lượn mang pháo hoa tài lộc và canh giữ kho báu hoàng gia?',
    options: ['Huyền Vũ (Rùa)', 'Bạch Hổ (Hổ Trắng)', 'Kim Long (Rồng Vàng)', 'Chu Tước (Phượng Hoàng)'],
    correct: 2,
  },
  valentine: {
    icon: '🏹',
    title: 'Mũi Tên Trái Tim Thần Cupid',
    sub: 'Giải câu đố tình yêu đích thực để đánh thức mật thất ẩn',
    question: 'Thứ gì vô hình nhưng nặng ngàn cân, có thể chữa lành mọi vết thương và mở khóa được cả những trái tim sắt đá nhất?',
    options: ['Kim Cương Lấp Lánh', 'Tình Yêu Đích Thực', 'Kho Báu Hoàng Gia', 'Thuốc Ma Thuật'],
    correct: 1,
  },
};

let activePassageTheme = 'christmas';
let selectedPassageOptionIndex = -1;

function openPassageRiddleDialog(theme) {
  activePassageTheme = theme || state?.theme || 'christmas';
  const riddle = PASSAGE_RIDDLES[activePassageTheme] || PASSAGE_RIDDLES.christmas;
  selectedPassageOptionIndex = -1;

  $('passageIcon').textContent = riddle.icon;
  $('passageTitle').textContent = riddle.title;
  $('passageSub').textContent = riddle.sub;
  $('passageRiddleQuestion').textContent = riddle.question;

  const optContainer = $('passageOptions');
  optContainer.innerHTML = '';
  $('passageFeedback').classList.add('hidden');

  riddle.options.forEach((optText, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.textAlign = 'left';
    btn.style.padding = '10px 14px';
    btn.style.background = 'rgba(255, 255, 255, 0.06)';
    btn.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    btn.style.borderRadius = '8px';
    btn.style.color = '#fff';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'all 0.2s';
    btn.textContent = `${String.fromCharCode(65 + idx)}. ${optText}`;

    btn.onclick = () => {
      selectedPassageOptionIndex = idx;
      Array.from(optContainer.children).forEach((child, cIdx) => {
        if (cIdx === idx) {
          child.style.background = 'rgba(234, 179, 8, 0.25)';
          child.style.borderColor = '#facc15';
          child.style.color = '#fef08a';
          child.style.fontWeight = '700';
        } else {
          child.style.background = 'rgba(255, 255, 255, 0.06)';
          child.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          child.style.color = '#fff';
          child.style.fontWeight = 'normal';
        }
      });
    };
    optContainer.appendChild(btn);
  });

  openDialog('dlgSecretPassage');
}

$('btnSubmitPassage').onclick = () => {
  const riddle = PASSAGE_RIDDLES[activePassageTheme] || PASSAGE_RIDDLES.christmas;
  const fb = $('passageFeedback');
  if (selectedPassageOptionIndex === -1) {
    fb.className = 'err-msg';
    fb.textContent = '⚠️ Hãy chọn một phương án trước khi giải phong ấn!';
    fb.classList.remove('hidden');
    return;
  }

  if (selectedPassageOptionIndex === riddle.correct) {
    fb.style.background = 'rgba(34, 197, 94, 0.2)';
    fb.style.border = '1px solid #22c55e';
    fb.style.color = '#86efac';
    fb.textContent = '🎉 CHÍNH XÁC! Phong ấn cổ xưa đã được hóa giải thành công!';
    fb.classList.remove('hidden');
    playSfx('jackpot_voice');
    setTimeout(() => {
      closeDialog('dlgSecretPassage');
      enterSecretCasino();
    }, 800);
  } else {
    fb.className = 'err-msg';
    fb.textContent = '❌ Câu trả lời chưa chính xác! Cánh cổng phong ấn vẫn khóa chặt.';
    fb.classList.remove('hidden');
    playSfx('splat', 'halloween');
  }
};

const NOTE_RIDDLES = {
  'BoKho': 'Món ăn đặc sản bổ dưỡng cay nồng đậm vị quê hương (5 chữ cái: B_K_O)',
  'Chu0n6': 'Biệt danh mật mã số học của Developer sáng lập (6 ký tự: C_u_n_)',
  'Raumania': 'Vương quốc rau má xanh rì huyền thoại (8 chữ cái: R_u_a_i_)',
  'Trung Legit': 'Biểu tượng của sự chân chính và uy tín tuyệt đối (11 ký tự: T_u_g L_g_t)',
  'toilagay': 'Lời tuyên ngôn thẳng thắn và dũng cảm nhất (8 chữ cái: t_i_a_a_)',
};

function openSecretNote(code) {
  activeFoundNoteCode = code || 'BoKho';
  const el = $('noteContentCode');
  if (el) el.textContent = activeFoundNoteCode;
  const clueEl = $('noteClueText');
  if (clueEl) {
    clueEl.textContent = `Gợi ý giải đố: ${NOTE_RIDDLES[activeFoundNoteCode] || 'Mã code bí mật dán trên tường'}`;
  }
  openDialog('dlgNote');
}

$('btnRedeemFoundCode').onclick = () => {
  if (!activeFoundNoteCode) return;
  const res = redeemCode(activeFoundNoteCode);
  closeDialog('dlgNote');
  if (res.ok || res.success) {
    playSfx('jackpot_voice');
    toast(`🎉 ${res.msg}`);
    updateCasinoChipsUI();
  } else {
    toast(`⚠️ ${res.msg}`);
  }
};

// ============================================================================
// CASINO CHIPS & CODE REDEMPTION MODAL
// ============================================================================
function openCodeDialog() {
  $('inSecretCode').value = '';
  $('codeErr').classList.add('hidden');
  $('codeSuccess').classList.add('hidden');
  openDialog('dlgCode');
  setTimeout(() => $('inSecretCode').focus(), 150);
}

function updateCasinoChipsUI() {
  const chips = getChips();
  const els = document.querySelectorAll('.casino-chip-count');
  els.forEach(el => {
    el.textContent = `$${chips.toLocaleString()}`;
  });
  const btnWallet = $('btnCasinoWallet');
  if (btnWallet) {
    btnWallet.classList.toggle('hidden', state?.theme !== 'casino');
  }
}

$('btnEnterCode').onclick = openCodeDialog;
$('btnCasinoWallet').onclick = openCodeDialog;
window.addEventListener('gh_open_code_dialog', openCodeDialog);

$('btnSubmitCode').onclick = () => {
  const code = $('inSecretCode').value.trim();
  if (!code) {
    $('codeErr').textContent = 'Vui lòng nhập mã code!';
    $('codeErr').classList.remove('hidden');
    $('codeSuccess').classList.add('hidden');
    return;
  }
  const res = redeemCode(code);
  if (res.ok || res.success) {
    $('codeErr').classList.add('hidden');
    $('codeSuccess').textContent = res.msg;
    $('codeSuccess').classList.remove('hidden');
    playSfx('jackpot_voice');
    toast(`🎉 ${res.msg}`);
    updateCasinoChipsUI();
    setTimeout(() => closeDialog('dlgCode'), 1500);
  } else {
    $('codeSuccess').classList.add('hidden');
    $('codeErr').textContent = res.msg;
    $('codeErr').classList.remove('hidden');
  }
};

$('inSecretCode').onkeydown = e => {
  if (e.key === 'Enter') $('btnSubmitCode').click();
};

// ============================================================================
// TITLES COLLECTION SYSTEM
// ============================================================================
const TITLE_LIST = [
  {
    id: 'admin',
    name: '👑 ADMIN',
    desc: 'Đặc quyền Tối cao dành riêng cho Quản Trị Viên đã xác thực mật mã "grinding shit"',
    condition: () => isAdminVerified(),
    lockMsg: 'Cần xác thực mật mã Admin "grinding shit" (Bấm phím [;] để nhập)!',
  },
  {
    id: 'vuadoden',
    name: '👑 Vua Đỏ Đen',
    desc: 'Đạt danh hiệu huyền thoại khi trúng Jackpot / Thắng lớn nhất ở cả 5 trò chơi tại Casino!',
    condition: () => {
      try {
        const history = JSON.parse(localStorage.getItem('gh_jackpot_wins') || '[]');
        return ['roulette', 'duck_derby', 'blackjack', 'slot_machine', 'plinko'].every(k => history.includes(k));
      } catch { return false; }
    },
    lockMsg: 'Cần trúng Jackpot ở cả 5 trò (Roulette, Duck Derby, Blackjack, Slot Machine, Plinko)!',
  },
  {
    id: 'trieu_phu',
    name: '💎 Dân Chơi Triệu Phú',
    desc: 'Sở hữu từ 3,000 xu chips casino trở lên trong tài khoản!',
    condition: () => getChips() >= 3000,
    lockMsg: 'Cần tích lũy từ 3,000 xu chips casino!',
  },
  {
    id: 'dai_hiep_xmas',
    name: '🎄 Đại Hiệp Giáng Sinh',
    desc: 'Hiệp sĩ tuyết trắng mang lại niềm vui cho mùa Noel',
    condition: () => true,
  },
  {
    id: 'chua_te_halloween',
    name: '🎃 Chúa Tể Halloween',
    desc: 'Bậc thầy bí ngô ma quái dũng cảm đối mặt Boss Ma Cà Rồng',
    condition: () => true,
  },
  {
    id: 'than_tai_tet',
    name: '🧧 Thần Tài Gõ Cửa',
    desc: 'Khai xuân đón lộc, phát pháo rền vang',
    condition: () => true,
  },
  {
    id: 'than_tinh_yeu',
    name: '💝 Thần Tình Yêu Cupido',
    desc: 'Sứ giả gắn kết những trái tim ngọt ngào',
    condition: () => true,
  },
  {
    id: 'tan_thu',
    name: '🌟 Tân Thủ Đáng Yêu',
    desc: 'Nhà thám hiểm mới bước chân vào thế giới lễ hội',
    condition: () => true,
  },
  {
    id: 'none',
    name: 'Ẩn danh hiệu',
    desc: 'Không hiển thị huy hiệu danh hiệu trên tên',
    condition: () => true,
  },
];

function openTitlesDialog() {
  renderTitlesList();
  openDialog('dlgTitles');
}

function renderTitlesList() {
  const container = $('titlesList');
  if (!container) return;
  container.innerHTML = '';
  const currentTitle = me?.title || localStorage.getItem('gh_selected_title') || '';

  TITLE_LIST.forEach(t => {
    const isUnlocked = t.condition(me?.name);
    const isEquipped = (t.id === 'none' && !currentTitle) || currentTitle === t.name;
    const card = document.createElement('div');
    card.className = `title-select-card ${isEquipped ? 'active' : ''}`;
    card.style.opacity = isUnlocked ? '1' : '0.6';

    const color = t.id === 'admin' ? '#ef4444' : t.id === 'vuadoden' ? '#facc15' : '#38bdf8';
    card.innerHTML = `
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="title-badge-preview" style="color:${color}">${t.name}</span>
          ${isEquipped ? '<span style="font-size:11px;color:#22c55e;font-weight:700">✓ Đang mặc</span>' : ''}
        </div>
        <p style="margin:4px 0 0 0;font-size:11.5px;color:#94a3b8">${t.desc}</p>
        ${!isUnlocked && t.lockMsg ? `<p style="margin:2px 0 0 0;font-size:11px;color:#f87171">🔒 ${t.lockMsg}</p>` : ''}
      </div>
      <div>
        <button class="primary" style="padding:5px 12px;font-size:12px" ${!isUnlocked || isEquipped ? 'disabled' : ''}>
          ${isEquipped ? 'Đang chọn' : isUnlocked ? 'Mặc' : 'Chưa mở'}
        </button>
      </div>
    `;

    card.querySelector('button').onclick = () => {
      if (!isUnlocked) return;
      selectTitle(t);
    };

    container.appendChild(card);
  });
}

function selectTitle(titleItem) {
  const chosenTitle = titleItem.id === 'none' ? '' : titleItem.name;
  if (me) {
    me.title = chosenTitle;
    me.av?.setName(me.name, me.title);
  }
  localStorage.setItem('gh_selected_title', chosenTitle);
  syncMyAppearance();
  toast(`👑 Bạn đã trang bị danh hiệu: ${chosenTitle || 'Không'}`);
  closeDialog('dlgTitles');
}

$('btnTitles').onclick = openTitlesDialog;

// ============================================================================
// ROBLOX ADMIN COMMANDS SYSTEM & PASSWORD AUTHENTICATION ("grinding shit")
// ============================================================================
export const ADMIN_SECRET_KEY = 'grinding shit';

export function isAdminVerified() {
  return localStorage.getItem('gh_admin_verified') === 'true';
}

export function verifyAdminPassword(pass) {
  const p = (pass || '').trim().toLowerCase();
  if (p === ADMIN_SECRET_KEY) {
    localStorage.setItem('gh_admin_verified', 'true');
    updateAdminUIStatus();
    return true;
  }
  return false;
}

function updateAdminUIStatus() {
  const isVerified = isAdminVerified();
  const btnAdmin = $('btnAdminCmds');
  if (btnAdmin) {
    btnAdmin.classList.remove('hidden');
    if (isVerified) {
      btnAdmin.innerHTML = '👑 ADMIN [;]';
      btnAdmin.style.background = 'linear-gradient(135deg, #dc2626, #991b1b)';
      btnAdmin.style.borderColor = '#facc15';
      btnAdmin.style.boxShadow = '0 0 14px rgba(250, 204, 21, 0.6)';
      btnAdmin.style.color = '#fff';
      btnAdmin.title = 'Bảng Quản Trị Viên (ĐÃ XÁC THỰC) - Phím [;]';
      if (me) {
        me.title = '👑 ADMIN';
        me.av?.setName(me.name, me.title);
        syncMyAppearance();
      }
    } else {
      btnAdmin.innerHTML = '⚡ Admin [;]';
      btnAdmin.style.background = 'rgba(239, 68, 68, 0.2)';
      btnAdmin.style.borderColor = 'rgba(250, 204, 21, 0.4)';
      btnAdmin.style.boxShadow = 'none';
      btnAdmin.style.color = '#fca5a5';
      btnAdmin.title = 'Nhấn để xác thực quyền Admin với mật mã "grinding shit" - Phím [;]';
    }
  }
}

function openAdminAuthDialog() {
  $('inAdminPass').value = '';
  $('adminAuthErr').classList.add('hidden');
  $('adminAuthSuccess').classList.add('hidden');
  openDialog('dlgAdminAuth');
  setTimeout(() => $('inAdminPass').focus(), 150);
}

function handleAdminTrigger() {
  if (isAdminVerified()) {
    openAdminDialog();
  } else {
    openAdminAuthDialog();
  }
}

let bannerTimeout = null;
function showAdminServerBanner(text) {
  const banner = $('adminServerBanner');
  const txt = $('adminBannerText');
  if (!banner || !txt) return;
  txt.textContent = text;
  banner.classList.remove('hidden');
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => {
    banner.classList.add('hidden');
  }, 6500);
}

function findPeerByName(nameQuery) {
  if (!nameQuery) return null;
  const q = nameQuery.toLowerCase().trim();
  for (const [id, p] of peers) {
    if (p.name && p.name.toLowerCase().includes(q)) {
      return [id, p];
    }
  }
  return null;
}

function openAdminDialog() {
  $('inAdminCmd').value = '';
  openDialog('dlgAdmin');
  setTimeout(() => $('inAdminCmd').focus(), 150);
}

$('btnAdminCmds').onclick = handleAdminTrigger;

$('btnSubmitAdminAuth').onclick = () => {
  const val = $('inAdminPass').value;
  if (verifyAdminPassword(val)) {
    $('adminAuthErr').classList.add('hidden');
    $('adminAuthSuccess').classList.remove('hidden');
    playSfx('jackpot_voice');
    toast('✨ XÁC THỰC THÀNH CÔNG! Chào mừng Quản Trị Viên Tối Cao!');
    setTimeout(() => {
      closeDialog('dlgAdminAuth');
      openAdminDialog();
    }, 850);
  } else {
    $('adminAuthSuccess').classList.add('hidden');
    $('adminAuthErr').classList.remove('hidden');
    toast('❌ Mật mã Admin không chính xác!');
  }
};

$('inAdminPass').onkeydown = e => {
  if (e.key === 'Enter') $('btnSubmitAdminAuth').click();
};

$('btnRunAdminCmd').onclick = () => {
  const cmd = $('inAdminCmd').value.trim();
  if (cmd) {
    executeAdminCommand(cmd);
    $('inAdminCmd').value = '';
  }
};

$('inAdminCmd').onkeydown = e => {
  if (e.key === 'Enter') $('btnRunAdminCmd').click();
};

function executeAdminCommand(raw) {
  let cmdStr = (raw || '').trim();
  if (cmdStr.startsWith(':') || cmdStr.startsWith(';') || cmdStr.startsWith('/')) {
    cmdStr = cmdStr.slice(1).trim();
  }
  if (!cmdStr) return false;

  const parts = cmdStr.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Cho phép xác thực mật khẩu qua lệnh chat
  if (cmd === 'admin' || cmd === 'auth' || cmd === 'login') {
    const inputPass = args.join(' ');
    if (verifyAdminPassword(inputPass)) {
      playSfx('jackpot_voice');
      toast('✨ XÁC THỰC THÀNH CÔNG! Đã kích hoạt quyền Quản Trị Viên Tối Cao (ADMIN)!');
      return true;
    } else {
      toast('❌ Mật mã Admin không chính xác! Cú pháp: :admin grinding shit');
      return true;
    }
  }

  // Đăng xuất quyền Admin
  if (cmd === 'logout' || cmd === 'unadmin') {
    localStorage.removeItem('gh_admin_verified');
    updateAdminUIStatus();
    toast('🔒 Đã hủy kích hoạt quyền Admin.');
    return true;
  }

  // Bắt buộc phải xác thực mật mã Admin
  if (!isAdminVerified()) {
    toast('⛔ Bạn chưa xác thực quyền Admin! Bấm [;] hoặc gõ: :admin grinding shit');
    openAdminAuthDialog();
    return true;
  }

  switch (cmd) {
    // === 1. PLAYER MANAGEMENT ===
    case 'kick': {
      const targetName = args[0];
      if (!targetName) { toast('⚠️ Cú pháp: :kick <tên_người_chơi>'); return true; }
      const pEntry = findPeerByName(targetName);
      if (!pEntry) { toast(`⚠️ Không tìm thấy người chơi "${targetName}"`); return true; }
      emitOp({ k: 'kick', targetId: pEntry[0], targetName: pEntry[1].name, byHost: net.selfId });
      toast(`👢 Đã đuổi ${pEntry[1].name} ra khỏi phòng!`);
      return true;
    }
    case 'ban': {
      const targetName = args[0];
      if (!targetName) { toast('⚠️ Cú pháp: :ban <tên_người_chơi>'); return true; }
      const pEntry = findPeerByName(targetName);
      if (pEntry) {
        emitOp({ k: 'kick', targetId: pEntry[0], targetName: pEntry[1].name, byHost: net.selfId });
        adminBanList.add(pEntry[1].name.toLowerCase());
      } else {
        adminBanList.add(targetName.toLowerCase());
      }
      toast(`🚫 Đã đưa "${targetName}" vào danh sách cấm tham gia!`);
      return true;
    }
    case 'unban': {
      const targetName = args[0];
      if (targetName) adminBanList.delete(targetName.toLowerCase());
      toast(`✅ Đã gỡ cấm cho "${targetName}"!`);
      return true;
    }
    case 'mute': {
      const targetName = args[0];
      if (targetName) adminMuteList.add(targetName.toLowerCase());
      toast(`🔇 Đã cấm chat người chơi "${targetName}"!`);
      return true;
    }
    case 'unmute': {
      const targetName = args[0];
      if (targetName) adminMuteList.delete(targetName.toLowerCase());
      toast(`🔊 Đã bỏ cấm chat người chơi "${targetName}"!`);
      return true;
    }
    case 'jail': {
      const targetName = args[0];
      emitOp({ k: 'admin_jail', target: targetName || me.name, jailed: true, by: me.name });
      toast(`⛓️ Đã nhốt lồng giam: ${targetName || me.name}!`);
      return true;
    }
    case 'unjail': {
      const targetName = args[0];
      emitOp({ k: 'admin_jail', target: targetName || me.name, jailed: false, by: me.name });
      toast(`🔓 Đã thả tự do: ${targetName || me.name}!`);
      return true;
    }
    case 'jailall': {
      emitOp({ k: 'admin_jail', target: 'all', jailed: true, by: me.name });
      toast('⛓️ Đã nhốt lồng giam toàn bộ người chơi trong phòng!');
      return true;
    }
    case 'unjailall': {
      emitOp({ k: 'admin_jail', target: 'all', jailed: false, by: me.name });
      toast('🔓 Đã thả tự do cho toàn bộ người chơi!');
      return true;
    }
    case 'freeze': {
      const targetName = args[0];
      emitOp({ k: 'admin_freeze', target: targetName || me.name, frozen: true, by: me.name });
      toast(`🧊 Đã đóng băng: ${targetName || me.name}!`);
      return true;
    }
    case 'thaw':
    case 'unfreeze': {
      const targetName = args[0];
      emitOp({ k: 'admin_freeze', target: targetName || me.name, frozen: false, by: me.name });
      toast(`🔥 Đã rã đông: ${targetName || me.name}!`);
      return true;
    }
    case 'freezeall': {
      emitOp({ k: 'admin_freeze', target: 'all', frozen: true, by: me.name });
      toast('🧊 Đã đóng băng toàn bộ người chơi trong phòng!');
      return true;
    }
    case 'thawall':
    case 'unfreezeall': {
      emitOp({ k: 'admin_freeze', target: 'all', frozen: false, by: me.name });
      toast('🔥 Đã rã đông toàn bộ người chơi!');
      return true;
    }
    case 'god': {
      adminGodMode = true;
      window.adminGodMode = true;
      toast('🛡️ Bật chế độ Bất Tử (God Mode) - Máu luôn 100%!');
      return true;
    }
    case 'ungod': {
      adminGodMode = false;
      window.adminGodMode = false;
      toast('🛡️ Tắt chế độ Bất Tử (God Mode).');
      return true;
    }
    case 'kill': {
      const targetName = args[0];
      emitOp({ k: 'admin_kill', target: targetName || me.name, by: me.name });
      toast(`💀 Đã hạ gục: ${targetName || me.name}!`);
      return true;
    }
    case 'respawn': {
      const targetName = args[0];
      emitOp({ k: 'admin_respawn', target: targetName || me.name, by: me.name });
      toast(`✨ Đã hồi sinh: ${targetName || me.name}!`);
      return true;
    }
    case 'bring': {
      const targetName = args[0];
      if (!targetName) { toast('⚠️ Cú pháp: :bring <tên_người_chơi>'); return true; }
      emitOp({ k: 'admin_teleport', target: targetName, toX: me.x, toY: me.y, by: me.name });
      toast(`🌀 Đang kéo ${targetName} đến chỗ bạn!`);
      return true;
    }
    case 'bringall': {
      emitOp({ k: 'admin_teleport', target: 'all', toX: me.x, toY: me.y, by: me.name });
      toast('🌀 Đang kéo tất cả người chơi về trước mặt bạn!');
      return true;
    }
    case 'to':
    case 'goto': {
      const targetName = args[0];
      if (!targetName) { toast('⚠️ Cú pháp: :to <tên_người_chơi>'); return true; }
      const pEntry = findPeerByName(targetName);
      if (!pEntry) { toast(`⚠️ Không tìm thấy người chơi "${targetName}"`); return true; }
      me.x = pEntry[1].x;
      me.y = pEntry[1].y;
      toast(`⚡ Đã dịch chuyển đến sau lưng ${pEntry[1].name}!`);
      return true;
    }

    // === 2. CHARACTER & CUSTOMIZATION ===
    case 'speed':
    case 'ws': {
      const val = parseFloat(args[0]) || 1;
      adminSpeedMultiplier = Math.max(0.1, Math.min(10, val));
      toast(`⚡ Tốc độ di chuyển đã đặt thành: ${adminSpeedMultiplier}x`);
      return true;
    }
    case 'jp':
    case 'jumppower': {
      const val = parseFloat(args[0]) || 8.2;
      adminJumpPower = Math.max(1, Math.min(25, val));
      toast(`🦘 Lực nhảy đã đặt thành: ${adminJumpPower}`);
      return true;
    }
    case 'fly': {
      adminFlying = true;
      toast('🦅 Bật chế độ Bay Tự Do! (Nhấn Space để bay lên, Shift để hạ xuống)');
      return true;
    }
    case 'unfly': {
      adminFlying = false;
      toast('🦅 Tắt chế độ Bay.');
      return true;
    }
    case 'noclip': {
      adminNoclip = true;
      toast('👻 Bật chế độ Noclip! Bạn có thể đi xuyên qua tất cả các bức tường.');
      return true;
    }
    case 'clip': {
      adminNoclip = false;
      toast('🧱 Đã tắt Noclip - va chạm bình thường.');
      return true;
    }
    case 'invisible':
    case 'invis': {
      if (me.av) me.av.root.visible = false;
      toast('👤 Bạn đã trở nên tàng hình hoàn toàn!');
      return true;
    }
    case 'visible':
    case 'vis': {
      if (me.av) me.av.root.visible = true;
      toast('👤 Bạn đã hiện hình trở lại!');
      return true;
    }
    case 'size': {
      const s = parseFloat(args[0]) || 1;
      const finalScale = Math.max(0.2, Math.min(6, s));
      if (me.av) me.av.root.scale.set(finalScale, finalScale, finalScale);
      emitOp({ k: 'admin_size', target: me.name, scale: finalScale });
      toast(`📏 Đã chỉnh kích thước nhân vật: ${finalScale}x`);
      return true;
    }
    case 'giant': {
      const targetName = args[0] || me.name;
      const s = 3.5;
      if (targetName === me.name || targetName === 'all') {
        if (me?.av) me.av.root.scale.set(s, s, s);
      }
      emitOp({ k: 'admin_size', target: targetName, scale: s });
      toast(`🦕 Đã biến ${targetName} thành người khổng lồ 3.5x!`);
      return true;
    }
    case 'tiny': {
      const targetName = args[0] || me.name;
      const s = 0.35;
      if (targetName === me.name || targetName === 'all') {
        if (me?.av) me.av.root.scale.set(s, s, s);
      }
      emitOp({ k: 'admin_size', target: targetName, scale: s });
      toast(`🐜 Đã biến ${targetName} thành người tí hon 0.35x!`);
      return true;
    }

    // === 3. WORLD & ENVIRONMENT ===
    case 'sm':
    case 'm': {
      const msg = args.join(' ');
      if (!msg) { toast('⚠️ Cú pháp: :sm <nội dung thông báo>'); return true; }
      emitOp({ k: 'admin_sm', text: msg, by: me.name });
      return true;
    }
    case 'time': {
      const t = args[0] || 'day';
      world.setDayNightTime?.(t);
      toast(`☀️ Đã chỉnh thời gian sang: ${t}`);
      return true;
    }
    case 'gravity': {
      const g = parseFloat(args[0]) || 20;
      currentGravity = Math.max(0, Math.min(50, g));
      emitOp({ k: 'admin_gravity', gravity: currentGravity });
      toast(`🌍 Trọng lực đã đặt thành: ${currentGravity}`);
      return true;
    }
    case 'shutdown': {
      emitOp({ k: 'closeRoom', hostName: me.name });
      toast('🛑 Đã tắt phòng!');
      return true;
    }

    // === 4. FUN & TROLL ===
    case 'chips': {
      const num = parseInt(args[0], 10) || 1000;
      addChips(num);
      playSfx('jackpot_voice');
      updateCasinoChipsUI();
      toast(`🪙 Admin: Đã cấp thêm ${num.toLocaleString()} xu vào ví!`);
      return true;
    }
    case 'fire': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_fire', target: targetName });
      toast(`🔥 Đã đốt lửa người chơi ${targetName}!`);
      return true;
    }
    case 'blind': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_blind', target: targetName, blind: true });
      toast(`🕶️ Đã làm mù người chơi ${targetName}!`);
      return true;
    }
    case 'unblind': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_blind', target: targetName, blind: false });
      toast(`👀 Đã xóa mù người chơi ${targetName}!`);
      return true;
    }
    case 'spin':
    case 'spinall': {
      const targetName = (cmd === 'spinall' || args[0] === 'all') ? 'all' : (args[0] || me.name);
      emitOp({ k: 'admin_spin', target: targetName, by: me.name });
      if (targetName === me.name || targetName === 'all') adminSpinUntil = performance.now() + 6500;
      toast(`💫 Đã kích hoạt xoay mòng mòng cho ${targetName}!`);
      return true;
    }
    case 'disco': {
      emitOp({ k: 'admin_disco', by: me.name });
      document.body.classList.toggle('disco-active');
      toast('🪩 Đã bật/tắt sàn nhảy Disco lung linh toàn phòng!');
      return true;
    }
    case 'earthquake': {
      emitOp({ k: 'admin_earthquake', by: me.name });
      document.body.classList.add('earthquake-active');
      playSfx('explosion', 'tet');
      toast('🌋 ĐÃ KÍCH HOẠT ĐỘNG ĐẤT RUNG CHUYỂN SERVER!');
      setTimeout(() => document.body.classList.remove('earthquake-active'), 5500);
      return true;
    }
    case 'nuke': {
      emitOp({ k: 'admin_nuke', by: me.name });
      const flash = document.createElement('div');
      flash.className = 'nuke-flash-overlay';
      document.body.appendChild(flash);
      playSfx('explosion', 'tet');
      toast('💥 BOM HẠT NHÂN ADMIN VỪA KÍCH NỔ!');
      setTimeout(() => flash.remove(), 2600);
      return true;
    }
    case 'rocket': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_rocket', target: targetName, by: me.name });
      if (targetName === me.name || targetName === 'all') {
        me.vy = 42;
        me.h += 3;
        playSfx('firework_rocket', 'tet');
      }
      toast(`🚀 Phóng ${targetName} lên mây xanh như tên lửa!`);
      return true;
    }
    case 'slap': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_slap', target: targetName, by: me.name });
      if (targetName === me.name || targetName === 'all') {
        me.vy = 6;
        me.h += 0.8;
        me.av?.showTomatoSplat?.();
        playSfx('splat', 'halloween');
      }
      toast(`🍅 BỐP! Đã tát ${targetName} lộn mèo và ném cà chua bét nhè!`);
      return true;
    }
    case 'danceall': {
      emitOp({ k: 'admin_dance', target: 'all', by: me.name });
      me.av?.playEmote?.('dance');
      toast('💃 Toàn bộ server cùng nhau nhảy múa!');
      return true;
    }
    case 'clown': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_clown', target: targetName, by: me.name });
      if (targetName === me.name || targetName === 'all') {
        me.pumpkinHat = me.pumpkinHat ? null : 'classic';
        me.av?.setPumpkinHat?.(me.pumpkinHat);
        syncMyAppearance();
      }
      toast(`🤡 Đã phong chú hề cho ${targetName}!`);
      return true;
    }

    // === 5. RESET COMMANDS ===
    case 'resetall':
    case 'clean': {
      emitOp({ k: 'admin_reset_all', by: me.name });
      adminSpeedMultiplier = 1.0;
      adminJumpPower = 8.2;
      adminFlying = false;
      adminNoclip = false;
      adminGodMode = false;
      window.adminGodMode = false;
      isFrozen = false;
      isJailed = false;
      jailedPos = null;
      currentGravity = 20;
      adminSpinUntil = 0;
      document.body.classList.remove('blinded-screen', 'earthquake-active', 'disco-active');
      if (me?.av) {
        me.av.root.scale.set(1, 1, 1);
        me.av.root.visible = true;
      }
      peers.forEach(p => {
        if (p.av) {
          p.av.root.scale.set(1, 1, 1);
          p.av.root.visible = true;
        }
      });
      toast('✨ Đã đặt lại toàn bộ hiệu ứng troll về mặc định!');
      return true;
    }
    case 'resetchips': {
      resetChips();
      updateCasinoChipsUI();
      toast('🪙 Đã đặt lại số xu Casino của bạn về 0!');
      return true;
    }
    case 'clearhistory': {
      localStorage.removeItem('gh_code_history');
      toast('⏳ Đã xóa lịch sử hồi chiêu 10 phút của tất cả mã code!');
      return true;
    }
    case 'clearmap': {
      state.decor = [];
      state.cards = [];
      emitOp({ k: 'decor_place', item: null, clearAll: true });
      toast('🧹 Đã dọn dẹp sạch sẽ đồ trang trí trên sàn!');
      return true;
    }
    default:
      toast(`⚠️ Lệnh không xác định: :${cmd}. Mở [;] để xem hướng dẫn!`);
      return false;
  }
}

