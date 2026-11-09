import * as THREE from 'three';
import { THEMES, AVATARS, CARD_STYLES } from './themes.js';
import { TILES, isSolid, blankMap, defaultMap, validMap } from './maps.js';
import { connect } from './net.js';
import { initPlayer, parseYouTube, apply as applyMedia, snapshot } from './media.js';
import { World, TILE } from './world.js';
import { Avatar, loadCharacter, EMOTE_CLIP, hueFor } from './avatar.js';
import { emojiSprite } from './props.js';

const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
const toast = msg => { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2500); };

const WALK = 2.2, RUN = 4.0, JUMP_V = 7, GRAVITY = 20, RADIUS = 0.28; // speeds in tiles/s, radius in tiles

// ---------- state ----------
let net, me, state, isAdmin = false, adminKey = '';
const peers = new Map();   // id -> {name, avatar, x, y, tx, ty, r, tr, a, h, av}
const floaters = [];
let inbox = JSON.parse(localStorage.getItem('gh_inbox') || '[]');
let brush = null, decorSel = null, gotState = false;
let mode = 'tps', prevMode = 'tps';          // 'tps' | 'fps' | 'top'
let yaw = 0, pitch = -0.25;
const keys = new Set();

// ---------- three.js ----------
let renderer, scene, camera, world;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(70, 1, 0.1, 300);
  world = new World(scene);
} catch (e) { console.error(e); document.addEventListener('DOMContentLoaded', () => toast('Trình duyệt không hỗ trợ WebGL')); }
function resize() { if (!renderer) return; renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- landing ----------
let avatar = localStorage.getItem('gh_avatar') || AVATARS[0];
AVATARS.forEach(a => { const b = document.createElement('button'); b.textContent = a; if (a === avatar) b.className = 'sel';
  b.onclick = () => { avatar = a; [...$('avatars').children].forEach(c => c.classList.toggle('sel', c === b)); }; $('avatars').appendChild(b); });
for (const [k, t] of Object.entries(THEMES)) for (const sel of ['inTheme', 'admTheme']) { const o = document.createElement('option'); o.value = k; o.textContent = t.name; $(sel).appendChild(o); }
for (const [k, s] of Object.entries(CARD_STYLES)) { const o = document.createElement('option'); o.value = k; o.textContent = s.name; $('cardStyle').appendChild(o); }
$('inName').value = localStorage.getItem('gh_name') || '';
$('inRoom').value = new URLSearchParams(location.hash.slice(1)).get('room') || '';
$('btnJoin').onclick = join;

async function join() {
  const name = $('inName').value.trim() || 'Khách' + Math.floor(Math.random() * 999);
  const room = ($('inRoom').value.trim() || 'lobby').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  localStorage.setItem('gh_name', name); localStorage.setItem('gh_avatar', avatar);
  location.hash = 'room=' + room;
  $('landing').classList.add('hidden');
  const pass = $('inAdmin').value, theme = $('inTheme').value;
  me = { name, avatar, x: 0, y: 0, r: Math.PI, h: 0, vy: 0, loco: 'idle' };
  net = await connect(room, handlers);
  $('roomInfo').textContent = `${room} ${net.online ? '' : '(offline)'}`;
  if (!net.online) toast('Không kết nối được mạng P2P — chế độ offline');
  initPlayer('yt');
  setTimeout(async () => {
    if (gotState) return;
    state = { v: Date.now(), theme, map: defaultMap(), decor: [], cards: [], media: null, settings: { openDecor: true, openMedia: true }, verifier: null };
    if (pass) { state.verifier = await sha(await sha(pass)); adminKey = await sha(pass); }
    isAdmin = true; toast('Bạn là người tạo phòng 👑');
    start();
  }, net.online ? 3500 : 0);
  if (net.online) toast('Đang tìm phòng…');
}

async function start() {
  if (me.started) return; me.started = true;
  const gltf = await loadCharacter();
  me.x = state.map.spawn[0] + (Math.random() - 0.5) * 2; me.y = state.map.spawn[1];
  me.av = new Avatar(gltf, { name: me.name, hue: hueFor(me.avatar) }); me.av.label.visible = false; scene.add(me.av.root);
  $('admTheme').value = state.theme;
  $('admOpenDecor').checked = state.settings.openDecor; $('admOpenMedia').checked = state.settings.openMedia;
  net.send('hello', pubInfo());
  applyMedia(state.media); buildDecorBar(); updateHud(); requestAnimationFrame(loop);
}
const pubInfo = () => ({ name: me.name, avatar: me.avatar, x: me.x, y: me.y, r: me.r });

// ---------- network ----------
async function addPeer(id, d) {
  const old = peers.get(id);
  const p = old || { x: d.x, y: d.y, r: d.r ?? 0, h: 0, a: 'idle' };
  Object.assign(p, { name: d.name, avatar: d.avatar, tx: d.x, ty: d.y, tr: d.r ?? p.r });
  peers.set(id, p); refreshRecipients();
  if (p.av || p.loading) return; p.loading = true;
  const gltf = await loadCharacter();
  if (!peers.has(id)) return;
  p.av = new Avatar(gltf, { name: p.name, hue: hueFor(p.avatar) }); scene.add(p.av.root); p.loading = false;
}
const handlers = {
  join(id) { if (me.started) { net.send('hello', pubInfo(), id); net.send('state', state, id); } },
  leave(id) { const p = peers.get(id); if (p) { toast(`${p.name} đã rời phòng`); if (p.av) scene.remove(p.av.root); } peers.delete(id); refreshRecipients(); },
  hello(d, id) { addPeer(id, d); },
  pos(d, id) { const p = peers.get(id); if (p) { p.tx = d.x; p.ty = d.y; p.tr = d.r; p.a = d.a; p.th = d.h || 0; } },
  state(s) {
    if (!validMap(s?.map) || (state && s.v <= state.v)) return;
    const first = !state; state = s; gotState = true;
    if (first) start(); else { applyMedia(state.media); buildDecorBar(); }
  },
  async op(op) { if (state && await authorize(op)) applyOp(op); },
  chat(d, id) { const p = peers.get(id); if (p) { p.av?.say(d.t); logChat(p.name, d.t); } },
  emote(d, id) {
    const p = peers.get(id); if (!p) return;
    p.av?.playEmote(EMOTE_CLIP[d.e] || 'Wave'); floaters.push({ e: d.e, who: id, t: Date.now() });
    if (d.to === net.selfId) { toast(`${p.name} ${d.e} bạn!`); if (mode !== 'fps') me.r = Math.atan2(p.x - me.x, p.y - me.y); }
  },
  card(c, id) { const p = peers.get(id); inbox.unshift({ ...c, from: p?.name || c.from, at: Date.now() }); saveInbox(); toast('💌 Bạn nhận được một tấm thiệp!'); },
  async media(m) { if (state && (state.settings.openMedia || await authorize(m))) { state.media = m.media; applyMedia(state.media); } },
};

const ADMIN_OPS = new Set(['map', 'theme', 'settings', 'clearDecor']);
async function authorize(op) {
  if (ADMIN_OPS.has(op.k) || op.k === 'mediaAdmin') return !state.verifier ? false : (await sha(op.key || '')) === state.verifier;
  if (op.k === 'decor+' || op.k === 'decor-') return state.settings.openDecor || (!!state.verifier && (await sha(op.key || '')) === state.verifier);
  return true;
}
function applyOp(op) {
  switch (op.k) {
    case 'map': if (validMap(op.map)) { state.map = op.map; state.decor = state.decor.filter(d => d.x < op.map.w && d.y < op.map.h); } break;
    case 'theme': if (THEMES[op.theme]) { state.theme = op.theme; buildDecorBar(); } break;
    case 'settings': state.settings = op.settings; break;
    case 'clearDecor': state.decor = []; break;
    case 'decor+': state.decor = state.decor.filter(d => !(d.x === op.d.x && d.y === op.d.y)); state.decor.push(op.d); break;
    case 'decor-': state.decor = state.decor.filter(d => d.id !== op.id); break;
    case 'card+': state.cards = state.cards.filter(c => c.id !== op.c.id); state.cards.push(op.c); break;
  }
  state.v = Math.max(state.v, op.v || 0);
}
function emitOp(op) {
  op.v = Date.now();
  if ((isAdmin && ADMIN_OPS.has(op.k)) || op.k === 'decor+' || op.k === 'decor-') op.key = adminKey;
  applyOp(op); net.send('op', op);
}
function requireAdmin() { if (!isAdmin) { toast('Cần quyền admin'); return false; } return true; }

// ---------- chat / emotes / cards ----------
function logChat(name, t) { const d = document.createElement('div'); d.textContent = `${name}: ${t}`; const l = $('chatLog'); l.appendChild(d); while (l.children.length > 6) l.firstChild.remove(); setTimeout(() => d.remove(), 15000); }
$('chatIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.value.trim()) { const t = e.target.value.trim(); me.av?.say(t); logChat(me.name, t); net.send('chat', { t }); e.target.value = ''; e.target.blur(); } if (e.key === 'Escape') e.target.blur(); });
const saveInbox = () => { localStorage.setItem('gh_inbox', JSON.stringify(inbox.slice(0, 50))); $('inboxCount').textContent = inbox.length; };
saveInbox();
function refreshRecipients() { const s = $('cardTo'); const cur = s.value; s.innerHTML = ''; const add = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o); };
  add('pin', '📌 Treo lên map (mọi người thấy)'); peers.forEach((p, id) => add(id, `${p.avatar} ${p.name}`)); if ([...s.options].some(o => o.value === cur)) s.value = cur; }
