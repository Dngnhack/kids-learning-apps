// srs.js — SHARED reusable spaced-repetition engine (Leitner-style, adapted for young learners).
// Deck-AGNOSTIC + pure. Used by ALL Digital Legends kids' apps (Numbers, Math, future Letters/
// Sight-Words) — SINGLE SOURCE OF TRUTH, no per-app duplication.
// Adaptive: correct-and-FAST promotes faster (item appears LESS); a miss gently returns to
// "learning" (appears MORE). No scores/penalties/streaks shown to the child. On-device only.

/** @typedef {{ id: string, box: number, seen: number, correct: number, avgMs: number }} CardProgress */

export const MAX_BOX = 3;        // 1 = learning, 2 = familiar, 3 = known (internal only)
export const FAST_MS = 2500;     // a confident, quick correct answer

/** @param {string[]} ids @returns {Record<string, CardProgress>} */
export function createProgress(ids) {
  /** @type {Record<string, CardProgress>} */
  const p = {};
  for (const id of ids) p[id] = { id, box: 1, seen: 0, correct: 0, avgMs: 0 };
  return p;
}

/** Ensure progress has an entry for every id (handles deck/range growth). */
export function reconcile(progress, ids) {
  for (const id of ids) {
    const c = progress[id];
    if (!c) progress[id] = { id, box: 1, seen: 0, correct: 0, avgMs: 0 };
    else if (typeof c.avgMs !== 'number') c.avgMs = 0;
  }
  return progress;
}

/**
 * Weighted session pick: weaker box + less-seen + slower-known recur more (adaptive frequency).
 * GUARANTEES EXACTLY `size` problems ( count-bug fix). When the deck has FEWER unique cards
 * than the requested size (e.g. a tiny trace range ≈ 10 cards but the child picked 20), the unique
 * cards are drawn first (weighted, no repeats), then the session is PADDED by cycling the deck —
 * re-running the same weighted draw over the full pool for each extra slot — so we always reach N.
 * Padding avoids back-to-back duplicates wherever the deck has ≥ 2 cards: if a pick would repeat the
 * immediately-preceding id it's swapped for the next eligible weighted pick. With a 1-card deck a
 * repeat is unavoidable and allowed. Result length === size whenever size > 0 and ids is non-empty.
 */
export function pickSession(progress, ids, size, rng = Math.random) {
  if (!ids.length || size <= 0) return [];
  const mkCard = (id) => progress[id] || { id, box: 1, seen: 0, correct: 0, avgMs: 0 };
  const weightOf = (c) => {
    const boxW = (MAX_BOX + 1 - c.box) * 2;
    const freshW = 1 / (c.seen + 1);
    const slowW = c.avgMs > FAST_MS ? 0.5 : 0;
    return boxW + freshW + slowW + 0.25;
  };
  // One weighted draw from a working pool (mutates the pool by removing the picked card).
  const drawFrom = (pool) => {
    const weights = pool.map(weightOf);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total, idx = 0;
    for (; idx < weights.length; idx++) { r -= weights[idx]; if (r <= 0) break; }
    if (idx >= pool.length) idx = pool.length - 1;
    const card = pool[idx];
    pool.splice(idx, 1);
    return card;
  };

  const chosen = [];
  // Fill `size` slots. Each time the working pool empties (all unique cards used once) it is
  // refilled from the full deck — this is the spaced "cycle the deck" padding that reaches N.
  let pool = ids.map(mkCard);
  while (chosen.length < size) {
    if (!pool.length) pool = ids.map(mkCard);     // exhausted the deck → start another spaced pass
    let card = drawFrom(pool);
    // avoid a back-to-back duplicate when the deck has the diversity to do so
    if (ids.length > 1 && chosen.length && card.id === chosen[chosen.length - 1]) {
      if (pool.length) {                          // swap for the next eligible pick this pass
        const alt = drawFrom(pool);
        pool.push(card);                          // return the duplicate to the pool for later
        card = alt;
      } else {                                    // pool was just this one card — refill + redraw
        pool = ids.map(mkCard).filter((c) => c.id !== card.id);
        if (pool.length) { pool.push(card); card = drawFrom(pool); }
      }
    }
    chosen.push(card.id);
  }
  return chosen;
}

/** Record an answer. Correct → promote (a FAST correct jumps two boxes); miss → box 1. */
export function recordAnswer(progress, id, wasCorrect, opts = {}) {
  const c = progress[id] || { id, box: 1, seen: 0, correct: 0, avgMs: 0 };
  c.seen += 1;
  const ms = typeof opts.responseMs === 'number' ? opts.responseMs : 0;
  if (ms > 0) c.avgMs = c.avgMs ? Math.round(c.avgMs * 0.6 + ms * 0.4) : ms;
  if (wasCorrect) {
    c.correct += 1;
    const jump = ms > 0 && ms <= FAST_MS ? 2 : 1;
    c.box = Math.min(c.box + jump, MAX_BOX);
  } else {
    c.box = 1;
  }
  progress[id] = c;
  return progress;
}

/** Honest progress summary for the PARENT area (never shown to the child as pressure). */
export function summary(progress, ids) {
  let learning = 0, familiar = 0, known = 0;
  for (const id of ids) {
    const box = (progress[id] && progress[id].box) || 1;
    if (box >= MAX_BOX) known++;
    else if (box === 2) familiar++;
    else learning++;
  }
  return { total: ids.length, learning, familiar, known };
}
