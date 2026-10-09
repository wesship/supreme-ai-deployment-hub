import { useEffect, useState } from 'react';
import SignalField from './SignalField';
import Logo3D from './Logo3D';

export default function Hero() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <section id="top" className="relative isolate flex min-h-screen items-center overflow-hidden">
      <SignalField />

      <div className="relative z-10 mx-auto w-full max-w-[1680px] px-5 pt-28 pb-20 md:px-8">
        {/* telemetry label */}
        <div
          className={`flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-accent-400/80 transition-all duration-700 ${
            booted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <span className="h-px w-10 bg-accent-500/40"></span>
          D3VONN NETWORK // SYSTEMS ACTIVE
          <span className="h-px w-10 bg-accent-500/40"></span>
        </div>

        {/* logo emblem — full width */}
        <div
          className={`mt-10 flex w-full items-center justify-center transition-all duration-1000 ${
            booted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
        >
          <div className="w-full max-w-[900px]">
            <Logo3D />
          </div>
        </div>

        {/* text block with dark backdrop for readability */}
        <div className="relative mx-auto max-w-4xl text-center">
          {/* readability backdrop — stronger, wider */}
          <div className="pointer-events-none absolute -inset-x-16 -inset-y-8 rounded-[2.5rem] bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(5,6,7,0.78)_0%,rgba(5,6,7,0.42)_55%,transparent_85%)]"></div>
          {/* bottom edge softener for transition into next section */}
          <div className="pointer-events-none absolute -inset-x-16 bottom-0 h-24 bg-gradient-to-t from-background-50/40 to-transparent rounded-b-[2.5rem]"></div>

          <div className="relative">
            {/* headline */}
            <h1
              className={`mt-8 font-heading text-[clamp(3rem,9vw,7rem)] font-bold leading-[0.94] tracking-[-0.03em] text-white transition-all duration-1000 delay-150 drop-shadow-[0_2px_24px_rgba(0,0,0,0.85)] ${
                booted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
            >
              INTELLIGENCE
              <span className="block text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.85)]" style={{ textShadow: '0 0 40px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.8)' }}>
                UNDER YOUR COMMAND.
              </span>
            </h1>

            {/* supporting copy */}
            <p
              className={`mx-auto mt-8 max-w-2xl text-lg leading-8 text-white/90 font-medium transition-all duration-1000 delay-300 drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)] ${
                booted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              Build, deploy, and direct sovereign AI systems from one expanding creative and operational ecosystem.
            </p>

            {/* CTAs */}
            <div
              className={`mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row transition-all duration-1000 delay-500 ${
                booted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <a
                href="/app"
                className="btn-primary group inline-flex min-h-13 items-center justify-center gap-2.5 rounded-md px-8 py-3.5 text-sm font-semibold text-white cursor-pointer whitespace-nowrap"
              >
                Enter the Platform
                <i className="ri-arrow-right-line transition-transform duration-300 group-hover:translate-x-1"></i>
              </a>
              <a
                href="#signal"
                className="btn-ghost inline-flex min-h-13 items-center justify-center gap-2.5 rounded-md px-8 py-3.5 text-sm font-medium cursor-pointer whitespace-nowrap"
              >
                Explore the Signal
              </a>
              <a
                href="/command-center"
                className="btn-ghost inline-flex min-h-13 items-center justify-center gap-2.5 rounded-md px-8 py-3.5 text-sm font-medium cursor-pointer whitespace-nowrap"
              >
                <i className="ri-radar-line"></i>
                Command Core
              </a>
            </div>

            {/* status line */}
            <div
              className={`mx-auto mt-14 flex max-w-md items-center justify-center gap-3 transition-all duration-1000 delay-700 ${
                booted ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <span className="h-px flex-1 bg-white/20"></span>
              <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/60">
                Sovereign Signal // Link Established
              </span>
              <span className="h-px flex-1 bg-white/20"></span>
            </div>

            {/* scroll cue */}
            <div
              className={`mt-12 flex flex-col items-center gap-2 transition-all duration-1000 delay-900 ${
                booted ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <a
                href="#platform"
                className="group flex flex-col items-center gap-2 text-white/50 transition-colors hover:text-white cursor-pointer"
                aria-label="Scroll to explore"
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.24em]">Scroll</span>
                <span className="flex h-8 w-5 items-start justify-center rounded-full border border-white/25 p-1">
                  <span className="h-2 w-px animate-pulse-glow bg-accent-400"></span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}