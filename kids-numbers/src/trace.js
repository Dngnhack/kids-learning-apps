// trace.js — "trace the number" guided pre-writing mode. On-device, pure + testable.
// Each digit 0–9 = one or more STROKE polylines (x:0–100, y:0–140). We DENSIFY each stroke into
// evenly-spaced ORDERED checkpoints the child connects in order. Tracing is PER-STROKE
// (trace v5, KIDS_TRACING_OVERHAUL_V2_SPECPACK):
//   • single-stroke digits (0 1 2 3 6 8 9) trace in ONE unbroken motion;
//   • multi-stroke digits (4 5 7) REQUIRE A FINGER LIFT between strokes — finish stroke 1,
//     lift, put the finger down at stroke 2's numbered start dot. While the finger stays down
//     after a stroke ends, ALL movement is rejected, so one continuous scribble can never
//     complete a multi-stroke digit. See createTracer().
// The trace completes ONLY when the FINAL checkpoint of the LAST stroke is reached (no early
// finish) — each stroke's final checkpoint uses a tighter tolerance (must reach the true end).
//
// GLYPH BOX: 100×140 viewBox; numerals sit y≈20–120, x≈24–78 (large, with even padding).
// Stroke order/count follows standard ball-and-stick / Zaner-Bloser-style numeral formation.

/** Stroke polylines per digit (trace v5). Each digit = array of strokes in WRITING ORDER;
 *  each stroke = ordered [x,y] vertices. Hand-authored for Digital Legends (clean-room). */
