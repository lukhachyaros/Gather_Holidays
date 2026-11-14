// Room-synchronised seasonal community activities and lightweight browser minigames.
// No currency or competitive advantage is granted by these activities.
export const PHOTO_SPOT_IDS = ['snow_globe', 'rose_gate', 'moon_bridge', 'lantern_deck'];
export const PHOTO_ITEM_IDS = ['rose_locket', 'star_charm', 'moon_crystal', 'heart_ribbon'];
export const MANSION_KEY_IDS = ['candle', 'bat', 'pumpkin'];
export const MANSION_RIDDLE_SEQUENCE = ['moon', 'flame', 'star'];
export const CHRISTMAS_GIFT_IDS = ['gift_snow_cabin', 'gift_frozen_bridge', 'gift_cocoa_corner', 'gift_pine_lane', 'gift_sleigh_depot'];
export const HALLOWEEN_TREASURE_IDS = ['relic_graveyard', 'relic_haunted_well', 'relic_cemetery_gate', 'relic_witch_garden', 'relic_clocktower'];
export const TET_EXPLORATION_IDS = ['tet_explore_gate', 'tet_explore_lantern', 'tet_explore_market', 'tet_explore_boat', 'tet_explore_scroll'];
export function getCommunityTreeStage(contributionCount) {
  const count = Math.max(0, Math.min(24, Math.floor(Number(contributionCount) || 0)));
  return Math.min(5, 1 + Math.floor(count / 6));
}
export function canApplySeasonalEventOperation(isRoomHost, senderId, hostId) {
  return Boolean(hostId && (isRoomHost || senderId === hostId));
}
const DANCE_MOVES = ['left', 'right', 'up', 'down'];
const DANCE_MODES = [
  { id: 'rhythm', label: '🥁 Bắt nhịp', detail: 'Nhấn đúng hướng theo nhịp nhạc.' },
  { id: 'memory', label: '🧠 Ghi nhớ', detail: 'Xem chuỗi động tác rồi lặp lại khi ký hiệu biến mất.' },
  { id: 'copy', label: '🪞 Bắt chước', detail: 'Bắt chước chuỗi động tác đang hiện trên sàn.' },
];
const COSTUME_KEYS = ['default', 'frankenstein', 'zombie', 'vampire', 'witch', 'skeleton'];
const PHOTO_SPOTS = [
  { id: 'snow_globe', name: 'Cổng Ánh Sao', icon: '✨' },
  { id: 'rose_gate', name: 'Lối Hoa Hồng', icon: '🌹' },
  { id: 'moon_bridge', name: 'Cầu Trăng', icon: '🌙' },
  { id: 'lantern_deck', name: 'Sân Đèn Lồng', icon: '🏮' },
];
const COSTUMES = [
  { key: 'default', label: 'Trang phục tự chọn' },
  { key: 'frankenstein', label: 'Frankenstein' },
  { key: 'zombie', label: 'Zombie' },
  { key: 'vampire', label: 'Ma cà rồng' },
  { key: 'witch', label: 'Phù thủy' },
  { key: 'skeleton', label: 'Bộ xương' },
];

const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const safeId = value => {
  const id = String(value || '').slice(0, 96);
  return id && id !== '__proto__' && id !== 'constructor' && id !== 'prototype' ? id : '';
};
const safeName = value => String(value || 'Người chơi').replace(/[<>\u0000-\u001f]/g, '').slice(0, 24) || 'Người chơi';
const ensureList = (object, key) => {
  if (!Array.isArray(object[key])) object[key] = [];
  return object[key];
};
const findRecord = (list, id) => list.find(item => item && item.id === id);

export function createSeasonalEventsState() {
  return {
    christmas: { tree: { contributors: [] }, inventory: { players: [] }, sled: { records: [] }, gifts: { players: [] } },
    halloween: { mansion: { players: [], solved: [] }, costume: { entries: [], votes: [] }, treasure: { players: [] } },
    valentine: { photos: { players: [] }, dance: { records: [] } },
    tet: { exploration: { players: [] } },
  };
}

