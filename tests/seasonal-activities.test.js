import test from 'node:test';
import assert from 'node:assert/strict';
import { applySeasonalEventOperation, canApplySeasonalEventOperation, createSeasonalEventsState, PHOTO_SPOT_IDS, PHOTO_ITEM_IDS, MANSION_KEY_IDS, MANSION_CLUE_IDS, MANSION_RIDDLE_SEQUENCE, CHRISTMAS_GIFT_IDS, HALLOWEEN_TREASURE_IDS, TET_EXPLORATION_IDS, getCommunityTreeStage } from '../js/seasonal-activities.js';
import { buildThemeMap, getThemeFeatures, validMap, migrateLegacyThemeMap, isSolid } from '../js/maps.js';

function room(theme) {
  return { theme, kickedIds: [], seasonalEvents: createSeasonalEventsState() };
}

test('seasonal shared progress is reduced by the room host, while guests only accept host operations', () => {
  assert.equal(canApplySeasonalEventOperation(true, 'guest-a', 'host-a'), true);
  assert.equal(canApplySeasonalEventOperation(false, 'host-a', 'host-a'), true);
  assert.equal(canApplySeasonalEventOperation(false, 'guest-a', 'host-a'), false);
  assert.equal(canApplySeasonalEventOperation(true, 'guest-a', ''), false);
});

test('community tree contributions are unique per player', () => {
  const state = room('christmas');
  const pickup = { k: 'seasonal_event', season: 'christmas', action: 'ornament_pickup', data: { ornamentKey: 'star' } };
  assert.equal(applySeasonalEventOperation(state, pickup, 'p1', 'An'), true);
  const op = { k: 'seasonal_event', season: 'christmas', action: 'tree_contribute', data: { decorationType: 'star', ornamentKey: 'star' } };
  assert.equal(applySeasonalEventOperation(state, op, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, op, 'p1', 'An'), false);
  assert.equal(state.seasonalEvents.christmas.tree.contributors.length, 1);
});

test('community Christmas tree advances through five contribution stages', () => {
  assert.deepEqual([0, 5, 6, 11, 12, 17, 18, 23, 24].map(getCommunityTreeStage), [1, 1, 2, 2, 3, 3, 4, 4, 5]);
  assert.equal(getCommunityTreeStage(100), 5);
});

test('tree contribution consumes a server-validated ornament from the player inventory', () => {
  const state = room('christmas');
  const contribution = { k: 'seasonal_event', season: 'christmas', action: 'tree_contribute', data: { decorationType: 'star', ornamentKey: 'star' } };
  assert.equal(applySeasonalEventOperation(state, contribution, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, { k: 'seasonal_event', season: 'christmas', action: 'ornament_pickup', data: { ornamentKey: 'star' } }, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, { ...contribution, data: { decorationType: 'bell', ornamentKey: 'star' } }, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, contribution, 'p1', 'An'), true);
  assert.equal(state.seasonalEvents.christmas.inventory.players[0].heldKey, null);
  assert.equal(applySeasonalEventOperation(state, contribution, 'p2', 'Bình'), false);
});

