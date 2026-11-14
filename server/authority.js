import { createServer } from 'node:http';
import { randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySeasonalEventOperation } from '../js/seasonal-activities.js';
import { getThemeFeatures } from '../js/maps.js';

const THEMES = new Set(['christmas', 'halloween', 'valentine', 'tet']);
const digest = token => createHash('sha256').update(token).digest('hex');
const safeName = name => String(name || 'Người chơi').replace(/[<>\u0000-\u001f]/g, '').slice(0, 24) || 'Người chơi';
const safeRoomId = id => /^[a-z0-9_-]{2,48}$/i.test(String(id || '')) ? String(id) : '';
const safeMemberId = id => /^[a-z0-9_-]{3,96}$/i.test(String(id || '')) ? String(id) : randomBytes(12).toString('hex');
const tokenMatches = (token, expected) => {
  if (typeof token !== 'string' || typeof expected !== 'string') return false;
  const actualHash = Buffer.from(digest(token));
  const expectedHash = Buffer.from(expected);
  return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);
};

const INTERACTION_TARGETS = {
  gift_collect: ['christmas_gift', 'giftId'],
  treasure_collect: ['halloween_treasure', 'treasureId'],
  mansion_key: ['mansion_key', 'keyId'],
  exploration_collect: ['tet_exploration_item', 'itemId'],
  photo_spot: ['photo_spot', 'spotId'],
  photo_item: ['photo_collectible', 'itemId'],
  ornament_pickup: ['ornament_table', null],
  ornament_spend: ['xmas_tree', null],
  tree_contribute: ['community_tree', null],
  sled_start: ['sled_race', null],
  sled_checkpoint: ['sled_race', null],
  mansion_clear: ['haunted_mansion', null],
  costume_entry: ['costume_runway', null],
  costume_vote: ['costume_runway', null],
  dance_start: ['dance_stage', null],
  dance_input: ['dance_stage', null],
};

function validateInteractionPosition(room, op, now, position) {
  const targetRule = INTERACTION_TARGETS[op?.action];
  if (!targetRule) return true;
  if (!position || now - position.at > 4000) return false;
  const [type, field] = targetRule;
  const targetId = field ? String(op.data?.[field] || '') : '';
  const hotspot = getThemeFeatures(room.theme, room.roomId).hotspots.find(item => item.type === type && (!field || String(item[field] || '') === targetId));
  if (!hotspot) return false;
  return Math.hypot(position.x - hotspot.x, position.y - hotspot.y) <= hotspot.radius + 0.55;
}

function recordServerEvent(room, user, action, now) {
  room.seq++;
  room.events.push({ seq: room.seq, userId: user.id, action, at: now });
  if (room.events.length > 500) room.events.splice(0, room.events.length - 500);
}

function publicSeasonalEvents(room, userId) {
  const snapshot = JSON.parse(JSON.stringify(room.seasonalEvents || {}));
  const runs = snapshot.christmas?.sled?.runs;
  if (Array.isArray(runs)) {
    snapshot.christmas.sled.runs = runs.filter(run => run.idOwner === userId).map(run => {
      const { sequence, ...publicRun } = run;
      publicRun.currentGate = run.active ? sequence[run.step] || null : null;
      return publicRun;
    });
  }
  const dance = snapshot.valentine?.dance;
  if (Array.isArray(dance?.runs)) {
    dance.runs = dance.runs.filter(run => run.idOwner === userId).map(run => {
      const { sequence, ...publicRun } = run;
      const now = Date.now();
      const tempoMs = run.mode === 'copy' ? 820 : run.mode === 'memory' ? 900 : 650;
      const presentation = run.mode === 'memory' && now < run.inputStartAt;
      publicRun.previewCue = presentation ? sequence[Math.max(0, Math.min(sequence.length - 1, Math.floor((now - run.startAt) / 520)))] || null : null;
      publicRun.currentCue = run.active && !presentation ? sequence[Math.max(0, Math.min(sequence.length - 1, Math.floor((now - run.inputStartAt) / tempoMs)))] || null : null;
      return publicRun;
    });
  }
  const runwayRound = snapshot.halloween?.costume?.round;
  if (runwayRound?.id) {
    const now = Date.now();
    runwayRound.status = now < runwayRound.startAt ? 'ready' : now < runwayRound.endAt ? 'voting' : 'complete';
    runwayRound.remainingMs = Math.max(0, runwayRound.endAt - now);
  }
  return snapshot;
}