refreshRecipients();
function doEmote(e, to) {
  me.av?.playEmote(EMOTE_CLIP[e] || 'Wave'); floaters.push({ e, who: net.selfId, t: Date.now() });
  net.send('emote', { e, to }, to);
  if (to) { const p = peers.get(to); if (p && mode !== 'fps') me.r = Math.atan2(p.x - me.x, p.y - me.y); }
}
$('cardSend').onclick = () => {
  const text = $('cardText').value.trim(); if (!text) return; const style = $('cardStyle').value, to = $('cardTo').value;
  const card = { id: uid(), from: me.name, text, style };
  if (to === 'pin') emitOp({ k: 'card+', c: { ...card, x: Math.round(me.x), y: Math.round(me.y) } });
  else { net.send('card', card, to); toast('Đã gửi thiệp 💌'); }
  $('cardText').value = ''; $('dlgCard').classList.add('hidden');
};
function renderInbox() { const l = $('inboxList'); l.innerHTML = ''; if (!inbox.length) l.textContent = 'Chưa có thiệp nào.';
  inbox.forEach(c => { const st = CARD_STYLES[c.style] || CARD_STYLES.classic; const d = document.createElement('div'); d.className = 'card';
    d.style.cssText = `background:${st.bg};color:${st.fg};border-color:${st.border}`; d.textContent = `${c.text}\n\n— ${c.from}`; l.appendChild(d); }); }

