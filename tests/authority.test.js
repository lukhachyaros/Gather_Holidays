import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAuthorityServer } from '../server/authority.js';

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
      const valid = await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'christmas', action: 'gift_collect', data: { giftId: 'gift_snow_cabin' } } }, guestToken);
      assert.equal(valid.status, 200);
      const duplicate = await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'christmas', action: 'gift_collect', data: { giftId: 'gift_snow_cabin' } } }, guestToken);
      assert.equal(duplicate.status, 422);
      const forged = await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'christmas', action: 'gift_collect', data: { giftId: 'fake' } } }, hostToken);
      assert.equal(forged.status, 422);
      const clientScore = await post(`${base}/v1/rooms/winter-room/events`, { operation: { k: 'seasonal_event', season: 'christmas', action: 'sled_record', data: { timeMs: 5000, gatesHit: 8, shortcuts: 0, collisions: 0 } } }, hostToken);
      assert.equal(clientScore.status, 422);
    });
    await withServer(dataPath, async base => {
      const state = await fetch(`${base}/v1/rooms/winter-room/state`, { headers: { authorization: `Bearer ${guestToken}` } });
      assert.equal(state.status, 200);
      const saved = await state.json();
      assert.equal(saved.seq, 1);
      assert.equal(saved.seasonalEvents.christmas.gifts.players[0].gifts[0], 'gift_snow_cabin');
      const unauthorized = await fetch(`${base}/v1/rooms/winter-room/state`);
      assert.equal(unauthorized.status, 401);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
