import { useState, useEffect } from 'react';
import Reveal from './Reveal';
import SectionHeader from './SectionHeader';

const surfaces = [
  { icon: 'ri-robot-2-line', name: 'AI Agents', desc: 'Deploy agents that act with human oversight.', href: '#agents' },
  { icon: 'ri-film-line', name: 'AI Films', desc: 'Generate cinematic stories end to end.', href: '#films' },
  { icon: 'ri-voiceprint-line', name: 'Voice Intelligence', desc: 'Systems that listen, think, and respond.', href: '#voice' },
  { icon: 'ri-flow-chart', name: 'Automation', desc: 'Orchestrate workflows across your stack.', href: null, comingSoon: true },
  { icon: 'ri-palette-line', name: 'Creative Studios', desc: 'Tooling for creators and production teams.', href: null, comingSoon: true },
  { icon: 'ri-database-2-line', name: 'Sovereign Infrastructure', desc: 'Cloud to local execution, under your control.', href: '#infrastructure' },
];

const branches = [
  { icon: 'ri-robot-2-line', name: 'AI Agents', angle: 300 },
  { icon: 'ri-film-line', name: 'AI Films', angle: 0 },
  { icon: 'ri-voiceprint-line', name: 'Voice', angle: 60 },
  { icon: 'ri-flow-chart', name: 'Automation', angle: 120 },
  { icon: 'ri-palette-line', name: 'Creative', angle: 180 },
  { icon: 'ri-database-2-line', name: 'Infrastructure', angle: 240 },
];

