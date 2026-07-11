import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const LOGO_SRC = '/d3vonn-logo.webp';

const Logo: React.FC = () => {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Link
      to="/"
      className="group relative flex items-center gap-3 overflow-visible"
      aria-label="D3VONN.IO home"
    >
      <span className="pointer-events-none absolute -inset-3 rounded-2xl bg-blue-500/10 opacity-0 blur-xl transition duration-500 group-hover:opacity-100" />
      <span className="pointer-events-none absolute -inset-y-2 left-0 w-12 translate-x-[-120%] rotate-12 bg-gradient-to-r from-transparent via-blue-200/35 to-transparent blur-sm transition-transform duration-1000 group-hover:translate-x-[420%]" />

      {!imageFailed ? (
        <img
          src={LOGO_SRC}
          alt="D3VONN.IO"
          onError={() => setImageFailed(true)}
          className="h-11 w-auto max-w-[220px] object-contain object-left drop-shadow-[0_0_18px_rgba(59,130,246,0.45)] transition duration-500 group-hover:scale-[1.02] group-hover:drop-shadow-[0_0_26px_rgba(96,165,250,0.75)] sm:h-14 sm:max-w-[300px]"
          loading="eager"
          decoding="async"
        />
      ) : (
        <span className="text-2xl font-black uppercase tracking-[0.18em] text-white drop-shadow-[0_0_18px_rgba(96,165,250,0.5)] transition duration-300 group-hover:text-blue-100 group-hover:drop-shadow-[0_0_26px_rgba(96,165,250,0.85)] sm:text-3xl">
          D3VONN.IO
        </span>
      )}
    </Link>
  );
};

export default Logo;
