// ui.js (Math) — math-specific question screens. Generic UI (home pickers, answer tiles,
// rewards, done, parent scorecard, gate) comes from the SHARED ui-core (no duplication).

import { RANGES } from './decks/math.js';
import { MODES } from './game.js';
import * as core from '../../shared/ui-core.js';

export const renderDone = core.renderDone;
export const renderParent = core.renderParent;
export const gateMount = core.gateMount;

export function renderHome(mount, state, handlers) {
  core.renderHome(mount, { title: 'Add & Subtract', mascot: '➕', state, ranges: RANGES, modes: MODES }, handlers);
}

const EMOJI = '🍎';

export function renderQuestion(mount, q, progressText, { onAnswer, onHear }) {
  mount.innerHTML = '';
  const wrap = core.el('div', { class: 'screen play' });
  wrap.append(core.el('div', { class: 'progress-dots', 'aria-hidden': 'true' }, progressText));

  if (q.mode === 'equation') {
    wrap.append(core.el('h2', { class: 'prompt' }, 'What is it?'));
    wrap.append(core.el('div', { class: 'equation', 'aria-label': `${q.a} ${q.op} ${q.b}` }, `${q.a} ${q.op} ${q.b} = ?`));
    wrap.append(core.numeralTiles(q.choices, onAnswer));
  } else if (q.mode === 'hear') {
    wrap.append(core.el('h2', { class: 'prompt' }, 'Listen, then answer'));
    const hear = core.el('button', { class: 'hear-btn', 'aria-label': 'Hear the problem again' }, '🔊  Hear it');
    hear.addEventListener('click', () => onHear());
    wrap.append(hear, core.numeralTiles(q.choices, onAnswer));
  } else if (q.mode === 'objects') {
    wrap.append(core.el('h2', { class: 'prompt' }, q.op === '-' ? 'How many are left?' : 'How many in all?'));
    const row = core.el('div', { class: 'eq-objects' });
    row.append(group(q.a), core.el('span', { class: 'eq-op' }, q.op), group(q.b), core.el('span', { class: 'eq-op' }, '='), core.el('span', {}, '?'));
    wrap.append(row);
    wrap.append(core.numeralTiles(q.choices, onAnswer));
  }
  mount.append(wrap);
  return core.answerController(wrap);
}

function group(n) {
  const g = core.el('div', { class: 'eq-group', 'aria-label': String(n) });
  if (n === 0) g.append(core.el('span', { class: 'hint' }, '0'));
  else for (let i = 0; i < n; i++) g.append(core.el('span', { 'aria-hidden': 'true' }, EMOJI));
  return g;
}