export default function Platform() {
  const [litNode, setLitNode] = useState<number | null>(null);

  // Randomly light up a node, then let it fade back down
  useEffect(() => {
    let mounted = true;
    let clearTimer: ReturnType<typeof setTimeout>;

    const fire = () => {
      if (!mounted) return;
      const idx = Math.floor(Math.random() * branches.length);
      setLitNode(idx);
      clearTimer = setTimeout(() => {
        if (mounted) setLitNode(null);
      }, 1400);
    };

    const first = setTimeout(fire, 900);
    const interval = setInterval(fire, 2400);

    return () => {
      mounted = false;
      clearTimeout(first);
      clearTimeout(clearTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <section id="platform" className="relative overflow-hidden bg-background-50/50 py-24 md:py-32">
      <div className="coord-grid pointer-events-none absolute inset-0 opacity-40"></div>
      <div className="relative mx-auto max-w-[1680px] px-5 md:px-8">
        <Reveal>
          <SectionHeader
            index="01"
            label="The Platform"
            title="One Signal. Multiple Systems."
            copy="D3VONN.IO is a single operating environment connecting intelligent capabilities — not a set of separate companies. Each surface is an instrument panel embedded in the same command layer."
          />
        </Reveal>

        <div className="mt-16 grid gap-10 lg:grid-cols-12">
          {/* Core mind-map */}
          <Reveal className="lg:col-span-5">
            <div className="glass relative flex h-full min-h-[560px] flex-col overflow-hidden rounded-lg">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(59,155,255,0.13),transparent_62%)]"></div>

              {/* telemetry readouts */}
              <span className="absolute left-6 top-6 z-10 font-mono text-[9px] uppercase tracking-[0.2em] text-foreground-300">
                Core // v4.2
              </span>
              <span className="absolute right-6 top-6 z-10 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-accent-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-accent-500/60"></span>
                  <span className="relative h-1.5 w-1.5 rounded-full bg-accent-500"></span>
                </span>
                Linked
              </span>

              {/* mind-map graph */}
              <div className="relative mx-auto my-10 flex w-full max-w-[380px] flex-1 items-center justify-center">
                <div className="relative aspect-square w-full">
                  {/* rotating radar sweep */}
                  <span
                    className="absolute inset-[12%] rounded-full"
                    style={{
                      background:
                        'conic-gradient(from 0deg, transparent 0deg, rgba(98,230,255,0.14) 46deg, rgba(59,155,255,0.06) 70deg, transparent 100deg)',
                      animation: 'approved-radar-sweep 9s linear infinite',
                    }}
                  ></span>

                  {/* orbit ring */}
                  <span className="absolute left-1/2 top-1/2 aspect-square w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-primary-500/20"></span>

                  {/* second slow orbit ring */}
                  <span
                    className="absolute left-1/2 top-1/2 aspect-square w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent"
                    style={{ animation: 'approved-spin-slow 40s linear infinite' }}
                  >
                    <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-400 shadow-[0_0_10px_rgba(98,230,255,0.8)]"></span>
                  </span>

                  {/* spokes with traveling signal packets */}
                  {branches.map((b, i) => (
                    <span
                      key={`spoke-${b.name}`}
                      className="absolute left-1/2 top-1/2 h-px origin-left"
                      style={{
                        width: '34%',
                        transform: `rotate(${b.angle}deg)`,
                        background:
                          'linear-gradient(90deg, rgba(59,155,255,0.55), rgba(125,241,255,0.06))',
                      }}
                    >
                      <span
                        className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent-400"
                        style={{
                          boxShadow: '0 0 8px rgba(98,230,255,0.9)',
                          animation: `approved-signal-travel 2.6s linear infinite`,
                          animationDelay: `${i * 0.43}s`,
                        }}
                      ></span>
                    </span>
                  ))}

                  {/* branch nodes */}
                  {branches.map((b, i) => {
                    const rad = (b.angle * Math.PI) / 180;
                    const x = 50 + 34 * Math.cos(rad);
                    const y = 50 + 34 * Math.sin(rad);
                    const isLit = litNode === i;
                    return (
                      <div
                        key={b.name}
                        className="group absolute flex flex-col items-center gap-2"
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          transform: 'translate(-50%,-50%)',
                          width: '30%',
                        }}
                      >
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-md border transition-all duration-500 group-hover:border-accent-500/50 group-hover:shadow-[0_0_18px_rgba(98,230,255,0.35)] ${
                            isLit
                              ? 'border-accent-500 bg-accent-500/20 shadow-[0_0_28px_rgba(98,230,255,0.8)]'
                              : 'border-primary-500/30 bg-background-200/70'
                          }`}
                        >
                          <i
                            className={`${b.icon} text-lg transition-colors duration-500 ${
                              isLit ? 'text-accent-300' : 'text-primary-400'
                            }`}
                          ></i>
                        </span>
                        <span className="text-center font-heading text-xs font-semibold leading-tight text-foreground-900">
                          {b.name}
                        </span>
                      </div>
                    );
                  })}

                  {/* central node */}
                  <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
                    <span className="relative flex h-16 w-16 items-center justify-center">
                      <span className="animate-spin-slow absolute inset-0 rounded-full border border-primary-500/25 [border-top-color:rgba(59,155,255,0.7)]"></span>
                      <span className="absolute inset-2 rounded-full border border-foreground-200/10"></span>
                      <span className="animate-pulse-glow absolute inset-3 rounded-full border border-accent-500/20"></span>
                      <span className="relative h-4 w-4 rotate-45 bg-primary-500 shadow-[0_0_28px_rgba(59,155,255,0.7)]"></span>
                    </span>
                    <span className="font-heading text-sm font-bold text-foreground-900">
                      D3VONN Core
                    </span>
                    <span className="font-mono text-[8px] uppercase leading-4 tracking-[0.1em] text-foreground-300">
                      Command layer
                    </span>
                  </div>
                </div>
              </div>

              {/* stats */}
              <div className="relative z-10 grid grid-cols-3 gap-2 border-t border-foreground-200/10 px-8 py-5">
                {[
                  ['6', 'Surfaces'],
                  ['1', 'Command'],
                  ['∞', 'Signals'],
                ].map(([v, l]) => (
                  <div key={l} className="text-center">
                    <div className="font-heading text-lg font-bold text-primary-400">{v}</div>
                    <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.18em] text-foreground-300">
                      {l}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Surface panels */}
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            {surfaces.map((s, i) => {
              const cardInner = (
                <>
                  <span className="absolute left-0 top-6 h-8 w-px bg-gradient-to-b from-primary-500/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></span>
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-md border border-foreground-200/10 bg-background-200/60">
                      <i className={`${s.icon} text-lg text-primary-400`}></i>
                    </span>
                    <div className="flex items-center gap-2">
                      {s.comingSoon && (
                        <span className="rounded-full border border-foreground-200/15 bg-background-200/50 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-foreground-300/80">
                          Coming soon
                        </span>
                      )}
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground-300">
                        0{i + 1}
                      </span>
                    </div>
                  </div>
                  <h4 className="mt-5 font-heading text-lg font-bold text-foreground-900">
                    {s.name}
                  </h4>
                  <p className="mt-2 text-sm font-medium leading-6 text-foreground-200">{s.desc}</p>
                  {s.href ? (
                    <span className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary-400 transition-colors group-hover:text-primary-300">
                      Open surface
                      <i className="ri-arrow-right-line transition-transform duration-300 group-hover:translate-x-1"></i>
                    </span>
                  ) : (
                    <span className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground-300">
                      <i className="ri-lock-line text-xs"></i>
                      Coming soon
                    </span>
                  )}
                </>
              );

              const cardClass =
                'glass group relative flex h-full flex-col rounded-lg p-6 transition-all duration-300 ' +
                (s.href
                  ? 'hover:border-primary-500/50 hover:shadow-[0_0_34px_rgba(59,155,255,0.28)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:border-primary-500/50'
                  : 'opacity-80 border-dashed border-foreground-200/20');

              return (
                <Reveal key={s.name} delay={i * 60}>
                  {s.href ? (
                    <a
                      href={s.href}
                      className={cardClass}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Spacebar') {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}
                    >
                      {cardInner}
                    </a>
                  ) : (
                    <div className={cardClass}>{cardInner}</div>
                  )}
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}