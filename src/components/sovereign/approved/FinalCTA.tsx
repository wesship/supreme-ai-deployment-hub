import Reveal from './Reveal';

export default function FinalCTA() {
  return (
    <section id="signal" className="relative overflow-hidden bg-background-50/50 py-28 md:py-40">
      {/* embossed logo behind text */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <div className="relative flex h-[520px] w-[520px] items-center justify-center opacity-[0.14] md:h-[720px] md:w-[720px]">
          <span className="absolute inset-0 rounded-full border border-primary-500/30"></span>
          <span className="absolute inset-10 rounded-full border border-primary-500/20"></span>
          <span className="absolute inset-24 rounded-full border border-accent-500/15"></span>
          <img
            src="/readdy-v90/final-cta-emblem.webp"
            alt=""
            className="relative h-32 w-32 rounded-full object-cover object-center md:h-48 md:w-48"
          />
        </div>
      </div>

      <div className="relative mx-auto max-w-4xl px-5 text-center md:px-8">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent-400/70">
            D3VONN NETWORK // TRANSMISSION COMPLETE
          </p>
          <h2 className="mt-8 font-heading text-[clamp(3rem,8vw,6.5rem)] font-bold leading-[0.95] tracking-[-0.03em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.85)]">
            THE SIGNAL IS YOURS.
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-8 text-foreground-200 font-medium">
            Enter the D3VONN ecosystem and put intelligent systems under your command.
          </p>

          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/app"
              className="btn-primary group inline-flex min-h-13 items-center justify-center gap-2.5 rounded-md px-9 py-3.5 text-sm font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              Launch D3VONN
              <i className="ri-arrow-right-line transition-transform duration-300 group-hover:translate-x-1"></i>
            </a>
            <a
              href="#platform"
              className="btn-ghost inline-flex min-h-13 items-center justify-center gap-2.5 rounded-md px-9 py-3.5 text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              Explore the Ecosystem
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}