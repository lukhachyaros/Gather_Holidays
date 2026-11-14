import test from 'node:test';
import assert from 'node:assert/strict';
import { HALLOWEEN_LANTERN_PARRY, isHalloweenLanternParryWindowOpen } from '../js/minigame-rules.js';

test('Halloween lantern parry is available only during the visible warning window', () => {
  assert.equal(isHalloweenLanternParryWindowOpen(HALLOWEEN_LANTERN_PARRY.opensAtMs - 1), false);
  assert.equal(isHalloweenLanternParryWindowOpen(HALLOWEEN_LANTERN_PARRY.opensAtMs), true);
  assert.equal(isHalloweenLanternParryWindowOpen(1600), true);
  assert.equal(isHalloweenLanternParryWindowOpen(HALLOWEEN_LANTERN_PARRY.closesAtMs), true);
  assert.equal(isHalloweenLanternParryWindowOpen(HALLOWEEN_LANTERN_PARRY.closesAtMs + 1), false);
  assert.equal(isHalloweenLanternParryWindowOpen(Number.NaN), false);
});
