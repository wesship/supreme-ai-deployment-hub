(() => {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

  let deferredPrompt = null;

  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (standalone) document.documentElement.dataset.guardianApp = 'standalone';

  const removeInstallButton = () => {
    document.getElementById('guardian-install-app')?.remove();
  };

  const addInstallButton = () => {
    if (!window.location.pathname.startsWith('/guardian') || standalone || document.getElementById('guardian-install-app')) return;

    const button = document.createElement('button');
    button.id = 'guardian-install-app';
    button.type = 'button';
    button.textContent = 'Install Guardian App';
    button.setAttribute('aria-label', 'Install D3VONN Security Guardian on this phone');
    Object.assign(button.style, {
      position: 'fixed',
      right: '16px',
      bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      zIndex: '9999',
      minHeight: '48px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,.18)',
      padding: '0 18px',
      background: '#10b981',
      color: '#04110d',
      font: '600 14px Inter, system-ui, sans-serif',
      boxShadow: '0 14px 40px rgba(0,0,0,.35)',
    });

    button.addEventListener('click', async () => {
      if (deferredPrompt) {
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(() => null);
        deferredPrompt = null;
        removeInstallButton();
        return;
      }

      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        window.alert('To install Guardian on iPhone: tap the Share button in Safari, choose “Add to Home Screen,” then tap “Add.”');
        return;
      }

      window.alert('Open this page in your phone browser menu and choose “Install app” or “Add to Home screen.”');
    });

    document.body.appendChild(button);
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    addInstallButton();
  });

  window.addEventListener('appinstalled', removeInstallButton);

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/guardian-service-worker.js', { scope: '/' })
      .catch((error) => console.error('[Guardian] service worker registration failed:', error));

    addInstallButton();
  });
})();
