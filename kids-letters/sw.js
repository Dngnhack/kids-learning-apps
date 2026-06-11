// sw.js — offline cache of the LOCAL app shell + the shared engine. No remote fetches, no tracking.
const CACHE = 'dl-kids-letters-v7';
// Bundled letter-NAME voice clips (offline, played as static files — primary voice path).
const LETTER_CLIPS = 'abcdefghijklmnopqrstuvwxyz'.split('').map((l) => `../shared/clips/letter-${l}.mp3`);
// Original celebratory cheer clips (offline; ride alongside the synthesized chime).
const CHEER_CLIPS = Array.from({ length: 12 }, (_, i) => `../shared/clips/cheers/cheer-${String(i + 1).padStart(2, '0')}.mp3`);
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './assets/icon.svg',
  './src/main.js', './src/game.js', './src/ui.js', './src/trace.js', './src/decks/letters.js',
  './src/phoneme-audio.js',
  '../shared/base.css', '../shared/srs.js', '../shared/audio.js', '../shared/storage.js',
  '../shared/parentGate.js', '../shared/ui-core.js', '../shared/rewards.js',
  '../shared/clips.js',
  ...LETTER_CLIPS, ...CHEER_CLIPS,
];

self.addEventListener('install', (e) => {
  // Resilient install: add each asset individually + tolerate failures so ONE bad fetch (e.g. an
  // mp3) can't block the whole update and strand the user on an old cache. Misses still work online
  // via the fetch fallback below.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).catch(() => caches.match('./index.html'))));
});
