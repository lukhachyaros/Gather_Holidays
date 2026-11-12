// ============================================================================
// CASINO & ARCADE INTERACTIVE STUDIO FOR GATHER_HOLIDAYS
// - Roulette: Interactive betting grid, canvas wheel with physics ball orbit
// - Duck Derby: Bettable live 4-lane duck canal race with dynamic overtaking
// - Blackjack: Full Las Vegas VIP table with Hit, Stand, Double Down, Dealer AI
// - Slot Machine: Authentic pull lever, blur reels spinning, 777 Mega Jackpot
// - Plinko: Physics peg collisions, audio pings, 11 reward bins (up to 100x)
// ============================================================================

import { playSfx } from './audio.js';

let worldRef = null;
let toastRef = null;
let emitOpRef = null;
let getMeRef = null;
let getPeersRef = null;
let getSelfIdRef = null;
let activeCasinoTable = null;
let casinoTableHeartbeat = null;
let casinoTableUi = null;
const casinoTables = new Map();
const seenCasinoEvents = new Set();
const CASINO_TABLE_TTL_MS = 20000;
const CASINO_TABLE_GAMES = new Set(['roulette', 'duck_derby', 'blackjack', 'plinko']);
const CASINO_GAME_LABELS = {
  roulette: 'Roulette',
  duck_derby: 'Duck Derby',
  blackjack: 'Blackjack',
  plinko: 'Plinko',
};

// ---------- Coin Wallet Management (Starts strictly at 0) ----------
let coins = parseInt(localStorage.getItem('gh_player_coins') ?? localStorage.getItem('gh_casino_chips') ?? '0', 10);
if (isNaN(coins) || coins < 0) coins = 0;

export const VALID_CODES = {
  raumania: { label: 'Raumania', reward: 500 },
  bokho: { label: 'BoKho', reward: 500 },
  chu0n6: { label: 'Chu0n6', reward: 500 },
  'trung legit': { label: 'Trung Legit', reward: 500 },
  toilagay: { label: 'toilagay', reward: 500 },
};

const CODE_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export function redeemCode(rawCode) {
  if (!rawCode) return { ok: false, success: false, msg: 'Vui lòng nhập mã code!' };
  const clean = String(rawCode).trim().toLowerCase();
  const cfg = VALID_CODES[clean];
  if (!cfg) {
    return { ok: false, success: false, msg: 'Mã code không chính xác! Hãy tìm các tờ note bí mật dán quanh map.' };
  }

  const history = JSON.parse(localStorage.getItem('gh_code_history') || '{}');
  const lastUsed = history[clean] || 0;
  const now = Date.now();
  const diff = now - lastUsed;

  if (diff < CODE_COOLDOWN_MS) {
    const remainSec = Math.ceil((CODE_COOLDOWN_MS - diff) / 1000);
    const m = Math.floor(remainSec / 60);
    const s = remainSec % 60;
    return {
      ok: false,
      success: false,
      msg: `Code [${cfg.label}] đang hồi chiêu! Vui lòng thử lại sau ${m} phút ${s} giây.`,
    };
  }

  history[clean] = now;
  localStorage.setItem('gh_code_history', JSON.stringify(history));

  addCoins(cfg.reward);
  playSfx('plinko_win', 'casino');

  return {
    ok: true,
    success: true,
    msg: `🎉 Đổi mã thành công! Bạn nhận được +${cfg.reward} Xu từ [${cfg.label}]!`,
    reward: cfg.reward,
  };
}

