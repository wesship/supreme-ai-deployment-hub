import React, { useEffect, useRef, useState } from 'react';
import { useCalmMotion } from './os-hooks';

type CoreState = 'dormant' | 'scanning' | 'active';

const COPY: Record<CoreState, { label: string; detail: string }> = {
  dormant: { label: 'Dormant', detail: 'Hermes is idle and waiting for an operator signal.' },
  scanning: { label: 'Scanning', detail: 'Hermes is reading context, policy and available capability.' },
  active: { label: 'Active', detail: 'Hermes is planning, routing and supervising agent execution.' },
};

/**
 * Hermes activation centerpiece: dormant -> scanning -> active,
 * driven by scroll proximity, hover and click/keyboard activation.
 */
const HermesCore: React.FC = () => {
  const calm = useCalmMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<CoreState>('dormant');
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (locked) return;
        setState(entry.isIntersecting ? 'scanning' : 'dormant');
      },
      { threshold: 0.45 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [locked]);

  const activate = () => {
    setLocked(true);
    setState('active');
  };

  const ring = state === 'active' ? 'var(--os-orange)' : state === 'scanning' ? 'var(--os-lime)' : 'var(--os-chrome-3)';

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`Hermes orchestration core — ${COPY[state].label}. Activate to run a supervised orchestration.`}
      onMouseEnter={() => !locked && setState('scanning')}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      }}
      className="os-card group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden p-4 md:p-5"
      style={{ minHeight: 420 }}
    >
      <div className="absolute inset-0 os-grain opacity-60" aria-hidden="true" />

      <div className="relative flex h-64 w-64 items-center justify-center">
        {!calm &&
          state !== 'dormant' &&
          [0, 0.8, 1.6].map((delay) => (
            <span
              key={delay}
              aria-hidden="true"
              className="os-pulse-ring absolute h-40 w-40 rounded-full border"
              style={{ borderColor: ring, animationDelay: `${delay}s` }}
            />
          ))}

        <div
          className="os-chrome relative flex h-40 w-40 items-center justify-center rounded-full"
          style={{ borderColor: ring }}
        >
          <div
            className="absolute inset-3 rounded-full border"
            style={{ borderColor: ring, opacity: state === 'dormant' ? 0.3 : 0.75 }}
          />
          <div className="text-center">
            <div className="os-display text-2xl font-bold">Hermes</div>
            <div className="os-mono mt-1 text-[10px] uppercase tracking-[0.22em] text-[color:var(--os-ink-60)]">
              {COPY[state].label}
            </div>
          </div>
        </div>

        {state === 'active' &&
          Array.from({ length: 6 }).map((_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className="absolute h-1.5 w-1.5 rounded-full"
              style={{
                background: index % 2 ? 'var(--os-orange)' : 'var(--os-lime)',
                transform: `rotate(${index * 60}deg) translateX(112px)`,
              }}
            />
          ))}
      </div>

      <p className="relative mt-6 max-w-sm text-center text-sm text-[color:var(--os-ink-60)]">{COPY[state].detail}</p>

      <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2">
        {['Plan', 'Route', 'Execute', 'Verify'].map((phase, index) => (
          <span
            key={phase}
            className="os-pill os-mono px-3 py-1 text-[10px] uppercase tracking-[0.18em]"
            style={{
              borderColor: state === 'active' && index < 3 ? 'var(--os-lime-deep)' : undefined,
              color: state === 'active' && index < 3 ? 'var(--os-ink)' : 'var(--os-ink-40)',
            }}
          >
            {phase}
          </span>
        ))}
      </div>
    </div>
  );
};

export default HermesCore;
