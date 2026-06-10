// game.js (Letters) — builds kid-friendly questions. Pure functions (no DOM, easy to test). All
// scoring on-device. Mirrors the Numbers game.js shape.
//
// PHASE 1 activities (no phoneme dependency — accurate now):
//   'picture'  show an unambiguous EMOJI object → tap the LETTER it starts with (3-4 choices)
//   'trace'    trace the lowercase letter shape (handled in trace.js / ui.renderTrace)
//
// PHASE 2 (gated on curated phoneme clips — NOT built here): letterSound, soundLetter, phonics, mixed.

import { getCard, LETTER_OBJECTS } from './decks/letters.js';

/**
 * Build a "picture starts-with" question for a letter id.
 * @param {string} id e.g. 'Ls'
 * @param {{ pool?: string[], n?: number, rng?: () => number }} [opts]
 *   pool = the letters currently in play (the range) to draw distractors from; n = number of choices
 *   (3 or 4). Falls back to the whole alphabet if the pool is too small to fill the choices.
 */
export function buildQuestion(id, opts = {}) {
  const rng = opts.rng || Math.random;
  const card = getCard(id);
  const n = opts.n || 3;
  const pool = (opts.pool && opts.pool.length ? opts.pool : Object.keys(LETTER_OBJECTS));
  const choices = buildChoices(card.letter, pool, n, rng);
  return {
    mode: 'picture',
    id,
    letter: card.letter,         // the correct answer (lowercase)
    name: card.name,             // 'S' — for the choice button + speech (letter NAME, accurate TTS)
    word: card.word,             // 'sun' — spoken object name (accurate TTS)
    emoji: card.emoji,           // the picture shown
    choices,                     // array of lowercase letters to render as big buttons
  };
}

/**
 * n answer options: the correct letter + (n-1) distractors drawn from `pool` (the active range),
 * shuffled. Distractors are unique and never equal the answer; the alphabet backfills if the pool is
 * too small. Defensive: always returns exactly n DISTINCT letters when the alphabet allows.
 */
export function buildChoices(letter, pool, n = 3, rng = Math.random) {
  const want = Math.max(2, Math.min(n, 26));
  const set = new Set([letter]);
  // first try the active range (so distractors are letters the child is currently learning)
  const candidates = pool.filter((l) => l !== letter);
  shuffle(candidates, rng);
  for (const c of candidates) { if (set.size >= want) break; set.add(c); }
  // backfill from the whole alphabet if the range was too small to fill the buttons
  if (set.size < want) {
    const alpha = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((l) => !set.has(l));
    shuffle(alpha, rng);
    for (const c of alpha) { if (set.size >= want) break; set.add(c); }
  }
  const arr = Array.from(set);
  return shuffle(arr, rng);
}

function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** @param {{letter:string}} question @param {string} picked */
export function isCorrect(question, picked) {
  return String(picked).toLowerCase() === question.letter;
}

// ACTIVITY ORDER for the wizard (Phase 1 = the two accurate pedagogical bookends). Picture-starts-with
// is hardest/last stage but in Phase 1 it's one of only two built; Trace (letter
// formation) is listed first as the natural starting point. Phase-2 stages are shown LOCKED (see ui).
export const ACTIVITIES = [
  { id: 'trace', label: 'Trace', emoji: '✏️', desc: 'Trace the letter shape' },
  { id: 'picture', label: 'First Letter', emoji: '🖼️', desc: 'See a picture, tap its starting letter' },
];

// PHASE-2 activities, surfaced as "coming soon"/locked in the wizard so the progression is visible
// but never enabled with wrong (TTS) phoneme audio that would mis-teach reading.
export const LOCKED_ACTIVITIES = [
  { id: 'letterSound', label: 'Letter → Sound', emoji: '🔊', desc: 'Coming soon' },
  { id: 'soundLetter', label: 'Sound → Letter', emoji: '👂', desc: 'Coming soon' },
  { id: 'phonics', label: 'Blending', emoji: '🧩', desc: 'Coming soon' },
  { id: 'mixed', label: 'Mixed', emoji: '🎲', desc: 'Coming soon' },
];
