// game.js (Math) — builds early-arithmetic questions across modes. Pure functions, on-device.
// Modes: 'equation' (see a+b=? → pick), 'hear' (hear it → pick), 'objects' (grouped objects → pick).

import { getFact } from './decks/math.js';

export function buildQuestion(id, opts = {}) {
  const mode = opts.mode || 'equation';
  const max = typeof opts.max === 'number' ? opts.max : 10;
  const rng = opts.rng || Math.random;
  const f = getFact(id);
  return { id, a: f.a, b: f.b, op: f.op, value: f.value, choices: buildChoices(f.value, max, rng), mode };
}

/** 3 options: correct + 2 nearby distractors within [0,max], shuffled. Always solvable. */
export function buildChoices(value, max, rng = Math.random) {
  const set = new Set([value]);
  let radius = 1;
  while (set.size < 3 && radius <= max) {
    for (const d of [value - radius, value + radius]) { if (d >= 0 && d <= max) set.add(d); if (set.size >= 3) break; }
    radius++;
  }
  let extra = 0;
  while (set.size < 3 && extra <= Math.max(max, 3)) { set.add(extra); extra++; }
  const arr = Array.from(set).slice(0, 3);
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

export function isCorrect(question, picked) { return picked === question.value; }

/** Spoken form, e.g. "two plus three". */
export function spoken(q) { return `${q.a} ${q.op === '+' ? 'plus' : 'minus'} ${q.b}`; }

export const MODES = [
  { id: 'equation', label: 'Solve', emoji: '🟰', desc: 'See the problem, tap the answer' },
  { id: 'hear', label: 'Listen', emoji: '🔊', desc: 'Hear the problem, tap the answer' },
  { id: 'objects', label: 'Count', emoji: '🍎', desc: 'Count the groups, tap the answer' },
];
