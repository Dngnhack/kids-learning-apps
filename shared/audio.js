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
  return ac;
}

/** Speak a short word/number/equation, e.g. "five" or "two plus three". No-op if unsupported/muted. */
export function speak(text) {
  if (!enabled) return;
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(String(text));
    u.rate = 0.9; u.pitch = 1.15; u.lang = 'en-US';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (_e) { /* ignore */ }
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

const CHEERS = ['Great job!', 'You did it!', 'Awesome!', 'Nice work!', 'Yay!'];
export function encourage(rng = Math.random) {
  if (!enabled) return;
  speak(CHEERS[Math.floor(rng() * CHEERS.length)]);
}
