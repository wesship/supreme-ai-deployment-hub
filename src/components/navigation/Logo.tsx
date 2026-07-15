import React from 'react';
import { Link } from 'react-router-dom';

const OFFICIAL_LOGO_SRC = '/d3vonn-logo.webp?v=20260715-official';

const Logo: React.FC = () => {
  return (
    <Link
      to="/"
      className="group relative flex min-h-14 items-center overflow-visible rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      aria-label="D3VONN.IO home"
    >
      <span className="pointer-events-none absolute -inset-3 rounded-2xl bg-blue-500/10 opacity-0 blur-xl transition duration-500 group-hover:opacity-100" />
      <img
        src={OFFICIAL_LOGO_SRC}
        alt="D3VONN.IO — One Platform. Infinite Intelligence."
        className="relative block h-auto w-[190px] max-w-[52vw] object-contain object-left drop-shadow-[0_0_18px_rgba(96,165,250,0.48)] transition duration-300 group-hover:drop-shadow-[0_0_26px_rgba(96,165,250,0.78)] sm:w-[230px] lg:w-[250px]"
        decoding="async"
        draggable={false}
      />
    </Link>
  );
};

export default Logo;
