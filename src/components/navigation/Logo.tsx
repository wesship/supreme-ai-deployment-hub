import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Production brand safety rule:
 * render the verified D3VONN.IO wordmark until the approved EXU
 * winged-helmet master artwork is committed as a repository asset.
 * Never fall back to an unapproved legacy square logo.
 */
const Logo: React.FC = () => {
  return (
    <Link
      to="/"
      className="group relative flex min-h-12 items-center overflow-visible rounded-xl px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      aria-label="D3VONN.IO home"
    >
      <span className="pointer-events-none absolute -inset-3 rounded-2xl bg-blue-500/10 opacity-0 blur-xl transition duration-500 group-hover:opacity-100" />
      <span className="pointer-events-none absolute -inset-y-2 left-0 w-12 translate-x-[-120%] rotate-12 bg-gradient-to-r from-transparent via-blue-200/35 to-transparent blur-sm transition-transform duration-1000 group-hover:translate-x-[420%] motion-reduce:hidden" />
      <span className="relative text-xl font-black uppercase tracking-[0.16em] text-white drop-shadow-[0_0_18px_rgba(96,165,250,0.55)] transition duration-300 group-hover:text-blue-100 group-hover:drop-shadow-[0_0_26px_rgba(96,165,250,0.85)] sm:text-2xl">
        D3VONN.IO
      </span>
    </Link>
  );
};

export default Logo;
