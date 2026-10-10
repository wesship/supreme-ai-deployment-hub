import React from 'react';
import { cn } from '@/lib/utils';

interface D3vonnBackdropProps {
  compact?: boolean;
}

/**
 * Asset-independent branded backdrop shared by public-page banners.
 * Keeping this visual in CSS prevents third-party asset outages from
 * producing broken images on launch-critical public routes.
 */
const D3vonnBackdrop: React.FC<D3vonnBackdropProps> = ({ compact = false }) => (
  <div
    aria-hidden="true"
    className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_72%_35%,rgba(37,126,255,0.38),transparent_28%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.12),transparent_24%),linear-gradient(135deg,#010611_0%,#071633_48%,#000_100%)]"
  >
    <div className="absolute inset-0 opacity-25 bg-[linear-gradient(rgba(147,197,253,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(147,197,253,0.06)_1px,transparent_1px)] bg-[size:42px_42px]" />
    <div
      className={cn(
        'absolute rounded-full border border-blue-300/35 shadow-[0_0_120px_rgba(37,126,255,0.35)]',
        compact
          ? 'right-[-8%] top-[-38%] h-[460px] w-[460px]'
          : 'right-[-10%] top-[8%] h-[560px] w-[560px]',
      )}
    />
    <div
      className={cn(
        'absolute rounded-full border-2 border-blue-300/40 bg-blue-500/[0.04] shadow-[inset_0_0_80px_rgba(37,126,255,0.28),0_0_80px_rgba(37,126,255,0.22)]',
        compact
          ? 'right-[8%] top-[6%] h-[260px] w-[260px]'
          : 'right-[8%] top-[22%] h-[300px] w-[300px]',
      )}
    />
    <div
      className={cn(
        'absolute grid place-items-center rounded-full border border-white/25 bg-black/45 font-black tracking-[-0.08em] text-blue-100 shadow-[0_0_60px_rgba(37,126,255,0.45)] backdrop-blur-md',
        compact
          ? 'right-[18%] top-[26%] h-24 w-24 text-3xl'
          : 'right-[18%] top-[36%] h-[120px] w-[120px] text-4xl',
      )}
    >
      D3
    </div>
    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-background" />
  </div>
);

export default D3vonnBackdrop;
