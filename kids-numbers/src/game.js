// game.js — builds kid-friendly questions across interaction modes. Pure functions (no DOM,
// easy to test). All scoring is on-device. Reusable shape for Apps B/C/Math.
//
// Modes:
//   'count'      (M1) show N objects → tap the matching numeral
//   'hear'       (M2) app SAYS a number → tap the matching numeral
//   'matchAudio' (M3) show a numeral → tap-to-hear options, pick the one that matches
//   'trace'      (M4) trace the numeral shape (handled in trace.js)

import { getCard } from './decks/numbers.js';

/**
 * @param {string} id
 * @param {{ mode?: string, max?: number, rng?: () => number }} [opts]
 */
export function buildQuestion(id, opts = {}) {
  const mode = opts.mode || 'count';
  const max = typeof opts.max === 'number' ? opts.max : 10;
  const rng = opts.rng || Math.random;
  const card = getCard(id);
  const value = card.value;
  const choices = buildChoices(value, max, rng);
  return { id, value, word: card.word, emoji: card.emoji, count: value, choices, mode };
}

/**
 * 3 answer options: the correct value + 2 nearby distractors within [0,max], shuffled.
 * @param {number} value @param {number} max @param {() => number} rng
 */
export function buildChoices(value, max, rng = Math.random) {
  const set = new Set([value]);
  let radius = 1;
  while (set.size < 3 && radius <= max) {
    for (const d of [value - radius, value + radius]) {
      if (d >= 0 && d <= max) set.add(d);
      if (set.size >= 3) break;
    }
    radius++;
  }
  // if the range is tiny (e.g., max<2), pad upward so there are always 3 options
  let extra = 0;
  while (set.size < 3 && extra <= Math.max(max, 3)) { set.add(extra); extra++; }
  const arr = Array.from(set).slice(0, 3);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** @param {{value:number}} question @param {number} picked */
export function isCorrect(question, picked) {
  return picked === question.value;
}

export const MODES = [
  { id: 'count', label: 'Count', emoji: '🍎', desc: 'Count the things, tap the number' },
  { id: 'hear', label: 'Listen', emoji: '🔊', desc: 'Hear a number, tap it' },
  { id: 'matchAudio', label: 'Match', emoji: '🎧', desc: 'See a number, tap to hear, pick the match' },
  { id: 'trace', label: 'Trace', emoji: '✏️', desc: 'Trace the number shape' },
];
