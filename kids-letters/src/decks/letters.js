// decks/letters.js — the Letters deck. Data-only, so the same shared engine/UI loads it with no
// logic changes (mirrors decks/numbers.js). Content is general knowledge (the alphabet) + a curated,
// UNAMBIGUOUS emoji per letter for the "Picture starts-with" game. Emoji = copyright-clean (no
// branded characters), zero asset weight, no GPU. Authored originally for Digital Legends.
//
// PEDAGOGY : the wizard "Range" = systematic-synthetic-
// phonics GROUPS (Jolly-Phonics order), NOT A-Z, because Group 1 (s,a,t,i,p,n) lets a child build
// real words almost immediately. An "All letters" A-Z set is offered as an alternate for the picture
// game. Phoneme-dependent stages are PHASE 2 (curated audio clips) and not built here.

/** @typedef {{ id: string, letter: string, name: string, word: string, emoji: string }} LetterCard */

// One CURATED, UNAMBIGUOUS object per letter for "Picture starts-with". The object's NAME clearly
// starts with the target letter, and the emoji is broadly-supported + unmistakable. The child hears
// the OBJECT NAME + the LETTER NAME (both accurate via TTS — no phonemes this phase).
// Notes on the few letters with no perfect single-object emoji (flagged honestly):
//   J → 🧃 "juice" (clean; juggler 🤹 reads as a person, not a 'J' object)
//   N → 👃 "nose"  (🪺 nest renders inconsistently on older devices)
//   O → 🐙 "octopus" (🍊 orange is also valid; octopus is more distinctive)
//   X → 🦊 is NOT x; there is no everyday object starting with x, so we use 🎵 "xylophone" — the
//        ONE genuinely awkward letter (xylophone is the standard phonics choice; flagged).
//   Q → 👑 "queen"  Y → 🪀 "yo-yo"  U → ☂️ "umbrella"  V → 🎻 "violin"
export const LETTER_OBJECTS = {
  a: { word: 'apple', emoji: '🍎' },
  b: { word: 'ball', emoji: '⚽' },
  c: { word: 'cat', emoji: '🐱' },
  d: { word: 'dog', emoji: '🐶' },
  e: { word: 'egg', emoji: '🥚' },
  f: { word: 'fish', emoji: '🐟' },
  g: { word: 'grapes', emoji: '🍇' },
  h: { word: 'house', emoji: '🏠' },
  i: { word: 'ice cream', emoji: '🍦' },
  j: { word: 'juice', emoji: '🧃' },
  k: { word: 'kite', emoji: '🪁' },
  l: { word: 'lion', emoji: '🦁' },
  m: { word: 'moon', emoji: '🌙' },
  n: { word: 'nose', emoji: '👃' },
  o: { word: 'octopus', emoji: '🐙' },
  p: { word: 'penguin', emoji: '🐧' },
  q: { word: 'queen', emoji: '👑' },
  r: { word: 'rainbow', emoji: '🌈' },
  s: { word: 'sun', emoji: '☀️' },
  t: { word: 'tree', emoji: '🌳' },
  u: { word: 'umbrella', emoji: '☂️' },
  v: { word: 'violin', emoji: '🎻' },
  w: { word: 'watch', emoji: '⌚' },
  x: { word: 'xylophone', emoji: '🎵' },
  y: { word: 'yo-yo', emoji: '🪀' },
  z: { word: 'zebra', emoji: '🦓' },
};

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

// Phonics teaching GROUPS (Jolly-Phonics order). Group 1 lets kids build sat/pin/tap/nap right away.
// Subsequent groups add the rest of the 26 letters in the established sound-first order.
export const PHONICS_GROUPS = [
  { key: 'g1', label: 'Group 1 · s a t i p n', letters: ['s', 'a', 't', 'i', 'p', 'n'] },
  { key: 'g2', label: 'Group 2 · c k e h r m d', letters: ['c', 'k', 'e', 'h', 'r', 'm', 'd'] },
  { key: 'g3', label: 'Group 3 · g o u l f b', letters: ['g', 'o', 'u', 'l', 'f', 'b'] },
  { key: 'g4', label: 'Group 4 · j z w v y x', letters: ['j', 'z', 'w', 'v', 'y', 'x'] },
];

/** A letter -> the index of the phonics group it belongs to (for ordering/labels). */
const GROUP_OF = (() => {
  const m = {};
  PHONICS_GROUPS.forEach((g, gi) => g.letters.forEach((l) => { m[l] = gi; }));
  return m;
})();

/** Selectable ranges for the wizard. Phonics groups (default progression) + an "All letters" set.
 *  The "All letters" A-Z set is the alternate the calls for, mainly for the picture game. */
export const RANGES = [
  ...PHONICS_GROUPS.map((g) => ({ id: g.key, key: g.key, label: g.label, letters: g.letters })),
  { id: 'all', key: 'all', label: 'All letters · A–Z', letters: ALPHABET.slice() },
];

/** Letters for a range key. Unknown key → Group 1 (safe default). */
export function lettersForRange(key) {
  const r = RANGES.find((x) => x.key === key);
  return r ? r.letters.slice() : PHONICS_GROUPS[0].letters.slice();
}

/** Intersect a range with a set of letters we actually support for an activity (e.g. trace geometry).
 *  Keeps phonics order. If the intersection is empty, falls back to the supported list itself so the
 *  activity is never unplayable. */
export function lettersForRangeLimited(key, supported) {
  const set = new Set(supported);
  const base = lettersForRange(key).filter((l) => set.has(l));
  return base.length ? base : supported.slice();
}

/** A card for a letter id ('Ls' -> 's'). The object word/emoji come from LETTER_OBJECTS. */
export function getCard(id) {
  const letter = String(id).replace(/^L/, '').toLowerCase() || 'a';
  const o = LETTER_OBJECTS[letter] || { word: letter, emoji: '🔤' };
  return { id: 'L' + letter, letter, name: letter.toUpperCase(), word: o.word, emoji: o.emoji };
}

/** Stable ids for a list of letters. */
export function idsFor(letters) { return letters.map((l) => 'L' + l); }

export const DECK_META = {
  appId: 'kids-letters',
  title: 'DL Letters — Read & Trace',
  // base deck = the full alphabet so the parent progress denominator + SRS are stable across ranges.
  ids: ALPHABET.map((l) => 'L' + l),
  alphabet: ALPHABET.slice(),
  groupOf: GROUP_OF,
};
