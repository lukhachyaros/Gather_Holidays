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
  assert.equal(calls[1].options.headers.authorization, 'Bearer session-token');
  client.destroy();
});
