// Service worker: makes Forma load fast and open without internet.
// The build (vite.config.ts) fills in the list of app files and a version,
// so every deploy installs a fresh cache and removes the old one.
// - app files: saved on install, then always served from the cache
// - pages: from the network, the saved app shell when offline
// - exercise images: cached the first time they are shown
// - /api requests: never cached (your data must be up to date)

const VERSION = '__VERSION__'
const PRECACHE = self.__PRECACHE__ || []
const CACHE = `forma-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/', ...PRECACHE])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return

  // pages: network first (and remember the newest app shell), cached shell when offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) caches.open(CACHE).then((cache) => cache.put('/', response.clone()))
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // files: from the cache if we have them, else from the network (and keep a copy)
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          const type = response.headers.get('content-type') || ''
          // never store an HTML error page under a script or image URL
          if (response.ok && !type.includes('text/html')) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          }
          return response
        }),
    ),
  )
})