// ---------- dialogs & buttons ----------
const openDialog = id => { document.exitPointerLock?.(); $(id).classList.remove('hidden'); };
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('.overlay').classList.add('hidden'));
$('btnCard').onclick = () => { refreshRecipients(); openDialog('dlgCard'); };
$('btnInbox').onclick = () => { renderInbox(); openDialog('dlgInbox'); };
$('btnCopy').onclick = () => { navigator.clipboard?.writeText(location.href); toast('Đã copy link phòng'); };
$('btnDecor').onclick = () => { $('decorBar').classList.toggle('hidden'); if ($('decorBar').classList.contains('hidden')) decorSel = null; };
$('btnMedia').onclick = () => openDialog('dlgMedia');
$('btnView').onclick = () => toggleView();
$('btnStopBrush').onclick = () => setBrush(null);
$('btnAdmin').onclick = () => { $('adminLogin').classList.toggle('hidden', isAdmin); $('adminTools').classList.toggle('hidden', !isAdmin); openDialog('dlgAdmin'); };
$('adminGo').onclick = async () => { const k = await sha($('adminPass').value); if (state.verifier && (await sha(k)) === state.verifier) { isAdmin = true; adminKey = k; toast('Đã đăng nhập admin'); $('btnAdmin').click(); } else toast('Sai mật khẩu hoặc phòng không có admin'); };
$('mediaPlay').onclick = () => { const vid = parseYouTube($('mediaUrl').value) || state.media?.vid; if (!vid) return toast('Link YouTube không hợp lệ'); setMedia({ vid, playing: true, t: vid === state.media?.vid ? (snapshot(true)?.t ?? 0) : 0, at: Date.now() }); };
$('mediaPause').onclick = () => { const s = snapshot(false); if (s) setMedia(s); };
$('mediaHide').onclick = () => $('mediaBox').classList.toggle('hidden');
function setMedia(m) { if (!state.settings.openMedia && !isAdmin) return toast('Chỉ admin điều khiển được'); state.media = m; applyMedia(m); $('mediaBox').classList.remove('hidden'); net.send('media', { media: m, k: 'mediaAdmin', key: adminKey }); }
const brushBox = $('brushes');
const BRUSH_ICON = { '.': '⬜', '#': '🧱', T: '🌳', '~': '🌊', R: '🟥', S: '📺' };
TILES.forEach(t => { const b = document.createElement('button'); b.textContent = BRUSH_ICON[t.ch]; b.title = t.label; b.onclick = () => { setBrush(t.ch); [...brushBox.children].forEach(c => c.classList.toggle('sel', c === b)); $('dlgAdmin').classList.add('hidden'); }; brushBox.appendChild(b); });
function setBrush(ch) {
  brush = ch; $('btnStopBrush').classList.toggle('hidden', !ch);
  if (ch) { prevMode = mode === 'top' ? prevMode : mode; mode = 'top'; yaw = 0; toast('Chế độ vẽ map: kéo chuột trái để vẽ, WASD để di chuyển'); }
  else if (mode === 'top') { mode = prevMode; if (mode === 'tps') pitch = -0.25; }
  updateHud();
}
$('admTheme').onchange = e => requireAdmin() && emitOp({ k: 'theme', theme: e.target.value });
const pushSettings = () => emitOp({ k: 'settings', settings: { openDecor: $('admOpenDecor').checked, openMedia: $('admOpenMedia').checked } });
$('admOpenDecor').onchange = $('admOpenMedia').onchange = pushSettings;
$('admResize').onclick = () => { if (confirm('Tạo map trống mới?')) emitOp({ k: 'map', map: blankMap(clamp(+$('admW').value, 8, 80), clamp(+$('admH').value, 8, 80)) }); };
$('admClearDecor').onclick = () => emitOp({ k: 'clearDecor' });
$('admExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state.map)], { type: 'application/json' })); a.download = 'map.json'; a.click(); };
$('admImport').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = async () => { try { const m = JSON.parse(await i.files[0].text()); if (!validMap(m)) throw 0; emitOp({ k: 'map', map: m }); } catch { toast('File map không hợp lệ'); } }; i.click(); };
function buildDecorBar() { const bar = $('decorBar'); bar.innerHTML = ''; const mk = (t, f) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { f(); [...bar.children].forEach(c => c.classList.toggle('sel', c === b)); }; bar.appendChild(b); };
  THEMES[state.theme].decor.forEach(e => mk(e, () => decorSel = e)); mk('🧹', () => decorSel = 'erase'); }

