import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export const OFFICIAL_LOGO_SRC = '/d3vonn-main-logo.svg?v=20260726-main';
export const OFFICIAL_LOGO_FALLBACK_SRC = '/d3vonn-logo.webp?v=20260726-main';

const Logo: React.FC = () => {
  const [logoSrc, setLogoSrc] = useState(OFFICIAL_LOGO_SRC);
  const [showWordmarkFallback, setShowWordmarkFallback] = useState(false);

  return (
    <Link
      to="/"
      className="group relative flex min-h-14 shrink-0 items-center overflow-visible rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      aria-label="D3VONN.IO home"
    >
      <span className="pointer-events-none absolute -inset-3 rounded-2xl bg-blue-500/10 opacity-0 blur-xl transition duration-500 group-hover:opacity-100" />

      {!showWordmarkFallback ? (
        <img
          src={logoSrc}
          width={900}
          height={492}
          alt="D3VONN.IO — One Platform Infinite Intelligence"
          className="relative block h-12 w-[178px] max-w-[48vw] object-contain object-left drop-shadow-[0_0_18px_rgba(96,165,250,0.48)] transition duration-300 group-hover:drop-shadow-[0_0_26px_rgba(96,165,250,0.78)] sm:h-[52px] sm:w-[205px] lg:w-[224px]"
          decoding="async"
          fetchPriority="high"
          draggable={false}
          onError={() => {
            if (logoSrc !== OFFICIAL_LOGO_FALLBACK_SRC) {
              setLogoSrc(OFFICIAL_LOGO_FALLBACK_SRC);
              return;
            }
            setShowWordmarkFallback(true);
          }}
        />
      ) : (
        <span className="relative flex flex-col leading-none">
          <span className="text-xl font-black tracking-[0.08em] text-white sm:text-2xl">
            D3VONN<span className="text-cyan-300">.IO</span>
          </span>
          <span className="mt-1 text-[7px] font-bold uppercase tracking-[0.22em] text-cyan-200/80 sm:text-[8px]">
            One Platform Infinite Intelligence
          </span>
        </span>
      )}
    </Link>
  );
};

export default Logo;
