// clips.js — SHARED bundled-audio CLIP PLAYER (PRIMARY voice path for the kids apps).
//
// WHY: mobile-browser speechSynthesis is unreliable (kids hear silence). We ship small pre-generated
// .mp3 clips (built offline at build time — see scripts/audio-clips/gen-clips.mjs) and play them here
// with HTML5 Audio. This is the PRIMARY voice path; runtime speechSynthesis (audio.js speak) is now a
// LAST-RESORT fallback only. Reward tones/cheers stay on the separate WebAudio path (audio.js).
//
// Clips live at apps/shared/clips/<name>.mp3 and are addressed by NAME (no extension):
//   numbers blocks: zero one … twenty thirty … ninety hundred thousand
//   letter names:   letter-a … letter-z
// A SINGLE in-flight Audio element + a generation guard give clean no-overlap: a new play()
// (or stop) supersedes any in-flight / queued clip — latest wins, nothing plays over the next.

import { isEnabled, unlockAudio, speak } from './audio.js';

// Resolve the clips dir RELATIVE TO THIS MODULE so every app (kids-numbers, kids-letters, …) finds
// the same shared clips regardless of its own page URL. import.meta.url points at apps/shared/clips.js.
const CLIPS_BASE = (() => {
  try { return new URL('./clips/', import.meta.url).href; }
  catch (_e) { return './clips/'; }
})();

/** Build the absolute URL for a clip NAME (no extension). */
export function clipUrl(name) { return `${CLIPS_BASE}${name}.mp3`; }

// ── single-clip / sequence player with a generation guard (no-overlap) ─────────────
let _gen = 0;                       // bumped by every stop()/new play — invalidates in-flight work
/** @type {HTMLAudioElement|null} */ let _cur = null;

/** Stop any in-flight or queued clip immediately. Call on transitions / quit. */
export function stopClips() {
  _gen++;
  if (_cur) {
    try { _cur.pause(); _cur.currentTime = 0; } catch (_e) { /* ignore */ }
    _cur.onended = null; _cur.onerror = null;
    _cur = null;
  }
}

/** Are bundled clips usable in this environment? (HTML5 Audio present.) */
export function clipsSupported() { return typeof Audio !== 'undefined'; }

/**
 * Play ONE clip by name. Resolves true if it finished (or was cleanly superseded), false on
 * load/codec/autoplay error so a caller can fall back. No-op (resolves false) when muted/unsupported.
 * @param {string} name e.g. 'seven' or 'letter-a'
 * @param {{onError?:Function}} [opts]
 * @returns {Promise<boolean>}
 */
export function playClip(name, opts = {}) {
  if (!isEnabled() || !clipsSupported()) return Promise.resolve(false);
  stopClips();                               // clean interrupt — never two clips at once
  const myGen = _gen;
  try { unlockAudio(); } catch (_e) { /* ignore */ }   // ensure the gesture-unlock has run
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return; done = true;
      if (el) { el.onended = null; el.onerror = null; }
      if (myGen === _gen && _cur === el) _cur = null;
      resolve(ok);
    };
    const el = new Audio(clipUrl(name));
    _cur = el;
    el.onended = () => finish(true);
    el.onerror = () => { if (typeof opts.onError === 'function') { try { opts.onError(name); } catch (_e) { /* ignore */ } } finish(false); };
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => { if (typeof opts.onError === 'function') { try { opts.onError(name); } catch (_e) { /* ignore */ } } finish(false); });
    }
  });
}

/**
 * Play a SEQUENCE of clips in order with no overlap, as ONE smooth utterance. A later play/stop
 * supersedes the whole sequence (latest wins). If a clip in the sequence errors, opts.onError(name)
 * fires and the sequence stops (the caller's fallback decides what to do).
 *
 * GAPLESS (Fix 1 — see MI-013): every part's Audio element is CONSTRUCTED + `.load()`ed UP FRONT,
 * before the first part plays, so there is no per-part load latency mid-utterance. Parts are then
 * chained strictly on `ended` (no setTimeout between them by default), so a multi-part number like
 * "thirty-one" plays back-to-back as one phrase instead of "thirty……one". gapMs defaults to 0
 * (contiguous); a caller may pass a small gap if it ever wants breathing room.
 * @param {string[]} names ordered clip names, e.g. ['twenty','three']
 * @param {{gapMs?:number, onError?:Function}} [opts]
 * @returns {Promise<boolean>} true when the whole sequence played (or was cleanly superseded)
 */