function applyServerRunwayEvent(room, user, op, now) {
  const data = op.data || {};
  const costume = (room.seasonalEvents.halloween ||= {}).costume ||= { entries: [], votes: [] };
  costume.entries ||= [];
  costume.votes ||= [];
  if (op.action === 'costume_round_start') {
    if (user.id !== room.hostId) return false;
    if (costume.round && now < costume.round.endAt) return false;
    if (costume.entries.length < 2) return false;
    const id = randomBytes(12).toString('hex');
    costume.round = { id, participantIds: costume.entries.map(entry => entry.id), startAt: now + 5000, endAt: now + 50000, status: 'ready' };
    costume.votes = [];
    recordServerEvent(room, user, op.action, now);
    return true;
  }
  if (op.action === 'costume_entry') {
    if (costume.round && now < costume.round.endAt) return false;
    return applySeasonalEventOperation(room, op, user.id, user.name) && (recordServerEvent(room, user, op.action, now), true);
  }
  if (op.action === 'costume_vote') {
    const round = costume.round;
    const targetId = String(data.targetId || '');
    if (!round || now < round.startAt || now >= round.endAt || targetId === user.id || !round.participantIds.includes(user.id) || !round.participantIds.includes(targetId)) return false;
    if (costume.votes.some(vote => vote.roundId === round.id && vote.id === user.id)) return false;
    costume.votes.push({ id: user.id, targetId, roundId: round.id, at: now });
    recordServerEvent(room, user, op.action, now);
    return true;
  }
  return null;
}

function finishServerDanceRun(room, user, run, now) {
  run.active = false;
  run.finishedAt = now;
  const dance = room.seasonalEvents.valentine.dance;
  const previous = dance.records.find(item => item.id === user.id && item.mode === run.mode);
  const result = { id: user.id, name: user.name, mode: run.mode, score: run.score, correct: run.correct, at: now };
  if (!previous) dance.records.push(result);
  else if (result.score > previous.score) Object.assign(previous, result);
}

function applyServerDanceEvent(room, user, op, now) {
  const data = op.data || {};
  const dance = (room.seasonalEvents.valentine ||= {}).dance ||= { records: [], runs: [] };
  dance.records ||= [];
  dance.runs ||= [];
  if (op.action === 'dance_start') {
    const mode = ['rhythm', 'memory', 'copy'].includes(data.mode) ? data.mode : '';
    if (!mode) return false;
    if (dance.runs.length >= 100) dance.runs = dance.runs.slice(-80);
    const sequence = Array.from({ length: mode === 'memory' ? 5 : 8 }, () => ['left', 'right', 'up', 'down'][randomInt(4)]);
    const startAt = now + 1200;
    const playbackMs = mode === 'memory' ? sequence.length * 520 : 0;
    const run = { id: randomBytes(12).toString('hex'), idOwner: user.id, name: user.name, mode, sequence, startAt, inputStartAt: startAt + playbackMs, step: 0, score: 0, correct: 0, timingPenalty: 0, active: true };
    dance.runs = dance.runs.filter(item => item.idOwner !== user.id);
    dance.runs.push(run);
    recordServerEvent(room, user, op.action, now);
    return true;
  }
  if (op.action !== 'dance_input' || !['left', 'right', 'up', 'down'].includes(data.direction)) return false;
  const run = dance.runs.find(item => item.id === data.runId && item.idOwner === user.id && item.active);
  if (!run || now < run.inputStartAt) return false;
  const tempoMs = run.mode === 'copy' ? 820 : run.mode === 'memory' ? 900 : 650;
  const windowMs = run.mode === 'memory' ? 440 : run.mode === 'copy' ? 300 : 250;
  const elapsed = now - run.inputStartAt;
  const expectedStep = Math.floor(elapsed / tempoMs);
  if (expectedStep < run.step || expectedStep >= run.sequence.length) return false;
  if (expectedStep > run.step) run.step = expectedStep;
  const delta = Math.abs(elapsed - expectedStep * tempoMs);
  if (delta > windowMs) return false;
  if (data.direction === run.sequence[expectedStep]) {
    run.correct++;
    if (delta > 110) run.timingPenalty += 4;
    run.score = Math.min(100, Math.max(0, Math.round(run.correct * 100 / run.sequence.length) - run.timingPenalty));
  }
  run.step = expectedStep + 1;
  if (run.step === run.sequence.length) finishServerDanceRun(room, user, run, now);
  recordServerEvent(room, user, op.action, now);
  return true;
}

