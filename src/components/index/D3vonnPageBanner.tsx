import React from 'react';
import { motion } from 'framer-motion';
import D3vonnBackdrop from './D3vonnBackdrop';

interface D3vonnPageBannerProps {
  title?: string;
  subtitle?: string;
  /** Compact = shorter banner for inner pages */
  compact?: boolean;
}

/**
 * Reusable D3VONN.IO branded banner for inner pages.
 * Uses an asset-independent visual so public routes remain polished even
 * when an external image host is unavailable.
 */
const D3vonnPageBanner: React.FC<D3vonnPageBannerProps> = ({
  title,
  subtitle = "You're here at an opportune time — so live.",
  compact = true,
}) => {
  return (
    <section
      aria-label="D3VONN.IO banner"
      className={`relative w-full overflow-hidden bg-black ${
        compact ? 'max-h-[380px]' : ''
      }`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 1.03 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute inset-0"
      >
        <D3vonnBackdrop compact={compact} />
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-background" />
      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(112,128,255,0.06) 0px, rgba(112,128,255,0.06) 1px, transparent 1px, transparent 3px)',
        }}
        aria-hidden="true"
      />

      <div
        className={`relative z-10 container mx-auto px-4 flex flex-col items-center justify-center text-center ${
          compact ? 'py-20 md:py-28' : 'py-32 md:py-44'
        }`}
      >
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/40 bg-black/60 backdrop-blur-md text-[10px] sm:text-xs tracking-[0.25em] uppercase text-primary shadow-[0_0_20px_rgba(112,128,255,0.35)]"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
          D3VONN.IO · Live
        </motion.div>

        {title && (
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-[0_0_20px_rgba(112,128,255,0.25)]"
          >
            {title}
          </motion.h1>
        )}

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.7 }}
          className="mt-4 max-w-2xl text-sm md:text-base lg:text-lg text-white/80 italic"
        >
          “{subtitle}”
        </motion.p>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
    </section>
  );
};

export default D3vonnPageBanner;