export function recordJackpotWin(gameType, amount = 5000) {
  try {
    const won = new Set(JSON.parse(localStorage.getItem('gh_jackpots_won') || '[]'));
    won.add(gameType);
    localStorage.setItem('gh_jackpots_won', JSON.stringify([...won]));

    playSfx('jackpot_voice', 'casino');

    const me = getMeRef?.();
    if (emitOpRef && me) {
      emitOpRef({
        k: 'casino_broadcast',
        game: gameType,
        player: me.name,
        detail: amount,
        isJackpot: true,
        casinoEventId: `${getSelfIdRef?.() || me.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    }

    const allGames = ['roulette', 'duck_derby', 'blackjack', 'slot_machine', 'plinko'];
    const remaining = allGames.filter(g => !won.has(g));

    if (remaining.length === 0) {
      localStorage.setItem('gh_unlocked_vuadoden', '1');
      toastRef?.('👑 HUYỀN THOẠI! Bạn đã thắng Jackpot ở cả 5 trò và mở khóa danh hiệu độc quyền: [👑 Vua Đỏ Đen]!');
      worldRef?.spawnFireworksShow?.(14.5, 11.5);
    } else {
      toastRef?.(`💥 JACKPOT! Bạn đã thắng lớn ${amount.toLocaleString()} Xu ở trò ${gameType}! (Còn ${remaining.length} trò nữa để đạt danh hiệu [👑 Vua Đỏ Đen])`);
    }
  } catch (err) {
    console.warn(err);
  }
}

export function getCoins() {
  return coins;
}
export function getChips() {
  return coins;
}

export function addCoins(amount) {
  coins += amount;
  localStorage.setItem('gh_player_coins', String(coins));
  localStorage.setItem('gh_casino_chips', String(coins));
  updateAllWalletBadges();
}
export function addChips(amount) {
  addCoins(amount);
}

export function spendCoins(amount) {
  if (coins < amount) return false;
  coins -= amount;
  localStorage.setItem('gh_player_coins', String(coins));
  localStorage.setItem('gh_casino_chips', String(coins));
  updateAllWalletBadges();
  return true;
}
export function spendChips(amount) {
  return spendCoins(amount);
}

export function resetCoins() {
  coins = 0;
  localStorage.setItem('gh_player_coins', '0');
  localStorage.setItem('gh_casino_chips', '0');
  updateAllWalletBadges();
}
export function resetChips() {
  resetCoins();
}

function updateAllWalletBadges() {
  document.querySelectorAll('.casino-chip-count').forEach(el => {
    el.textContent = `${coins.toLocaleString()} Xu`;
  });
  const shopChips = document.getElementById('shopWalletChips');
  if (shopChips) {
    shopChips.textContent = coins.toLocaleString();
  }
}

export function initCasino(world, toast, emitOp = null, getMe = null, getPeers = null, getSelfId = null) {
  worldRef = world;
  toastRef = toast;
  emitOpRef = emitOp;
  getMeRef = getMe;
  getPeersRef = getPeers;
  getSelfIdRef = getSelfId;
}

export let activePlinkoInstance = null;
export let activeRouletteInstance = null;
export let activeDuckDerbyInstance = null;
export let activeBlackjackInstance = null;

function getCasinoPlayer() {
  const me = getMeRef?.();
  return {
    id: getSelfIdRef?.() || `local-${String(me?.name || 'player').toLowerCase()}`,
    name: String(me?.name || 'Người chơi').slice(0, 32),
  };
}

function rememberCasinoEvent(id) {
  if (!id) return false;
  if (seenCasinoEvents.has(id)) return true;
  seenCasinoEvents.add(id);
  if (seenCasinoEvents.size > 2000) {
    seenCasinoEvents.delete(seenCasinoEvents.values().next().value);
  }
  return false;
}

function serializeCasinoTable(table) {
  return {
    id: table.id,
    game: table.game,
    name: table.name,
    hostId: table.hostId,
    players: [...table.players.values()].map(player => ({
      id: player.id,
      name: player.name,
      lastSeen: player.lastSeen,
    })),
    blackjackState: table.blackjackState || null,
  };
}

function getOrCreateCasinoTable(data) {
  if (!data?.id || !CASINO_TABLE_GAMES.has(data.game)) return null;
  let table = casinoTables.get(data.id);
  if (!table) {
    table = {
      id: data.id,
      game: data.game,
      name: String(data.name || CASINO_GAME_LABELS[data.game]).slice(0, 32),
      hostId: data.hostId || '',
      players: new Map(),
      blackjackState: null,
      updatedAt: Date.now(),
    };
    casinoTables.set(table.id, table);
  }
  table.name = String(data.name || table.name).slice(0, 32);
  table.hostId = data.hostId || table.hostId;
  if (data.blackjackState) table.blackjackState = data.blackjackState;
  for (const player of data.players || []) {
    if (!player?.id) continue;
    table.players.set(player.id, {
      id: player.id,
      name: String(player.name || 'Người chơi').slice(0, 32),
      lastSeen: Date.now(),
    });
  }
  table.updatedAt = Date.now();
  return table;
}

function pruneCasinoTables() {
  const now = Date.now();
  for (const [id, table] of casinoTables) {
    for (const [playerId, player] of table.players) {
      if (now - player.lastSeen > CASINO_TABLE_TTL_MS) table.players.delete(playerId);
    }
    if (!table.players.size) {
      casinoTables.delete(id);
      continue;
    }
    if (!table.players.has(table.hostId)) table.hostId = [...table.players.keys()].sort()[0];
  }
}

function notifyCasinoTableUi() {
  pruneCasinoTables();
  casinoTableUi?.render?.();
}

function sendCasinoTableMessage(tableAction, data = {}) {
  const player = getCasinoPlayer();
  emitOpRef?.({
    k: 'casino_broadcast',
    game: data.game || activeCasinoTable?.game,
    tableAction,
    tableId: data.tableId || activeCasinoTable?.id,
    playerId: player.id,
    player: player.name,
    casinoEventId: `${player.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...data,
  });
}

function leaveActiveCasinoTable() {
  clearInterval(casinoTableHeartbeat);
  casinoTableHeartbeat = null;
  if (activeCasinoTable) {
    if (activeCasinoTable.game === 'blackjack') activeBlackjackInstance?.onRoomLeft?.();
    sendCasinoTableMessage('leave');
    activeCasinoTable = null;
  }
  notifyCasinoTableUi();
}

function joinCasinoTable(table) {
  if (!table) return;
  if (activeCasinoTable?.id === table.id) return;
  leaveActiveCasinoTable();
  activeCasinoTable = table;
  const player = getCasinoPlayer();
  table.players.set(player.id, { ...player, lastSeen: Date.now() });
  if (table.game === 'blackjack') activeBlackjackInstance?.onRoomJoined?.(table.blackjackState);
  sendCasinoTableMessage('join', {
    tableId: table.id,
    game: table.game,
    table: serializeCasinoTable(table),
  });
  casinoTableHeartbeat = setInterval(() => {
    if (!activeCasinoTable) return;
    sendCasinoTableMessage('heartbeat', {
      tableId: activeCasinoTable.id,
      game: activeCasinoTable.game,
    });
  }, 5000);
  notifyCasinoTableUi();
}

function createCasinoTable(game, name) {
  const player = getCasinoPlayer();
  const table = {
    id: `${game}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    game,
    name: String(name || '').trim().slice(0, 32),
    hostId: player.id,
    players: new Map([[player.id, { ...player, lastSeen: Date.now() }]]),
    blackjackState: null,
    updatedAt: Date.now(),
  };
  if (!table.name) {
    toastRef?.('Nhập tên bàn trước khi tạo phòng.');
    return;
  }
  leaveActiveCasinoTable();
  activeCasinoTable = table;
  casinoTables.set(table.id, table);
  if (table.game === 'blackjack') activeBlackjackInstance?.onRoomJoined?.(table.blackjackState);
  sendCasinoTableMessage('create', {
    tableId: table.id,
    game,
    table: serializeCasinoTable(table),
  });
  casinoTableHeartbeat = setInterval(() => {
    if (!activeCasinoTable) return;
    sendCasinoTableMessage('heartbeat', {
      tableId: activeCasinoTable.id,
      game: activeCasinoTable.game,
    });
  }, 5000);
  notifyCasinoTableUi();
}

function addCasinoTableUi(modal, game) {
  const player = getCasinoPlayer();
  const panel = document.createElement('section');
  panel.className = 'casino-online-table';
  panel.innerHTML = `
    <div class="casino-online-table-heading">
      <div>
        <strong>🌐 PHÒNG ONLINE · ${CASINO_GAME_LABELS[game]}</strong>
        <span class="casino-online-player-name"></span>
      </div>
      <button type="button" class="casino-action-btn secondary casino-leave-table" hidden>Rời bàn</button>
    </div>
    <div class="casino-online-controls">
      <input class="casino-room-name" maxlength="32" aria-label="Tên phòng casino" placeholder="Tên bàn mới (tối đa 32 ký tự)">
      <button type="button" class="casino-action-btn casino-create-table">＋ Tạo phòng</button>
    </div>
    <div class="casino-online-status" aria-live="polite">Chọn một bàn đang mở hoặc tạo bàn mới để cùng chơi.</div>
    <div class="casino-online-rooms"></div>
    <div class="casino-online-players" hidden></div>
  `;
  modal.querySelector('.casino-body').prepend(panel);
  panel.querySelector('.casino-online-player-name').textContent = `Bạn: ${player.name}`;
  const status = panel.querySelector('.casino-online-status');
  const rooms = panel.querySelector('.casino-online-rooms');
  const players = panel.querySelector('.casino-online-players');
  const leaveButton = panel.querySelector('.casino-leave-table');
  const roomNameInput = panel.querySelector('.casino-room-name');

  const render = () => {
    if (!panel.isConnected) return;
    const active = activeCasinoTable?.game === game ? activeCasinoTable : null;
    const available = [...casinoTables.values()]
      .filter(table => table.game === game && table.id !== active?.id && table.players.size)
      .sort((a, b) => a.name.localeCompare(b.name));

    rooms.replaceChildren();
    available.forEach(table => {
      const card = document.createElement('div');
      card.className = 'casino-online-room';
      const detail = document.createElement('span');
      detail.textContent = `${table.name} · ${table.players.size} người`;
      const joinButton = document.createElement('button');
      joinButton.type = 'button';
      joinButton.className = 'casino-action-btn secondary';
      joinButton.textContent = 'Tham gia';
      joinButton.onclick = () => joinCasinoTable(table);
      card.append(detail, joinButton);
      rooms.appendChild(card);
    });

    leaveButton.hidden = !active;
    panel.querySelector('.casino-create-table').disabled = !!active;
    roomNameInput.disabled = !!active;
    if (active) {
      status.textContent = `Đang ở bàn “${active.name}”${active.hostId === player.id ? ' · Bạn là chủ bàn' : ''}.`;
      players.hidden = false;
      players.replaceChildren();
      const heading = document.createElement('strong');
      heading.textContent = `Người chơi (${active.players.size})`;
      players.appendChild(heading);
      for (const participant of active.players.values()) {
        const chip = document.createElement('span');
        chip.className = 'casino-online-player';
        chip.textContent = `${participant.id === active.hostId ? '👑 ' : ''}${participant.name}${participant.id === player.id ? ' (Bạn)' : ''}`;
        players.appendChild(chip);
      }
    } else {
      players.hidden = true;
      status.textContent = available.length
        ? 'Chọn một bàn đang mở hoặc tạo bàn mới để cùng chơi.'
        : 'Chưa có bàn mở. Tạo phòng để mời mọi người trong Gather hiện tại.';
    }
  };

  panel.querySelector('.casino-create-table').onclick = () => createCasinoTable(game, roomNameInput.value);
  leaveButton.onclick = leaveActiveCasinoTable;
  casinoTableUi = { game, render };
  render();
  sendCasinoTableMessage('discover', { game, targetId: '' });
}

function handleCasinoTableMessage(op, senderId) {
  if (op.targetId && op.targetId !== getSelfIdRef?.()) return;
  if (rememberCasinoEvent(op.casinoEventId)) return;

  if (op.tableAction === 'discover') {
    const table = activeCasinoTable;
    if (table?.game === op.game) {
      sendCasinoTableMessage('announce', {
        tableId: table.id,
        game: table.game,
        targetId: senderId,
        table: serializeCasinoTable(table),
      });
    }
    return;
  }

  if (op.tableAction === 'create' || op.tableAction === 'announce') {
    const table = getOrCreateCasinoTable(op.table);
    if (table?.game === 'blackjack' && table.blackjackState && table.hostId === senderId) {
      activeBlackjackInstance?.onTableState?.(table.blackjackState);
    }
    notifyCasinoTableUi();
    return;
  }

  const table = casinoTables.get(op.tableId);
  if (!table) return;
  const playerId = op.playerId || senderId;
  const playerName = String(op.player || 'Người chơi').slice(0, 32);

  if (op.tableAction === 'join' || op.tableAction === 'heartbeat') {
    if (playerId) table.players.set(playerId, { id: playerId, name: playerName, lastSeen: Date.now() });
    table.updatedAt = Date.now();
    if (op.tableAction === 'join' && table.hostId === getSelfIdRef?.()) {
      sendCasinoTableMessage('announce', {
        tableId: table.id,
        game: table.game,
        targetId: playerId,
        table: serializeCasinoTable(table),
      });
    }
  } else if (op.tableAction === 'leave') {
    table.players.delete(playerId);
    table.updatedAt = Date.now();
    if (!table.players.size) {
      casinoTables.delete(table.id);
    } else if (!table.players.has(table.hostId)) {
      table.hostId = [...table.players.keys()].sort()[0];
    }
  } else if (op.tableAction === 'blackjack_state' && table.game === 'blackjack') {
    if (senderId !== table.hostId) return;
    table.blackjackState = op.state;
    activeBlackjackInstance?.onTableState?.(op.state);
  } else if (op.tableAction === 'blackjack_join' && table.game === 'blackjack') {
    if (table.hostId === getSelfIdRef?.()) {
      activeBlackjackInstance?.onPeerJoin?.(senderId, playerName, op.bet, senderId);
    }
  } else if (op.tableAction === 'blackjack_action' && table.game === 'blackjack') {
    if (table.hostId === getSelfIdRef?.()) {
      activeBlackjackInstance?.onPeerAction?.(senderId, op.action, senderId);
    }
  } else if (op.tableAction === 'blackjack_join_result' && table.game === 'blackjack') {
    if (senderId !== table.hostId) return;
    activeBlackjackInstance?.onJoinResult?.(!!op.accepted);
  }
  notifyCasinoTableUi();
}

export function updateCasinoTicker(msg) {
  const tickerEl = document.getElementById('casinoTickerText');
  if (tickerEl) {
    tickerEl.textContent = msg;
    tickerEl.style.animation = 'none';
    tickerEl.offsetHeight; // trigger reflow
    tickerEl.style.animation = 'tickerSlideIn 0.3s ease-out';
  }
}

export function broadcastCasinoPlay(gameName, detail = '', extra = {}) {
  if (!emitOpRef) return;
  const player = getCasinoPlayer();
  const isSlot = gameName === 'slot_machine';
  const table = !isSlot && activeCasinoTable?.game === gameName ? activeCasinoTable : null;
  if (!isSlot && !table) return;
  emitOpRef({
    k: 'casino_broadcast',
    game: gameName,
    tableId: table?.id,
    player: player.name,
    playerId: player.id,
    detail,
    isJackpot: false,
    casinoEventId: `${player.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...extra,
  });
}

export function handleCasinoBroadcast(op, senderId = null) {
  if (!op) return;
  if (op.tableAction) {
    handleCasinoTableMessage(op, senderId);
    return;
  }
  if (op.casinoEventId && rememberCasinoEvent(op.casinoEventId)) return;
  const { game, player, detail, isJackpot, subAction } = op;
  if (senderId === getSelfIdRef?.() && !isJackpot) return;
  if (isJackpot) {
    toastRef?.(`💥 JACKPOT! ${player} vừa trúng độc đắc ${Number(detail).toLocaleString()} Xu ở trò ${game.toUpperCase()}! 🎉`);
    updateCasinoTicker(`💥 JACKPOT! ${player} vừa trúng độc đắc ${Number(detail).toLocaleString()} Xu ở ${game.toUpperCase()}! 🎉`);
    playSfx('jackpot_voice', 'casino');
    worldRef?.spawnFireworksShow?.(14.5, 11.5);
  } else {
    if (game !== 'slot_machine' &&
        (!activeCasinoTable || activeCasinoTable.game !== game || activeCasinoTable.id !== op.tableId)) return;
    if (game === 'roulette') {
      const rt = worldRef?.casinoObjs?.find(o => o.userData?.type === 'roulette');
      rt?.userData?.spinWheel?.();
      if (subAction === 'bet') {
        updateCasinoTicker(`🎡 ${player} vừa đặt cược ${op.amount || 10} Xu vào ô [${op.betKey}]!`);
        activeRouletteInstance?.onPeerBet?.(player, op.betKey, op.amount || 10);
      } else if (subAction === 'spin') {
        if (activeCasinoTable.hostId !== senderId) return;
        updateCasinoTicker(`🎡 ${player} đang quay bánh xe Roulette!`);
        toastRef?.(`🎡 ${player} đang quay bánh xe Roulette!`);
        activeRouletteInstance?.onPeerSpin?.(player, op.winningNum);
      } else {
        toastRef?.(`🎡 ${player} đang đặt cược và quay Vòng Quay Roulette!`);
      }
    } else if (game === 'duck_derby') {
      const dd = worldRef?.casinoObjs?.find(o => o.userData?.type === 'duck_derby');
      dd?.userData?.startRace?.();
      if (subAction === 'start_race') {
        if (activeCasinoTable.hostId !== senderId) return;
        updateCasinoTicker(`🦆 ${player} đã bấm còi bắt đầu cuộc đua vịt Duck Derby!`);
        toastRef?.(`🦆 ${player} vừa bấm chuông bắt đầu cuộc đua vịt Duck Derby!`);
        activeDuckDerbyInstance?.onPeerStartRace?.(player, op.winningDuck);
      } else {
        toastRef?.(`🦆 ${player} vừa bấm chuông bắt đầu cuộc đua vịt Duck Derby!`);
      }
    } else if (game === 'slot_machine') {
      const sm = worldRef?.casinoObjs?.find(o => o.userData?.type === 'slot_machine');
      sm?.userData?.pullLever?.();
      updateCasinoTicker(`🎰 ${player} vừa giật cần quay Slot Machine 777!`);
      toastRef?.(`🎰 ${player} vừa giật cần quay Slot Machine 777!`);
    } else if (game === 'plinko') {
      const pk = worldRef?.casinoObjs?.find(o => o.userData?.type === 'plinko');
      pk?.userData?.dropBall?.();
      if (subAction === 'drop') {
        updateCasinoTicker(`🟡 ${player} vừa thả bóng Plinko cược ${op.bet || 25} Xu!`);
        toastRef?.(`⚡ ${player} vừa thả bóng chông Plinko!`);
        activePlinkoInstance?.addPeerBall?.(player, op.bet || 25, op.xOffset || 0);
      } else {
        toastRef?.(`⚡ ${player} vừa thả bóng chông Plinko!`);
      }
    }
  }
}

// Helper to create and show a casino modal frame
function createCasinoModal(title, contentHtml) {
  // Remove any existing casino overlay
  document.querySelectorAll('.casino-modal-overlay').forEach(el => el.remove());
  if (activeCasinoTable) leaveActiveCasinoTable();
  casinoTableUi = null;
  activePlinkoInstance = null;
  activeRouletteInstance = null;
  activeDuckDerbyInstance = null;
  activeBlackjackInstance = null;

  const overlay = document.createElement('div');
  overlay.className = 'casino-modal-overlay';

  overlay.innerHTML = `
    <div class="casino-frame">
      <div class="casino-header">
        <div class="casino-title-wrap">
          <span style="font-size:24px">🎰</span>
          <span class="casino-title">${title}</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="casino-wallet-badge" id="btnCasinoModalWallet" title="Ví Xu - Nhập code bí mật quanh các map để nhận thêm 500 Xu!">
            <span>🪙 VÍ XU:</span>
            <b class="casino-chip-count">${coins.toLocaleString()} Xu</b>
          </div>
          <button class="casino-close-btn" id="btnCloseCasinoModal" title="Đóng [ESC]">✕</button>
        </div>
      </div>
      <div class="casino-body">
        ${contentHtml}
      </div>
      <div class="casino-live-ticker" id="casinoLiveTicker">
        <span class="ticker-pulse">🔴 MULTIPLAYER:</span>
        <span class="ticker-text" id="casinoTickerText">Đang đồng bộ bàn chơi cùng bạn bè trong phòng...</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const cleanupAndClose = () => {
    leaveActiveCasinoTable();
    casinoTableUi = null;
    activePlinkoInstance = null;
    activeRouletteInstance = null;
    activeDuckDerbyInstance = null;
    activeBlackjackInstance = null;
    overlay.remove();
    window.removeEventListener('keydown', escHandler);
  };

  overlay.querySelector('#btnCloseCasinoModal').onclick = cleanupAndClose;
  const walletBadge = overlay.querySelector('#btnCasinoModalWallet');
  if (walletBadge) {
    walletBadge.onclick = () => {
      window.dispatchEvent(new CustomEvent('gh_open_code_dialog'));
    };
  }

  const escHandler = e => {
    if (e.key === 'Escape') {
      cleanupAndClose();
    }
  };
  window.addEventListener('keydown', escHandler);

  return overlay;
}

// ============================================================================
// 1. ROULETTE (VÒNG QUAY MÁ HỒNG)
// ============================================================================
export function openRoulette() {
  const content = `
    <div class="roulette-arena">
      <div class="roulette-wheel-box">
        <canvas id="rouletteCanvas" width="300" height="300"></canvas>
        <div id="rouletteResult" class="casino-result-toast" style="min-width:260px">
          🎡 Hãy chọn mệnh giá Xu, đặt cược trên bàn nỉ rồi bấm QUAY!
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;align-items:center">
        <!-- Betting Grid -->
        <div class="roulette-bet-grid" id="rouletteGrid"></div>
        <!-- Chip Value Selector -->
        <div class="casino-chips-row" style="background:transparent;padding:0">
          <span style="font-size:12px;font-weight:700;color:#fef08a">MỆNH GIÁ CƯỢC:</span>
          <div class="casino-chip-btn chip-10 selected" data-val="10">10 Xu</div>
          <div class="casino-chip-btn chip-25" data-val="25">25 Xu</div>
          <div class="casino-chip-btn chip-50" data-val="50">50 Xu</div>
          <div class="casino-chip-btn chip-100" data-val="100">100 Xu</div>
          <div class="casino-chip-btn chip-500" data-val="500">500 Xu</div>
        </div>
        <!-- Actions -->
        <div style="display:flex;gap:10px;margin-top:6px">
          <button id="btnSpinRoulette" class="casino-action-btn">🎡 QUAY BÁNH XE (SPIN)</button>
          <button id="btnClearRouletteBets" class="casino-action-btn secondary">✕ Xóa Cược</button>
        </div>
      </div>
    </div>
  `;

  const modal = createCasinoModal('VÒNG QUAY ROULETTE CHÂU ÂU (37 SỐ)', content);
  addCasinoTableUi(modal, 'roulette');
  const canvas = modal.querySelector('#rouletteCanvas');
  const ctx = canvas.getContext('2d');

  let selectedChipVal = 10;
  modal.querySelectorAll('.casino-chip-btn').forEach(btn => {
    btn.onclick = () => {
      modal.querySelectorAll('.casino-chip-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedChipVal = parseInt(btn.dataset.val, 10);
      playSfx('blackjack_deal', 'casino');
    };
  });

  // Build Betting Grid
  const gridContainer = modal.querySelector('#rouletteGrid');
  const bets = new Map(); // key -> totalBetAmount
  const peerBets = new Map(); // key -> Array of { player, amount }
  const redNumbers = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

  function getBadgesHtml(key) {
    let html = '';
    if (bets.has(key)) {
      html += `<span class="chip-badge">${bets.get(key)} Xu</span>`;
    }
    if (peerBets.has(key)) {
      peerBets.get(key).forEach(pb => {
        html += `<span class="peer-chip-badge" title="${pb.player}: ${pb.amount} Xu">${pb.player}: ${pb.amount}</span>`;
      });
    }
    return html;
  }

  function renderGrid() {
    gridContainer.innerHTML = '';

    // Row 0: Green 0
    const row0 = document.createElement('div');
    row0.className = 'roulette-grid-row';
    const cell0 = document.createElement('div');
    cell0.className = 'roulette-cell cell-green';
    cell0.dataset.bet = '0';
    cell0.innerHTML = `0 ${getBadgesHtml('0')}`;
    row0.appendChild(cell0);
    gridContainer.appendChild(row0);

    // Rows 1-36 in 12 columns of 3
    for (let r = 0; r < 3; r++) {
      const row = document.createElement('div');
      row.className = 'roulette-grid-row';
      for (let c = 0; c < 12; c++) {
        const num = c * 3 + (3 - r);
        const isRed = redNumbers.has(num);
        const cell = document.createElement('div');
        cell.className = `roulette-cell ${isRed ? 'cell-red' : 'cell-black'}`;
        cell.dataset.bet = String(num);
        cell.innerHTML = `${num} ${getBadgesHtml(String(num))}`;
        row.appendChild(cell);
      }
      gridContainer.appendChild(row);
    }

    // Outside Bets Row
    const sideRow = document.createElement('div');
    sideRow.className = 'roulette-grid-row';
    const sideBets = [
      { id: '1-12', label: '1st 12' },
      { id: '13-24', label: '2nd 12' },
      { id: '25-36', label: '3rd 12' },
      { id: 'RED', label: 'RED' },
      { id: 'BLACK', label: 'BLACK' },
      { id: 'EVEN', label: 'EVEN' },
      { id: 'ODD', label: 'ODD' },
    ];
    sideBets.forEach(sb => {
      const cell = document.createElement('div');
      cell.className = 'roulette-cell cell-special';
      cell.dataset.bet = sb.id;
      cell.innerHTML = `${sb.label} ${getBadgesHtml(sb.id)}`;
      sideRow.appendChild(cell);
    });
    gridContainer.appendChild(sideRow);

    // Attach click listeners to cells
    gridContainer.querySelectorAll('.roulette-cell').forEach(cell => {
      cell.onclick = () => {
        if (isSpinning) return;
        const betKey = cell.dataset.bet;
        if (!spendCoins(selectedChipVal)) {
          toastRef?.('⚠️ Bạn không đủ Xu để đặt cược!');
          return;
        }
        bets.set(betKey, (bets.get(betKey) || 0) + selectedChipVal);
        playSfx('slot_lever', 'casino');
        renderGrid();

        // Broadcast bet to peers in the room
        broadcastCasinoPlay('roulette', `cược ${betKey}`, { subAction: 'bet', betKey, amount: selectedChipVal });
      };
    });
  }
  renderGrid();

  modal.querySelector('#btnClearRouletteBets').onclick = () => {
    let refund = 0;
    bets.forEach(v => (refund += v));
    bets.clear();
    addChips(refund);
    renderGrid();
    toastRef?.('Đã xóa toàn bộ cược trên bàn.');
  };

  // Wheel Rendering & Animation
  // European wheel sequence: 0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  const wheelNumbers = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  let wheelAngle = 0;
  let ballAngle = 0;
  let ballRadius = 115;
  let isSpinning = false;

  function drawWheel() {
    const cx = 150, cy = 150, r = 135;
    ctx.clearRect(0, 0, 300, 300);

    // Outer Mahogany Rim
    ctx.beginPath();
    ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
    ctx.fillStyle = '#5c2207';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#d97706';
    ctx.stroke();

    // Wheel Pockets
    const slice = (Math.PI * 2) / wheelNumbers.length;
    for (let i = 0; i < wheelNumbers.length; i++) {
      const angle = wheelAngle + i * slice;
      const num = wheelNumbers[i];
      const isGreen = num === 0;
      const isRed = redNumbers.has(num);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = isGreen ? '#16a34a' : isRed ? '#dc2626' : '#18181b';
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Number label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle + slice / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(String(num), r - 12, 3);
      ctx.restore();
    }

    // Inner Brass Centerpiece
    ctx.beginPath();
    ctx.arc(cx, cy, 55, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#78350f';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#d97706';
    ctx.fill();

    // Ivory Ball
    const bx = cx + Math.cos(ballAngle) * ballRadius;
    const by = cy + Math.sin(ballAngle) * ballRadius;
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();
  }
  drawWheel();

  function startSpin(winningNum, isLocal = true, spinnerName = 'Bạn') {
    isSpinning = true;
    modal.querySelector('#btnSpinRoulette').disabled = true;
    modal.querySelector('#btnClearRouletteBets').disabled = true;
    modal.querySelector('#rouletteResult').innerHTML = `🎡 ${spinnerName} đang quay bánh xe...`;

    playSfx('roulette_spin', 'casino');

    // Trigger 3D world table spin
    const rt = worldRef?.casinoObjs?.find(o => o.userData?.type === 'roulette');
    rt?.userData?.spinWheel ? rt.userData.spinWheel() : rt?.userData?.spin?.();

    const winIdx = wheelNumbers.indexOf(winningNum);
    const slice = (Math.PI * 2) / wheelNumbers.length;

    let wheelSpeed = 0.28 + Math.random() * 0.08;
    let ballSpeed = -0.38 - Math.random() * 0.08;
    ballRadius = 120;

    const startTime = performance.now();
    const duration = 5200; // 5.2s spin

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      if (progress < 1) {
        wheelAngle += wheelSpeed;
        ballAngle += ballSpeed;
        wheelSpeed *= 0.988;
        ballSpeed *= 0.985;
        if (progress > 0.65) {
          ballRadius = 120 - ((progress - 0.65) / 0.35) * 45; // spiral inwards to pocket
        }
        drawWheel();
        requestAnimationFrame(animate);
      } else {
        // Snap to exact winning pocket
        ballAngle = wheelAngle + winIdx * slice + slice / 2;
        ballRadius = 75;
        drawWheel();
        finishSpin(winningNum, isLocal, spinnerName);
      }
    }
    requestAnimationFrame(animate);
  }

  // Hook for multiplayer synchronization
  activeRouletteInstance = {
    onPeerBet: (player, betKey, amount) => {
      if (!peerBets.has(betKey)) peerBets.set(betKey, []);
      peerBets.get(betKey).push({ player, amount });
      renderGrid();
      playSfx('slot_lever', 'casino');
    },
    onPeerSpin: (player, winningNum) => {
      if (!isSpinning) {
        startSpin(winningNum, false, player);
      }
    },
  };

  // Spin Logic
  modal.querySelector('#btnSpinRoulette').onclick = () => {
    if (isSpinning) return;
    if (activeCasinoTable?.game === 'roulette' &&
        activeCasinoTable.hostId !== getCasinoPlayer().id) {
      toastRef?.('Chủ bàn sẽ bắt đầu vòng quay Roulette chung.');
      return;
    }
    if (bets.size === 0) {
      toastRef?.('⚠️ Vui lòng đặt cược ít nhất vào 1 ô trên bàn!');
      return;
    }

    // Random Winning Number (0-36)
    const winningNum = Math.floor(Math.random() * 37);

    // Broadcast spin to all peers in the room
    broadcastCasinoPlay('roulette', 'spin', { subAction: 'spin', winningNum });

    startSpin(winningNum, true, 'Bạn');
  };

  function finishSpin(winningNum, isLocal = true, spinnerName = 'Bạn') {
    isSpinning = false;
    modal.querySelector('#btnSpinRoulette').disabled = false;
    modal.querySelector('#btnClearRouletteBets').disabled = false;

    const isRed = redNumbers.has(winningNum);
    const colName = winningNum === 0 ? '🟢 Số 0 XANH' : isRed ? `🔴 Số ${winningNum} ĐỎ` : `⚫ Số ${winningNum} ĐEN`;
    const isEven = winningNum !== 0 && winningNum % 2 === 0;

    // Calculate Payouts for local bets
    let totalWin = 0;
    bets.forEach((betAmt, betKey) => {
      if (betKey === String(winningNum)) {
        totalWin += betAmt * 36; // Straight up 35:1 (returns 36x)
      } else if (betKey === 'RED' && isRed) {
        totalWin += betAmt * 2;
      } else if (betKey === 'BLACK' && !isRed && winningNum !== 0) {
        totalWin += betAmt * 2;
      } else if (betKey === 'EVEN' && isEven) {
        totalWin += betAmt * 2;
      } else if (betKey === 'ODD' && winningNum !== 0 && !isEven) {
        totalWin += betAmt * 2;
      } else if (betKey === '1-12' && winningNum >= 1 && winningNum <= 12) {
        totalWin += betAmt * 3;
      } else if (betKey === '13-24' && winningNum >= 13 && winningNum <= 24) {
        totalWin += betAmt * 3;
      } else if (betKey === '25-36' && winningNum >= 25 && winningNum <= 36) {
        totalWin += betAmt * 3;
      }
    });

    if (totalWin > 0) {
      addCoins(totalWin);
      if (bets.has(String(winningNum))) {
        recordJackpotWin('roulette');
      } else {
        playSfx('slot_win', 'casino');
      }
      modal.querySelector('#rouletteResult').innerHTML = `
        <span style="color:#4ade80;font-size:16px">🎉 THẮNG LỚN +${totalWin.toLocaleString()} Xu!</span><br>
        Bóng rơi vào <b>${colName}</b>!
      `;
      updateCasinoTicker(`🎉 ${spinnerName} và bàn Roulette trúng lớn với kết quả [${colName}]!`);
    } else {
      modal.querySelector('#rouletteResult').innerHTML = `
        Bóng rơi vào <b>${colName}</b>${isLocal ? '. Chúc bạn may mắn lần sau!' : ` (Quay bởi ${spinnerName})`}
      `;
      updateCasinoTicker(`🎡 Vòng Quay Roulette vừa ra kết quả [${colName}].`);
    }
    bets.clear();
    peerBets.clear();
    renderGrid();
  }
  }

// ============================================================================
// 2. DUCK DERBY (ĐUA VỊT CAO SU TRỰC TIẾP)
// ============================================================================
export function openDuckDerby() {
  const content = `
    <div class="duck-derby-arena">
      <canvas id="duckRaceCanvas" width="760" height="220"></canvas>
      <div id="duckRaceToast" class="casino-result-toast" style="width:100%">
        🦆 Chọn chú vịt cưng và mức cược của bạn, sau đó nhấn BẮT ĐẦU ĐUA!
      </div>
      <!-- Duck Selection Cards -->
      <div class="duck-cards-row">
        <div class="duck-card selected" data-duck="0">
          <span class="duck-card-icon">⚡🐥</span>
          <span class="duck-card-name" style="color:#facc15">#1 Vịt Vàng Tia Chớp</span>
          <span class="duck-card-odds">Tỉ lệ cược: 2.5x</span>
        </div>
        <div class="duck-card" data-duck="1">
          <span class="duck-card-icon">🎀🦆</span>
          <span class="duck-card-name" style="color:#ec4899">#2 Vịt Hồng Kiêu Kỳ</span>
          <span class="duck-card-odds">Tỉ lệ cược: 3.0x</span>
        </div>
        <div class="duck-card" data-duck="2">
          <span class="duck-card-icon">🌪️🦆</span>
          <span class="duck-card-name" style="color:#10b981">#3 Vịt Xanh Bão Tố</span>
          <span class="duck-card-odds">Tỉ lệ cược: 4.0x</span>
        </div>
        <div class="duck-card" data-duck="3">
          <span class="duck-card-icon">🚀🦆</span>
          <span class="duck-card-name" style="color:#8b5cf6">#4 Vịt Tím Thần Tốc</span>
          <span class="duck-card-odds">Tỉ lệ cược: 5.0x</span>
        </div>
      </div>
      <!-- Chips & Actions -->
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center;flex-wrap:wrap;gap:10px">
        <div class="casino-chips-row" style="background:transparent;padding:0">
          <span style="font-size:12px;font-weight:700;color:#fef08a">MỨC CƯỢC:</span>
          <div class="casino-chip-btn chip-25" data-val="25">25 Xu</div>
          <div class="casino-chip-btn chip-50 selected" data-val="50">50 Xu</div>
          <div class="casino-chip-btn chip-100" data-val="100">100 Xu</div>
          <div class="casino-chip-btn chip-500" data-val="500">500 Xu</div>
        </div>
        <button id="btnStartDuckRace" class="casino-action-btn">🏁 BẮT ĐẦU ĐUA (START RACE)</button>
      </div>
    </div>
  `;

  const modal = createCasinoModal('TRƯỜNG ĐUA VỊT CAO SU DUCK DERBY', content);
  addCasinoTableUi(modal, 'duck_derby');
  const canvas = modal.querySelector('#duckRaceCanvas');
  const ctx = canvas.getContext('2d');

  let chosenDuckIdx = 0;
  let betAmount = 50;
  let isRacing = false;

  modal.querySelectorAll('.duck-card').forEach(card => {
    card.onclick = () => {
      if (isRacing) return;
      modal.querySelectorAll('.duck-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      chosenDuckIdx = parseInt(card.dataset.duck, 10);
      playSfx('duck_quack', 'casino');
    };
  });

  modal.querySelectorAll('.casino-chip-btn').forEach(btn => {
    btn.onclick = () => {
      if (isRacing) return;
      modal.querySelectorAll('.casino-chip-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      betAmount = parseInt(btn.dataset.val, 10);
      playSfx('blackjack_deal', 'casino');
    };
  });

  const ducks = [
    { name: 'Vịt Vàng Tia Chớp', color: '#facc15', odds: 2.5, x: 50, speed: 0 },
    { name: 'Vịt Hồng Kiêu Kỳ', color: '#ec4899', odds: 3.0, x: 50, speed: 0 },
    { name: 'Vịt Xanh Bão Tố', color: '#10b981', odds: 4.0, x: 50, speed: 0 },
    { name: 'Vịt Tím Thần Tốc', color: '#8b5cf6', odds: 5.0, x: 50, speed: 0 },
  ];

  function drawTrack() {
    ctx.clearRect(0, 0, 760, 220);

    // Water canal background
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 760, 220);

    // Water wave lines
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    for (let l = 1; l < 4; l++) {
      const y = l * 55;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(760, y);
      ctx.stroke();
    }

    // Finish Line Checkered Banner at x = 700
    const finishX = 700;
    for (let y = 0; y < 220; y += 11) {
      for (let x = finishX; x < finishX + 22; x += 11) {
        ctx.fillStyle = ((x + y) / 11) % 2 === 0 ? '#ffffff' : '#000000';
        ctx.fillRect(x, y, 11, 11);
      }
    }

    // Draw Ducks
    ducks.forEach((d, i) => {
      const y = i * 55 + 28;
      // Water ripples behind duck
      ctx.beginPath();
      ctx.arc(d.x - 14, y + 4, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();

      // Duck Body
      ctx.beginPath();
      ctx.ellipse(d.x, y, 16, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();

      // Duck Head
      ctx.beginPath();
      ctx.arc(d.x + 10, y - 8, 8, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.stroke();

      // Beak
      ctx.beginPath();
      ctx.moveTo(d.x + 16, y - 8);
      ctx.lineTo(d.x + 23, y - 6);
      ctx.lineTo(d.x + 16, y - 4);
      ctx.fillStyle = '#ea580c';
      ctx.fill();

      // Eye
      ctx.beginPath();
      ctx.arc(d.x + 13, y - 10, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();

      // Bib Number
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`#${i + 1}`, d.x - 4, y + 3);
    });
  }
  drawTrack();

  function startRace(winningDuck, hasBet = true, racerName = 'Bạn') {
    isRacing = true;
    modal.querySelector('#btnStartDuckRace').disabled = true;
    modal.querySelector('#duckRaceToast').innerHTML = `🏁 Cuộc đua của ${racerName} đang diễn ra kịch tính...`;

    playSfx('duck_quack', 'casino');

    // Trigger 3D world duck track
    const dd = worldRef?.casinoObjs?.find(o => o.userData?.type === 'duck_derby');
    dd?.userData?.startRace?.();

    const winnerIdx = Math.max(0, Math.min(ducks.length - 1, Number(winningDuck) || 0));
    const startTime = performance.now();
    const duration = 5000;
    const loserPaces = [0.76, 0.82, 0.88, 0.94];
    function raceLoop(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      ducks.forEach((d, i) => {
        const pace = i === winnerIdx ? 1 : loserPaces[(i + winnerIdx) % loserPaces.length];
        d.x = 40 + 660 * progress * pace;
      });
      drawTrack();
      if (progress < 1) {
        requestAnimationFrame(raceLoop);
      } else {
        finishRace(winnerIdx, hasBet, racerName);
      }
    }
    requestAnimationFrame(raceLoop);
  }

  // Multiplayer Hook for Duck Derby
  activeDuckDerbyInstance = {
    onPeerStartRace: (player, winningDuck) => {
      if (!isRacing) {
        const hasBet = spendCoins(betAmount);
        startRace(winningDuck, hasBet, player);
      }
    },
  };

  modal.querySelector('#btnStartDuckRace').onclick = () => {
    if (isRacing) return;
    if (activeCasinoTable?.game === 'duck_derby' &&
        activeCasinoTable.hostId !== getCasinoPlayer().id) {
      toastRef?.('Chủ bàn sẽ bắt đầu cuộc đua Duck Derby chung.');
      return;
    }
    if (!spendCoins(betAmount)) {
      toastRef?.('⚠️ Bạn không đủ Xu để đặt cược!');
      return;
    }

    const winningDuck = Math.floor(Math.random() * ducks.length);

    // Broadcast race start to all peers in the room
    broadcastCasinoPlay('duck_derby', ducks[chosenDuckIdx]?.name || 'Vịt', {
      subAction: 'start_race',
      chosenDuck: chosenDuckIdx,
      winningDuck,
    });

    startRace(winningDuck, true, 'Bạn');
  };

  function finishRace(winIdx, hasBet = true, racerName = 'Bạn') {
    isRacing = false;
    modal.querySelector('#btnStartDuckRace').disabled = false;

    const winner = ducks[winIdx];
    if (hasBet && winIdx === chosenDuckIdx) {
      const payout = Math.floor(betAmount * winner.odds);
      addCoins(payout);
      recordJackpotWin('duck_derby');
      modal.querySelector('#duckRaceToast').innerHTML = `
        <span style="color:#4ade80;font-size:16px">🏆 VÔ ĐỊCH: #${winIdx + 1} ${winner.name}!</span>
        Chúc mừng bạn đã đoán trúng và nhận <b>+${payout.toLocaleString()} Xu</b>!
      `;
      updateCasinoTicker(`🏆 ${racerName} vừa thắng cược ${payout.toLocaleString()} Xu với Vịt #${winIdx + 1}!`);
    } else {
      modal.querySelector('#duckRaceToast').innerHTML = `
        🏆 Vô địch là: <b>#${winIdx + 1} ${winner.name}</b>.${racerName === 'Bạn' ? ' Chúc bạn may mắn ở vòng đua sau!' : ` (Đua bởi ${racerName})`}
      `;
      updateCasinoTicker(`🦆 Cuộc đua Duck Derby kết thúc: Vịt #${winIdx + 1} (${winner.name}) về nhất!`);
    }
  }
}

