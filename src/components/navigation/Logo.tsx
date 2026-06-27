import React from 'react';
import { Link } from 'react-router-dom';

const Logo: React.FC = () => {
  return (
    <Link to="/" className="group flex items-center gap-3" aria-label="D3VONN.IO home">
      <img
        src="/brand/d3vonn-logo-cutout.svg"
        alt="D3VONN.IO"
        className="h-12 w-auto max-w-[210px] object-contain drop-shadow-[0_0_18px_rgba(56,136,255,0.35)] transition duration-300 group-hover:drop-shadow-[0_0_26px_rgba(56,136,255,0.6)]"
        loading="eager"
        decoding="async"
      />
    </Link>
  );
};

export default Logo;
