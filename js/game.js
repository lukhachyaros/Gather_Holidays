import { THEMES, AVATARS, CARD_STYLES } from './themes.js';
import { TILES, isSolid, blankMap, defaultMap, validMap } from './maps.js';
import { connect } from './net.js';
import { initPlayer, parseYouTube, apply as applyMedia, snapshot } from './media.js';

const $ = id => document.getElementById(id);
const TS = 32, SPEED = 4.5; // tiles per second
const uid = () => Math.random().toString(36).slice(2, 10);
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toast = msg => { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2500); };

// ---------- state ----------
let net, me, state, isAdmin = false, adminKey = '';
const peers = new Map(); // id -> {name, avatar, x, y, tx, ty, bubble, bubbleUntil}
const floaters = []; // floating emotes
let inbox = JSON.parse(localStorage.getItem('gh_inbox') || '[]');
let brush = null, decorSel = null, particles = [], mediaShown = true, gotState = false;
const keys = new Set();

// ---------- landing ----------
let avatar = localStorage.getItem('gh_avatar') || AVATARS[0];
AVATARS.forEach(a => { const b = document.createElement('button'); b.textContent = a; if (a === avatar) b.className = 'sel';
  b.onclick = () => { avatar = a; [...$('avatars').children].forEach(c => c.classList.toggle('sel', c === b)); }; $('avatars').appendChild(b); });
for (const [k, t] of Object.entries(THEMES)) { for (const sel of ['inTheme', 'admTheme']) { const o = document.createElement('option'); o.value = k; o.textContent = t.name; $(sel).appendChild(o); } }
for (const [k, s] of Object.entries(CARD_STYLES)) { const o = document.createElement('option'); o.value = k; o.textContent = s.name; $('cardStyle').appendChild(o); }
$('inName').value = localStorage.getItem('gh_name') || '';
const hashRoom = new URLSearchParams(location.hash.slice(1)).get('room');
$('inRoom').value = hashRoom || '';
$('btnJoin').onclick = join;

async function join() {
  const name = $('inName').value.trim() || 'Khách' + Math.floor(Math.random() * 999);
  const room = ($('inRoom').value.trim() || 'lobby').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  localStorage.setItem('gh_name', name); localStorage.setItem('gh_avatar', avatar);
  location.hash = 'room=' + room;
  $('landing').classList.add('hidden');
  const pass = $('inAdmin').value;
  const theme = $('inTheme').value;
  me = { name, avatar, x: 0, y: 0, tx: 0, ty: 0 };
  net = await connect(room, handlers);
  $('roomInfo').textContent = `${room} ${net.online ? '' : '(offline)'}`;
  if (!net.online) toast('Không kết nối được mạng P2P — chế độ offline');
  initPlayer('yt');
  // Wait briefly for an existing peer's state; otherwise we create the room.
  setTimeout(async () => {
    if (gotState) return;
    const map = defaultMap();
    state = { v: Date.now(), theme, map, decor: [], cards: [], media: null, settings: { openDecor: true, openMedia: true }, verifier: null };
    if (pass) { state.verifier = await sha(await sha(pass)); adminKey = await sha(pass); }
    isAdmin = true; // creator is admin of own room
    toast('Bạn là người tạo phòng 👑');
    start();
  }, net.online ? 3500 : 0);
  if (net.online) toast('Đang tìm phòng…');
}

function start() {
  if (me.started) return; me.started = true;
  me.x = me.tx = state.map.spawn[0] + (Math.random() - .5) * 2; me.y = me.ty = state.map.spawn[1];
  $('admTheme').value = state.theme;
  $('admOpenDecor').checked = state.settings.openDecor; $('admOpenMedia').checked = state.settings.openMedia;
  net.send('hello', pubInfo());
  applyMedia(state.media); initParticles(); buildDecorBar(); requestAnimationFrame(loop);
}
const pubInfo = () => ({ name: me.name, avatar: me.avatar, x: me.x, y: me.y });

