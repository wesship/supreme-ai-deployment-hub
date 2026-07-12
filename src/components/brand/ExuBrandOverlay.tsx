import { useEffect, useState } from 'react';

const HOME_PATHS = new Set(['/', '/home']);

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
      aria-label="EXU, the winged intelligence guardian of D3VONN.IO"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 sm:bottom-6"
    >
      <div className="mx-auto flex items-center justify-between gap-4 rounded-2xl border border-blue-200/20 bg-[#020817]/85 px-4 py-3 shadow-[0_0_42px_rgba(37,126,255,0.28)] backdrop-blur-xl sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-blue-300">EXU</p>
          <p className="truncate text-xs font-semibold text-blue-50/72 sm:text-sm">Winged Intelligence Guardian</p>
        </div>
        <div className="h-8 w-px bg-gradient-to-b from-transparent via-blue-200/30 to-transparent" />
        <p className="text-right text-xs font-black tracking-[0.08em] text-white sm:text-sm">
          One Platform. <span className="text-blue-300">Infinite Intelligence.</span>
        </p>
      </div>
    </aside>
  );
};

export default ExuBrandOverlay;
