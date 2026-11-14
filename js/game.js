import * as THREE from 'three';
import {
  THEMES,
  COSTUMES,
  PUMPKIN_HATS,
  ORNAMENTS,
  CARD_STYLES,
  rollLixiReward,
} from './themes.js';
import { isSolid, buildThemeMap, validMap, migrateLegacyThemeMap } from './maps.js?v=20261114seasonalphase2';
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
import { World, TILE } from './world.js?v=20261114seasonalphase9';
import { Avatar, loadCharacter, EMOTE_CLIP, hueFor, isAdminUser } from './avatar.js?v=20261114avatarfit1';
import { emojiSprite, part, G, mat } from './props.js';
import { RtcManager } from './rtc.js?v=20261112_livekit';
import {
  initAudio,
  playBgm,
  toggleBgm,
  setBgmVolume,
  playSfx,
  isBgmMuted,
  getBgmVolume,
} from './audio.js';
import { MinigameManager, DRAGON_SKINS, FLIGHT_QUESTS } from './minigames.js';
import { SeasonalActivities, canApplySeasonalEventOperation } from './seasonal-activities.js?v=20261114seasonalphase9';
import { SeasonalAuthorityClient } from './authority-client.js?v=20261114seasonalphase9';
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
  resetCoins,
  redeemCode,
  handleCasinoBroadcast,
  VALID_CODES,
  CASINO_SHOP_ITEMS,
  getInventory,
  getEquipped,
  buyShopItem,
  equipShopItem,
  unequipShopItem,
} from './casino.js?v=2026111217';
import { loadAvatarCustomization, openAvatarStudioModal } from './avatar_customizer.js';

let myAvatarCustom = loadAvatarCustomization();
let rtc = null;
let minigames = null;
let seasonalActivities = null;
const voiceFallbackPeers = new Set();
let rtcSignalSequence = 0;

function initRtc(selfId, roomId) {
  voiceFallbackPeers.clear();
  if (rtc) {
    try {
      rtc.destroy();
    } catch {}
  }
  rtc = new RtcManager({
    selfId,
    roomId: roomId || state?.room || 'quang-truong-noel',
    participantName: me?.name || selfId,
    sendSignal: (targetId, signal) => net?.send('rtc_signal', {
      ...signal,
      _rtcSignalId: `${selfId}:${++rtcSignalSequence}`,
    }, targetId),
    getPeerIds: () => [...peers.keys()],
    onFallbackActivated: () => {
      voiceFallbackPeers.add(selfId);
      net?.send('voice_fallback', { fallback: true });
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
  window.__gh_rtc = rtc;
}

// Unlock remote WebRTC audio playback on user gesture
window.addEventListener('pointerdown', () => rtc?.unlockAudioPlayback(), { passive: true });
window.addEventListener('keydown', () => rtc?.unlockAudioPlayback(), { passive: true });
window.addEventListener('click', () => rtc?.unlockAudioPlayback(), { passive: true });
window.addEventListener('touchstart', () => rtc?.unlockAudioPlayback(), { passive: true });

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
  rtc.unlockAudioPlayback();
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
const authorityUrl = new URLSearchParams(location.search).get('authority') || document.querySelector('meta[name="gh-authority"]')?.content || '';
const seenAuthorityFireworkIds = new Set();
const authorityClient = new SeasonalAuthorityClient({
  baseUrl: authorityUrl,
  onState: snapshot => {
    if (!state || snapshot.theme !== state.theme) return;
    state.seasonalEvents = snapshot.seasonalEvents || {};
    state.v = Math.max(state.v || 0, snapshot.seq || 0);
    for (const event of state.seasonalEvents?.tet?.fireworks?.events || []) {
      if (seenAuthorityFireworkIds.has(event.id)) continue;
      seenAuthorityFireworkIds.add(event.id);
      const elapsed = authorityClient.serverNow() - event.startAt;
      if (elapsed < 0 || elapsed > 9000) continue;
      if (event.kind === 'launcher') world?.spawnFireworksShow?.(event.x, event.y, event.seed, elapsed);
      else if (event.kind === 'cracker' && elapsed < 900) world?.spawnFirecrackers?.(event.x, event.y, event.seed);
      if (elapsed < 600) playSfx(event.kind === 'cracker' ? 'firecracker' : 'firework_rocket', 'tet');
      if (event.by && event.kind === 'launcher') toast(`🎆 ${event.by} đã khởi động giàn pháo hoa cộng đồng!`);
    }
    seasonalActivities?.refresh();
    world?.syncSeasonalEventVisuals(state.seasonalEvents, state.theme);
  },
  onStatus: status => document.body?.dataset && (document.body.dataset.authorityStatus = status),
  getPosition: () => me && ({ x: me.x, y: me.y }),
});
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
const adminFireEffects = new WeakMap();
const GRAPHICS_QUALITY_KEY = 'gh_graphics_quality';
const GRAPHICS_PROFILES = {
  low: { pixelRatio: 0.65, shadows: false, shadowMapSize: 512, particleScale: 0.3 },
  medium: { pixelRatio: 1, shadows: true, shadowMapSize: 512, particleScale: 0.65 },
  // Sharper native resolution and shadows; Auto quality can step down on slower devices.
  high: { pixelRatio: Math.min(window.devicePixelRatio || 1, 1.75), shadows: true, shadowMapSize: 2048, particleScale: 1 },
};
const GRAPHICS_QUALITY_ORDER = ['low', 'medium', 'high'];
const savedGraphicsQuality = localStorage.getItem(GRAPHICS_QUALITY_KEY);
let graphicsQuality =
  savedGraphicsQuality === 'auto' || Object.hasOwn(GRAPHICS_PROFILES, savedGraphicsQuality)
    ? savedGraphicsQuality
    : 'auto';
function detectInitialGraphicsQuality() {
  const memory = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  if ((Number.isFinite(memory) && memory <= 2) || (Number.isFinite(cores) && cores <= 2)) return 'low';
  if ((Number.isFinite(memory) && memory <= 4) || (Number.isFinite(cores) && cores <= 4) || coarsePointer) {
    return 'medium';
  }
  return 'high';
}
let adaptiveGraphicsQuality = detectInitialGraphicsQuality();
let lowGraphicsFpsSamples = 0;
let highGraphicsFpsSamples = 0;

function getActiveGraphicsQuality() {
  return graphicsQuality === 'auto' ? adaptiveGraphicsQuality : graphicsQuality;
}

function updateGraphicsQualityHint() {
  const hint = $('graphicsQualityHint');
  if (!hint) return;
  const labels = { low: 'Thấp', medium: 'Trung bình', high: 'Cao' };
  hint.textContent = graphicsQuality === 'auto'
    ? `Tự động điều chỉnh theo thiết bị và FPS · Hiện tại: ${labels[adaptiveGraphicsQuality]}.`
    : `Đang dùng mức ${labels[graphicsQuality]}. Lựa chọn được lưu trên thiết bị này.`;
}

function applyGraphicsQuality() {
  if (!renderer || !world) return;
  const profile = GRAPHICS_PROFILES[getActiveGraphicsQuality()];
  renderer.setPixelRatio(profile.pixelRatio);
  renderer.shadowMap.enabled = profile.shadows;
  renderer.shadowMap.needsUpdate = true;
  world.setGraphicsQuality(profile);
  resize();
  updateGraphicsQualityHint();
}

function updateAdaptiveGraphics(fps) {
  if (graphicsQuality !== 'auto' || document.hidden) {
    lowGraphicsFpsSamples = 0;
    highGraphicsFpsSamples = 0;
    return;
  }

  if (fps < 28) {
    lowGraphicsFpsSamples++;
    highGraphicsFpsSamples = 0;
  } else if (fps >= 55) {
    highGraphicsFpsSamples++;
    lowGraphicsFpsSamples = 0;
  } else {
    lowGraphicsFpsSamples = 0;
    highGraphicsFpsSamples = 0;
  }

  const tierIndex = GRAPHICS_QUALITY_ORDER.indexOf(adaptiveGraphicsQuality);
  let nextQuality = adaptiveGraphicsQuality;
  if (lowGraphicsFpsSamples >= 3 && tierIndex > 0) {
    lowGraphicsFpsSamples = 0;
    nextQuality = GRAPHICS_QUALITY_ORDER[tierIndex - 1];
  } else if (highGraphicsFpsSamples >= 12 && tierIndex < GRAPHICS_QUALITY_ORDER.length - 1) {
    highGraphicsFpsSamples = 0;
    nextQuality = GRAPHICS_QUALITY_ORDER[tierIndex + 1];
  }

  if (nextQuality !== adaptiveGraphicsQuality) {
    adaptiveGraphicsQuality = nextQuality;
    applyGraphicsQuality();
  }
}

const isHost = () => !!(state && net && state.hostId === net.selfId);
const requireRoomHost = () => {
  if (isHost()) return true;
  toast('⛔ Lệnh này chỉ Chủ phòng mới có thể thực hiện!');
  return false;
};
const normalizePlayerName = name => String(name || '').trim().toLowerCase();
const isAdminTarget = (target, name) =>
  normalizePlayerName(target) === 'all' || normalizePlayerName(target) === normalizePlayerName(name);

function applyTemporaryAdminFire(avatar, fallbackAura) {
  if (!avatar) return;
  const activeEffect = adminFireEffects.get(avatar);
  if (activeEffect) clearTimeout(activeEffect.timer);
  const previousAura = activeEffect?.previousAura ?? avatar.auraKey ?? fallbackAura ?? null;
  avatar.setAura('fire');
  const timer = setTimeout(() => {
    if (avatar.auraKey === 'fire') avatar.setAura(previousAura);
    adminFireEffects.delete(avatar);
  }, 5000);
  adminFireEffects.set(avatar, { previousAura, timer });
}

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
  const initialGraphicsProfile = GRAPHICS_PROFILES[getActiveGraphicsQuality()];
  renderer.setPixelRatio(initialGraphicsProfile.pixelRatio);
  renderer.shadowMap.enabled = initialGraphicsProfile.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1, 0.1, 300);
  world = new World(scene, updateMapLoadingScreen);
  world.setGraphicsQuality(initialGraphicsProfile);
  updateGraphicsQualityHint();
  minigames = new MinigameManager(scene, camera, () => me, () => peers, emitOp, toast, floaters);
  seasonalActivities = new SeasonalActivities({
    getState: () => state,
    getSelfId: () => authorityClient.connected ? authorityClient.userId : net?.selfId,
    getPlayerName: id => id === authorityClient.userId || id === net?.selfId ? me?.name : peers.get(id)?.name || 'Người chơi',
    emitOp,
    toast,
    onCostumeSubmit: costumeKey => equipCostume(costumeKey),
    getHeldItem: () => me?.heldItem,
    getAuthorityEnabled: () => authorityClient.connected,
    getServerNow: () => authorityClient.serverNow(),
    consumeHeldItem: ornamentKey => {
      if (me?.heldItem !== ornamentKey) return;
      me.heldItem = null;
      me.av?.setHeldItem(null);
      updateStatusBadges();
      syncMyAppearance();
    },
    onCapturePhoto: () => {
      try {
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/png');
      } catch {
        return null;
      }
    },
  });
  initAudio();
  initCasino(world, toast, emitOp, () => me, () => peers, () => net?.selfId, logChat);
  initMobileControls();
  setupBuilderToolsInteraction();
  setupAdminCommandAutocomplete();
} catch (e) {
  console.error('Three.js / WebGL Setup Error:', e);
  document.addEventListener('DOMContentLoaded', () => toast('Trình duyệt đang mở chế độ hạn chế đồ họa 3D'));
} finally {
  initGameSplashScreen();
}

function initGameSplashScreen() {
  const splash = $('gameSplashScreen');
  const bar = $('splashProgressBar');
  const status = $('splashStatusText');
  if (!splash) return;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(interval);
    clearTimeout(hardTimer);
    if (bar) bar.style.width = '100%';
    if (status) status.textContent = 'Hoàn tất! Đang vào sảnh...';
    splash.classList.add('fade-out');
    setTimeout(() => {
      try {
        if (splash.parentNode) splash.remove();
      } catch (_) {}
    }, 600);
  };

  splash.onclick = finish;
  const hardTimer = setTimeout(finish, 1600);

  let progress = 18;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 25) + 15;
    if (progress >= 100) {
      finish();
    } else {
      if (bar) bar.style.width = `${progress}%`;
      if (status) {
        if (progress > 60) status.textContent = 'Đang đồng bộ hoạt ảnh & âm thanh...';
        else if (progress > 30) status.textContent = 'Đang nạp không gian lễ hội 3D...';
      }
    }
  }, 90);
}

function updateMapLoadingScreen({ active, progress = 0, message = '', themeKey, error } = {}) {
  const screen = $('mapLoadingScreen');
  if (!screen) return;
  const title = $('mapLoadingTitle');
  const status = $('mapLoadingStatus');
  const bar = $('mapLoadingProgress');
  const percent = $('mapLoadingPercent');
  const retry = $('btnRetryMapLoad');

  if (error) {
    screen.classList.remove('hidden');
    screen.classList.add('error');
    if (title) title.textContent = 'Không thể tải bản đồ';
    if (status) status.textContent = 'Đã xảy ra lỗi khi dựng cảnh. Bạn có thể thử tải lại.';
    if (retry) {
      retry.disabled = false;
      retry.classList.remove('hidden');
    }
    return;
  }
  if (!active) {
    screen.classList.add('hidden');
    screen.classList.remove('error');
    if (retry) retry.classList.add('hidden');
    return;
  }

  const value = Math.max(0, Math.min(100, Math.round(progress)));
  screen.classList.remove('hidden');
  screen.classList.remove('error');
  if (title) title.textContent = `Đang tải ${THEMES[themeKey]?.name || 'bản đồ'}`;
  if (status) status.textContent = message || 'Đang dựng cảnh...';
  if (bar) {
    bar.style.width = `${value}%`;
    bar.setAttribute('aria-valuenow', String(value));
  }
  if (percent) percent.textContent = `${value}%`;
  if (retry) retry.classList.add('hidden');
}

function retryMapLoading() {
  if (!world || !state) return;
  const retry = $('btnRetryMapLoad');
  if (retry) retry.disabled = true;
  world.mapKey = '';
  world.sync(state, roomName);
}

$('btnRetryMapLoad')?.addEventListener('click', retryMapLoading);

