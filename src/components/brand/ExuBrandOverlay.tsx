import { useEffect, useState } from 'react';

const HOME_PATHS = new Set(['/', '/home']);
const EXU_LOGO_SRC = '/exu-logo.svg?v=20260712';

const ExuBrandOverlay = () => {
  const [isHome, setIsHome] = useState(() => HOME_PATHS.has(window.location.pathname));

  useEffect(() => {
    const syncPath = () => setIsHome(HOME_PATHS.has(window.location.pathname));
    window.addEventListener('popstate', syncPath);
    window.addEventListener('hashchange', syncPath);

    const observer = new MutationObserver(syncPath);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('popstate', syncPath);
      window.removeEventListener('hashchange', syncPath);
      observer.disconnect();
    };
  }, []);

  if (!isHome) return null;

  return (
    <aside
      aria-label="EXU, the Hermes-linked winged intelligence guardian of D3VONN.IO"
      className="pointer-events-none fixed bottom-3 left-1/2 z-[70] w-[calc(100%-1rem)] max-w-3xl -translate-x-1/2 sm:bottom-5 sm:w-[calc(100%-2rem)]"
    >
      <div className="overflow-hidden rounded-2xl border border-blue-200/20 bg-[#020817]/92 p-1.5 shadow-[0_0_42px_rgba(37,126,255,0.34)] backdrop-blur-xl sm:p-2">
        <img
          src={EXU_LOGO_SRC}
          alt="EXU — Hermes Linked"
          className="exu-brand-logo max-h-28 sm:max-h-36"
          loading="eager"
          decoding="async"
          draggable={false}
        />
      </div>
    </aside>
  );
};

export default ExuBrandOverlay;
