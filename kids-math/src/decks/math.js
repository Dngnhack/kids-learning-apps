// decks/math.js — early-arithmetic deck (App: Kids Math). Data-only. Each "fact" (e.g. 2+3,
// 5-2) is an SRS item, so the shared adaptive engine tracks each fact individually.
// Structured so multiplication can be added later (just add an op + generator). Clean-room.

/** @typedef {{ id: string, a: number, b: number, op: '+'|'-', value: number }} Fact */

/** Build all add/subtract facts whose operands + result fit within `max` (no negatives). */
export function buildFacts(max) {
  /** @type {Fact[]} */ const facts = [];
  for (let a = 0; a <= max; a++) for (let b = 0; b <= max; b++) if (a + b <= max) facts.push({ id: `add:${a}:${b}`, a, b, op: '+', value: a + b });
  for (let a = 0; a <= max; a++) for (let b = 0; b <= a; b++) facts.push({ id: `sub:${a}:${b}`, a, b, op: '-', value: a - b });
  return facts;
}

/** Selectable difficulty = the largest sum/result allowed. */
export const RANGES = [
  { id: 's5', label: 'To 5', max: 5 },
  { id: 's10', label: 'To 10', max: 10 },
  { id: 's15', label: 'To 15', max: 15 },
  { id: 's20', label: 'To 20', max: 20 },
];

export function idsForRange(max) { return buildFacts(max).map((f) => f.id); }

/** @param {string} id @returns {Fact} */
export function getFact(id) {
  const [op, a, b] = id.split(':');
  const A = Number(a), B = Number(b);
  return { id, a: A, b: B, op: op === 'sub' ? '-' : '+', value: op === 'sub' ? A - B : A + B };
}

export const DECK_META = {
  appId: 'kids-math',
  title: 'DL Math — Add & Subtract',
  ids: buildFacts(20).map((f) => f.id), // superset (to 20); a session uses the active range
};