// ============================================================================
// 3. BLACKJACK (XÌ DÁCH CASINO LAS VEGAS VIP)
// ============================================================================
export function openBlackjack() {
  const content = `
    <div class="blackjack-arena">
      <!-- Dealer Area -->
      <div class="bj-hand-box">
        <div class="bj-hand-header">
          <span>🤵 NHÀ CÁI (DEALER)</span>
          <span id="dealerScore">Điểm: ?</span>
        </div>
        <div class="bj-cards-row" id="dealerCards"></div>
      </div>
      <!-- Center Result Toast -->
      <div id="bjResultToast" class="casino-result-toast">
        🃏 Hãy chọn mức cược và nhấn CHIA BÀI (DEAL) để bắt đầu ván bài 21 điểm!
      </div>
      <!-- Player Area -->
      <div class="bj-hand-box" id="bjSoloPlayerBox">
        <div class="bj-hand-header">
          <span>🧑 BẠN (PLAYER)</span>
          <span id="playerScore">Điểm: 0</span>
        </div>
        <div class="bj-cards-row" id="playerCards"></div>
      </div>
      <div class="bj-hand-box bj-shared-players" id="bjSharedPlayers" hidden></div>
      <!-- Controls -->
      <div class="bj-controls-row">
        <div class="casino-chips-row" style="background:transparent;padding:0">
          <span style="font-size:12px;font-weight:700;color:#fef08a">CƯỢC:</span>
          <div class="casino-chip-btn chip-25" data-val="25">25 Xu</div>
          <div class="casino-chip-btn chip-50 selected" data-val="50">50 Xu</div>
          <div class="casino-chip-btn chip-100" data-val="100">100 Xu</div>
          <div class="casino-chip-btn chip-500" data-val="500">500 Xu</div>
        </div>
        <button id="btnDealBj" class="casino-action-btn">🎴 CHIA BÀI (DEAL)</button>
        <button id="btnHitBj" class="casino-action-btn" style="background:#22c55e;color:#fff" disabled>➕ RÚT (HIT)</button>
        <button id="btnStandBj" class="casino-action-btn" style="background:#ef4444;color:#fff" disabled>✋ DẰNG (STAND)</button>
        <button id="btnDoubleBj" class="casino-action-btn" style="background:#3b82f6;color:#fff" disabled>⚡ GẤP ĐÔI (DOUBLE)</button>
      </div>
    </div>
  `;

  const modal = createCasinoModal('BÀN XÌ DÁCH CASINO VIP (BLACKJACK)', content);
  addCasinoTableUi(modal, 'blackjack');

  let betAmount = 50;
  let deck = [];
  let playerCards = [];
  let dealerCards = [];
  let isGameOver = true;
  let sharedMode = false;
  let sharedState = null;
  let pendingSharedBet = null;
  const playerId = getCasinoPlayer().id;
  const settledRoundIds = new Set();
  try {
    const storedRoundIds = JSON.parse(localStorage.getItem('gh_blackjack_settled_rounds') || '[]');
    if (Array.isArray(storedRoundIds)) storedRoundIds.forEach(id => settledRoundIds.add(id));
  } catch (error) {
    console.warn('Could not restore settled Blackjack rounds:', error);
  }

  modal.querySelectorAll('.casino-chip-btn').forEach(btn => {
    btn.onclick = () => {
      if (!isGameOver || (sharedMode && sharedState?.hands?.[playerId]?.status === 'playing')) return;
      modal.querySelectorAll('.casino-chip-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      betAmount = parseInt(btn.dataset.val, 10);
      playSfx('blackjack_deal', 'casino');
    };
  });

  function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const d = [];
    for (const suit of suits) {
      for (const val of values) {
        d.push({
          val,
          suit,
          isRed: suit === '♥' || suit === '♦',
          num: ['J', 'Q', 'K'].includes(val) ? 10 : val === 'A' ? 11 : parseInt(val, 10),
        });
      }
    }
    // Fisher-Yates shuffle
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function calcHandScore(cards) {
    let score = cards.reduce((sum, c) => sum + c.num, 0);
    let aces = cards.filter(c => c.val === 'A').length;
    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }
    return score;
  }

  function renderCard(c, hidden = false) {
    if (hidden) {
      return `<div class="playing-card card-back">♠</div>`;
    }
    return `
      <div class="playing-card ${c.isRed ? 'card-red' : 'card-black'}">
        <div style="font-size:14px">${c.val}${c.suit}</div>
        <div style="font-size:24px;text-align:center">${c.suit}</div>
        <div style="font-size:14px;text-align:right">${c.val}${c.suit}</div>
      </div>
    `;
  }

  function updateTableUI(hideDealerCard = true) {
    const pContainer = modal.querySelector('#playerCards');
    const dContainer = modal.querySelector('#dealerCards');

    pContainer.innerHTML = playerCards.map(c => renderCard(c)).join('');
    dContainer.innerHTML = dealerCards
      .map((c, i) => renderCard(c, i === 1 && hideDealerCard))
      .join('');

    const pScore = calcHandScore(playerCards);
    modal.querySelector('#playerScore').textContent = `Điểm: ${pScore}`;

    if (hideDealerCard && dealerCards.length > 0) {
      modal.querySelector('#dealerScore').textContent = `Điểm: ${dealerCards[0].num}`;
    } else {
      const dScore = calcHandScore(dealerCards);
      modal.querySelector('#dealerScore').textContent = `Điểm: ${dScore}`;
    }
  }

  function renderSharedState(state) {
    if (!sharedMode) return;
    const soloPlayerBox = modal.querySelector('#bjSoloPlayerBox');
    const sharedPlayersBox = modal.querySelector('#bjSharedPlayers');
    soloPlayerBox.hidden = true;
    sharedPlayersBox.hidden = false;
    sharedPlayersBox.replaceChildren();

    const dealerHand = state?.dealerCards || [];
    modal.querySelector('#dealerCards').innerHTML = dealerHand
      .map((card, index) => renderCard(card, state?.status === 'playing' && index === 1))
      .join('');
    modal.querySelector('#dealerScore').textContent = state?.status === 'playing'
      ? `Điểm: ${dealerHand.length ? dealerHand[0].num : '?'}`
      : `Điểm: ${dealerHand.length ? calcHandScore(dealerHand) : '?'}`;

    const heading = document.createElement('div');
    heading.className = 'bj-hand-header';
    heading.textContent = `👥 NGƯỜI CHƠI · ${Object.keys(state?.hands || {}).length}`;
    sharedPlayersBox.appendChild(heading);

    for (const hand of Object.values(state?.hands || {})) {
      const playerBox = document.createElement('div');
      playerBox.className = 'bj-shared-hand';
      const header = document.createElement('div');
      header.className = 'bj-hand-header';
      header.textContent = `${hand.name}${hand.id === playerId ? ' (Bạn)' : ''} · Cược ${hand.bet} Xu · ${hand.status === 'playing' ? 'Đang chơi' : hand.status === 'bust' ? 'Quắc' : 'Đã dằn'}`;
      const cards = document.createElement('div');
      cards.className = 'bj-cards-row';
      cards.innerHTML = hand.cards.map(card => renderCard(card)).join('');
      const score = document.createElement('div');
      score.className = 'bj-player-score';
      score.textContent = `Điểm: ${calcHandScore(hand.cards)}`;
      playerBox.append(header, cards, score);
      sharedPlayersBox.appendChild(playerBox);
    }

    const hand = state?.hands?.[playerId];
    const canAct = state?.status === 'playing' && hand?.status === 'playing';
    const canJoin = !state || state.status === 'playing' || state.status === 'settled';
    modal.querySelector('#btnDealBj').disabled = !canJoin || (!!hand && state?.status === 'playing');
    modal.querySelector('#btnDealBj').textContent = hand && state?.status === 'playing'
      ? '🎴 ĐANG Ở TRONG VÁN'
      : '🎴 VÀO VÁN CHUNG';
    modal.querySelector('#btnHitBj').disabled = !canAct;
    modal.querySelector('#btnStandBj').disabled = !canAct;
    modal.querySelector('#btnDoubleBj').disabled = !canAct || coins < (hand?.bet || betAmount);

    if (!state) {
      modal.querySelector('#bjResultToast').textContent = '👥 Bàn đã mở. Chọn mức cược rồi nhấn VÀO VÁN CHUNG để nhận bài.';
    } else if (state.status === 'playing') {
      modal.querySelector('#bjResultToast').textContent = hand
        ? '🃏 Ván chung đang diễn ra. Hãy rút, dằn hoặc gấp đôi lượt của bạn.'
        : '🃏 Ván chung đang mở. Chọn mức cược rồi nhấn VÀO VÁN CHUNG để tham gia.';
    } else if (state.status === 'dealer') {
      modal.querySelector('#bjResultToast').textContent = '🤵 Nhà cái đang rút bài...';
    } else {
      modal.querySelector('#bjResultToast').textContent = '✅ Ván bài đã kết thúc. Bạn có thể vào ván tiếp theo.';
    }
  }

  function publishSharedState() {
    const table = activeCasinoTable;
    if (!table || table.game !== 'blackjack' || table.hostId !== playerId) return;
    table.blackjackState = sharedState;
    activeBlackjackInstance?.onTableState?.(sharedState);
    sendCasinoTableMessage('blackjack_state', {
      tableId: table.id,
      game: 'blackjack',
      state: sharedState,
    });
  }

  function settleSharedHand(state) {
    if (state?.status !== 'settled') return;
    const hand = state.hands?.[playerId];
    if (!hand || settledRoundIds.has(state.roundId)) return;
    settledRoundIds.add(state.roundId);
    if (settledRoundIds.size > 100) settledRoundIds.delete(settledRoundIds.values().next().value);

    const playerScore = calcHandScore(hand.cards);
    const dealerScore = calcHandScore(state.dealerCards);
    const natural = playerScore === 21 && hand.cards.length === 2;
    let payout = 0;
    let result = 'Nhà cái thắng. Hãy thử lại ván sau!';
    if (playerScore <= 21 && natural && (dealerScore !== 21 || state.dealerCards.length > 2)) {
      payout = Math.floor(hand.bet * 2.5);
      result = `⭐ BLACKJACK 21 ĐIỂM! Bạn nhận +${payout.toLocaleString()} Xu!`;
    } else if (playerScore > 21) {
      result = '💥 Bạn bị quắc (>21). Nhà cái thắng.';
    } else if (dealerScore > 21 || playerScore > dealerScore) {
      payout = hand.bet * 2;
      result = `🎉 Bạn thắng (${playerScore} vs ${dealerScore})! Nhận +${payout.toLocaleString()} Xu!`;
    } else if (playerScore === dealerScore) {
      payout = hand.bet;
      result = `🤝 Hòa (${playerScore} điểm)! Hoàn lại tiền cược.`;
    }
    if (payout) addCoins(payout);
    if (natural && payout) recordJackpotWin('blackjack');
    try {
      localStorage.setItem('gh_blackjack_settled_rounds', JSON.stringify([...settledRoundIds]));
    } catch (error) {
      console.warn('Could not persist settled Blackjack rounds:', error);
    }
    modal.querySelector('#bjResultToast').textContent = result;
  }

  function resolveSharedDealer() {
    if (!sharedState || sharedState.status !== 'playing') return;
    if (Object.values(sharedState.hands).some(hand => hand.status === 'playing')) return;
    sharedState.status = 'dealer';
    publishSharedState();
    const roundId = sharedState.roundId;
    const dealerStep = () => {
      if (!sharedState || sharedState.roundId !== roundId || sharedState.status !== 'dealer') return;
      const hasLiveHand = Object.values(sharedState.hands).some(hand => hand.status !== 'bust');
      if (hasLiveHand && calcHandScore(sharedState.dealerCards) < 17 && sharedState.deck.length) {
        sharedState.dealerCards.push(sharedState.deck.pop());
        publishSharedState();
        setTimeout(dealerStep, 500);
      } else {
        sharedState.status = 'settled';
        publishSharedState();
      }
    };
    setTimeout(dealerStep, 450);
  }

  function addSharedPlayer(playerIdToAdd, playerName, bet, senderId) {
    const table = activeCasinoTable;
    if (!table || table.game !== 'blackjack' || table.hostId !== playerId || playerIdToAdd !== senderId) return false;
    if (!playerIdToAdd || ![25, 50, 100, 500].includes(Number(bet))) return false;
    if (!sharedState || sharedState.status === 'settled') {
      sharedState = {
        roundId: `${table.id}-${Date.now().toString(36)}`,
        status: 'playing',
        deck: createDeck(),
        dealerCards: [],
        hands: {},
      };
      sharedState.dealerCards = [sharedState.deck.pop(), sharedState.deck.pop()];
    }
    if (sharedState.status !== 'playing' || sharedState.hands[playerIdToAdd] ||
        Object.keys(sharedState.hands).length >= 7) return false;

    sharedState.hands[playerIdToAdd] = {
      id: playerIdToAdd,
      name: String(playerName || 'Người chơi').slice(0, 32),
      bet: Number(bet),
      cards: [sharedState.deck.pop(), sharedState.deck.pop()],
      status: 'playing',
    };
    publishSharedState();
    return true;
  }

  function applySharedAction(playerIdToAct, action, senderId) {
    if (!sharedState || sharedState.status !== 'playing' || senderId !== playerIdToAct) return;
    const hand = sharedState.hands[playerIdToAct];
    if (!hand || hand.status !== 'playing') return;

    if (action === 'hit') {
      hand.cards.push(sharedState.deck.pop());
      if (calcHandScore(hand.cards) > 21) hand.status = 'bust';
    } else if (action === 'stand') {
      hand.status = 'stood';
    } else if (action === 'double') {
      hand.bet *= 2;
      hand.cards.push(sharedState.deck.pop());
      hand.status = calcHandScore(hand.cards) > 21 ? 'bust' : 'stood';
    } else {
      return;
    }
    publishSharedState();
    resolveSharedDealer();
  }

  activeBlackjackInstance = {
    onRoomJoined: state => {
      sharedMode = true;
      isGameOver = true;
      sharedState = state || null;
      renderSharedState(sharedState);
    },
    onRoomLeft: () => {
      sharedMode = false;
      sharedState = null;
      modal.querySelector('#bjSoloPlayerBox').hidden = false;
      modal.querySelector('#bjSharedPlayers').hidden = true;
      modal.querySelector('#btnDealBj').textContent = '🎴 CHIA BÀI (DEAL)';
      updateTableUI(true);
    },
    onTableState: state => {
      if (!sharedMode) return;
      sharedState = state;
      if (sharedState?.hands?.[playerId]) pendingSharedBet = null;
      renderSharedState(sharedState);
      settleSharedHand(sharedState);
    },
    onPeerJoin: (peerId, peerName, peerBet, senderId) => {
      const accepted = addSharedPlayer(peerId, peerName, peerBet, senderId);
      sendCasinoTableMessage('blackjack_join_result', {
        tableId: activeCasinoTable.id,
        game: 'blackjack',
        targetId: senderId,
        accepted,
      });
    },
    onPeerAction: (peerId, action, senderId) => applySharedAction(peerId, action, senderId),
    onJoinResult: accepted => {
      if (accepted) {
        pendingSharedBet = null;
      } else if (pendingSharedBet !== null) {
        addCoins(pendingSharedBet);
        pendingSharedBet = null;
        renderSharedState(sharedState);
        modal.querySelector('#bjResultToast').textContent = 'Bàn đã chuyển sang nhà cái hoặc đủ người; tiền cược đã được hoàn lại.';
      }
    },
  };

  function lockSharedActions() {
    modal.querySelector('#btnHitBj').disabled = true;
    modal.querySelector('#btnStandBj').disabled = true;
    modal.querySelector('#btnDoubleBj').disabled = true;
  }

  // DEAL
  modal.querySelector('#btnDealBj').onclick = () => {
    if (sharedMode && activeCasinoTable?.game === 'blackjack') {
      if (!spendCoins(betAmount)) {
        toastRef?.('⚠️ Bạn không đủ Xu để vào ván Blackjack!');
        return;
      }
      modal.querySelector('#btnDealBj').disabled = true;
      if (activeCasinoTable.hostId === playerId) {
        if (!addSharedPlayer(playerId, getCasinoPlayer().name, betAmount, playerId)) {
          addCoins(betAmount);
          renderSharedState(sharedState);
        }
      } else {
        pendingSharedBet = betAmount;
        sendCasinoTableMessage('blackjack_join', {
          tableId: activeCasinoTable.id,
          game: 'blackjack',
          bet: betAmount,
        });
        modal.querySelector('#bjResultToast').textContent = '⏳ Đang chờ chủ bàn chia bài chung...';
      }
      return;
    }
    if (!spendCoins(betAmount)) {
      toastRef?.('⚠️ Bạn không đủ Xu để đặt cược!');
      return;
    }

    deck = createDeck();
    playerCards = [deck.pop(), deck.pop()];
    dealerCards = [deck.pop(), deck.pop()];
    isGameOver = false;

    playSfx('blackjack_deal', 'casino');

    modal.querySelector('#btnDealBj').disabled = true;
    modal.querySelector('#btnHitBj').disabled = false;
    modal.querySelector('#btnStandBj').disabled = false;
    modal.querySelector('#btnDoubleBj').disabled = coins < betAmount;
    modal.querySelector('#bjResultToast').textContent = '🃏 Lượt của bạn! Bạn muốn RÚT THÊM hay DẰNG BÀI?';

    updateTableUI(true);

    // Natural Blackjack 21 check
    if (calcHandScore(playerCards) === 21) {
      finishGame();
    }
  };

  // HIT
  modal.querySelector('#btnHitBj').onclick = () => {
    if (sharedMode && activeCasinoTable?.game === 'blackjack') {
      lockSharedActions();
      if (activeCasinoTable.hostId === playerId) {
        applySharedAction(playerId, 'hit', playerId);
      } else {
        sendCasinoTableMessage('blackjack_action', {
          tableId: activeCasinoTable.id,
          game: 'blackjack',
          action: 'hit',
        });
      }
      return;
    }
    playerCards.push(deck.pop());
    playSfx('blackjack_deal', 'casino');
    modal.querySelector('#btnDoubleBj').disabled = true;
    updateTableUI(true);

    if (calcHandScore(playerCards) > 21) {
      // Bust
      finishGame();
    }
  };

  // DOUBLE DOWN
  modal.querySelector('#btnDoubleBj').onclick = () => {
    if (sharedMode && activeCasinoTable?.game === 'blackjack') {
      if (!sharedState?.hands?.[playerId] || coins < sharedState.hands[playerId].bet) {
        toastRef?.('⚠️ Bạn không đủ Xu để gấp đôi cược!');
        return;
      }
      if (!spendCoins(sharedState.hands[playerId].bet)) {
        toastRef?.('⚠️ Bạn không đủ Xu để gấp đôi cược!');
        return;
      }
      lockSharedActions();
      if (activeCasinoTable.hostId === playerId) {
        applySharedAction(playerId, 'double', playerId);
      } else {
        sendCasinoTableMessage('blackjack_action', {
          tableId: activeCasinoTable.id,
          game: 'blackjack',
          action: 'double',
        });
      }
      return;
    }
    spendCoins(betAmount);
    betAmount *= 2;
    playerCards.push(deck.pop());
    playSfx('blackjack_deal', 'casino');
    updateTableUI(true);
    finishGame();
  };

  // STAND
  modal.querySelector('#btnStandBj').onclick = () => {
    if (sharedMode && activeCasinoTable?.game === 'blackjack') {
      lockSharedActions();
      if (activeCasinoTable.hostId === playerId) {
        applySharedAction(playerId, 'stand', playerId);
      } else {
        sendCasinoTableMessage('blackjack_action', {
          tableId: activeCasinoTable.id,
          game: 'blackjack',
          action: 'stand',
        });
      }
      return;
    }
    finishGame();
  };

  function finishGame() {
    isGameOver = true;
    modal.querySelector('#btnHitBj').disabled = true;
    modal.querySelector('#btnStandBj').disabled = true;
    modal.querySelector('#btnDoubleBj').disabled = true;

    // Reveal Dealer's card
    updateTableUI(false);

    // Dealer AI: Draw until >= 17
    function dealerTurn() {
      let dScore = calcHandScore(dealerCards);
      const pScore = calcHandScore(playerCards);

      if (pScore <= 21 && dScore < 17) {
        dealerCards.push(deck.pop());
        playSfx('blackjack_deal', 'casino');
        updateTableUI(false);
        setTimeout(dealerTurn, 500);
      } else {
        evaluateWinner();
      }
    }
    setTimeout(dealerTurn, 400);
  }

  function evaluateWinner() {
    modal.querySelector('#btnDealBj').disabled = false;
    const pScore = calcHandScore(playerCards);
    const dScore = calcHandScore(dealerCards);
    const resultToast = modal.querySelector('#bjResultToast');

    if (pScore > 21) {
      resultToast.innerHTML = '<span style="color:#ef4444">💥 BẠN BỊ QUẮC (BUST > 21)! Nhà cái thắng.</span>';
    } else if (pScore === 21 && playerCards.length === 2 && (dScore !== 21 || dealerCards.length > 2)) {
      const win = Math.floor(betAmount * 2.5); // 3:2 payout
      addCoins(win);
      recordJackpotWin('blackjack');
      resultToast.innerHTML = `<span style="color:#4ade80">⭐ BLACKJACK 21 ĐIỂM! Bạn thắng lớn +${win.toLocaleString()} Xu!</span>`;
    } else if (dScore > 21) {
      const win = betAmount * 2;
      addCoins(win);
      playSfx('slot_win', 'casino');
      resultToast.innerHTML = `<span style="color:#4ade80">🎉 NHÀ CÁI BỊ QUẮC (>21)! Bạn thắng +${win.toLocaleString()} Xu!</span>`;
    } else if (pScore > dScore) {
      const win = betAmount * 2;
      addCoins(win);
      playSfx('slot_win', 'casino');
      resultToast.innerHTML = `<span style="color:#4ade80">🎉 BẠN THẮNG (${pScore} vs ${dScore})! Nhận +${win.toLocaleString()} Xu!</span>`;
    } else if (pScore === dScore) {
      addCoins(betAmount); // Push
      resultToast.innerHTML = `🤝 HÒA (${pScore} điểm)! Hoàn lại tiền cược.`;
    } else {
      resultToast.innerHTML = `Nhà cái thắng (${dScore} vs ${pScore}). Hãy thử lại ván sau!`;
    }
  }
}

