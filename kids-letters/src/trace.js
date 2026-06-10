// trace.js (Letters) — "trace the letter" guided pre-writing mode for ALL LOWERCASE letters a–z.
// Mirrors the Numbers trace engine 1:1 (same pure, testable shape) but keyed by a LETTER character.
// Each letter = one or more STROKE polylines (x:0-100, y:0-140). We DENSIFY each stroke into evenly
// spaced ORDERED checkpoints the child connects in order. Tracing is PER-STROKE
// (trace v5, KIDS_TRACING_OVERHAUL_V2_SPECPACK):
//   • single-stroke letters (c e l o s v w z) trace in ONE unbroken motion;
//   • multi-stroke letters (a b d f g h i j k n p q r t u x y = 2 strokes, m = 3) REQUIRE A
//     FINGER LIFT between strokes — finish stroke 1, lift, put the finger down at the next
//     stroke's numbered start dot. While the finger stays down after a stroke ends, ALL
//     movement is rejected, so one continuous scribble can never complete a multi-stroke
//     letter. See createTracer().
// The trace completes ONLY when the FINAL checkpoint of the LAST stroke is reached (no early
// finish) — each stroke's final checkpoint uses a tighter tolerance (must reach the true end).
//
// WRITING BANDS (y grows downward, 100×140 box):
//   ascender top ~22 · x-height top ~56 · baseline ~118 · descender bottom ~134.
// x-height letters (a c e m n o r s u v w x z) sit y56..118; ascenders (b d f h k l t) reach ~22;
// descenders (g j p q y) drop to ~134. Strokes are listed in standard ball-and-stick manuscript
// writing order so the numbered start markers + arrows teach correct letter formation.

/** Stroke polylines per LOWERCASE letter (trace v5). Each letter = array of strokes in WRITING
 *  ORDER; each stroke = ordered [x,y] vertices. Hand-authored for Digital Legends (clean-room;
 *  not traced from any font file). */
