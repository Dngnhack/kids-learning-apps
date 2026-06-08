// decks/numbers.js — the Numbers deck. Data-only, so the same engine/UI can load a
// Letters/Sight-Words/Math deck for other apps with no logic changes.
// Content is general knowledge (counting 0–20), authored originally.

/** @typedef {{ id: string, value: number, word: string, emoji: string }} NumberCard */

const WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
// Friendly, countable emoji per card → ZERO asset weight (lean). Cycles for >10.
const EMOJI = ['', '🍎','🐤','⭐','🐠','🌸','🍓','🦋','🐞','🌼','🍂','🐶','🐱','🌟','🍪','🐝','🌷','🦄','🐢','🍉','🎈'];

/** @type {NumberCard[]} */
export const NUMBERS = Array.from({ length: 21 }, (_, v) => ({
  id: 'n' + v, value: v, word: WORDS[v], emoji: EMOJI[v] || '🟦',
}));

/** Selectable difficulty ranges (expandable). Each includes 0..max for counting. */
export const RANGES = [
  { id: 'r5', label: 'Up to 5', max: 5 },
  { id: 'r10', label: 'Up to 10', max: 10 },
  { id: 'r15', label: 'Up to 15', max: 15 },
  { id: 'r20', label: 'Up to 20', max: 20 },
];

/** Active card ids for a range max (0..max). @param {number} max */
export function idsForRange(max) {
  return NUMBERS.filter((n) => n.value <= max).map((n) => n.id);
}

export const DECK_META = {
  appId: 'kids-numbers',
  title: 'DL Numbers — Count & Learn',
  ids: NUMBERS.map((n) => n.id), // full deck (0–20); a session uses the active range
};

/** @param {string} id @returns {NumberCard|undefined} */
export function getCard(id) { return NUMBERS.find((n) => n.id === id); }
