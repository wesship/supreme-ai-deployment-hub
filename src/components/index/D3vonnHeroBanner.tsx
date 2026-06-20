import React from 'react';
import { motion } from 'framer-motion';
import heroAsset from '@/assets/d3vonn-hero.png.asset.json';

const D3vonnHeroBanner: React.FC = () => {
  return (
    <section
      aria-label="D3VONN.IO — The Future Is Autonomous"
      className="relative w-full overflow-hidden bg-black"
    >
      {/* Full-bleed futuristic hero image */}
      <motion.img
        src={heroAsset.url}
        alt="D3VONN.IO — Autonomous AI Business OS futuristic hero"
        className="w-full h-auto block select-none"
        draggable={false}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        loading="eager"
        fetchPriority="high"
      />

      {/* Cinematic gradient fade into the rest of the page */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />

      {/* Subtle scanline / neon glow overlay */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(59,255,122,0.06) 0px, rgba(59,255,122,0.06) 1px, transparent 1px, transparent 3px)',
        }}
        aria-hidden="true"
      />

      {/* Rebrand ribbon */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full border border-primary/40 bg-black/60 backdrop-blur-md text-[10px] sm:text-xs tracking-[0.25em] uppercase text-primary shadow-[0_0_20px_rgba(59,255,122,0.35)]"
      >
        devonn.ai → D3VONN.IO · Now Live
      </motion.div>
    </section>
  );
};

export default D3vonnHeroBanner;
