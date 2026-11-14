import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyAuthoritativeEvent, createAuthorityServer } from '../server/authority.js';

async function withServer(dataPath, fn) {
  const server = await createAuthorityServer({ dataPath, allowedOrigin: 'https://game.test' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn(base); } finally { await new Promise(resolve => server.close(resolve)); }
}

const post = (url, body, token) => fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
const at = (x, y, now) => ({ x, y, at: now });

test('sled checkpoint results use server-generated gates and server time, not submitted finish scores', () => {
  const room = { theme: 'christmas', seasonalEvents: {}, events: [], seq: 0 };
  const user = { id: 'player-1', name: 'Racer' };
  const start = { k: 'seasonal_event', season: 'christmas', action: 'sled_start', data: {} };
  assert.equal(applyAuthoritativeEvent(room, user, start, 1000, at(31, 11.5, 1000)), true);
  const run = room.seasonalEvents.christmas.sled.runs[0];
  assert.equal(applyAuthoritativeEvent(room, user, { ...start, action: 'sled_record', data: { timeMs: 5000, gatesHit: 8 } }, 2000), false);
  assert.equal(applyAuthoritativeEvent(room, user, { ...start, action: 'sled_checkpoint', data: { runId: 'forged', lane: 'left' } }, run.startAt + 100, at(31, 11.5, run.startAt + 100)), false);
  for (let gateIndex = 0; gateIndex < 8; gateIndex++) {
    const gate = run.sequence[gateIndex];
    assert.equal(applyAuthoritativeEvent(room, user, {
      ...start, action: 'sled_checkpoint', data: { runId: run.id, lane: gate.safeLane },
    }, run.startAt + gateIndex * 1450 + 200, at(31, 11.5, run.startAt + gateIndex * 1450 + 200)), true);
  }
  const record = room.seasonalEvents.christmas.sled.records[0];
  assert.equal(record.gatesHit, 8);
  assert.equal(record.collisions, 0);
  assert.equal(record.timeMs, run.startAt + 7 * 1450 + 200 - run.startAt);
});

test('dance modes score server-validated timed inputs and reject client score submissions', () => {
  for (const mode of ['rhythm', 'memory', 'copy']) {
    const room = { theme: 'valentine', seasonalEvents: {}, events: [], seq: 0 };
    const user = { id: `player-${mode}`, name: 'Dancer' };
    const start = { k: 'seasonal_event', season: 'valentine', action: 'dance_start', data: { mode } };
    assert.equal(applyAuthoritativeEvent(room, user, start, 1000, at(31, 14, 1000)), true);
    const run = room.seasonalEvents.valentine.dance.runs[0];
    assert.equal('sequence' in run, true, 'the authority retains the input sequence');
    assert.equal(applyAuthoritativeEvent(room, user, { ...start, action: 'dance_record', data: { score: 100, mode } }, 1500), false);
    assert.equal(applyAuthoritativeEvent(room, user, { ...start, action: 'dance_input', data: { runId: run.id, direction: run.sequence[0] } }, run.inputStartAt - 1, at(31, 14, run.inputStartAt - 1)), false);
    const tempo = mode === 'copy' || mode === 'memory' ? (mode === 'copy' ? 820 : 900) : 650;
    for (let step = 0; step < run.sequence.length; step++) {
      assert.equal(applyAuthoritativeEvent(room, user, {
        ...start, action: 'dance_input', data: { runId: run.id, direction: run.sequence[step] },
      }, run.inputStartAt + step * tempo + 100, at(31, 14, run.inputStartAt + step * tempo + 100)), true);
    }
    assert.equal(run.active, false);
    assert.equal(run.score, 100);
    assert.deepEqual(room.seasonalEvents.valentine.dance.records[0], {
      id: user.id, name: user.name, mode, score: 100, correct: run.sequence.length, at: run.finishedAt,
    });
    assert.equal(applyAuthoritativeEvent(room, user, {
      ...start, action: 'dance_input', data: { runId: run.id, direction: 'left' },
    }, run.finishedAt + 100, at(31, 14, run.finishedAt + 100)), false);
  }
});

test('synchronized team dance requires balanced teams and scores both teams on server time', () => {
  const room = { theme: 'valentine', hostId: 'host-1', seasonalEvents: {}, events: [], seq: 0 };
  const host = { id: 'host-1', name: 'Host' };
  const guest = { id: 'guest-1', name: 'Guest' };
  const event = (action, data = {}) => ({ k: 'seasonal_event', season: 'valentine', action, data });
  assert.equal(applyAuthoritativeEvent(room, host, event('dance_team_join', { team: 'A' }), 1000, at(31, 14, 1000)), true);
  assert.equal(applyAuthoritativeEvent(room, host, event('dance_team_start'), 1100, at(31, 14, 1100)), false);
  assert.equal(applyAuthoritativeEvent(room, guest, event('dance_team_join', { team: 'B' }), 1200, at(31, 14, 1200)), true);
  assert.equal(applyAuthoritativeEvent(room, guest, event('dance_team_start'), 1300, at(31, 14, 1300)), false);
  assert.equal(applyAuthoritativeEvent(room, host, event('dance_team_start'), 1400, at(31, 14, 1400)), true);
  const session = room.seasonalEvents.valentine.dance.teamSession;
  for (let step = 0; step < session.sequence.length; step++) {
    const now = session.startAt + step * 650 + 325;
    for (const player of [host, guest]) {
      const input = event('dance_team_input', { sessionId: session.id, direction: session.sequence[step] });
      assert.equal(applyAuthoritativeEvent(room, player, input, now, at(31, 14, now)), true);
      assert.equal(applyAuthoritativeEvent(room, player, input, now + 1, at(31, 14, now + 1)), false);
    }
  }
  assert.deepEqual(session.teamScores, { A: 100, B: 100 });
  assert.deepEqual(session.participants.map(player => player.correct), [8, 8]);
});

test('costume runway rounds require the room host, two entries and one timed vote per player', () => {
  const room = { theme: 'halloween', hostId: 'host-1', seasonalEvents: {}, events: [], seq: 0 };
  const host = { id: 'host-1', name: 'Host' };
  const guest = { id: 'guest-1', name: 'Guest' };
  const event = (action, data = {}) => ({ k: 'seasonal_event', season: 'halloween', action, data });
  assert.equal(applyAuthoritativeEvent(room, host, event('costume_entry', { costumeKey: 'vampire' }), 1000, at(30, 10.5, 1000)), true);
  assert.equal(applyAuthoritativeEvent(room, host, event('costume_round_start'), 1100, at(30, 10.5, 1100)), false);
  assert.equal(applyAuthoritativeEvent(room, guest, event('costume_entry', { costumeKey: 'witch' }), 1200, at(30, 10.5, 1200)), true);
  assert.equal(applyAuthoritativeEvent(room, guest, event('costume_round_start'), 1300, at(30, 10.5, 1300)), false);
  assert.equal(applyAuthoritativeEvent(room, host, event('costume_round_start'), 1400, at(30, 10.5, 1400)), true);
  const round = room.seasonalEvents.halloween.costume.round;
  assert.equal(applyAuthoritativeEvent(room, guest, event('costume_vote', { targetId: 'host-1' }), round.startAt - 1, at(30, 10.5, round.startAt - 1)), false);
  assert.equal(applyAuthoritativeEvent(room, host, event('costume_vote', { targetId: 'host-1' }), round.startAt + 100, at(30, 10.5, round.startAt + 100)), false);
  assert.equal(applyAuthoritativeEvent(room, guest, event('costume_vote', { targetId: 'host-1' }), round.startAt + 100, at(30, 10.5, round.startAt + 100)), true);
  assert.equal(applyAuthoritativeEvent(room, guest, event('costume_vote', { targetId: 'host-1' }), round.startAt + 200, at(30, 10.5, round.startAt + 200)), false);
  assert.equal(applyAuthoritativeEvent(room, host, event('costume_entry', { costumeKey: 'zombie' }), round.startAt + 300, at(30, 10.5, round.startAt + 300)), false);
  assert.equal(applyAuthoritativeEvent(room, host, event('costume_vote', { targetId: 'guest-1' }), round.endAt, at(30, 10.5, round.endAt)), false);
});

test('Tet fireworks launch from server-known stations with server seed and per-player cooldown', () => {
  const room = { theme: 'tet', roomId: 'tet-room', seasonalEvents: {}, events: [], seq: 0 };
  const user = { id: 'player-tet', name: 'Xuân' };
  const launch = { k: 'seasonal_event', season: 'tet', action: 'firework_launch', data: { kind: 'launcher', stationId: 'fw_launcher_right' } };
  assert.equal(applyAuthoritativeEvent(room, user, launch, 1000), false, 'client cannot launch from an unreported location');
  assert.equal(applyAuthoritativeEvent(room, user, launch, 1000, at(22.5, 14.5, 1000)), true);
  const event = room.seasonalEvents.tet.fireworks.events[0];
  assert.deepEqual({ x: event.x, y: event.y, by: event.by, startAt: event.startAt }, { x: 22.5, y: 14.5, by: 'Xuân', startAt: 1000 });
  assert.ok(Number.isInteger(event.seed));
  assert.equal(applyAuthoritativeEvent(room, user, launch, 1500, at(22.5, 14.5, 1500)), false);
  assert.equal(applyAuthoritativeEvent(room, user, launch, 3000, at(22.5, 14.5, 3000)), true);
  const fakeStation = { ...launch, data: { kind: 'launcher', stationId: 'not-a-station' } };
  assert.equal(applyAuthoritativeEvent(room, user, fakeStation, 5000, at(22.5, 14.5, 5000)), false);
});

test('authority validates member events and restores saved progress after restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gh-authority-'));
  const dataPath = join(directory, 'rooms.json');
  try {
    let hostToken;
    let guestToken;
    await withServer(dataPath, async base => {
      const created = await post(`${base}/v1/rooms`, { roomId: 'winter-room', theme: 'christmas', name: 'Host' });
      assert.equal(created.status, 201);
      const host = await created.json();
      hostToken = host.token;
      const joinedResponse = await post(`${base}/v1/rooms/winter-room/join`, { name: 'Guest' });
      const guest = await joinedResponse.json();
      guestToken = guest.token;
      const remoteCollect = await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'christmas', action: 'gift_collect', data: { giftId: 'gift_snow_cabin' } } }, guestToken);
      assert.equal(remoteCollect.status, 422);
      const positioned = await post(`${base}/v1/rooms/winter-room/position`, { x: 4.6, y: 8.4 }, guestToken);
      assert.equal(positioned.status, 200);
      await new Promise(resolve => setTimeout(resolve, 110));
      const teleport = await post(`${base}/v1/rooms/winter-room/position`, { x: 33.2, y: 8.8 }, guestToken);
      assert.equal(teleport.status, 422);
      const valid = await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'christmas', action: 'gift_collect', data: { giftId: 'gift_snow_cabin' } } }, guestToken);
      assert.equal(valid.status, 200);
      const duplicate = await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'christmas', action: 'gift_collect', data: { giftId: 'gift_snow_cabin' } } }, guestToken);
      assert.equal(duplicate.status, 422);
      const forged = await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'christmas', action: 'gift_collect', data: { giftId: 'fake' } } }, hostToken);
      assert.equal(forged.status, 422);
      const clientScore = await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'christmas', action: 'sled_record', data: { timeMs: 5000, gatesHit: 8, shortcuts: 0, collisions: 0 } } }, hostToken);
      assert.equal(clientScore.status, 422);
      const lateJoinResponse = await post(`${base}/v1/rooms/winter-room/join`, { name: 'Late join' });
      const lateJoin = await lateJoinResponse.json();
      assert.equal(lateJoin.state.seasonalEvents.christmas.gifts.players[0].gifts[0], 'gift_snow_cabin');
      const hostSledPosition = await post(`${base}/v1/rooms/winter-room/position`, { x: 31, y: 11.5 }, hostToken);
      assert.equal(hostSledPosition.status, 200);
      await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'christmas', action: 'sled_start', data: {} } }, hostToken);
      const guestStateResponse = await fetch(`${base}/v1/rooms/winter-room/state`, { headers: { authorization: `Bearer ${hostToken}` } });
      const guestState = await guestStateResponse.json();
      const ownRun = guestState.seasonalEvents.christmas.sled.runs[0];
      assert.ok(ownRun.currentGate);
      assert.equal('sequence' in ownRun, false);
      const lateState = await fetch(`${base}/v1/rooms/winter-room/state`, { headers: { authorization: `Bearer ${lateJoin.token}` } }).then(response => response.json());
      assert.deepEqual(lateState.seasonalEvents.christmas.sled.runs, []);
      const guestThemeChange = await post(`${base}/v1/rooms/winter-room/theme`, { theme: 'tet' }, guestToken);
      assert.equal(guestThemeChange.status, 403);
      const valentineThemeChange = await post(`${base}/v1/rooms/winter-room/theme`, { theme: 'valentine' }, hostToken);
      assert.equal(valentineThemeChange.status, 200);
      const hostDancePosition = await post(`${base}/v1/rooms/winter-room/position`, { x: 31, y: 14 }, hostToken);
      assert.equal(hostDancePosition.status, 200);
      const danceStart = await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'valentine', action: 'dance_start', data: { mode: 'rhythm' } } }, hostToken);
      assert.equal(danceStart.status, 200);
      const hostDanceState = await fetch(`${base}/v1/rooms/winter-room/state`, { headers: { authorization: `Bearer ${hostToken}` } }).then(response => response.json());
      assert.equal('sequence' in hostDanceState.seasonalEvents.valentine.dance.runs[0], false);
      const guestDanceState = await fetch(`${base}/v1/rooms/winter-room/state`, { headers: { authorization: `Bearer ${guestToken}` } }).then(response => response.json());
      assert.deepEqual(guestDanceState.seasonalEvents.valentine.dance.runs, []);
      assert.equal((await post(`${base}/v1/rooms/winter-room/position`, { x: 31, y: 14 }, guestToken)).status, 200);
      assert.equal((await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'valentine', action: 'dance_team_join', data: { team: 'A' } } }, hostToken)).status, 200);
      assert.equal((await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'valentine', action: 'dance_team_join', data: { team: 'B' } } }, guestToken)).status, 200);
      const teamStart = await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'valentine', action: 'dance_team_start', data: {} } }, hostToken);
      assert.equal(teamStart.status, 200);
      const teamState = await teamStart.json();
      assert.equal('sequence' in teamState.seasonalEvents.valentine.dance.teamSession, false);
      assert.equal(teamState.seasonalEvents.valentine.dance.teamSession.participants.length, 2);
      const tetThemeChange = await post(`${base}/v1/rooms/winter-room/theme`, { theme: 'tet' }, hostToken);
      assert.equal(tetThemeChange.status, 200);
      assert.equal((await post(`${base}/v1/rooms/winter-room/position`, { x: 22.5, y: 14.5 }, hostToken)).status, 200);
      const fireworks = await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'tet', action: 'firework_launch', data: { kind: 'launcher', stationId: 'fw_launcher_right' } } }, hostToken);
      assert.equal(fireworks.status, 200);
      const lateFireworksState = await fetch(`${base}/v1/rooms/winter-room/state`, { headers: { authorization: `Bearer ${lateJoin.token}` } }).then(response => response.json());
      assert.equal(lateFireworksState.seasonalEvents.tet.fireworks.events[0].kind, 'launcher');
      const hostThemeChange = await post(`${base}/v1/rooms/winter-room/theme`, { theme: 'halloween' }, hostToken);
      assert.equal(hostThemeChange.status, 200);
    });
    await withServer(dataPath, async base => {
      const state = await fetch(`${base}/v1/rooms/winter-room/state`, { headers: { authorization: `Bearer ${guestToken}` } });
      assert.equal(state.status, 200);
      const saved = await state.json();
      assert.equal(saved.seq, 10);
      assert.equal(saved.seasonalEvents.christmas.gifts.players[0].gifts[0], 'gift_snow_cabin');
      assert.equal(saved.theme, 'halloween');
      const unauthorized = await fetch(`${base}/v1/rooms/winter-room/state`);
      assert.equal(unauthorized.status, 401);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
