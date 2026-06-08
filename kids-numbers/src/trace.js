// trace.js — "trace the number" pre-writing mode. Lightweight + on-device.
// Each digit 0–9 is a sequence of CHECKPOINTS (normalized to a 100x140 box) the child drags
// through in order — a guided stroke, not handwriting recognition. Pure data + a tiny helper
// (no DOM) so it's testable. Single-digit shapes (the core pre-writing skill).

/** Checkpoint polylines per digit (x:0–100, y:0–140). Hand-authored, original. */
export const DIGIT_PATHS = {
  0: [[50,18],[82,45],[82,95],[50,122],[18,95],[18,45],[50,18]],
  1: [[35,32],[55,16],[55,124]],
  2: [[20,38],[50,16],[80,40],[48,78],[20,124],[82,124]],
  3: [[22,28],[74,38],[46,72],[76,104],[24,120]],
  4: [[64,16],[18,84],[88,84],[68,84],[68,124]],
  5: [[80,18],[28,18],[26,64],[68,70],[74,104],[26,122]],
  6: [[72,20],[38,52],[24,92],[52,124],[80,98],[54,72],[30,90]],
  7: [[20,18],[84,18],[44,124]],
  8: [[50,16],[80,44],[50,70],[20,98],[50,124],[80,98],[50,70],[20,44],[50,16]],
  9: [[72,52],[42,28],[26,54],[54,72],[78,50],[70,92],[52,124]],
};

export const TRACE_BOX = { w: 100, h: 140 };

/** Which digit to trace for a value (single-digit pre-writing; uses the value if ≤9). */
export function traceDigit(value) {
  return value <= 9 ? value : value % 10; // for >9, trace its last digit shape
}

/**
 * Advance through checkpoints: if the pointer (normalized x,y) is within `threshold` of the
 * NEXT checkpoint, return the new index; else the same index. Complete when idx >= points.length.
 * @param {number[][]} points @param {number} idx @param {number} x @param {number} y @param {number} threshold
 */
export function advance(points, idx, x, y, threshold = 22) {
  if (idx >= points.length) return idx;
  const [px, py] = points[idx];
  const d = Math.hypot(x - px, y - py);
  return d <= threshold ? idx + 1 : idx;
}

export function isComplete(points, idx) { return idx >= points.length; }
