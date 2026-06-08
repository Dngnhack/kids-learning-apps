// trace.js — "trace the number" pre-writing mode. Lightweight + on-device.
// Each digit 0–9 is defined as one or more STROKE polylines (x:0–100, y:0–140). The ghost guide
// is drawn FROM these same polylines and the checkpoint dots sit ON their vertices — so the dots
// always match the visible numeral shape (this is the fix for the misaligned-dots bug). A guided
// stroke, not handwriting recognition. Pure data + tiny helpers (no DOM) so it stays testable.

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

/** Ordered checkpoints across all strokes of a digit (flattened). */
export function checkpoints(digit) {
  const strokes = DIGIT_STROKES[digit] || DIGIT_STROKES[1];
  return strokes.flat();
}

/** Which digit to trace for a value (single-digit pre-writing). */
export function traceDigit(value) {
  return value <= 9 ? value : value % 10;
}

/**
 * Advance through checkpoints: if the pointer (normalized x,y) is within `threshold` of the NEXT
 * checkpoint, return the new index; else the same. Complete when idx >= points.length.
 */
export function advance(points, idx, x, y, threshold = 24) {
  if (idx >= points.length) return idx;
  const [px, py] = points[idx];
  return Math.hypot(x - px, y - py) <= threshold ? idx + 1 : idx;
}

export function isComplete(points, idx) { return idx >= points.length; }

/**
 * Snap-to-path: project (x,y) onto the nearest point of the digit's stroke segments.
 * Returns { x, y, dist } (the snapped point + how far the finger was). Used to constrain the trail
 * so it only draws ON/near the numeral path (no scribbling) — and stays clean by drawing the
 * snapped point, not the raw finger position.
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