export const LETTER_STROKES = {
  // a — (1) the circle, counter-clockwise from 2 o'clock; (2) the right-side line down.
  a: [[[68, 64], [54, 56], [38, 58], [29, 72], [27, 90], [33, 106], [48, 117], [62, 113], [69, 102]],
      [[70, 58], [70, 118]]],
  // b — (1) tall line down; (2) the circle out to the right (clockwise back to the stem).
  b: [[[30, 22], [30, 118]],
      [[30, 64], [44, 56], [60, 58], [70, 70], [72, 87], [68, 104], [55, 116], [41, 115], [30, 107]]],
  // c — one open circle, counter-clockwise from 2 o'clock.
  c: [[[70, 68], [56, 56], [38, 58], [28, 74], [26, 90], [30, 106], [42, 117], [58, 117], [70, 106]]],
  // d — (1) the circle, counter-clockwise; (2) the tall right-side line down.
  d: [[[68, 64], [54, 56], [38, 58], [29, 72], [27, 90], [33, 106], [48, 117], [62, 113], [69, 102]],
      [[70, 22], [70, 118]]],
  // e — ONE stroke: straight bar left→right, then up and around counter-clockwise like a c.
  e: [[[28, 88], [70, 88], [70, 74], [60, 60], [46, 56], [33, 62], [26, 78], [26, 96], [33, 110], [46, 117], [60, 114], [69, 105]]],
  // f — (1) hook from the top curving left, then straight down; (2) the crossbar left→right.
  f: [[[66, 34], [58, 24], [46, 22], [38, 30], [36, 44], [36, 118]],
      [[24, 60], [58, 60]]],
  // g — (1) the circle, counter-clockwise; (2) right line down into the descender, hook left.
  g: [[[68, 64], [54, 56], [38, 58], [29, 72], [27, 90], [33, 106], [48, 116], [62, 112], [69, 100]],
      [[70, 58], [70, 118], [68, 128], [56, 134], [42, 132], [32, 124]]],
  // h — (1) tall line down; (2) up over the arch and down the right leg.
  h: [[[30, 22], [30, 118]],
      [[30, 70], [38, 60], [52, 56], [64, 62], [68, 76], [68, 118]]],
  // i — (1) short line down on the x-height band; (2) the dot above.
  i: [[[50, 56], [50, 118]],
      [[50, 38], [50, 42]]],
  // j — (1) line down through the descender, hook left; (2) the dot above.
  j: [[[58, 56], [58, 118], [56, 128], [46, 134], [34, 131], [28, 123]],
      [[58, 38], [58, 42]]],
  // k — (1) tall line down; (2) slant IN to the middle of the stem, then OUT to the corner.
  k: [[[32, 22], [32, 118]],
      [[66, 58], [34, 88], [68, 118]]],
  // l — one tall straight line down.
  l: [[[50, 22], [50, 118]]],
  // m — THREE strokes: (1) the line down; (2) first hump + leg; (3) second hump + leg.
  m: [[[26, 56], [26, 118]],
      [[26, 68], [33, 58], [44, 56], [50, 64], [52, 76], [52, 118]],
      [[52, 68], [59, 58], [70, 56], [76, 64], [78, 76], [78, 118]]],
  // n — (1) the line down; (2) up over the arch and down the right leg.
  n: [[[32, 56], [32, 118]],
      [[32, 70], [40, 60], [54, 56], [64, 62], [68, 76], [68, 118]]],
  // o — one closed circle, counter-clockwise from the top.
  o: [[[50, 56], [35, 62], [27, 78], [27, 96], [35, 112], [50, 118], [65, 112], [73, 96], [73, 78], [65, 62], [50, 56]]],
  // p — (1) line down into the descender; (2) the circle out to the right.
  p: [[[30, 56], [30, 134]],
      [[30, 64], [44, 56], [60, 58], [70, 70], [72, 87], [68, 104], [55, 116], [41, 115], [30, 107]]],
  // q — (1) the circle, counter-clockwise; (2) line down into the descender, small flick right.
  q: [[[68, 64], [54, 56], [38, 58], [29, 72], [27, 90], [33, 106], [48, 116], [62, 112], [69, 100]],
      [[70, 58], [70, 128], [74, 134], [80, 129]]],
  // r — (1) short line down; (2) up and over the little shoulder to the right.
  r: [[[34, 56], [34, 118]],
      [[34, 70], [42, 60], [54, 56], [66, 60], [70, 68]]],
  // s — one S-curve: counter-clockwise top curve, across the middle, clockwise bottom curve.
  s: [[[68, 64], [56, 56], [42, 56], [32, 64], [34, 76], [46, 84], [58, 90], [68, 100], [66, 112], [54, 118], [40, 118], [28, 110]]],
  // t — (1) tall line down with a small curve at the foot; (2) the crossbar left→right.
  t: [[[48, 30], [48, 106], [53, 115], [66, 114]],
      [[30, 56], [68, 56]]],
  // u — (1) down, round the bottom, up the right side; (2) the right line down.
  u: [[[30, 56], [30, 98], [36, 112], [50, 118], [62, 112], [68, 100]],
      [[68, 56], [68, 118]]],
  // v — one stroke: slant down to the point, slant back up.
  v: [[[28, 56], [50, 118], [72, 56]]],
  // w — one stroke: down, up, down, up (two valleys).
  w: [[[24, 56], [37, 118], [50, 72], [63, 118], [76, 56]]],
  // x — TWO strokes: (1) slant down left→right; (2) slant down right→left, crossing the middle.
  x: [[[28, 56], [72, 118]],
      [[72, 56], [28, 118]]],
  // y — (1) short slant down to the middle; (2) long slant from the top-right down through the
  //     middle into the descender.
  y: [[[30, 56], [50, 92]],
      [[70, 56], [50, 92], [34, 130]]],
  // z — one stroke: across the top, slant down-left, across the bottom.
  z: [[[28, 56], [72, 56], [28, 118], [72, 118]]],
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

/** Standard handwriting stroke count for a letter. */
export function strokeCount(letter) { return strokesFor(letter).length; }

/** True when the letter needs a finger LIFT between strokes (i.e. it is multi-stroke). */
export function requiresLift(letter) { return strokeCount(letter) > 1; }

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
 * Advance ONE checkpoint if the pointer is within tolerance of the NEXT checkpoint. The
 * checkpoint at lastIdx (default: the global final one) uses a TIGHTER tolerance so the trace
 * must reach the true end of the stroke (no early finish). Returns the new index (or the same).
 * Complete only when idx >= points.length. (Same as Numbers.)
 */
export function advance(points, idx, x, y, lastIdx = points.length - 1) {
  if (idx >= points.length) return idx;
  const tol = idx === lastIdx ? 13 : 19; // tight on the stroke's final point
  const [px, py] = points[idx];
  return Math.hypot(x - px, y - py) <= tol ? idx + 1 : idx;
}

export function isComplete(points, idx) { return idx >= points.length; }

/**
 * createTracer(letter) — stateful PER-STROKE tracer enforcing the lift-between-strokes rule
 * (trace v5, the KEY fix — identical to Numbers'). Pure JS, no DOM — unit-testable. Protocol:
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
export function createTracer(letter) {
  const strokes = denseStrokes(letter);
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
