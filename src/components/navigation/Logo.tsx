import React from 'react';
import { Link } from 'react-router-dom';

const Logo: React.FC = () => {
  return (
    <Link to="/" className="group flex items-center gap-3" aria-label="D3VONN.IO home">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/25 bg-[#06152a] shadow-[0_0_24px_rgba(56,136,255,0.25)] transition-all duration-300 group-hover:border-blue-300/60 group-hover:shadow-[0_0_32px_rgba(56,136,255,0.45)]">
        <div className="absolute inset-1 rounded-lg bg-gradient-to-br from-blue-400/25 via-cyan-300/10 to-transparent" />
        <span className="relative text-xl font-black tracking-tight text-white drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]">D3</span>
      </div>
      <div className="leading-none">
        <div className="text-base font-black tracking-[0.18em] text-white sm:text-lg">D3VONN.IO</div>
        <div className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-300/75 sm:block">AI Business OS</div>
      </div>
    </Link>
  );
};

export default Logo;
