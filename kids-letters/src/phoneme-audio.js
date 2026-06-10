// phoneme-audio.js (Letters) — the AUDIO-SOURCE SEAM for the sound-based phonics stages.
//
// ── WHY THIS FILE EXISTS (the pending audio-source decision) ─────────────────────
// The phoneme AUDIO source is still being chosen (record clean originals vs. an interim
// text-to-speech fallback). The stage LOGIC + UX is built now behind THIS abstraction so that
// swapping in real recorded clips later is a drop-in: add the audio files + flip a manifest flag,
// with ZERO changes to game.js / ui.js / main.js. Comment kept deliberately doc-id-free (this
// runtime ships publicly later — no internal tracking codes in shippable files).
//
// ── HOW THE SWAP WORKS ───────────────────────────────────────────────────────────
//   playPhoneme(letter):
//     1. If a recorded clip is registered as PRESENT for that letter (see CLIP_MANIFEST below),
//        play the audio file from assets/phonemes/<letter>.<ext>.
//     2. Otherwise fall back to speechSynthesis speaking an approximate phoneme (INTERIM only).
//   playLetterName(letter) always uses speechSynthesis — letter NAMES ("ess", "ay") are accurate
//   via TTS, so they never need a recorded clip.
//
// To go live with real audio later: drop s.mp3, a.mp3 … into assets/phonemes/, set the matching
// CLIP_MANIFEST entry to `true` (or list the file), bump sw.js cache. No stage-logic edits.
//
// Reuses the same _gen stale-utterance guard idiom as shared/audio.js so a rapid stage transition
// can cancel an in-flight phoneme (TTS or clip) without overlap.

import * as audio from '../../shared/audio.js';

// ── CLIP MANIFEST (the seam's switchboard) ───────────────────────────────────────
// letter -> whether a recorded phoneme clip is available. ALL false today: no audio files are
// shipped (the interim source is TTS; the real-audio decision is pending). When clips are added,
// set the relevant letters to `true` (or to a filename string to override the default path).
// This is the SINGLE place that decides clip-vs-TTS — stages never know which source played.
export const CLIP_MANIFEST = {
  a: false, b: false, c: false, d: false, e: false, f: false, g: false, h: false, i: false,
  j: false, k: false, l: false, m: false, n: false, o: false, p: false, q: false, r: false,
  s: false, t: false, u: false, v: false, w: false, x: false, y: false, z: false,
};

// Candidate extensions tried (in order) when a clip is marked present but no explicit filename
// is given. mp3 is the most broadly-supported offline codec; ogg/wav are fallbacks.
const CLIP_EXTS = ['mp3', 'ogg', 'wav'];
const CLIP_DIR = './assets/phonemes/';

// Interim TTS phoneme approximations. speechSynthesis is UNRELIABLE for isolated phonemes (it tends
// to say letter NAMES or distort vowels), so these are an honest best-effort placeholder ONLY — the
// real fix is recorded clips via the manifest above. Short, lowercase, no schwa where avoidable.
const TTS_PHONEME = {
  a: 'ah', b: 'buh', c: 'kuh', d: 'duh', e: 'eh', f: 'fff', g: 'guh', h: 'huh', i: 'ih',
  j: 'juh', k: 'kuh', l: 'lll', m: 'mmm', n: 'nnn', o: 'oh', p: 'puh', q: 'kwuh', r: 'rrr',
  s: 'sss', t: 'tuh', u: 'uh', v: 'vvv', w: 'wuh', x: 'ks', y: 'yuh', z: 'zzz',
};

// stale-clip guard (mirrors shared/audio.js _gen): a transition bumps _gen so a queued/loading clip
// that resolves late is dropped instead of playing over the next screen.
let _gen = 0;
/** @type {HTMLAudioElement|null} */ let _cur = null;

/** Stop any in-flight phoneme clip AND any queued TTS. Call on stage transitions / quit. */
export function stopPhoneme() {
  _gen++;
  if (_cur) { try { _cur.pause(); _cur.currentTime = 0; } catch (_e) { /* ignore */ } _cur = null; }
  audio.stopSpeech();
}

/** Resolve the clip URL for a letter, honoring an explicit filename override in the manifest. */
function clipUrl(letter, ext) {
  const m = CLIP_MANIFEST[letter];
  if (typeof m === 'string' && m) return CLIP_DIR + m;     // explicit filename override
  return `${CLIP_DIR}${letter}.${ext}`;
}

/** True when a recorded clip is registered for this letter (the manifest is the source of truth). */
export function hasClip(letter) {
  const m = CLIP_MANIFEST[String(letter).toLowerCase()];
  return m === true || (typeof m === 'string' && m.length > 0);
}

/**
 * Play the PHONEME (sound) for a letter — the heart of the seam.
 *   • clip present  → play assets/phonemes/<letter>.<ext> (tries CLIP_EXTS until one loads)
 *   • else (interim)→ speechSynthesis speaks the TTS approximation (flagged-quality placeholder)
 * No-op when audio is muted. Respects the _gen stale guard so a transition cancels a late clip.
 * @param {string} letter lowercase letter, e.g. 's'
 */
export function playPhoneme(letter) {
  const l = String(letter).toLowerCase();
  if (!audio.isEnabled()) return;
  stopPhoneme();                                   // clean interrupt: never two sounds at once
  const myGen = _gen;

  if (hasClip(l) && typeof Audio !== 'undefined') {
    // try each candidate extension in order; the first that can play wins. If none load, fall
    // back to TTS so the stage still has SOME audio (never silent).
    const exts = typeof CLIP_MANIFEST[l] === 'string' ? [null] : CLIP_EXTS;
    let i = 0;
    const tryNext = () => {
      if (myGen !== _gen) return;                  // superseded by a transition — drop it
      if (i >= exts.length) { _cur = null; speakTtsPhoneme(l, myGen); return; }
      const url = clipUrl(l, exts[i++]);
      const el = new Audio(url);
      _cur = el;
      el.addEventListener('error', tryNext, { once: true });
      el.play().catch(tryNext);                    // autoplay/codec failure → next candidate
    };
    tryNext();
    return;
  }
  speakTtsPhoneme(l, myGen);
}

/** INTERIM fallback: speak the TTS phoneme approximation (guarded by _gen). */
function speakTtsPhoneme(letter, myGen) {
  if (myGen !== _gen) return;
  const sound = TTS_PHONEME[letter] || letter;
  // a touch slower + level pitch makes the short sound clearer than the warm sing-song default
  audio.speak(sound, { rate: 0.7, pitch: 1.0 });
}

/** Speak the LETTER NAME ("ess", "ay") — always TTS (accurate; no clip ever needed). */
export function playLetterName(letter) {
  audio.speak(String(letter).toUpperCase());
}
