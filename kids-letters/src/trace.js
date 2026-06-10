// trace.js (Letters) — "trace the letter" connect-the-dots pre-writing mode for LOWERCASE letters.
// Mirrors the Numbers trace engine 1:1 (same pure, testable shape) but keyed by a LETTER character
// instead of a digit, with NEW hand-authored lowercase stroke geometry. On-device, pure + testable.
//
// Each letter = one or more STROKE polylines (x:0-100, y:0-140). We DENSIFY each stroke into evenly
// spaced ORDERED checkpoints the child connects in order; the trace completes ONLY when the FINAL
// checkpoint of the LAST stroke is reached (no early finish) — the final checkpoint uses a tighter
// tolerance so the child must arrive at the true end. Multi-stroke letters (t, i, f, k, …) are traced
// stroke-by-stroke in sequence (checkpoints are flattened in stroke order), matching how the letter
// is actually written (e.g. i = down-stroke first, then the dot).
//
// BOX / WRITING BANDS (y grows downward):
//   ascender top ~24 · x-height top ~56 · baseline ~118 · descender bottom ~135.
// So x-height letters (a c e m n o r s u) sit y56..y118; ascenders (b d f h k l t) reach up to ~24;
// descenders (g j p q y) drop to ~135. Strokes are listed in natural handwriting order so the
// numbered start markers + directional arrows teach correct letter formation.

/** Stroke polylines per LOWERCASE letter. Each letter = array of strokes; each stroke = ordered [x,y].
 *  Authored originally for Digital Legends (clean-room; not traced from any font file). */
export const LETTER_STROKES = {
  // ── Phonics GROUP 1: s a t i p n ─────────────────────────────────────────────
  // s — single S-curve: start top-right, curve up-left, down through the middle, round out bottom-left.
  s: [[[72, 66], [60, 58], [44, 58], [36, 68], [44, 80], [60, 86], [68, 96], [60, 112], [44, 116], [30, 110]]],
  // a — "round then a tail": the bowl (anticlockwise from top-right) then the straight right side down.
  a: [[[66, 64], [50, 58], [36, 64], [30, 86], [36, 108], [52, 116], [66, 108], [70, 90], [70, 64]],
      [[70, 64], [70, 118]]],
  // t — vertical down-stroke (from above the x-line) then the crossbar left-to-right.
  t: [[[52, 34], [52, 110], [62, 118], [74, 114]],
      [[34, 60], [70, 60]]],
  // i — short down-stroke on the x-line, then the dot above (second "stroke" = a tiny tap mark).
  i: [[[50, 60], [50, 118]],
      [[50, 40], [50, 44]]],
  // p — down-stroke into the descender, then the bowl off the top (clockwise back to the stem).
  p: [[[36, 60], [36, 135]],
      [[36, 66], [52, 58], [66, 64], [72, 84], [66, 104], [52, 110], [36, 104]]],
  // n — down-stroke, then up + over the arch and down the right leg.
  n: [[[34, 60], [34, 118]],
      [[34, 72], [42, 62], [56, 60], [66, 70], [68, 86], [68, 118]]],

  // ── Phonics GROUP 2: c k e h r m d ───────────────────────────────────────────
  // c — open arc, anticlockwise from upper-right around to lower-right.
  c: [[[70, 70], [56, 58], [40, 62], [30, 80], [30, 96], [40, 114], [56, 118], [70, 108]]],
  // k — tall stem, then the two diagonal arms (one stroke: in to the middle, out to the foot).
  k: [[[36, 26], [36, 118]],
      [[68, 64], [36, 90], [70, 118]]],
  // e — the crossbar first (left→right) then the round body anticlockwise, opening at lower-right.
  e: [[[32, 88], [68, 88], [66, 72], [52, 58], [38, 62], [30, 80], [30, 98], [42, 114], [60, 116], [70, 106]]],
  // h — tall stem, then up + over the arch and down the right leg (like n but tall).
  h: [[[34, 26], [34, 118]],
      [[34, 72], [42, 62], [56, 60], [66, 70], [68, 86], [68, 118]]],
  // r — short stem, then up + a small shoulder hook to the right.
  r: [[[36, 60], [36, 118]],
      [[36, 72], [46, 62], [60, 60], [70, 66]]],
  // m — stem, then the FIRST arch + leg, then the SECOND arch + leg (3 strokes, like a 2-hump n).
  m: [[[26, 60], [26, 118]],
      [[26, 72], [34, 62], [46, 60], [54, 70], [54, 118]],
      [[54, 72], [62, 62], [74, 60], [82, 70], [82, 118]]],
  // d — the bowl first (anticlockwise from top-right) then the tall right stem down.
  d: [[[68, 64], [52, 58], [38, 64], [32, 86], [38, 108], [52, 116], [66, 108], [70, 90]],
      [[70, 26], [70, 118]]],

  // ── A few more clean, unambiguous x-height / ascender letters (no descender ambiguity) ──
  // o — a closed oval, anticlockwise from the top.
  o: [[[50, 58], [34, 66], [28, 86], [34, 106], [50, 116], [66, 108], [72, 88], [66, 66], [50, 58]]],
  // l — a simple tall down-stroke (ascender) with a small foot.
  l: [[[50, 26], [50, 110], [58, 118], [68, 114]]],
  // u — down, round the bottom, up the right side, then the right stem down (2 strokes).
  u: [[[34, 60], [34, 100], [42, 114], [56, 116], [68, 108]],
      [[68, 60], [68, 118]]],
  // f — the hook + descenderless stem from the top, then the crossbar.
  f: [[[68, 40], [56, 30], [44, 36], [42, 56], [42, 118]],
      [[28, 64], [60, 64]]],
};

