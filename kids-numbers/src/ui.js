// ui.js (Numbers) — numbers-specific question screens. Generic UI (home pickers, select-then-
// submit answer panel, celebrations, rewards shelf, done, parent scorecard, gate) comes from the
// SHARED ui-core (no duplication).

import { RANGES } from './decks/numbers.js';
import { MODES } from './game.js';
import { DIGIT_STROKES, TRACE_BOX, denseStrokes, checkpoints, strokeStarts, advance, isComplete, nearestOnPath } from './trace.js';
import * as core from '../../shared/ui-core.js';

export const renderDone = core.renderDone;
export const renderParent = core.renderParent;
export const renderRewards = core.renderRewards;
export const gateMount = core.gateMount;
export const celebrate = core.celebrate;

export function renderHome(mount, state, handlers) {
  core.renderHome(mount, { title: 'Count & Learn', mascot: '🔢', state, ranges: RANGES, modes: MODES, pickLabel: 'How high?' }, handlers);
}

/** Tap-answer modes: count (objects), hear (audio→numeral), matchAudio (numeral→audio). */
export function renderQuestion(mount, q, progressText, { onSubmit, onHear }) {
  mount.innerHTML = '';
  const wrap = core.el('div', { class: 'screen play' });
  wrap.append(core.el('div', { class: 'progress-dots', 'aria-hidden': 'true' }, progressText));

  if (q.mode === 'count') {
    wrap.append(core.el('h2', { class: 'prompt' }, 'How many?'));
    const tray = core.el('div', { class: 'tray', role: 'img', 'aria-label': `${q.count} to count` });
    // count 0 → leave the tray BLANK (an empty box is zero) — no "none" text.
    for (let i = 0; i < q.count; i++) tray.append(core.el('span', { class: 'obj', 'aria-hidden': 'true' }, q.emoji || '🟦'));
    wrap.append(tray);
  } else if (q.mode === 'hear') {
    wrap.append(core.el('h2', { class: 'prompt' }, 'Which number?'));
    const hear = core.el('button', { class: 'hear-btn', 'aria-label': 'Hear the number again' }, '🔊  Hear it');
    hear.addEventListener('click', () => onHear(q.value));
    wrap.append(hear);
  } else if (q.mode === 'matchAudio') {
    wrap.append(core.el('h2', { class: 'prompt' }, 'Find this number'));
    wrap.append(core.el('div', { class: 'big-numeral', 'aria-label': String(q.value) }, String(q.value)));
    wrap.append(core.el('div', { class: 'hint' }, 'Tap to hear · pick one · Check'));
  }

  const panel = core.answerPanel(q.choices, { mode: q.mode === 'matchAudio' ? 'audio' : 'numeral', onSubmit, onHear });
  wrap.append(panel.node);
  mount.append(wrap);
  return panel.controller;
}

/** Trace mode v3 (strict guided tracing): in-order ONLY (dot N activates only after N-1) — the child
 *  cannot skip or go out of order; the RAINBOW trail fills the hollow outline ONLY along the path,
 *  in order (off-path / out-of-order input draws NOTHING + a gentle "stay on the line" cue); the
 *  directional ARROWS light up in sequence toward the next dot. A brighter, more accurate outline +
 *  dashed centerline guide. Completes ONLY when the FINAL checkpoint of the LAST stroke is reached. */
