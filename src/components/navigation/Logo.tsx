import React from 'react';
import { Link } from 'react-router-dom';
import logoAsset from '@/assets/d3vonn-logo.png.asset.json';

const Logo: React.FC = () => {
  return (
    <Link to="/" className="flex items-center gap-3 group" aria-label="D3VONN.IO home">
      <img
        src={logoAsset.url}
        alt="D3VONN.IO logo"
        className="h-10 w-auto object-contain drop-shadow-[0_0_18px_rgba(112,128,255,0.45)] transition-transform duration-300 group-hover:scale-[1.03]"
        draggable={false}
      />
      <span className="sr-only">D3VONN.IO</span>
    </Link>
  );
};

export default Logo;