// ============================================================================
// 4. SLOT MACHINE (MÁY ĐÁNH BẠC 777 JACKPOT)
// ============================================================================
export function openSlotMachine() {
  const content = `
    <div class="slot-machine-arena">
      <div class="slot-cabinet">
        <div class="slot-marquee-top">💎 777 MEGA JACKPOT 💎</div>
        <!-- 3 Spinning Reels -->
        <div class="slot-reels-window">
          <div class="slot-reel" id="reel0">7️⃣</div>
          <div class="slot-reel" id="reel1">7️⃣</div>
          <div class="slot-reel" id="reel2">7️⃣</div>
        </div>
        <div id="slotResultToast" class="casino-result-toast" style="min-width:260px">
          🎰 Chọn mức cược rồi kéo cần gạt để quay Jackpot!
        </div>
        <!-- Chip Bet & Action -->
        <div class="casino-chips-row" style="background:transparent;padding:0">
          <span style="font-size:12px;font-weight:700;color:#fef08a">CƯỢC:</span>
          <div class="casino-chip-btn chip-10" data-val="10">10 Xu</div>
          <div class="casino-chip-btn chip-25 selected" data-val="25">25 Xu</div>
          <div class="casino-chip-btn chip-50" data-val="50">50 Xu</div>
          <div class="casino-chip-btn chip-100" data-val="100">100 Xu</div>
        </div>
        <button id="btnSpinSlot" class="casino-action-btn">🎰 QUAY (SPIN)</button>
      </div>
      <!-- Pull Lever -->
      <div class="slot-lever-handle" id="slotLever" title="Nhấn để kéo cần gạt!">
        <div class="slot-lever-rod">
          <div class="slot-lever-knob"></div>
        </div>
      </div>
    </div>
  `;

  const modal = createCasinoModal('MÁY ĐÁNH BẠC SLOT MACHINE 777 VEGAS', content);

  let betAmount = 25;
  let isSpinning = false;
  const symbols = ['7️⃣', '💎', '🔔', '🍀', '🍒', '⭐'];

  modal.querySelectorAll('.casino-chip-btn').forEach(btn => {
    btn.onclick = () => {
      if (isSpinning) return;
      modal.querySelectorAll('.casino-chip-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      betAmount = parseInt(btn.dataset.val, 10);
      playSfx('blackjack_deal', 'casino');
    };
  });

  const doSpin = () => {
    if (isSpinning) return;
    if (!spendCoins(betAmount)) {
      toastRef?.('⚠️ Bạn không đủ Xu để quay Slot!');
      return;
    }

    isSpinning = true;
    modal.querySelector('#btnSpinSlot').disabled = true;
    modal.querySelector('#slotResultToast').innerHTML = '🎰 Cuộn quay đang lăn tốc độ cao...';

    // Mechanical pull lever animation
    const lever = modal.querySelector('#slotLever');
    lever.classList.add('pulled');
    playSfx('slot_lever', 'casino');
    broadcastCasinoPlay('slot_machine', 'spin');
    setTimeout(() => lever.classList.remove('pulled'), 350);

    // Trigger 3D world slot machine lever
    const sm = worldRef?.casinoObjs?.find(o => o.userData?.type === 'slot_machine');
    sm?.userData?.pullLever?.();

    // Reels roll animation
    const reels = [modal.querySelector('#reel0'), modal.querySelector('#reel1'), modal.querySelector('#reel2')];
    const results = [
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
    ];

    // Balanced jackpot chance (2.5% for 777, 8% for diamonds)
    if (Math.random() < 0.025) {
      results[0] = results[1] = results[2] = '7️⃣';
    } else if (Math.random() < 0.08) {
      results[0] = results[1] = '💎';
    }

    const intervals = reels.map((reel, idx) => {
      return setInterval(() => {
        reel.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      }, 70);
    });

    // Stop reels one by one
    setTimeout(() => {
      clearInterval(intervals[0]);
      reels[0].textContent = results[0];
      playSfx('blackjack_deal', 'casino');
    }, 1200);

    setTimeout(() => {
      clearInterval(intervals[1]);
      reels[1].textContent = results[1];
      playSfx('blackjack_deal', 'casino');
    }, 1800);

    setTimeout(() => {
      clearInterval(intervals[2]);
      reels[2].textContent = results[2];
      playSfx('blackjack_deal', 'casino');

      finishSlotSpin(results);
    }, 2400);
  };

  modal.querySelector('#btnSpinSlot').onclick = doSpin;
  modal.querySelector('#slotLever').onclick = doSpin;

  function finishSlotSpin(res) {
    isSpinning = false;
    modal.querySelector('#btnSpinSlot').disabled = false;
    const [r1, r2, r3] = res;

    if (r1 === '7️⃣' && r2 === '7️⃣' && r3 === '7️⃣') {
      const jackpot = betAmount * 100;
      addCoins(jackpot);
      recordJackpotWin('slot_machine');
      worldRef?.spawnFireworksShow(14.5, 11.5);
      modal.querySelector('#slotResultToast').innerHTML = `
        <span style="color:#facc15;font-size:18px">💥 MEGA JACKPOT 777!</span><br>
        Bạn nhận thưởng siêu khủng <b>+${jackpot.toLocaleString()} Xu</b>!
      `;
    } else if (r1 === r2 && r2 === r3) {
      const win = betAmount * 30;
      addCoins(win);
      playSfx('slot_win', 'casino');
      modal.querySelector('#slotResultToast').innerHTML = `
        <span style="color:#4ade80">🎉 TRÚNG 3 BIỂU TƯỢNG GIỐNG NHAU!</span><br>
        Nhận thưởng <b>+${win.toLocaleString()} Xu</b>!
      `;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      const win = betAmount * 3;
      addCoins(win);
      playSfx('slot_win', 'casino');
      modal.querySelector('#slotResultToast').innerHTML = `
        <span style="color:#38bdf8">✨ Trúng cặp đôi! Thưởng +${win.toLocaleString()} Xu!</span>
      `;
    } else {
      modal.querySelector('#slotResultToast').textContent = 'Chúc bạn may mắn lần sau!';
    }
  }
}

// ============================================================================
// 5. PLINKO (THÁP THẢ BÓNG ĐINH CHÔNG)
// ============================================================================
export function openPlinko() {
  const content = `
    <div class="plinko-arena">
      <canvas id="plinkoCanvas" width="460" height="420"></canvas>
      <div id="plinkoResultToast" class="casino-result-toast" style="min-width:320px">
        ⚡ Chọn tiền cược cho mỗi quả bóng và nhấn THẢ BÓNG!
      </div>
      <div style="display:flex;justify-content:space-between;width:100%;max-width:460px;align-items:center;flex-wrap:wrap;gap:8px">
        <div class="casino-chips-row" style="background:transparent;padding:0">
          <span style="font-size:12px;font-weight:700;color:#fef08a">CƯỢC / BÓNG:</span>
          <div class="casino-chip-btn chip-10" data-val="10">10 Xu</div>
          <div class="casino-chip-btn chip-25 selected" data-val="25">25 Xu</div>
          <div class="casino-chip-btn chip-50" data-val="50">50 Xu</div>
          <div class="casino-chip-btn chip-100" data-val="100">100 Xu</div>
        </div>
        <button id="btnDropPlinko" class="casino-action-btn">🟡 THẢ BÓNG (DROP)</button>
      </div>
    </div>
  `;

  const modal = createCasinoModal('THÁP THẢ BÓNG PLINKO (MEGA MULTIPLIERS)', content);
  addCasinoTableUi(modal, 'plinko');
  const canvas = modal.querySelector('#plinkoCanvas');
  const ctx = canvas.getContext('2d');

  let betAmount = 25;
  modal.querySelectorAll('.casino-chip-btn').forEach(btn => {
    btn.onclick = () => {
      modal.querySelectorAll('.casino-chip-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      betAmount = parseInt(btn.dataset.val, 10);
      playSfx('blackjack_deal', 'casino');
    };
  });

  // Setup Triangular Pegs Grid (10 Rows)
  const rows = 10;
  const pegs = [];
  const startY = 55;
  const rowHeight = 32;
  const pegSpacing = 36;

  for (let r = 0; r < rows; r++) {
    const pinsInRow = r + 3;
    const y = startY + r * rowHeight;
    const startX = 230 - ((pinsInRow - 1) * pegSpacing) / 2;
    for (let c = 0; c < pinsInRow; c++) {
      pegs.push({
        x: startX + c * pegSpacing,
        y,
        flash: 0,
      });
    }
  }

  // 11 Reward Bins at bottom
  const bins = [
    { mult: 100, color: '#dc2626' },
    { mult: 25, color: '#ea580c' },
    { mult: 5, color: '#eab308' },
    { mult: 2, color: '#22c55e' },
    { mult: 0.5, color: '#06b6d4' },
    { mult: 0.2, color: '#3b82f6' },
    { mult: 0.5, color: '#06b6d4' },
    { mult: 2, color: '#22c55e' },
    { mult: 5, color: '#eab308' },
    { mult: 25, color: '#ea580c' },
    { mult: 100, color: '#dc2626' },
  ];
  const binWidth = 400 / bins.length;
  const binStartX = 30;
  const binY = 385;

  const balls = [];

  function drawPlinko() {
    ctx.clearRect(0, 0, 460, 420);

    // Pegs
    pegs.forEach(peg => {
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = peg.flash > 0 ? '#fef08a' : '#d97706';
      ctx.fill();
      if (peg.flash > 0) {
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 10;
        peg.flash -= 0.05;
      } else {
        ctx.shadowBlur = 0;
      }
    });

    // Reward Bins
    bins.forEach((b, i) => {
      const bx = binStartX + i * binWidth;
      ctx.fillStyle = b.color;
      ctx.fillRect(bx + 1, binY, binWidth - 2, 28);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.mult}x`, bx + binWidth / 2, binY + 18);
    });

    // Active Balls
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i];
      ball.vy += 0.28; // gravity
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Peg collisions
      for (const peg of pegs) {
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 10) {
          peg.flash = 1.0;
          playSfx('plinko_peg', 'casino');
          ball.vx = (dx > 0 ? 1 : -1) * (1.2 + Math.random() * 1.5);
          ball.vy = -Math.abs(ball.vy) * 0.42;
          ball.y = peg.y - 4;
          break;
        }
      }

      // Draw Ball
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = ball.color || '#facc15';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();

      if (ball.isPeer && ball.playerName) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 9.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ball.playerName, ball.x, ball.y - 9);
      }

      if (ball.y >= binY) {
        const binIdx = Math.max(0, Math.min(bins.length - 1, Math.floor((ball.x - binStartX) / binWidth)));
        const wonBin = bins[binIdx];
        const payout = Math.floor(ball.bet * wonBin.mult);

        if (!ball.isPeer) {
          addCoins(payout);
          if (wonBin.mult >= 25) {
            recordJackpotWin('plinko');
          } else {
            playSfx(wonBin.mult >= 2 ? 'slot_win' : 'plinko_win', 'casino');
          }

          modal.querySelector('#plinkoResultToast').innerHTML = `
            🟡 Bóng rơi vào ô <b>[${wonBin.mult}x]</b>!
            ${payout > 0 ? `Nhận <span style="color:#4ade80;font-weight:800">+${payout.toLocaleString()} Xu</span>!` : ''}
          `;
          updateCasinoTicker(`🟡 Bạn vừa thả bóng Plinko trúng ô [${wonBin.mult}x] (+${payout.toLocaleString()} Xu)!`);
        } else {
          modal.querySelector('#plinkoResultToast').innerHTML = `
            🟡 <b>${ball.playerName}</b> thả bóng rơi vào ô <b>[${wonBin.mult}x]</b>!
          `;
          updateCasinoTicker(`🟡 ${ball.playerName} thả bóng Plinko trúng [${wonBin.mult}x] (+${payout.toLocaleString()} Xu)!`);
          playSfx('plinko_win', 'casino');
        }

        balls.splice(i, 1);
      }
    }

    requestAnimationFrame(drawPlinko);
  }
  requestAnimationFrame(drawPlinko);

  // Multiplayer Hook for Plinko
  activePlinkoInstance = {
    addPeerBall: (playerName, bet, xOffset) => {
      balls.push({
        x: 230 + (xOffset || 0),
        y: 25,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 0.5,
        bet: bet || 25,
        isPeer: true,
        playerName: playerName || 'Bạn bè',
        color: '#38bdf8',
      });
      playSfx('plinko_peg', 'casino');
    },
  };

  modal.querySelector('#btnDropPlinko').onclick = () => {
    if (!spendCoins(betAmount)) {
      toastRef?.('⚠️ Bạn không đủ Xu để thả bóng!');
      return;
    }

    const xOff = (Math.random() - 0.5) * 8;
    balls.push({
      x: 230 + xOff,
      y: 25,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 0.5,
      bet: betAmount,
      isPeer: false,
    });

    // Trigger 3D world plinko ball and broadcast
    broadcastCasinoPlay('plinko', 'drop', { subAction: 'drop', bet: betAmount, xOffset: xOff });
    const pk = worldRef?.casinoObjs?.find(o => o.userData?.type === 'plinko');
    pk?.userData?.dropBall?.();

    playSfx('plinko_peg', 'casino');
  };
}

// ============================================================================
// VIP PUB & FASHION BOUTIQUE SHOP SYSTEM (CHIP SINK ECONOMY)
// ============================================================================
export const CASINO_SHOP_ITEMS = [
  // 1. Phụ kiện thời trang
  { id: 'crown', name: 'Vương Miện Hoàng Gia', icon: '👑', price: 1500, category: 'accessory', desc: 'Đính đá ruby đỏ quyền lực của giới quý tộc' },
  { id: 'cowboy_hat', name: 'Nón Cao Bồi Viễn Tây', icon: '🤠', price: 800, category: 'accessory', desc: 'Mũ da phong trần của những tay súng lừng danh' },
  { id: 'top_hat', name: 'Mũ Ảo Thuật Gia', icon: '🎩', price: 1000, category: 'accessory', desc: 'Mũ lụa đen sang trọng với dải ruy băng lụa đỏ' },
  { id: 'cat_ears', name: 'Tai Mèo Anime', icon: '🐱', price: 600, category: 'accessory', desc: 'Đôi tai mèo siêu đáng yêu rung rinh theo nhịp chân' },
  { id: 'shades', name: 'Kính Râm Ngầu Lòi', icon: '🕶️', price: 500, category: 'accessory', desc: 'Kính phi công đen huyền bí phản chiếu ánh đèn neon' },
  { id: 'hacker_mask', name: 'Mặt Nạ Hacker Anonymous', icon: '🎭', price: 1200, category: 'accessory', desc: 'Nụ cười bí ẩn thách thức mọi rào cản tường lửa' },
  { id: 'astronaut_helmet', name: 'Mũ Phi Hành Gia NASA', icon: '👨‍🚀', price: 2500, category: 'accessory', desc: 'Kính chắn gió mạ vàng chống bức xạ vũ trụ' },
  { id: 'halo', name: 'Vòng Hào Quang Thiên Thần', icon: '😇', price: 3000, category: 'accessory', desc: 'Vòng sáng thánh thiện lơ lửng trên đỉnh đầu' },
  { id: 'devil_wings', name: 'Đôi Cánh Ác Quỷ Obsidian', icon: '🦇', price: 3500, category: 'accessory', desc: 'Đôi cánh dơi hắc ám tỏa khói đen sau lưng' },
  { id: 'viking_helmet', name: 'Mũ Chiến Binh Viking', icon: '🪓', price: 1800, category: 'accessory', desc: 'Mũ sắt hai sừng dũng mãnh của người Viking viễn chinh' },
  { id: 'party_hat', name: 'Nón Sinh Nhật Party', icon: '🎉', price: 700, category: 'accessory', desc: 'Nón tiệc tùng sắc màu rực rỡ vui nhộn' },
  { id: 'golden_laurel', name: 'Vòng Nguyệt Quế Hoàng Kim', icon: '🌿', price: 2200, category: 'accessory', desc: 'Vòng lá vàng vinh quang dành cho bậc đế vương' },
  { id: 'cyber_visor', name: 'Kính Cyberpunk Dạ Quang', icon: '🥽', price: 1600, category: 'accessory', desc: 'Kính thực tế ảo neon tương lai rực rỡ' },

  // 2. Hào quang lấp lánh (Auras)
  { id: 'aura_gold', name: 'Hào Quang Hoàng Kim', icon: '✨', price: 2000, category: 'aura', auraKey: 'gold', desc: 'Bụi vàng hoàng kim bay lượn quanh thân mình' },
  { id: 'aura_fire', name: 'Hào Quang Bão Lửa', icon: '🔥', price: 2500, category: 'aura', auraKey: 'fire', desc: 'Ngọn lửa đỏ rực thiêu đốt quanh bước chân' },
  { id: 'aura_frost', name: 'Hào Quang Băng Tuyết', icon: '❄️', price: 2500, category: 'aura', auraKey: 'frost', desc: 'Hạt sương băng giá xanh biếc xoay tròn mát lạnh' },
  { id: 'aura_hearts', name: 'Hào Quang Trái Tim', icon: '💖', price: 1800, category: 'aura', auraKey: 'hearts', desc: 'Những trái tim hồng tình yêu bay bổng nồng nàn' },
  { id: 'aura_lightning', name: 'Hào Quang Sấm Sét Tím', icon: '⚡', price: 3000, category: 'aura', auraKey: 'lightning', desc: 'Tia sét tím năng lượng plasma cuộn trào uy lực' },
  { id: 'aura_cosmic', name: 'Hào Quang Tinh Vân Vũ Trụ', icon: '🌌', price: 3200, category: 'aura', auraKey: 'cosmic', desc: 'Sắc tím tinh vân và các vì sao xoay quanh thân mình' },
  { id: 'aura_nature', name: 'Hào Quang Rừng Thiêng Ngọc Bích', icon: '🍀', price: 2400, category: 'aura', auraKey: 'nature', desc: 'Bụi ngọc lục bảo thiên nhiên thanh khiết mát lành' },
  { id: 'aura_sakura', name: 'Hào Quang Hoa Anh Đào Rơi', icon: '🌸', price: 2600, category: 'aura', auraKey: 'sakura', desc: 'Cánh hoa anh đào hồng phấn nhẹ nhàng rơi lượn' },
  { id: 'aura_void', name: 'Hào Quang Hắc Ám Hư Không', icon: '🌑', price: 3800, category: 'aura', auraKey: 'void', desc: 'Bóng tối hắc ám và luồng năng lượng đỏ thẫm uy lực' },

  // 3. Nametag phong cách VIP
  { id: 'tag_gold', name: 'Nametag Vàng Hoàng Kim', icon: '🥇', price: 1000, category: 'nametag', style: { color: '#facc15', border: '#eab308' }, desc: 'Khung viền vàng bóng loáng rực rỡ' },
  { id: 'tag_emerald', name: 'Nametag Ngọc Lục Bảo', icon: '💎', price: 1000, category: 'nametag', style: { color: '#34d399', border: '#10b981' }, desc: 'Viền ngọc lục bảo thanh nhã lấp lánh' },
  { id: 'tag_amethyst', name: 'Nametag Thạch Anh Tím', icon: '🔮', price: 1200, category: 'nametag', style: { color: '#c084fc', border: '#a855f7' }, desc: 'Sắc tím hoàng gia huyền bí sang trọng' },
  { id: 'tag_ice', name: 'Nametag Băng Giá Cực Quang', icon: '🧊', price: 1200, category: 'nametag', style: { color: '#38bdf8', border: '#0284c7' }, desc: 'Viền xanh băng tuyết giá lạnh Bắc Cực' },
  { id: 'tag_rainbow', name: 'Nametag Cầu Vồng Siêu Cấp', icon: '🌈', price: 5000, category: 'nametag', style: { rainbow: true, border: '#f43f5e' }, desc: 'Chữ đổi 7 sắc cầu vồng rực rỡ độc nhất vô nhị' },
  { id: 'tag_neon_pink', name: 'Nametag Hồng Neon Cyber', icon: '🎀', price: 1500, category: 'nametag', style: { color: '#f472b6', border: '#ec4899' }, desc: 'Viền hồng dạ quang rực sáng giữa đêm' },
  { id: 'tag_cyber_cyan', name: 'Nametag Xanh Cyan Điện Tử', icon: '🌐', price: 1500, category: 'nametag', style: { color: '#22d3ee', border: '#06b6d4' }, desc: 'Sắc xanh tương lai công nghệ cao' },
  { id: 'tag_crimson_fire', name: 'Nametag Hỏa Long Đỏ Rực', icon: '🔥', price: 1800, category: 'nametag', style: { color: '#fb7185', border: '#e11d48' }, desc: 'Ngọn lửa rực cháy quanh tên gọi' },
  { id: 'tag_phantom_purple', name: 'Nametag Huyễn Ảnh Ma Thuật', icon: '🔮', price: 2000, category: 'nametag', style: { color: '#e879f9', border: '#c026d3' }, desc: 'Sắc tím ma pháp huyền bí sang trọng' },
];

export function getInventory() {
  try {
    return JSON.parse(localStorage.getItem('gh_casino_inventory') || '[]');
  } catch {
    return [];
  }
}

export function saveInventory(inv) {
  localStorage.setItem('gh_casino_inventory', JSON.stringify(inv));
}

export function getEquipped() {
  try {
    return JSON.parse(localStorage.getItem('gh_casino_equipped') || '{}');
  } catch {
    return {};
  }
}

export function saveEquipped(eq) {
  localStorage.setItem('gh_casino_equipped', JSON.stringify(eq));
}

export function buyShopItem(itemId) {
  const item = CASINO_SHOP_ITEMS.find(it => it.id === itemId);
  if (!item) return { ok: false, msg: 'Vật phẩm không tồn tại!' };

  const inv = getInventory();
  if (inv.includes(itemId)) {
    return { ok: false, msg: 'Bạn đã sở hữu vật phẩm này rồi!' };
  }

  if (!spendCoins(item.price)) {
    return { ok: false, msg: `Bạn không đủ Xu! Cần ${item.price.toLocaleString()} Xu.` };
  }

  inv.push(itemId);
  saveInventory(inv);
  playSfx('plinko_win', 'casino');
  return { ok: true, msg: `🎉 Bạn đã mua thành công [${item.name}]!` };
}

export function equipShopItem(itemId) {
  const item = CASINO_SHOP_ITEMS.find(it => it.id === itemId);
  if (!item) return { ok: false, msg: 'Vật phẩm không tồn tại!' };

  const inv = getInventory();
  if (!inv.includes(itemId)) {
    return { ok: false, msg: 'Bạn chưa mua vật phẩm này!' };
  }

  const eq = getEquipped();
  eq[item.category] = itemId;
  saveEquipped(eq);
  playSfx('plinko_win', 'casino');
  return { ok: true, msg: `✨ Đã trang bị [${item.name}]!` };
}

export function unequipShopItem(category) {
  const eq = getEquipped();
  if (eq[category]) {
    delete eq[category];
    saveEquipped(eq);
    return { ok: true, msg: `Đã tháo trang bị!` };
  }
  return { ok: false, msg: 'Chưa có trang bị nào ở vị trí này!' };
}
