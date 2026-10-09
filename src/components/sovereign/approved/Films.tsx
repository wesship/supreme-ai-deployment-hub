import Reveal from './Reveal';
import SectionHeader from './SectionHeader';

const workflow = [
  { icon: 'ri-quill-pen-line', label: 'Story development' },
  { icon: 'ri-user-shared-line', label: 'Character continuity' },
  { icon: 'ri-landscape-line', label: 'Scene generation' },
  { icon: 'ri-sound-module-line', label: 'Voice & sound' },
  { icon: 'ri-stack-line', label: 'Rendering' },
  { icon: 'ri-send-plane-line', label: 'Distribution' },
];

const frames = [
  {
    src: '/readdy-v90/film-frame-01.jpg',
    code: 'SC-01 // TERMINUS',
    title: 'The Long March',
  },
  {
    src: '/readdy-v90/film-frame-02.jpg',
    code: 'SC-02 // RELIC',
    title: 'The Vault',
  },
  {
    src: '/readdy-v90/film-frame-03.jpg',
    code: 'SC-03 // DISTRICT',
    title: 'After Rain',
  },
  {
    src: '/readdy-v90/film-frame-04.jpg',
    code: 'SC-04 // ABYSS',
    title: 'The Needle',
  },
  {
    src: '/readdy-v90/film-frame-05.jpg',
    code: 'SC-05 // SIGNAL',
    title: 'First Contact',
  },
  {
    src: '/readdy-v90/film-frame-06.jpg',
    code: 'SC-06 // ASCENT',
    title: 'The Crossing',
  },
];

export default function Films() {
  return (
    <section id="films" className="relative overflow-hidden bg-background-50/50 py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,155,255,0.08),transparent_50%)]"></div>
      <div className="relative mx-auto max-w-[1680px] px-5 md:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Reveal>
            <SectionHeader
              index="03"
              label="AI Films"
              title="Stories Generated at the Speed of Imagination."
              copy="A complete cinematic pipeline — story, character continuity, scene generation, sound, rendering, and distribution — inside one production environment."
            />
          </Reveal>
          <Reveal delay={120}>
            <a
              href="/ai-films"
              className="btn-primary group inline-flex min-h-12 items-center gap-2.5 rounded-md px-6 text-sm font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              Enter AI Films
              <i className="ri-arrow-right-line transition-transform duration-300 group-hover:translate-x-1"></i>
            </a>
          </Reveal>
        </div>

        {/* Widescreen production frame */}
        <Reveal delay={80}>
          <div className="glass mt-16 overflow-hidden rounded-lg">
            {/* production chrome */}
            <div className="flex items-center justify-between border-b border-foreground-200/10 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-foreground-300/50"></span>
                <span className="h-2.5 w-2.5 rounded-full bg-primary-500"></span>
                <span className="h-2.5 w-2.5 rounded-full bg-accent-500/70"></span>
                <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground-300/70">
                  D3VONN Film Studio
                </span>
              </div>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-foreground-300/70 sm:block">
                REC // 24 FPS // 2.39:1
              </span>
            </div>

            <div className="relative aspect-video w-full overflow-hidden bg-background-200">
              <img
                src="/readdy-v90/films-hero-frame.jpg"
                alt="D3VONN film studio cinematic frame"
                title="D3VONN AI Films cinematic frame"
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
              {/* letterbox bars */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-background-50/60"></div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-background-50/60"></div>
              {/* timecode + metadata */}
              <div className="absolute left-5 top-12 font-mono text-[10px] uppercase tracking-[0.2em] text-background-50/80">
                TC 00:01:42:08
              </div>
              <div className="absolute bottom-12 right-5 font-mono text-[10px] uppercase tracking-[0.2em] text-background-50/80">
                SEQ. 07 — THE SIGNAL RISES
              </div>
            </div>

            {/* workflow strip */}
            <div className="grid grid-cols-2 border-t border-foreground-200/10 sm:grid-cols-3 lg:grid-cols-6">
              {workflow.map((w, i) => (
                <div
                  key={w.label}
                  className={`flex items-center gap-3 px-6 py-5 ${
                    i !== workflow.length - 1 ? 'border-r border-foreground-200/10' : ''
                  }`}
                >
                  <i className={`${w.icon} text-base text-primary-400`}></i>
                  <span className="text-xs text-foreground-200 font-medium whitespace-nowrap">{w.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Horizontal scrolling frames with custom scrollbar */}
        <Reveal delay={120}>
          <div className="film-scroll mt-12 flex gap-6 overflow-x-auto pb-4">
            {frames.map((f) => (
              <div
                key={f.code}
                className="group relative w-[300px] shrink-0 overflow-hidden rounded-md border border-foreground-200/10 bg-background-100 transition-all duration-300 hover:border-primary-500/40 hover:shadow-[0_0_28px_rgba(59,155,255,0.22)] md:w-[380px]"
              >
                <div className="relative aspect-video w-full overflow-hidden">
                  <img
                    src={f.src}
                    alt={`${f.title} cinematic film frame`}
                    title={`${f.title} D3VONN AI Films`}
                    className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background-50/80 via-transparent to-transparent"></div>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary-400">
                      {f.code}
                    </div>
                    <div className="mt-1 font-heading text-base font-bold text-foreground-900">
                      {f.title}
                    </div>
                  </div>
                  <i className="ri-play-line text-foreground-200 transition-colors group-hover:text-primary-400"></i>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}