// Pure reducer used by the multiplayer op handler and automated tests.
// It intentionally stores no currency, inventory, admin privileges, or irreversible rewards.
export function applySeasonalEventOperation(state, op, senderId, senderName = 'Người chơi') {
  if (!isObject(state) || !isObject(op) || op.k !== 'seasonal_event') return false;
  const id = safeId(senderId);
  if (!id || state.kickedIds?.includes(id) || op.season !== state.theme) return false;
  const name = safeName(senderName);
  if (!isObject(state.seasonalEvents)) state.seasonalEvents = {};
  const root = state.seasonalEvents;
  if (!isObject(root[op.season])) root[op.season] = {};
  const season = root[op.season];
  const data = isObject(op.data) ? op.data : {};

  if (op.season === 'christmas' && op.action === 'gift_collect') {
    const giftId = String(data.giftId || '');
    if (!CHRISTMAS_GIFT_IDS.includes(giftId)) return false;
    if (!isObject(season.gifts)) season.gifts = {};
    const players = ensureList(season.gifts, 'players');
    let player = findRecord(players, id);
    if (!player) {
      if (players.length >= 100) return false;
      player = { id, name, gifts: [] };
      players.push(player);
    }
    if (!Array.isArray(player.gifts)) player.gifts = [];
    if (player.gifts.includes(giftId)) return false;
    player.name = name;
    player.gifts.push(giftId);
    return true;
  }

  if (op.season === 'halloween' && op.action === 'treasure_collect') {
    const treasureId = String(data.treasureId || '');
    if (!HALLOWEEN_TREASURE_IDS.includes(treasureId)) return false;
    if (!isObject(season.treasure)) season.treasure = {};
    const players = ensureList(season.treasure, 'players');
    let player = findRecord(players, id);
    if (!player) {
      if (players.length >= 100) return false;
      player = { id, name, relics: [] };
      players.push(player);
    }
    if (!Array.isArray(player.relics)) player.relics = [];
    if (player.relics.includes(treasureId)) return false;
    player.name = name;
    player.relics.push(treasureId);
    return true;
  }

  if (op.season === 'tet' && op.action === 'exploration_collect') {
    const itemId = String(data.itemId || '');
    if (!TET_EXPLORATION_IDS.includes(itemId)) return false;
    if (!isObject(season.exploration)) season.exploration = {};
    const players = ensureList(season.exploration, 'players');
    let player = findRecord(players, id);
    if (!player) {
      if (players.length >= 100) return false;
      player = { id, name, discoveries: [] };
      players.push(player);
    }
    if (!Array.isArray(player.discoveries)) player.discoveries = [];
    if (player.discoveries.includes(itemId)) return false;
    player.name = name;
    player.discoveries.push(itemId);
    return true;
  }

  if (op.season === 'christmas' && op.action === 'tree_contribute') {
    const decorationType = String(data.decorationType || 'bell');
    const ornamentKey = String(data.ornamentKey || '');
    const ornamentType = { star: 'star', bell: 'bell', cane: 'ribbon' }[ornamentKey];
    if (!['star', 'bell', 'ribbon'].includes(decorationType) || ornamentType !== decorationType) return false;
    if (!isObject(season.tree)) season.tree = {};
    const contributors = ensureList(season.tree, 'contributors');
    if (contributors.length >= 24 || findRecord(contributors, id)) return false;
    const typeCount = contributors.filter(item => item?.decorationType === decorationType).length;
    if (typeCount >= 8) return false;
    const inventory = ensureList(season.inventory ||= {}, 'players');
    const held = findRecord(inventory, id);
    if (held?.heldKey !== ornamentKey) return false;
    held.heldKey = null;
    contributors.push({ id, name, decorationType, ornamentKey, at: Date.now() });
    return true;
  }

  if (op.season === 'christmas' && ['ornament_pickup', 'ornament_spend'].includes(op.action)) {
    const ornamentKey = String(data.ornamentKey || '');
    if (!['star', 'bell', 'cane', 'ball_red', 'ball_gold', 'ball_blue', 'gift'].includes(ornamentKey)) return false;
    if (!isObject(season.inventory)) season.inventory = {};
    const players = ensureList(season.inventory, 'players');
    let player = findRecord(players, id);
    if (!player) { if (players.length >= 100) return false; player = { id, name, heldKey: null }; players.push(player); }
    if (op.action === 'ornament_pickup') {
      if (player.heldKey) return false;
      player.heldKey = ornamentKey;
    } else {
      if (player.heldKey !== ornamentKey) return false;
      player.heldKey = null;
    }
    player.name = name;
    return true;
  }

  if (op.season === 'christmas' && op.action === 'sled_record') {
    const timeMs = Number(data.timeMs);
    const gatesHit = Number(data.gatesHit);
    const shortcuts = Number(data.shortcuts ?? 0);
    const collisions = Number(data.collisions ?? 0);
    if (!Number.isFinite(timeMs) || timeMs < 5000 || timeMs > 300000) return false;
    if (!Number.isInteger(gatesHit) || gatesHit < 0 || gatesHit > 8) return false;
    if (!Number.isInteger(shortcuts) || shortcuts < 0 || shortcuts > gatesHit) return false;
    if (!Number.isInteger(collisions) || collisions < 0 || collisions > 8 || gatesHit + collisions !== 8) return false;
    if (!isObject(season.sled)) season.sled = {};
    const records = ensureList(season.sled, 'records');
    const previous = findRecord(records, id);
    const next = { id, name, timeMs: Math.round(timeMs), gatesHit, shortcuts, collisions, at: Date.now() };
    if (previous) {
      const better = gatesHit > previous.gatesHit ||
        (gatesHit === previous.gatesHit && shortcuts > (previous.shortcuts || 0)) ||
        (gatesHit === previous.gatesHit && shortcuts === (previous.shortcuts || 0) && collisions < (previous.collisions || 0)) ||
        (gatesHit === previous.gatesHit && shortcuts === (previous.shortcuts || 0) && collisions === (previous.collisions || 0) && timeMs < previous.timeMs);
      if (!better) return false;
      Object.assign(previous, next);
    } else {
      if (records.length >= 100) return false;
      records.push(next);
    }
    return true;
  }

  if (op.season === 'halloween' && op.action === 'mansion_key') {
    const keyId = String(data.keyId || '');
    if (!MANSION_KEY_IDS.includes(keyId)) return false;
    if (!isObject(season.mansion)) season.mansion = {};
    const players = ensureList(season.mansion, 'players');
    let record = findRecord(players, id);
    if (!record) {
      if (players.length >= 100) return false;
      record = { id, name, keys: [], at: Date.now() };
      players.push(record);
    }
    if (!Array.isArray(record.keys)) record.keys = [];
    if (record.keys.includes(keyId)) return false;
    record.name = name;
    record.keys.push(keyId);
    record.at = Date.now();
    return true;
  }

  if (op.season === 'halloween' && op.action === 'mansion_clear') {
    if (String(data.code || '') !== MANSION_RIDDLE_SEQUENCE.join('-')) return false;
    if (!isObject(season.mansion)) season.mansion = {};
    const players = ensureList(season.mansion, 'players');
    const player = findRecord(players, id);
    if (!MANSION_KEY_IDS.every(keyId => player?.keys?.includes(keyId))) return false;
    const solved = ensureList(season.mansion, 'solved');
    if (solved.length >= 100 || findRecord(solved, id)) return false;
    solved.push({ id, name, at: Date.now() });
    return true;
  }

  if (op.season === 'halloween' && op.action === 'costume_entry') {
    const costumeKey = String(data.costumeKey || '');
    if (!COSTUME_KEYS.includes(costumeKey)) return false;
    if (!isObject(season.costume)) season.costume = {};
    const entries = ensureList(season.costume, 'entries');
    const previous = findRecord(entries, id);
    const next = { id, name, costumeKey, at: Date.now() };
    if (previous) Object.assign(previous, next);
    else {
      if (entries.length >= 80) return false;
      entries.push(next);
    }
    return true;
  }

  if (op.season === 'halloween' && op.action === 'costume_vote') {
    const targetId = safeId(data.targetId);
    if (!targetId || targetId === id || !isObject(season.costume)) return false;
    const entries = ensureList(season.costume, 'entries');
    if (!findRecord(entries, targetId)) return false;
    const votes = ensureList(season.costume, 'votes');
    if (votes.length >= 100 || findRecord(votes, id)) return false;
    votes.push({ id, targetId, at: Date.now() });
    return true;
  }

  if (op.season === 'valentine' && op.action === 'photo_spot') {
    const spotId = String(data.spotId || '');
    if (!PHOTO_SPOT_IDS.includes(spotId)) return false;
    if (!isObject(season.photos)) season.photos = {};
    const players = ensureList(season.photos, 'players');
    let record = findRecord(players, id);
    if (!record) {
      if (players.length >= 100) return false;
      record = { id, name, spots: [], items: [], at: Date.now() };
      players.push(record);
    }
    record.name = name;
    if (!Array.isArray(record.spots)) record.spots = [];
    if (!Array.isArray(record.items)) record.items = [];
    if (record.spots.includes(spotId)) return false;
    record.spots.push(spotId);
    record.at = Date.now();
    return true;
  }

  if (op.season === 'valentine' && op.action === 'photo_item') {
    const itemId = String(data.itemId || '');
    if (!PHOTO_ITEM_IDS.includes(itemId)) return false;
    if (!isObject(season.photos)) season.photos = {};
    const players = ensureList(season.photos, 'players');
    let record = findRecord(players, id);
    if (!record) {
      if (players.length >= 100) return false;
      record = { id, name, spots: [], items: [], at: Date.now() };
      players.push(record);
    }
    if (!Array.isArray(record.items)) record.items = [];
    if (record.items.includes(itemId)) return false;
    record.name = name;
    record.items.push(itemId);
    record.at = Date.now();
    return true;
  }

  if (op.season === 'valentine' && op.action === 'dance_record') {
    const score = Number(data.score);
    const mode = String(data.mode || 'rhythm');
    if (!DANCE_MODES.some(item => item.id === mode) || !Number.isFinite(score) || !Number.isInteger(score) || score < 0 || score > 100) return false;
    if (!isObject(season.dance)) season.dance = {};
    const records = ensureList(season.dance, 'records');
    const previous = records.find(item => item?.id === id && (item.mode || 'rhythm') === mode);
    if (previous && score <= previous.score) return false;
    const next = { id, name, mode, score, at: Date.now() };
    if (previous) Object.assign(previous, next);
    else {
      if (records.length >= 100) return false;
      records.push(next);
    }
    return true;
  }

  return false;
}

export class SeasonalActivities {
  constructor({ getState, getSelfId, getPlayerName, emitOp, toast, onCostumeSubmit, onCapturePhoto, getHeldItem, consumeHeldItem, getAuthorityEnabled, getServerNow }) {
    this.getState = getState;
    this.getSelfId = getSelfId;
    this.getPlayerName = getPlayerName;
    this.emitOp = emitOp;
    this.toast = toast;
    this.onCostumeSubmit = onCostumeSubmit;
    this.onCapturePhoto = onCapturePhoto;
    this.getHeldItem = getHeldItem || (() => null);
    this.consumeHeldItem = consumeHeldItem || (() => {});
    this.getAuthorityEnabled = getAuthorityEnabled || (() => false);
    this.getServerNow = getServerNow || Date.now;
    this.photoShots = [];
    this.mansionRoomId = '';
    this.theme = null;
    this.active = null;
    this.race = null;
    this.mansionStep = 0;
    this.mansionPuzzle = [];
    this.raceFrame = 0;
    this.racePrompt = null;
    this.raceTimer = null;
    this.raceTimerFill = null;
    this.dance = null;
    this.danceFrame = 0;
    this.lastRaceResult = '';
    this.lastDanceScore = null;
    this.overlay = null;
    this.body = null;
    this.title = null;
    this.ensureOverlay();
  }

