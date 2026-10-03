const CACHE_VERSION = 'guardian-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('guardian-') && key !== CACHE_VERSION)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

// Intentionally no fetch handler.
// Guardian never caches authenticated pages, API responses, incident data,
// credentials, evidence, or tenant information in the service worker.
