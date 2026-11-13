import test from 'node:test';
import assert from 'node:assert/strict';
import { applySeasonalEventOperation, createSeasonalEventsState, PHOTO_SPOT_IDS } from '../js/seasonal-activities.js';
import { buildThemeMap, getThemeFeatures, validMap, migrateLegacyThemeMap } from '../js/maps.js';

function room(theme) {
  return { theme, kickedIds: [], seasonalEvents: createSeasonalEventsState() };
}

test('community tree contributions are unique per player', () => {
  const state = room('christmas');
  const op = { k: 'seasonal_event', season: 'christmas', action: 'tree_contribute' };
  assert.equal(applySeasonalEventOperation(state, op, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, op, 'p1', 'An'), false);
  assert.equal(state.seasonalEvents.christmas.tree.contributors.length, 1);
});

test('sled leaderboard keeps a player best result and validates bounds', () => {
  const state = room('christmas');
  const base = { k: 'seasonal_event', season: 'christmas', action: 'sled_record' };
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { timeMs: 18000, gatesHit: 5 } }, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { timeMs: 19000, gatesHit: 5 } }, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { timeMs: 15000, gatesHit: 5 } }, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { timeMs: 10, gatesHit: 6 } }, 'p2', 'Bình'), false);
  assert.equal(state.seasonalEvents.christmas.sled.records[0].timeMs, 15000);
});

test('mansion clear is unique and votes cannot target self or repeat', () => {
  const state = room('halloween');
  assert.equal(applySeasonalEventOperation(state, { k: 'seasonal_event', season: 'halloween', action: 'mansion_clear' }, 'p1', 'An'), true);
  const entry = { k: 'seasonal_event', season: 'halloween', action: 'costume_entry', data: { costumeKey: 'witch' } };
  assert.equal(applySeasonalEventOperation(state, entry, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, entry, 'p2', 'Bình'), true);
  const vote = { k: 'seasonal_event', season: 'halloween', action: 'costume_vote', data: { targetId: 'p2' } };
  assert.equal(applySeasonalEventOperation(state, vote, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, vote, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, { ...vote, data: { targetId: 'p1' } }, 'p1', 'An'), false);
});

test('photo hunt accepts only known spots and deduplicates them', () => {
  const state = room('valentine');
  const base = { k: 'seasonal_event', season: 'valentine', action: 'photo_spot' };
  assert.equal(PHOTO_SPOT_IDS.length, 4);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { spotId: PHOTO_SPOT_IDS[0] } }, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { spotId: PHOTO_SPOT_IDS[0] } }, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { spotId: 'not-a-spot' } }, 'p1', 'An'), false);
});

test('dance scores are bounded and only improve', () => {
  const state = room('valentine');
  const base = { k: 'seasonal_event', season: 'valentine', action: 'dance_record' };
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { score: 75 } }, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { score: 65 } }, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { score: 101 } }, 'p2', 'Bình'), false);
});


test('legacy seasonal room maps expand without losing existing tiles', () => {
  for (const theme of ['christmas', 'halloween', 'valentine']) {
    const modern = buildThemeMap(theme);
    const legacy = {
      w: 30,
      h: 22,
      rows: modern.rows.slice(0, 22).map(row => row.slice(0, 30)),
      spawn: [13.5, 18.5],
    };
    // Simulate a player-built tile on the original side of the map.
    legacy.rows[8] = legacy.rows[8].slice(0, 8) + 'R' + legacy.rows[8].slice(9);
    const migrated = migrateLegacyThemeMap(legacy, theme);
    assert.equal(validMap(migrated), true);
    assert.equal(migrated.w, 36);
    assert.equal(migrated.h, 24);
    assert.equal(migrated.rows[8][8], 'R');
    assert.deepEqual(migrated.spawn, legacy.spawn);
    assert.equal(migrated.rows[11][29], 'P');
  }
  const tet = buildThemeMap('tet');
  assert.equal(migrateLegacyThemeMap(tet, 'tet'), tet);
});

test('seasonal map expansions leave Tet layout unchanged', () => {
  for (const theme of ['christmas', 'halloween', 'valentine']) {
    const map = buildThemeMap(theme);
    assert.equal(validMap(map), true);
    assert.ok(map.w > 30 && map.h > 22);
  }
  const tet = buildThemeMap('tet');
  assert.equal(tet.w, 30);
  assert.equal(tet.h, 22);
  assert.equal(getThemeFeatures('christmas').hotspots.some(item => item.type === 'sled_race'), true);
  assert.equal(getThemeFeatures('halloween').hotspots.some(item => item.type === 'haunted_mansion'), true);
  assert.equal(getThemeFeatures('valentine').hotspots.filter(item => item.type === 'photo_spot').length, 4);
});