function finishServerSledRun(room, user, run, now) {
  run.active = false;
  run.timeMs = Math.min(300000, Math.max(5000, now - run.startAt + run.penaltyMs));
  const previous = room.seasonalEvents.christmas.sled.records.find(item => item.id === user.id);
  const result = { id: user.id, name: user.name, timeMs: run.timeMs, gatesHit: run.gatesHit, shortcuts: run.shortcuts, collisions: run.collisions, at: now };
  if (!previous) room.seasonalEvents.christmas.sled.records.push(result);
  else if (result.gatesHit > previous.gatesHit || (result.gatesHit === previous.gatesHit && result.shortcuts > previous.shortcuts) || (result.gatesHit === previous.gatesHit && result.shortcuts === previous.shortcuts && result.collisions < previous.collisions) || (result.gatesHit === previous.gatesHit && result.shortcuts === previous.shortcuts && result.collisions === previous.collisions && result.timeMs < previous.timeMs)) Object.assign(previous, result);
}

function applyServerSledEvent(room, user, op, now) {
  const data = op.data || {};
  const season = room.seasonalEvents.christmas ||= {};
  const sled = season.sled ||= { records: [], runs: [] };
  sled.records ||= [];
  sled.runs ||= [];
  if (op.action === 'sled_start') {
    if (sled.runs.length >= 100) sled.runs = sled.runs.slice(-80);
    const sequence = Array.from({ length: 8 }, () => {
      const shortcut = randomInt(3);
      let safe = randomInt(2);
      if (safe >= shortcut) safe++;
      return { shortcutLane: ['left', 'center', 'right'][shortcut], safeLane: ['left', 'center', 'right'][safe], obstacleLane: ['left', 'center', 'right'][3 - shortcut - safe] };
    });
    const run = { id: randomBytes(12).toString('hex'), idOwner: user.id, name: user.name, sequence, step: 0, gatesHit: 0, shortcuts: 0, collisions: 0, penaltyMs: 0, startAt: now + 1500, active: true };
    sled.runs = sled.runs.filter(item => item.idOwner !== user.id);
    sled.runs.push(run);
    recordServerEvent(room, user, op.action, now);
    return true;
  }
  if (op.action !== 'sled_checkpoint' || !['left', 'center', 'right'].includes(data.lane)) return false;
  const run = sled.runs.find(item => item.id === data.runId && item.idOwner === user.id && item.active);
  if (!run || run.step >= run.sequence.length) return false;
  const elapsed = now - run.startAt;
  const expectedStep = Math.floor(elapsed / 1450);
  if (expectedStep < run.step) return false;
  if (expectedStep > run.step) {
    while (run.step < Math.min(expectedStep, run.sequence.length)) {
      run.collisions++;
      run.penaltyMs += 1450;
      run.step++;
    }
    if (run.step >= run.sequence.length) finishServerSledRun(room, user, run, now);
    recordServerEvent(room, user, op.action, now);
    return true;
  }
  if (run.step >= run.sequence.length) {
    finishServerSledRun(room, user, run, now);
    recordServerEvent(room, user, op.action, now);
    return true;
  }
  if (elapsed < run.step * 1450 || elapsed > (run.step + 1) * 1450) return false;
  const gate = run.sequence[run.step];
  if (data.lane === gate.obstacleLane) { run.collisions++; run.penaltyMs += 1250; }
  else {
    run.gatesHit++;
    if (data.lane === gate.shortcutLane) { run.shortcuts++; run.penaltyMs = Math.max(0, run.penaltyMs - 350); }
  }
  run.step++;
  if (run.step === 8) finishServerSledRun(room, user, run, now);
  recordServerEvent(room, user, op.action, now);
  return true;
}

