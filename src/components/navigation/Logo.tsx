import React from 'react';
import { Link } from 'react-router-dom';
import logoAsset from '@/assets/d3vonn-logo-transparent.png.asset.json';

const Logo: React.FC = () => {
  return (
    <Link to="/" className="flex items-center gap-3 group" aria-label="D3VONN.IO home">
      <div className="relative">
        {/* Soft halo so the mark feels embedded in the navy background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -m-3 rounded-full bg-[radial-gradient(circle,rgba(0,160,255,0.35)_0%,rgba(112,128,255,0.12)_55%,transparent_75%)] blur-xl"
        />
        <img
          src={logoAsset.url}
          alt="D3VONN.IO"
          draggable={false}
          style={{
            mixBlendMode: 'screen',
            background: 'transparent',
            objectFit: 'contain',
            WebkitMaskImage:
              'radial-gradient(ellipse at center, black 60%, transparent 92%)',
            maskImage:
              'radial-gradient(ellipse at center, black 60%, transparent 92%)',
            filter:
              'drop-shadow(0 0 18px rgba(0,160,255,0.35)) drop-shadow(0 0 6px rgba(112,128,255,0.45))',
          }}
          className="relative h-10 w-auto transition-transform duration-300 group-hover:scale-[1.05]"
        />
      </div>
      <div className="hidden sm:flex flex-col leading-tight">
        <span className="text-sm font-bold text-white tracking-wide">D3VONN.IO</span>
        <span className="text-[9px] text-blue-300/70 italic">You're here at an opportune time so Live</span>
      </div>
    </Link>
  );
};

export default Logo;