export function renderTrace(mount, value, digit, progressText, { onComplete }) {
  mount.innerHTML = '';
  const wrap = core.el('div', { class: 'screen play trace' });
  wrap.append(core.el('div', { class: 'progress-dots', 'aria-hidden': 'true' }, progressText));
  wrap.append(core.el('h2', { class: 'prompt' }, 'Trace the ' + value));

  const SVGNS = 'http://www.w3.org/2000/svg';
  const mk = (t) => document.createElementNS(SVGNS, t);
  const vstrokes = DIGIT_STROKES[digit] || DIGIT_STROKES[1]; // vertices → smooth track
  const dstrokes = denseStrokes(digit);                      // densified → dots + arrows
  const points = checkpoints(digit);                         // flat ordered checkpoints
  const starts = strokeStarts(digit);                        // flat index of each stroke's first dot
  const multi = vstrokes.length > 1;

  const stage = core.el('div', { class: 'trace-stage' });
  const svg = mk('svg');
  svg.setAttribute('viewBox', `0 0 ${TRACE_BOX.w} ${TRACE_BOX.h}`); svg.setAttribute('class', 'trace-svg');

  // RAINBOW gradient for the trail (fun + clearly shows progress along the stroke)
  const defs = mk('defs');
  const grad = mk('linearGradient'); grad.setAttribute('id', `rainbow-${digit}`);
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('x2', '1'); grad.setAttribute('y2', '1');
  [['0', '#e11d48'], ['.2', '#f59e0b'], ['.4', '#eab308'], ['.6', '#16a34a'], ['.8', '#2563eb'], ['1', '#7c3aed']]
    .forEach(([o, c]) => { const st = mk('stop'); st.setAttribute('offset', o); st.setAttribute('stop-color', c); grad.append(st); });
  defs.append(grad); svg.append(defs);

  // hollow-outline TRACK (bright wide channel) + dashed CENTERLINE guide — from vertices, aligned with the dots
  for (const s of vstrokes) { const t = mk('polyline'); t.setAttribute('points', s.map((p) => p.join(',')).join(' ')); t.setAttribute('class', 'trace-track'); svg.append(t); }
  for (const s of vstrokes) { const o = mk('polyline'); o.setAttribute('points', s.map((p) => p.join(',')).join(' ')); o.setAttribute('class', 'trace-outline'); svg.append(o); }

  // RAINBOW trail — rebuilt strictly from the reached path points (always ON the line, always in order)
  const trail = mk('polyline'); trail.setAttribute('class', 'trace-trail'); trail.setAttribute('points', '');
  trail.setAttribute('stroke', `url(#rainbow-${digit})`); svg.append(trail);

  // direction ARROWS along each stroke; each tagged with the flat checkpoint index it points toward → lit in sequence
  const arrows = [];
  dstrokes.forEach((s, si) => {
    const base = starts[si];
    for (let i = 0; i < s.length - 1; i += 2) {
      const [ax, ay] = s[i], [bx, by] = s[i + 1];
      const ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const a = mk('polygon'); a.setAttribute('points', '-5,-3.5 5,0 -5,3.5'); a.setAttribute('class', 'trace-arrow');
      a.setAttribute('transform', `translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${ang.toFixed(0)})`);
      svg.append(a); arrows.push({ el: a, t: base + i + 1 });
    }
  });
  // checkpoint dots (densified, ordered)
  const dots = points.map((p) => { const c = mk('circle'); c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', '5'); c.setAttribute('class', 'cp'); svg.append(c); return c; });
  // numbered START marker(s): green circle (+ stroke number for multi-stroke digits) at each stroke start
  starts.forEach((si, k) => {
    const [sx, sy] = points[si];
    const g = mk('circle'); g.setAttribute('cx', sx); g.setAttribute('cy', sy); g.setAttribute('r', '11'); g.setAttribute('class', 'cp-start'); svg.append(g);
    if (multi) { const n = mk('text'); n.setAttribute('x', sx); n.setAttribute('y', sy + 4); n.setAttribute('text-anchor', 'middle'); n.setAttribute('class', 'cp-start-num'); n.textContent = String(k + 1); svg.append(n); }
  });
  stage.append(svg); wrap.append(stage); mount.append(wrap);

  const TOL = 16;
  let idx = 0;
  const hint = core.el('div', { class: 'trace-hint', 'aria-hidden': 'true' }, 'Stay on the line — follow the arrows!');
  hint.style.display = 'none'; wrap.append(hint);
  let hintTimer = null;
  const norm = (e) => {
    const r = svg.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return [((cx - r.left) / r.width) * TRACE_BOX.w, ((cy - r.top) / r.height) * TRACE_BOX.h];
  };
  // The trail is ALWAYS the reached on-path polyline (points[0..idx]) — never raw finger input → it
  // can never draw outside the line and never out of order.
  const drawTrail = () => trail.setAttribute('points', points.slice(0, idx + 1).map((p) => p.join(',')).join(' '));
  const markNext = () => { dots.forEach((d, i) => d.classList.toggle('next', i === idx)); arrows.forEach((a) => a.el.classList.toggle('lit', a.t >= idx && a.t < idx + 4)); };
  const showCue = () => { clearTimeout(hintTimer); if (idx > 0 && idx < points.length) hint.style.display = ''; };
  const clearCue = () => { hint.style.display = 'none'; clearTimeout(hintTimer); hintTimer = setTimeout(showCue, 2400); };

  const move = (e) => {
    const [x, y] = norm(e);
    const onPath = nearestOnPath(digit, x, y).dist <= TOL;          // is the finger ON the numeral line?
    let moved = false, ni = advance(points, idx, x, y);             // advance() only matches the NEXT dot → in-order, no skip
    while (ni !== idx) { idx = ni; if (dots[idx - 1]) dots[idx - 1].classList.add('hit'); moved = true; ni = advance(points, idx, x, y); }
    if (moved) { drawTrail(); markNext(); clearCue(); }             // progressed in order → extend the rainbow on the line
    else if (!onPath) { showCue(); }                                // off-path or out-of-order → draw NOTHING + gentle cue
    if (isComplete(points, idx)) { clearTimeout(hintTimer); hint.remove(); svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerdown', move); core.celebrate(wrap); onComplete(); }
  };
  markNext();
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointermove', move);
  hintTimer = setTimeout(showCue, 2400);
}