function initMobileControls() {
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.matchMedia('(pointer: coarse)').matches;
  const container = $('mobileControls');
  if (!container) return;

  container.classList.toggle('hidden', !isMobile);

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
    b.onclick = async () => {
      if (!checkCooldown()) return;
      if (me.heldItem) { toast('🎒 Bạn đang cầm một món. Hãy treo hoặc đóng góp món đó trước.'); return; }
      if (state?.theme === 'christmas') {
        const accepted = await emitOp({ k: 'seasonal_event', season: 'christmas', action: 'ornament_pickup', data: { ornamentKey: orn.key } });
        if (accepted === false) return;
      }
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
$('graphicsQuality').value = graphicsQuality;
$('graphicsQuality').addEventListener('change', event => {
  const selectedQuality = event.target.value;
  if (selectedQuality !== 'auto' && !Object.hasOwn(GRAPHICS_PROFILES, selectedQuality)) return;
  graphicsQuality = selectedQuality;
  if (graphicsQuality === 'auto') adaptiveGraphicsQuality = detectInitialGraphicsQuality();
  lowGraphicsFpsSamples = 0;
  highGraphicsFpsSamples = 0;
  localStorage.setItem(GRAPHICS_QUALITY_KEY, graphicsQuality);
  applyGraphicsQuality();
});
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

function openMyAvatarStudio() {
  openAvatarStudioModal(myAvatarCustom, (newCfg) => {
    myAvatarCustom = newCfg;
    if (me?.av) {
      me.avatarCustom = newCfg;
      me.av.applyCustomization(newCfg);
      syncMyAppearance();
    }
    toast('✨ Đã lưu diện mạo Avatar mới!');
  });
}

$('btnOpenCustomizeFromLobby')?.addEventListener('click', openMyAvatarStudio);
$('btnOpenAvatarStudio')?.addEventListener('click', openMyAvatarStudio);

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

const lobbyBadgeEl = $('lobbyOnlineBadge');
if (lobbyBadgeEl) {
  lobbyBadgeEl.onclick = () => {
    const status = lobby?.getConnectionStatus?.() || { isOnline: false, roomCount: 0 };
    if (status.isOnline) {
      toast(`✅ Cụm máy chủ MQTT kết nối tốt · ${status.roomCount} phòng trực tuyến`);
    } else {
      toast('⏳ Đang kết nối lại cụm máy chủ MQTT...');
    }
    lobby?.requestDiscover?.();
    renderLobbyRooms();
  };
}

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

  const badge = $('lobbyOnlineBadge');
  if (badge) {
    const status = lobby?.getConnectionStatus?.() || { isOnline: true, roomCount: liveRooms.length };
    if (status.isOnline) {
      badge.textContent = `● Trực tuyến (${liveRooms.length} phòng)`;
      badge.className = 'live-dot online';
      badge.title = 'Máy chủ MQTT kết nối tốt · Bấm để kiểm tra chi tiết';
    } else {
      badge.textContent = '⏳ Đang kết nối máy chủ...';
      badge.className = 'live-dot connecting';
      badge.title = 'Đang kết nối lại máy chủ MQTT · Bấm để thử lại ngay';
    }
  }

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
  window.__gh_net = net;
  initRtc(net.selfId, roomName);
  $('roomInfo').textContent = `📍 ${roomTitle}`;
  updateLiveStats();
  updateCasinoChipsUI();
  updateTitleUI();

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
      bannedNames: [],
      mutedNames: [],
      theme: selectedTheme,
      timeOfDay: 'day',
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
      seasonalEvents: {},
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

  if (state.bannedNames?.includes(normalizePlayerName(me.name))) {
    handleSelfKicked(state.hostName);
    return;
  }

  // If this room has a password and the player hasn't verified it yet (e.g. joined via direct link)
  if (state.passHash && state.hostId !== net.selfId && verifiedPassHash !== state.passHash) {
    promptRoomPassword(
      { id: roomName, title: state.roomTitle || roomName, passHash: state.passHash },
      () => start()
    );
    return;
  }

  // Reset coin wallet to 0 upon entering/joining room (only codes nạp xu)
  resetCoins();

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

  // Apply saved equipped items from Boutique Shop
  try {
    const eq = getEquipped?.() || {};
    if (eq.accessory) {
      me.accessory = eq.accessory;
      me.av.setAccessory(eq.accessory);
    }
    if (eq.aura) {
      me.aura = eq.aura;
      me.av.setAura(eq.aura);
    }
    if (eq.nametag) {
      me.nametagStyle = eq.nametag;
      me.av.setName(me.name, me.title, eq.nametag);
    }
  } catch (err) {
    console.warn('Error loading equipped items:', err);
  }

  // Apply saved avatar customization
  if (myAvatarCustom) {
    me.avatarCustom = myAvatarCustom;
    me.av.applyCustomization(myAvatarCustom);
  }

  scene.add(me.av.root);

  // Immediately synchronize 3D world before starting animation loop
  await world.sync(state, roomName);

  $('topTheme').value = state.theme;
  $('topTheme').classList.toggle('hidden', roomName === SECRET_CASINO_ROOM);
  $('statFps').textContent = '⚡ 60 FPS';
  playBgm(state.theme);
  minigames?.setTheme(state.theme);
  seasonalActivities?.setTheme(state.theme);
  if (authorityClient.enabled) {
    try {
      await authorityClient.connect({ roomId: roomName, theme: state.theme, name: me.name, memberId: net.selfId, host: isHost() });
      toast('🔒 Đã kết nối máy chủ tiến trình bền vững.');
    } catch (error) {
      console.error('[Authority] Persistent room service unavailable:', error);
      toast('⚠️ Máy chủ tiến trình chưa sẵn sàng. Hoạt động lưu tiến trình đang tạm khóa.');
    }
  }
  net.send('hello', pubInfo());
  applyMedia(state.mediaCurrent);
  updateHud();
  updateHostUI();
  updateStatusBadges();
  updateMediaDialog();
  updateLiveStats();
  updateCasinoChipsUI();
  updateTitleUI();
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
  accessory: me.accessory || null,
  aura: me.aura || null,
  nametagStyle: me.nametagStyle || null,
  isAdmin: typeof isAdminVerified === 'function' ? isAdminVerified() : false,
  seatId: me.seatSlot?.id || null,
  pose: me.seatSlot?.pose || null,
  avatarCustom: me.avatarCustom || null,
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
    pose: d.pose || null,
    avatarCustom: d.avatarCustom !== undefined ? d.avatarCustom : p.avatarCustom,
  });
  if (state && id === state.hostId && d.name) {
    state.hostName = d.name;
  }
  refreshRecipients();
  updateLiveStats();
  updateHostUI();
  broadcastMyRoomToLobby();

  if (p.av) {
    p.av.setName(p.name, p.title, p.nametagStyle);
    p.av.applyCostume(p.costume);
    p.av.setPumpkinHat(p.pumpkinHat);
    p.av.setHeldItem(p.heldItem);
    p.av.setAccessory(p.accessory);
    p.av.setAura(p.aura);
    p.av.setAdminAura?.(!!p.isAdmin);
    if (p.avatarCustom) p.av.applyCustomization(p.avatarCustom);
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
  if (p.avatarCustom) p.av.applyCustomization(p.avatarCustom);
  p.av.setHeldItem(p.heldItem);
  p.av.setAccessory(p.accessory);
  p.av.setAura(p.aura);
  p.av.setAdminAura?.(!!p.isAdmin);
  if (p.nametagStyle) p.av.setName(p.name, p.title, p.nametagStyle);
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
    if (rtc?.voiceMode === 'p2p' && rtc.localVoiceStream) rtc.connectPeer(id);
    if (voiceFallbackPeers.size) net?.send('voice_fallback', { fallback: true }, id);
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
    voiceFallbackPeers.delete(id);
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
    const name = String(d?.name || '').trim();
    if (state?.bannedNames?.includes(normalizePlayerName(name))) {
      if (isHost()) {
        emitOp({ k: 'kick', targetId: id, targetName: name, byHost: state.hostId });
      }
      return;
    }
    addOrUpdatePeer(id, d);
    rtc?.getOrCreatePeer(id);
  },
  voice_speaking(d, id) {
    const p = peers.get(id);
    if (p?.av) p.av.setSpeaking(!!d?.speaking);
  },
  voice_fallback(d, id) {
    if (!d?.fallback || !id) return;
    voiceFallbackPeers.add(id);
    rtc?.activateP2PFallback('another room member switched to P2P', false);
    if (rtc?.localVoiceStream) rtc.connectPeer(id);
  },
  rtc_signal(d, id) {
    rtc?.handleSignal(id, d);
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
      p.pose = d.pose || null;
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
    const persistedSeasonalEvents = authorityClient.enabled ? state?.seasonalEvents : null;
    state = s;
    state.map = migrateLegacyThemeMap(state.map, state.theme);
    state.seasonalEvents = persistedSeasonalEvents || (state.seasonalEvents && typeof state.seasonalEvents === 'object' && !Array.isArray(state.seasonalEvents)
      ? state.seasonalEvents
      : {});
    seasonalActivities?.setTheme(state.theme);
    state.kickedIds = Array.isArray(state.kickedIds) ? state.kickedIds : [];
    state.bannedNames = Array.isArray(state.bannedNames) ? state.bannedNames : [];
    state.mutedNames = Array.isArray(state.mutedNames) ? state.mutedNames : [];
    if (s.roomTitle) roomTitle = s.roomTitle;
    gotState = true;

    if (first) {
      start();
    } else {
      seasonalActivities?.refresh();
      world?.syncSeasonalEventVisuals(state.seasonalEvents, state.theme);
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
    if (state?.mutedNames?.includes(normalizePlayerName(p?.name))) return;
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
  // The public MQTT relay does not authenticate `senderId`; this host check
  // blocks ordinary guests, but sensitive moderation still needs a trusted backend.
  if (typeof op?.k === 'string' && op.k.startsWith('admin_') && senderId !== state?.hostId) return;
  switch (op.k) {
    case 'theme': {
      if (!state?.hostId || senderId !== state.hostId) return;
      if (THEMES[op.theme]) {
        state.theme = op.theme;
        state.map = buildThemeMap(op.theme);
        state.decor = [];
        if ($('topTheme')) $('topTheme').value = op.theme;
        leaveSeat();
        playBgm(op.theme);
        world.sync(state, roomName);
        minigames?.setTheme(op.theme);
        seasonalActivities?.setTheme(op.theme);
        broadcastMyRoomToLobby();
        if (op.theme === 'casino') {
          me.x = 14.5;
          me.y = 17.5;
          me.h = 0;
          me.vy = 0;
          yaw = Math.PI;
          if (me.av?.root) me.av.root.position.set(me.x * TILE, 0, me.y * TILE);
          toast('🎰 Cả phòng đã cùng bước vào Mật Thất Casino & Pub Hoàng Gia!');
        } else {
          toast(`🗺️ Chủ phòng đã chuyển chủ đề sang: ${THEMES[op.theme].name}`);
        }
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
    case 'admin_ban': {
      state.bannedNames = state.bannedNames || [];
      const target = normalizePlayerName(op.name);
      if (!target) break;
      state.bannedNames = state.bannedNames.filter(name => normalizePlayerName(name) !== target);
      if (op.banned) {
        state.bannedNames.push(target);
        const pEntry = findPeerByName(op.name);
        if (isHost() && pEntry) {
          emitOp({ k: 'kick', targetId: pEntry[0], targetName: pEntry[1].name, byHost: state.hostId });
        }
      }
      break;
    }
    case 'admin_mute': {
      state.mutedNames = state.mutedNames || [];
      const target = normalizePlayerName(op.name);
      if (!target) break;
      state.mutedNames = state.mutedNames.filter(name => normalizePlayerName(name) !== target);
      if (op.muted) state.mutedNames.push(target);
      break;
    }
    case 'admin_time': {
      if (!world.setDayNightTime(op.time)) break;
      state.timeOfDay = op.time;
      toast(`☀️ Đã chỉnh thời gian sang: ${op.time}`);
      break;
    }
    case 'admin_clearmap': {
      state.decor = [];
      state.cards = [];
      world.sync(state, roomName);
      toast('🧹 Đã dọn dẹp sạch sẽ đồ trang trí trên sàn!');
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
      if (isAdminTarget(op.target, me.name)) {
        isFrozen = !!op.frozen;
        toast(isFrozen ? '🧊 Bạn đã bị Admin đóng băng!' : '🔥 Bạn đã được giải phóng!');
      }
      break;
    }
    case 'admin_jail': {
      if (isAdminTarget(op.target, me.name)) {
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
      if (isAdminTarget(op.target, me.name)) {
        me.x = op.toX;
        me.y = op.toY;
        me.h = 0;
        toast(`🌀 Bạn vừa bị Admin ${op.by} dịch chuyển tức thời!`);
      }
      break;
    }
    case 'admin_kill': {
      if (isAdminTarget(op.target, me.name)) {
        me.x = 14.5;
        me.y = 18.5;
        me.h = 0;
        toast(`💀 Bạn đã bị Admin ${op.by} hạ gục! Đang hồi sinh tại sảnh...`);
      }
      break;
    }
    case 'admin_respawn': {
      if (isAdminTarget(op.target, me.name)) {
        me.x = 14.5;
        me.y = 18.5;
        me.h = 0;
        toast('✨ Bạn đã được hồi sinh!');
      }
      break;
    }
    case 'admin_blind': {
      if (isAdminTarget(op.target, me.name)) {
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
      const targetsMe = isAdminTarget(op.target, me?.name);
      if (targetsMe) {
        if (me?.av) me.av.root.scale.set(op.scale, op.scale, op.scale);
      }
      if (normalizePlayerName(op.target) === 'all') {
        peers.forEach(p => {
          if (p.av) p.av.root.scale.set(op.scale, op.scale, op.scale);
        });
      } else if (!targetsMe) {
        const pEntry = findPeerByName(op.target);
        if (pEntry && pEntry[1].av) {
          pEntry[1].av.root.scale.set(op.scale, op.scale, op.scale);
        }
      }
      break;
    }
    case 'admin_fire': {
      if (isAdminTarget(op.target, me?.name)) {
        playSfx('firecracker', 'tet');
        applyTemporaryAdminFire(me.av, me.aura);
        toast('🔥 Bạn đang bốc cháy trong 5 giây!');
      }
      peers.forEach(p => {
        if (isAdminTarget(op.target, p.name)) applyTemporaryAdminFire(p.av, p.aura);
      });
      break;
    }
    case 'admin_gravity': {
      currentGravity = op.gravity;
      toast(`🌍 Trọng lực thế giới đã thay đổi: ${currentGravity}`);
      break;
    }
    case 'casino_broadcast': {
      handleCasinoBroadcast(op, senderId);
      break;
    }
    case 'admin_spin': {
      if (isAdminTarget(op.target, me?.name)) {
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
      if (isAdminTarget(op.target, me?.name)) {
        me.vy = 42;
        me.h += 3;
        playSfx('firework_rocket', 'tet');
        toast('🚀 VÚT! Bạn đã bị Admin phóng lên chín tầng mây!');
      }
      break;
    }
    case 'admin_slap': {
      if (isAdminTarget(op.target, me?.name)) {
        me.vy = 6;
        me.h += 0.8;
        me.x += (Math.random() - 0.5) * 4;
        me.y += (Math.random() - 0.5) * 4;
        me.av?.triggerSplat?.(4500);
        playSfx('splat', 'halloween');
        toast(`🍅 BỐP! Bạn vừa bị Admin ${op.by} tát lộn mèo + Cà chua dính đầy mặt!`);
      }
      break;
    }
    case 'admin_dance': {
      if (isAdminTarget(op.target, me?.name)) {
        me.av?.playEmote?.('dance');
        toast('💃 Nhạc lên là quẩy! Toàn server cùng nhảy múa!');
      }
      break;
    }
    case 'admin_flex': {
      if (isAdminTarget(op.target, me?.name)) {
        me.av?.playEmote?.('flex');
        toast(`💪 Bạn vừa được Admin ${op.by} gọi flex cơ bắp!`);
      }
      peers.forEach(player => {
        if (isAdminTarget(op.target, player.name)) player.av?.playEmote?.('flex');
      });
      break;
    }
    case 'admin_clown': {
      if (isAdminTarget(op.target, me?.name)) {
        me.pumpkinHat = me.pumpkinHat ? null : 'classic';
        me.av?.setPumpkinHat?.(me.pumpkinHat);
        syncMyAppearance();
        toast('🤡 Bạn vừa bị Admin phong làm Chú Hề của phòng!');
      }
      break;
    }
    case 'admin_limb_state': {
      if (isAdminTarget(op.target, me?.name)) {
        me.av?.setLimbState?.(op.limbs);
        playSfx('splat', 'halloween');
      }
      peers.forEach(p => {
        if (isAdminTarget(op.target, p.name)) {
          p.av?.setLimbState?.(op.limbs);
        }
      });
      break;
    }
    case 'admin_block_place': {
      world.addBuilderBlock(op.block);
      playSfx('plinko_peg', 'casino');
      break;
    }
    case 'admin_block_remove': {
      world.removeBuilderBlock(op.blockId);
      break;
    }
    case 'admin_summon_mob': {
      spawnMobAttack(op.mob || 'bat', op.target, op.by);
      break;
    }
    case 'love_wishing_toss': {
      toast(`💖 ${op.by} vừa tung đồng xu ước nguyện và nhận ban phúc: [${op.blessing.title}]!`);
      playSfx('plinko_win', 'casino');
      break;
    }
    case 'admin_laser': {
      spawnLaserStrike(op.x, op.y, op.target, op.by);
      break;
    }
    case 'admin_blackhole': {
      spawnBlackHole(op.by);
      break;
    }
    case 'admin_confetti': {
      spawnConfettiShower(op.by);
      break;
    }
    case 'admin_tornado': {
      spawnTornado(op.target, op.by);
      break;
    }
    case 'admin_dinnerbone': {
      if (isAdminTarget(op.target, me.name)) {
        me.isDinnerbone = !me.isDinnerbone;
        me.av?.setDinnerbone?.(me.isDinnerbone);
      }
      peers.forEach(p => {
        if (isAdminTarget(op.target, p.name)) {
          p.isDinnerbone = !p.isDinnerbone;
          p.av?.setDinnerbone?.(p.isDinnerbone);
        }
      });
      break;
    }
    case 'admin_clone': {
      spawnCloneHorde(op.target);
      break;
    }
    case 'admin_guillotine': {
      spawnGuillotineStrike(op.target);
      break;
    }
    case 'admin_truonggiang': {
      if (op.active) {
        spawnTruongGiangSlime(op.target, op.by, {
          entityId: op.entityId,
          ownerId: senderId || op.ownerId,
          targetId: op.targetId,
          spawnX: op.spawnX,
          spawnZ: op.spawnZ,
        });
      } else {
        removeTruongGiangSlime();
      }
      break;
    }
    case 'admin_truonggiang_state': {
      if (!op.entityId || op.ownerId !== senderId ||
          ![op.x, op.y, op.z, op.rotationY, op.meshRotationX, op.spawnX, op.spawnZ].every(Number.isFinite) ||
          !Array.isArray(op.meshScale) || !op.meshScale.every(Number.isFinite) ||
          !Number.isInteger(op.stateSequence)) return;
      if (!activeTruongGiangSlimes.has(op.entityId)) {
        spawnTruongGiangSlime(op.target, op.by, {
          entityId: op.entityId,
          ownerId: op.ownerId,
          targetId: op.targetId,
          spawnX: op.spawnX,
          spawnZ: op.spawnZ,
        });
      }
      const slime = activeTruongGiangSlimes.get(op.entityId);
      if (!slime || slime.isAuthority || slime.ownerId !== senderId ||
          op.stateSequence <= slime.lastStateSequence) return;
      slime.lastStateSequence = op.stateSequence;
      slime.lastStateAt = performance.now();
      slime.remotePosition.set(op.x, op.y, op.z);
      slime.remoteRotationY = op.rotationY;
      slime.remoteMeshRotationX = op.meshRotationX;
      slime.remoteMeshScale.set(...op.meshScale);
      if (Number.isInteger(op.impactId) && op.impactId > slime.impactId) {
        slime.impactId = op.impactId;
        showTruongGiangImpact(op.impactTargetId);
      }
      return;
    }
    case 'admin_golden': {
      if (isAdminTarget(op.target, me?.name)) {
        me.av?.setMidasGolden?.(true);
        toast(`✨ Bạn vừa được Admin ${op.by} hóa thành TƯỢNG VÀNG RỰC RỠ!`);
      }
      peers.forEach(p => {
        if (isAdminTarget(op.target, p.name)) p.av?.setMidasGolden?.(true);
      });
      break;
    }
    case 'admin_ghost': {
      if (isAdminTarget(op.target, me?.name)) {
        me.av?.setGhostMode?.(true);
        toast(`👻 Bạn vừa được Admin ${op.by} hóa thành HỒN MA TRONG SUỐT!`);
      }
      peers.forEach(p => {
        if (isAdminTarget(op.target, p.name)) p.av?.setGhostMode?.(true);
      });
      break;
    }
    case 'admin_rainbow': {
      if (isAdminTarget(op.target, me?.name)) {
        me.nametagStyle = 'rainbow';
        me.aura = 'lightning';
        me.av?.setName(me.name, me.title, 'rainbow');
        me.av?.setAura('lightning');
        syncMyAppearance();
        toast(`🌈 Bạn vừa được Admin ${op.by} ban tặng HÀO QUANG CẦU VỒNG RGB!`);
      }
      break;
    }
    case 'admin_heal': {
      if (isAdminTarget(op.target, me?.name)) {
        document.querySelectorAll('.tomato-splat-overlay').forEach(el => el.remove());
        me.av?.playEmote?.('cheer');
        toast(`💖 Bạn đã được Admin ${op.by} hồi phục sinh lực và rửa sạch cà chua!`);
      }
      break;
    }
    case 'admin_matrix': {
      document.body.classList.add('matrix-active');
      adminSpeedMultiplier = 0.3;
      toast(`🕶️ MA TRẬN KÍCH HOẠT: Tốc độ thời gian toàn server chậm lại 70%!`);
      playSfx('spooky_laugh', 'halloween');
      setTimeout(() => {
        document.body.classList.remove('matrix-active');
        if (adminSpeedMultiplier === 0.3) adminSpeedMultiplier = 1.0;
        toast('⚡ Thời gian đã trở lại tốc độ bình thường.');
      }, 5500);
      break;
    }
    case 'admin_gravity_flip': {
      currentGravity = -15;
      me.vy = 4;
      toast(`🌀 TRỌNG LỰC ĐẢO NGƯỢC! Mọi người đang lộn ngược trôi lên trần nhà!`);
      playSfx('firework_rocket', 'tet');
      setTimeout(() => {
        currentGravity = 20;
        toast('🌍 Trọng lực đã trở lại bình thường.');
      }, 6500);
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
      adminBuilderMode = false;
      $('btoolsHud')?.classList.add('hidden');
      world.clearBuilderBlocks();
      removeTruongGiangSlime();
      document.body.classList.remove('blinded-screen', 'earthquake-active', 'disco-active', 'matrix-active', 'builder-mode-active');
      document.querySelectorAll('.tomato-splat-overlay, .laser-flash-overlay').forEach(el => el.remove());
      if (me?.av) {
        me.isDinnerbone = false;
        me.av.root.scale.set(1, 1, 1);
        me.av.root.visible = true;
        me.av.setDinnerbone?.(false);
        me.av.setLimbState?.({ head: true, leftArm: true, rightArm: true, legs: true });
        me.av.setMidasGolden?.(false);
        me.av.setGhostMode?.(false);
      }
      peers.forEach(p => {
        p.isDinnerbone = false;
        if (p.av) {
          p.av.root.scale.set(1, 1, 1);
          p.av.root.visible = true;
          p.av.setDinnerbone?.(false);
          p.av.setLimbState?.({ head: true, leftArm: true, rightArm: true, legs: true });
          p.av.setMidasGolden?.(false);
          p.av.setGhostMode?.(false);
        }
      });
      toast('✨ Tất cả hiệu ứng troll đã được khôi phục về trạng thái ban đầu!');
      break;
    }
    case 'seasonal_event': {
      if (authorityClient.enabled) return;
      // The room host owns shared seasonal progress. Guests submit operations
      // to the host and only apply the canonical snapshot it broadcasts back.
      // The reducer still validates every operation before it changes state.
      if (!canApplySeasonalEventOperation(isHost(), senderId, state?.hostId)) return;
      const changed = seasonalActivities?.applyOperation(op, senderId);
      if (changed) world?.syncSeasonalEventVisuals(state.seasonalEvents, state.theme);
      break;
    }
    case 'mg_snowball_throw':
    case 'mg_cupid_shoot':
    case 'mg_tet_cannon':
    case 'mg_halloween_lantern':
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
  if (typeof op?.k === 'string' && op.k.startsWith('admin_') && !isHost()) {
    toast('⛔ Lệnh quản trị chỉ dùng được bởi chủ phòng.');
    return false;
  }
  if (op?.k === 'seasonal_event' && authorityClient.enabled) {
    if (!authorityClient.connected) {
      toast('⚠️ Không gửi được tiến trình vì máy chủ hoạt động chưa kết nối.');
      return false;
    }
    return authorityClient.submit(op).then(() => true).catch(error => {
      console.error('[Authority] Seasonal operation rejected:', error);
      toast('⚠️ Máy chủ chưa ghi nhận thao tác này. Hãy kiểm tra tiến trình rồi thử lại.');
      return false;
    });
  }
  if (op?.k === 'firework' && authorityClient.enabled) {
    if (!authorityClient.connected) return false;
    return authorityClient.submit({
      k: 'seasonal_event', season: 'tet', action: 'firework_launch',
      data: { kind: op.kind, stationId: op.stationId },
    }).then(() => true).catch(error => {
      console.error('[Authority] Fireworks event rejected:', error);
      toast('⚠️ Pháo hoa chưa được server xác nhận.');
      return false;
    });
  }
  if (op?.k === 'theme' && authorityClient.enabled) {
    authorityClient.changeTheme(op.theme).catch(error => {
      console.error('[Authority] Theme change rejected:', error);
      toast('⚠️ Máy chủ tiến trình chưa chấp nhận bản đồ mới; hoạt động đã khóa để tránh ghi nhầm dữ liệu.');
    });
  }
  op.v = Date.now();
  applyOp(op, net.selfId);
  net.send('op', op);
  return true;
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
  if (state?.mutedNames?.includes(normalizePlayerName(me.name))) {
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
const closeDialog = id => {
  keys.clear();
  $(id)?.classList.add('hidden');
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

$('btnDrawerAvatarStudio').onclick = () => {
  closeVerticalDrawer();
  openMyAvatarStudio();
};
$('btnDrawerCustomize').onclick = () => {
  closeVerticalDrawer();
  openMyAvatarStudio();
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
  if (state?.theme === 'christmas') {
    emitOp({ k: 'seasonal_event', season: 'christmas', action: 'ornament_spend', data: { ornamentKey: orn.key } });
  }
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
  openLixiRhythmGame();
}

// ----------------------------------------------------------------------------
// TET 2025: LIXI REAL-TIME SCHEDULE & RHYTHM MINI-GAME
// ----------------------------------------------------------------------------
function getLixiEventStatus() {
  const now = new Date();
  const min = now.getMinutes();
  const sec = now.getSeconds();
  const cycleMin = min % 15;
  const inEvent = cycleMin < 5;
  const remainSec = inEvent ? (4 - cycleMin) * 60 + (59 - sec) : (14 - cycleMin) * 60 + (59 - sec);
  const m = Math.floor(remainSec / 60);
  const s = remainSec % 60;
  const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
  return { inEvent, remainSec, timeStr };
}

let cloverCoinTimerInterval = null;
let cloverCoinSelectedSide = 'heads';
let isCloverCoinTossing = false;
let cloverCoinPot = 100;
let cloverCoinCanCashOut = false;
let cloverCoinRoundEnded = false;

const formatCloverCoinAmount = amount => amount.toLocaleString('vi-VN');

function startNewCloverCoinRound() {
  cloverCoinPot = 100;
  cloverCoinCanCashOut = false;
  cloverCoinRoundEnded = false;
  cloverCoinSelectedSide = 'heads';
  document.querySelectorAll('#dlgCloverCoinToss [data-coin-side]').forEach(button => {
    button.classList.toggle('selected', button.dataset.coinSide === cloverCoinSelectedSide);
  });
  $('cloverCoinResult').classList.add('hidden');
  updateCloverCoinEventStatus();
}

function updateCloverCoinEventStatus() {
  const dialog = $('dlgCloverCoinToss');
  if (!dialog || dialog.classList.contains('hidden')) {
    clearInterval(cloverCoinTimerInterval);
    cloverCoinTimerInterval = null;
    return;
  }

  const status = getLixiEventStatus();
  $('cloverCoinEventTimer').textContent = status.inEvent
    ? `⏳ Còn ${status.timeStr}`
    : `⏰ Mở lại sau ${status.timeStr}`;
  $('btnTossCloverCoin').disabled = isCloverCoinTossing || !status.inEvent;
  $('btnTossCloverCoin').textContent = cloverCoinRoundEnded
    ? '🔄 Ván mới (100 Xu)'
    : cloverCoinCanCashOut
      ? '🎲 Đoán tiếp'
      : '🪙 Tung đồng xu';
  $('cloverCoinPotAmount').textContent = `${formatCloverCoinAmount(cloverCoinPot)} Xu`;
  document.querySelectorAll('#dlgCloverCoinToss [data-coin-side]').forEach(button => {
    button.disabled = isCloverCoinTossing || cloverCoinRoundEnded || !status.inEvent;
  });
  const cashoutButton = $('btnCashoutCloverCoin');
  cashoutButton.classList.toggle('hidden', !cloverCoinCanCashOut);
  cashoutButton.disabled = isCloverCoinTossing;
  cashoutButton.textContent = `🏦 Dừng và nhận ${formatCloverCoinAmount(cloverCoinPot)} Xu`;

  if (!status.inEvent && !isCloverCoinTossing && !cloverCoinRoundEnded) {
    $('cloverCoinResult').textContent = cloverCoinCanCashOut
      ? 'Sự kiện đã kết thúc. Bạn vẫn có thể Dừng và nhận pot hiện tại.'
      : 'Sự kiện đã kết thúc. Hãy quay lại khi mở cửa!';
    $('cloverCoinResult').classList.remove('hidden');
  }
}

function openCloverCoinTossDialog() {
  const status = getLixiEventStatus();
  if (!status.inEvent && !cloverCoinCanCashOut) {
    toast(`⏳ Sự kiện tung xu chưa mở! Còn ${status.timeStr} nữa. Hãy quay lại sau nhé!`);
    return;
  }

  openDialog('dlgCloverCoinToss');
  updateCloverCoinEventStatus();
  clearInterval(cloverCoinTimerInterval);
  cloverCoinTimerInterval = setInterval(updateCloverCoinEventStatus, 1000);
}

document.querySelectorAll('#dlgCloverCoinToss [data-coin-side]').forEach(button => {
  button.addEventListener('click', () => {
    if (isCloverCoinTossing) return;
    cloverCoinSelectedSide = button.dataset.coinSide;
    document.querySelectorAll('#dlgCloverCoinToss [data-coin-side]').forEach(choice => {
      choice.classList.toggle('selected', choice === button);
    });
  });
});

$('btnTossCloverCoin')?.addEventListener('click', () => {
  if (isCloverCoinTossing) return;
  const status = getLixiEventStatus();
  if (!status.inEvent) {
    updateCloverCoinEventStatus();
    toast(`⏳ Sự kiện tung xu chưa mở! Còn ${status.timeStr} nữa.`);
    return;
  }
  if (cloverCoinRoundEnded) {
    startNewCloverCoinRound();
    return;
  }

  isCloverCoinTossing = true;
  updateCloverCoinEventStatus();
  document.querySelectorAll('#dlgCloverCoinToss [data-coin-side]').forEach(button => {
    button.disabled = true;
  });
  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const guess = cloverCoinSelectedSide;
  const visual = $('cloverCoinVisual');
  visual.style.setProperty('--coin-start', visual.dataset.side === 'tails' ? '180deg' : '0deg');
  visual.style.setProperty('--coin-end', result === 'heads' ? '1800deg' : '1980deg');
  visual.classList.remove('flipping');
  void visual.offsetWidth;
  visual.classList.add('flipping');
  $('cloverCoinResult').textContent = 'Đồng xu đang được tung...';
  $('cloverCoinResult').classList.remove('hidden');

  const fountain = world?.casinoObjs?.find(object => object.userData?.type === 'clover_fountain');
  fountain?.userData?.replacementModel?.userData?.tossCoin?.(result);
  playSfx('coin', 'casino');
  me.av?.playEmote('interact');

  setTimeout(() => {
    visual.classList.remove('flipping');
    visual.dataset.side = result;
    const isCorrect = result === guess;
    if (isCorrect) {
      const previousPot = cloverCoinPot;
      cloverCoinPot = Math.min(cloverCoinPot * 2, Number.MAX_SAFE_INTEGER);
      cloverCoinCanCashOut = true;
      playSfx('plinko_win', 'casino');
      me.av?.playEmote('cheer');
      $('cloverCoinResult').textContent = `🎉 Mặt ${result === 'heads' ? 'Ngửa' : 'Sấp'} xuất hiện! Pot đã tăng từ ${formatCloverCoinAmount(previousPot)} lên ${formatCloverCoinAmount(cloverCoinPot)} Xu.`;
      toast(`🍀 Đoán đúng! Pot đã nhân đôi thành ${formatCloverCoinAmount(cloverCoinPot)} Xu. Dừng để nhận hoặc đoán tiếp!`);
    } else {
      const lostPot = cloverCoinPot;
      cloverCoinPot = 100;
      cloverCoinCanCashOut = false;
      cloverCoinRoundEnded = true;
      $('cloverCoinResult').textContent = `Mặt ${result === 'heads' ? 'Ngửa' : 'Sấp'} xuất hiện. Bạn mất toàn bộ pot ${formatCloverCoinAmount(lostPot)} Xu; xu đã có trong ví được giữ nguyên.`;
      toast(`🪙 Đoán sai, mất pot ${formatCloverCoinAmount(lostPot)} Xu. Xu trong ví của bạn không bị trừ.`);
    }

    isCloverCoinTossing = false;
    updateCloverCoinEventStatus();
  }, 1550);
});

$('btnCashoutCloverCoin')?.addEventListener('click', () => {
  if (isCloverCoinTossing || !cloverCoinCanCashOut) return;
  const reward = cloverCoinPot;
  addChips(reward);
  cloverCoinPot = 100;
  cloverCoinCanCashOut = false;
  cloverCoinRoundEnded = true;
  $('cloverCoinResult').textContent = `🏦 Bạn đã Dừng và nhận ${formatCloverCoinAmount(reward)} Xu. Ván mới bắt đầu với pot 100 Xu.`;
  $('cloverCoinResult').classList.remove('hidden');
  playSfx('plinko_win', 'casino');
  toast(`🍀 Đã nhận ${formatCloverCoinAmount(reward)} Xu vào ví!`);
  floaters.push({ e: `🪙 +${formatCloverCoinAmount(reward)} Xu!`, who: net?.selfId, t: Date.now() });
  updateCloverCoinEventStatus();
});

let rhythmAnimationId = null;
let rhythmNeedlePos = 50;
let rhythmTargetMin = 35;
let rhythmTargetMax = 55;
let isRhythmStopped = false;
let lixiTimerInterval = null;

function openLixiRhythmGame() {
  const status = getLixiEventStatus();
  if (!status.inEvent) {
    toast(`⏳ Sự kiện Hái Lộc Lì Xì chưa đến giờ! Đang đếm ngược: ${status.timeStr}. Bạn hãy quay lại sau nhé!`);
    return;
  }

  openDialog('dlgLixiRhythm');
  $('lixiRhythmResult').classList.add('hidden');
  $('btnTryAnotherLixi').classList.add('hidden');
  $('btnStopRhythmNeedle').disabled = false;
  $('btnStopRhythmNeedle').textContent = '🎯 DỪNG LẠI! (Phím Space)';

  // Update timer text
  const updateTimer = () => {
    const s = getLixiEventStatus();
    $('lixiEventTimerText').textContent = s.inEvent ? `⏳ Còn ${s.timeStr}` : '⏰ Sự kiện đã kết thúc';
    if (!s.inEvent) {
      clearInterval(lixiTimerInterval);
    }
  };
  updateTimer();
  clearInterval(lixiTimerInterval);
  lixiTimerInterval = setInterval(updateTimer, 1000);

  // Setup random target sweet spot (18% width)
  const spotWidth = 18;
  const spotLeft = 15 + Math.floor(Math.random() * 52);
  rhythmTargetMin = spotLeft;
  rhythmTargetMax = spotLeft + spotWidth;
  const spotEl = $('rhythmSweetSpot');
  if (spotEl) {
    spotEl.style.left = `${rhythmTargetMin}%`;
    spotEl.style.width = `${spotWidth}%`;
  }

  isRhythmStopped = false;
  const needleEl = $('rhythmNeedle');

  const startT = performance.now();
  function animateRhythm(now) {
    if (isRhythmStopped) return;
    const elapsed = now - startT;
    rhythmNeedlePos = 50 + 46 * Math.sin(elapsed * 0.0038);
    if (needleEl) needleEl.style.left = `${rhythmNeedlePos}%`;
    rhythmAnimationId = requestAnimationFrame(animateRhythm);
  }
  cancelAnimationFrame(rhythmAnimationId);
  rhythmAnimationId = requestAnimationFrame(animateRhythm);
}

function stopRhythmNeedleAndCheck() {
  if (isRhythmStopped) return;
  isRhythmStopped = true;
  cancelAnimationFrame(rhythmAnimationId);
  $('btnStopRhythmNeedle').disabled = true;

  const isHit = rhythmNeedlePos >= rhythmTargetMin && rhythmNeedlePos <= rhythmTargetMax;
  const resBox = $('lixiRhythmResult');
  const titleEl = $('lixiRhythmTitle');
  const detailEl = $('lixiRhythmDetail');
  resBox.classList.remove('hidden');

  if (isHit) {
    const reward = rollLixiReward();
    addChips(reward.amount); // Instantly credits Xu to player wallet!
    titleEl.textContent = reward.title;
    detailEl.innerHTML = `<div>${reward.detail}</div><div style="margin-top:6px;font-weight:700;color:#fde047">🧧 ${reward.wish}</div>`;

    if (reward.isJackpot) {
      world?.spawnFireworksShow?.(me.x, me.y);
      playSfx('plinko_win', 'casino');
      toast('💥💥💥 ĐẠI PHÚ QUÝ! BẠN VỪA NỔ HŨ JACKPOT 10.000 XU! 💥💥💥');
      const announcement = `🎉 [THÔNG BÁO] Chúc mừng ${me.name} vừa nổ hũ JACKPOT 10.000 XU từ Cây Mai Đại Thụ! 🎉`;
      logChat('HỆ THỐNG', announcement);
      net.send('chat', { t: announcement });
    } else {
      playSfx('tet_lixi', 'tet');
      playSfx('plinko_win', 'casino');
      toast(`🧧 Hái lộc thành công! Bạn nhận được ${reward.label}!`);
      floaters.push({ e: `🪙 +${reward.amount} Xu!`, who: net.selfId, t: Date.now() });
    }

    me.av?.playEmote('cheer');
    net.send('emote', { e: '🧧', clip: 'cheer' });
  } else {
    playSfx('pop');
    titleEl.textContent = '💨 Hụt Nhịp Rồi!';
    detailEl.textContent = 'Bạn đã bấm hơi lệch vạch màu xanh! Hãy bình tĩnh canh đúng vạch màu xanh ở lần hái tiếp theo nhé!';
    $('btnTryAnotherLixi').classList.remove('hidden');
    $('btnStopRhythmNeedle').textContent = '❌ Chưa Trúng';
  }
}

$('btnStopRhythmNeedle').onclick = stopRhythmNeedleAndCheck;
$('btnTryAnotherLixi').onclick = () => {
  openLixiRhythmGame();
};

// ----------------------------------------------------------------------------
// TET 2025: SACRED SHRINE OF PHÚC - LỘC - THỌ
// ----------------------------------------------------------------------------
let lastPltBowTime = 0;

function openPhucLocThoDialog() {
  openDialog('dlgPhucLocTho');
  $('pltBlessingResult').classList.add('hidden');
}

$('btnPltIncense').onclick = () => {
  me.av?.playEmote('kneel', true);
  // Build 3 incense sticks prop in right hand
  if (me.av?.emotePropMount) {
    me.av.emotePropMount.clear();
    [-0.04, 0, 0.04].forEach((ix, idx) => {
      part(me.av.emotePropMount, G.cyl(), mat('#b91c1c'), [ix, 0, 0.22 + idx * 0.02], [0.018, 0.55, 0.018], [Math.PI / 2.5, 0, 0]);
      part(me.av.emotePropMount, G.sph(), mat('#ff4500', { emissive: '#ff4500', emissiveIntensity: 3.0 }), [ix, 0.05, 0.52 + idx * 0.02], [0.025, 0.025, 0.025]);
    });
  }
  playSfx('tet_lixi', 'tet');
  floaters.push({ e: '🕯️✨ Dâng Hương', who: net.selfId, t: Date.now() });
  toast('✨ Bạn đã thành tâm dâng hương trước Tam Vị Thần! Khí lành bao quanh, tâm an vạn sự như ý!');
  $('pltResultTitle').textContent = '🕯️ Hương Khói Tụ Khí An Khang';
  $('pltResultMsg').textContent = 'Nén hương trầm lan tỏa thanh tịnh, xua tan u ám, đem lại bình an và may mắn cho bạn cùng gia quyến suốt năm mới!';
  $('pltBlessingResult').classList.remove('hidden');
};

$('btnPltBow').onclick = () => {
  const now = Date.now();
  if (now - lastPltBowTime < 3 * 60 * 1000) {
    const remainSec = Math.ceil((3 * 60 * 1000 - (now - lastPltBowTime)) / 1000);
    const m = Math.floor(remainSec / 60);
    const s = remainSec % 60;
    toast(`⏳ Bạn vừa lạy Tam Vị Thần rồi! Hãy tịnh tâm chờ ${m}p ${s}s để lạy lần tiếp nhé.`);
    return;
  }
  lastPltBowTime = now;

  me.av?.playEmote('kneel', true);
  const blessings = [
    { god: 'Ông Phúc', xu: 88, wish: 'Phúc duyên tròn đầy, gia đạo an khang, con đàn cháu đống thuận hòa!' },
    { god: 'Ông Lộc', xu: 168, wish: 'Lộc tấn vinh hoa, tiền vào như nước, công danh sự nghiệp đại hiển đạt!' },
    { god: 'Ông Thọ', xu: 99, wish: 'Thân tâm an lạc, bách niên giai lão, sức khỏe dồi dào thọ tỷ Nam Sơn!' },
  ];
  const b = blessings[Math.floor(Math.random() * blessings.length)];
  addChips(b.xu);
  playSfx('plinko_win', 'casino');
  floaters.push({ e: `🪙 +${b.xu} Xu Lộc`, who: net.selfId, t: Date.now() });
  toast(`🙏 ${b.god} ban phúc: "${b.wish}" (+${b.xu} Xu lộc đầu xuân!)`);

  $('pltResultTitle').textContent = `🙏 ${b.god} Ban Phúc Lành (+${b.xu} Xu)`;
  $('pltResultMsg').textContent = `"${b.wish}" Số Xu lộc đã được nạp thẳng vào Ví của bạn!`;
  $('pltBlessingResult').classList.remove('hidden');
};

$('btnPltChant').onclick = () => {
  me.av?.playEmote('kneel', true);
  playSfx('tet_lixi', 'tet');
  floaters.push({ e: '📿 Tịnh Tâm Niệm Phật', who: net.selfId, t: Date.now() });
  toast('📿 Đang đọc kinh cầu phúc... Tâm tịnh trí sáng, vạn sự hanh thông.');
  $('pltResultTitle').textContent = '📿 Tâm Tịnh Trí Sáng';
  $('pltResultMsg').textContent = 'Tiếng kinh thanh tịnh lắng đọng tâm hồn. Chúc bạn một năm an nhiên tự tại, mọi điều sở cầu đều như ý nguyện!';
  $('pltBlessingResult').classList.remove('hidden');
};

// ----------------------------------------------------------------------------
// TET 2025: DRAGON SUMMONING ALTAR & FLIGHT QUESTS
// ----------------------------------------------------------------------------
function openDragonAltarDialog() {
  openDialog('dlgDragonAltar');
  renderDragonQuestList();
  renderDragonSkinGrid();
}

function renderDragonQuestList() {
  const container = $('dragonQuestList');
  if (!container) return;
  container.innerHTML = '';

  const unlocked = minigames?.getUnlockedDragonSkins() || ['gold'];

  FLIGHT_QUESTS.forEach(q => {
    const isUnlocked = unlocked.includes(q.targetSkin);
    const card = document.createElement('div');
    card.className = `quest-card ${isUnlocked ? 'unlocked' : ''}`;

    const targetSkin = DRAGON_SKINS[q.targetSkin];
    card.innerHTML = `
      <div class="quest-meta">
        <div class="quest-title">${q.title}</div>
        <div class="quest-sub">${q.desc}</div>
      </div>
      <div>
        ${
          isUnlocked
            ? '<button class="info sm-btn" data-stage="' + q.stage + '">✈️ Bay Lại</button>'
            : '<button class="primary sm-btn" data-stage="' + q.stage + '">🚀 Bắt Đầu Bay</button>'
        }
      </div>
    `;

    card.querySelector('button').onclick = () => {
      closeDialog('dlgDragonAltar');
      minigames?.startDragonRide(q.stage);
    };

    container.appendChild(card);
  });
}

function renderDragonSkinGrid() {
  const grid = $('dragonSkinGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const unlocked = minigames?.getUnlockedDragonSkins() || ['gold'];
  const activeSkin = minigames?.currentDragonSkin || 'gold';

  Object.values(DRAGON_SKINS).forEach(skin => {
    const isUnlocked = unlocked.includes(skin.id);
    const isActive = activeSkin === skin.id;

    const card = document.createElement('div');
    card.className = `dragon-skin-card ${isActive ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}`;
    const hexColor = '#' + skin.color.toString(16).padStart(6, '0');

    card.innerHTML = `
      <div class="skin-swatch" style="background:${hexColor}"></div>
      <div class="skin-name">${skin.name.split(' (')[0]}</div>
      <div class="skin-badge ${isActive ? 'active' : ''}">
        ${isActive ? 'Đang Dùng' : isUnlocked ? 'Đã Mở' : '🔒 Khóa'}
      </div>
    `;

    if (isUnlocked) {
      card.onclick = () => {
        minigames?.setDragonSkin(skin.id);
        renderDragonSkinGrid();
        toast(`🐉 Đã đổi sang skin Rồng: ${skin.name}!`);
      };
    } else {
      card.title = 'Làm Thử Thách Bay Vòng Tròn để mở khóa skin này!';
    }

    grid.appendChild(card);
  });
}

$('btnStartFreeDragonRide').onclick = () => {
  closeDialog('dlgDragonAltar');
  minigames?.startDragonRide(0);
};

$('btnExitDragonFlight').onclick = () => {
  minigames?.stopDragonRide();
};

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
      case 'community_tree':
        seasonalActivities?.open('community_tree');
        break;
      case 'christmas_gift':
        seasonalActivities?.collectChristmasGift(h.giftId);
        seasonalActivities?.open('gift_hunt');
        break;
      case 'sled_race':
        seasonalActivities?.open('sled_race');
        break;
      case 'haunted_mansion':
        seasonalActivities?.open('haunted_mansion');
        break;
      case 'costume_runway':
        seasonalActivities?.open('costume_runway');
        break;
      case 'photo_hunt':
        seasonalActivities?.open('photo_hunt');
        break;
      case 'photo_spot':
        seasonalActivities?.capturePhotoSpot(h.spotId);
        break;
      case 'mansion_key':
        seasonalActivities?.collectMansionKey(h.keyId);
        break;
      case 'halloween_treasure':
        seasonalActivities?.collectHalloweenTreasure(h.treasureId);
        seasonalActivities?.open('treasure_hunt');
        break;
      case 'tet_exploration_item':
        seasonalActivities?.collectTetDiscovery(h.itemId);
        seasonalActivities?.open('tet_exploration');
        break;
      case 'photo_collectible':
        seasonalActivities?.collectPhotoItem(h.itemId);
        break;
      case 'dance_stage':
        seasonalActivities?.open('dance_stage');
        break;
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
        playSfx('wishing_fountain', 'valentine');
        refreshRecipients();
        $('cardStyle').value = 'love';
        openDialog('dlgCard');
        break;
      case 'love_fountain':
        playSfx('wishing_fountain', 'valentine');
        openLoveWishingDialog(h.id);
        break;
      case 'mai_tree':
        openLixiRhythmGame();
        break;
      case 'dragon_altar':
        openDragonAltarDialog();
        break;
      case 'phuc_loc_tho_shrine':
        openPhucLocThoDialog();
        break;
      case 'firework_launcher':
        if (!checkCooldown()) return;
        playSfx('firework_rocket', 'tet');
        me.av?.playEmote('interact');
        emitOp({ k: 'firework', x: h.x, y: h.y, kind: 'launcher', stationId: h.id, by: me.name });
        break;
      case 'firecracker_table':
        if (!checkCooldown()) return;
        playSfx('firecracker', 'tet');
        me.av?.playEmote('interact');
        emitOp({ k: 'firework', x: h.x, y: h.y, kind: 'cracker', stationId: h.id, by: me.name });
        toast('🧨 Pháo nổ lách tách rộn ràng góc sân!');
        break;
      case 'roulette':
        openRoulette();
        break;
      case 'duck_derby':
        openDuckDerby();
        break;
      case 'clover_fountain':
        openCloverCoinTossDialog();
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
      case 'casino_pub':
        playSfx('pop');
        openCasinoShopDialog();
        break;
      case 'secret_passage':
        playSfx('wishing_fountain', 'valentine');
        toast('✨ Mật đạo mở ra! Bạn được đưa thẳng tới Mật Thất Casino!');
        enterSecretCasino();
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

  // Rhythm Mini-Game spacebar stop
  if (!$('dlgLixiRhythm')?.classList.contains('hidden')) {
    if (e.key === ' ' || code === 'Space') {
      stopRhythmNeedleAndCheck();
      e.preventDefault();
      return;
    }
  }

  // Dragon flight steering controls
  if (minigames?.isRiding()) {
    if (code === 'KeyW' || k === 'w' || code === 'ArrowUp') minigames.dragonKeys.forward = true;
    if (code === 'KeyS' || k === 's' || code === 'ArrowDown') minigames.dragonKeys.backward = true;
    if (code === 'KeyA' || k === 'a' || code === 'ArrowLeft') minigames.dragonKeys.left = true;
    if (code === 'KeyD' || k === 'd' || code === 'ArrowRight') minigames.dragonKeys.right = true;
    if (code === 'Space' || e.key === ' ') {
      minigames.dragonKeys.up = true;
      e.preventDefault();
      return;
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight' || k === 'shift') {
      minigames.dragonKeys.down = true;
      e.preventDefault();
      return;
    }
  }

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
  else if (k === 'o' || code === 'KeyO') {
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

  // Dragon flight key release
  if (minigames?.isRiding()) {
    if (code === 'KeyW' || k === 'w' || code === 'ArrowUp') minigames.dragonKeys.forward = false;
    if (code === 'KeyS' || k === 's' || code === 'ArrowDown') minigames.dragonKeys.backward = false;
    if (code === 'KeyA' || k === 'a' || code === 'ArrowLeft') minigames.dragonKeys.left = false;
    if (code === 'KeyD' || k === 'd' || code === 'ArrowRight') minigames.dragonKeys.right = false;
    if (code === 'Space' || e.key === ' ') minigames.dragonKeys.up = false;
    if (code === 'ShiftLeft' || code === 'ShiftRight' || k === 'shift') minigames.dragonKeys.down = false;
  }

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
    if (e.target.closest('#chat, #mediaBox, .overlay:not(.hidden), .dialog:not(.hidden), #dlgCard, #dlgCostume, #dlgMusic, #inboxModal, .casino-modal-overlay')) {
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
      if (d < c.r * 0.65 + RADIUS * 0.5) {
        const colH = c.r > 0.6 ? 1.0 : 0.82;
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
        if (dx < 0.45 && dy < 0.32) {
          maxH = Math.max(maxH, 0.48);
        }
      } else {
        if (Math.hypot(x - s.x, y - s.y) < 0.32) {
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

  // Colliders (tables, tree base, fountain, stage) with 0 air gap
  if (world?.features?.colliders) {
    for (const c of world.features.colliders) {
      const colH = c.r > 0.6 ? 1.0 : 0.82;
      if (currentH >= colH - 0.22) continue; // Can jump/stand on top!

      const minD = c.r * 0.62 + RADIUS * 0.4;
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
        const limitX = 0.36 + RADIUS * 0.4;
        const limitY = 0.22 + RADIUS * 0.4;
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
  if (world?.isLoadingMap) {
    last = now;
    rafId = requestAnimationFrame(loop);
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
      updateAdaptiveGraphics(currentFps);
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
    let myPose = null;
    if (me.seatSlot) {
      myPose = me.seatSlot.pose || null;
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
      if (minigames?.isRiding() && minigames.dragon?.mountPoint) {
        // Position and rotation are handled by dragon mount update
        av.setLocomotion('sit');
      } else {
        av.root.position.set(me.x * TILE, me.h, me.y * TILE);
        av.root.rotation.y = me.r;
        av.setLocomotion(me.loco, { lean: myLean, pose: myPose });
      }
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
      pose: myPose,
    };
    if (
      net &&
      now - lastSend > 85 &&
      (cur.a !== sent.a ||
        cur.seatId !== sent.seatId ||
        cur.lean !== sent.lean ||
        cur.pose !== sent.pose ||
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
        p.av.setLocomotion(p.a, { lean: p.lean || 0, pose: p.pose || null });
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
    world?.update(dt, { x: me.x * TILE, z: me.y * TILE }, camera);
    minigames?.update(dt, yaw);
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
  // Override camera when riding dragon - smooth third-person view following camera yaw
  if (minigames?.isRiding() && minigames.dragon?.group) {
    const dg = minigames.dragon.group;
    const dPos = dg.position;
    const behindDist = 12;
    const aboveOffset = 5.5;
    const camX = dPos.x + Math.sin(yaw) * behindDist;
    const camZ = dPos.z + Math.cos(yaw) * behindDist;
    const camY = dPos.y + aboveOffset;
    camera.position.lerp(new THREE.Vector3(camX, camY, camZ), Math.min(1, dt * 10));
    camera.lookAt(dPos.x, dPos.y + 1.2, dPos.z);
    if (me?.av) me.av.root.visible = true;
    updateScreen3D();
    return;
  }

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
  if (!net || !me?.started || roomName === SECRET_CASINO_ROOM) return;
  lastRoomBeforeCasino = {
    id: roomName,
    title: roomTitle,
    theme: state?.theme || 'christmas',
    passHash: state?.passHash || '',
  };
  toast('🎰 Đang chuyển riêng bạn tới Mật Thất Casino!');
  joinRoomConfig({
    id: SECRET_CASINO_ROOM,
    title: 'Mật Thất Casino & Pub Hoàng Gia',
    theme: 'casino',
    passHash: '',
  });
}

function exitSecretCasino() {
  const returnRoom = lastRoomBeforeCasino || {
    id: OFFICIAL_ROOMS[0].id,
    title: OFFICIAL_ROOMS[0].title,
    theme: OFFICIAL_ROOMS[0].theme,
    passHash: '',
  };
  lastRoomBeforeCasino = null;
  verifiedPassHash = returnRoom.passHash || '';
  toast('🚪 Bạn đã bước qua cánh cửa cổ kính trở về thế giới bên trên!');
  joinRoomConfig(returnRoom);
}

let activeFoundNoteCode = '';

const PASSAGE_RIDDLES = {
  christmas: {
    icon: '🎄',
    title: 'Đố Mẹo Đêm Giáng Sinh',
    sub: 'Giải câu đố mẹo dân gian mùa lễ hội tuyết rơi',
    question: 'Cái gì chỉ xuất hiện vào mùa đông tuyết rơi, có chiếc mũi bằng củ cà rốt xinh xắn, nhưng sợ nhất ánh nắng mặt trời?',
    options: ['Người tuyết', 'Bánh gừng Noel', 'Tuần lộc mũi đỏ', 'Cây thông tuyết'],
    correct: 0,
  },
  halloween: {
    icon: '🎃',
    title: 'Đố Mẹo Đêm Halloween',
    sub: 'Câu đố hóm hỉnh ngày hội bí ngô và ma cà rồng',
    question: 'Con ma và bóng ma trong trường học sợ nhất là môn học nào sau đây?',
    options: [
      'Môn Lịch sử (vì suốt ngày phải nghe nhắc lại về người đã khuất)',
      'Môn Toán (vì tính toán quá nhiều nhức đầu)',
      'Môn Hóa học (vì sợ phản ứng nổ)',
      'Môn Thể dục (vì bóng ma không có chân để chạy)',
    ],
    correct: 0,
  },
  tet: {
    icon: '🧧',
    title: 'Định Lý Số Dư Trung Hoa (Toán Tin Bách Khoa)',
    sub: 'Giải hệ phương trình đồng dư Sun Tzu để mở cánh cổng Speakeasy',
    question: 'Tìm số nguyên dương nhỏ nhất x thỏa mãn hệ phương trình đồng dư sau:\nx ≡ 2 (mod 3)\nx ≡ 3 (mod 5)\nx ≡ 2 (mod 7)\nGiá trị nhỏ nhất của x là:',
    options: ['x = 23', 'x = 38', 'x = 53', 'x = 128'],
    correct: 0,
  },
  valentine: {
    icon: '💝',
    title: 'Đố Mẹo Ngày Lễ Tình Nhân',
    sub: 'Câu đố mẹo hóm hỉnh về tình yêu đôi lứa',
    question: 'Tại sao thần Tình Yêu Cupid khi đi bắn mũi tên tình duyên lại luôn bịt mắt?',
    options: [
      'Vì tình yêu là mù quáng',
      'Vì sợ ánh nắng chói mắt',
      'Vì bắn bừa cũng dính duyên',
      'Vì muốn ngầu hơn các vị thần khác',
    ],
    correct: 0,
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
    playSfx('plinko_win', 'casino');
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
    playSfx('plinko_win', 'casino');
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
if ($('statWalletBtn')) $('statWalletBtn').onclick = openCodeDialog;
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
    playSfx('plinko_win', 'casino');
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
const RAW_NAMETAGS = [
  "Báo thủ", "Lọ Vương", "Lụy em", "Cờ đỏ", "Cờ xanh", "Cờ lê", "Main Character",
  "Nigger", "Gaslighter", "Trường Giang", "Nô lệ deadline", "Thần đèn", "Em bé",
  "Faker", "Boy 2 mái", "Sơn Tung MTP", "Hieuthuhai", "J97", "Donald Trump",
  "Charlie Kirk", "Son", "Hustlang Robber", "Drake", "Kendrick Lamar", "Ri Đỗ",
  "Mười Gió", "Spider Man", "Ben 10", "SpongeBob", "NGƯỜI ĐẸP TRAI", "GAY",
  "VF3", "Phạm Nhật Vượng", "SVBK", "Rick Astley", "Phùng Thanh Độ", "Tú Sena",
  "Sweetie Fox", "The Rock", "John Cena", "Yasuo", "Allain", "Boy Cô Đơn",
  "Elon Musk", "67", "Tộc", "Ngoo lớmmm!!!"
];

const TITLE_LIST = [
  {
    id: 'none',
    name: 'Ẩn danh hiệu',
    desc: 'Không hiển thị huy hiệu danh hiệu trên tên',
    color: '#94a3b8',
    condition: () => true,
  },
  {
    id: 'admin',
    name: '👑 ADMIN',
    desc: 'Đặc quyền Tối cao dành riêng cho Quản Trị Viên đã xác thực hệ thống',
    color: '#ef4444',
    condition: () => isAdminVerified(),
    lockMsg: 'Cần xác thực quyền Quản Trị Viên (Bấm phím [;] để kích hoạt)!',
  },
  {
    id: 'vuadoden',
    name: '👑 Vua Đỏ Đen',
    desc: 'Đạt danh hiệu huyền thoại khi trúng Jackpot ở cả 5 trò chơi tại Casino!',
    color: '#facc15',
    condition: () => {
      try {
        const history = JSON.parse(localStorage.getItem('gh_jackpot_wins') || '[]');
        return ['roulette', 'duck_derby', 'blackjack', 'slot_machine', 'plinko'].every(k => history.includes(k));
      } catch { return false; }
    },
    lockMsg: 'Cần trúng Jackpot ở cả 5 trò Casino!',
  },
  {
    id: 'trieu_phu',
    name: '💎 Dân Chơi Triệu Phú',
    desc: 'Sở hữu từ 3,000 xu chips casino trở lên trong tài khoản!',
    color: '#38bdf8',
    condition: () => getChips() >= 3000,
    lockMsg: 'Cần tích lũy từ 3,000 xu chips casino!',
  },
  ...RAW_NAMETAGS.map((tag, idx) => {
    const isGay = tag.trim() === 'GAY';
    const tagColors = [
      '#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
      '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6',
      '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316'
    ];
    return {
      id: 'tag_' + idx,
      name: tag,
      desc: isGay ? '🌈 Danh hiệu cầu vồng Rainbow RGB 24/7 độc quyền lộng lẫy!' : `Danh hiệu cá tính: [${tag}]`,
      color: isGay ? 'rainbow' : tagColors[idx % tagColors.length],
      isGay,
      condition: () => true,
    };
  })
];

let currentTitleSearchTerm = '';

function openTitlesDialog() {
  const searchInput = $('searchTitles');
  if (searchInput) {
    searchInput.value = '';
    currentTitleSearchTerm = '';
    searchInput.oninput = (e) => {
      currentTitleSearchTerm = (e.target.value || '').trim().toLowerCase();
      renderTitlesGrid();
    };
  }
  renderTitlesGrid();
  openDialog('dlgTitles');
}

function renderTitlesGrid() {
  const container = $('titlesGrid');
  if (!container) return;
  container.innerHTML = '';
  const currentTitle = me?.title || localStorage.getItem('gh_selected_title') || '';

  const filteredTitles = TITLE_LIST.filter(t => {
    if (!currentTitleSearchTerm) return true;
    return t.name.toLowerCase().includes(currentTitleSearchTerm) || (t.desc && t.desc.toLowerCase().includes(currentTitleSearchTerm));
  });

  if (filteredTitles.length === 0) {
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#94a3b8">Không tìm thấy danh hiệu phù hợp.</div>';
    return;
  }

  filteredTitles.forEach(t => {
    const isUnlocked = t.condition ? t.condition(me?.name) : true;
    const isEquipped = (t.id === 'none' && !currentTitle) || currentTitle === t.name;
    const card = document.createElement('div');
    const isGay = t.isGay || t.name === 'GAY';
    card.className = `title-card ${isEquipped ? 'selected' : ''} ${isGay ? 'rainbow-rgb-247' : ''}`;
    card.style.opacity = isUnlocked ? '1' : '0.45';

    if (!isGay) {
      card.style.color = t.color === 'rainbow' ? '#f43f5e' : (t.color || '#facc15');
    }

    card.innerHTML = `
      <div style="font-size:13px;margin-bottom:2px">${t.name}</div>
      <div style="font-size:10px;opacity:0.8;font-weight:normal">${isEquipped ? '✓ Đang mặc' : isUnlocked ? 'Nhấn để chọn' : '🔒 Khóa'}</div>
    `;

    card.onclick = () => {
      if (!isUnlocked) {
        toast(`🔒 ${t.lockMsg || 'Danh hiệu này đang bị khóa!'}`);
        return;
      }
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
  updateTitleUI();
  toast(`👑 Bạn đã trang bị danh hiệu: [${chosenTitle || 'Không'}]`);
  closeDialog('dlgTitles');
}

function updateTitleUI() {
  const t = me?.title || localStorage.getItem('gh_selected_title') || '';
  const lbl = $('statTitleLabel');
  if (lbl) {
    lbl.textContent = t || 'Danh Hiệu';
  }
  const btn = $('statTitleBtn');
  if (btn) {
    btn.title = t ? `Danh hiệu hiện tại: ${t} (Bấm để xem & đổi danh hiệu)` : 'Bộ Sưu Tập Danh Hiệu (Bấm để chọn danh hiệu)';
  }
}

$('btnTitles').onclick = openTitlesDialog;
if ($('statTitleBtn')) $('statTitleBtn').onclick = openTitlesDialog;

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
      if (me && !me.title) {
        me.title = '👑 ADMIN';
        me.av?.setName(me.name, me.title, me.nametagStyle);
        syncMyAppearance();
      }
    } else {
      btnAdmin.innerHTML = '⚡ Admin [;]';
      btnAdmin.style.background = 'rgba(239, 68, 68, 0.2)';
      btnAdmin.style.borderColor = 'rgba(250, 204, 21, 0.4)';
      btnAdmin.style.boxShadow = 'none';
      btnAdmin.style.color = '#fca5a5';
      btnAdmin.title = 'Nhấn để mở Bảng Quản Trị Viên - Phím [;]';
      if (me) {
        me.av?.setAdminAura?.(false);
      }
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
  hideAdminSuggestions();
  openDialog('dlgAdmin');
  setTimeout(() => $('inAdminCmd').focus(), 150);
}

$('btnAdminCmds').onclick = handleAdminTrigger;

$('btnSubmitAdminAuth').onclick = () => {
  const val = $('inAdminPass').value;
  if (verifyAdminPassword(val)) {
    $('adminAuthErr').classList.add('hidden');
    $('adminAuthSuccess').classList.remove('hidden');
    playSfx('plinko_win');
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

// ============================================================================
// VIP PUB & FASHION BOUTIQUE SHOP
// ============================================================================
let activeShopCategory = 'accessory';

function renderCasinoShopGrid() {
  const grid = $('shopItemGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if ($('shopWalletChips')) {
    $('shopWalletChips').textContent = (getChips() || 0).toLocaleString();
  }

  const inv = getInventory();
  const equipped = getEquipped();
  const items = CASINO_SHOP_ITEMS.filter(it => it.category === activeShopCategory);

  items.forEach(it => {
    const isOwned = inv.includes(it.id);
    const isEquipped = equipped[activeShopCategory] === it.id;

    const card = document.createElement('div');
    card.className = `shop-item-card ${isEquipped ? 'equipped' : ''}`;
    card.innerHTML = `
      <div class="shop-item-icon" style="font-size:32px;text-align:center;margin-bottom:6px">${it.icon || '✨'}</div>
      <div class="shop-item-name" style="font-weight:700;color:#fde047;font-size:14px">${it.name}</div>
      <div class="shop-item-desc" style="font-size:11.5px;color:#cbd5e1;margin:4px 0 10px 0;min-height:32px">${it.desc}</div>
      <div class="shop-item-footer">
        ${isOwned ? `
          ${isEquipped 
            ? `<button class="shop-item-btn unequip" data-action="unequip" data-id="${it.id}" style="width:100%;background:rgba(239,68,68,0.2);border:1px solid #ef4444;color:#fca5a5;padding:6px;border-radius:6px;cursor:pointer">Đang dùng (Tháo)</button>`
            : `<button class="shop-item-btn equip" data-action="equip" data-id="${it.id}" style="width:100%;background:rgba(34,197,94,0.2);border:1px solid #22c55e;color:#86efac;padding:6px;border-radius:6px;cursor:pointer">Trang bị</button>`}
        ` : `
          <button class="shop-item-btn buy" data-action="buy" data-id="${it.id}" style="width:100%;background:linear-gradient(135deg,#f59e0b,#d97706);border:none;color:#fff;font-weight:700;padding:6px;border-radius:6px;cursor:pointer">🪙 ${it.price.toLocaleString()} Xu</button>
        `}
      </div>
    `;

    card.querySelector('button')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = e.target.getAttribute('data-action');
      const id = e.target.getAttribute('data-id');
      if (action === 'buy') {
        const res = buyShopItem(id);
        if (res.ok) {
          playSfx('plinko_win', 'casino');
          toast(`🎉 Bạn đã mua thành công: ${it.name}!`);
          renderCasinoShopGrid();
        } else {
          toast(res.msg || '⚠️ Không thể mua vật phẩm!');
        }
      } else if (action === 'equip') {
        equipShopItem(id);
        if (activeShopCategory === 'accessory') {
          me.accessory = id;
          me.av?.setAccessory?.(id);
        } else if (activeShopCategory === 'aura') {
          me.aura = id;
          me.av?.setAura?.(id);
        } else if (activeShopCategory === 'nametag') {
          me.nametagStyle = id;
          me.av?.setName?.(me.name, me.title, id);
        }
        syncMyAppearance();
        toast(`✨ Đã trang bị: ${it.name}!`);
        renderCasinoShopGrid();
      } else if (action === 'unequip') {
        unequipShopItem(activeShopCategory);
        if (activeShopCategory === 'accessory') {
          me.accessory = null;
          me.av?.setAccessory?.(null);
        } else if (activeShopCategory === 'aura') {
          me.aura = null;
          me.av?.setAura?.(null);
        } else if (activeShopCategory === 'nametag') {
          me.nametagStyle = null;
          me.av?.setName?.(me.name, me.title, null);
        }
        syncMyAppearance();
        toast(`Đã tháo ${it.name}`);
        renderCasinoShopGrid();
      }
    });

    grid.appendChild(card);
  });
}

function openCasinoShopDialog() {
  openDialog('dlgCasinoShop');
  renderCasinoShopGrid();
}

$('tabShopAccessory')?.addEventListener('click', () => {
  activeShopCategory = 'accessory';
  $('tabShopAccessory').classList.add('active');
  $('tabShopAura').classList.remove('active');
  $('tabShopNametag').classList.remove('active');
  renderCasinoShopGrid();
});
$('tabShopAura')?.addEventListener('click', () => {
  activeShopCategory = 'aura';
  $('tabShopAura').classList.add('active');
  $('tabShopAccessory').classList.remove('active');
  $('tabShopNametag').classList.remove('active');
  renderCasinoShopGrid();
});
$('tabShopNametag')?.addEventListener('click', () => {
  activeShopCategory = 'nametag';
  $('tabShopNametag').classList.add('active');
  $('tabShopAccessory').classList.remove('active');
  $('tabShopAura').classList.remove('active');
  renderCasinoShopGrid();
});

// ============================================================================
// VALENTINE LOVE WISHING FOUNTAIN
// ============================================================================
const LOVE_BLESSINGS = [
  {
    title: 'Hào Quang Trái Tim Vĩnh Cửu',
    desc: 'Thần Tình Yêu ban tặng hào quang trái tim lấp lánh tỏa sáng quanh người bạn!',
    apply() {
      me.aura = 'hearts';
      me.av?.setAura?.('hearts');
      syncMyAppearance();
    }
  },
  {
    title: 'Đôi Cánh Tình Thần Cupid (+45% Tốc Độ)',
    desc: 'Lực hút tình yêu nâng bước chân bạn, tăng 45% tốc độ di chuyển trong 30 giây!',
    apply() {
      adminSpeedMultiplier = 1.45;
      setTimeout(() => { if (adminSpeedMultiplier === 1.45) adminSpeedMultiplier = 1.0; }, 30000);
    }
  },
  {
    title: 'Lì Xì Tình Nhân May Mắn (+200 Chips)',
    desc: 'Đồng xu chạm đáy suối thiêng nhân đôi phước lộc, ban tặng bạn +200 xu Casino!',
    apply() {
      addChips(200);
      updateCasinoChipsUI();
    }
  },
  {
    title: 'Danh Hiệu Tình Yêu: "Tình Yêu Bất Diệt"',
    desc: 'Khắc ghi tên bạn lên đài vinh danh những trái tim chung thủy nhất vũ trụ!',
    apply() {
      me.title = '💖 Tình Yêu Bất Diệt';
      me.av?.setName(me.name, me.title, me.nametagStyle);
      syncMyAppearance();
    }
  },
  {
    title: 'Hôn Gió Ngọt Ngào & Tình Yêu Thăng Hoa',
    desc: 'Một nụ hôn gió ngọt ngào thổi bùng những cánh hồng rực rỡ khắp sân suối!',
    apply() {
      me.av?.playEmote('kiss');
    }
  }
];

function openLoveWishingDialog(fountainId) {
  const box = $('wishingCardBox');
  if (box) box.classList.add('hidden');
  openDialog('dlgLoveWishing');
}

$('btnTossLoveCoin')?.addEventListener('click', () => {
  playSfx('wishing_fountain', 'valentine');
  playSfx('coin', 'casino');
  me.av?.playEmote?.('interact');
  world.spawnFireworksShow?.(me.x, me.y);

  const blessing = LOVE_BLESSINGS[Math.floor(Math.random() * LOVE_BLESSINGS.length)];
  blessing.apply();

  const box = $('wishingCardBox');
  const titleEl = $('wishingResultTitle');
  const descEl = $('wishingResultDesc');
  if (box && titleEl && descEl) {
    titleEl.textContent = `✨ ${blessing.title}`;
    descEl.textContent = blessing.desc;
    box.classList.remove('hidden');
  }

  emitOp({ k: 'love_wishing_toss', by: me.name, blessing: { title: blessing.title, desc: blessing.desc } });
  toast(`💖 ${blessing.title}: ${blessing.desc}`);
});

// ============================================================================
// ROBLOX STYLE BUILDER TOOLS (:btools / :build)
// ============================================================================
let adminBuilderMode = false;
const builderRaycaster = new THREE.Raycaster();
const builderMouse = new THREE.Vector2();

function setupBuilderToolsInteraction() {
  if (!renderer?.domElement) return;
  const canvas = renderer.domElement;
  canvas.addEventListener('click', (e) => {
    if (!adminBuilderMode || !isAdminVerified()) return;

    const rect = canvas.getBoundingClientRect();
    if (document.pointerLockElement) {
      builderMouse.x = 0;
      builderMouse.y = 0;
    } else {
      builderMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      builderMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    builderRaycaster.setFromCamera(builderMouse, camera);

    const blockMeshes = Array.from(world.builderBlocks.values());
    const blockIntersects = builderRaycaster.intersectObjects(blockMeshes, true);

    if ((e.altKey || e.shiftKey) && blockIntersects.length > 0) {
      let topHit = blockIntersects[0].object;
      while (topHit.parent && !topHit.userData.blockId && topHit.parent !== world.builderBlocksGroup) {
        topHit = topHit.parent;
      }
      const bId = topHit.userData.blockId;
      if (bId) {
        world.removeBuilderBlock(bId);
        emitOp({ k: 'admin_block_remove', blockId: bId });
        playSfx('wood');
        toast('🧱 Đã xóa khối xây dựng!');
        return;
      }
    }

    const groundTargets = world.groundMesh ? [world.groundMesh, ...blockMeshes] : blockMeshes;
    const hits = builderRaycaster.intersectObjects(groundTargets, true);
    if (hits.length > 0) {
      const pt = hits[0].point;
      const bColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#facc15', '#06b6d4'];
      const chosenColor = bColors[Math.floor(Math.random() * bColors.length)];
      const block = {
        id: 'block_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
        x: Math.round(pt.x * 2) / 2,
        y: Math.max(0.5, Math.round(pt.y * 2) / 2 + 0.5),
        z: Math.round(pt.z * 2) / 2,
        color: chosenColor,
        size: 1.0,
      };
      world.addBuilderBlock(block);
      emitOp({ k: 'admin_block_place', block });
      playSfx('plinko_peg', 'casino');
      toast('🧱 Đã đặt khối 3D! (Alt+Click hoặc Shift+Click để Xóa)');
    }
  });
}

// ============================================================================
// ADMIN MOB ATTACK & HUNT SYSTEM (:summon / :attack)
// Multi-mob support: bat, zombie, dog, creeper, ghost
// ============================================================================
function spawnMobAttack(mobType = 'bat', targetName, byAdmin = 'Admin') {
  const type = (mobType || 'bat').toLowerCase();
  const mobNames = {
    bat: '🦇 Dơi Hút Máu Bóng Đêm',
    zombie: '🧟 Xác Sống Khát Máu',
    dog: '🐕 Chó Săn Địa Ngục',
    creeper: '💣 Creeper Phát Nổ',
    ghost: '👻 Hồn Ma Oán Khí',
  };
  const displayName = mobNames[type] || `👾 Quái Vật [${type}]`;
  toast(`⚡ ${byAdmin} đã phái ${displayName} săn đuổi [${targetName || 'mọi người'}]!`);
  playSfx('spooky_laugh', 'halloween');

  const mobGroup = new THREE.Group();
  let leftWing, rightWing, creeperMat, dogLegs = [];

  if (type === 'zombie') {
    // Zombie: Da xanh, 2 tay duỗi thẳng
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.6 });
    const clothesMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat);
    head.position.y = 1.1;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.25), clothesMat);
    body.position.y = 0.65;
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), skinMat);
    lArm.position.set(-0.25, 0.75, 0.25);
    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), skinMat);
    rArm.position.set(0.25, 0.75, 0.25);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, 0.2), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    legs.position.y = 0.22;
    mobGroup.add(head, body, lArm, rArm, legs);
  } else if (type === 'dog') {
    // Hound / Dog: 4 chân, thân dài
    const dogMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.7), dogMat);
    body.position.y = 0.35;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.3), dogMat);
    head.position.set(0, 0.5, 0.4);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.18), new THREE.MeshStandardMaterial({ color: 0x1c1917 }));
    snout.position.set(0, 0.45, 0.58);
    mobGroup.add(body, head, snout);
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), dogMat);
      leg.position.set((i % 2 === 0 ? -0.15 : 0.15), 0.12, (i < 2 ? 0.22 : -0.22));
      mobGroup.add(leg);
      dogLegs.push(leg);
    }
  } else if (type === 'creeper') {
    // Creeper: Thân đứng, 4 chân ngắn
    creeperMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), creeperMat);
    head.position.y = 0.95;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.5, 0.22), creeperMat);
    body.position.y = 0.52;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    face.position.set(0, 0.95, 0.2);
    mobGroup.add(head, body, face);
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.12), creeperMat);
      leg.position.set((i % 2 === 0 ? -0.12 : 0.12), 0.12, (i < 2 ? 0.1 : -0.1));
      mobGroup.add(leg);
    }
  } else if (type === 'ghost') {
    // Ghost: Bóng ma trắng mờ
    const ghostMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.85, roughness: 0.2 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.9, 16), ghostMat);
    body.position.y = 0.6;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), ghostMat);
    head.position.y = 1.05;
    const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    lEye.position.set(-0.1, 1.1, 0.28);
    const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    rEye.position.set(0.1, 1.1, 0.28);
    mobGroup.add(body, head, lEye, rEye);
  } else {
    // Bat: Mặc định
    const bodyGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x180024, roughness: 0.4 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.35;
    mobGroup.add(bodyMesh);

    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.14, 0.45, 0.28);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.14, 0.45, 0.28);
    mobGroup.add(leftEye, rightEye);

    const fangGeo = new THREE.ConeGeometry(0.05, 0.16, 6);
    const fangMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftFang = new THREE.Mesh(fangGeo, fangMat);
    leftFang.rotation.x = Math.PI;
    leftFang.position.set(-0.1, 0.24, 0.3);
    const rightFang = new THREE.Mesh(fangGeo, fangMat);
    rightFang.rotation.x = Math.PI;
    rightFang.position.set(0.1, 0.24, 0.3);
    mobGroup.add(leftFang, rightFang);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0.6, 0.4);
    wingShape.lineTo(0.9, 0.1);
    wingShape.lineTo(0.5, -0.2);
    wingShape.lineTo(0, 0);
    const wingGeo = new THREE.ShapeGeometry(wingShape);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x3b0764, side: THREE.DoubleSide });

    leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-0.25, 0.35, 0);
    leftWing.rotation.y = Math.PI;

    rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(0.25, 0.35, 0);
    mobGroup.add(leftWing, rightWing);
  }

  mobGroup.position.set(me.x * TILE, me.h + 2.5, me.y * TILE);
  scene.add(mobGroup);

  const startTime = performance.now();
  const maxDuration = 12000;

  const anim = () => {
    const elapsed = performance.now() - startTime;
    if (elapsed > maxDuration) {
      scene.remove(mobGroup);
      return;
    }

    if (leftWing && rightWing) {
      const wingFlap = Math.sin(elapsed * 0.02) * 0.7;
      leftWing.rotation.z = wingFlap;
      rightWing.rotation.z = -wingFlap;
    }
    if (dogLegs.length === 4) {
      const legWalk = Math.sin(elapsed * 0.015) * 0.5;
      dogLegs[0].rotation.x = legWalk;
      dogLegs[1].rotation.x = -legWalk;
      dogLegs[2].rotation.x = -legWalk;
      dogLegs[3].rotation.x = legWalk;
    }
    if (creeperMat && elapsed > 2000 && Math.sin(elapsed * 0.03) > 0.3) {
      creeperMat.color.setHex(0xffffff);
    } else if (creeperMat) {
      creeperMat.color.setHex(0x16a34a);
    }

    let tx = me.x * TILE;
    let ty = me.h + 0.5;
    let tz = me.y * TILE;

    if (targetName && !isAdminTarget(targetName, me.name)) {
      const pEntry = findPeerByName(targetName);
      if (pEntry) {
        tx = pEntry[1].x * TILE;
        ty = (pEntry[1].h || 0) + 0.5;
        tz = pEntry[1].y * TILE;
      }
    }

    const dx = tx - mobGroup.position.x;
    const dy = ty - mobGroup.position.y;
    const dz = tz - mobGroup.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist > 0.55) {
      mobGroup.position.x += (dx / dist) * 0.24;
      mobGroup.position.y += (dy / dist) * 0.24;
      mobGroup.position.z += (dz / dist) * 0.24;
      mobGroup.lookAt(tx, ty, tz);
      requestAnimationFrame(anim);
    } else {
      playSfx('explosion', 'tet');
      playSfx('splat', 'halloween');

      if (isAdminTarget(targetName, me.name) || !targetName) {
        me.av?.showTomatoSplat?.();
        document.body.classList.add('earthquake-active');
        setTimeout(() => document.body.classList.remove('earthquake-active'), 1200);

        if (!adminGodMode && !window.adminGodMode) {
          toast(`💀 BẠN ĐÃ BỊ ${displayName.toUpperCase()} HẠ GỤC VỀ 0 HP! Đang hồi sinh...`);
          me.av?.spawnLegoPop?.(0, 1.2, 0);
          me.av?.setLimbState?.({ head: false, leftArm: false, rightArm: false, legs: false });
          setTimeout(() => {
            me.x = 14.5;
            me.y = 18.5;
            me.h = 0;
            me.vy = 0;
            if (me.av?.root) me.av.root.position.set(me.x * TILE, 0, me.y * TILE);
            me.av?.setLimbState?.({ head: true, leftArm: true, rightArm: true, legs: true });
            toast('✨ Bạn đã hồi sinh nguyên vẹn tại điểm xuất phát!');
          }, 1500);
        } else {
          toast('🛡️ BẬT BẤT TỬ (GOD MODE): Quái cắn không xi nhê!');
        }
      }

      peers.forEach(p => {
        if (isAdminTarget(targetName, p.name)) {
          p.av?.showTomatoSplat?.();
          p.av?.spawnLegoPop?.(0, 1.2, 0);
          p.av?.playEmote?.('scared');
        }
      });

      scene.remove(mobGroup);
    }
  };

  requestAnimationFrame(anim);
}

