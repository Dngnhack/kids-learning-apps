// ui.js (Numbers) — numbers-specific question screens. Generic UI (home pickers, answer tiles,
// rewards, done, parent scorecard, gate) comes from the SHARED ui-core (no duplication).

import { RANGES } from './decks/numbers.js';
import { MODES } from './game.js';
import { DIGIT_PATHS, TRACE_BOX, advance, isComplete } from './trace.js';
import * as core from '../../shared/ui-core.js';

export const renderDone = core.renderDone;
export const renderParent = core.renderParent;
export const gateMount = core.gateMount;

export function renderHome(mount, state, handlers) {
  core.renderHome(mount, { title: 'Count & Learn', mascot: '🔢', state, ranges: RANGES, modes: MODES }, handlers);
}

/** Tap-answer modes: count (objects), hear (audio→numeral), matchAudio (numeral→audio). */
export function renderQuestion(mount, q, progressText, { onAnswer, onHear }) {
  mount.innerHTML = '';
  const wrap = core.el('div', { class: 'screen play' });
  wrap.append(core.el('div', { class: 'progress-dots', 'aria-hidden': 'true' }, progressText));

  if (q.mode === 'count') {
    wrap.append(core.el('h2', { class: 'prompt' }, 'How many?'));
    const tray = core.el('div', { class: 'tray', role: 'img', 'aria-label': `${q.count} to count` });
    if (q.count === 0) { tray.classList.add('empty'); tray.append(core.el('span', { class: 'empty-label' }, 'none')); }
    else for (let i = 0; i < q.count; i++) tray.append(core.el('span', { class: 'obj', 'aria-hidden': 'true' }, q.emoji || '🟦'));
    wrap.append(tray);
    wrap.append(core.numeralTiles(q.choices, onAnswer));
  } else if (q.mode === 'hear') {
    wrap.append(core.el('h2', { class: 'prompt' }, 'Which number?'));
    const hear = core.el('button', { class: 'hear-btn', 'aria-label': 'Hear the number again' }, '🔊  Hear it');
    hear.addEventListener('click', () => onHear(q.value));
    wrap.append(hear, core.numeralTiles(q.choices, onAnswer));
  } else if (q.mode === 'matchAudio') {
    wrap.append(core.el('h2', { class: 'prompt' }, 'Find this number'));
    wrap.append(core.el('div', { class: 'big-numeral', 'aria-label': String(q.value) }, String(q.value)));
    wrap.append(core.el('div', { class: 'hint' }, 'Tap to hear · tap again to pick'));
    wrap.append(core.audioTiles(q.choices, onAnswer, onHear));
  }
  mount.append(wrap);
  return core.answerController(wrap);
}

/** Trace mode (numbers-specific): drag through the digit's checkpoints. */
export function renderTrace(mount, value, digit, progressText, { onComplete }) {
  mount.innerHTML = '';
  const wrap = core.el('div', { class: 'screen play trace' });
  wrap.append(core.el('div', { class: 'progress-dots', 'aria-hidden': 'true' }, progressText));
  wrap.append(core.el('h2', { class: 'prompt' }, 'Trace the ' + value));
  const points = DIGIT_PATHS[digit] || DIGIT_PATHS[1];
  const stage = core.el('div', { class: 'trace-stage' });
  stage.append(core.el('div', { class: 'trace-ghost', 'aria-hidden': 'true' }, String(digit)));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${TRACE_BOX.w} ${TRACE_BOX.h}`); svg.setAttribute('class', 'trace-svg');
  const dots = points.map((p, i) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', i === 0 ? '9' : '6');
    c.setAttribute('class', 'cp' + (i === 0 ? ' start' : '')); svg.append(c); return c;
  });
  stage.append(svg); wrap.append(stage); mount.append(wrap);

  let idx = 0;
  const norm = (e) => {
    const r = svg.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return [((cx - r.left) / r.width) * TRACE_BOX.w, ((cy - r.top) / r.height) * TRACE_BOX.h];
  };
  const move = (e) => {
    const [x, y] = norm(e);
    const ni = advance(points, idx, x, y);
    if (ni !== idx) { idx = ni; if (dots[idx - 1]) dots[idx - 1].classList.add('hit'); }
    if (isComplete(points, idx)) { svg.removeEventListener('pointermove', move); core.burst(wrap); onComplete(); }
  };
  svg.addEventListener('pointermove', move);
}