  ensureOverlay() {
    if (this.overlay || !document.body) return;
    const overlay = document.createElement('div');
    overlay.className = 'seasonal-overlay hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Hoạt động lễ hội');
    overlay.innerHTML =
      '<section class="seasonal-panel">' +
      '<header class="seasonal-header"><div><span class="seasonal-eyebrow">GATHER HOLIDAYS · COMMUNITY EVENT</span><h2 class="seasonal-title"></h2></div>' +
      '<button type="button" class="seasonal-close" data-action="close" aria-label="Đóng">✕</button></header>' +
      '<main class="seasonal-body"></main>' +
      '<footer class="seasonal-footer">Hoạt động cộng đồng · Phần thưởng chỉ mang tính trang trí</footer>' +
      '</section>';
    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        this.close();
        return;
      }
      const button = event.target.closest('[data-action]');
      if (!button || !overlay.contains(button)) return;
      this.handleAction(button.dataset.action, button.dataset);
    });
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.body = overlay.querySelector('.seasonal-body');
    this.title = overlay.querySelector('.seasonal-title');
    this.onActivityKeyDown = event => {
      if (this.overlay?.classList.contains('hidden') || event.target?.closest?.('input,textarea,select')) return;
      let handled = false;
      if (this.active === 'sled_race' && this.race) {
        const lanes = { ArrowLeft: 'left', ArrowUp: 'center', ArrowDown: 'center', ArrowRight: 'right' };
        if (lanes[event.key]) handled = this.chooseRace(lanes[event.key]);
      } else if (this.active === 'dance_stage' && this.dance) {
        const moves = {
          ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
          ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
        };
        const direction = moves[event.code] || moves[event.key];
        if (direction) { this.moveDance(direction); handled = true; }
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', this.onActivityKeyDown, true);
  }

  setTheme(theme) {
    const next = ['christmas', 'halloween', 'valentine', 'tet'].includes(theme) ? theme : null;
    if (next !== this.theme) this.close();
    this.theme = next;
    this.refresh();
  }

  open(activity) {
    const valid = {
      christmas: ['community_tree', 'sled_race', 'gift_hunt'],
      halloween: ['haunted_mansion', 'costume_runway', 'treasure_hunt'],
      valentine: ['photo_hunt', 'dance_stage'],
      tet: ['tet_exploration'],
    };
    if (!valid[this.theme]?.includes(activity)) return;
    this.ensureOverlay();
    if (!this.overlay) return;
    this.active = activity;
    this.race = null;
    this.mansionStep = 0;
    this.mansionPuzzle = [];
    this.dance = null;
    this.lastRaceResult = '';
    this.lastDanceScore = null;
    this.render();
    this.overlay.classList.remove('hidden');
  }

  close() {
    this.stopDance();
    if (this.raceFrame) cancelAnimationFrame(this.raceFrame);
    this.raceFrame = 0;
    this.racePrompt = null;
    this.raceTimer = null;
    this.raceTimerFill = null;
    this.race = null;
    this.active = null;
    this.overlay?.classList.add('hidden');
  }

  refresh() {
    if (this.active) this.render();
  }

  applyOperation(op, senderId) {
    const state = this.getState?.();
    const name = this.getPlayerName?.(senderId) || 'Người chơi';
    const changed = applySeasonalEventOperation(state, op, senderId, name);
    if (changed) this.refresh();
    return changed;
  }

  submit(action, data = {}) {
    const id = this.getSelfId?.();
    if (!id) {
      this.toast?.('Bạn cần vào phòng trước khi tham gia hoạt động.');
      return false;
    }
    return this.emitOp?.({ k: 'seasonal_event', season: this.theme, action, data }) ?? false;
  }

  takePhoto(label = 'Khoảnh khắc lễ hội') {
    let image = null;
    try { image = this.onCapturePhoto?.(); } catch {}
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      this.toast?.('📷 Chưa thể chụp ảnh lúc này. Hãy thử lại sau khi cảnh 3D tải xong.');
      return false;
    }
    this.photoShots.unshift({ image, label: String(label).slice(0, 48), at: new Date().toLocaleTimeString() });
    this.photoShots = this.photoShots.slice(0, 6);
    this.toast?.('📸 Đã chụp ảnh! Bạn có thể xem và tải ảnh trong bảng hoạt động.');
    this.refresh();
    return true;
  }

  renderPhotoGallery() {
    if (!this.photoShots.length) return;
    this.heading('📷 Album ảnh trên thiết bị này');
    const gallery = this.el('div', null, 'seasonal-photo-gallery');
    this.photoShots.forEach((shot, index) => {
      const card = this.el('div', null, 'seasonal-photo-card');
      const image = this.el('img', null, 'seasonal-photo-image');
      image.src = shot.image;
      image.alt = shot.label;
      image.loading = 'lazy';
      const caption = this.el('span', shot.label + ' · ' + shot.at, 'seasonal-photo-caption');
      const download = this.el('a', '⬇ Tải ảnh', 'seasonal-photo-download');
      download.href = shot.image;
      download.download = 'gather-holidays-' + (index + 1) + '.png';
      card.append(image, caption, download);
      gallery.appendChild(card);
    });
    this.body.appendChild(gallery);
  }

  capturePhotoSpot(spotId) {
    if (this.theme !== 'valentine' || !PHOTO_SPOT_IDS.includes(spotId)) return;
    const state = this.getState?.();
    const id = this.getSelfId?.();
    const record = state?.seasonalEvents?.valentine?.photos?.players?.find(item => item?.id === id);
    if (record?.spots?.includes(spotId)) {
      this.toast?.('📸 Bạn đã lưu góc chụp này rồi. Hãy tìm góc khác nhé!');
      return;
    }
    const spot = PHOTO_SPOTS.find(item => item.id === spotId);
    if (!this.takePhoto(spot?.name || 'Góc chụp Valentine')) return false;
    this.submit('photo_spot', { spotId });
    this.toast?.('📸 Đã ghi dấu góc chụp vào bộ sưu tập Valentine!');
  }

  collectMansionKey(keyId) {
    if (this.theme !== 'halloween' || !MANSION_KEY_IDS.includes(keyId)) return false;
    const player = this.myRecord(this.stateBucket('halloween', 'mansion', 'players'));
    if (player?.keys?.includes(keyId)) {
      this.toast?.('🗝️ Bạn đã tìm thấy chiếc chìa khóa này rồi.');
      return false;
    }
    return this.submit('mansion_key', { keyId });
  }

  collectPhotoItem(itemId) {
    if (this.theme !== 'valentine' || !PHOTO_ITEM_IDS.includes(itemId)) return false;
    const player = this.myRecord(this.stateBucket('valentine', 'photos', 'players'));
    if (player?.items?.includes(itemId)) {
      this.toast?.('💝 Bạn đã nhặt vật phẩm này rồi.');
      return false;
    }
    return this.submit('photo_item', { itemId });
  }

  stateBucket(season, key, listName) {
    const state = this.getState?.();
    const value = state?.seasonalEvents?.[season]?.[key]?.[listName];
    return Array.isArray(value) ? value : [];
  }

  stateValue(season, key, valueName) {
    return this.getState?.()?.seasonalEvents?.[season]?.[key]?.[valueName] ?? null;
  }

  serverRace() {
    const id = this.getSelfId?.();
    return this.stateBucket('christmas', 'sled', 'runs').find(run => run?.idOwner === id && run.active) || null;
  }

  myRecord(list) {
    const id = this.getSelfId?.();
    return list.find(item => item?.id === id) || null;
  }

  el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  button(label, action, data = {}, className = 'seasonal-button') {
    const node = this.el('button', label, className);
    node.type = 'button';
    node.dataset.action = action;
    Object.entries(data).forEach(([key, value]) => { node.dataset[key] = String(value); });
    return node;
  }

  heading(text) { this.body.appendChild(this.el('h3', text, 'seasonal-section-title')); }
  paragraph(text) { this.body.appendChild(this.el('p', text, 'seasonal-copy')); }

  render() {
    if (!this.body || !this.active) return;
    this.body.replaceChildren();
    const titles = {
      community_tree: '🎄 Cây Thông Cộng Đồng',
      sled_race: '🛷 Đường Đua Xe Trượt Tuyết',
      haunted_mansion: '🏚️ Dinh Thự Bí Ẩn',
      costume_runway: '🎭 Sàn Diễn Hóa Trang',
      photo_hunt: '📸 Photo Scavenger Hunt',
      mansion_room: '🚪 Phòng Bí Mật',
      dance_stage: '🎶 Sàn Nhảy Tương Tác',
      gift_hunt: '🎁 Hành Trình Tìm Quà Noel',
      treasure_hunt: '🎃 Kho Báu Thị Trấn Ma',
      tet_exploration: '🧧 Hành Trình Du Xuân',
    };
    this.title.textContent = titles[this.active] || 'Hoạt động lễ hội';
    if (this.active === 'community_tree') this.renderTree();
    else if (this.active === 'sled_race') this.renderSledRace();
    else if (this.active === 'haunted_mansion') this.renderMansion();
    else if (this.active === 'mansion_room') this.renderMansionRoom();
    else if (this.active === 'costume_runway') this.renderCostumeRunway();
    else if (this.active === 'photo_hunt') this.renderPhotoHunt();
    else if (this.active === 'dance_stage') this.renderDanceStage();
    else if (this.active === 'gift_hunt') this.renderCollectibleHunt('christmas', 'gifts');
    else if (this.active === 'treasure_hunt') this.renderCollectibleHunt('halloween', 'treasure');
    else if (this.active === 'tet_exploration') this.renderTetExploration();
  }

  renderCollectibleHunt(season, bucket) {
    const christmas = season === 'christmas';
    const items = christmas
      ? [['gift_snow_cabin', '🎁 Hộp quà dưới mái hiên'], ['gift_frozen_bridge', '🎁 Hộp quà bên cầu tuyết'], ['gift_cocoa_corner', '🎁 Hộp quà gần lửa trại'], ['gift_pine_lane', '✨ Quà vàng trong lối thông'], ['gift_sleigh_depot', '💎 Quà hiếm gần bến xe trượt']]
      : [['relic_graveyard', '🪙 Đồng xu nghĩa địa'], ['relic_haunted_well', '🧪 Bình sương ma'], ['relic_cemetery_gate', '🦇 Bùa dơi cổ'], ['relic_witch_garden', '💀 Đầu lâu pha lê'], ['relic_clocktower', '🕯️ Đèn lồng linh hồn']];
    const mine = this.myRecord(this.stateBucket(season, bucket, 'players'));
    const found = new Set(christmas ? mine?.gifts || [] : mine?.relics || []);
    this.paragraph(christmas
      ? 'Khám phá các góc của thị trấn để tìm quà thường, vàng và hiếm. Mỗi món được ghi nhận một lần cho mỗi người chơi.'
      : 'Lần theo các góc khuất để tìm di vật Halloween. Bộ sưu tập được chia sẻ trong room và không thể nhặt trùng.');
    this.body.appendChild(this.el('div', found.size + ' / ' + items.length + ' vật phẩm', 'seasonal-stat'));
    const meter = this.el('div', null, 'seasonal-progress');
    const fill = this.el('div', null, 'seasonal-progress-fill');
    fill.style.width = Math.round(found.size / items.length * 100) + '%';
    meter.appendChild(fill);
    this.body.appendChild(meter);
    const list = this.el('div', null, 'seasonal-list');
    items.forEach(([id, label]) => list.appendChild(this.el('div', (found.has(id) ? '✓ ' : '○ ') + label, 'seasonal-list-item' + (found.has(id) ? ' is-complete' : ''))));
    this.body.appendChild(list);
    const people = this.stateBucket(season, bucket, 'players');
    const completed = people.filter(player => (christmas ? player.gifts : player.relics)?.length === items.length).length;
    this.body.appendChild(this.el('p', '🏆 ' + completed + ' người đã hoàn thành bộ sưu tập.', 'seasonal-copy'));
  }

  collectChristmasGift(giftId) {
    if (this.theme !== 'christmas' || !CHRISTMAS_GIFT_IDS.includes(giftId)) return false;
    if (this.myRecord(this.stateBucket('christmas', 'gifts', 'players'))?.gifts?.includes(giftId)) return false;
    return this.submit('gift_collect', { giftId });
  }

  collectHalloweenTreasure(treasureId) {
    if (this.theme !== 'halloween' || !HALLOWEEN_TREASURE_IDS.includes(treasureId)) return false;
    if (this.myRecord(this.stateBucket('halloween', 'treasure', 'players'))?.relics?.includes(treasureId)) return false;
    return this.submit('treasure_collect', { treasureId });
  }

  renderTetExploration() {
    const labels = [
      ['tet_explore_gate', '🏮 Cổng làng đầu xuân'], ['tet_explore_lantern', '🧧 Dãy đèn lồng may mắn'],
      ['tet_explore_market', '🌸 Chợ hoa ngày Tết'], ['tet_explore_boat', '🚣 Bến thuyền du xuân'],
      ['tet_explore_scroll', '📜 Câu đối khai xuân'],
    ];
    const mine = this.myRecord(this.stateBucket('tet', 'exploration', 'players'));
    const found = new Set(mine?.discoveries || []);
    this.paragraph('Đi bộ qua năm địa danh trong hội xuân. Mỗi dấu ấn mở rộng nhật ký du xuân của bạn và được đồng bộ trong phòng.');
    this.body.appendChild(this.el('div', found.size + ' / ' + labels.length + ' địa danh đã khám phá', 'seasonal-stat'));
    const meter = this.el('div', null, 'seasonal-progress');
    const fill = this.el('div', null, 'seasonal-progress-fill');
    fill.style.width = Math.round(found.size / labels.length * 100) + '%';
    meter.appendChild(fill);
    this.body.appendChild(meter);
    const list = this.el('div', null, 'seasonal-list');
    labels.forEach(([id, label]) => list.appendChild(this.el('div', (found.has(id) ? '✓ ' : '○ ') + label, 'seasonal-list-item' + (found.has(id) ? ' is-complete' : ''))));
    this.body.appendChild(list);
    if (found.size === labels.length) this.body.appendChild(this.el('p', '🎊 Bạn đã khám phá trọn vẹn hội xuân!', 'seasonal-result'));
  }

  collectTetDiscovery(itemId) {
    if (this.theme !== 'tet' || !TET_EXPLORATION_IDS.includes(itemId)) return false;
    if (this.myRecord(this.stateBucket('tet', 'exploration', 'players'))?.discoveries?.includes(itemId)) return false;
    return this.submit('exploration_collect', { itemId });
  }

  renderTree() {
    const contributors = this.stateBucket('christmas', 'tree', 'contributors');
    const mine = this.myRecord(contributors);
    const heldItem = this.myRecord(this.stateBucket('christmas', 'inventory', 'players'))?.heldKey || this.getHeldItem?.();
    const heldType = { star: 'star', bell: 'bell', cane: 'ribbon' }[heldItem] || '';
    const types = [
      { id: 'star', label: '🌟 Ngôi sao', hint: 'Ánh sáng trên đỉnh cây' },
      { id: 'bell', label: '🔔 Chuông', hint: 'Âm thanh mùa lễ hội' },
      { id: 'ribbon', label: '🎀 Ruy băng', hint: 'Dải màu quấn quanh cành' },
    ];
    const counts = Object.fromEntries(types.map(type => [type.id, contributors.filter(item => item?.decorationType === type.id).length]));
    const total = contributors.length;
    const stage = getCommunityTreeStage(total);
    const stageNames = ['Cây non', 'Dây đèn', 'Quả châu & ruy băng', 'Ánh sáng lễ hội', 'Cây thông rực rỡ'];
    const complete = types.every(type => counts[type.id] >= 8);
    const progress = Math.min(100, Math.round(total / 24 * 100));
    this.paragraph('Lấy một món ở bàn đồ trang trí rồi mang đến cây thông cộng đồng. Cả phòng cần góp đủ 8 ngôi sao, 8 chuông và 8 kẹo gậy (tính như ruy băng). Mỗi người chỉ góp một món; vật phẩm sẽ bị tiêu thụ khi đóng góp.');
    this.body.appendChild(this.el('div', heldItem ? '🎒 Đang cầm: ' + heldItem : '🎒 Chưa có đồ trang trí · Hãy ghé bàn đồ trang trí', 'seasonal-stat'));
    const meter = this.el('div', null, 'seasonal-progress');
    const fill = this.el('div', null, 'seasonal-progress-fill');
    fill.style.width = progress + '%';
    meter.appendChild(fill);
    this.body.appendChild(meter);
    this.body.appendChild(this.el('p', total + ' / 24 món trang trí · ' + progress + '%', 'seasonal-stat'));
    this.body.appendChild(this.el('p', 'Giai đoạn ' + stage + ' / 5 · ' + stageNames[stage - 1], 'seasonal-result'));
    const options = this.el('div', null, 'seasonal-actions seasonal-tree-options');
    types.forEach(type => {
      const button = this.button(type.label + ' · ' + counts[type.id] + '/8', 'tree-contribute', { decorationType: type.id }, 'seasonal-button seasonal-primary');
      button.title = type.hint;
      button.disabled = !!mine || counts[type.id] >= 8 || complete || heldType !== type.id;
      options.appendChild(button);
    });
    this.body.appendChild(options);
    if (mine) this.body.appendChild(this.el('p', '✓ Bạn đã góp ' + (types.find(type => type.id === mine.decorationType)?.label || 'một món trang trí') + '. Cảm ơn bạn!', 'seasonal-result'));
    if (complete) this.body.appendChild(this.el('p', '🎄 Cây thông đã hoàn thành! Cả phòng đã phối hợp đủ ba loại trang trí.', 'seasonal-result'));
    this.heading('Người tham gia');
    const list = this.el('div', null, 'seasonal-list');
    const icons = { star: '🌟', bell: '🔔', ribbon: '🎀' };
    contributors.slice(-12).reverse().forEach(item => list.appendChild(this.el('div', (icons[item.decorationType] || '🎄') + ' ' + item.name, 'seasonal-list-item')));
    if (!contributors.length) list.appendChild(this.el('div', 'Cây đang chờ những món trang trí đầu tiên.', 'seasonal-empty'));
    this.body.appendChild(list);
  }

  renderSledRace() {
    if (this.getAuthorityEnabled?.()) this.race = this.serverRace();
    const records = this.stateBucket('christmas', 'sled', 'records').slice()
      .sort((a, b) => (b.gatesHit - a.gatesHit) || ((b.shortcuts || 0) - (a.shortcuts || 0)) ||
        ((a.collisions || 0) - (b.collisions || 0)) || (a.timeMs - b.timeMs));
    this.paragraph('Đây là lượt đua phản xạ: mỗi cổng chỉ mở trong 1,45 giây. Chọn làn an toàn để giữ nhịp, chớp đường tắt để rút thời gian, hoặc né chướng ngại. Có thể dùng ← ↑ → trên bàn phím hoặc chạm nút.');
    if (this.race) {
      this.racePrompt = this.el('div', 'CỔNG ' + (this.race.step + 1) + ' / 8', 'seasonal-stat');
      this.body.appendChild(this.racePrompt);
      this.raceTimer = this.el('div', null, 'seasonal-race-timer');
      this.raceTimerFill = this.el('div', null, 'seasonal-race-timer-fill');
      this.raceTimer.appendChild(this.raceTimerFill);
      this.body.appendChild(this.raceTimer);
      this.body.appendChild(this.el('div', '❄️ An toàn · ⚡ Đường tắt · 🪨 Chướng ngại', 'seasonal-race-cue'));
      const gate = this.race.currentGate || this.race.sequence?.[this.race.step];
      if (!gate) return;
      const row = this.el('div', null, 'seasonal-track-grid');
      [
        { id: 'left', label: 'TRÁI' },
        { id: 'center', label: 'GIỮA' },
        { id: 'right', label: 'PHẢI' },
      ].forEach(lane => {
        const kind = lane.id === gate.shortcutLane ? 'shortcut' : lane.id === gate.safeLane ? 'safe' : 'obstacle';
        const symbol = kind === 'shortcut' ? '⚡' : kind === 'safe' ? '❄️' : '🪨';
        const label = kind === 'shortcut' ? 'TĂNG TỐC' : kind === 'safe' ? 'AN TOÀN' : 'NÉ NGAY';
        row.appendChild(this.button(symbol + '\n' + lane.label + '\n' + label, 'race-choice', { lane: lane.id }, 'seasonal-button seasonal-lane seasonal-lane-' + kind));
      });
      this.body.appendChild(row);
      this.body.appendChild(this.el('p', 'Qua cổng: ' + this.race.gatesHit + ' · Đường tắt: ' + this.race.shortcuts + ' · Va chạm: ' + this.race.collisions, 'seasonal-copy'));
    } else {
      if (this.lastRaceResult) this.body.appendChild(this.el('p', this.lastRaceResult, 'seasonal-result'));
      this.body.appendChild(this.button('🏁 Bắt đầu lượt đua', 'race-start', {}, 'seasonal-button seasonal-primary'));
    }
    this.heading('Bảng xếp hạng đường đua');
    const list = this.el('div', null, 'seasonal-list');
    records.slice(0, 8).forEach((record, index) => {
      list.appendChild(this.el('div', (index + 1) + '. ' + record.name + ' · ' + record.gatesHit + '/8 · ⚡ ' + (record.shortcuts || 0) + ' · 🪨 ' + (record.collisions || 0) + ' · ' + (record.timeMs / 1000).toFixed(2) + 's', 'seasonal-list-item'));
    });
    if (!records.length) list.appendChild(this.el('div', 'Chưa có lượt đua nào được ghi nhận.', 'seasonal-empty'));
    this.body.appendChild(list);
  }

  startRace() {
    if (this.getAuthorityEnabled?.()) {
      const result = this.submit('sled_start');
      if (result?.then) result.then(accepted => {
        if (!accepted) return;
        this.race = this.serverRace();
        this.render();
        if (this.race) this.tickRace();
      });
      return;
    }
    if (this.raceFrame) cancelAnimationFrame(this.raceFrame);
    const lanes = ['left', 'center', 'right'];
    const sequence = Array.from({ length: 8 }, () => {
      const shortcutIndex = Math.floor(Math.random() * 3);
      let safeIndex = Math.floor(Math.random() * 2);
      if (safeIndex >= shortcutIndex) safeIndex++;
      const obstacleIndex = 3 - shortcutIndex - safeIndex;
      return { shortcutLane: lanes[shortcutIndex], safeLane: lanes[safeIndex], obstacleLane: lanes[obstacleIndex] };
    });
    this.race = {
      sequence, step: 0, gatesHit: 0, shortcuts: 0, collisions: 0,
      penaltyMs: 0, bonusMs: 0, startedAt: performance.now(),
      gateStartedAt: performance.now(), gateDurationMs: 1450,
    };
    this.lastRaceResult = '';
    this.render();
    this.tickRace();
  }

  tickRace() {
    if (!this.race) return;
    if (this.getAuthorityEnabled?.()) {
      this.race = this.serverRace();
      if (!this.race) { this.raceFrame = 0; this.refresh(); return; }
      const now = this.getServerNow();
      const untilStart = this.race.startAt - now;
      const remaining = this.race.startAt + (this.race.step + 1) * 1450 - now;
      if (this.racePrompt) this.racePrompt.textContent = untilStart > 0
        ? 'CHUẨN BỊ XUẤT PHÁT · ' + (untilStart / 1000).toFixed(1) + ' giây'
        : 'CỔNG ' + Math.min(8, this.race.step + 1) + ' / 8 · ' + Math.max(0, remaining / 1000).toFixed(1) + ' giây';
      if (this.raceTimerFill) this.raceTimerFill.style.width = untilStart > 0 ? '100%' : Math.max(0, Math.min(100, remaining / 1450 * 100)) + '%';
      this.raceFrame = requestAnimationFrame(() => this.tickRace());
      return;
    }
    const remaining = this.race.gateDurationMs - (performance.now() - this.race.gateStartedAt);
    if (remaining <= 0) {
      this.race.collisions++;
      this.race.penaltyMs += 1450;
      this.advanceRace();
      return;
    }
    if (this.racePrompt) this.racePrompt.textContent = 'CỔNG ' + (this.race.step + 1) + ' / 8 · ' + (remaining / 1000).toFixed(1) + ' giây';
    if (this.raceTimerFill) this.raceTimerFill.style.width = Math.max(0, remaining / this.race.gateDurationMs * 100) + '%';
    this.raceFrame = requestAnimationFrame(() => this.tickRace());
  }

  chooseRace(lane) {
    if (!this.race || !['left', 'center', 'right'].includes(lane)) return false;
    if (this.getAuthorityEnabled?.()) {
      const result = this.submit('sled_checkpoint', { runId: this.race.id, lane });
      if (result?.then) result.then(accepted => {
        if (!accepted) return;
        this.race = this.serverRace();
        this.render();
        if (this.race) this.tickRace();
      });
      return true;
    }
    if (performance.now() - this.race.gateStartedAt > this.race.gateDurationMs) return false;
    const gate = this.race.sequence[this.race.step];
    if (lane === gate.obstacleLane) {
      this.race.collisions++;
      this.race.penaltyMs += 1250;
    } else {
      this.race.gatesHit++;
      if (lane === gate.shortcutLane) {
        this.race.shortcuts++;
        this.race.bonusMs += 450;
      }
    }
    this.advanceRace();
    return true;
  }

  advanceRace() {
    if (!this.race) return;
    this.race.step++;
    if (this.race.step >= this.race.sequence.length) {
      this.finishRace();
      return;
    }
    this.race.gateStartedAt = performance.now();
    this.render();
    this.tickRace();
  }

  finishRace() {
    if (!this.race) return;
    const timeMs = Math.max(5000, Math.min(300000, performance.now() - this.race.startedAt + this.race.penaltyMs - this.race.bonusMs));
    const { gatesHit, shortcuts, collisions } = this.race;
    if (this.raceFrame) cancelAnimationFrame(this.raceFrame);
    this.raceFrame = 0;
    this.submit('sled_record', { timeMs, gatesHit, shortcuts, collisions });
    this.lastRaceResult = '🏁 Hoàn thành! ' + gatesHit + '/8 cổng · ' + shortcuts + ' đường tắt · ' + collisions + ' va chạm · ' + (timeMs / 1000).toFixed(2) + ' giây.';
    this.race = null;
    this.render();
  }

  renderMansion() {
    const solved = this.stateBucket('halloween', 'mansion', 'solved');
    const players = this.stateBucket('halloween', 'mansion', 'players');
    const mine = this.myRecord(players);
    const keys = Array.isArray(mine?.keys) ? mine.keys : [];
    const complete = !!this.myRecord(solved);
    const clues = [
      ['candle', '🕯️ Chìa Nến', 'Tìm nơi ánh sáng vàng hắt lên bức tường cũ.'],
      ['bat', '🦇 Chìa Dơi', 'Lắng nghe tiếng cánh đập quanh hành lang phía đông.'],
      ['pumpkin', '🎃 Chìa Bí Ngô', 'Một vật phát sáng đang chờ gần khu vườn bí ngô.'],
    ];
    this.paragraph('Ba chìa khóa được giấu quanh khuôn viên dinh thự. Hãy rời bảng nhiệm vụ, khám phá các góc khuất và nhấn [E] khi thấy vật phẩm phát sáng. Thu thập đủ chìa khóa để mở ba căn phòng bí mật.');
    this.body.appendChild(this.el('div', keys.length + ' / 3 chìa khóa đã tìm thấy', 'seasonal-stat'));
    clues.forEach(([id, title, clue]) => {
      const found = keys.includes(id);
      const row = this.el('div', null, 'seasonal-collectible-row' + (found ? ' is-complete' : ''));
      row.appendChild(this.el('strong', (found ? '✓ ' : '○ ') + title, 'seasonal-collectible-title'));
      row.appendChild(this.el('span', found ? 'Đã thu thập' : clue, 'seasonal-collectible-hint'));
      this.body.appendChild(row);
    });
    if (complete) {
      this.body.appendChild(this.el('p', '🔓 Bạn đã mở được cả ba căn phòng bí mật!', 'seasonal-result'));
      this.heading('🚪 Chọn phòng để khám phá');
      const rooms = this.el('div', null, 'seasonal-actions');
      [
        ['candle', '🕯️ Phòng Nến'],
        ['bat', '🦇 Phòng Dơi'],
        ['pumpkin', '🎃 Hầm Bí Ngô'],
      ].forEach(([id, label]) => rooms.appendChild(this.button(label, 'mansion-room', { roomId: id }, 'seasonal-button seasonal-primary')));
      this.body.appendChild(rooms);
    } else if (MANSION_KEY_IDS.every(keyId => keys.includes(keyId))) {
      this.heading('🧩 Câu đố trên cánh cửa');
      this.paragraph('Ba dòng khắc trên cửa: “Trăng dẫn lối khi đêm xuống. Ngọn lửa soi đường vào trong. Ngôi sao khép lại điều ước.” Chọn đúng thứ tự ba biểu tượng; chọn sai sẽ phải thử lại.');
      const symbolLabel = { moon: '🌙', flame: '🔥', star: '⭐' };
      this.body.appendChild(this.el('p', 'Mật mã: ' + this.mansionPuzzle.map(symbol => symbolLabel[symbol]).join('  ') + ' · ' + this.mansionPuzzle.length + '/3', 'seasonal-stat'));
      const symbols = this.el('div', null, 'seasonal-actions seasonal-symbols');
      [['moon', '🌙 Trăng'], ['flame', '🔥 Lửa'], ['star', '⭐ Sao'], ['bat', '🦇 Dơi'], ['pumpkin', '🎃 Bí ngô']]
        .forEach(([symbol, label]) => symbols.appendChild(this.button(label, 'mansion-symbol', { symbol }, 'seasonal-button seasonal-small')));
      this.body.appendChild(symbols);
    } else this.body.appendChild(this.el('p', 'Hãy tìm đủ 3 chìa khóa ngoài bản đồ rồi quay lại đây.', 'seasonal-copy'));
    this.heading('Nhà thám hiểm');
    const list = this.el('div', null, 'seasonal-list');
    solved.slice(-8).reverse().forEach(item => list.appendChild(this.el('div', '🔓 ' + item.name + ' · đã mở dinh thự', 'seasonal-list-item')));
    if (!solved.length) list.appendChild(this.el('div', 'Chưa có ai mở được các căn phòng bí mật.', 'seasonal-empty'));
    this.body.appendChild(list);
  }

  renderMansionRoom() {
    const rooms = {
      candle: ['🕯️ Phòng Nến', 'Những ngọn nến cổ đồng loạt thắp sáng. Trên tường hiện ra bản đồ bí mật của dinh thự.'],
      bat: ['🦇 Phòng Dơi', 'Một thư viện tối mở ra. Những trang nhật ký kể lại lịch sử của dinh thự và lối đi ẩn dưới tháp phía đông.'],
      pumpkin: ['🎃 Hầm Bí Ngô', 'Cánh cửa đá mở ra kho báu trang trí: bí ngô phát sáng, dải ruy băng và một góc chụp ma mị.'],
    };
    const room = rooms[this.mansionRoomId];
    if (!room || !this.myRecord(this.stateBucket('halloween', 'mansion', 'solved'))) {
      this.active = 'haunted_mansion';
      this.render();
      return;
    }
    this.title.textContent = room[0];
    this.paragraph(room[1]);
    this.body.appendChild(this.el('div', '✨ Căn phòng đã được mở khóa cho bạn trong phiên chơi này.', 'seasonal-result'));
    this.body.appendChild(this.button('← Quay lại dinh thự', 'mansion-back'));
  }

  chooseMansionSymbol(symbol) {
    if (!MANSION_RIDDLE_SEQUENCE.includes(symbol) || this.mansionPuzzle.length >= 3) return;
    const expected = MANSION_RIDDLE_SEQUENCE[this.mansionPuzzle.length];
    if (symbol !== expected) {
      this.mansionPuzzle = [];
      this.toast?.('🧩 Sai thứ tự rồi. Đọc lại ba gợi ý và thử lại nhé!');
      this.render();
      return;
    }
    this.mansionPuzzle.push(symbol);
    if (this.mansionPuzzle.length === MANSION_RIDDLE_SEQUENCE.length) {
      this.submit('mansion_clear', { code: MANSION_RIDDLE_SEQUENCE.join('-') });
      this.toast?.('🔓 Mật mã chính xác! Đang mở các căn phòng bí mật…');
    }
    this.render();
  }

  openMansionRoom(roomId) {
    if (!['candle', 'bat', 'pumpkin'].includes(roomId)) return;
    if (!this.myRecord(this.stateBucket('halloween', 'mansion', 'solved'))) {
      this.toast?.('🔒 Hãy tìm đủ ba chìa khóa và mở dinh thự trước.');
      return;
    }
    this.mansionRoomId = roomId;
    this.active = 'mansion_room';
    this.render();
  }

  renderCostumeRunway() {
    const round = this.stateValue('halloween', 'costume', 'round');
    const allEntries = this.stateBucket('halloween', 'costume', 'entries');
    const entries = round?.participantIds ? allEntries.filter(entry => round.participantIds.includes(entry.id)) : allEntries;
    const allVotes = this.stateBucket('halloween', 'costume', 'votes');
    const votes = this.getAuthorityEnabled?.() && round ? allVotes.filter(vote => vote.roundId === round.id) : allVotes;
    const id = this.getSelfId?.();
    const mine = this.myRecord(entries);
    const myVote = this.myRecord(votes);
    this.paragraph(this.getAuthorityEnabled?.()
      ? 'Đăng ký trang phục trước khi chủ phòng mở phiên. Khi sân khấu bắt đầu, khán giả có 45 giây để bỏ một phiếu; server khóa phiếu khi hết giờ.'
      : 'Chọn một bộ trang phục, bước lên sân khấu và gửi bài dự thi. Mỗi người có một phiếu bình chọn; không thể tự bình chọn cho mình.');
    const label = this.el('label', 'Trang phục dự thi', 'seasonal-label');
    const select = this.el('select', null, 'seasonal-select');
    COSTUMES.forEach(item => {
      const option = this.el('option', item.label);
      option.value = item.key;
      select.appendChild(option);
    });
    select.value = mine?.costumeKey || 'default';
    label.appendChild(select);
    this.body.appendChild(label);
    const submit = this.button(mine ? '↻ Cập nhật trang phục' : '✨ Gửi bài dự thi', 'costume-submit');
    if (this.getAuthorityEnabled?.() && round && round.status !== 'complete') submit.disabled = true;
    this.body.appendChild(submit);
    this.body.appendChild(this.el('p', entries.length + ' bài dự thi · ' + votes.length + ' lượt bình chọn', 'seasonal-stat'));
    if (this.getAuthorityEnabled?.()) {
      if (round?.status === 'ready') this.body.appendChild(this.el('p', '⏳ Sân khấu mở sau ' + Math.ceil(round.remainingMs / 1000) + ' giây.', 'seasonal-result'));
      else if (round?.status === 'voting') this.body.appendChild(this.el('p', '🗳️ Đang bình chọn · còn ' + Math.ceil(round.remainingMs / 1000) + ' giây.', 'seasonal-result'));
      else if (round?.status === 'complete') this.body.appendChild(this.el('p', '🏆 Phiên đã kết thúc. Có thể đăng ký lượt tiếp theo.', 'seasonal-result'));
      if (!round || round.status === 'complete') {
        const start = this.button('🎬 Mở phiên bình chọn · Chủ phòng', 'costume-round-start', {}, 'seasonal-button seasonal-primary');
        start.disabled = entries.length < 2;
        start.title = entries.length < 2 ? 'Cần ít nhất hai bài dự thi.' : '';
        this.body.appendChild(start);
      }
    }
    this.body.appendChild(this.button('📸 Chụp ảnh trên sàn diễn', 'costume-photo', {}, 'seasonal-button seasonal-primary'));
    this.heading('Sân khấu & bình chọn');
    const list = this.el('div', null, 'seasonal-list');
    entries.forEach(entry => {
      const card = this.el('div', null, 'seasonal-contest-entry');
      card.appendChild(this.el('div', entry.name + ' · ' + (COSTUMES.find(item => item.key === entry.costumeKey)?.label || entry.costumeKey), 'seasonal-list-item'));
      const count = votes.filter(vote => vote.targetId === entry.id).length;
      card.appendChild(this.el('span', '⭐ ' + count + ' phiếu', 'seasonal-vote-count'));
      if (entry.id !== id && !myVote) {
        const vote = this.button('Bình chọn', 'costume-vote', { targetId: entry.id }, 'seasonal-button seasonal-small');
        if (this.getAuthorityEnabled?.() && round?.status !== 'voting') vote.disabled = true;
        card.appendChild(vote);
      }
      list.appendChild(card);
    });
    if (!entries.length) list.appendChild(this.el('div', 'Chưa có bài dự thi. Hãy mở màn lễ hội!', 'seasonal-empty'));
    this.body.appendChild(list);
    if (myVote) this.body.appendChild(this.el('p', '✓ Bạn đã gửi bình chọn. Cảm ơn bạn!', 'seasonal-result'));
    this.renderPhotoGallery();
  }

  renderPhotoHunt() {
    const players = this.stateBucket('valentine', 'photos', 'players');
    const mine = this.myRecord(players);
    const found = Array.isArray(mine?.spots) ? mine.spots : [];
    const items = Array.isArray(mine?.items) ? mine.items : [];
    const total = PHOTO_SPOTS.length + PHOTO_ITEM_IDS.length;
    const progress = found.length + items.length;
    this.paragraph('Khám phá bốn góc chụp và bốn vật phẩm kỷ niệm được giấu trong khu vườn Valentine. Đứng gần từng điểm hoặc vật phẩm rồi nhấn [E] để ghi dấu vào bộ sưu tập.');
    this.body.appendChild(this.el('div', progress + ' / ' + total + ' dấu mốc đã khám phá', 'seasonal-stat'));
    const meter = this.el('div', null, 'seasonal-progress');
    const fill = this.el('div', null, 'seasonal-progress-fill');
    fill.style.width = Math.round((progress / total) * 100) + '%';
    meter.appendChild(fill);
    this.body.appendChild(meter);
    this.heading('📸 Góc chụp kỷ niệm');
    const spots = this.el('div', null, 'seasonal-list');
    PHOTO_SPOTS.forEach(spot => {
      const done = found.includes(spot.id);
      spots.appendChild(this.el('div', (done ? '✓ ' : '○ ') + spot.icon + ' ' + spot.name, 'seasonal-list-item' + (done ? ' is-complete' : '')));
    });
    this.body.appendChild(spots);
    this.heading('💎 Vật phẩm ẩn');
    const itemNames = [
      ['rose_locket', '🌹 Mặt Dây Hoa Hồng'],
      ['star_charm', '⭐ Bùa Sao Lấp Lánh'],
      ['moon_crystal', '🌙 Pha Lê Ánh Trăng'],
      ['heart_ribbon', '🎀 Dải Ruy Băng Trái Tim'],
    ];
    const hidden = this.el('div', null, 'seasonal-list');
    itemNames.forEach(([id, name]) => {
      const done = items.includes(id);
      hidden.appendChild(this.el('div', (done ? '✓ ' : '○ ') + name, 'seasonal-list-item' + (done ? ' is-complete' : '')));
    });
    this.body.appendChild(hidden);
    if (progress === total) this.body.appendChild(this.el('p', '💗 Bạn đã hoàn thành toàn bộ Photo Scavenger Hunt!', 'seasonal-result'));
    this.heading('Tiến độ cộng đồng');
    const completed = players.filter(player => player.spots?.length === PHOTO_SPOTS.length && player.items?.length === PHOTO_ITEM_IDS.length).length;
    this.body.appendChild(this.el('p', completed + ' người đã hoàn thành trọn bộ sưu tập.', 'seasonal-copy'));
    this.renderPhotoGallery();
  }

  renderDanceStage() {
    if (this.getAuthorityEnabled?.()) this.dance = this.serverDance();
    const records = this.stateBucket('valentine', 'dance', 'records').slice().sort((a, b) => b.score - a.score);
    const roomScore = records.reduce((sum, record) => sum + (Number(record.score) || 0), 0);
    this.paragraph('Bắt chước 8 động tác theo nhịp: trái, phải, lên hoặc xuống. Chọn đúng hướng và đúng thời điểm để ghi điểm. Tổng điểm tốt nhất của mọi người tạo thành thử thách cộng đồng của căn phòng.');
    this.body.appendChild(this.el('div', '🤝 Điểm cộng đồng: ' + roomScore + ' · ' + records.length + ' người tham gia', 'seasonal-stat'));
    if (this.dance) {
      this.dancePrompt = this.el('div', 'Sẵn sàng…', 'seasonal-race-cue');
      this.body.appendChild(this.dancePrompt);
      this.danceCue = this.el('div', '🎵', 'seasonal-dance-cue');
      this.body.appendChild(this.danceCue);
      this.danceScoreLabel = this.el('p', 'Điểm: 0 / 100', 'seasonal-stat');
      this.body.appendChild(this.danceScoreLabel);
      const moves = this.el('div', null, 'seasonal-move-grid');
      [['left', '⬅️ Trái'], ['right', '➡️ Phải'], ['up', '⬆️ Lên'], ['down', '⬇️ Xuống']]
        .forEach(([direction, label]) => moves.appendChild(this.button(label, 'dance-move', { direction }, 'seasonal-button seasonal-move')));
      this.body.appendChild(moves);
    } else {
      if (this.lastDanceScore !== null) this.body.appendChild(this.el('p', '🎶 Lượt vừa rồi: ' + this.lastDanceScore + '/100 điểm.', 'seasonal-result'));
      DANCE_MODES.forEach(mode => {
        const card = this.el('div', null, 'seasonal-dance-mode');
        card.append(this.el('strong', mode.label), this.el('span', mode.detail));
        card.appendChild(this.button('▶ Chơi chế độ này', 'dance-start', { mode: mode.id }, 'seasonal-button seasonal-primary'));
        this.body.appendChild(card);
      });
    }
    if (this.getAuthorityEnabled?.()) {
      const assignments = this.stateBucket('valentine', 'dance', 'teamAssignments');
      const team = this.stateValue('valentine', 'dance', 'teamSession');
      const active = team && ['ready', 'playing'].includes(team.status);
      const countA = assignments.filter(item => item.team === 'A').length;
      const countB = assignments.filter(item => item.team === 'B').length;
      this.heading('Đấu đội đồng bộ');
      this.body.appendChild(this.el('p', 'Chia đều người chơi vào Đội A và Đội B. Server phát cùng nhịp cho cả phòng, tính điểm từng người và cộng điểm đội.', 'seasonal-copy'));
      const teams = this.el('div', null, 'seasonal-actions');
      [['A', countA], ['B', countB]].forEach(([teamId, count]) => {
        const join = this.button('Vào Đội ' + teamId + ' · ' + count, 'dance-team-join', { team: teamId }, 'seasonal-button seasonal-primary');
        join.disabled = !!active;
        teams.appendChild(join);
      });
      this.body.appendChild(teams);
      if (!active) {
        const start = this.button('▶ Chủ phòng bắt đầu đấu đội', 'dance-team-start', {}, 'seasonal-button seasonal-primary');
        start.disabled = countA < 1 || countA !== countB;
        this.body.appendChild(start);
      }
      if (team) {
        this.body.appendChild(this.el('div', 'Đội A ' + (team.teamScores?.A || 0) + ' điểm · Đội B ' + (team.teamScores?.B || 0) + ' điểm', 'seasonal-stat'));
        if (team.status === 'ready') this.body.appendChild(this.el('p', 'Đồng bộ bắt đầu sau ' + Math.ceil((team.startAt - this.getServerNow()) / 1000) + ' giây.', 'seasonal-result'));
        if (team.status === 'playing') {
          const symbols = { left: '⬅️', right: '➡️', up: '⬆️', down: '⬇️' };
          this.body.appendChild(this.el('div', 'NHỊP ' + symbols[team.currentCue], 'seasonal-dance-cue'));
          const moves = this.el('div', null, 'seasonal-move-grid');
          [['left', '⬅️ Trái'], ['right', '➡️ Phải'], ['up', '⬆️ Lên'], ['down', '⬇️ Xuống']]
            .forEach(([direction, label]) => moves.appendChild(this.button(label, 'dance-team-move', { direction, sessionId: team.id }, 'seasonal-button seasonal-move')));
          this.body.appendChild(moves);
        }
        const participants = this.el('div', null, 'seasonal-list');
        (team.participants || []).slice().sort((a, b) => a.team.localeCompare(b.team) || b.score - a.score).forEach(player => {
          participants.appendChild(this.el('div', 'Đội ' + player.team + ' · ' + player.name + ' · ' + player.score + '/100', 'seasonal-list-item'));
        });
        this.body.appendChild(participants);
        if (team.status === 'complete') this.body.appendChild(this.el('p', team.teamScores?.A === team.teamScores?.B ? '🤝 Hai đội hòa nhau!' : '🏆 Đội ' + (team.teamScores?.A > team.teamScores?.B ? 'A' : 'B') + ' chiến thắng!', 'seasonal-result'));
      }
    }
    this.heading('Bảng điểm vũ đạo');
    const list = this.el('div', null, 'seasonal-list');
    records.slice(0, 8).forEach((record, index) => {
      const modeName = DANCE_MODES.find(mode => mode.id === (record.mode || 'rhythm'))?.label || 'Bắt nhịp';
      list.appendChild(this.el('div', (index + 1) + '. ' + record.name + ' · ' + modeName + ' · ' + record.score + '/100', 'seasonal-list-item'));
    });
    if (!records.length) list.appendChild(this.el('div', 'Chưa có điểm vũ đạo nào.', 'seasonal-empty'));
    this.body.appendChild(list);
  }

  startDance(mode = 'rhythm') {
    this.stopDance();
    if (!DANCE_MODES.some(item => item.id === mode)) mode = 'rhythm';
    if (this.getAuthorityEnabled?.()) {
      this.danceMode = mode;
      const result = this.submit('dance_start', { mode });
      if (result?.then) result.then(accepted => {
        if (!accepted) return;
        this.dance = this.serverDance();
        this.render();
        if (this.dance) this.tickDance();
      });
      return;
    }
    this.danceMode = mode;
    const sequence = Array.from({ length: mode === 'memory' ? 5 : 8 }, () => DANCE_MOVES[Math.floor(Math.random() * DANCE_MOVES.length)]);
    const playbackMs = mode === 'memory' ? sequence.length * 520 : 0;
    this.dance = { mode, sequence, playbackMs, startAt: performance.now() + 1200, hits: new Set(), score: 0, correct: 0, timingPenalty: 0 };
    this.render();
    this.tickDance();
  }

  tickDance() {
    if (!this.dance) return;
    if (this.getAuthorityEnabled?.()) {
      const run = this.serverDance();
      if (!run) {
        this.dance = null;
        this.danceFrame = 0;
        this.refresh();
        return;
      }
      this.dance = run;
      const symbols = { left: '⬅️', right: '➡️', up: '⬆️', down: '⬇️' };
      const now = this.getServerNow();
      if (this.dancePrompt) this.dancePrompt.textContent = now < run.startAt
        ? 'CHUẨN BỊ… ' + Math.ceil((run.startAt - now) / 500)
        : run.mode === 'memory' && now < run.inputStartAt
          ? 'GHI NHỚ CHUỖI · ' + (run.previewCue ? 'LÀM THEO MŨI TÊN' : 'CHUẨN BỊ')
          : (run.mode === 'rhythm' ? 'NHỊP ' : run.mode === 'memory' ? 'LẶP LẠI ' : 'BẮT CHƯỚC ') + Math.min(run.length, run.step + 1) + ' / ' + run.length;
      if (this.danceCue) this.danceCue.textContent = symbols[run.previewCue || run.currentCue] || '❔';
      if (this.danceScoreLabel) this.danceScoreLabel.textContent = 'Điểm: ' + run.score + ' / 100 · Đúng: ' + run.correct + '/' + run.length;
      this.danceFrame = requestAnimationFrame(() => this.tickDance());
      return;
    }
    const elapsed = performance.now() - this.dance.startAt;
    const tempoMs = this.dance.mode === 'copy' ? 820 : 650;
    const inputStart = this.dance.playbackMs;
    if (elapsed >= inputStart + this.dance.sequence.length * tempoMs) {
      this.finishDance();
      return;
    }
    const isMemoryPlayback = this.dance.mode === 'memory' && elapsed < inputStart;
    const beat = Math.max(0, Math.min(this.dance.sequence.length - 1, Math.floor((elapsed - inputStart) / tempoMs)));
    const symbols = { left: '⬅️', right: '➡️', up: '⬆️', down: '⬇️' };
    if (this.dancePrompt) {
      if (elapsed < 0) this.dancePrompt.textContent = 'Chuẩn bị… ' + Math.ceil(-elapsed / 500);
      else if (isMemoryPlayback) this.dancePrompt.textContent = 'GHI NHỚ CHUỖI · ' + (Math.floor(elapsed / 520) + 1) + ' / ' + this.dance.sequence.length;
      else this.dancePrompt.textContent = (this.dance.mode === 'rhythm' ? 'NHỊP ' : this.dance.mode === 'memory' ? 'LẶP LẠI ' : 'BẮT CHƯỚC ') + (beat + 1) + ' / ' + this.dance.sequence.length;
    }
    if (this.danceCue) this.danceCue.textContent = elapsed < 0 || (this.dance.mode === 'memory' && !isMemoryPlayback) ? '❔' : symbols[this.dance.sequence[beat]];
    if (this.danceScoreLabel) this.danceScoreLabel.textContent = 'Điểm: ' + this.dance.score + ' / 100 · Đúng: ' + this.dance.correct + '/' + this.dance.sequence.length;
    this.danceFrame = requestAnimationFrame(() => this.tickDance());
  }

  moveDance(direction) {
    if (!this.dance || !DANCE_MOVES.includes(direction)) return;
    if (this.getAuthorityEnabled?.()) {
      const result = this.submit('dance_input', { runId: this.dance.id, direction });
      if (result?.then) result.then(accepted => {
        if (!accepted) this.toast?.('🎵 Chưa đúng nhịp hoặc lượt đã kết thúc.');
        this.dance = this.serverDance();
        if (this.active) { this.render(); if (this.dance) this.tickDance(); }
      });
      return;
    }
    const elapsed = performance.now() - this.dance.startAt;
    const tempoMs = this.dance.mode === 'copy' ? 820 : 650;
    if (this.dance.mode === 'memory' && elapsed < this.dance.playbackMs) {
      this.toast?.('🧠 Đợi chuỗi kết thúc rồi lặp lại nhé!');
      return;
    }
    const phaseElapsed = elapsed - this.dance.playbackMs;
    const beat = Math.round(phaseElapsed / tempoMs);
    if (beat < 0 || beat >= this.dance.sequence.length || this.dance.hits.has(beat)) return;
    const delta = Math.abs(phaseElapsed - beat * tempoMs);
    const windowMs = this.dance.mode === 'memory' ? 440 : this.dance.mode === 'copy' ? 300 : 250;
    if (delta > windowMs) {
      this.toast?.('🎵 Lệch nhịp rồi — chờ động tác tiếp theo nhé!');
      return;
    }
    this.dance.hits.add(beat);
    if (direction === this.dance.sequence[beat]) {
      this.dance.correct++;
      if (delta > 110) this.dance.timingPenalty += 4;
      this.dance.score = Math.min(100, Math.max(0, Math.round(this.dance.correct * 100 / this.dance.sequence.length) - this.dance.timingPenalty));
    } else this.toast?.('↔️ Sai động tác! Hãy bắt chước mũi tên đang sáng.');
  }

  finishDance() {
    if (!this.dance) return;
    const score = Math.min(100, this.dance.score);
    this.stopDance();
    this.lastDanceScore = score;
    this.submit('dance_record', { score, mode: this.danceMode || 'rhythm' });
    this.render();
  }

  serverDance() {
    const runs = this.stateBucket('valentine', 'dance', 'runs');
    const run = runs.find(item => item.idOwner === this.getSelfId?.() && item.active);
    return run ? { ...run, length: run.length || (run.mode === 'memory' ? 5 : 8) } : null;
  }

  stopDance() {
    if (this.danceFrame) cancelAnimationFrame(this.danceFrame);
    this.danceFrame = 0;
    this.dance = null;
    this.dancePrompt = null;
    this.danceScoreLabel = null;
    this.danceCue = null;
  }

  handleAction(action, data) {
    if (action === 'close') return this.close();
    if (action === 'tree-contribute') {
      const ornamentKey = this.myRecord(this.stateBucket('christmas', 'inventory', 'players'))?.heldKey || this.getHeldItem?.();
      const expected = { star: 'star', bell: 'bell', cane: 'ribbon' }[ornamentKey];
      if (!ornamentKey || expected !== data.decorationType) { this.toast?.('🎒 Hãy cầm đúng món trang trí trước khi đóng góp.'); return; }
      const result = this.submit('tree_contribute', { decorationType: data.decorationType, ornamentKey });
      if (result?.then) result.then(accepted => { if (accepted) this.consumeHeldItem?.(ornamentKey); }).catch(() => {});
      else if (result) this.consumeHeldItem?.(ornamentKey);
      this.toast?.('🎁 Đã gửi yêu cầu đóng góp cho cây thông cộng đồng!');
    } else if (action === 'race-start') this.startRace();
    else if (action === 'race-choice') this.chooseRace(data.lane);
    else if (action === 'mansion-choice') this.chooseMansion(data.symbol);
    else if (action === 'costume-submit') {
      const costumeKey = this.body.querySelector('.seasonal-select')?.value || 'default';
      this.onCostumeSubmit?.(costumeKey);
      this.submit('costume_entry', { costumeKey });
      this.toast?.('🎭 Đã đổi trang phục và gửi bài dự thi!');
    } else if (action === 'costume-vote') {
      const result = this.submit('costume_vote', { targetId: data.targetId });
      if (result?.then) result.then(accepted => this.toast?.(accepted ? '⭐ Đã ghi nhận phiếu bình chọn.' : '⏱️ Phiên chưa mở hoặc đã kết thúc.'));
      else if (result) this.toast?.('⭐ Đã gửi bình chọn của bạn!');
      else this.toast?.('⏱️ Phiên chưa mở hoặc bạn đã bình chọn.');
    } else if (action === 'costume-round-start') {
      const result = this.submit('costume_round_start');
      if (result?.then) result.then(accepted => this.toast?.(accepted ? '🎬 Phiên diễn bắt đầu sau 5 giây.' : 'Cần là chủ phòng và có ít nhất hai bài dự thi để mở sân khấu.'));
    } else if (action === 'mansion-symbol') this.chooseMansionSymbol(data.symbol);
    else if (action === 'mansion-room') this.openMansionRoom(data.roomId);
    else if (action === 'mansion-back') {
      this.active = 'haunted_mansion';
      this.render();
    } else if (action === 'costume-photo') this.takePhoto('Sàn diễn hóa trang Halloween');
    else if (action === 'dance-start') this.startDance(data.mode);
    else if (action === 'dance-move') this.moveDance(data.direction);
    else if (action === 'dance-team-join') {
      const result = this.submit('dance_team_join', { team: data.team });
      if (result?.then) result.then(accepted => { if (!accepted) this.toast?.('Không thể vào đội khi phiên đang diễn ra.'); });
    } else if (action === 'dance-team-start') {
      const result = this.submit('dance_team_start');
      if (result?.then) result.then(accepted => { if (!accepted) this.toast?.('Cần là chủ phòng và hai đội phải có cùng số người.'); });
    } else if (action === 'dance-team-move') {
      const result = this.submit('dance_team_input', { sessionId: data.sessionId, direction: data.direction });
      if (result?.then) result.then(accepted => { if (!accepted) this.toast?.('Lượt nhịp này đã qua hoặc thao tác không hợp lệ.'); });
  }
}
}
