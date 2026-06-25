import React from 'react';
import { Link } from 'react-router-dom';
import logoAsset from '@/assets/d3vonn-logo.png.asset.json';

const Logo: React.FC = () => {
  return (
    <Link to="/" className="flex items-center gap-3 group" aria-label="D3VONN.IO home">
      <img
        src={logoAsset.url}
        alt="D3VONN.IO logo"
        className="h-10 w-auto object-contain drop-shadow-[0_0_18px_rgba(56,136,255,0.35)] transition-transform duration-300 group-hover:scale-[1.03]"
        draggable={false}
      />
      <div className="hidden sm:flex flex-col">
        <span className="text-sm font-bold text-white tracking-wide">D3VONN.IO</span>
        <span className="text-[9px] text-blue-300/70 italic">You're here at an opportune time so Live</span>
      </div>
    </Link>
  );
};

export default Logo;
