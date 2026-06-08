// rewards.js — SHARED gamification, tied to LEARNING (not time/engagement). Used by all apps.
// Rewards derive from MASTERY (an SRS card reaching the "known" box) and are stored as a
// HIGH-WATER MARK: once earned they are NEVER removed (a later miss never takes a sticker away),
// so it stays encouraging — not punishing. DETERMINISTIC (no randomized/loot rewards = not
// gambling). NO streaks, NO timers, NO FOMO, NO pay-pressure. On-device only + erasable.

import { MAX_BOX } from './srs.js';

// A friendly, original collectible set (emoji = zero asset weight, lean).
export const STICKERS = ['🦊', '🐰', '🐼', '🦁', '🐧', '🐸', '🦉', '🐢', '🦄', '🐝', '🐬', '🦋'];
export const PER_STICKER = 2; // master 2 items → unlock the next sticker (early, frequent wins)

// Milestone badges (mastery counts). "Worlds" on the progress map use the same thresholds.
export const BADGES = [
  { id: 'b1', need: 1, icon: '🌱', name: 'First steps' },
  { id: 'b5', need: 5, icon: '⭐', name: 'Getting there' },
  { id: 'b10', need: 10, icon: '🏅', name: 'Star learner' },
  { id: 'b20', need: 20, icon: '🏆', name: 'Super learner' },
  { id: 'b40', need: 40, icon: '👑', name: 'Champion' },
];

/** How many cards are currently mastered (box at "known"). */
export function masteredNow(progress) {
  return Object.values(progress).filter((c) => c && c.box >= MAX_BOX).length;
}

/** Update the stored high-water mark from current mastery. Never decreases. Returns the record. */
export function update(store, progress) {
  const r = store.loadRewards();
  r.peak = Math.max(r.peak || 0, masteredNow(progress));
  store.saveRewards(r);
  return r;
}

/** Display model from the stored peak (for the rewards shelf + home star count). */
export function model(store) {
  const peak = (store.loadRewards().peak) || 0;
  const unlocked = Math.min(STICKERS.length, Math.floor(peak / PER_STICKER));
  return {
    mastered: peak,
    stickers: STICKERS.map((icon, i) => ({ icon, got: i < unlocked })),
    badges: BADGES.map((b) => ({ ...b, got: peak >= b.need })),
    nextStickerAt: unlocked < STICKERS.length ? (unlocked + 1) * PER_STICKER : null,
  };
}

/** Did crossing from prevPeak→newPeak unlock a new sticker and/or badge? (for a special cheer) */
export function newlyEarned(prevPeak, newPeak) {
  const sticker = Math.floor(newPeak / PER_STICKER) > Math.floor(prevPeak / PER_STICKER)
    && Math.floor(newPeak / PER_STICKER) <= STICKERS.length;
  const badge = BADGES.find((b) => b.need > prevPeak && b.need <= newPeak) || null;
  return { sticker, badge };
}
