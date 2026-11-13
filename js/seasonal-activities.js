// Room-synchronised seasonal community activities and lightweight browser minigames.
// No currency or competitive advantage is granted by these activities.
export const PHOTO_SPOT_IDS = ['snow_globe', 'rose_gate', 'moon_bridge', 'lantern_deck'];
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
    christmas: { tree: { contributors: [] }, sled: { records: [] } },
    halloween: { mansion: { solved: [] }, costume: { entries: [], votes: [] } },
    valentine: { photos: { players: [] }, dance: { records: [] } },
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

  if (op.season === 'christmas' && op.action === 'tree_contribute') {
    if (!isObject(season.tree)) season.tree = {};
    const contributors = ensureList(season.tree, 'contributors');
    if (contributors.length >= 100 || findRecord(contributors, id)) return false;
    contributors.push({ id, name, at: Date.now() });
    return true;
  }

  if (op.season === 'christmas' && op.action === 'sled_record') {
    const timeMs = Number(data.timeMs);
    const gatesHit = Number(data.gatesHit);
    if (!Number.isFinite(timeMs) || timeMs < 5000 || timeMs > 300000) return false;
    if (!Number.isInteger(gatesHit) || gatesHit < 0 || gatesHit > 6) return false;
    if (!isObject(season.sled)) season.sled = {};
    const records = ensureList(season.sled, 'records');
    const previous = findRecord(records, id);
    const next = { id, name, timeMs: Math.round(timeMs), gatesHit, at: Date.now() };
    if (previous) {
      if (gatesHit < previous.gatesHit || (gatesHit === previous.gatesHit && timeMs >= previous.timeMs)) return false;
      Object.assign(previous, next);
    } else {
      if (records.length >= 100) return false;
      records.push(next);
    }
    return true;
  }

  if (op.season === 'halloween' && op.action === 'mansion_clear') {
    if (!isObject(season.mansion)) season.mansion = {};
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
      record = { id, name, spots: [], at: Date.now() };
      players.push(record);
    }
    record.name = name;
    if (!Array.isArray(record.spots)) record.spots = [];
    if (record.spots.includes(spotId)) return false;
    record.spots.push(spotId);
    record.at = Date.now();
    return true;
  }

  if (op.season === 'valentine' && op.action === 'dance_record') {
    const score = Number(data.score);
    if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0 || score > 100) return false;
    if (!isObject(season.dance)) season.dance = {};
    const records = ensureList(season.dance, 'records');
    const previous = findRecord(records, id);
    if (previous && score <= previous.score) return false;
    const next = { id, name, score, at: Date.now() };
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
  constructor({ getState, getSelfId, getPlayerName, emitOp, toast }) {
    this.getState = getState;
    this.getSelfId = getSelfId;
    this.getPlayerName = getPlayerName;
    this.emitOp = emitOp;
    this.toast = toast;
    this.theme = null;
    this.active = null;
    this.race = null;
    this.mansionStep = 0;
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
  }

  setTheme(theme) {
    const next = ['christmas', 'halloween', 'valentine'].includes(theme) ? theme : null;
    if (next !== this.theme) this.close();
    this.theme = next;
    this.refresh();
  }

  open(activity) {
    const valid = {
      christmas: ['community_tree', 'sled_race'],
      halloween: ['haunted_mansion', 'costume_runway'],
      valentine: ['photo_hunt', 'dance_stage'],
    };
    if (!valid[this.theme]?.includes(activity)) return;
    this.ensureOverlay();
    if (!this.overlay) return;
    this.active = activity;
    this.race = null;
    this.mansionStep = 0;
    this.dance = null;
    this.lastRaceResult = '';
    this.lastDanceScore = null;
    this.render();
    this.overlay.classList.remove('hidden');
  }

  close() {
    this.stopDance();
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
    this.emitOp?.({ k: 'seasonal_event', season: this.theme, action, data });
    return true;
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
    this.submit('photo_spot', { spotId });
    this.toast?.('📸 Đã lưu góc chụp vào bộ sưu tập Valentine!');
  }

  stateBucket(season, key, listName) {
    const state = this.getState?.();
    const value = state?.seasonalEvents?.[season]?.[key]?.[listName];
    return Array.isArray(value) ? value : [];
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
      dance_stage: '🎶 Sàn Nhảy Tương Tác',
    };
    this.title.textContent = titles[this.active] || 'Hoạt động lễ hội';
    if (this.active === 'community_tree') this.renderTree();
    else if (this.active === 'sled_race') this.renderSledRace();
    else if (this.active === 'haunted_mansion') this.renderMansion();
    else if (this.active === 'costume_runway') this.renderCostumeRunway();
    else if (this.active === 'photo_hunt') this.renderPhotoHunt();
    else if (this.active === 'dance_stage') this.renderDanceStage();
  }

  renderTree() {
    const contributors = this.stateBucket('christmas', 'tree', 'contributors');
    const mine = this.myRecord(contributors);
    const target = 24;
    const progress = Math.min(100, Math.round((contributors.length / target) * 100));
    this.paragraph('Mỗi người có thể đóng góp một vật liệu trang trí. Khi cộng đồng đạt 24 lượt đóng góp, cây thông sẽ hoàn thành mục tiêu sự kiện.');
    const meter = this.el('div', null, 'seasonal-progress');
    const fill = this.el('div', null, 'seasonal-progress-fill');
    fill.style.width = progress + '%';
    meter.appendChild(fill);
    this.body.appendChild(meter);
    this.body.appendChild(this.el('p', contributors.length + ' / ' + target + ' vật liệu · ' + progress + '%', 'seasonal-stat'));
    const action = this.button(mine ? '✓ Bạn đã đóng góp' : '🎁 Góp một vật liệu', 'tree-contribute');
    action.disabled = !!mine;
    this.body.appendChild(action);
    this.heading('Người tham gia');
    const list = this.el('div', null, 'seasonal-list');
    contributors.slice(-8).reverse().forEach(item => list.appendChild(this.el('div', '🎄 ' + item.name, 'seasonal-list-item')));
    if (!contributors.length) list.appendChild(this.el('div', 'Chưa có đóng góp nào. Hãy là người đầu tiên!', 'seasonal-empty'));
    this.body.appendChild(list);
  }

  renderSledRace() {
    const records = this.stateBucket('christmas', 'sled', 'records').slice()
      .sort((a, b) => (b.gatesHit - a.gatesHit) || (a.timeMs - b.timeMs));
    this.paragraph('Vượt qua 6 cổng bằng cách chọn đúng làn trái hoặc phải. Mỗi lượt có một chuỗi cổng khác nhau; thời gian và số cổng chính xác được ghi vào bảng thành tích phòng.');
    if (this.race) {
      this.body.appendChild(this.el('div', 'CỔNG ' + (this.race.step + 1) + ' / 6', 'seasonal-stat'));
      this.body.appendChild(this.el('div', this.race.sequence[this.race.step] === 'left' ? '⬅️ RẼ TRÁI' : 'RẼ PHẢI ➡️', 'seasonal-race-cue'));
      const row = this.el('div', null, 'seasonal-actions');
      row.appendChild(this.button('⬅️ Trái', 'race-choice', { lane: 'left' }));
      row.appendChild(this.button('Phải ➡️', 'race-choice', { lane: 'right' }));
      this.body.appendChild(row);
      this.body.appendChild(this.el('p', 'Cổng đúng: ' + this.race.hits + ' · Chọn một làn để tiếp tục.', 'seasonal-copy'));
    } else {
      if (this.lastRaceResult) this.body.appendChild(this.el('p', this.lastRaceResult, 'seasonal-result'));
      this.body.appendChild(this.button('🏁 Bắt đầu lượt đua', 'race-start', {}, 'seasonal-button seasonal-primary'));
    }
    this.heading('Bảng thành tích');
    const list = this.el('div', null, 'seasonal-list');
    records.slice(0, 8).forEach((record, index) => {
      list.appendChild(this.el('div', (index + 1) + '. ' + record.name + ' · ' + record.gatesHit + '/6 cổng · ' + (record.timeMs / 1000).toFixed(2) + 's', 'seasonal-list-item'));
    });
    if (!records.length) list.appendChild(this.el('div', 'Chưa có lượt đua nào được ghi nhận.', 'seasonal-empty'));
    this.body.appendChild(list);
  }

  startRace() {
    const sequence = Array.from({ length: 6 }, () => Math.random() < 0.5 ? 'left' : 'right');
    this.race = { sequence, step: 0, hits: 0, startedAt: performance.now() };
    this.lastRaceResult = '';
    this.render();
  }

  chooseRace(lane) {
    if (!this.race) return;
    if (this.race.sequence[this.race.step] === lane) this.race.hits++;
    this.race.step++;
    if (this.race.step >= this.race.sequence.length) {
      const timeMs = Math.max(5000, Math.min(300000, performance.now() - this.race.startedAt));
      const gatesHit = this.race.hits;
      this.submit('sled_record', { timeMs, gatesHit });
      this.lastRaceResult = '🏁 Hoàn thành! Bạn vượt đúng ' + gatesHit + '/6 cổng trong ' + (timeMs / 1000).toFixed(2) + ' giây.';
      this.race = null;
    }
    this.render();
  }

  renderMansion() {
    const solved = this.stateBucket('halloween', 'mansion', 'solved');
    const complete = !!this.myRecord(solved);
    this.paragraph('Trong dinh thự có ba căn phòng. Hãy làm theo manh mối trên tấm bảng: thắp nến trước, theo dấu dơi thứ hai, rồi mở căn phòng bí ngô cuối cùng.');
    if (complete) {
      this.body.appendChild(this.el('p', '🔓 Bạn đã mở được cả ba căn phòng bí mật!', 'seasonal-result'));
    } else {
      this.body.appendChild(this.el('div', 'PHÒNG ' + (this.mansionStep + 1) + ' / 3', 'seasonal-stat'));
      const row = this.el('div', null, 'seasonal-actions seasonal-symbols');
      [['🕯️', 'candle'], ['🦇', 'bat'], ['🎃', 'pumpkin']].forEach(([label, key]) => {
        row.appendChild(this.button(label, 'mansion-choice', { symbol: key }));
      });
      this.body.appendChild(row);
      this.body.appendChild(this.el('p', 'Tiến độ của bạn: ' + this.mansionStep + '/3 phòng.', 'seasonal-copy'));
    }
    this.heading('Nhà thám hiểm');
    const list = this.el('div', null, 'seasonal-list');
    solved.slice(-8).reverse().forEach(item => list.appendChild(this.el('div', '🗝️ ' + item.name, 'seasonal-list-item')));
    if (!solved.length) list.appendChild(this.el('div', 'Chưa có ai hoàn thành chuỗi câu đố.', 'seasonal-empty'));
    this.body.appendChild(list);
  }

  chooseMansion(symbol) {
    if (this.myRecord(this.stateBucket('halloween', 'mansion', 'solved'))) return;
    const sequence = ['candle', 'bat', 'pumpkin'];
    if (symbol === sequence[this.mansionStep]) {
      this.mansionStep++;
      if (this.mansionStep === sequence.length) {
        this.submit('mansion_clear');
        this.toast?.('🔓 Bạn đã mở khóa các căn phòng bí mật!');
      }
    } else {
      this.mansionStep = 0;
      this.toast?.('🗝️ Manh mối chưa đúng thứ tự. Hãy đọc lại tấm bảng!');
    }
    this.render();
  }

  renderCostumeRunway() {
    const entries = this.stateBucket('halloween', 'costume', 'entries');
    const votes = this.stateBucket('halloween', 'costume', 'votes');
    const id = this.getSelfId?.();
    const mine = this.myRecord(entries);
    const myVote = this.myRecord(votes);
    this.paragraph('Chọn một bộ trang phục, bước lên sân khấu và gửi bài dự thi. Mỗi người có một phiếu bình chọn; không thể tự bình chọn cho mình.');
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
    submit.dataset.costumeSelect = 'true';
    this.body.appendChild(submit);
    this.body.appendChild(this.el('p', entries.length + ' bài dự thi · ' + votes.length + ' lượt bình chọn', 'seasonal-stat'));
    this.heading('Sân khấu & bình chọn');
    const list = this.el('div', null, 'seasonal-list');
    entries.forEach(entry => {
      const card = this.el('div', null, 'seasonal-contest-entry');
      card.appendChild(this.el('div', entry.name + ' · ' + (COSTUMES.find(item => item.key === entry.costumeKey)?.label || entry.costumeKey), 'seasonal-list-item'));
      const count = votes.filter(vote => vote.targetId === entry.id).length;
      card.appendChild(this.el('span', '⭐ ' + count + ' phiếu', 'seasonal-vote-count'));
      if (entry.id !== id && !myVote) card.appendChild(this.button('Bình chọn', 'costume-vote', { targetId: entry.id }, 'seasonal-button seasonal-small'));
      list.appendChild(card);
    });
    if (!entries.length) list.appendChild(this.el('div', 'Chưa có bài dự thi. Hãy mở màn lễ hội!', 'seasonal-empty'));
    this.body.appendChild(list);
    if (myVote) this.body.appendChild(this.el('p', '✓ Bạn đã gửi bình chọn. Cảm ơn bạn!', 'seasonal-result'));
  }

  renderPhotoHunt() {
    const players = this.stateBucket('valentine', 'photos', 'players');
    const mine = this.myRecord(players);
    const found = mine?.spots || [];
    this.paragraph('Khám phá khu vực mở rộng Valentine và tương tác với bốn điểm chụp ảnh được đánh dấu trong bản đồ. Đứng gần từng điểm rồi nhấn [E] để thêm ảnh vào bộ sưu tập.');
    this.body.appendChild(this.el('div', found.length + ' / ' + PHOTO_SPOTS.length + ' góc chụp đã khám phá', 'seasonal-stat'));
    const meter = this.el('div', null, 'seasonal-progress');
    const fill = this.el('div', null, 'seasonal-progress-fill');
    fill.style.width = Math.round((found.length / PHOTO_SPOTS.length) * 100) + '%';
    meter.appendChild(fill);
    this.body.appendChild(meter);
    const list = this.el('div', null, 'seasonal-list');
    PHOTO_SPOTS.forEach(spot => {
      const done = found.includes(spot.id);
      list.appendChild(this.el('div', (done ? '✓ ' : '○ ') + spot.icon + ' ' + spot.name, 'seasonal-list-item' + (done ? ' is-complete' : '')));
    });
    this.body.appendChild(list);
    if (found.length === PHOTO_SPOTS.length) this.body.appendChild(this.el('p', '💗 Bạn đã khám phá trọn bộ góc chụp Valentine!', 'seasonal-result'));
    this.heading('Người khám phá');
    const completed = players.filter(player => player.spots?.length === PHOTO_SPOTS.length).length;
    this.body.appendChild(this.el('p', completed + ' người đã hoàn thành bộ sưu tập.', 'seasonal-copy'));
  }

  renderDanceStage() {
    const records = this.stateBucket('valentine', 'dance', 'records').slice().sort((a, b) => b.score - a.score);
    this.paragraph('Nhấn nút theo nhịp sáng. Có 8 nhịp; càng gần nhịp chuẩn, điểm càng cao. Trò chơi hỗ trợ chuột, cảm ứng và nút bấm lớn trên điện thoại.');
    if (this.dance) {
      this.dancePrompt = this.el('div', 'Sẵn sàng…', 'seasonal-race-cue');
      this.body.appendChild(this.dancePrompt);
      this.danceScoreLabel = this.el('p', 'Điểm: 0 / 100', 'seasonal-stat');
      this.body.appendChild(this.danceScoreLabel);
      this.body.appendChild(this.button('♪ TAP THEO NHỊP ♪', 'dance-tap', {}, 'seasonal-button seasonal-primary seasonal-tap'));
    } else {
      if (this.lastDanceScore !== null) this.body.appendChild(this.el('p', '🎶 Lượt vừa rồi: ' + this.lastDanceScore + '/100 điểm.', 'seasonal-result'));
      this.body.appendChild(this.button('▶ Bắt đầu nhảy', 'dance-start', {}, 'seasonal-button seasonal-primary'));
    }
    this.heading('Bảng điểm vũ đạo');
    const list = this.el('div', null, 'seasonal-list');
    records.slice(0, 8).forEach((record, index) => list.appendChild(this.el('div', (index + 1) + '. ' + record.name + ' · ' + record.score + '/100', 'seasonal-list-item')));
    if (!records.length) list.appendChild(this.el('div', 'Chưa có điểm vũ đạo nào.', 'seasonal-empty'));
    this.body.appendChild(list);
  }

  startDance() {
    this.stopDance();
    this.dance = { startAt: performance.now() + 1200, hits: new Set(), score: 0 };
    this.render();
    this.tickDance();
  }

  tickDance() {
    if (!this.dance) return;
    const now = performance.now();
    const elapsed = now - this.dance.startAt;
    if (elapsed >= 8 * 600) {
      this.finishDance();
      return;
    }
    if (this.dancePrompt) {
      if (elapsed < 0) this.dancePrompt.textContent = 'Chuẩn bị… ' + Math.ceil(-elapsed / 400);
      else this.dancePrompt.textContent = 'NHỊP ' + (Math.min(7, Math.floor(elapsed / 600)) + 1) + ' / 8';
    }
    if (this.danceScoreLabel) this.danceScoreLabel.textContent = 'Điểm: ' + this.dance.score + ' / 100';
    this.danceFrame = requestAnimationFrame(() => this.tickDance());
  }

  tapDance() {
    if (!this.dance) return;
    const elapsed = performance.now() - this.dance.startAt;
    const beat = Math.round(elapsed / 600);
    if (beat < 0 || beat > 7) return;
    if (this.dance.hits.has(beat)) return;
    const delta = Math.abs(elapsed - beat * 600);
    if (delta > 220) {
      this.toast?.('🎵 Lệch nhịp rồi — hãy thử lại ở nhịp tiếp theo!');
      return;
    }
    this.dance.hits.add(beat);
    this.dance.score = Math.min(100, this.dance.score + (delta <= 100 ? 13 : 8));
  }

  finishDance() {
    if (!this.dance) return;
    const score = Math.min(100, this.dance.score);
    this.stopDance();
    this.lastDanceScore = score;
    this.submit('dance_record', { score });
    this.render();
  }

  stopDance() {
    if (this.danceFrame) cancelAnimationFrame(this.danceFrame);
    this.danceFrame = 0;
    this.dance = null;
    this.dancePrompt = null;
    this.danceScoreLabel = null;
  }

  handleAction(action, data) {
    if (action === 'close') return this.close();
    if (action === 'tree-contribute') {
      this.submit('tree_contribute');
      this.toast?.('🎁 Đã gửi đóng góp cho cây thông cộng đồng!');
    } else if (action === 'race-start') this.startRace();
    else if (action === 'race-choice') this.chooseRace(data.lane);
    else if (action === 'mansion-choice') this.chooseMansion(data.symbol);
    else if (action === 'costume-submit') {
      const select = this.body.querySelector('[data-costume-select]')?.previousElementSibling?.querySelector('select');
      this.submit('costume_entry', { costumeKey: select?.value || 'default' });
      this.toast?.('🎭 Đã gửi bài dự thi hóa trang!');
    } else if (action === 'costume-vote') {
      this.submit('costume_vote', { targetId: data.targetId });
      this.toast?.('⭐ Đã gửi bình chọn của bạn!');
    } else if (action === 'dance-start') this.startDance();
    else if (action === 'dance-tap') this.tapDance();
  }
}
