import React from 'react';
import { Link } from 'react-router-dom';
import logoAsset from '@/assets/d3vonn-logo.png.asset.json';

const Logo: React.FC = () => {
  return (
    <Link to="/" className="flex items-center gap-3 group" aria-label="D3VONN.IO home">
      <div className="relative">
        {/* Glow halo so the logo pops against the dark page */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -m-2 rounded-full bg-[radial-gradient(circle,rgba(112,128,255,0.55)_0%,rgba(112,128,255,0.15)_55%,transparent_75%)] blur-xl"
        />
        <img
          src={logoAsset.url}
          alt="D3VONN.IO logo"
          style={{ mixBlendMode: 'screen' }}
          className="relative h-10 w-auto object-contain drop-shadow-[0_0_22px_rgba(112,128,255,0.75)] transition-transform duration-300 group-hover:scale-[1.05]"
          draggable={false}
        />
      </div>
      <div className="hidden sm:flex flex-col">
        <span className="text-sm font-bold text-white tracking-wide">D3VONN.IO</span>
        <span className="text-[9px] text-blue-300/70 italic">You're here at an opportune time so Live</span>
      </div>
    </Link>
  );
};

export default Logo;
