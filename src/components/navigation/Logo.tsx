import React from 'react';
import { Link } from 'react-router-dom';

const Logo: React.FC = () => {
  return (
    <Link
      to="/"
      className="group relative flex min-h-12 items-center overflow-visible rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      aria-label="D3VONN.IO home"
    >
      <span className="pointer-events-none absolute -inset-3 rounded-2xl bg-blue-500/10 opacity-0 blur-xl transition duration-500 group-hover:opacity-100" />
      <img
        src="/d3vonn-main-logo.svg?v=20260713-main"
        alt="D3VONN.IO"
        className="relative block h-12 w-auto max-w-[220px] object-contain object-left drop-shadow-[0_0_18px_rgba(96,165,250,0.48)] transition duration-300 group-hover:drop-shadow-[0_0_26px_rgba(96,165,250,0.78)] sm:h-14 sm:max-w-[280px]"
        decoding="async"
        draggable={false}
      />
    </Link>
  );
};

export default Logo;
