import React from 'react';
import { Link } from 'react-router-dom';

const Logo: React.FC = () => {
  return (
    <Link to="/" className="flex items-center gap-3 group" aria-label="D3VONN.IO home">
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-bold text-white tracking-wide">D3VONN.IO</span>
        <span className="text-[9px] text-blue-300/70 italic">You're here at an opportune time so Live</span>
      </div>
    </Link>
  );
};

export default Logo;
