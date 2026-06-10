// rewards.js — SHARED gamification, tied to LEARNING + EFFORT (not manipulation). Used by all apps.
// Three positive, DETERMINISTIC, HIGH-WATER reward tracks (once earned, never removed → never
// punishing): (1) STICKERS — one per completed 10-problem LESSON (end-of-lesson reward);
// (2) BADGES — mastery milestones (cards reaching the "known" SRS box); (3) STREAK BADGES —
// POSITIVE-ONLY consecutive-day returns (celebrate coming back; a missed day NEVER guilts/penalizes/
// counts down — current just restarts at 1, and the best streak is kept forever). On-device only,
// zero-data, erasable. NO loot/randomization, NO FOMO/countdown, NO pay-pressure.

import { MAX_BOX } from './srs.js';

// Collectible set — one earned per completed LESSON (deterministic, high-water, zero asset weight).
// A long, satisfying collection runway (≥40 distinct, KWS-001/AC4): every finished lesson simply
// unlocks the NEXT sticker in order; once unlocked it's kept forever (no FOMO/loot/countdown/random).
// Ordered loosely easy→special so the cadence feels like steady, earned progress. All kid-friendly,
// positive, broadly-supported emoji — grouped (cute animals → sea/sky → nature → treats → sky/space).
export const STICKERS = [
  // friendly animals
  '🦊', '🐰', '🐼', '🦁', '🐧', '🐸', '🦉', '🐢', '🦄', '🐝', '🐬', '🦋',
  '🐳', '🦜', '🐙', '🦕', '🦖', '🐲', '🦚', '🦒', '🐨', '🦔', '🐹', '🐥',
  '🐶', '🐱', '🐮', '🐷', '🦓', '🦘', '🦦', '🦩',
  // nature + sky
  '🌈', '⭐', '🌟', '🌙', '☀️', '⛄', '🌸', '🌻',
  // treats + fun
  '🍓', '🍉', '🍦', '🍩', '🧁', '🎈', '🎁', '🚀',
];

// Mastery badges (learning milestones) — drive the progress map too.
export const BADGES = [
  { id: 'b1', need: 1, icon: '🌱', name: 'First steps' },
  { id: 'b5', need: 5, icon: '⭐', name: 'Getting there' },
  { id: 'b10', need: 10, icon: '🏅', name: 'Star learner' },
  { id: 'b20', need: 20, icon: '🏆', name: 'Super learner' },
  { id: 'b40', need: 40, icon: '👑', name: 'Champion' },
];

// Positive-only day-streak badges (celebrate returning; never punish a miss).
export const STREAK_BADGES = [
  { id: 's2', need: 2, icon: '🌈', name: '2-day streak' },
  { id: 's3', need: 3, icon: '☀️', name: '3-day streak' },
  { id: 's5', need: 5, icon: '🎈', name: '5-day streak' },
  { id: 's7', need: 7, icon: '🏆', name: '7-day streak' },
];

/** Load the reward record with all fields defaulted. */
function rec(store) {
  const r = store.loadRewards() || {};
  return {
    peak: r.peak || 0,           // mastery high-water
    lessons: r.lessons || 0,     // completed lessons (→ stickers)
    streakCur: r.streakCur || 0, // current consecutive-day streak
    streakBest: r.streakBest || 0,
    lastDay: r.lastDay || null,  // YYYY-MM-DD of the last completed-lesson day
  };
}

/** How many cards are currently mastered (box at "known"). */
export function masteredNow(progress) {
  return Object.values(progress).filter((c) => c && c.box >= MAX_BOX).length;
}

/** Update mastery high-water (badges + progress map). Never decreases. */
export function update(store, progress) {
  const r = rec(store);
  r.peak = Math.max(r.peak, masteredNow(progress));
  store.saveRewards(r);
  return r;
}

/** Did mastery cross a new BADGE between prevPeak and newPeak? (for a correct-answer celebration) */
export function newBadge(prevPeak, newPeak) {
  return BADGES.find((b) => b.need > prevPeak && b.need <= newPeak) || null;
}

/** Mark a completed 10-problem lesson → earn the next sticker (high-water). */
export function completeLesson(store) {
  const r = rec(store);
  r.lessons += 1;
  store.saveRewards(r);
  const idx = Math.min(STICKERS.length, r.lessons) - 1;
  return { lessons: r.lessons, newSticker: r.lessons <= STICKERS.length, sticker: STICKERS[(idx % STICKERS.length + STICKERS.length) % STICKERS.length] };
}

function isYesterday(prevISO, todayISO) {
  const p = new Date(prevISO + 'T00:00:00Z').getTime();
  const t = new Date(todayISO + 'T00:00:00Z').getTime();
  return t - p === 86400000;
}

/**
 * Record today's completed-lesson day (date-only, on-device). POSITIVE-ONLY: returning the next day
 * extends the streak; a gap simply restarts the current streak at 1 with NO penalty/guilt/countdown;
 * the best streak is high-water (kept forever). Returns { streak, best, newStreakBadge }.
 */
export function recordDay(store, todayISO) {
  const r = rec(store);
  const today = todayISO || new Date().toISOString().slice(0, 10);
  if (r.lastDay === today) return { streak: r.streakCur, best: r.streakBest, newStreakBadge: null };
  const prevBest = r.streakBest;
  r.streakCur = (r.lastDay && isYesterday(r.lastDay, today)) ? r.streakCur + 1 : 1; // gap → fresh start, no guilt
  r.lastDay = today;
  r.streakBest = Math.max(r.streakBest, r.streakCur);
  store.saveRewards(r);
  return { streak: r.streakCur, best: r.streakBest, newStreakBadge: STREAK_BADGES.find((b) => b.need > prevBest && b.need <= r.streakBest) || null };
}

/** Display model for the rewards shelf + home. */
export function model(store) {
  const r = rec(store);
  const unlocked = Math.min(STICKERS.length, r.lessons);
  return {
    mastered: r.peak, lessons: r.lessons, streakCur: r.streakCur, streakBest: r.streakBest,
    stickers: STICKERS.map((icon, i) => ({ icon, got: i < unlocked })),
    badges: BADGES.map((b) => ({ ...b, got: r.peak >= b.need })),
    streakBadges: STREAK_BADGES.map((b) => ({ ...b, got: r.streakBest >= b.need })),
    nextStickerAt: unlocked < STICKERS.length ? unlocked + 1 : null,
  };
}