export const DIGIT_STROKES = {
  // 0 — one counter-clockwise oval: start at the top, around the left, close back at the top.
  0: [[[50, 20], [35, 26], [26, 46], [24, 70], [26, 94], [35, 114], [50, 120], [65, 114], [74, 94], [76, 70], [74, 46], [65, 26], [50, 20]]],
  // 1 — one stroke: short slant up to the tip, then straight down to the baseline.
  1: [[[38, 36], [52, 20], [52, 120]]],
  // 2 — one stroke: curve over the top, slant down-left, then straight across the bottom.
  2: [[[28, 42], [33, 28], [46, 20], [60, 20], [71, 28], [74, 42], [68, 58], [54, 76], [38, 94], [27, 110], [26, 120], [76, 120]]],
  // 3 — one stroke: top bump, in to the middle, back out for the bottom bump.
  3: [[[29, 34], [38, 23], [52, 20], [66, 25], [72, 38], [68, 52], [56, 62], [47, 65], [58, 69], [70, 80], [74, 96], [68, 110], [53, 119], [38, 117], [28, 107]]],
  // 4 — TWO strokes: (1) slant down-left then straight across; (2) tall line down through the bar.
  4: [[[56, 20], [26, 80], [78, 80]],
      [[64, 20], [64, 120]]],
  // 5 — TWO strokes: (1) down the left side then round the belly; (2) the top bar left→right.
  5: [[[34, 20], [34, 56], [46, 50], [60, 50], [71, 58], [76, 74], [74, 94], [64, 110], [48, 118], [32, 112]],
      [[34, 20], [74, 20]]],
  // 6 — one stroke: big curve down from the top, around the bottom, closing the lower loop.
  6: [[[66, 22], [52, 28], [40, 42], [31, 62], [27, 84], [30, 103], [42, 116], [58, 118], [70, 109], [74, 93], [69, 78], [56, 70], [42, 72], [32, 82]]],
  // 7 — TWO strokes: (1) the top bar left→right; (2) the slant from the bar's end down-left.
  7: [[[26, 22], [76, 22]],
      [[76, 22], [44, 120]]],
  // 8 — one stroke: S down from the top crossing the middle, around the bottom, back up crossing
  //     the middle again, close at the top (the classic "make an S then close it up").
  8: [[[50, 20], [36, 26], [30, 40], [34, 54], [46, 63], [58, 72], [67, 84], [69, 98], [61, 112], [50, 117], [38, 112], [31, 99], [33, 85], [42, 73], [54, 63], [65, 53], [70, 40], [64, 26], [50, 20]]],
  // 9 — one stroke: small circle (counter-clockwise, closing back at the right) then straight down.
  9: [[[73, 38], [62, 24], [46, 20], [32, 27], [26, 42], [28, 58], [39, 69], [55, 72], [67, 65], [73, 52], [73, 38], [70, 120]]],
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

function strokesFor(digit) { return DIGIT_STROKES[digit] || DIGIT_STROKES[1]; }

/** Standard handwriting stroke count for a digit. */
export function strokeCount(digit) { return strokesFor(digit).length; }

/** True when the digit needs a finger LIFT between strokes (i.e. it is multi-stroke). */
export function requiresLift(digit) { return strokeCount(digit) > 1; }

/** Densified per-stroke point arrays (evenly spaced). */
export function denseStrokes(digit) { return strokesFor(digit).map(densifyStroke); }

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
 * Advance ONE checkpoint if the pointer is within tolerance of the NEXT checkpoint. The
 * checkpoint at lastIdx (default: the global final one) uses a TIGHTER tolerance so the trace
 * must reach the true end of the stroke (no early finish). Returns the new index (or the same).
 * Complete only when idx >= points.length.
 */
export function advance(points, idx, x, y, lastIdx = points.length - 1) {
  if (idx >= points.length) return idx;
  const tol = idx === lastIdx ? 13 : 19; // tight on the stroke's final point
  const [px, py] = points[idx];
  return Math.hypot(x - px, y - py) <= tol ? idx + 1 : idx;
}

export function isComplete(points, idx) { return idx >= points.length; }

/**
 * createTracer(digit) — stateful PER-STROKE tracer enforcing the lift-between-strokes rule
 * (trace v5, the KEY fix). Pure JS, no DOM — unit-testable. Protocol:
 *   down(x,y) → {moved,rejected}   pointer/finger touches the box
 *   move(x,y) → {moved,rejected}   finger drags (ignored while the finger is up)
 *   up()                            finger lifts
 * Rules:
 *   • checkpoints only advance IN ORDER within the CURRENT stroke;
 *   • finishing a non-final stroke gates progress behind a LIFT: while the finger stays down,
 *     every move is {rejected:true} (a continuous scribble across strokes NEVER advances);
 *   • up() clears the gate and arms the next stroke, which only advances once the finger
 *     comes down near ITS OWN numbered start dot (the advance tolerance);
 *   • complete() only after the final checkpoint of the final stroke.
 */
export function createTracer(digit) {
  const strokes = denseStrokes(digit);
  const points = strokes.flat();
  const starts = []; let n = 0;
  for (const s of strokes) { starts.push(n); n += s.length; }
  const ends = starts.map((s, i) => (i + 1 < starts.length ? starts[i + 1] : points.length));
  let idx = 0, stroke = 0, penDown = false, needLift = false;

  function moveCore(x, y) {
    let moved = false;
    while (idx < ends[stroke]) {
      const ni = advance(points, idx, x, y, ends[stroke] - 1);
      if (ni === idx) break;
      idx = ni; moved = true;
    }
    // finished this stroke but more remain → gate the next stroke behind a finger lift
    if (moved && idx === ends[stroke] && idx < points.length) needLift = true;
    return moved;
  }

  const result = (moved, rejected) => ({ moved, rejected });
  return {
    points, starts, ends, strokes: strokes.length,
    idx: () => idx,
    strokeIndex: () => stroke,
    needsLift: () => needLift,
    isDown: () => penDown,
    complete: () => idx >= points.length,
    down(x, y) { penDown = true; return this.move(x, y); },
    move(x, y) {
      if (!penDown || idx >= points.length) return result(false, false);
      if (needLift) return result(false, true); // continuous scribble across strokes → REJECTED
      return result(moveCore(x, y), false);
    },
    up() {
      penDown = false;
      if (needLift) { needLift = false; stroke++; } // the lift arms the next stroke
    },
  };
}

/**
 * Snap-to-path: project (x,y) onto the nearest point of the digit's stroke segments.
 * Returns { x, y, dist }. Used to constrain the trail to the numeral path (no scribbling).
 */
export function nearestOnPath(digit, x, y) {
  const strokes = strokesFor(digit);
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
