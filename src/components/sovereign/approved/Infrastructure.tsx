import Reveal from './Reveal';
import SectionHeader from './SectionHeader';

const capabilities = [
  { icon: 'ri-cloud-line', label: 'Secure cloud deployment', target: 'platform' },
  { icon: 'ri-cpu-line', label: 'Local GPU execution', target: 'platform' },
  { icon: 'ri-lock-line', label: 'Private workflows', target: 'about' },
  { icon: 'ri-shuffle-line', label: 'Provider routing', target: 'platform' },
  { icon: 'ri-open-source-line', label: 'Open-source model support', target: 'about' },
  { icon: 'ri-user-star-line', label: 'Human-controlled permissions', target: 'agents' },
];

const nodes = [
  { icon: 'ri-cloud-line', name: 'Secure Cloud', detail: 'Managed remote execution', tone: 'accent' },
  { icon: 'ri-macbook-line', name: 'Local Node', detail: 'Private on-device inference', tone: 'primary' },
  { icon: 'ri-computer-line', name: 'GPU Workstation', detail: 'High-throughput local compute', tone: 'foreground' },
];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = document.documentElement.classList.contains('reduce-motion');
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

export default function Infrastructure() {
  return (
    <section id="infrastructure" className="relative overflow-hidden bg-background-100/50 py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,155,255,0.06),transparent_45%)]"></div>
      <div className="relative mx-auto max-w-[1680px] px-5 md:px-8">
        <Reveal>
          <SectionHeader
            index="04"
            label="Sovereign Infrastructure"
            title="Own the Intelligence Layer."
            copy="Run where it makes sense — secure cloud, your local machine, or a dedicated GPU node — with provider routing and permissions you control. Choice, portability, and resilience."
          />
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-12">
          {/* Capabilities */}
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6">
            {capabilities.map((c, i) => (
              <Reveal key={c.label} delay={i * 50}>
                <a
                  href={`#${c.target}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(c.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Spacebar') {
                      e.preventDefault();
                      scrollToSection(c.target);
                    }
                  }}
                  className="glass group flex items-center gap-4 rounded-lg p-5 transition-all hover:border-primary-500/40 hover:shadow-[0_0_28px_rgba(59,155,255,0.22)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-foreground-200/10 bg-background-200/60">
                    <i className={`${c.icon} text-base text-primary-400`}></i>
                  </span>
                  <span className="text-sm font-medium text-foreground-200">{c.label}</span>
                </a>
              </Reveal>
            ))}
          </div>

          {/* Network diagram */}
          <Reveal className="lg:col-span-6" delay={80}>
            <div className="glass rounded-lg p-6">
              {/* core routing bar */}
              <div className="flex items-center justify-center gap-3 rounded-md border border-primary-500/25 bg-primary-500/[0.06] px-5 py-3">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-primary-500/60"></span>
                  <span className="relative h-1.5 w-1.5 rounded-full bg-primary-500"></span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary-300">
                  D3VONN Core // routing &amp; permissions
                </span>
              </div>

              {/* connecting lines */}
              <div className="mx-auto flex w-full max-w-sm items-start justify-between px-8">
                {nodes.map((n) => (
                  <div key={n.name} className="relative flex flex-col items-center">
                    <span className="relative h-12 w-px overflow-hidden bg-gradient-to-b from-primary-500/50 to-primary-500/10">
                      <span
                        className="absolute left-0 top-0 h-2 w-px bg-accent-500"
                        style={{ animation: `approved-signal-sweep 2.4s linear infinite` }}
                      ></span>
                    </span>
                  </div>
                ))}
              </div>

              {/* nodes */}
              <div className="grid grid-cols-3 gap-3">
                {nodes.map((n) => (
                  <div
                    key={n.name}
                    className="group rounded-md border border-foreground-200/10 bg-background-100 p-4 text-center transition-colors hover:border-accent-500/30"
                  >
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-foreground-200/10 bg-background-200/60">
                      <i
                        className={`${n.icon} text-base ${
                          n.tone === 'accent' ? 'text-accent-400' : n.tone === 'primary' ? 'text-primary-400' : 'text-foreground-200'
                        }`}
                      ></i>
                    </span>
                    <div className="mt-3 font-heading text-sm font-bold text-foreground-900">{n.name}</div>
                    <div className="mt-1 font-mono text-[8px] uppercase leading-4 tracking-[0.1em] text-foreground-300/70">
                      {n.detail}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-6 border-t border-foreground-200/10 pt-4 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-foreground-300/70">
                Connected execution environments // no lock-in
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}