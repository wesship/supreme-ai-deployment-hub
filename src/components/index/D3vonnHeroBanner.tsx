import React from 'react';
import { motion } from 'framer-motion';
import { Bot, ArrowRight, ShieldCheck, Network, Zap } from 'lucide-react';
import D3vonnBackdrop from './D3vonnBackdrop';

const D3vonnHeroBanner: React.FC = () => {
  return (
    <section
      aria-label="D3VONN.IO — The Future Is Autonomous"
      className="relative w-full overflow-hidden bg-black min-h-[520px] sm:min-h-[620px] lg:min-h-[720px]"
    >
      <motion.div
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute inset-0"
      >
        <D3vonnBackdrop />
      </motion.div>

      <div className="relative z-10 container mx-auto px-6 py-20 sm:py-28 lg:py-36">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/60 px-4 py-2 text-[10px] sm:text-xs uppercase tracking-[0.25em] text-primary shadow-[0_0_24px_rgba(112,128,255,0.25)]">
            <Bot className="h-4 w-4" />
            AI Workforce. Limitless Potential.
          </div>

          <h1 className="mt-8 text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.18)]">
            Welcome to <span className="block text-primary">D3VONN.IO</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg sm:text-xl text-white/85">
            The world’s first AI business operating system. Orchestrate your AI workforce, automate everything, and scale without limits.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <a
              href="/app"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.25)] transition hover:scale-[1.02]"
            >
              Launch D3VONN <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#platform"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-black/40 px-6 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              Explore Platform
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-xs text-white/70">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Secure by design</span>
            <span className="inline-flex items-center gap-2"><Network className="h-4 w-4 text-primary" /> Multi-agent orchestration</span>
            <span className="inline-flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Real-time intelligence</span>
          </div>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />

      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(112,128,255,0.06) 0px, rgba(112,128,255,0.06) 1px, transparent 1px, transparent 3px)',
        }}
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full border border-primary/40 bg-black/60 backdrop-blur-md text-[10px] sm:text-xs tracking-[0.25em] uppercase text-primary shadow-[0_0_20px_rgba(112,128,255,0.35)]"
      >
        D3VONN.IO · Now Live
      </motion.div>
    </section>
  );
};

export default D3vonnHeroBanner;
