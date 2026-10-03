(() => {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/guardian-service-worker.js', { scope: '/' })
      .catch((error) => console.error('[Guardian] service worker registration failed:', error));
  });

  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (standalone) {
    document.documentElement.dataset.guardianApp = 'standalone';
  }
})();
