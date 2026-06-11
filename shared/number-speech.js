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

import { playSequence, playClipBuffered, clipsSupported } from './clips.js';
import { speak } from './audio.js';

// ── WHOLE-NUMBER CLIP SEAM (the fix for the 3-digit inter-clip delay) ────────────────────────────
// PRIMARY path: when a SINGLE continuous clip exists for a whole number, play just that one file —
// e.g. clips/numbers/123.mp3 spoken naturally as "one hundred twenty-three". One file = zero
// inter-part gaps (the building-block sequence below stitches "one"+"hundred"+"twenty"+"three", and
// the hand-offs between parts are what Randy hears as a delay on 3-digit numbers).
//
// DROP-IN CONTRACT (for the voice lane generating these clips):
//   • file path: apps/shared/clips/numbers/<value>.mp3  (the bare integer, e.g. 0.mp3, 7.mp3, 123.mp3)
//   • each = the whole number spoken as ONE continuous, naturally-intonated utterance
//   • register availability below + bump each app's sw.js CACHE (so installed PWAs fetch them)
// Until clips land, `enabled` stays false → speakNumber falls back to the gapless building-block
// sequence, then TTS (exactly today's behavior — nothing blocks on the clips).
export const WHOLE_NUMBER_CLIPS = {
  enabled: false,   // master switch — flip true once the continuous clips are bundled + sw-cache-bumped
  max: 0,           // when enabled (and `only` is null): whole numbers 0..max each have a single clip
  only: null,       // optional explicit availability — an array or Set of values; overrides `max`
};

/** True when a single continuous clip exists for whole number n (per WHOLE_NUMBER_CLIPS). */
export function hasWholeClip(n) {
  const w = WHOLE_NUMBER_CLIPS;
  if (!w.enabled || !Number.isInteger(n) || n < 0) return false;
  if (w.only != null) return Array.isArray(w.only) ? w.only.includes(n) : (w.only instanceof Set ? w.only.has(n) : false);
  return n <= w.max;
}

/** Clip NAME for a whole-number file: 123 → 'numbers/123' → clips/numbers/123.mp3 (see clipUrl). */
export const wholeClipName = (n) => `numbers/${n}`;

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
 *
 * PLAYBACK ORDER (best → fallback):
 *   1. SINGLE continuous whole-number clip (clips/numbers/<n>.mp3) when available — ONE file, zero
 *      inter-part gap, preloaded before play so the opening isn't clipped. This removes the 3-digit
 *      delay. Active only when WHOLE_NUMBER_CLIPS is enabled for n (until then, step 2).
 *   2. GAPLESS building-block sequence (PRELOADED parts chained on `ended`, gapMs 0) — "thirty-one",
 *      "two hundred fifty" as one phrase. The fallback while whole-number clips are still being made.
 *   3. Runtime speechSynthesis (last resort) if clips are unsupported/out-of-range/fail to play.
 * A new prompt cancels any in-flight clip/sequence (latest wins) via the clip player's generation guard.
 * @param {number} value
 * @param {{gapMs?:number}} [opts]
 * @returns {Promise<void>}
 */
export async function speakNumber(value, opts = {}) {
  const n = Math.trunc(Number(value));
  // 1) one continuous whole-number clip — no inter-part gap, preloaded (no clipped start)
  if (clipsSupported() && Number.isFinite(n) && hasWholeClip(n)) {
    if (await playClipBuffered(wholeClipName(n))) return;
    // missing/failed single clip → fall through to the building-block sequence
  }
  // 2) gapless building-block sequence
  const names = numberToClips(value);
  if (names.length === 0 || !clipsSupported()) { speak(String(value)); return; }
  const ok = await playSequence(names, { gapMs: typeof opts.gapMs === 'number' ? opts.gapMs : 0 });
  if (!ok) speak(String(value));   // 3) a clip failed to load/play → last-resort TTS
}
