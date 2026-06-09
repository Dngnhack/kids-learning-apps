// game.js (Math) — builds early-arithmetic questions across modes. Pure functions, on-device.
// Modes: 'equation' (see a+b=? → pick), 'hear' (hear it → pick), 'objects' (grouped objects → pick).

import { getFact } from './decks/math.js';

export function buildQuestion(id, opts = {}) {
  const mode = opts.mode || 'equation';
  const rng = opts.rng || Math.random;
  const f = getFact(id);
  return { id, a: f.a, b: f.b, op: f.op, value: f.value, choices: buildChoices(f.value, rng), mode };
}

/** 3 options: correct + 2 nearby distractors (value ± small), all ≥ 0, shuffled. Scales to any size. */
export function buildChoices(value, rng = Math.random) {
  const set = new Set([value]);
  let radius = 1;
  while (set.size < 3 && radius <= value + 6) {
    for (const d of [value - radius, value + radius]) { if (d >= 0) set.add(d); if (set.size >= 3) break; }
    radius++;
  }
  let extra = 1;
  while (set.size < 3) { set.add(value + extra); extra++; }
  const arr = Array.from(set).slice(0, 3);
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

export function isCorrect(question, picked) { return picked === question.value; }

/** Spoken form, e.g. "two plus three". */
export function spoken(q) { return `${q.a} ${q.op === '+' ? 'plus' : 'minus'} ${q.b}`; }

// MODE ORDER = pedagogical progression: concrete first — Count the groups (objects),
// then read + Solve the written problem, then Listen (hear it), then Mixed review. Concrete→abstract.
export const MODES = [
  { id: 'objects', label: 'Count', emoji: '🍎', desc: 'Count the groups, tap the answer' },
  { id: 'equation', label: 'Solve', emoji: '🟰', desc: 'See the problem, tap the answer' },
  { id: 'hear', label: 'Listen', emoji: '🔊', desc: 'Hear the problem, tap the answer' },
  { id: 'mixed', label: 'Mixed', emoji: '🎲', desc: 'A surprise mix of games' },
];