export function playSequence(names, opts = {}) {
  if (!isEnabled() || !clipsSupported()) return Promise.resolve(false);
  const list = Array.isArray(names) ? names.filter(Boolean) : [];
  if (list.length === 0) return Promise.resolve(true);
  const gap = typeof opts.gapMs === 'number' ? opts.gapMs : 0;   // 0 = contiguous, one smooth utterance
  stopClips();                               // own the timeline: bump _gen once for the whole run
  const seqGen = _gen;
  try { unlockAudio(); } catch (_e) { /* ignore */ }

  // PRELOAD: build + kick a load() for EVERY part now, so by the time part N's turn comes its audio
  // is already buffered (no mid-utterance load latency — the cause of the "thirty……one" gap).
  const preloaded = list.map((name) => {
    const el = new Audio(clipUrl(name));
    try { el.preload = 'auto'; } catch (_e) { /* some envs lack the setter */ }
    try { if (typeof el.load === 'function') el.load(); } catch (_e) { /* ignore */ }
    return el;
  });

  return new Promise((resolve) => {
    let i = 0;
    const step = () => {
      if (seqGen !== _gen) return resolve(true);   // superseded by a newer play/stop — done quietly
      if (i >= list.length) return resolve(true);
      const name = list[i];
      const el = preloaded[i];
      i++;
      // play this preloaded element WITHOUT bumping _gen again (we own seqGen for the whole sequence)
      _playOneInSequence(el, seqGen).then((ok) => {
        if (seqGen !== _gen) return resolve(true);  // a transition happened mid-clip
        if (!ok) { if (typeof opts.onError === 'function') { try { opts.onError(name); } catch (_e) { /* ignore */ } } return resolve(false); }
        if (i >= list.length) return resolve(true);
        // chain on `ended` → next part fires immediately (gap 0) so the number is one phrase.
        if (gap > 0) setTimeout(step, gap); else step();
      });
    };
    step();
  });
}

// ── celebratory CHEER clips ─────────────────────────────────────────────────────────
// ORIGINAL warm praise phrases (our own SAPI voice — CIPP-clean, no third-party IP), shipped as
// apps/shared/clips/cheers/cheer-01.mp3 … cheer-NN.mp3 (see scripts/audio-clips/gen-clips.mjs).
// CHEER_COUNT must match the number generated. ONE cheer per celebration, picked at random; it rides
// alongside the SYNTHESIZED WebAudio reward chime (audio.tone/cheer/fireworks) which stays as-is.
const CHEER_COUNT = 12;
const cheerName = (i) => `cheers/cheer-${String(i).padStart(2, '0')}`;

/**
 * Play ONE random celebratory cheer clip. Uses the shared single-clip player, so it inherits the
 * first-tap unlock + no-overlap guard (a later clip/voice supersedes it — latest wins). Resolves
 * true if it played/finished, false if muted/unsupported or the clip failed (caller just skips —
 * the WebAudio chime still celebrates on its own). One cheer only; never stacked.
 * @param {Function} [rng] random source (injectable for tests)
 * @returns {Promise<boolean>}
 */
export function playCheer(rng = Math.random) {
  if (!isEnabled() || !clipsSupported()) return Promise.resolve(false);
  const i = 1 + Math.floor(rng() * CHEER_COUNT);
  return playClip(cheerName(i));
}

/**
 * Speak a LETTER NAME via its bundled clip (PRIMARY), e.g. 'a' → letter-a.mp3 ("ay").
 * Falls back to runtime speechSynthesis (the uppercase letter) only if clips are unsupported or the
 * clip fails to load/play (LAST RESORT). a..z only; anything else goes straight to TTS.
 * @param {string} letter single letter, case-insensitive
 * @returns {Promise<void>}
 */
export async function speakLetterName(letter) {
  const l = String(letter || '').toLowerCase();
  if (!/^[a-z]$/.test(l) || !clipsSupported()) { speak(String(letter).toUpperCase()); return; }
  const ok = await playClip(`letter-${l}`);
  if (!ok) speak(String(letter).toUpperCase());   // clip missing/failed → last-resort TTS
}

/** Internal: play one ALREADY-PRELOADED clip element as part of a sequence, honoring the sequence's
 *  generation token. The element was constructed + load()ed up front by playSequence (gapless), so
 *  here we only wire its handlers and play() it — no construction/load latency at this point. */
function _playOneInSequence(el, seqGen) {
  return new Promise((resolve) => {
    if (seqGen !== _gen) return resolve(false);
    let done = false;
    const finish = (ok) => {
      if (done) return; done = true;
      if (el) { el.onended = null; el.onerror = null; }
      if (seqGen === _gen && _cur === el) _cur = null;
      resolve(ok);
    };
    _cur = el;
    el.onended = () => finish(true);
    el.onerror = () => finish(false);
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => finish(false));
  });
}
