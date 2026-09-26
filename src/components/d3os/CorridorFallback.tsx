import React from 'react';

/** Static, zero-cost stand-in for the animated corridor. Same footprint: no layout shift. */
const CorridorFallback: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
    <div className="absolute left-1/2 top-[48%] h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(183,224,23,0.16),rgba(255,122,26,0.08)_38%,transparent_66%)]" />
    <div className="absolute inset-0 os-grain opacity-70" />
  </div>
);

export default CorridorFallback;