export function applyAuthoritativeEvent(room, user, op, now = Date.now(), position = user?.position) {
  if (!room || !user || !op || op.k !== 'seasonal_event' || op.season !== room.theme || !THEMES.has(room.theme)) return false;
  room.kickedIds ||= [];
  room.seasonalEvents ||= {};
  if (!validateInteractionPosition(room, op, now, position)) return false;
  if (op.season === 'christmas' && ['sled_start', 'sled_checkpoint'].includes(op.action)) return applyServerSledEvent(room, user, op, now);
  if (op.season === 'valentine' && ['dance_start', 'dance_input'].includes(op.action)) return applyServerDanceEvent(room, user, op, now);
  if (op.season === 'halloween' && ['costume_round_start', 'costume_entry', 'costume_vote'].includes(op.action)) {
    const runwayResult = applyServerRunwayEvent(room, user, op, now);
    if (runwayResult !== null) return runwayResult;
  }
  if (op.action === 'sled_record' || op.action === 'dance_record') return false;
  if (!applySeasonalEventOperation(room, op, user.id, user.name)) return false;
  room.seq++;
  room.events.push({ seq: room.seq, userId: user.id, action: op.action, at: now });
  if (room.events.length > 500) room.events.splice(0, room.events.length - 500);
  return true;
}