// ============================================================================
// ADMIN CLONE HORDE & GUILLOTINE SYSTEM
// ============================================================================
function spawnCloneHorde(targetName) {
  toast(`👥 ĐÃ TRIỆU HỒI ĐÀN PHÂN THÂN TRUY LÙNG [${targetName || 'Mục tiêu'}]!`);
  playSfx('spooky_laugh', 'halloween');

  let tx = me.x * TILE;
  let tz = me.y * TILE;
  if (targetName && !isAdminTarget(targetName, me.name)) {
    const pEntry = findPeerByName(targetName);
    if (pEntry) {
      tx = pEntry[1].x * TILE;
      tz = pEntry[1].y * TILE;
    }
  }

  const clones = [];
  const hordeGroup = new THREE.Group();
  scene.add(hordeGroup);

  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const dist = 6 + Math.random() * 3;
    const cloneMesh = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.5 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat);
    head.position.y = 1.0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.22), mat);
    body.position.y = 0.6;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.2), mat);
    legs.position.y = 0.2;
    cloneMesh.add(head, body, legs);
    cloneMesh.position.set(tx + Math.cos(angle) * dist, 0, tz + Math.sin(angle) * dist);
    hordeGroup.add(cloneMesh);
    clones.push(cloneMesh);
  }

  const startT = performance.now();
  const animClones = () => {
    const elapsed = performance.now() - startT;
    if (elapsed > 7000) {
      scene.remove(hordeGroup);
      return;
    }

    let allHit = true;
    clones.forEach(c => {
      const cdx = tx - c.position.x;
      const cdz = tz - c.position.z;
      const cdist = Math.sqrt(cdx * cdx + cdz * cdz);
      if (cdist > 0.4) {
        allHit = false;
        c.position.x += (cdx / cdist) * 0.18;
        c.position.z += (cdz / cdist) * 0.18;
        c.lookAt(tx, 0.5, tz);
        c.rotation.z = Math.sin(elapsed * 0.02) * 0.15;
      }
    });

    if (!allHit) {
      requestAnimationFrame(animClones);
    } else {
      playSfx('explosion', 'tet');
      if (isAdminTarget(targetName, me.name) || !targetName) {
        me.av?.spawnLegoPop?.(0, 1.2, 0);
        toast(`💀 ĐÀN PHÂN THÂN ĐÃ TÚM ĐƯỢC VÀ DẬP BẠN TƠI TẢ!`);
        me.vy = 8;
      }
      scene.remove(hordeGroup);
    }
  };
  requestAnimationFrame(animClones);
}

