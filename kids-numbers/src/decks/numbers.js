// decks/numbers.js — the Numbers deck. Data-only, so the same engine/UI can load a
// Letters/Sight-Words/Math deck for other apps with no logic changes.
// Content is general knowledge (counting + numerals 0–1000), authored originally.

/** @typedef {{ id: string, value: number, word: string, emoji: string }} NumberCard */

const WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
// Friendly, countable emoji for the COUNT-objects mode → ZERO asset weight (lean). Cycles.
const EMOJI = ['', '🍎','🐤','⭐','🐠','🌸','🍓','🦋','🐞','🌼','🍂','🐶','🐱','🌟','🍪','🐝','🌷','🦄','🐢','🍉','🎈'];

export const COUNT_CAP = 20;  // count-objects mode never renders more than this many objects
export const ENUM_CAP = 100;  // numerals 0..ENUM_CAP are tracked individually; above this we sample

/** Selectable ranges. Recognition modes (Listen/Match) scale high; Count caps objects (see main). */
export const RANGES = [
  { id: 'r5', label: 'Up to 5', key: '5' },
  { id: 'r10', label: 'Up to 10', key: '10' },
  { id: 'r20', label: 'Up to 20', key: '20' },
  { id: 'r50', label: 'Up to 50', key: '50' },
  { id: 'r100', label: 'Up to 100', key: '100' },
  { id: 'r1000', label: 'Up to 1000', key: '1000' },
];

/** A card for any value, parsed from its id ('n7' → 7). Words/emoji only needed for small values. */
export function getCard(id) {
  const v = Number(String(id).replace(/^n/, '')) || 0;
  return { id: 'n' + v, value: v, word: WORDS[v] || String(v), emoji: EMOJI[v] || '🟦' };
}

/** Enumerated ids 0..max (used when max ≤ ENUM_CAP). */
export function idsForRange(max) {
  const out = [];
  for (let v = 0; v <= max; v++) out.push('n' + v);
  return out;
}

/** Sampled ids for big ranges (recognition only) — avoids enumerating 1000 SRS items (lean). */
export function sampleIds(max, n, rng = Math.random) {
  const s = new Set(['n0']);
  let guard = 0;
  while (s.size < n && guard++ < n * 30) s.add('n' + Math.floor(rng() * (max + 1)));
  return [...s];
}

export const DECK_META = {
  appId: 'kids-numbers',
  title: 'DL Numbers — Count & Learn',
  ids: idsForRange(ENUM_CAP), // base deck 0..100 for initial progress; big ranges add sampled ids
};