// ---------- views ----------
function toggleView() {
  if (mode === 'top') return toast('Đang ở chế độ vẽ map');
  mode = mode === 'tps' ? 'fps' : 'tps'; pitch = mode === 'fps' ? 0 : -0.25; updateHud();
}
function updateHud() {
  $('viewLabel').textContent = mode === 'fps' ? '👁️ Góc nhìn thứ nhất' : mode === 'top' ? '🛠️ Chế độ vẽ map' : '🎥 Góc nhìn thứ ba';
  $('crosshair').classList.toggle('hidden', mode === 'top');
  if (me?.av) me.av.root.visible = mode !== 'fps';
}

// ---------- input ----------
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (e.key === 'Enter') { document.exitPointerLock?.(); $('chatIn').focus(); e.preventDefault(); return; }
  if (k === 'v') toggleView();
  else if (k === 'l') { if (document.pointerLockElement) document.exitPointerLock(); else $('game').requestPointerLock?.(); }
  else if (k === 'e') interactNearest();
  else if (k === 'escape' && brush) setBrush(null);
  else if ('1234'.includes(e.key) && me?.av) doEmote(['👋', '🙌', '🤗', '🎁'][+e.key - 1]);
  if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
  if (e.key === ' ' && me && me.h === 0) me.vy = JUMP_V;
  keys.add(k);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const cv = $('game'), ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let down = null, painting = false;