function spawnGuillotineStrike(targetName) {
  toast(`⚔️ MÁY CHÉM GUILLOTINE KHỔNG LỒ GIÁNG XUỐNG [${targetName || 'Mục tiêu'}]!`);
  let tx = me.x * TILE;
  let tz = me.y * TILE;
  if (targetName && !isAdminTarget(targetName, me.name)) {
    const pEntry = findPeerByName(targetName);
    if (pEntry) {
      tx = pEntry[1].x * TILE;
      tz = pEntry[1].y * TILE;
    }
  }

  const gGroup = new THREE.Group();
  gGroup.position.set(tx, 0, tz);

  // Khung máy chém bằng gỗ
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c2b14, roughness: 0.8 });
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.2, 0.2), woodMat);
  p1.position.set(-0.6, 2.1, 0);
  const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.2, 0.2), woodMat);
  p2.position.set(0.6, 2.1, 0);
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.25), woodMat);
  topBar.position.set(0, 4.1, 0);

  // Lưỡi dao sắc bén
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.06), bladeMat);
  blade.position.set(0, 3.8, 0);

  gGroup.add(p1, p2, topBar, blade);
  scene.add(gGroup);

  const startT = performance.now();
  const animBlade = () => {
    const elapsed = performance.now() - startT;
    if (elapsed < 800) {
      // Dao đứng im trên đỉnh rung rung
      blade.position.x = (Math.random() - 0.5) * 0.04;
      requestAnimationFrame(animBlade);
    } else if (elapsed < 1200) {
      // Rơi vút xuống
      const progress = (elapsed - 800) / 400;
      blade.position.y = 3.8 - progress * 2.5;
      requestAnimationFrame(animBlade);
    } else {
      // Trúng đích: XOẸT!
      playSfx('wood');
      playSfx('splat', 'halloween');
      if (isAdminTarget(targetName, me.name) || !targetName) {
        me.av?.spawnLegoPop?.(0, 1.4, 0);
        me.av?.setLimbState?.({ head: false });
        toast('🪓 XOẸT! Bạn đã bị chém bay đầu rơi Lego!');
        setTimeout(() => {
          me.av?.setLimbState?.({ head: true });
        }, 3500);
      }
      peers.forEach(p => {
        if (isAdminTarget(targetName, p.name)) {
          p.av?.spawnLegoPop?.(0, 1.4, 0);
          p.av?.setLimbState?.({ head: false });
          setTimeout(() => p.av?.setLimbState?.({ head: true }), 3500);
        }
      });
      setTimeout(() => scene.remove(gGroup), 1800);
    }
  };
  requestAnimationFrame(animBlade);
}

