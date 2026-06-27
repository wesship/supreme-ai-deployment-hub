import React from 'react';
import { Link } from 'react-router-dom';
import logoAsset from '@/assets/d3vonn-logo-main.png.asset.json';

const Logo: React.FC = () => {
  return (
    <Link to="/" className="flex items-center gap-3 group" aria-label="D3VONN.IO home">
      <div className="relative h-10 sm:h-12 w-auto overflow-hidden rounded-lg transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(112,128,255,0.35)]">
        <img
          src={logoAsset.url}
          alt="D3VONN.IO"
          className="h-full w-auto object-contain"
          loading="eager"
          decoding="async"
        />
      </div>
    </Link>
  );
};

export default Logo;