test('Christmas gifts and Halloween relics are known, unique per player, and room-shared', () => {
  const xmas = room('christmas');
  const giftOp = { k: 'seasonal_event', season: 'christmas', action: 'gift_collect', data: { giftId: CHRISTMAS_GIFT_IDS[0] } };
  assert.equal(applySeasonalEventOperation(xmas, giftOp, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(xmas, giftOp, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(xmas, { ...giftOp, data: { giftId: 'forged' } }, 'p2', 'Bình'), false);
  assert.deepEqual(xmas.seasonalEvents.christmas.gifts.players[0].gifts, [CHRISTMAS_GIFT_IDS[0]]);

  const halloween = room('halloween');
  const relicOp = { k: 'seasonal_event', season: 'halloween', action: 'treasure_collect', data: { treasureId: HALLOWEEN_TREASURE_IDS[2] } };
  assert.equal(applySeasonalEventOperation(halloween, relicOp, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(halloween, relicOp, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(halloween, { ...relicOp, data: { treasureId: 'forged' } }, 'p2', 'Bình'), false);
});

test('community tree requires a balanced set of three decoration types', () => {
  const state = room('christmas');
  for (const type of ['star', 'bell', 'ribbon']) {
    for (let i = 0; i < 8; i++) {
      const ornamentKey = type === 'ribbon' ? 'cane' : type;
      assert.equal(applySeasonalEventOperation(state, { k: 'seasonal_event', season: 'christmas', action: 'ornament_pickup', data: { ornamentKey } }, type + i, 'Người chơi ' + i), true);
      assert.equal(applySeasonalEventOperation(
        state,
        { k: 'seasonal_event', season: 'christmas', action: 'tree_contribute', data: { decorationType: type, ornamentKey } },
        type + i,
        'Người chơi ' + i
      ), true);
    }
    const extraOrnamentKey = type === 'ribbon' ? 'cane' : type;
    assert.equal(applySeasonalEventOperation(state, { k: 'seasonal_event', season: 'christmas', action: 'ornament_pickup', data: { ornamentKey: extraOrnamentKey } }, 'extra-' + type, 'Người chơi thêm'), true);
    assert.equal(applySeasonalEventOperation(
      state,
      { k: 'seasonal_event', season: 'christmas', action: 'tree_contribute', data: { decorationType: type, ornamentKey: extraOrnamentKey } },
      'extra-' + type,
      'Người chơi thêm'
    ), false);
  }
  assert.equal(state.seasonalEvents.christmas.tree.contributors.length, 24);
  assert.deepEqual(
    ['star', 'bell', 'ribbon'].map(type => state.seasonalEvents.christmas.tree.contributors.filter(item => item.decorationType === type).length),
    [8, 8, 8]
  );
});

test('sled leaderboard ranks 8 gates, shortcuts and collisions safely', () => {
  const state = room('christmas');
  const base = { k: 'seasonal_event', season: 'christmas', action: 'sled_record' };
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { timeMs: 18000, gatesHit: 7, shortcuts: 2, collisions: 1 } }, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { timeMs: 19000, gatesHit: 7, shortcuts: 2, collisions: 1 } }, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { timeMs: 15000, gatesHit: 8, shortcuts: 1, collisions: 0 } }, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { timeMs: 12000, gatesHit: 7, shortcuts: 2, collisions: 0 } }, 'p2', 'Bình'), false);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { timeMs: 12000, gatesHit: 9, shortcuts: 1, collisions: 0 } }, 'p3', 'Chi'), false);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { timeMs: 12000, gatesHit: 8, shortcuts: 9, collisions: 0 } }, 'p4', 'Dung'), false);
  assert.equal(state.seasonalEvents.christmas.sled.records[0].timeMs, 15000);
});

test('mansion requires keys and physical clues before solving; votes cannot repeat', () => {
  const state = room('halloween');
  const unlock = { k: 'seasonal_event', season: 'halloween', action: 'mansion_clear' };
  assert.equal(applySeasonalEventOperation(state, unlock, 'p1', 'An'), false);
  assert.deepEqual(MANSION_KEY_IDS, ['candle', 'bat', 'pumpkin']);
  assert.deepEqual(MANSION_CLUE_IDS, ['library_note', 'dining_clock', 'storage_ledger']);
  for (const keyId of MANSION_KEY_IDS) {
    assert.equal(applySeasonalEventOperation(state, { k: 'seasonal_event', season: 'halloween', action: 'mansion_key', data: { keyId } }, 'p1', 'An'), true);
  }
  assert.equal(applySeasonalEventOperation(state, { k: 'seasonal_event', season: 'halloween', action: 'mansion_key', data: { keyId: 'candle' } }, 'p1', 'An'), false);
  const clue = { k: 'seasonal_event', season: 'halloween', action: 'mansion_clue' };
  assert.equal(applySeasonalEventOperation(state, { ...clue, data: { clueId: MANSION_CLUE_IDS[0] } }, 'p2', 'Bình'), false);
  assert.equal(applySeasonalEventOperation(state, unlock, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, { ...unlock, data: { code: MANSION_RIDDLE_SEQUENCE.join('-') } }, 'p1', 'An'), false);
  for (const clueId of MANSION_CLUE_IDS) {
    assert.equal(applySeasonalEventOperation(state, { ...clue, data: { clueId } }, 'p1', 'An'), true);
  }
  assert.equal(applySeasonalEventOperation(state, { ...clue, data: { clueId: MANSION_CLUE_IDS[0] } }, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, { ...unlock, data: { code: 'moon-star-flame' } }, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, { ...unlock, data: { code: MANSION_RIDDLE_SEQUENCE.join('-') } }, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, { ...unlock, data: { code: MANSION_RIDDLE_SEQUENCE.join('-') } }, 'p1', 'An'), false);
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

test('photo hunt tracks hidden keepsakes separately from photo spots', () => {
  const state = room('valentine');
  assert.equal(PHOTO_ITEM_IDS.length, 4);
  const base = { k: 'seasonal_event', season: 'valentine', action: 'photo_item' };
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { itemId: PHOTO_ITEM_IDS[0] } }, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { itemId: PHOTO_ITEM_IDS[0] } }, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { itemId: 'fake_item' } }, 'p1', 'An'), false);
  assert.deepEqual(state.seasonalEvents.valentine.photos.players[0].items, [PHOTO_ITEM_IDS[0]]);
});