// ============================================================================
// TRƯỜNG GIANG SLIME CUBE TROLL ENTITY (:truonggiang)
// Minecraft style slime bouncing cube with 6-sided comedian Trường Giang face,
// hopping around and chasing a random non-admin player with funny quotes
// ============================================================================
const activeTruongGiangSlimes = new Map();
const MAX_TRUONGGIANG_SLIMES = 12;
let truongGiangTexture = null;
let truongGiangTextureUsers = 0;

export function removeTruongGiangSlime(entityId = null) {
  const slimes = entityId
    ? [activeTruongGiangSlimes.get(entityId)].filter(Boolean)
    : Array.from(activeTruongGiangSlimes.values());
  for (const slime of slimes) {
    if (slime.animFrame) cancelAnimationFrame(slime.animFrame);
    if (slime.speechTimer) clearTimeout(slime.speechTimer);
    if (slime.speechEl) slime.speechEl.remove();
    scene.remove(slime.group);
    slime.group.traverse(object => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    });
    activeTruongGiangSlimes.delete(slime.entityId);
    truongGiangTextureUsers--;
  }
  if (truongGiangTextureUsers === 0 && truongGiangTexture) {
    truongGiangTexture.dispose();
    truongGiangTexture = null;
  }
}

function showTruongGiangImpact(targetId) {
  if (targetId !== net?.selfId) return;
  me.vx = (Math.random() - 0.5) * 6;
  me.vy = 4;
  me.av?.showTomatoSplat?.();
  playSfx('truonggiang_catch', 'casino');
  toast('Bạn đã bị DÊ !');

  const flash = document.createElement('div');
  flash.className = 'truonggiang-hit-flash';
  document.body.appendChild(flash);
  requestAnimationFrame(() => flash.classList.add('visible'));
  setTimeout(() => flash.remove(), 280);
}

