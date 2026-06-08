// decks/math.js — early-arithmetic deck. Data-only. Each "fact" (e.g. 2+3, 5-2) is an SRS item,
// so the shared adaptive engine tracks each fact individually. Difficulty = digit-count TIERS
// (1/2/3-digit) for both add and subtract (subtraction never negative, b ≤ a). 2/3-digit tiers
// are SAMPLED (can't enumerate millions of facts — lean). Multiplication-ready (add an
// op + a level). Clean-room.

/** @typedef {{ id: string, a: number, b: number, op: '+'|'-', value: number }} Fact */

/** Selectable difficulty tiers: operation × digit-count. */
export const LEVELS = [
  { id: 'a1', key: 'a1', label: 'Add · 1-digit', op: '+', digits: 1 },
  { id: 'a2', key: 'a2', label: 'Add · 2-digit', op: '+', digits: 2 },
  { id: 'a3', key: 'a3', label: 'Add · 3-digit', op: '+', digits: 3 },
  { id: 's1', key: 's1', label: 'Take away · 1-digit', op: '-', digits: 1 },
  { id: 's2', key: 's2', label: 'Take away · 2-digit', op: '-', digits: 2 },
  { id: 's3', key: 's3', label: 'Take away · 3-digit', op: '-', digits: 3 },
];

export function getLevel(key) { return LEVELS.find((l) => l.key === key) || LEVELS[0]; }

const loOf = (d) => (d <= 1 ? 0 : Math.pow(10, d - 1)); // 1-digit starts at 0; 2-digit at 10; 3-digit at 100
const hiOf = (d) => Math.pow(10, d) - 1;                 // 9 / 99 / 999

/** Sample n distinct fact ids for a level. Subtraction keeps b ≤ a (never negative). */
export function sampleIds(levelKey, n, rng = Math.random) {
  const L = getLevel(levelKey);
  const lo = loOf(L.digits), hi = hiOf(L.digits);
  const span = hi - lo + 1;
  const ids = new Set();
  let guard = 0;
  while (ids.size < n && guard++ < n * 40) {
    const a = lo + Math.floor(rng() * span);
    if (L.op === '+') { const b = lo + Math.floor(rng() * span); ids.add(`add:${a}:${b}`); }
    else { const b = Math.floor(rng() * (a + 1)); ids.add(`sub:${a}:${b}`); }
  }
  return [...ids];
}

/** @param {string} id @returns {Fact} */
export function getFact(id) {
  const [op, a, b] = id.split(':');
  const A = Number(a), B = Number(b);
  return { id, a: A, b: B, op: op === 'sub' ? '-' : '+', value: op === 'sub' ? A - B : A + B };
}

/** Base 1-digit facts — the enumerable core used to seed initial progress. */
function baseIds() {
  const ids = [];
  for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) ids.push(`add:${a}:${b}`);
  for (let a = 0; a <= 9; a++) for (let b = 0; b <= a; b++) ids.push(`sub:${a}:${b}`);
  return ids;
}

export const DECK_META = {
  appId: 'kids-math',
  title: 'DL Math — Add & Subtract',
  ids: baseIds(), // 1-digit core for initial progress; higher tiers add sampled ids at session time
};