export const TRACE_BOX = { w: 100, h: 140 };
const STEP = 20; // checkpoint spacing in box units (connect-the-dots density) — same as Numbers.

/** The letters we have authored geometry for (for the wizard's trace-range filter). */
export const TRACEABLE = Object.keys(LETTER_STROKES);

function densifyStroke(s) {
  const out = [s[0].slice()];
  for (let i = 1; i < s.length; i++) {
    const [ax, ay] = s[i - 1], [bx, by] = s[i];
    const segs = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / STEP));
    for (let k = 1; k <= segs; k++) out.push([ax + (bx - ax) * (k / segs), ay + (by - ay) * (k / segs)]);
  }
  return out;
}

/** A safe fallback letter when an unknown key is asked for (keeps the engine total like Numbers' [1]). */
const FALLBACK = 'i';
function strokesFor(letter) { return LETTER_STROKES[letter] || LETTER_STROKES[FALLBACK]; }

/** Densified per-stroke point arrays (evenly spaced). */
export function denseStrokes(letter) { return strokesFor(letter).map(densifyStroke); }

/** All ordered checkpoints (flattened across strokes, in stroke order). */
export function checkpoints(letter) { return denseStrokes(letter).flat(); }

/** Flat index where each stroke begins — for numbered start markers + stroke order. */
export function strokeStarts(letter) {
  const ds = denseStrokes(letter); const starts = []; let i = 0;
  for (const s of ds) { starts.push(i); i += s.length; }
  return starts;
}

/** The letters of a "value" to trace, in order. For letters a value IS a single character, so this
 *  returns a one-element array — but it keeps the SAME multi-box code path as Numbers' traceDigits()
 *  so ui.renderTrace is shared verbatim (one trace box per element). */
export function traceLetters(value) {
  return [String(value).toLowerCase()];
}

/**
 * Advance ONE checkpoint if the pointer is within tolerance of the NEXT checkpoint. The FINAL
 * checkpoint uses a TIGHTER tolerance so the trace must reach the true end (no early finish).
 * Returns the new index (or the same). Complete only when idx >= points.length. (Same as Numbers.)
 */
export function advance(points, idx, x, y) {
  if (idx >= points.length) return idx;
  const tol = idx === points.length - 1 ? 13 : 19; // tight on the final point
  const [px, py] = points[idx];
  return Math.hypot(x - px, y - py) <= tol ? idx + 1 : idx;
}

export function isComplete(points, idx) { return idx >= points.length; }

/**
 * Snap-to-path: project (x,y) onto the nearest point of the letter's stroke segments.
 * Returns { x, y, dist }. Used to constrain the trail to the letter path (no scribbling).
 */
export function nearestOnPath(letter, x, y) {
  const strokes = strokesFor(letter);
  let best = { x, y, dist: Infinity };
  for (const s of strokes) {
    for (let i = 0; i < s.length - 1; i++) {
      const [ax, ay] = s[i], [bx, by] = s[i + 1];
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((x - ax) * dx + (y - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + t * dx, py = ay + t * dy;
      const d = Math.hypot(x - px, y - py);
      if (d < best.dist) best = { x: px, y: py, dist: d };
    }
  }
  return best;
}