const ndcOf = e => document.pointerLockElement ? new THREE.Vector2(0, 0) : new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
const floorTile = ndc => { ray.setFromCamera(ndc, camera); const v = new THREE.Vector3(); if (!ray.ray.intersectPlane(ground, v)) return null; return { x: Math.round(v.x / TILE), y: Math.round(v.z / TILE) }; };
const inMap = t => t && t.x >= 0 && t.y >= 0 && t.x < state.map.w && t.y < state.map.h;
const tileAt = (x, y) => (x < 0 || y < 0 || x >= state.map.w || y >= state.map.h) ? '#' : state.map.rows[y][x];
function peerAt(ndc) {
  ray.setFromCamera(ndc, camera); let best = null, bd = 1e9; const c = new THREE.Vector3();
  for (const [id, p] of peers) { if (!p.av) continue; c.set(p.x * TILE, p.h + 0.9, p.y * TILE);
    const d = ray.ray.origin.distanceTo(c); if (d < 35 && d < bd && ray.ray.distanceSqToPoint(c) < 0.55 * 0.55) { best = id; bd = d; } }
  return best;
}
cv.addEventListener('pointerdown', e => {
  if (!state) return; $('peerMenu').classList.add('hidden');
  down = { x: e.clientX, y: e.clientY, moved: 0, button: e.button }; cv.setPointerCapture(e.pointerId);
  if (brush && isAdmin && e.button === 0) { painting = true; paint(floorTile(ndcOf(e))); }
});
cv.addEventListener('pointermove', e => {
  if (!state) return;
  if (painting) { paint(floorTile(ndcOf(e))); return; }
  const locked = !!document.pointerLockElement; if (!down && !locked) return;
  const dx = locked ? e.movementX : e.clientX - down.x, dy = locked ? e.movementY : e.clientY - down.y;
  if (!locked) { down.x = e.clientX; down.y = e.clientY; down.moved += Math.abs(dx) + Math.abs(dy); }
  if (mode === 'top') return;
  yaw -= dx * 0.005; pitch = clamp(pitch - dy * 0.005, mode === 'fps' ? -1.45 : -1.2, mode === 'fps' ? 1.45 : 0.8);
});
cv.addEventListener('pointerup', e => {
  if (!state || !down) return;
  const wasClick = down.moved < 6 && down.button === 0 && !painting; down = null;
  if (painting) { painting = false; emitOp({ k: 'map', map: state.map }); return; }
  if (wasClick) handleClick(ndcOf(e), e.clientX, e.clientY);
});
cv.addEventListener('click', () => { if (mode === 'fps' && !document.pointerLockElement && !decorSel) cv.requestPointerLock?.(); });
cv.addEventListener('contextmenu', e => e.preventDefault());
function handleClick(ndc, cx, cy) {
  const id = peerAt(ndc); if (id) return openPeerMenu(id, cx, cy);
  const t = floorTile(ndc);
  if (decorSel && inMap(t)) {
    if (decorSel === 'erase') { const d = state.decor.find(d => d.x === t.x && d.y === t.y); if (d) emitOp({ k: 'decor-', id: d.id }); }
    else if (!isSolid(tileAt(t.x, t.y))) emitOp({ k: 'decor+', d: { id: uid(), x: t.x, y: t.y, e: decorSel } });
    return;
  }
  const c = t && state.cards.find(c => c.x === t.x && c.y === t.y);
  if (c) { inbox.unshift({ ...c, at: Date.now() }); saveInbox(); renderInbox(); openDialog('dlgInbox'); }
}
function interactNearest() {
  let best = null, bd = 3.5; for (const [id, p] of peers) { const d = Math.hypot(p.x - me.x, p.y - me.y); if (d < bd && p.av) { bd = d; best = id; } }
  if (!best) { const c = state.cards.find(c => Math.hypot(c.x - me.x, c.y - me.y) < 1.8); if (c) { inbox.unshift({ ...c, at: Date.now() }); saveInbox(); renderInbox(); openDialog('dlgInbox'); } else toast('Không có ai ở gần (đứng gần hoặc ngắm vào người rồi nhấn E)'); return; }
  document.exitPointerLock?.(); openPeerMenu(best, innerWidth / 2, innerHeight / 2);
}
function paint(t) { if (!inMap(t)) return; const r = state.map.rows[t.y]; if (r[t.x] !== brush) state.map.rows[t.y] = r.slice(0, t.x) + brush + r.slice(t.x + 1); }
function openPeerMenu(id, x, y) {
  document.exitPointerLock?.();
  const m = $('peerMenu'); m.innerHTML = ''; const p = peers.get(id); const h = document.createElement('div'); h.textContent = `${p.avatar} ${p.name}`; m.appendChild(h);
  [['👋', 'Vẫy tay'], ['🤗', 'Nhảy cùng'], ['🙌', 'Đập tay'], ['🎁', 'Tặng quà']].forEach(([em, t]) => { const b = document.createElement('button'); b.textContent = `${em} ${t}`; b.onclick = () => { doEmote(em, id); m.classList.add('hidden'); }; m.appendChild(b); });
  const c = document.createElement('button'); c.textContent = '💌 Gửi thiệp'; c.onclick = () => { refreshRecipients(); $('cardTo').value = id; openDialog('dlgCard'); m.classList.add('hidden'); }; m.appendChild(c);
  m.style.left = Math.min(x, innerWidth - 170) + 'px'; m.style.top = Math.min(y, innerHeight - 230) + 'px'; m.classList.remove('hidden');
}

