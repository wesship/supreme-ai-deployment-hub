import { useEffect, useMemo, useRef } from 'react';

interface Particle {
  left: number;
  bottom: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  cyan: boolean;
}

export default function SignalField() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const glowRef2 = useRef<HTMLDivElement>(null);

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: 42 }).map((_, i) => ({
      left: Math.random() * 100,
      bottom: Math.random() * 40,
      size: Math.random() * 2.2 + 0.8,
      duration: Math.random() * 18 + 14,
      delay: Math.random() * -30,
      opacity: Math.random() * 0.5 + 0.15,
      cyan: i % 3 === 0,
    }));
  }, []);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const onMove = (e: MouseEvent) => {
      const rect = field.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${x * 40}px, ${y * 40}px, 0)`;
      }
      if (glowRef2.current) {
        glowRef2.current.style.transform = `translate3d(${x * -24}px, ${y * -24}px, 0)`;
      }
    };

    field.addEventListener('mousemove', onMove);
    return () => field.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div ref={fieldRef} className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* base atmospheric gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(59,155,255,0.10),transparent_46%),radial-gradient(circle_at_82%_70%,rgba(98,230,255,0.06),transparent_42%),linear-gradient(180deg,rgba(5,6,7,0.5)_0%,rgba(9,11,13,0.5)_100%)]"></div>

      {/* coordinate grid */}
      <div className="coord-grid absolute inset-0 opacity-70"></div>

      {/* fine contour */}
      <div className="contour absolute inset-0"></div>

      {/* volumetric glow layers (pointer-reactive) */}
      <div
        ref={glowRef}
        className="absolute left-1/2 top-1/3 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,155,255,0.14),transparent_65%)] blur-2xl transition-transform duration-700 ease-out"
      ></div>
      <div
        ref={glowRef2}
        className="absolute right-[18%] top-[40%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(98,230,255,0.09),transparent_65%)] blur-2xl transition-transform duration-1000 ease-out"
      ></div>

      {/* signal particles */}
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            width: p.size,
            height: p.size,
            background: p.cyan ? 'rgba(98,230,255,0.7)' : 'rgba(59,155,255,0.7)',
            boxShadow: p.cyan ? '0 0 6px rgba(98,230,255,0.6)' : '0 0 6px rgba(59,155,255,0.6)',
            animation: `approved-float-up ${p.duration}s linear infinite`,
            animationDelay: `${p.delay}s`,
            ['--p-opacity' as string]: p.opacity,
          }}
        ></span>
      ))}

      {/* horizontal signal sweep line */}
      <span
        className="absolute top-[46%] h-px w-full bg-gradient-to-r from-transparent via-accent-500/50 to-transparent"
        style={{ animation: 'approved-signal-sweep 6s ease-in-out infinite' }}
      ></span>

      {/* bottom fade into next section */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background-50 to-transparent"></div>
    </div>
  );
}