export function spawnTruongGiangSlime(targetName = null, byAdmin = 'Admin', options = {}) {
  const target = targetName || me.name;
  const entityId = options.entityId || `${net?.selfId || 'local'}:${Date.now()}:${Math.random()}`;
  removeTruongGiangSlime(entityId);
  if (activeTruongGiangSlimes.size >= MAX_TRUONGGIANG_SLIMES) {
    if (!options.entityId) toast(`⚠️ Đã đạt giới hạn ${MAX_TRUONGGIANG_SLIMES} slime Trường Giang cùng lúc.`);
    return;
  }
  const ownerId = options.ownerId || net?.selfId;
  const targetId = options.targetId || net?.selfId;
  const isAuthority = ownerId === net?.selfId;

  toast(`🤪 ${byAdmin} đã triệu hồi Khối Slime TRƯỜNG GIANG săn đuổi [${target}]!`);
  playSfx('duck_quack', 'casino');

  const slimeGroup = new THREE.Group();
  if (!truongGiangTexture) {
    truongGiangTexture = new THREE.TextureLoader().load('assets/truonggiang.webp');
    truongGiangTexture.colorSpace = THREE.SRGBColorSpace;
  }
  const tgTex = truongGiangTexture;
  truongGiangTextureUsers++;

  const cubeGeo = new THREE.BoxGeometry(1.25, 1.25, 1.25);
  // Apply Trường Giang face to all 6 faces of the cube
  const cubeMat = new THREE.MeshStandardMaterial({
    map: tgTex,
    roughness: 0.35,
    metalness: 0.1,
  });
  const slimeMesh = new THREE.Mesh(cubeGeo, cubeMat);
  slimeMesh.castShadow = true;
  slimeMesh.position.y = 0.625;
  slimeGroup.add(slimeMesh);

  slimeGroup.position.set(
    Number.isFinite(options.spawnX) ? options.spawnX : me.x * TILE + 2,
    0,
    Number.isFinite(options.spawnZ) ? options.spawnZ : me.y * TILE + 2,
  );
  scene.add(slimeGroup);

  // Speech bubble DOM element attached to 3D world position
  const speechEl = document.createElement('div');
  speechEl.className = 'speech-bubble-3d';
  speechEl.style.display = 'none';
  document.body.appendChild(speechEl);

  const funnyQuotes = [
    'Ủa alo?! Gì dị ba?! 😱',
    'Ai đó cứu tui dới chèn ơi! 😭',
    'Em xui quá anh em ơi! 🤦‍♂️',
    'Mười Khó tới kiếm chuyện nè! 💥',
    'Chạy đâu cho thoát hả cưng! 🏃💨',
    'Nhìn cái mặt tui quạu ghê hôn?! 😡',
    'Trời ơi là trời! Đau ruột thừa ghê! 🤣',
    'Bữa nay xui tận mạng rồi! 💀',
    'Ủa em làm cái gì sai hả đại ca?! 🥺',
    'Đứng lại đó nói chiện đàng hoàng coi! 🥊',
    'Né ra coi, mỡ nó dồn lên não rồi! 😂',
  ];

  function showSpeech(text, durationMs = 2800) {
    speechEl.textContent = text;
    speechEl.style.display = 'block';
    if (slime.speechTimer) clearTimeout(slime.speechTimer);
    slime.speechTimer = setTimeout(() => {
      speechEl.style.display = 'none';
      slime.speechTimer = null;
    }, durationMs);
  }

  let vy = 0;
  let onGround = true;
  let hopTimer = 0.4;
  let pesterCooldown = 0;
  let lastTime = performance.now();
  let lastStateBroadcastAt = 0;
  let stateSequence = 0;
  let impactId = 0;

  const slime = {
    group: slimeGroup,
    mesh: slimeMesh,
    speechEl,
    speechTimer: null,
    target,
    targetId,
    ownerId,
    entityId,
    isAuthority,
    impactId,
    lastStateSequence: 0,
    lastStateAt: performance.now(),
    remotePosition: slimeGroup.position.clone(),
    remoteRotationY: 0,
    remoteMeshRotationX: 0,
    remoteMeshScale: slimeMesh.scale.clone(),
    animFrame: null,
  };
  activeTruongGiangSlimes.set(entityId, slime);
  showSpeech('Mười Khó xuất chiêu! Chạy đâu con sâu! 🏃💨', 3200);

  function updateSlime() {
    const active = activeTruongGiangSlimes.get(entityId);
    if (!active) return;

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (!isAuthority) {
      if (now - active.lastStateAt > 1500) {
        removeTruongGiangSlime(entityId);
        return;
      }
      slimeGroup.position.lerp(active.remotePosition, Math.min(1, dt * 12));
      slimeGroup.rotation.y += (active.remoteRotationY - slimeGroup.rotation.y) * Math.min(1, dt * 12);
      slimeMesh.rotation.x += (active.remoteMeshRotationX - slimeMesh.rotation.x) * Math.min(1, dt * 12);
      slimeMesh.scale.lerp(active.remoteMeshScale, Math.min(1, dt * 12));
    } else {
      pesterCooldown = Math.max(0, pesterCooldown - dt);
      let tx = me.x * TILE;
      let tz = me.y * TILE;
      if (targetId !== net?.selfId) {
        const targetPeer = peers.get(targetId);
        if (targetPeer) {
          tx = targetPeer.x * TILE;
          tz = targetPeer.y * TILE;
        }
      }

      const dx = tx - slimeGroup.position.x;
      const dz = tz - slimeGroup.position.z;
      const dist = Math.hypot(dx, dz);

      if (onGround) {
        hopTimer -= dt;
        slimeMesh.scale.set(1.4, 0.6, 1.4);

        if (hopTimer <= 0) {
          onGround = false;
          vy = 7.0 + Math.random() * 2.5;
          slimeMesh.scale.set(0.75, 1.4, 0.75);
          hopTimer = 0.6 + Math.random() * 0.4;
          playSfx('plinko_peg', 'casino');
        }
      } else {
        vy -= 22.0 * dt;
        slimeGroup.position.y += vy * dt;

        if (dist > 0.3) {
          const speed = 4.8;
          slimeGroup.position.x += (dx / dist) * speed * dt;
          slimeGroup.position.z += (dz / dist) * speed * dt;
          slimeGroup.rotation.y = Math.atan2(dx, dz);
        }

        slimeMesh.rotation.x += dt * 3.5;

        if (slimeGroup.position.y <= 0) {
          slimeGroup.position.y = 0;
          vy = 0;
          onGround = true;
          slimeMesh.rotation.x = 0;
          slimeMesh.scale.set(1.4, 0.6, 1.4);
          playSfx('plinko_peg', 'casino');

          if (dist < 2.0 && pesterCooldown <= 0) {
            pesterCooldown = 3.0;
            const randomQuote = funnyQuotes[Math.floor(Math.random() * funnyQuotes.length)];
            showSpeech(randomQuote, 2500);
            impactId += 1;
            active.impactId = impactId;
            showTruongGiangImpact(targetId);
          }
        }
      }

      if (net && now - lastStateBroadcastAt >= 100) {
        lastStateBroadcastAt = now;
        net.send('op', {
          k: 'admin_truonggiang_state',
          entityId,
          ownerId,
          target,
          targetId,
          by: byAdmin,
          spawnX: Number.isFinite(options.spawnX) ? options.spawnX : me.x * TILE + 2,
          spawnZ: Number.isFinite(options.spawnZ) ? options.spawnZ : me.y * TILE + 2,
          stateSequence: ++stateSequence,
          x: slimeGroup.position.x,
          y: slimeGroup.position.y,
          z: slimeGroup.position.z,
          rotationY: slimeGroup.rotation.y,
          meshRotationX: slimeMesh.rotation.x,
          meshScale: slimeMesh.scale.toArray(),
          impactId,
          impactTargetId: targetId,
          v: Date.now(),
        });
      }
    }

    if (speechEl.style.display !== 'none' && camera) {
      const slimePos = slimeGroup.position.clone();
      slimePos.y += 1.8;
      slimePos.project(camera);
      if (slimePos.z < 1) {
        const sx = (slimePos.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-(slimePos.y * 0.5) + 0.5) * window.innerHeight;
        speechEl.style.left = `${sx}px`;
        speechEl.style.top = `${sy}px`;
      } else {
        speechEl.style.display = 'none';
      }
    }

    active.animFrame = requestAnimationFrame(updateSlime);
  }

  slime.animFrame = requestAnimationFrame(updateSlime);
}

