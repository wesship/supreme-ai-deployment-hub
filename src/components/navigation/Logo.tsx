import React from 'react';
import { Link } from 'react-router-dom';

const Logo: React.FC = () => {
  return (
    <Link to="/" className="group flex items-center" aria-label="D3VONN.IO home">
      <span className="text-2xl font-black uppercase tracking-[0.18em] text-white drop-shadow-[0_0_18px_rgba(96,165,250,0.5)] transition duration-300 group-hover:text-blue-100 group-hover:drop-shadow-[0_0_26px_rgba(96,165,250,0.85)] sm:text-3xl">
        D3VONN.IO
      </span>
    </Link>
  );
};

export default Logo;
