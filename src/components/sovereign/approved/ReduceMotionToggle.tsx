import { useEffect, useState } from 'react';

export default function ReduceMotionToggle() {
  const [reduceMotion, setReduceMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('d3vonn-reduce-motion') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    try {
      localStorage.setItem('d3vonn-reduce-motion', reduceMotion ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  }, [reduceMotion]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={reduceMotion}
      aria-label="Reduce motion"
      onClick={() => setReduceMotion((v) => !v)}
      className="group inline-flex items-center gap-2.5 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-300/80 transition-colors hover:text-foreground-900 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50"
    >
      <span
        className={`relative flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-300 ${
          reduceMotion
            ? 'border-accent-500/50 bg-accent-500/30'
            : 'border-foreground-200/25 bg-background-200/60'
        }`}
      >
        <span
          className={`absolute h-3.5 w-3.5 rounded-full bg-white transition-transform duration-300 ${
            reduceMotion ? 'translate-x-4' : 'translate-x-[3px]'
          }`}
        ></span>
      </span>
      <span>Reduce motion</span>
    </button>
  );
}