// audio.js — SHARED speech + synthesized tones/cheers using built-in browser APIs only.
// Web Speech API (speechSynthesis) + WebAudio. Fully OFFLINE on-device, transmits NO data.
// All celebratory sound is SYNTHESIZED — no external/copyrighted audio files. Used by all apps.

let enabled = true;
/** @type {AudioContext|null} */
let ac = null;

export function setEnabled(on) { enabled = !!on; }
export function isEnabled() { return enabled; }

function ctx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_e) { ac = null; } }
  // The context is often created/left SUSPENDED until a user gesture (autoplay policy). Opportunistically
  // resume on every access so reward tones aren't silently dropped once a gesture has occurred.
  if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (_e) { /* ignore */ } }
  return ac;
}

// Warm-voice selection (Path A): pick the warmest available BUILT-IN OS voice for a gentle
// preschool-teacher STYLE. We emulate the style only — NEVER a real person's voice/likeness or a
// clone (generic OS voices only). The voice list loads async, so we (re)pick on voiceschanged.
let preferredVoice = null;
const VOICE_PREFS = [/Samantha/i, /Aria/i, /Jenny/i, /\bAva\b/i, /Allison/i, /\bNatural\b/i, /Google US English/i, /Microsoft (Zira|Aria|Jenny)/i, /female/i];
function pickVoice() {
  try {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices() || [];
    const en = voices.filter((v) => /^en/i.test(v.lang));
    for (const re of VOICE_PREFS) { const m = en.find((v) => re.test(v.name)); if (m) { preferredVoice = m; return; } }
    preferredVoice = en[0] || voices[0] || null;
  } catch (_e) { /* ignore */ }
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice();
  try { window.speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (_e) { /* ignore */ }
}

// ── Speech serialization (fixes overlap/cutoff during transitions) ──────────────
// A single-utterance queue: each clip finishes (onend) before the next starts, so prompts
// never overlap. A new prompt by default INTERRUPTS cleanly (cancel current, clear queue,
// then speak the latest) — no two voices at once. Pass opts.queue=true to chain instead.
//
// REGRESSION FIX: the v4 ordering bumped a generation token in stopSpeech() and then re-checked
// it inside a deferred speak(). The token was captured in _drain() AFTER the bump, which by itself
// is fine — but the deferred speak raced the still-settling async speechSynthesis.cancel() and the
// 40ms timer dropped the LONE/most-recent clip (silence instead of the intended no-overlap). The fix:
//   • capture the generation token at SCHEDULE time so a clip is NEVER invalidated by ITS OWN cancel,
//     only by a *later* stopSpeech()/interrupt (latest wins; the lone clip always plays);
//   • cancel → settle → speak ordering with a reliable settle, and re-check the token only against a
//     SUBSEQUENT interrupt. This keeps no-overlap on rapid transitions without swallowing the latest.
let _q = [];
let _speaking = false;
let _gen = 0;            // bumped by every stopSpeech()/interrupt
let _scheduledGen = -1;  // the _gen value owned by the currently scheduled/in-flight deferred speak
const SETTLE_MS = 60;    // let a prior cancel() settle (Chrome quirk) before the real speak()
function _drain() {
  if (_speaking || !_q.length || !('speechSynthesis' in window)) return;
  const u = _q.shift();
  _speaking = true;
  // Own the CURRENT generation. A later stopSpeech()/speak() bumps _gen past this and supersedes us;
  // nothing that happened BEFORE scheduling (incl. the cancel that cleared the way for this clip) can
  // invalidate it — so the lone / most-recent utterance is never dropped.
  const myGen = _gen;
  _scheduledGen = myGen;
  const done = () => { if (myGen !== _gen) return; _speaking = false; _scheduledGen = -1; _drain(); };
  u.onend = done; u.onerror = done;
  setTimeout(() => {
    if (myGen !== _gen) return;                 // a NEWER interrupt happened → drop this now-stale clip
    try { window.speechSynthesis.speak(u); } catch (_e) { done(); }
  }, SETTLE_MS);
}

/** Stop any current/queued speech immediately (call on transitions to prevent overlap). */
export function stopSpeech() {
  _gen++;                                        // invalidate any in-flight/scheduled deferred speak()
  _scheduledGen = -1;
  _q = [];
  try { window.speechSynthesis.cancel(); } catch (_e) { /* ignore */ }
  _speaking = false;
}

/**
 * Speak a short word/number/equation in a warm, slow, child-friendly voice (preschool-teacher
 * cadence). No-op if unsupported/muted. opts.rate / opts.pitch override the gentle defaults.
 * Default = interrupt (no overlap); opts.queue=true chains after the current clip.
 */
export function speak(text, opts = {}) {
  if (!enabled) return;
  try {
    // Graceful fallback: if TTS is entirely unavailable (some mobile browsers), bail quietly — reward
    // tones (tone/cheer/fireworks) live on a separate WebAudio path and still play without any voice.
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    if (!preferredVoice) pickVoice();            // voices load async; re-attempt the pick each time
    if (opts.queue !== true) stopSpeech();       // clean interrupt: no two clips at once
    const u = new SpeechSynthesisUtterance(String(text));
    u.rate = typeof opts.rate === 'number' ? opts.rate : 0.78;   // slower = clearer, gentler
    u.pitch = typeof opts.pitch === 'number' ? opts.pitch : 1.15; // warm, child-friendly
    u.volume = 1; u.lang = 'en-US';
    if (preferredVoice) u.voice = preferredVoice; // else: let the engine use its default voice (no drop)
    _q.push(u);
    _drain();
  } catch (_e) { /* ignore */ }
}

// ── First-gesture audio unlock (self-installing, idempotent) ────────────────────
// AudioContext starts SUSPENDED and speechSynthesis needs a user gesture to unlock (autoplay policy);
// without this, BOTH tones and voice are silent on mobile / GitHub Pages until something unlocks them.
// We self-install one-time guarded listeners here so NO other file (main.js, etc.) needs editing.
let _unlocked = false;
function _unlockAudio() {
  if (_unlocked) return;
  _unlocked = true;
  try {                                          // resume the WebAudio context (creates it if needed)
    const a = ctx();
    if (a && a.state === 'suspended') a.resume();
  } catch (_e) { /* ignore */ }
  try {                                          // prime speechSynthesis with a near-silent short clip
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
      const warm = new SpeechSynthesisUtterance(' ');
      warm.volume = 0; warm.rate = 2;
      window.speechSynthesis.speak(warm);
      pickVoice();                               // a gesture often coincides with voices being ready
    }
  } catch (_e) { /* ignore */ }
}
/** Manually unlock audio (resume AudioContext + prime TTS). Idempotent. Also exposed for tests. */
export function unlockAudio() { _unlockAudio(); }
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  const events = ['pointerdown', 'touchstart', 'mousedown', 'click', 'keydown'];
  const onFirstGesture = () => {
    _unlockAudio();
    for (const ev of events) { try { window.removeEventListener(ev, onFirstGesture, true); } catch (_e) { /* ignore */ } }
  };
  for (const ev of events) { try { window.addEventListener(ev, onFirstGesture, true); } catch (_e) { /* ignore */ } }
}

