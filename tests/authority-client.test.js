import test from 'node:test';
import assert from 'node:assert/strict';
import { SeasonalAuthorityClient } from '../js/authority-client.js';

test('browser authority client submits operations and only accepts increasing canonical sequences', async () => {
  const storageRows = new Map();
  const storage = {
    getItem: key => storageRows.get(key) || null,
    setItem: (key, value) => storageRows.set(key, value),
    removeItem: key => storageRows.delete(key),
  };
  const snapshots = [];
  const calls = [];
  let sequence = 0;
  const fetcher = async (url, options = {}) => {
    calls.push({ url, options });
    let body = {};
    if (url.endsWith('/v1/rooms') && options.method === 'POST') body = { roomId: 'winter', userId: 'p-host1234', token: 'session-token', state: { theme: 'christmas', seq: 0, seasonalEvents: {} } };
    else if (url.endsWith('/events') && options.method === 'POST') body = { theme: 'christmas', seq: ++sequence, seasonalEvents: { christmas: { gifts: { players: [] } } } };
    else if (url.endsWith('/state')) body = { theme: 'christmas', seq: sequence, seasonalEvents: {} };
    return { ok: true, status: 200, json: async () => body };
  };
  const client = new SeasonalAuthorityClient({ baseUrl: 'https://authority.test/', storage, fetcher, onState: value => snapshots.push(value) });
  await client.connect({ roomId: 'winter', theme: 'christmas', name: 'Host', memberId: 'p-host1234', host: true });
  assert.equal(client.connected, true);
  assert.equal(client.userId, 'p-host1234');
  await client.submit({ k: 'seasonal_event', season: 'christmas', action: 'gift_collect', data: { giftId: 'gift_snow_cabin' } });
  assert.equal(snapshots.length, 2);
  assert.equal(client.acceptState({ theme: 'christmas', seq: 0, seasonalEvents: {} }), false);
  assert.equal(client.acceptState({ theme: 'christmas', seq: 1, seasonalEvents: {} }), false);
  assert.equal(client.acceptState({ theme: 'christmas', seq: 1, seasonalEvents: { valentine: { dance: { runs: [{ active: true, currentCue: 'left' }] } } } }, true), true);
  assert.equal(client.acceptState({ theme: 'halloween', seq: 1, serverNow: 1000, seasonalEvents: { halloween: { costume: { round: { id: 'round', endAt: 5000, status: 'ready' } } } } }, true), true);
  assert.equal(snapshots.length, 4, 'poll refreshes timed dance cues and runway countdowns when room sequence is unchanged');
  assert.equal(calls[1].options.headers.authorization, 'Bearer session-token');
  client.destroy();
});

test('authority client estimates server clock offset from response timestamps', async () => {
  const client = new SeasonalAuthorityClient({
    baseUrl: 'https://authority.test',
    fetcher: async () => ({ ok: true, status: 200, json: async () => ({ serverNow: Date.now() + 5000 }) }),
  });
  await client.request('/health', { token: '' });
  assert.ok(client.serverNow() - Date.now() >= 4900);
  assert.ok(client.serverNow() - Date.now() <= 5100);
  client.destroy();
});

test('authority client reports its current map position to the authenticated room', async () => {
  const calls = [];
  const client = new SeasonalAuthorityClient({
    baseUrl: 'https://authority.test',
    getPosition: () => ({ x: 4.6, y: 8.4 }),
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ accepted: true }) };
    },
  });
  client.roomId = 'winter-room';
  client.token = 'session-token';
  assert.equal(await client.reportPosition(), true);
  assert.match(calls[0].url, /\/v1\/rooms\/winter-room\/position$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), { x: 4.6, y: 8.4 });
  assert.equal(calls[0].options.headers.authorization, 'Bearer session-token');
  client.destroy();
});
