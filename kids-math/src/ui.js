// ui.js (Math) — math-specific question screens. Generic UI (home pickers, select-then-submit
// answer panel, celebrations, rewards shelf, done, parent scorecard, gate) comes from the SHARED
// ui-core (no duplication).

import { LEVELS } from './decks/math.js';
import { MODES } from './game.js';
import * as core from '../../shared/ui-core.js';

export const renderDone = core.renderDone;
export const renderParent = core.renderParent;
export const renderRewards = core.renderRewards;
export const renderAlbum = core.renderAlbum;
export const gateMount = core.gateMount;
export const celebrate = core.celebrate;
export const mountQuit = core.mountQuit;

export const LESSON_COUNTS = [5, 10, 15, 20];

/**
 * CONTEXT-AWARE options for the wizard (KWS-001 / AC2). The "range" here is the difficulty LEVEL
 * (operation × digit-count). The Count activity renders physical object groups, so it only makes
 * sense at the 1-digit levels (operands ≤ 9 are countable); offering Add/Take-away 2- or 3-digit for
 * Count would show un-renderable groups. Solve / Listen / Mixed work at every level.
 */
export function optionsFor(activity) {
  let ranges = LEVELS;
  if (activity === 'objects') ranges = LEVELS.filter((l) => l.digits === 1); // a1 + s1 only (countable)
  return { ranges: ranges.map((l) => ({ key: l.key, label: l.label })), counts: LESSON_COUNTS };
}

export function renderWizard(mount, defaults, handlers) {
  core.renderWizard(mount, {
    title: 'Add & Subtract', mascot: '➕', activities: MODES, optionsFor, pickLabel: 'Pick a level', defaults,
  }, handlers);
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