// ---------- network handlers ----------
const handlers = {
  join(id) { if (me.started) { net.send('hello', pubInfo(), id); net.send('state', state, id); } },
  leave(id) { const p = peers.get(id); if (p) toast(`${p.name} đã rời phòng`); peers.delete(id); refreshRecipients(); },
  hello(d, id) { const p = peers.get(id) || {}; peers.set(id, { ...p, ...d, tx: d.x, ty: d.y }); refreshRecipients(); },
  pos(d, id) { const p = peers.get(id); if (p) { p.tx = d.x; p.ty = d.y; } },
  state(s) {
    if (!validMap(s?.map) || (state && s.v <= state.v)) return;
    const first = !state; state = s; gotState = true;
    if (first) start(); else { applyMedia(state.media); buildDecorBar(); }
  },
  async op(op) { if (state && await authorize(op)) applyOp(op); },
  chat(d, id) { const p = peers.get(id); if (p) { p.bubble = d.t; p.bubbleUntil = Date.now() + 5000; logChat(p.name, d.t); } },
  emote(d, id) { const p = peers.get(id); floaters.push({ e: d.e, who: id, t: Date.now() }); if (d.to === net.selfId && p) toast(`${p.name} ${d.e} bạn!`); },
  card(c, id) { const p = peers.get(id); inbox.unshift({ ...c, from: p?.name || c.from, at: Date.now() }); saveInbox(); toast('💌 Bạn nhận được một tấm thiệp!'); },
  async media(m) { if (state && (state.settings.openMedia || await authorize(m))) { state.media = m.media; applyMedia(state.media); } },
};

// Admin ops carry the admin key (hash of passphrase); verifier = sha(key). Casual trust model, see README.
const ADMIN_OPS = new Set(['map', 'theme', 'settings', 'clearDecor']);
async function authorize(op) {
  if (ADMIN_OPS.has(op.k) || (op.k === 'mediaAdmin')) return !state.verifier ? false : (await sha(op.key || '')) === state.verifier;
  if (op.k === 'decor+' || op.k === 'decor-') return state.settings.openDecor || (!!state.verifier && (await sha(op.key || '')) === state.verifier);
  return true;
}
function applyOp(op) {
  switch (op.k) {
    case 'map': if (validMap(op.map)) { state.map = op.map; state.decor = state.decor.filter(d => d.x < op.map.w && d.y < op.map.h); } break;
    case 'theme': if (THEMES[op.theme]) { state.theme = op.theme; initParticles(); } break;
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
  if (isAdmin && ADMIN_OPS.has(op.k) || op.k === 'decor+' || op.k === 'decor-') op.key = adminKey;
  applyOp(op); net.send('op', op);
}
function requireAdmin() { if (!isAdmin) { toast('Cần quyền admin'); return false; } return true; }

// ---------- chat / emotes / cards ----------
function logChat(name, t) { const d = document.createElement('div'); d.textContent = `${name}: ${t}`; const l = $('chatLog'); l.appendChild(d); while (l.children.length > 6) l.firstChild.remove(); setTimeout(() => d.remove(), 15000); }
$('chatIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.value.trim()) { const t = e.target.value.trim(); me.bubble = t; me.bubbleUntil = Date.now() + 5000; logChat(me.name, t); net.send('chat', { t }); e.target.value = ''; e.target.blur(); } });
const saveInbox = () => { localStorage.setItem('gh_inbox', JSON.stringify(inbox.slice(0, 50))); $('inboxCount').textContent = inbox.length; };
saveInbox();
function refreshRecipients() { const s = $('cardTo'); const cur = s.value; s.innerHTML = ''; const add = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o); };
  add('pin', '📌 Treo lên map (mọi người thấy)'); peers.forEach((p, id) => add(id, `${p.avatar} ${p.name}`)); if ([...s.options].some(o => o.value === cur)) s.value = cur; }
