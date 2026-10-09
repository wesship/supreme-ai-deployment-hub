import { useNavigate } from 'react-router-dom';
import Reveal from './Reveal';
import SectionHeader from './SectionHeader';

type VoiceState = 'ready' | 'listening' | 'thinking' | 'responding';

const stateMeta: Record<VoiceState, { label: string; tone: string }> = {
  ready: { label: 'Ready', tone: 'text-foreground-200' },
  listening: { label: 'Listening', tone: 'text-accent-400' },
  thinking: { label: 'Thinking', tone: 'text-primary-400' },
  responding: { label: 'Responding', tone: 'text-accent-400' },
};

const bars = Array.from({ length: 48 });

export default function Voice() {
  const navigate = useNavigate();
  const state: VoiceState = 'ready';
  const transcript = '';
  const showHint = true;

  const active = false;
  const meta = stateMeta[state];

  return (
    <section id="voice" className="relative overflow-hidden bg-background-50/50 py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(98,230,255,0.05),transparent_50%)]"></div>
      <div className="relative mx-auto max-w-[1680px] px-5 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Copy */}
          <Reveal>
            <SectionHeader
              index="05"
              label="Voice & Interaction"
              title="Speak to the System."
              copy="A dimensional signal aperture that listens, thinks, and responds. Voice is a first-class control — but never the only one. Text and keyboard remain fully available."
            />

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { icon: 'ri-mic-line', label: 'Hands-free command' },
                { icon: 'ri-keyboard-line', label: 'Text fallback' },
                { icon: 'ri-speaker-line', label: 'Natural response' },
              ].map((f) => (
                <div
                  key={f.label}
                  className="rounded-md border border-foreground-200/10 bg-background-100/60 p-4 text-center"
                >
                  <i className={`${f.icon} text-lg text-primary-400`}></i>
                  <p className="mt-2 text-xs text-foreground-200 font-medium">{f.label}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Voice interface */}
          <Reveal delay={100}>
            <div className="relative mx-auto max-w-md">
              <div className="glass rounded-lg p-8 text-center">
                {/* signal aperture */}
                <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
                  <span className="absolute inset-0 rounded-full border border-foreground-200/10"></span>
                  <span
                    className={`absolute inset-3 rounded-full border transition-all duration-700 ${
                      active ? 'border-accent-500/50' : 'border-foreground-200/10'
                    }`}
                  ></span>
                  <span
                    className={`absolute inset-6 rounded-full border transition-all duration-700 ${
                      'border-foreground-200/10'
                    }`}
                  ></span>
                  <button
                    onClick={() => navigate('/voice-studio')}
                    className={`relative flex h-16 w-16 items-center justify-center rounded-full border transition-all duration-500 cursor-pointer ${
                      active
                        ? 'border-accent-500 bg-accent-500/15 shadow-[0_0_40px_rgba(98,230,255,0.35)]'
                        : 'border-foreground-200/25 bg-background-200/60 hover:border-accent-500/50'
                    }`}
                    aria-label={active ? 'Stop listening' : 'Start voice input'}
                  >
                    <i className={`${active ? 'ri-mic-fill' : 'ri-mic-line'} text-xl ${active ? 'text-accent-400' : 'text-foreground-200'}`}></i>
                  </button>
                  {/* Tap hint */}
                  {showHint && (
                    <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-300/60 animate-pulse">
                      Tap to try
                    </span>
                  )}
                </div>

                {/* status */}
                <p className={`mt-10 font-mono text-[11px] uppercase tracking-[0.24em] ${meta.tone}`}>
                  {meta.label}
                </p>

                {/* waveform */}
                <div className="mt-5 flex h-10 items-center justify-center gap-[3px]">
                  {bars.map((_, i) => (
                    <span
                      key={i}
                      className={`w-[3px] rounded-full ${
                        active ? 'bg-accent-500/60' : 'bg-foreground-300/30'
                      }`}
                      style={{
                        height: '100%',
                        transformOrigin: 'center',
                        animation: active
                          ? `approved-waveform ${0.7 + (i % 7) * 0.08}s ease-in-out ${(i % 5) * 0.06}s infinite`
                          : 'none',
                        transform: active ? undefined : 'scaleY(0.15)',
                      }}
                    ></span>
                  ))}
                </div>

                {/* transcript */}
                <div
                  className="mt-5 min-h-[3rem] rounded-md border border-foreground-200/10 bg-background-50 px-4 py-3 text-sm text-foreground-200 font-medium"
                  aria-live="polite"
                >
                  {transcript || 'Awaiting input…'}
                </div>

                {/* controls */}
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    onClick={() => navigate('/voice-studio')}
                    className="inline-flex min-h-10 items-center gap-2 rounded-md border border-foreground-200/20 px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-200 transition-colors hover:border-foreground-200/40 hover:text-foreground-900 cursor-pointer whitespace-nowrap"
                  >
                    Open Voice Studio
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}