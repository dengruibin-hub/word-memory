const CACHE_NAME = 'word-memory-pwa-v1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './docx-import-fix.js',
  './voice-fix.js',
  './enhancements.js',
  './skip-fix.js',
  './listening-fix.js',
  './category-fix.js',
  './wrong-fix.js',
  './challenge-fix.js',
  './challenge-tab-fix.js',
  './manifest.json',
  './icon.svg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match('./index.html'))));
});
