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
//   ascender top ~16 · x-height top ~48 · baseline ~110 · descender bottom ~124.
// x-height letters (a c e m n o r s u v w x z) sit y48..110; ascenders (b d f h k l t) reach ~16;
// descenders (g j p q y) drop to ~124. Strokes are listed in standard ball-and-stick manuscript
// writing order so the numbered start markers + arrows teach correct letter formation.
//
// CLIP SAFETY (the descender-chop fix): the SVG clips at the 100×140 viewBox and the hollow track
// channel is 28 units wide with ROUND CAPS — paint extends 14 units past every stroke end. So every
// vertex must sit within [14..86]×[14..126] or the painted channel gets CHOPPED FLAT at the box edge.
// The old band layout (22..134) pushed g/j/p/q/y descender bottoms to y=134 → channel painted to
// y≈148, visibly cut off at 140 on the phone. The whole alphabet is translated up 8 units (pure
// translation — identical letterform proportions), then the extreme vertices get a 2-unit margin
// (tops 16, descender bottoms 124) so every round cap closes fully INSIDE the box, like Numbers
// (whose glyphs sit y20..120 → caps end at 134, never clipped).

/** Stroke polylines per LOWERCASE letter (trace v5). Each letter = array of strokes in WRITING
 *  ORDER; each stroke = ordered [x,y] vertices. Hand-authored for Digital Legends (clean-room;
 *  not traced from any font file). */
export const LETTER_STROKES = {
  // a — (1) the circle, counter-clockwise from 2 o'clock; (2) the right-side line down.
  a: [[[68, 56], [54, 48], [38, 50], [29, 64], [27, 82], [33, 98], [48, 109], [62, 105], [69, 94]],
      [[70, 50], [70, 110]]],
  // b — (1) tall line down; (2) the circle out to the right (clockwise back to the stem).
  b: [[[30, 16], [30, 110]],
      [[30, 56], [44, 48], [60, 50], [70, 62], [72, 79], [68, 96], [55, 108], [41, 107], [30, 99]]],
  // c — one open circle, counter-clockwise from 2 o'clock.
  c: [[[70, 60], [56, 48], [38, 50], [28, 66], [26, 82], [30, 98], [42, 109], [58, 109], [70, 98]]],
  // d — (1) the circle, counter-clockwise; (2) the tall right-side line down.
  d: [[[68, 56], [54, 48], [38, 50], [29, 64], [27, 82], [33, 98], [48, 109], [62, 105], [69, 94]],
      [[70, 16], [70, 110]]],
  // e — ONE stroke: straight bar left→right, then up and around counter-clockwise like a c.
  e: [[[28, 80], [70, 80], [70, 66], [60, 52], [46, 48], [33, 54], [26, 70], [26, 88], [33, 102], [46, 109], [60, 106], [69, 97]]],
  // f — (1) hook from the top curving left, then straight down; (2) the crossbar left→right.
  f: [[[66, 26], [58, 18], [46, 16], [38, 24], [36, 38], [36, 110]],
      [[24, 52], [58, 52]]],
  // g — (1) the circle, counter-clockwise; (2) right line down into the descender, hook left.
  g: [[[68, 56], [54, 48], [38, 50], [29, 64], [27, 82], [33, 98], [48, 108], [62, 104], [69, 92]],
      [[70, 50], [70, 110], [68, 118], [56, 124], [42, 122], [32, 114]]],
  // h — (1) tall line down; (2) up over the arch and down the right leg.
  h: [[[30, 16], [30, 110]],
      [[30, 62], [38, 52], [52, 48], [64, 54], [68, 68], [68, 110]]],
  // i — (1) short line down on the x-height band; (2) the dot above, at ascender height so its
  //     28-wide round channel visibly SEPARATES from the stem channel (lower dots merge into one
  //     capsule blob at trace scale — the letter stopped reading as an i).
  i: [[[50, 48], [50, 110]],
      [[50, 16], [50, 20]]],
  // j — (1) line down through the descender, hook left; (2) the dot above (ascender height, same
  //     channel-separation rule as i).
  j: [[[58, 48], [58, 110], [56, 118], [46, 124], [34, 121], [28, 113]],
      [[58, 16], [58, 20]]],
  // k — (1) tall line down; (2) slant IN to the middle of the stem, then OUT to the corner.
  k: [[[32, 16], [32, 110]],
      [[66, 50], [34, 80], [68, 110]]],
  // l — one tall straight line down.
  l: [[[50, 16], [50, 110]]],
  // m — THREE strokes: (1) the line down; (2) first hump + leg; (3) second hump + leg.
  m: [[[26, 48], [26, 110]],
      [[26, 60], [33, 50], [44, 48], [50, 56], [52, 68], [52, 110]],
      [[52, 60], [59, 50], [70, 48], [76, 56], [78, 68], [78, 110]]],
  // n — (1) the line down; (2) up over the arch and down the right leg.
  n: [[[32, 48], [32, 110]],
      [[32, 62], [40, 52], [54, 48], [64, 54], [68, 68], [68, 110]]],
  // o — one closed circle, counter-clockwise from the top.
  o: [[[50, 48], [35, 54], [27, 70], [27, 88], [35, 104], [50, 110], [65, 104], [73, 88], [73, 70], [65, 54], [50, 48]]],
  // p — (1) line down into the descender; (2) the circle out to the right.
  p: [[[30, 48], [30, 124]],
      [[30, 56], [44, 48], [60, 50], [70, 62], [72, 79], [68, 96], [55, 108], [41, 107], [30, 99]]],
  // q — (1) the circle, counter-clockwise; (2) line down into the descender, small flick right.
  q: [[[68, 56], [54, 48], [38, 50], [29, 64], [27, 82], [33, 98], [48, 108], [62, 104], [69, 92]],
      [[70, 50], [70, 118], [74, 124], [80, 119]]],
  // r — (1) short line down; (2) up and over the little shoulder to the right.
  r: [[[34, 48], [34, 110]],
      [[34, 62], [42, 52], [54, 48], [66, 52], [70, 60]]],
  // s — one S-curve: counter-clockwise top curve, across the middle, clockwise bottom curve.
  s: [[[68, 56], [56, 48], [42, 48], [32, 56], [34, 68], [46, 76], [58, 82], [68, 92], [66, 104], [54, 110], [40, 110], [28, 102]]],
  // t — (1) tall line down with a small curve at the foot; (2) the crossbar left→right.
  t: [[[48, 22], [48, 98], [53, 107], [66, 106]],
      [[30, 48], [68, 48]]],
  // u — (1) down, round the bottom, up the right side; (2) the right line down.
  u: [[[30, 48], [30, 90], [36, 104], [50, 110], [62, 104], [68, 92]],
      [[68, 48], [68, 110]]],
  // v — one stroke: slant down to the point, slant back up.
  v: [[[28, 48], [50, 110], [72, 48]]],
  // w — one stroke: down, up, down, up (two valleys).
  w: [[[24, 48], [37, 110], [50, 64], [63, 110], [76, 48]]],
  // x — TWO strokes: (1) slant down left→right; (2) slant down right→left, crossing the middle.
  x: [[[28, 48], [72, 110]],
      [[72, 48], [28, 110]]],
  // y — (1) short slant down to the middle; (2) long slant from the top-right down through the
  //     middle into the descender.
  y: [[[30, 48], [50, 84]],
      [[70, 48], [50, 84], [34, 122]]],
  // z — one stroke: across the top, slant down-left, across the bottom.
  z: [[[28, 48], [72, 48], [28, 110], [72, 110]]],
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
