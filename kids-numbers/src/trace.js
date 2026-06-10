// trace.js — "trace the number" connect-the-dots pre-writing mode. On-device, pure + testable.
// Each digit 0–9 = one or more STROKE polylines (x:0–100, y:0–140). We DENSIFY each stroke into
// evenly-spaced ORDERED checkpoints the child connects in order; the trace completes ONLY when the
// FINAL checkpoint of the LAST stroke is reached (no early finish) — the final checkpoint uses a
// tighter tolerance so the child must arrive at the true end. Multi-stroke digits (4) are traced
// stroke-by-stroke in sequence (checkpoints are flattened in stroke order).

/** Stroke polylines per digit. Each digit = array of strokes; each stroke = ordered [x,y] points. */
// Refined per-digit outline geometry (trace v3) — closer to true numeral shapes, smooth, in
// stroke-writing order. Box x:0–100, y:0–140 (numeral sits ~y24–120). Multi-stroke digits (4)
// list strokes in the order a child writes them.
export const DIGIT_STROKES = {
  0: [[[50,24],[34,31],[24,56],[24,84],[34,110],[50,118],[66,110],[76,84],[76,56],[66,31],[50,24]]],
  1: [[[34,42],[52,26],[52,120]]],
  2: [[[26,46],[34,30],[52,24],[68,30],[74,46],[68,64],[48,86],[26,118],[80,118]]],
  3: [[[28,38],[48,25],[70,34],[72,54],[54,68],[74,86],[68,108],[46,118],[26,108]]],
  4: [[[62,24],[24,88],[86,88]], [[64,50],[64,122]]],
  5: [[[72,26],[36,26],[32,62],[54,56],[74,70],[78,94],[60,114],[30,110]]],
  6: [[[68,28],[44,42],[28,72],[26,96],[40,114],[62,116],[76,98],[72,74],[50,66],[30,80]]],
  7: [[[26,26],[80,26],[44,120]]],
  8: [[[50,24],[34,38],[42,60],[50,72],[60,86],[66,104],[50,118],[34,104],[40,86],[50,72],[58,60],[66,38],[50,24]]],
  9: [[[64,42],[46,32],[32,48],[36,66],[54,70],[66,56],[64,42],[62,82],[50,120]]],
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

/** Which digit to trace for a value (single-digit pre-writing). @deprecated multi-digit drops all but the last — use traceDigits(). */
export function traceDigit(value) { return value <= 9 ? value : value % 10; }

/**
 * ALL digits of a value, in left-to-right order, so multi-digit numbers (12 -> [1,2],
 * 250 -> [2,5,0]) are traced digit-by-digit in sequence. The UI renders one trace box per
 * digit and requires each to complete in order. (Fixes the multi-digit bug where only the
 * last digit was traceable.)
 */
export function traceDigits(value) {
  return String(Math.abs(Math.trunc(Number(value) || 0))).split('').map(Number);
}

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
