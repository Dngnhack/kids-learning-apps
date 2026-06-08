// trace.js — "trace the number" connect-the-dots pre-writing mode. On-device, pure + testable.
// Each digit 0–9 = one or more STROKE polylines (x:0–100, y:0–140). We DENSIFY each stroke into
// evenly-spaced ORDERED checkpoints the child connects in order; the trace completes ONLY when the
// FINAL checkpoint of the LAST stroke is reached (no early finish) — the final checkpoint uses a
// tighter tolerance so the child must arrive at the true end. Multi-stroke digits (4) are traced
// stroke-by-stroke in sequence (checkpoints are flattened in stroke order).

/** Stroke polylines per digit. Each digit = array of strokes; each stroke = ordered [x,y] points. */
export const DIGIT_STROKES = {
  0: [[[50,22],[33,30],[23,55],[23,85],[33,110],[50,118],[67,110],[77,85],[77,55],[67,30],[50,22]]],
  1: [[[34,40],[52,24],[52,120]]],
  2: [[[24,42],[42,24],[66,26],[74,48],[54,76],[30,106],[24,120],[80,120]]],
  3: [[[26,34],[52,24],[72,42],[52,68],[72,92],[58,116],[26,112]]],
  4: [[[64,22],[24,90],[84,90]], [[66,52],[66,122]]],
  5: [[[74,24],[34,24],[30,62],[58,58],[76,84],[62,116],[28,112]]],
  6: [[[70,26],[44,44],[28,78],[30,104],[52,118],[74,104],[76,80],[54,68],[32,80]]],
  7: [[[24,24],[80,24],[46,120]]],
  8: [[[50,22],[70,38],[54,66],[30,86],[50,118],[72,96],[50,66],[32,40],[50,22]]],
  9: [[[70,52],[48,32],[30,52],[48,72],[70,56],[64,96],[50,120]]],
};

export const TRACE_BOX = { w: 100, h: 140 };
const STEP = 20; // checkpoint spacing in box units (connect-the-dots density)

function densifyStroke(s) {
  const out = [s[0].slice()];
  for (let i = 1; i < s.length; i++) {
    const [ax, ay] = s[i - 1], [bx, by] = s[i];
    const segs = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / STEP));
    for (let k = 1; k <= segs; k++) out.push([ax + (bx - ax) * (k / segs), ay + (by - ay) * (k / segs)]);
  }
  return out;
}

/** Densified per-stroke point arrays (evenly spaced). */
export function denseStrokes(digit) { return (DIGIT_STROKES[digit] || DIGIT_STROKES[1]).map(densifyStroke); }

/** All ordered checkpoints (flattened across strokes, in stroke order). */
export function checkpoints(digit) { return denseStrokes(digit).flat(); }

/** Flat index where each stroke begins — for numbered start markers + stroke order. */
export function strokeStarts(digit) {
  const ds = denseStrokes(digit); const starts = []; let i = 0;
  for (const s of ds) { starts.push(i); i += s.length; }
  return starts;
}

/** Which digit to trace for a value (single-digit pre-writing). */
export function traceDigit(value) { return value <= 9 ? value : value % 10; }

/**
 * Advance ONE checkpoint if the pointer is within tolerance of the NEXT checkpoint. The FINAL
 * checkpoint uses a TIGHTER tolerance so the trace must reach the true end (no early finish).
 * Returns the new index (or the same). Complete only when idx >= points.length.
 */
export function advance(points, idx, x, y) {
  if (idx >= points.length) return idx;
  const tol = idx === points.length - 1 ? 13 : 19; // tight on the final point
  const [px, py] = points[idx];
  return Math.hypot(x - px, y - py) <= tol ? idx + 1 : idx;
}

export function isComplete(points, idx) { return idx >= points.length; }

/**
 * Snap-to-path: project (x,y) onto the nearest point of the digit's stroke segments.
 * Returns { x, y, dist }. Used to constrain the trail to the numeral path (no scribbling).
 */
export function nearestOnPath(digit, x, y) {
  const strokes = DIGIT_STROKES[digit] || DIGIT_STROKES[1];
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
