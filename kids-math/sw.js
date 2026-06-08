// sw.js — offline cache of the LOCAL app shell + the shared engine. No remote fetches, no tracking.
const CACHE = 'dl-kids-math-v4';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './assets/icon.svg',
  './src/main.js', './src/game.js', './src/ui.js', './src/decks/math.js',
  '../shared/base.css', '../shared/srs.js', '../shared/audio.js', '../shared/storage.js',
  '../shared/parentGate.js', '../shared/ui-core.js', '../shared/rewards.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).catch(() => caches.match('./index.html'))));
});