function note(a, freq, start, dur, gain = 0.18) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.connect(g); g.connect(a.destination);
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.start(start); o.stop(start + dur + 0.02);
}

export function tone(kind) {
  if (!enabled) return;
  const a = ctx(); if (!a) return;
  const now = a.currentTime;
  if (kind === 'good') { note(a, 660, now, 0.14); note(a, 880, now + 0.12, 0.18); }
  else { note(a, 300, now, 0.28, 0.12); }
}

/** A short, happy ascending cheer melody (synthesized). */
export function cheer() {
  if (!enabled) return;
  const a = ctx(); if (!a) return;
  const now = a.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(a, f, now + i * 0.1, 0.16, 0.16));
}

// Warm, encouraging praise (generic preschool-teacher style — not modeled on any real person).
const CHEERS = ['Great job!', 'You did it!', 'Wonderful!', 'Yay, well done!', 'Nice work, friend!', 'Hooray, you got it!', "I'm so proud of you!"];
export function encourage(rng = Math.random) {
  if (!enabled) return;
  // a touch slower + higher = gentle, sing-song, enthusiastic delivery
  speak(CHEERS[Math.floor(rng() * CHEERS.length)], { rate: 0.72, pitch: 1.25 });
}

/** A short, synthesized noise "pop" (a firework burst). No audio files. */
function pop(a, t) {
  const dur = 0.18;
  const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2); // decaying noise
  const src = a.createBufferSource(); src.buffer = buf;
  const g = a.createGain();
  g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(g); g.connect(a.destination); src.start(t); src.stop(t + dur);
}

/** Bigger celebratory firework: a rising whistle, a few pops, then a sparkle. All synthesized. */
export function fireworks() {
  if (!enabled) return;
  const a = ctx(); if (!a) return;
  const now = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.connect(g); g.connect(a.destination);
  o.frequency.setValueAtTime(420, now); o.frequency.exponentialRampToValueAtTime(1180, now + 0.26);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.12, now + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  o.start(now); o.stop(now + 0.32);
  for (let i = 0; i < 3; i++) pop(a, now + 0.28 + i * 0.13);
  [880, 1174.7, 1568].forEach((f, i) => note(a, f, now + 0.42 + i * 0.07, 0.12, 0.1));
}