refreshRecipients();
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
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('.overlay').classList.add('hidden'));
$('btnCard').onclick = () => { refreshRecipients(); $('dlgCard').classList.remove('hidden'); };
$('btnInbox').onclick = () => { renderInbox(); $('dlgInbox').classList.remove('hidden'); };
$('btnCopy').onclick = () => { navigator.clipboard?.writeText(location.href); toast('Đã copy link phòng'); };
$('btnDecor').onclick = () => { $('decorBar').classList.toggle('hidden'); if ($('decorBar').classList.contains('hidden')) decorSel = null; };
$('btnMedia').onclick = () => $('dlgMedia').classList.remove('hidden');
$('btnAdmin').onclick = () => { $('adminLogin').classList.toggle('hidden', isAdmin); $('adminTools').classList.toggle('hidden', !isAdmin); $('dlgAdmin').classList.remove('hidden'); };
$('adminGo').onclick = async () => { const k = await sha($('adminPass').value); if (state.verifier && (await sha(k)) === state.verifier) { isAdmin = true; adminKey = k; toast('Đã đăng nhập admin'); $('btnAdmin').click(); } else toast('Sai mật khẩu hoặc phòng không có admin'); };
$('mediaPlay').onclick = () => { const vid = parseYouTube($('mediaUrl').value) || state.media?.vid; if (!vid) return toast('Link YouTube không hợp lệ'); setMedia({ vid, playing: true, t: vid === state.media?.vid ? (snapshot(true)?.t ?? 0) : 0, at: Date.now() }); };
$('mediaPause').onclick = () => { const s = snapshot(false); if (s) setMedia(s); };
$('mediaHide').onclick = () => { mediaShown = !mediaShown; $('mediaBox').classList.toggle('hidden', !mediaShown); };
function setMedia(m) { if (!state.settings.openMedia && !isAdmin) return toast('Chỉ admin điều khiển được'); state.media = m; applyMedia(m); $('mediaBox').classList.toggle('hidden', !mediaShown); net.send('media', { media: m, k: 'mediaAdmin', key: adminKey }); }
// admin tools
const brushBox = $('brushes');
TILES.forEach(t => { const b = document.createElement('button'); b.textContent = t.ch === '.' ? '⬜' : t.ch === '#' ? '🧱' : t.ch === 'T' ? '🌳' : t.ch === '~' ? '🌊' : t.ch === 'R' ? '🟥' : '📺'; b.title = t.label; b.onclick = () => { brush = t.ch; [...brushBox.children].forEach(c => c.classList.toggle('sel', c === b)); $('dlgAdmin').classList.add('hidden'); toast('Kéo chuột để vẽ. Bấm 🛠️ để đổi ô.'); }; brushBox.appendChild(b); });
$('admTheme').onchange = e => requireAdmin() && emitOp({ k: 'theme', theme: e.target.value });
const pushSettings = () => emitOp({ k: 'settings', settings: { openDecor: $('admOpenDecor').checked, openMedia: $('admOpenMedia').checked } });
$('admOpenDecor').onchange = $('admOpenMedia').onchange = pushSettings;
$('admResize').onclick = () => { if (confirm('Tạo map trống mới?')) emitOp({ k: 'map', map: blankMap(clamp(+$('admW').value, 8, 80), clamp(+$('admH').value, 8, 80)) }); };
$('admClearDecor').onclick = () => emitOp({ k: 'clearDecor' });
$('admExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state.map)], { type: 'application/json' })); a.download = 'map.json'; a.click(); };
$('admImport').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = async () => { try { const m = JSON.parse(await i.files[0].text()); if (!validMap(m)) throw 0; emitOp({ k: 'map', map: m }); } catch { toast('File map không hợp lệ'); } }; i.click(); };
function buildDecorBar() { const bar = $('decorBar'); bar.innerHTML = ''; const mk = (t, f) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { f(); [...bar.children].forEach(c => c.classList.toggle('sel', c === b)); }; bar.appendChild(b); };
  THEMES[state.theme].decor.forEach(e => mk(e, () => decorSel = e)); mk('🧹', () => decorSel = 'erase'); }

