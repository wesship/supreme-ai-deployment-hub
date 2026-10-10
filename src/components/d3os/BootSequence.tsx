import React, { useCallback, useEffect, useState } from 'react';
import { useCalmMotion } from './os-hooks';

const BOOT_KEY = 'd3os-boot-shown';

const LINES = [
  'D3VONN.IO · kernel handshake',
  'Hermes orchestration core · online',
  'Knowledge graph · 12 shards synced',
  'Agent runtime · ready',
  'One Platform. Infinite Intelligence.',
];

/**
 * Cinematic boot sequence, shown once per browser session.
 * Skipped entirely for reduced-motion users and dismissible with Escape or click.
 */
const BootSequence: React.FC = () => {
  const calm = useCalmMotion();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  const dismiss = useCallback(() => {
    setActive(false);
    document.documentElement.style.removeProperty('overflow');
  }, []);

  useEffect(() => {
    if (calm) return;
    let shown = 'yes';
    try {
      shown = sessionStorage.getItem(BOOT_KEY) ?? '';
      sessionStorage.setItem(BOOT_KEY, 'yes');
    } catch {
      shown = 'yes';
    }
    if (shown) return;
    setActive(true);
  }, [calm]);

  useEffect(() => {
    if (!active) return;
    document.documentElement.style.overflow = 'hidden';

    const tick = window.setInterval(() => setStep((value) => value + 1), 340);
    const done = window.setTimeout(dismiss, LINES.length * 340 + 620);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(done);
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.removeProperty('overflow');
    };
  }, [active, dismiss]);

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="D3VONN.IO system starting"
      onClick={dismiss}
      className="fixed inset-0 z-[120] flex cursor-pointer items-center justify-center bg-[#faf8f4] px-6"
    >
      <div className="absolute inset-0 os-grain opacity-60" aria-hidden="true" />
      <div className="relative w-full max-w-xl">
        <div className="os-display text-2xl font-bold tracking-[-0.04em] md:text-4xl">D3VONN.IO</div>
        <div className="mt-1 text-sm text-[color:var(--os-ink-60)]">The AI Business Operating System</div>

        <div className="mt-8 h-px w-full bg-[color:var(--os-line)]" />

        <ul className="os-mono mt-6 space-y-2 text-xs md:text-sm">
          {LINES.map((line, index) => (
            <li
              key={line}
              className="flex items-center gap-3 transition-opacity duration-300"
              style={{ opacity: index <= step ? 1 : 0.12 }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: index <= step ? 'var(--os-lime)' : 'var(--os-line)' }}
              />
              <span>{line}</span>
              {index === step && <span className="os-blink">_</span>}
            </li>
          ))}
        </ul>

        <div className="mt-8 h-1 w-full overflow-hidden rounded-full bg-[color:var(--os-line-soft)]">
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{
              width: `${Math.min(((step + 1) / LINES.length) * 100, 100)}%`,
              background: 'linear-gradient(90deg, var(--os-lime), var(--os-orange))',
            }}
          />
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="os-mono mt-6 cursor-pointer rounded-md border border-[color:var(--os-line)] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[color:var(--os-ink-60)] hover:border-[color:var(--os-ink)] hover:text-[color:var(--os-ink)]"
        >
          Skip intro
        </button>
      </div>
    </div>
  );
};

export default BootSequence;
