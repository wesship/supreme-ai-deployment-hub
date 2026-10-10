import Reveal from './Reveal';

export default function Manifesto() {
  return (
    <section id="about" className="relative overflow-hidden bg-background-100/50 py-24 md:py-32">
      {/* cool ambient light */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,rgba(59,155,255,0.10),transparent_50%)]"></div>

      <div className="relative mx-auto max-w-[1680px] px-5 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Imagery */}
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-foreground-200/10">
              <img
                loading="lazy"
                decoding="async"
                src="/readdy-v90/manifesto-hands.jpg"
                alt="Human creativity meeting machine intelligence"
                title="Human creativity and machine intelligence — D3VONN"
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background-50/70 via-transparent to-background-50/20"></div>
              <span className="absolute bottom-5 left-5 font-mono text-[9px] uppercase tracking-[0.22em] text-primary-300">
                Origin // Humanity + Machine
              </span>
            </div>
          </Reveal>

          {/* Editorial quotation */}
          <Reveal delay={100}>
            <div className="max-w-xl">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary-500/80">06</span>
                <span className="h-px w-8 bg-primary-500/40"></span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground-300">
                  About / Manifesto
                </span>
              </div>

              <h2 className="mt-6 font-heading text-4xl font-semibold leading-[1.08] tracking-tight text-foreground-900 sm:text-5xl">
                Technology Should Expand Human Ability.
              </h2>

              <blockquote className="mt-10 border-l-2 border-primary-500/50 pl-6">
                <p className="text-xl leading-9 text-foreground-300 sm:text-2xl sm:leading-10">
                  “All animals have ability and strength. What separates humanity is our capacity to
                  imagine, create, cooperate, and build beyond the limits of instinct. D3VONN exists to
                  turn that capacity into systems that move people and ideas forward.”
                </p>
              </blockquote>

              <div className="mt-10 flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary-500/30 bg-primary-500/10">
                  <i className="ri-double-quotes-l text-primary-400"></i>
                </span>
                <div>
                  <div className="font-heading text-sm font-semibold text-foreground-900">
                    The D3VONN Principle
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-300">
                    Signal over noise · Command over chaos
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}