// ---------- input ----------
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; if (e.key === 'Enter') { $('chatIn').focus(); e.preventDefault(); } keys.add(e.key.toLowerCase()); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
const cv = $('game'), ctx = cv.getContext('2d');
let cam = { x: 0, y: 0 }, target = null, painting = false;
function resize() { cv.width = innerWidth; cv.height = innerHeight; } addEventListener('resize', resize); resize();
const toTile = e => ({ x: Math.floor((e.clientX + cam.x) / TS), y: Math.floor((e.clientY + cam.y) / TS) });
cv.addEventListener('pointerdown', e => {
  $('peerMenu').classList.add('hidden'); if (!state) return; const t = toTile(e);
  for (const [id, p] of peers) if (Math.hypot(p.x - (e.clientX + cam.x) / TS + .5, p.y - (e.clientY + cam.y) / TS + .5) < .7) return openPeerMenu(id, e);
  if (brush && isAdmin) { painting = true; paint(t); return; }
  if (decorSel && inMap(t)) {
    if (decorSel === 'erase') { const d = state.decor.find(d => d.x === t.x && d.y === t.y); if (d) emitOp({ k: 'decor-', id: d.id }); }
    else if (!isSolid(tileAt(t.x, t.y))) emitOp({ k: 'decor+', d: { id: uid(), x: t.x, y: t.y, e: decorSel } });
    return;
  }
  const c = state.cards.find(c => c.x === t.x && c.y === t.y); if (c) { inbox.unshift({ ...c, at: Date.now() }); saveInbox(); renderInbox(); $('dlgInbox').classList.remove('hidden'); return; }
  target = { x: t.x, y: t.y };
});
cv.addEventListener('pointermove', e => { if (painting) paint(toTile(e)); });
addEventListener('pointerup', () => { if (painting) { painting = false; emitOp({ k: 'map', map: state.map }); } });
const inMap = t => t.x >= 0 && t.y >= 0 && t.x < state.map.w && t.y < state.map.h;
const tileAt = (x, y) => (x < 0 || y < 0 || x >= state.map.w || y >= state.map.h) ? '#' : state.map.rows[y][x];
function paint(t) { if (!inMap(t)) return; const r = state.map.rows[t.y]; if (r[t.x] !== brush) state.map.rows[t.y] = r.slice(0, t.x) + brush + r.slice(t.x + 1); }
function openPeerMenu(id, e) { const m = $('peerMenu'); m.innerHTML = ''; const p = peers.get(id); const h = document.createElement('div'); h.textContent = `${p.avatar} ${p.name}`; m.appendChild(h);
  [['👋', 'Vẫy tay'], ['🤗', 'Ôm'], ['🙌', 'Đập tay'], ['🎁', 'Tặng quà']].forEach(([em, t]) => { const b = document.createElement('button'); b.textContent = `${em} ${t}`; b.onclick = () => { net.send('emote', { e: em, to: id }, id); floaters.push({ e: em, who: id, t: Date.now() }); m.classList.add('hidden'); }; m.appendChild(b); });
  const c = document.createElement('button'); c.textContent = '💌 Gửi thiệp'; c.onclick = () => { refreshRecipients(); $('cardTo').value = id; $('dlgCard').classList.remove('hidden'); m.classList.add('hidden'); }; m.appendChild(c);
  m.style.left = Math.min(e.clientX, innerWidth - 160) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - 220) + 'px'; m.classList.remove('hidden'); }
addEventListener('keydown', e => { if (e.target.tagName !== 'INPUT' && '1234'.includes(e.key) && e.key) { const em = ['👋', '😂', '❤️', '🎉'][+e.key - 1]; floaters.push({ e: em, who: net.selfId, t: Date.now() }); net.send('emote', { e: em }); } });

// ---------- particles ----------
function initParticles() { const c = THEMES[state.theme].particles; particles = Array.from({ length: c.count }, () => newParticle(c, true)); }
function newParticle(c, anywhere) { const r = (a, b) => a + Math.random() * (b - a); return { x: Math.random() * innerWidth, y: anywhere ? Math.random() * innerHeight : -20, vx: r(...c.vx), vy: r(...c.vy), e: c.emoji[Math.floor(Math.random() * c.emoji.length)], s: r(12, 22) }; }