// ============================================================================
// ADMIN VISUAL FX: LASER, BLACK HOLE, CONFETTI, TORNADO
// ============================================================================
function spawnLaserStrike(x, y, targetName, byAdmin = 'Admin') {
  toast(`⚡ ${byAdmin} ĐÃ GIÁNG CHÙM TIA LASER HỦY DIỆT XUỐNG [${targetName || 'Mục tiêu'}]!`);
  playSfx('explosion', 'tet');

  const laserGeo = new THREE.CylinderGeometry(0.28, 0.45, 36, 16);
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0xff0033,
    transparent: true,
    opacity: 0.92,
  });
  const laserMesh = new THREE.Mesh(laserGeo, laserMat);
  laserMesh.position.set(x * TILE, 18, y * TILE);
  scene.add(laserMesh);

  const ringGeo = new THREE.RingGeometry(0.2, 1.8, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffdd00,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.set(x * TILE, 0.08, y * TILE);
  scene.add(ringMesh);

  const flash = document.createElement('div');
  flash.className = 'laser-flash-overlay';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 700);

  if (isAdminTarget(targetName, me.name)) {
    me.vy = 8;
    me.h += 1.2;
    me.av?.showTomatoSplat?.();
    document.body.classList.add('earthquake-active');
    setTimeout(() => document.body.classList.remove('earthquake-active'), 1000);
  }

  peers.forEach(p => {
    if (isAdminTarget(targetName, p.name)) {
      p.av?.showTomatoSplat?.();
    }
  });

  let start = performance.now();
  const anim = () => {
    const elapsed = performance.now() - start;
    if (elapsed > 600) {
      scene.remove(laserMesh);
      scene.remove(ringMesh);
      laserGeo.dispose();
      laserMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      return;
    }
    const f = 1 - (elapsed / 600);
    laserMat.opacity = f * 0.92;
    ringMat.opacity = f * 0.9;
    ringMesh.scale.set(1 + (1 - f) * 1.5, 1 + (1 - f) * 1.5, 1);
    requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
}

function spawnBlackHole(byAdmin = 'Admin') {
  toast(`🌌 ${byAdmin} ĐÃ MỞ RA MỘT HỐ ĐEN VŨ TRỤ HÚT XOÁY TOÀN PHÒNG!`);
  playSfx('explosion', 'tet');

  const bhGroup = new THREE.Group();
  const coreGeo = new THREE.SphereGeometry(1.6, 24, 24);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x05010a });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  bhGroup.add(coreMesh);

  const ringGeo = new THREE.RingGeometry(1.8, 3.8, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x9333ea,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = Math.PI / 3;
  bhGroup.add(ringMesh);

  bhGroup.position.set(14.5 * TILE, 3.2, 18.5 * TILE);
  scene.add(bhGroup);

  const startTime = performance.now();
  const duration = 4000;

  const anim = () => {
    const elapsed = performance.now() - startTime;
    if (elapsed > duration) {
      scene.remove(bhGroup);
      playSfx('explosion', 'tet');
      const angle = Math.random() * Math.PI * 2;
      me.vy = 7;
      me.x += Math.cos(angle) * 3;
      me.y += Math.sin(angle) * 3;
      toast('💥 HỐ ĐEN PHÁT NỔ TỐNG VĂNG TẤT CẢ RA NGOÀI!');
      return;
    }

    bhGroup.rotation.y += 0.08;
    ringMesh.rotation.z += 0.12;

    const dx = 14.5 - me.x;
    const dy = 18.5 - me.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.8) {
      me.x += (dx / d) * 0.08;
      me.y += (dy / d) * 0.08;
      me.h = Math.min(2.5, me.h + 0.02);
    }

    requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
}

function spawnConfettiShower(byAdmin = 'Admin') {
  toast(`🎉 ${byAdmin} BẮN PHÁO HOA GIẤY CẦU VỒNG TOÀN SERVER!`);
  playSfx('plinko_win', 'casino');

  const confettiCount = 90;
  const colors = [0xef4444, 0x3b82f6, 0x10b981, 0xfacc15, 0xec4899, 0x8b5cf6, 0x06b6d4];
  const items = [];

  for (let i = 0; i < confettiCount; i++) {
    const geo = new THREE.PlaneGeometry(0.18, 0.18);
    const mat = new THREE.MeshBasicMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (14.5 + (Math.random() - 0.5) * 22) * TILE,
      7 + Math.random() * 5,
      (18.5 + (Math.random() - 0.5) * 22) * TILE
    );
    scene.add(mesh);
    items.push({
      mesh,
      geo,
      mat,
      vy: 1.5 + Math.random() * 2,
      rx: (Math.random() - 0.5) * 6,
      ry: (Math.random() - 0.5) * 6,
    });
  }

  const startTime = performance.now();
  const anim = () => {
    const elapsed = performance.now() - startTime;
    if (elapsed > 4500) {
      items.forEach(it => {
        scene.remove(it.mesh);
        it.geo.dispose();
        it.mat.dispose();
      });
      return;
    }
    const dt = 0.016;
    items.forEach(it => {
      it.mesh.position.y -= it.vy * dt;
      it.mesh.rotation.x += it.rx * dt;
      it.mesh.rotation.y += it.ry * dt;
    });
    requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
}

function spawnTornado(targetName, byAdmin = 'Admin') {
  toast(`🌪️ ${byAdmin} ĐÃ THẢ LỐC XOÁY CUỐN BAY [${targetName || 'Mọi người'}]!`);
  playSfx('spooky_laugh', 'halloween');

  const tornadoGroup = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const r = 0.4 + i * 0.28;
    const ringGeo = new THREE.RingGeometry(r - 0.05, r + 0.05, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = i * 0.65;
    tornadoGroup.add(ring);
  }

  let tx = me.x * TILE;
  let tz = me.y * TILE;
  if (targetName && !isAdminTarget(targetName, me.name)) {
    const pEntry = findPeerByName(targetName);
    if (pEntry) {
      tx = pEntry[1].x * TILE;
      tz = pEntry[1].y * TILE;
    }
  }

  tornadoGroup.position.set(tx, 0.2, tz);
  scene.add(tornadoGroup);

  const startTime = performance.now();
  const anim = () => {
    const elapsed = performance.now() - startTime;
    if (elapsed > 4000) {
      scene.remove(tornadoGroup);
      return;
    }
    tornadoGroup.rotation.y += 0.25;
    if (isAdminTarget(targetName, me.name)) {
      me.vy = 8.5;
      me.r += 0.2;
    }
    requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
}

// ============================================================================
// ADMIN COMMAND SUGGESTIONS (AUTOCOMPLETE) & IMMEDIATE MODAL CLOSE
// ============================================================================
export const ADMIN_COMMAND_CATALOG = [
  // 1. Quản lý người chơi
  { cmd: ':kick', usage: ':kick <tên>', desc: 'Đuổi người chơi ra khỏi phòng' },
  { cmd: ':ban', usage: ':ban <tên>', desc: 'Cấm người chơi vào lại phòng' },
  { cmd: ':unban', usage: ':unban <tên>', desc: 'Gỡ lệnh cấm cho người chơi' },
  { cmd: ':mute', usage: ':mute <tên>', desc: 'Cấm chat người chơi' },
  { cmd: ':unmute', usage: ':unmute <tên>', desc: 'Gỡ cấm chat' },
  { cmd: ':jail', usage: ':jail <tên>', desc: 'Nhốt người chơi vào lồng giam' },
  { cmd: ':unjail', usage: ':unjail <tên>', desc: 'Thả tự do khỏi lồng giam' },
  { cmd: ':freeze', usage: ':freeze <tên>', desc: 'Đóng băng bất động' },
  { cmd: ':thaw', usage: ':thaw <tên>', desc: 'Rã đông, di chuyển lại' },
  { cmd: ':god', usage: ':god', desc: 'Bật chế độ bất tử (God Mode)' },
  { cmd: ':ungod', usage: ':ungod', desc: 'Tắt chế độ bất tử' },
  { cmd: ':kill', usage: ':kill <tên>', desc: 'Hạ gục người chơi (0 HP)' },
  { cmd: ':respawn', usage: ':respawn <tên>', desc: 'Hồi sinh về điểm xuất phát' },
  { cmd: ':bring', usage: ':bring <tên>', desc: 'Kéo người chơi lại gần mình' },
  { cmd: ':to', usage: ':to <tên>', desc: 'Dịch chuyển mình tới người chơi' },
  { cmd: ':tp', usage: ':tp <tên1> <tên2>', desc: 'Dịch chuyển người 1 tới người 2' },

  // 2. Nhân vật & Xây dựng
  { cmd: ':speed', usage: ':speed <hệ số>', desc: 'Tốc độ chạy (mặc định 1.0, vd :speed 5)' },
  { cmd: ':jp', usage: ':jp <lực>', desc: 'Lực nhảy cao (mặc định 8.2, vd :jp 18)' },
  { cmd: ':fly', usage: ':fly', desc: 'Bật chế độ bay tự do (Space bay, Shift hạ)' },
  { cmd: ':unfly', usage: ':unfly', desc: 'Tắt chế độ bay' },
  { cmd: ':noclip', usage: ':noclip', desc: 'Đi xuyên qua tất cả các bức tường' },
  { cmd: ':clip', usage: ':clip', desc: 'Tắt đi xuyên tường (bật lại va chạm)' },
  { cmd: ':invisible', usage: ':invisible', desc: 'Tàng hình hoàn toàn' },
  { cmd: ':visible', usage: ':visible', desc: 'Hiện hình trở lại' },
  { cmd: ':size', usage: ':size <hệ số>', desc: 'Phóng to/thu nhỏ nhân vật (vd :size 3)' },
  { cmd: ':giant', usage: ':giant <tên>', desc: 'Hóa người khổng lồ 3.5x' },
  { cmd: ':tiny', usage: ':tiny <tên>', desc: 'Hóa người tí hon 0.35x' },
  { cmd: ':golden', usage: ':golden <tên>', desc: 'Hóa Tượng Vàng Midas lấp lánh' },
  { cmd: ':ghost', usage: ':ghost <tên>', desc: 'Hóa Hồn Ma trong suốt bồng bềnh' },
  { cmd: ':rainbow', usage: ':rainbow <tên>', desc: 'Hào quang cầu vồng RGB rực rỡ' },
  { cmd: ':btools', usage: ':btools', desc: 'Bật/tắt công cụ xây dựng khối 3D Roblox' },
  { cmd: ':build', usage: ':build', desc: 'Bật công cụ xây dựng khối 3D Roblox' },

  // 3. Thế giới & Môi trường
  { cmd: ':time', usage: ':time <day|night>', desc: 'Đổi thời gian ngày hoặc đêm' },
  { cmd: ':gravity', usage: ':gravity <số>', desc: 'Đổi trọng lực (mặc định 20, vd :gravity 5)' },
  { cmd: ':gravityflip', usage: ':gravityflip', desc: 'Đảo ngược trọng lực lộn ngược lên trần' },
  { cmd: ':matrix', usage: ':matrix', desc: 'Slow-Motion làm chậm thời gian 5 giây' },
  { cmd: ':blackhole', usage: ':blackhole', desc: 'Hố đen vũ trụ hút xoáy toàn bộ server' },
  { cmd: ':confetti', usage: ':confetti', desc: 'Bắn pháo hoa giấy kim tuyến cầu vồng' },
  { cmd: ':sm', usage: ':sm <nội dung>', desc: 'Gửi biểu ngữ thông báo lớn toàn phòng' },
  { cmd: ':shutdown', usage: ':shutdown', desc: 'Đóng phòng ngay lập tức' },

  // 4. Hỗn loạn & Troll (Quyền Nhà Nước)
  { cmd: ':casino', usage: ':casino', desc: 'Dịch chuyển tức thời vào Mật Thất Casino & Pub Hoàng Gia' },
  { cmd: ':speakeasy', usage: ':speakeasy', desc: 'Dịch chuyển tức thời vào Mật Thất Casino & Pub Hoàng Gia' },
  { cmd: ':dinnerbone', usage: ':dinnerbone <tên>', desc: 'Lật ngược 180 độ đầu dưới đất chân trên trời (Minecraft)' },
  { cmd: ':clone', usage: ':clone <tên>', desc: 'Triệu hồi 10 phân thân chạy đuổi theo đè bẹp mục tiêu' },
  { cmd: ':guillotine', usage: ':guillotine <tên>', desc: 'Thả máy chém rơi từ trời giáng xuống chặt bay đầu Lego pop' },
  { cmd: ':laser', usage: ':laser <tên>', desc: 'Bắn chùm tia laser hủy diệt từ trời giáng xuống' },
  { cmd: ':tornado', usage: ':tornado <tên>', desc: 'Lốc xoáy hất tung người chơi lên trời' },
  { cmd: ':summon', usage: ':summon <bat|zombie|dog|creeper|ghost> <tên>', desc: 'Thả quái vật săn đuổi cắn mất máu về 0 HP' },
  { cmd: ':attack', usage: ':attack <tên>', desc: 'Điều khiển quái vật cắn cạn máu mục tiêu' },
  { cmd: ':headless', usage: ':headless <tên>', desc: 'Tháo bay đầu của người chơi rớt Lego' },
  { cmd: ':disarm', usage: ':disarm <tên>', desc: 'Tháo mất 2 cánh tay' },
  { cmd: ':amputate', usage: ':amputate <tên>', desc: 'Tháo rụng tứ chi' },
  { cmd: ':lego', usage: ':lego <tên>', desc: 'Nổ tung cơ thể thành các khối Lego rời rạc' },
  { cmd: ':rearm', usage: ':rearm <tên>', desc: 'Lắp ráp lại tứ chi nguyên vẹn' },
  { cmd: ':heal', usage: ':heal <tên>', desc: 'Hồi phục máu và rửa sạch vết cà chua' },
  { cmd: ':spin', usage: ':spin <tên>', desc: 'Làm người chơi xoay mòng mòng chóng mặt' },
  { cmd: ':spinall', usage: ':spinall', desc: 'Làm toàn bộ server xoay tít mù' },
  { cmd: ':disco', usage: ':disco', desc: 'Bật/tắt sàn nhảy Disco lung linh' },
  { cmd: ':earthquake', usage: ':earthquake', desc: 'Kích hoạt động đất rung chuyển màn hình' },
  { cmd: ':nuke', usage: ':nuke', desc: 'Kích nổ bom hạt nhân chói lóa' },
  { cmd: ':rocket', usage: ':rocket <tên>', desc: 'Bắn bay vút lên trời như tên lửa' },
  { cmd: ':slap', usage: ':slap <tên>', desc: 'Tát bay người chơi kèm ném cà chua' },
  { cmd: ':danceall', usage: ':danceall', desc: 'Bắt toàn bộ server cùng nhảy múa' },
  { cmd: ':flex', usage: ':flex [tên]', desc: 'Flex cơ bắp đồng bộ (chỉ hiệu ứng)' },
  { cmd: ':flexall', usage: ':flexall', desc: 'Cho toàn server cùng flex cơ bắp' },
  { cmd: ':clown', usage: ':clown <tên>', desc: 'Đội mũ bí ngô hề hước' },
  { cmd: ':fire', usage: ':fire <tên>', desc: 'Gắn lửa bốc cháy bập bùng' },
  { cmd: ':blind', usage: ':blind <tên>', desc: 'Làm tối đen màn hình mục tiêu' },
  { cmd: ':unblind', usage: ':unblind <tên>', desc: 'Gỡ tối đen màn hình mục tiêu' },
  { cmd: ':blindall', usage: ':blindall', desc: 'Làm tối đen màn hình toàn server' },
  { cmd: ':truonggiang', usage: ':truonggiang [tên]', desc: 'Thả Khối Slime Trường Giang 6 mặt nhảy tâng tâng rượt đuổi troll' },
  { cmd: ':untruonggiang', usage: ':untruonggiang', desc: 'Thu hồi Khối Slime Trường Giang' },
  { cmd: ':chips', usage: ':chips <số>', desc: 'Tự cấp thêm xu cờ bạc vào ví' },

  // 5. Khôi phục & Reset
  { cmd: ':reset', usage: ':reset', desc: 'Khôi phục mọi hiệu ứng troll & cơ thể về mặc định' },
  { cmd: ':resetall', usage: ':resetall', desc: 'Khôi phục mọi hiệu ứng troll & cơ thể về mặc định' },
  { cmd: ':clean', usage: ':clean', desc: 'Dọn sạch khối xây dựng và hiệu ứng' },
  { cmd: ':resetchips', usage: ':resetchips', desc: 'Đặt lại số xu cờ bạc về 0' },
  { cmd: ':clearhistory', usage: ':clearhistory', desc: 'Xóa hồi chiêu 10 phút của mã code' },
  { cmd: ':clearmap', usage: ':clearmap', desc: 'Dọn dẹp thiệp và đồ trang trí trên sàn' },
];

let selectedSuggestIndex = -1;
let currentSuggestions = [];

function hideAdminSuggestions() {
  const container = $('adminSuggestions');
  if (container) {
    container.classList.add('hidden');
    container.innerHTML = '';
  }
  selectedSuggestIndex = -1;
  currentSuggestions = [];
}

function renderAdminSuggestions(list) {
  const container = $('adminSuggestions');
  if (!container) return;
  if (!list || list.length === 0) {
    hideAdminSuggestions();
    return;
  }
  currentSuggestions = list;
  selectedSuggestIndex = -1;
  container.innerHTML = '';

  list.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'admin-suggest-item';
    el.innerHTML = `
      <div class="admin-suggest-left">
        <span class="admin-suggest-badge ${item.isUser ? 'user' : ''}">${item.isUser ? 'NGƯỜI CHƠI' : 'LỆNH'}</span>
        <span class="admin-suggest-cmd">${item.label}</span>
      </div>
      <div class="admin-suggest-desc">${item.desc}</div>
    `;

    el.onclick = (e) => {
      e.stopPropagation();
      applySuggestion(item);
    };
    container.appendChild(el);
  });

  container.classList.remove('hidden');
}

