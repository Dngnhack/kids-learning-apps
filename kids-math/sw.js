// sw.js — offline cache of the LOCAL app shell + the shared engine. No remote fetches, no tracking.
const CACHE = 'dl-kids-math-v10';
// Bundled number building-block voice clips — Math now speaks numbers through the shared clip seam
// (number-speech.js), so it caches the same word clips as Numbers for offline playback.
const NUMBER_CLIPS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
  'eighty', 'ninety', 'hundred', 'thousand',
].map((n) => `../shared/clips/${n}.mp3`);
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './assets/icon.svg',
  './src/main.js', './src/game.js', './src/ui.js', './src/decks/math.js',
  '../shared/base.css', '../shared/srs.js', '../shared/audio.js', '../shared/storage.js',
  '../shared/parentGate.js', '../shared/ui-core.js', '../shared/rewards.js',
  '../shared/clips.js', '../shared/number-speech.js',
  ...NUMBER_CLIPS,
];
self.addEventListener('install', (e) => {
  // Resilient install: add each asset individually + tolerate failures so ONE bad fetch (e.g. an mp3)
  // can't block the whole update. Misses still work online via the fetch fallback below.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).catch(() => caches.match('./index.html'))));
});
