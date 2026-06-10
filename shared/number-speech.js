// number-speech.js — SHARED number→clip-sequence COMPOSER + player.
//
// Maps ANY whole number (0..999,999) to an ORDERED sequence of bundled building-block clip names,
// then plays them in order with small gaps (no overlap) via the shared clip player. This is how the
// numbers app says e.g. 23, 250, or 1000 WITHOUT shipping a clip per number — just ~30 blocks.
//
//   numberToClips(23)   -> ['twenty','three']
//   numberToClips(250)  -> ['two','hundred','fifty']
//   numberToClips(1000) -> ['one','thousand']
//   numberToClips(0)    -> ['zero']
//   numberToClips(7)    -> ['seven']
//
// The composer is PURE (testable without audio). speakNumber() wires it to the clip player and
// falls back to runtime speechSynthesis (audio.js) ONLY if a clip can't play (last resort).

import { playSequence, clipsSupported } from './clips.js';
import { speak } from './audio.js';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 0..99 → clip-name sequence. */
function under100(n) {
  if (n < 20) return [ONES[n]];
  const t = Math.floor(n / 10), o = n % 10;
  return o === 0 ? [TENS[t]] : [TENS[t], ONES[o]];
}

/** 0..999 → clip-name sequence (e.g. 250 → two,hundred,fifty). */
function under1000(n) {
  if (n < 100) return under100(n);
  const h = Math.floor(n / 100), rest = n % 100;
  const seq = [ONES[h], 'hundred'];
  if (rest > 0) seq.push(...under100(rest));
  return seq;
}

/**
 * Map a whole number to an ordered building-block clip sequence.
 * Supports 0..999,999 (covers the apps' ranges with margin). Negative/non-finite/out-of-range
 * inputs return [] so the caller falls back to TTS rather than playing a wrong sequence.
 * @param {number} value
 * @returns {string[]} clip names, e.g. ['two','hundred','fifty']
 */
export function numberToClips(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return [];
  const n = Math.trunc(value);
  if (n < 0 || n > 999999) return [];
  if (n < 1000) return under1000(n);
  const thousands = Math.floor(n / 1000), rest = n % 1000;
  const seq = [...under1000(thousands), 'thousand'];
  if (rest > 0) seq.push(...under1000(rest));
  return seq;
}

/**
 * Speak a number via bundled clips (PRIMARY). Falls back to runtime speechSynthesis (audio.js)
 * only if clips are unsupported, the value is out of range, or a clip fails to play (LAST RESORT).
 * @param {number} value
 * @param {{gapMs?:number}} [opts]
 * @returns {Promise<void>}
 */
export async function speakNumber(value, opts = {}) {
  const names = numberToClips(value);
  if (names.length === 0 || !clipsSupported()) { speak(String(value)); return; }
  const ok = await playSequence(names, { gapMs: typeof opts.gapMs === 'number' ? opts.gapMs : 120 });
  if (!ok) speak(String(value));   // a clip failed to load/play → last-resort TTS
}
