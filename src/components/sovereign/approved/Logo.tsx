import { useState } from 'react';

export default function Logo({ compact = false }: { compact?: boolean }) {
  const logoUrl = '/approved-home/emblem.webp';
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -14, y: px * 18 });
  };

  const reset = () => setTilt({ x: 0, y: 0 });

  return (
    <a
      href="#top"
      className="group flex shrink-0 items-center gap-3 cursor-pointer"
      onMouseMove={onMove}
      onMouseLeave={reset}
    >
      <span className="[perspective:500px]">
        <span
          className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-primary-500/40 group-hover:border-accent-500/60 group-hover:shadow-[0_0_26px_rgba(59,155,255,0.55)]"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: 'transform 0.18s ease-out, border-color 0.5s ease, box-shadow 0.5s ease',
          }}
        >
          <span className="absolute inset-[3px] rounded-full border border-accent-500/25"></span>
          <img
            src={logoUrl}
            alt="D3VONN"
            className="h-full w-full object-cover object-center opacity-95 transition-all duration-500 group-hover:opacity-100 group-hover:scale-110"
          />
          <span className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_16px_rgba(59,155,255,0.45)]"></span>
        </span>
      </span>
      {!compact && (
        <span className="leading-none whitespace-nowrap">
          <span className="block font-heading text-[19px] font-bold tracking-tight text-foreground-900">
            D3VONN<span className="text-primary-400">.IO</span>
          </span>
          <span className="mt-1 block font-mono text-[8.5px] uppercase tracking-[0.28em] text-foreground-300/80">
            Sovereign Signal
          </span>
        </span>
      )}
    </a>
  );
}