function applySuggestion(item) {
  const input = $('inAdminCmd');
  if (!input) return;

  if (item.isUser) {
    const parts = input.value.split(/\s+/);
    parts[parts.length - 1] = item.value;
    input.value = parts.join(' ') + ' ';
  } else {
    input.value = item.value + ' ';
  }
  input.focus();
  updateSuggestions();
}

function updateSuggestions() {
  const input = $('inAdminCmd');
  if (!input) return;
  const raw = input.value;
  if (!raw || !raw.trim()) {
    hideAdminSuggestions();
    return;
  }

  const parts = raw.split(/\s+/);

  if (parts.length === 1 || (parts.length === 2 && !parts[1])) {
    let term = parts[0].toLowerCase();
    if (!term.startsWith(':') && !term.startsWith(';') && !term.startsWith('/')) {
      term = ':' + term;
    }
    const matches = ADMIN_COMMAND_CATALOG.filter(c => c.cmd.toLowerCase().startsWith(term));
    const items = matches.slice(0, 10).map(c => ({
      isUser: false,
      label: c.usage,
      value: c.cmd,
      desc: c.desc,
    }));
    renderAdminSuggestions(items);
  } else {
    const lastArg = parts[parts.length - 1].toLowerCase();
    const playerList = [];

    playerList.push({ name: me.name, desc: 'Chính bản thân bạn' });
    playerList.push({ name: 'all', desc: 'Toàn bộ tất cả người chơi trong phòng' });

    peers.forEach(p => {
      if (p.name && !playerList.some(pl => pl.name === p.name)) {
        playerList.push({ name: p.name, desc: 'Thành viên trong phòng' });
      }
    });

    const matches = playerList.filter(p => p.name.toLowerCase().includes(lastArg));
    const items = matches.slice(0, 8).map(p => ({
      isUser: true,
      label: p.name,
      value: p.name,
      desc: p.desc,
    }));
    renderAdminSuggestions(items);
  }
}

function setupAdminCommandAutocomplete() {
  const input = $('inAdminCmd');
  if (!input) return;

  input.addEventListener('input', () => {
    updateSuggestions();
  });

  input.addEventListener('keydown', (e) => {
    const container = $('adminSuggestions');
    const isVisible = container && !container.classList.contains('hidden');

    if (!isVisible) {
      if (e.key === 'Enter') {
        runAndCloseAdminCmd();
      }
      return;
    }

    const items = container.querySelectorAll('.admin-suggest-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedSuggestIndex = (selectedSuggestIndex + 1) % items.length;
      items.forEach((it, idx) => it.classList.toggle('selected', idx === selectedSuggestIndex));
      items[selectedSuggestIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedSuggestIndex = (selectedSuggestIndex - 1 + items.length) % items.length;
      items.forEach((it, idx) => it.classList.toggle('selected', idx === selectedSuggestIndex));
      items[selectedSuggestIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const targetIdx = selectedSuggestIndex >= 0 ? selectedSuggestIndex : 0;
      if (currentSuggestions[targetIdx]) {
        applySuggestion(currentSuggestions[targetIdx]);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestIndex >= 0 && currentSuggestions[selectedSuggestIndex]) {
        applySuggestion(currentSuggestions[selectedSuggestIndex]);
      }
      runAndCloseAdminCmd();
    } else if (e.key === 'Escape') {
      hideAdminSuggestions();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.admin-cmd-box')) {
      hideAdminSuggestions();
    }
  });

  // Make cheatsheet command codes clickable to execute and close immediately
  setTimeout(() => {
    document.querySelectorAll('#dlgAdmin code').forEach(codeEl => {
      codeEl.style.cursor = 'pointer';
      codeEl.title = 'Bấm để thực thi ngay lệnh này';
      codeEl.onclick = (e) => {
        e.stopPropagation();
        const text = codeEl.textContent.trim().split('—')[0].trim().split(' ')[0];
        if (text) executeAdminCommand(text);
      };
    });
  }, 100);
}

function runAndCloseAdminCmd() {
  const input = $('inAdminCmd');
  if (!input) return;
  const cmd = input.value.trim();
  if (cmd) {
    input.value = '';
    hideAdminSuggestions();
    closeDialog('dlgAdmin');
    executeAdminCommand(cmd);
  }
}

$('btnRunAdminCmd').onclick = runAndCloseAdminCmd;

function executeAdminCommand(raw) {
  // Tự động đóng modal ngay lập tức để người chơi quan sát kết quả trên màn hình
  closeDialog('dlgAdmin');
  hideAdminSuggestions();

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
      playSfx('plinko_win');
      toast('✨ XÁC THỰC THÀNH CÔNG! Đã kích hoạt quyền Quản Trị Viên Tối Cao (ADMIN)!');
      return true;
    } else {
      toast('❌ Mật mã xác thực Quản Trị Viên không chính xác!');
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
    toast('⛔ Bạn chưa xác thực quyền Admin! Bấm phím [;] để nhập mật mã xác minh.');
    openAdminAuthDialog();
    return true;
  }

  switch (cmd) {
    // === 1. PLAYER MANAGEMENT ===
    case 'kick': {
      if (!requireRoomHost()) return true;
      const targetName = args.join(' ').trim();
      if (!targetName) { toast('⚠️ Cú pháp: :kick <tên_người_chơi>'); return true; }
      const pEntry = findPeerByName(targetName);
      if (!pEntry) { toast(`⚠️ Không tìm thấy người chơi "${targetName}"`); return true; }
      emitOp({ k: 'kick', targetId: pEntry[0], targetName: pEntry[1].name, byHost: net.selfId });
      toast(`👢 Đã đuổi ${pEntry[1].name} ra khỏi phòng!`);
      return true;
    }
    case 'ban': {
      if (!requireRoomHost()) return true;
      const targetName = args.join(' ').trim();
      if (!targetName) { toast('⚠️ Cú pháp: :ban <tên_người_chơi>'); return true; }
      const pEntry = findPeerByName(targetName);
      emitOp({ k: 'admin_ban', name: pEntry?.[1].name || targetName, banned: true });
      toast(`🚫 Đã đưa "${targetName}" vào danh sách cấm tham gia!`);
      return true;
    }
    case 'unban': {
      if (!requireRoomHost()) return true;
      const targetName = args.join(' ').trim();
      if (!targetName) { toast('⚠️ Cú pháp: :unban <tên_người_chơi>'); return true; }
      emitOp({ k: 'admin_ban', name: targetName, banned: false });
      toast(`✅ Đã gỡ cấm cho "${targetName}"!`);
      return true;
    }
    case 'mute': {
      if (!requireRoomHost()) return true;
      const targetName = args.join(' ').trim();
      if (!targetName) { toast('⚠️ Cú pháp: :mute <tên_người_chơi>'); return true; }
      const pEntry = findPeerByName(targetName);
      emitOp({ k: 'admin_mute', name: pEntry?.[1].name || targetName, muted: true });
      toast(`🔇 Đã cấm chat người chơi "${targetName}"!`);
      return true;
    }
    case 'unmute': {
      if (!requireRoomHost()) return true;
      const targetName = args.join(' ').trim();
      if (!targetName) { toast('⚠️ Cú pháp: :unmute <tên_người_chơi>'); return true; }
      emitOp({ k: 'admin_mute', name: targetName, muted: false });
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
      emitOp({ k: 'admin_size', target: me.name, scale: finalScale });
      toast(`📏 Đã chỉnh kích thước nhân vật: ${finalScale}x`);
      return true;
    }
    case 'giant': {
      const targetName = args[0] || me.name;
      const s = 3.5;
      emitOp({ k: 'admin_size', target: targetName, scale: s });
      toast(`🦕 Đã biến ${targetName} thành người khổng lồ 3.5x!`);
      return true;
    }
    case 'tiny': {
      const targetName = args[0] || me.name;
      const s = 0.35;
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
      const t = (args[0] || 'day').toLowerCase();
      if (t !== 'day' && t !== 'night') {
        toast('⚠️ Cú pháp: :time <day|night>');
        return true;
      }
      emitOp({ k: 'admin_time', time: t });
      return true;
    }
    case 'gravity': {
      const g = parseFloat(args[0]) || 20;
      const gravity = Math.max(0, Math.min(50, g));
      emitOp({ k: 'admin_gravity', gravity });
      return true;
    }
    case 'shutdown': {
      if (!requireRoomHost()) return true;
      closeRoomByHost();
      return true;
    }

    // === 4. FUN & TROLL ===
    case 'xu':
    case 'chips': {
      const num = parseInt(args[0], 10) || 1000;
      addChips(num);
      playSfx('plinko_win');
      updateCasinoChipsUI();
      toast(`🪙 Admin: Đã cấp thêm ${num.toLocaleString()} xu vào ví!`);
      return true;
    }
    case 'truonggiang':
    case 'tg': {
      const requestedTarget = args[0];
      let targetEntry = requestedTarget && normalizePlayerName(requestedTarget) !== 'all'
        ? findPeerByName(requestedTarget)
        : null;
      if (requestedTarget && normalizePlayerName(requestedTarget) !== 'all' &&
          !isAdminTarget(requestedTarget, me.name) && !targetEntry) {
        toast(`Không tìm thấy người chơi "${requestedTarget}".`);
        return true;
      }
      if (isAdminTarget(requestedTarget, me.name)) targetEntry = [net.selfId, me];
      if (!targetEntry) {
        const candidates = Array.from(peers.entries()).filter(([, player]) =>
          player.name && !isAdminUser(player.name) && !player.isAdmin,
        );
        targetEntry = candidates.length
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : [net.selfId, me];
      }
      const [targetId, targetPlayer] = targetEntry;
      emitOp({
        k: 'admin_truonggiang',
        target: targetPlayer.name,
        targetId,
        entityId: `${net.selfId}:${Date.now()}:${Math.random()}`,
        ownerId: net.selfId,
        spawnX: me.x * TILE + 2 + (Math.random() - 0.5) * 4,
        spawnZ: me.y * TILE + 2 + (Math.random() - 0.5) * 4,
        active: true,
        by: me.name,
      });
      return true;
    }
    case 'untruonggiang':
    case 'untg': {
      emitOp({ k: 'admin_truonggiang', active: false, by: me.name });
      toast('💨 Đã thu hồi Khối Slime Trường Giang!');
      return true;
    }
    case 'fire': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_fire', target: targetName });
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
      return true;
    }
    case 'flex':
    case 'flexall': {
      const targetName = cmd === 'flexall' || normalizePlayerName(args[0]) === 'all'
        ? 'all'
        : args[0] || me.name;
      emitOp({ k: 'admin_flex', target: targetName, by: me.name });
      return true;
    }
    case 'disco': {
      emitOp({ k: 'admin_disco', by: me.name });
      return true;
    }
    case 'earthquake': {
      emitOp({ k: 'admin_earthquake', by: me.name });
      return true;
    }
    case 'nuke': {
      emitOp({ k: 'admin_nuke', by: me.name });
      return true;
    }
    case 'rocket': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_rocket', target: targetName, by: me.name });
      return true;
    }
    case 'slap': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_slap', target: targetName, by: me.name });
      return true;
    }
    case 'danceall': {
      emitOp({ k: 'admin_dance', target: 'all', by: me.name });
      return true;
    }
    case 'clown': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_clown', target: targetName, by: me.name });
      return true;
    }

    // === CASINO TELEPORT ===
    case 'casino':
    case 'speakeasy': {
      enterSecretCasino();
      return true;
    }

    // === BUILDER TOOLS ===
    case 'btools':
    case 'build': {
      adminBuilderMode = cmd === 'build' ? true : !adminBuilderMode;
      document.body.classList.toggle('builder-mode-active', adminBuilderMode);
      $('btoolsHud')?.classList.toggle('hidden', !adminBuilderMode);
      if (adminBuilderMode && document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      toast(adminBuilderMode 
        ? '🧱 BẬT BUILDER TOOL: Click để ĐẶT khối 3D, Alt+Click hoặc Shift+Click để XÓA!' 
        : '🧱 ĐÃ TẮT BUILDER TOOL');
      return true;
    }

    // === TROLL: DINNERBONE, CLONE & GUILLOTINE ===
    case 'dinnerbone': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_dinnerbone', target: targetName, by: me.name });
      toast(`🙃 Đã đảo ngược đầu dưới đất chân trên trời (Dinnerbone) cho ${targetName}!`);
      return true;
    }
    case 'clone': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_clone', target: targetName, by: me.name });
      return true;
    }
    case 'guillotine': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_guillotine', target: targetName, by: me.name });
      return true;
    }

    // === MOB ATTACK & HUNT ===
    case 'summon':
    case 'attack': {
      let mobType = 'bat';
      let targetName = args[0] || me.name;
      if (args.length >= 2) {
        mobType = args[0];
        targetName = args[1];
      }
      emitOp({ k: 'admin_summon_mob', mob: mobType, target: targetName, by: me.name });
      return true;
    }

    // === LEGO LIMB DETACH TROLLS ===
    case 'headless': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_limb_state', target: targetName, limbs: { head: false } });
      toast(`🪓 Đã tháo bay đầu của ${targetName} rớt Lego!`);
      return true;
    }
    case 'disarm': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_limb_state', target: targetName, limbs: { leftArm: false, rightArm: false } });
      toast(`🦾 Đã tháo mất 2 cánh tay của ${targetName}!`);
      return true;
    }
    case 'amputate': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_limb_state', target: targetName, limbs: { leftArm: false, rightArm: false, legs: false } });
      toast(`🦿 Đã tháo rụng tứ chi của ${targetName}!`);
      return true;
    }
    case 'lego': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_limb_state', target: targetName, limbs: { head: false, leftArm: false, rightArm: false, legs: false } });
      toast(`🧱 Đã nổ tung người ${targetName} thành các khối Lego rời rạc!`);
      return true;
    }
    case 'rearm': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_limb_state', target: targetName, limbs: { head: true, leftArm: true, rightArm: true, legs: true } });
      toast(`✨ Đã lắp ráp lại tứ chi nguyên vẹn cho ${targetName}!`);
      return true;
    }

    // === NEW CHAOS & SPECIAL ADMIN COMMANDS ===
    case 'laser':
    case 'beam': {
      const targetName = args[0] || me.name;
      let tx = me.x;
      let ty = me.y;
      if (!isAdminTarget(targetName, me.name)) {
        const pEntry = findPeerByName(targetName);
        if (pEntry) {
          tx = pEntry[1].x;
          ty = pEntry[1].y;
        }
      }
      emitOp({ k: 'admin_laser', x: tx, y: ty, target: targetName, by: me.name });
      return true;
    }
    case 'tornado':
    case 'cyclone': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_tornado', target: targetName, by: me.name });
      return true;
    }
    case 'blackhole':
    case 'vortex': {
      emitOp({ k: 'admin_blackhole', by: me.name });
      return true;
    }
    case 'confetti':
    case 'party': {
      emitOp({ k: 'admin_confetti', by: me.name });
      return true;
    }
    case 'golden':
    case 'midas': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_golden', target: targetName, by: me.name });
      return true;
    }
    case 'ghost': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_ghost', target: targetName, by: me.name });
      return true;
    }
    case 'rainbow': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_rainbow', target: targetName, by: me.name });
      return true;
    }
    case 'heal':
    case 'revive': {
      const targetName = args[0] || me.name;
      emitOp({ k: 'admin_heal', target: targetName, by: me.name });
      return true;
    }
    case 'matrix': {
      emitOp({ k: 'admin_matrix', by: me.name });
      return true;
    }
    case 'gravityflip':
    case 'invertr': {
      emitOp({ k: 'admin_gravity_flip', by: me.name });
      return true;
    }
    case 'blindall': {
      emitOp({ k: 'admin_blind', target: 'all', blind: true });
      return true;
    }
    case 'unblindall': {
      emitOp({ k: 'admin_blind', target: 'all', blind: false });
      return true;
    }
    case 'tp': {
      const t1 = args[0];
      const t2 = args[1];
      if (!t1 || !t2) { toast('⚠️ Cú pháp: :tp <tên_người_1> <tên_người_2>'); return true; }
      let targetX = me.x;
      let targetY = me.y;
      if (t2.toLowerCase() === 'me' || t2.toLowerCase() === me.name.toLowerCase()) {
        targetX = me.x;
        targetY = me.y;
      } else {
        const p2 = findPeerByName(t2);
        if (!p2) { toast(`⚠️ Không tìm thấy người chơi "${t2}"`); return true; }
        targetX = p2[1].x;
        targetY = p2[1].y;
      }
      emitOp({ k: 'admin_teleport', target: t1, toX: targetX, toY: targetY, by: me.name });
      toast(`🌀 Đã dịch chuyển ${t1} tới chỗ ${t2}!`);
      return true;
    }

    // === 5. RESET COMMANDS ===
    case 'reset':
    case 'resetall':
    case 'clean': {
      emitOp({ k: 'admin_reset_all', by: me.name });
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
      emitOp({ k: 'admin_clearmap' });
      return true;
    }
    default:
      toast(`⚠️ Lệnh không xác định: :${cmd}. Mở [;] để xem hướng dẫn!`);
      return false;
  }
}

// Initial UI refresh for top-right wallet and title badges
updateCasinoChipsUI();
updateTitleUI();
