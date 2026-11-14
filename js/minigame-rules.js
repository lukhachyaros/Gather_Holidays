export const HALLOWEEN_LANTERN_PARRY = Object.freeze({
  opensAtMs: 900,
  closesAtMs: 2450,
  cooldownMs: 8000,
  roomGraceMs: 6000,
});

export function isHalloweenLanternParryWindowOpen(elapsedMs) {
  return Number.isFinite(elapsedMs) &&
    elapsedMs >= HALLOWEEN_LANTERN_PARRY.opensAtMs &&
    elapsedMs <= HALLOWEEN_LANTERN_PARRY.closesAtMs;
}