// ---------- loop / render ----------
let last = performance.now(), lastSend = 0, moved = false;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  let dx = 0, dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1; if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1; if (keys.has('d') || keys.has('arrowright')) dx += 1;
  if (dx || dy) target = null;
  else if (target) { const ex = target.x - me.x, ey = target.y - me.y; if (Math.hypot(ex, ey) < .1) target = null; else { dx = ex; dy = ey; } }
  if (dx || dy) { const l = Math.hypot(dx, dy); step(dx / l * SPEED * dt, dy / l * SPEED * dt); moved = true; }
  if (moved && now - lastSend > 100) { net.send('pos', { x: me.x, y: me.y }); lastSend = now; if (!dx && !dy) moved = false; }
  peers.forEach(p => { p.x = (p.x ?? p.tx) + (p.tx - (p.x ?? p.tx)) * Math.min(1, dt * 10); p.y = (p.y ?? p.ty) + (p.ty - (p.y ?? p.ty)) * Math.min(1, dt * 10); });
  render(dt); requestAnimationFrame(loop);
}
function step(dx, dy) { const free = (x, y) => !isSolid(tileAt(Math.floor(x + .5), Math.floor(y + .5)));
  if (free(me.x + dx, me.y)) me.x += dx; else if (target) target = null; if (free(me.x, me.y + dy)) me.y += dy; else if (target) target = null; }
function render(dt) {
  const th = THEMES[state.theme], m = state.map;
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, cv.width, cv.height);
  const mw = m.w * TS, mh = m.h * TS;
  cam.x = mw <= cv.width ? -(cv.width - mw) / 2 : clamp(me.x * TS + TS / 2 - cv.width / 2, 0, mw - cv.width);
  cam.y = mh <= cv.height ? -(cv.height - mh) / 2 : clamp(me.y * TS + TS / 2 - cv.height / 2, 0, mh - cv.height);
  ctx.save(); ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  ctx.font = `${TS - 6}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const em = (e, x, y, s = 1) => { ctx.font = `${(TS - 6) * s}px serif`; ctx.fillText(e, x * TS + TS / 2, y * TS + TS / 2 + 2); };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = m.rows[y][x];
    ctx.fillStyle = c === '#' ? th.wall : c === '~' ? th.water : c === 'R' ? th.rug : th.floor[(x + y) & 1];
    ctx.fillRect(x * TS, y * TS, TS, TS);
    if (c === 'T') em(th.tree, x, y, 1.1); else if (c === 'S') { ctx.fillStyle = '#000'; ctx.fillRect(x * TS, y * TS + 4, TS, TS - 8); }
    else if (c === '#' && (x + y) % 5 === 0) em(th.prop, x, y, .8);
  }
  state.decor.forEach(d => em(d.e, d.x, d.y));
  state.cards.forEach(c => em('💌', c.x, c.y, .9));
  const now = Date.now();
  const people = [...[...peers.entries()].map(([id, p]) => ({ id, ...p })), { id: net.selfId, ...me }].sort((a, b) => a.y - b.y);
  for (const p of people) {
    if (p.x === undefined) continue;
    em(p.avatar, p.x, p.y, 1.2);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText(p.name, p.x * TS + TS / 2, p.y * TS - 6); ctx.fillText(p.name, p.x * TS + TS / 2, p.y * TS - 6);
    if (p.bubble && p.bubbleUntil > now) { const w = Math.min(220, ctx.measureText(p.bubble).width + 16); ctx.fillStyle = '#fff'; ctx.fillRect(p.x * TS + TS / 2 - w / 2, p.y * TS - 36, w, 20); ctx.fillStyle = '#000'; ctx.fillText(p.bubble.slice(0, 32), p.x * TS + TS / 2, p.y * TS - 26); }
  }
  for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i], age = (now - f.t) / 1000; if (age > 2) { floaters.splice(i, 1); continue; }
    const p = f.who === net.selfId ? me : peers.get(f.who); if (p) { ctx.globalAlpha = 1 - age / 2; em(f.e, p.x, p.y - 1 - age, 1.4); ctx.globalAlpha = 1; } }
  ctx.restore();
  ctx.textAlign = 'center'; const pc = th.particles;
  for (const p of particles) { p.x += p.vx; p.y += p.vy; if (p.y > cv.height + 20 || p.x < -20 || p.x > cv.width + 20) Object.assign(p, newParticle(pc, false)); ctx.font = `${p.s}px serif`; ctx.globalAlpha = .8; ctx.fillText(p.e, p.x, p.y); }
  ctx.globalAlpha = 1;
}