// ---------- simulation ----------
const free = (x, y) => { for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (isSolid(tileAt(Math.floor(x + ox * RADIUS + 0.5), Math.floor(y + oy * RADIUS + 0.5)))) return false; return true; };
let last = performance.now(), lastSend = 0, sent = {};
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const k = keys;
  const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
  const str = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
  const running = k.has('shift');
  let dx = -Math.sin(yaw) * fwd + Math.cos(yaw) * str, dz = -Math.cos(yaw) * fwd - Math.sin(yaw) * str;
  const moving = !!(dx || dz);
  if (moving) {
    const l = Math.hypot(dx, dz), sp = (running ? RUN : WALK) * dt; dx = dx / l * sp; dz = dz / l * sp;
    if (free(me.x + dx, me.y)) me.x += dx; if (free(me.x, me.y + dz)) me.y += dz;
  }
  if (mode === 'fps') me.r = yaw + Math.PI;
  else if (moving) me.r = lerpAngle(me.r, Math.atan2(dx, dz), Math.min(1, dt * 14));
  // jump
  if (me.h > 0 || me.vy > 0) { me.vy -= GRAVITY * dt; me.h = Math.max(0, me.h + me.vy * dt); if (me.h === 0) me.vy = 0; }
  me.loco = me.h > 0 ? 'jump' : moving ? (running ? 'run' : 'walk') : 'idle';
  const av = me.av; av.root.position.set(me.x * TILE, me.h, me.y * TILE); av.root.rotation.y = me.r; av.setLocomotion(me.loco); av.update(dt);
  // network
  const cur = { x: me.x, y: me.y, r: me.r, a: me.loco, h: me.h };
  if (now - lastSend > 90 && (cur.a !== sent.a || Math.abs(cur.x - sent.x) > 0.005 || Math.abs(cur.y - sent.y) > 0.005 || Math.abs(cur.r - sent.r) > 0.02 || cur.h !== sent.h)) { net.send('pos', cur); sent = cur; lastSend = now; }
  // peers
  peers.forEach(p => {
    const a = Math.min(1, dt * 10); p.x += (p.tx - p.x) * a; p.y += (p.ty - p.y) * a; p.h += ((p.th || 0) - p.h) * a; p.r = lerpAngle(p.r, p.tr ?? p.r, a);
    if (p.av) { p.av.root.position.set(p.x * TILE, p.h, p.y * TILE); p.av.root.rotation.y = p.r; p.av.setLocomotion(p.a); p.av.update(dt); }
  });
  updateFloaters();
  updateCamera();
  world.sync(state);
  world.update(dt, { x: me.x * TILE, z: me.y * TILE });
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function updateFloaters() {
  const now = Date.now();
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i], age = (now - f.t) / 1000, who = f.who === net.selfId ? me : peers.get(f.who);
    if (age > 2 || !who) { if (f.s) scene.remove(f.s); floaters.splice(i, 1); continue; }
    if (!f.s) { f.s = emojiSprite(f.e, 0.8); scene.add(f.s); }
    f.s.position.set(who.x * TILE, (who.h || 0) + 2.2 + age * 0.6, who.y * TILE); f.s.material.opacity = 1 - age / 2;
  }
}

const solidForCamera = (x, z) => { const t = tileAt(Math.round(x / TILE), Math.round(z / TILE)); return t === '#'; };
const _head = new THREE.Vector3(), _want = new THREE.Vector3(), _p = new THREE.Vector3();
function updateCamera() {
  const px = me.x * TILE, pz = me.y * TILE;
  if (mode === 'fps') { camera.position.set(px, me.h + 1.6, pz); camera.rotation.set(pitch, yaw, 0, 'YXZ'); }
  else if (mode === 'top') { camera.position.set(px, 30, pz + 11); camera.lookAt(px, 0, pz); }
  else {
    _head.set(px, me.h + 1.5, pz); const cp = Math.cos(pitch);
    _want.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp).multiplyScalar(-4.5).add(_head);
    _want.x += Math.cos(yaw) * 0.7; _want.z += -Math.sin(yaw) * 0.7;
    let t = 1; for (let i = 1; i <= 16; i++) { _p.lerpVectors(_head, _want, i / 16); if (_p.y < 2.6 && solidForCamera(_p.x, _p.z)) { t = (i - 1) / 16; break; } }
    camera.position.lerpVectors(_head, _want, Math.max(t, 0.08)); camera.position.y = Math.max(camera.position.y, 0.3);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }
}
