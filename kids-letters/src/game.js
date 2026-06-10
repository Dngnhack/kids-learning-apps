// game.js (Letters) — builds kid-friendly questions. Pure functions (no DOM, easy to test). All
// scoring on-device. Mirrors the Numbers game.js shape.
//
// PHASE 1 activities (no phoneme dependency — accurate now):
//   'picture'  show an unambiguous EMOJI object → tap the LETTER it starts with (3-4 choices)
//   'trace'    trace the lowercase letter shape (handled in trace.js / ui.renderTrace)
//
// PHASE 2 sound-based phonics activities (AUDIO-SOURCE-AGNOSTIC — the sound is played through the
// phoneme-audio seam, so the question DATA here never depends on whether a recorded clip or interim
// TTS produced it):
//   'letterSound'  see a LETTER → pick the matching SOUND (audio choices, tap to hear)
//   'soundLetter'  hear a SOUND → pick the matching LETTER (letter buttons)
//   'phonics'      hear the sounds of a short word in order → pick the missing/blended LETTER
//   'mixed'        capstone — randomly interleaves all of the above + picture

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

// Simple CVC words for the PHONICS blending stage, keyed by the letters they're built from. Only
// Group-1-buildable words use Group-1 letters (s,a,t,i,p,n) so the first phonics group is playable
// without later sounds. Each word is split into its sounds for "hear the sounds → pick the letter".
export const CVC_WORDS = [
  { word: 'sat', letters: ['s', 'a', 't'] },
  { word: 'pin', letters: ['p', 'i', 'n'] },
  { word: 'tap', letters: ['t', 'a', 'p'] },
  { word: 'nap', letters: ['n', 'a', 'p'] },
  { word: 'tip', letters: ['t', 'i', 'p'] },
  { word: 'pat', letters: ['p', 'a', 't'] },
  { word: 'sit', letters: ['s', 'i', 't'] },
  { word: 'pit', letters: ['p', 'i', 't'] },
  { word: 'tin', letters: ['t', 'i', 'n'] },
  { word: 'nip', letters: ['n', 'i', 'p'] },
];

/**
 * PHASE 2 — build a SOUND-BASED question for a letter id, audio-source-agnostic. The returned object
 * carries only DATA (letters/word/choices/which to play); main.js plays the sound via the phoneme
 * seam, so a later swap to recorded clips changes nothing here.
 *   • 'letterSound' — show q.letter; the answer is the matching SOUND. choices = letters rendered as
 *                     audio tiles (tap to hear each sound); correct = q.letter.
 *   • 'soundLetter' — play q.letter's sound (q.play=q.letter); choices = letters as buttons.
 *   • 'phonics'     — pick a CVC word the id's letter starts/appears in; blend its sounds, then the
 *                     child picks the TARGET letter (q.letter) from letter buttons. q.word + q.sounds
 *                     drive the "hear the sounds" playback.
 * @param {string} mode 'letterSound' | 'soundLetter' | 'phonics'
 * @param {string} id e.g. 'Ls'
 */
export function buildPhonemeQuestion(mode, id, opts = {}) {
  const rng = opts.rng || Math.random;
  const card = getCard(id);
  const n = opts.n || 3;
  const pool = (opts.pool && opts.pool.length ? opts.pool : Object.keys(LETTER_OBJECTS));
  const letter = card.letter;

  if (mode === 'phonics') {
    // pick a CVC word that USES this letter and is buildable from the active range when possible
    const inRange = (w) => w.letters.every((l) => pool.includes(l));
    const uses = CVC_WORDS.filter((w) => w.letters.includes(letter));
    const buildable = uses.filter(inRange);
    const candidates = buildable.length ? buildable : (uses.length ? uses : CVC_WORDS);
    const w = candidates[Math.floor(rng() * candidates.length)];
    const choices = buildChoices(letter, pool, n, rng);
    return {
      mode: 'phonics',
      id,
      letter,                    // the correct answer the child picks
      name: card.name,
      word: w.word,              // 'sat' — spoken whole after blending (accurate TTS word)
      sounds: w.letters.slice(), // the per-sound phoneme sequence to play (via the seam)
      choices,                   // letters as buttons
    };
  }

  // letterSound + soundLetter share the same choice shape (letters); they differ only in WHICH side
  // is shown vs. played — handled in ui/main. Audio is always routed through the phoneme seam.
  const choices = buildChoices(letter, pool, n, rng);
  return {
    mode,
    id,
    letter,                      // correct answer (lowercase)
    name: card.name,             // letter NAME for the shown-letter label (accurate TTS)
    play: letter,                // the letter whose SOUND the seam should play (soundLetter)
    choices,                     // letters; in letterSound they become audio tiles, else buttons
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

// ACTIVITY ORDER for the wizard — the full scaffolded progression (easiest → hardest), matching the
// spec's pedagogical order: TRACE → LETTER→SOUND → SOUND→LETTER → PHONICS/BLENDING →
// PICTURE-STARTS-WITH (hardest, last) → MIXED capstone. The sound-based stages route ALL audio
// through the phoneme seam (phoneme-audio.js), so they're audio-source-agnostic.
export const ACTIVITIES = [
  { id: 'trace', label: 'Trace', emoji: '✏️', desc: 'Trace the letter shape' },
  { id: 'letterSound', label: 'Letter → Sound', emoji: '🔊', desc: 'See a letter, pick its sound' },
  { id: 'soundLetter', label: 'Sound → Letter', emoji: '👂', desc: 'Hear a sound, pick its letter' },
  { id: 'phonics', label: 'Blending', emoji: '🧩', desc: 'Blend the sounds, pick the letter' },
  { id: 'picture', label: 'First Letter', emoji: '🖼️', desc: 'See a picture, tap its starting letter' },
  { id: 'mixed', label: 'Mixed', emoji: '🎲', desc: 'A mix of everything you have learned' },
];

// ── SOUND-STAGE SHIP GATE (PD-002) ──────────────────────────────────────────────────────────────
// The phoneme sound stages (letterSound / soundLetter / phonics / mixed) stay HIDDEN from the
// wizard until the phoneme audio is verified (PD-002). DEFAULT OFF. Nothing is deleted — all the
// stage code, data and tests stay; flip this to true to re-show them. trace + picture always ship.
export const SOUND_STAGES_ENABLED = false;
export const SOUND_STAGE_IDS = ['letterSound', 'soundLetter', 'phonics', 'mixed'];
/** The activities the wizard actually SHOWS (the ship gate applied). ACTIVITIES stays complete. */
export function visibleActivities() {
  return SOUND_STAGES_ENABLED ? ACTIVITIES : ACTIVITIES.filter((a) => !SOUND_STAGE_IDS.includes(a.id));
}

// the sound-based modes (used by main to route audio through the phoneme seam + by mixed interleave).
export const SOUND_MODES = ['letterSound', 'soundLetter', 'phonics'];

// the modes the MIXED capstone interleaves (all taught stage types except trace — trace is a motor
// task, not a quick-answer question, so the capstone stays a steady answer-driven flow).
export const MIXED_MODES = ['letterSound', 'soundLetter', 'phonics', 'picture'];

/** Pick a per-question mode for the MIXED capstone, avoiding back-to-back repeats. @param {string} prev */
export function pickMixedMode(prev, rng = Math.random) {
  const pool = MIXED_MODES.filter((m) => m !== prev);
  const list = pool.length ? pool : MIXED_MODES;
  return list[Math.floor(rng() * list.length)];
}
