// ui.js (Math) — math-specific question screens. Generic UI (home pickers, select-then-submit
// answer panel, celebrations, rewards shelf, done, parent scorecard, gate) comes from the SHARED
// ui-core (no duplication).

import { LEVELS } from './decks/math.js';
import { MODES } from './game.js';
import * as core from '../../shared/ui-core.js';

export const renderDone = core.renderDone;
export const renderParent = core.renderParent;
export const renderRewards = core.renderRewards;
export const gateMount = core.gateMount;
export const celebrate = core.celebrate;
export const mountQuit = core.mountQuit;

export function renderHome(mount, state, handlers) {
  core.renderHome(mount, { title: 'Add & Subtract', mascot: '➕', state, ranges: LEVELS, modes: MODES, pickLabel: 'Pick a level', lessonChoices: state.lessonChoices, lessonLength: state.lessonLength }, handlers);
}

const EMOJI = '🍎';

export function renderQuestion(mount, q, progressText, { onSubmit, onHear }) {
  mount.innerHTML = '';
  const wrap = core.el('div', { class: 'screen play' });
  wrap.append(core.el('div', { class: 'progress-dots', 'aria-hidden': 'true' }, progressText));

  // Objects mode only makes sense for small, countable operands; otherwise show the equation.
  const countable = q.mode === 'objects' && q.a <= 10 && q.b <= 10;

  if (q.mode === 'equation' || (q.mode === 'objects' && !countable)) {
    wrap.append(core.el('h2', { class: 'prompt' }, 'What is it?'));
    wrap.append(core.el('div', { class: 'equation', 'aria-label': `${q.a} ${q.op} ${q.b}` }, `${q.a} ${q.op} ${q.b} = ?`));
  } else if (q.mode === 'hear') {
    wrap.append(core.el('h2', { class: 'prompt' }, 'Listen, then answer'));
    const hear = core.el('button', { class: 'hear-btn', 'aria-label': 'Hear the problem again' }, '🔊  Hear it');
    hear.addEventListener('click', () => onHear());
    wrap.append(hear);
  } else if (countable) {
    wrap.append(core.el('h2', { class: 'prompt' }, q.op === '-' ? 'How many are left?' : 'How many in all?'));
    const row = core.el('div', { class: 'eq-objects' });
    row.append(group(q.a), core.el('span', { class: 'eq-op' }, q.op), group(q.b), core.el('span', { class: 'eq-op' }, '='), core.el('span', {}, '?'));
    wrap.append(row);
  }

  const panel = core.answerPanel(q.choices, { mode: 'numeral', onSubmit });
  wrap.append(panel.node);
  mount.append(wrap);
  return panel.controller;
}

function group(n) {
  const g = core.el('div', { class: 'eq-group', 'aria-label': String(n) });
  if (n === 0) g.append(core.el('span', { class: 'hint' }, '0'));
  else for (let i = 0; i < n; i++) g.append(core.el('span', { 'aria-hidden': 'true' }, EMOJI));
  return g;
}
