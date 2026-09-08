const CACHE_NAME = 'series-tracker-v1';
const ASSETS = [ './', './index.html', './style.css', './app.js', './manifest.json' ];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('tvmaze.com')) return;
  event.respondWith(caches.match(event.request).then(res => res || fetch(event.request)));
});
