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

/** Trace mode (connect-the-dots): numbered START point(s) + directional ARROWS + stroke order; the
 *  trail snaps to the path (no scribbling) and fills the hollow outline; completes ONLY when the
 *  FINAL checkpoint of the LAST stroke is reached (no early finish). Forgiving + "keep going" cue. */
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

  // hollow-outline TRACK (template channel) — from vertices so it's smooth + aligned with the dots
  for (const s of vstrokes) { const t = mk('polyline'); t.setAttribute('points', s.map((p) => p.join(',')).join(' ')); t.setAttribute('class', 'trace-track'); svg.append(t); }
  // direction ARROWS along each stroke (oriented toward the next dot) — "this way"
  dstrokes.forEach((s) => {
    for (let i = 0; i < s.length - 1; i += 2) {
      const [ax, ay] = s[i], [bx, by] = s[i + 1];
      const ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const a = mk('polygon'); a.setAttribute('points', '-4,-3 4,0 -4,3'); a.setAttribute('class', 'trace-arrow');
      a.setAttribute('transform', `translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${ang.toFixed(0)})`);
      svg.append(a);
    }
  });
  // colored trail (snapped finger path) fills the channel as the child connects the dots
  const trail = mk('polyline'); trail.setAttribute('class', 'trace-trail'); trail.setAttribute('points', ''); svg.append(trail);
  // checkpoint dots (densified, ordered)
  const dots = points.map((p) => { const c = mk('circle'); c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', '5'); c.setAttribute('class', 'cp'); svg.append(c); return c; });
  // numbered START marker(s): a green circle (+ stroke number for multi-stroke digits) at each stroke start
  starts.forEach((si, k) => {
    const [sx, sy] = points[si];
    const g = mk('circle'); g.setAttribute('cx', sx); g.setAttribute('cy', sy); g.setAttribute('r', '11'); g.setAttribute('class', 'cp-start'); svg.append(g);
    if (multi) { const n = mk('text'); n.setAttribute('x', sx); n.setAttribute('y', sy + 4); n.setAttribute('text-anchor', 'middle'); n.setAttribute('class', 'cp-start-num'); n.textContent = String(k + 1); svg.append(n); }
  });
  if (dots[0]) dots[0].classList.add('next');
  stage.append(svg); wrap.append(stage); mount.append(wrap);

  let idx = 0; const trailPts = [];
  const norm = (e) => {
    const r = svg.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return [((cx - r.left) / r.width) * TRACE_BOX.w, ((cy - r.top) / r.height) * TRACE_BOX.h];
  };
  const TOL = 16;
  const hint = core.el('div', { class: 'trace-hint', 'aria-hidden': 'true' }, 'Keep going — connect the dots!');
  hint.style.display = 'none'; wrap.append(hint);
  let hintTimer = null;
  const armHint = () => { clearTimeout(hintTimer); hint.style.display = 'none'; hintTimer = setTimeout(() => { if (idx > 0 && idx < points.length) hint.style.display = ''; }, 2600); };
  const markNext = () => { dots.forEach((d) => d.classList.remove('next')); if (dots[idx]) dots[idx].classList.add('next'); };

  const move = (e) => {
    const [x, y] = norm(e);
    const snap = nearestOnPath(digit, x, y);
    if (snap.dist <= TOL) { trailPts.push(`${snap.x.toFixed(1)},${snap.y.toFixed(1)}`); trail.setAttribute('points', trailPts.join(' ')); }
    let moved = false, ni = advance(points, idx, x, y);
    while (ni !== idx) { idx = ni; dots[idx - 1].classList.add('hit'); moved = true; ni = advance(points, idx, x, y); }
    if (moved) { markNext(); armHint(); }
    if (isComplete(points, idx)) { clearTimeout(hintTimer); hint.remove(); svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerdown', move); core.celebrate(wrap); onComplete(); }
  };
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointermove', move);
  armHint();
}
