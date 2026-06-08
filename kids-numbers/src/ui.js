// ui.js (Numbers) — numbers-specific question screens. Generic UI (home pickers, select-then-
// submit answer panel, celebrations, rewards shelf, done, parent scorecard, gate) comes from the
// SHARED ui-core (no duplication).

import { RANGES } from './decks/numbers.js';
import { MODES } from './game.js';
import { DIGIT_STROKES, TRACE_BOX, checkpoints, advance, isComplete } from './trace.js';
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

/** Trace mode: guide stroke(s) + a colored trail that follows the finger + checkpoint dots. */
export function renderTrace(mount, value, digit, progressText, { onComplete }) {
  mount.innerHTML = '';
  const wrap = core.el('div', { class: 'screen play trace' });
  wrap.append(core.el('div', { class: 'progress-dots', 'aria-hidden': 'true' }, progressText));
  wrap.append(core.el('h2', { class: 'prompt' }, 'Trace the ' + value));

  const SVGNS = 'http://www.w3.org/2000/svg';
  const strokes = DIGIT_STROKES[digit] || DIGIT_STROKES[1];
  const points = checkpoints(digit);
  const stage = core.el('div', { class: 'trace-stage' });
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${TRACE_BOX.w} ${TRACE_BOX.h}`); svg.setAttribute('class', 'trace-svg');

  // guide stroke(s) — the ghost the dots sit on
  for (const s of strokes) {
    const pl = document.createElementNS(SVGNS, 'polyline');
    pl.setAttribute('points', s.map((p) => p.join(',')).join(' '));
    pl.setAttribute('class', 'trace-guide'); svg.append(pl);
  }
  // colored trail (built from finger positions)
  const trail = document.createElementNS(SVGNS, 'polyline');
  trail.setAttribute('class', 'trace-trail'); trail.setAttribute('points', ''); svg.append(trail);
  // checkpoint dots, exactly on the guide vertices
  const dots = points.map((p, i) => {
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', i === 0 ? '9' : '6');
    c.setAttribute('class', 'cp' + (i === 0 ? ' start' : '')); svg.append(c); return c;
  });
  stage.append(svg); wrap.append(stage); mount.append(wrap);

  let idx = 0; const trailPts = [];
  const norm = (e) => {
    const r = svg.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return [((cx - r.left) / r.width) * TRACE_BOX.w, ((cy - r.top) / r.height) * TRACE_BOX.h];
  };
  const move = (e) => {
    const [x, y] = norm(e);
    trailPts.push(`${x.toFixed(1)},${y.toFixed(1)}`); trail.setAttribute('points', trailPts.join(' '));
    const ni = advance(points, idx, x, y);
    if (ni !== idx) { idx = ni; if (dots[idx - 1]) dots[idx - 1].classList.add('hit'); }
    if (isComplete(points, idx)) { svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerdown', move); core.celebrate(wrap); onComplete(); }
  };
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointermove', move);
}