test('dance scores are bounded and only improve', () => {
  const state = room('valentine');
  const base = { k: 'seasonal_event', season: 'valentine', action: 'dance_record' };
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { score: 75 } }, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { score: 65 } }, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { score: 101 } }, 'p2', 'Bình'), false);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { score: 72, mode: 'memory' } }, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, { ...base, data: { score: 99, mode: 'invented' } }, 'p1', 'An'), false);
  assert.deepEqual(state.seasonalEvents.valentine.dance.records.map(record => record.mode), ['rhythm', 'memory']);
});


test('legacy seasonal room maps expand without losing existing tiles', () => {
  for (const theme of ['christmas', 'halloween', 'valentine']) {
    const modern = buildThemeMap(theme);
    const legacyRows = modern.rows.slice(0, 22).map(row => row.slice(0, 29) + '#');
    legacyRows[0] = '#'.repeat(30);
    legacyRows[21] = '#'.repeat(30);
    const legacy = {
      w: 30,
      h: 22,
      rows: legacyRows,
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
    assert.equal(migrated.rows[12][29], 'P');
    assert.equal(migrated.rows[21].slice(0, 30), '#'.repeat(30));
    assert.equal(migrated.rows[21].slice(30, 36), '#'.repeat(6));
    if (theme === 'halloween' || theme === 'valentine') assert.equal(migrated.rows[18][29], 'P');
    if (theme === 'valentine') {
      assert.equal(migrated.rows[14][29], 'P');
      assert.equal(migrated.rows[15][29], 'P');
    }
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
  assert.equal(getThemeFeatures('halloween').hotspots.filter(item => item.type === 'mansion_key').length, 3);
  assert.equal(getThemeFeatures('valentine').hotspots.filter(item => item.type === 'photo_collectible').length, 4);
});

test('all seasonal collectible hunt locations are reachable inside their map boundaries', () => {
  for (const [theme, type] of [['christmas', 'christmas_gift'], ['halloween', 'halloween_treasure'], ['tet', 'tet_exploration_item']]) {
    const map = buildThemeMap(theme);
    const spots = getThemeFeatures(theme).hotspots.filter(item => item.type === type);
    assert.equal(spots.length, 5);
    for (const spot of spots) {
      const tile = map.rows[Math.floor(spot.y)]?.[Math.floor(spot.x)];
      assert.equal(isSolid(tile), false, `${theme} pickup ${spot.id} is not blocked`);
      assert.equal(spot.x < map.w && spot.y < map.h, true, `${theme} pickup ${spot.id} is inside the map`);
    }
  }
});

test('Tet exploration tracks unique discoveries and provides five map locations', () => {
  const state = room('tet');
  const op = { k: 'seasonal_event', season: 'tet', action: 'exploration_collect', data: { itemId: TET_EXPLORATION_IDS[0] } };
  assert.equal(applySeasonalEventOperation(state, op, 'p1', 'An'), true);
  assert.equal(applySeasonalEventOperation(state, op, 'p1', 'An'), false);
  assert.equal(applySeasonalEventOperation(state, { ...op, data: { itemId: 'forged' } }, 'p1', 'An'), false);
  assert.equal(getThemeFeatures('tet').hotspots.filter(item => item.type === 'tet_exploration_item').length, 5);
});