export async function createAuthorityServer({ dataPath = resolve('data/rooms.json'), allowedOrigin = '*', clock = Date.now } = {}) {
  const file = resolve(dataPath);
  let rooms = {};
  try { rooms = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let writes = Promise.resolve();
  const playerPositions = new Map();
  const persist = () => {
    writes = writes.then(async () => {
      await mkdir(dirname(file), { recursive: true });
      const temp = file + '.tmp';
      await writeFile(temp, JSON.stringify(rooms), { mode: 0o600 });
      await rename(temp, file);
    });
    return writes;
  };
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify({ ...body, serverNow: clock() })); };
    if (req.url === '/health' && req.method === 'GET') return send(200, { ok: true, rooms: Object.keys(rooms).length });
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    const readBody = () => new Promise((resolveBody, reject) => {
      let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 16384) reject(new Error('body too large')); });
      req.on('end', () => { try { resolveBody(JSON.parse(raw || '{}')); } catch { reject(new Error('invalid JSON')); } });
      req.on('error', reject);
    });
    try {
      if (req.method === 'POST' && url.pathname === '/v1/rooms') {
        const body = await readBody(); const roomId = safeRoomId(body.roomId); if (!roomId || !THEMES.has(body.theme)) return send(400, { error: 'invalid room or theme' });
        if (rooms[roomId]) return send(409, { error: 'room exists' });
        const token = randomBytes(32).toString('base64url'); const userId = safeMemberId(body.memberId);
        rooms[roomId] = { roomId, theme: body.theme, hostId: userId, users: [{ id: userId, name: safeName(body.name), tokenHash: digest(token) }], seq: 0, events: [], seasonalEvents: {}, kickedIds: [], updatedAt: clock() };
        await persist(); return send(201, { roomId, userId, token, host: true, state: { theme: body.theme, seq: 0, seasonalEvents: {} } });
      }
      if (parts[0] !== 'v1' || parts[1] !== 'rooms' || !safeRoomId(parts[2])) return send(404, { error: 'not found' });
      const roomId = parts[2]; const room = rooms[roomId]; if (!room) return send(404, { error: 'room not found' });
      room.roomId ||= roomId;
      if (parts[3] === 'join' && req.method === 'POST') {
        const body = await readBody(); const token = randomBytes(32).toString('base64url'); const userId = safeMemberId(body.memberId);
        if (room.users.length >= 100) return send(409, { error: 'room full' });
        if (room.users.some(item => item.id === userId)) return send(409, { error: 'member already joined' });
        room.users.push({ id: userId, name: safeName(body.name), tokenHash: digest(token) });
        await persist(); return send(201, { roomId, userId, token, host: false, state: { theme: room.theme, seq: room.seq, seasonalEvents: publicSeasonalEvents(room, userId) } });
      }
      const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const user = room.users.find(item => tokenMatches(auth, item.tokenHash)); if (!user) return send(401, { error: 'unauthorized' });
      if (req.method === 'POST' && parts[3] === 'position') {
        const body = await readBody();
        const x = Number(body.x); const y = Number(body.y); const now = clock();
        const width = room.theme === 'tet' ? 30 : 36; const height = room.theme === 'tet' ? 22 : 24;
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= width || y >= height) return send(422, { error: 'invalid position' });
        const positionKey = `${roomId}:${user.id}`;
        const previous = playerPositions.get(positionKey);
        if (previous && now - previous.at < 100) return send(429, { error: 'position update too frequent' });
        if (previous && now - previous.at <= 5000) {
          const elapsed = Math.max(0, (now - previous.at) / 1000);
          if (Math.hypot(x - previous.x, y - previous.y) > 6.5 * elapsed + 0.75) return send(422, { error: 'movement exceeds allowed speed' });
        }
        playerPositions.set(positionKey, { x, y, at: now });
        return send(200, { accepted: true });
      }
      if (req.method === 'POST' && parts[3] === 'theme') {
        if (user.id !== room.hostId) return send(403, { error: 'host required' });
        const body = await readBody();
        if (!THEMES.has(body.theme)) return send(400, { error: 'invalid theme' });
        room.theme = body.theme;
        for (const key of playerPositions.keys()) if (key.startsWith(`${roomId}:`)) playerPositions.delete(key);
        room.seq++;
        room.updatedAt = clock();
        await persist();
        return send(200, { theme: room.theme, seq: room.seq, seasonalEvents: publicSeasonalEvents(room, user.id) });
      }
      if (req.method === 'GET' && parts[3] === 'state') return send(200, { theme: room.theme, seq: room.seq, seasonalEvents: publicSeasonalEvents(room, user.id), events: room.events });
      if (req.method === 'GET' && parts[3] === 'events') return send(200, { events: room.events.filter(event => event.seq > Number(url.searchParams.get('after') || 0)) });
      if (req.method === 'POST' && parts[3] === 'events') {
        const body = await readBody();
        const position = playerPositions.get(`${roomId}:${user.id}`);
        if (!applyAuthoritativeEvent(room, user, body.operation, clock(), position)) return send(422, { error: 'operation rejected' });
        room.updatedAt = clock(); await persist(); return send(200, { theme: room.theme, seq: room.seq, seasonalEvents: publicSeasonalEvents(room, user.id) });
      }
      return send(404, { error: 'not found' });
    } catch (error) { return send(error.message === 'body too large' ? 413 : 400, { error: error.message || 'bad request' }); }
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const server = await createAuthorityServer({ dataPath: process.env.GH_AUTHORITY_DATA || resolve('data/rooms.json'), allowedOrigin: process.env.GH_AUTHORITY_ORIGIN || '*' });
  const port = Number(process.env.PORT || 8787);
  server.listen(port, () => console.log(`Gather Holidays authority listening on ${port}`));
}
