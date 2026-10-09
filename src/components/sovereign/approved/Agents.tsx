import { useEffect, useState } from 'react';
import Reveal from './Reveal';
import SectionHeader from './SectionHeader';

const agents = [
  { name: 'Orion', role: 'Orchestrator', status: 'Supervising', tone: 'accent', icon: 'ri-radar-line', live: true },
  { name: 'Scribe', role: 'Research', status: 'Running', tone: 'primary', icon: 'ri-book-open-line', live: true },
  { name: 'Atlas', role: 'Data Ops', status: 'Idle', tone: 'foreground', icon: 'ri-database-2-line', live: false },
  { name: 'Echo', role: 'Voice', status: 'Standby', tone: 'primary', icon: 'ri-voiceprint-line', live: false },
];

const initialTasks = [
  { label: 'Summarize market brief', state: 'Complete', icon: 'ri-check-line', tone: 'accent', live: false },
  { label: 'Draft release notes', state: 'Running', icon: 'ri-loader-4-line', tone: 'primary', live: true },
  { label: 'Generate film treatment', state: 'Queued', icon: 'ri-time-line', tone: 'foreground', live: false },
];

const initialTools = [
  { label: 'web_search', state: 'done' },
  { label: 'doc_reader', state: 'running' },
  { label: 'render_engine', state: 'queued' },
];

const statusTone = (tone: string) =>
  tone === 'accent'
    ? 'text-accent-400'
    : tone === 'primary'
      ? 'text-primary-400'
      : 'text-foreground-200';

export default function Agents() {
  const [tasks, setTasks] = useState(initialTasks);
  const [tools, setTools] = useState(initialTools);

  useEffect(() => {
    let cancelled = false;
    let timers: number[] = [];

    const runCycle = () => {
      if (cancelled) return;
      setTasks(initialTasks);
      setTools(initialTools);

      timers = [
        window.setTimeout(() => {
          if (cancelled) return;
          setTasks((prev) =>
            prev.map((t) =>
              t.label === 'Generate film treatment'
                ? { ...t, state: 'Running', icon: 'ri-loader-4-line', tone: 'primary', live: true }
                : t,
            ),
          );
          setTools((prev) =>
            prev.map((tool) => (tool.label === 'render_engine' ? { ...tool, state: 'running' } : tool)),
          );
        }, 3500),
        window.setTimeout(() => {
          if (cancelled) return;
          setTasks((prev) =>
            prev.map((t) =>
              t.label === 'Draft release notes'
                ? { ...t, state: 'Complete', icon: 'ri-check-line', tone: 'accent', live: false }
                : t,
            ),
          );
          setTools((prev) =>
            prev.map((tool) => (tool.label === 'doc_reader' ? { ...tool, state: 'done' } : tool)),
          );
        }, 6500),
        window.setTimeout(() => {
          if (cancelled) return;
          setTasks((prev) =>
            prev.map((t) =>
              t.label === 'Generate film treatment'
                ? { ...t, state: 'Complete', icon: 'ri-check-line', tone: 'accent', live: false }
                : t,
            ),
          );
          setTools((prev) =>
            prev.map((tool) => (tool.label === 'render_engine' ? { ...tool, state: 'done' } : tool)),
          );
        }, 9500),
        window.setTimeout(() => {
          runCycle();
        }, 15000),
      ];
    };

    runCycle();
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <section id="agents" className="relative overflow-hidden bg-background-100/50 py-24 md:py-32">
      <div className="contour pointer-events-none absolute inset-0"></div>
      <div className="relative mx-auto max-w-[1680px] px-5 md:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Reveal>
            <SectionHeader
              index="02"
              label="AI Agents"
              title="Intelligence Built to Act."
              copy="Controlled autonomy with observability and human command. Agents execute tasks, but every consequential action passes through a human checkpoint."
            />
          </Reveal>
          <Reveal delay={120}>
            <a
              href="/agents"
              className="btn-ghost inline-flex min-h-12 items-center gap-2.5 rounded-md px-6 text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              Explore AI Agents
              <i className="ri-arrow-right-line"></i>
            </a>
          </Reveal>
        </div>

        {/* Orchestration interface */}
        <Reveal delay={80}>
          <div className="glass mt-14 overflow-hidden rounded-lg">
            {/* panel header */}
            <div className="flex items-center justify-between border-b border-foreground-200/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-2 w-2 items-center justify-center">
                  <span className="h-2 w-2 animate-pulse-glow rounded-full bg-accent-500 shadow-[0_0_8px_rgba(98,230,255,0.7)]"></span>
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-200">
                  Agent Orchestration Console
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground-300/70">
                Runtime // Active
              </span>
            </div>

            <div className="grid lg:grid-cols-[0.9fr_1.1fr_1fr]">
              {/* Agent identities */}
              <div className="border-b border-foreground-200/10 lg:border-b-0 lg:border-r">
                <p className="px-6 pt-6 pb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-foreground-300/70">
                  Agent identities
                </p>
                <div className="px-4 pb-6">
                  {agents.map((a) => (
                    <div
                      key={a.name}
                      tabIndex={0}
                      className="group flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-background-200/60 focus-visible:bg-background-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50 cursor-pointer"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-foreground-200/10 bg-background-200/60">
                        <i className={`${a.icon} text-base text-primary-400`}></i>
                      </span>
                      <div className="flex-1">
                        <div className="font-heading text-sm font-bold text-foreground-900">{a.name}</div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-foreground-300/70">
                          {a.role}
                        </div>
                      </div>
                      <span className="flex items-center gap-1.5">
                        {a.live && (
                          <span className="relative flex h-1.5 w-1.5 items-center justify-center">
                            <span className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-primary-400/60"></span>
                            <span
                              className={`relative h-1.5 w-1.5 rounded-full ${
                                a.tone === 'accent' ? 'bg-accent-400' : 'bg-primary-400'
                              }`}
                            ></span>
                          </span>
                        )}
                        <span className={`font-mono text-[9px] uppercase tracking-[0.12em] ${statusTone(a.tone)}`}>
                          {a.status}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tasks */}
              <div className="border-b border-foreground-200/10 lg:border-b-0 lg:border-r">
                <p className="px-6 pt-6 pb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-foreground-300/70">
                  Task queue
                </p>
                <div className="px-4 pb-6">
                  {tasks.map((t) => (
                    <div
                      key={t.label}
                      tabIndex={0}
                      className="group flex flex-col rounded-md px-2 py-3 transition-colors hover:bg-background-200/60 focus-visible:bg-background-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                            t.tone === 'accent'
                              ? 'border-accent-500/30 text-accent-400'
                              : t.tone === 'primary'
                                ? 'border-primary-500/30 text-primary-400'
                                : 'border-foreground-200/20 text-foreground-200'
                          }`}
                        >
                          <i className={`${t.icon} text-xs ${t.live ? 'animate-spin' : ''}`}></i>
                        </span>
                        <span className="flex-1 text-sm text-foreground-200 font-medium">{t.label}</span>
                        <span aria-live="polite" className="font-mono text-[9px] uppercase tracking-[0.12em] text-foreground-300/70">
                          {t.state}
                        </span>
                      </div>
                      {t.live && (
                        <div className="mt-2.5 ml-9 h-1 overflow-hidden rounded-full bg-background-200/70">
                          <div className="task-progress h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tool activity + memory + approval */}
              <div>
                <p className="px-6 pt-6 pb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-foreground-300/70">
                  Tool activity
                </p>
                <div className="space-y-2 px-6 pb-4">
                  {tools.map((t) => (
                    <div key={t.label} className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-foreground-200 font-medium">/ {t.label}</span>
                      <span aria-live="polite">
                        {t.state === 'running' ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-accent-400">running</span>
                            <span className="flex gap-0.5" aria-hidden="true">
                              <span className="dot-bounce h-1 w-1 rounded-full bg-accent-400"></span>
                              <span
                                className="dot-bounce h-1 w-1 rounded-full bg-accent-400"
                                style={{ animationDelay: '150ms' }}
                              ></span>
                              <span
                                className="dot-bounce h-1 w-1 rounded-full bg-accent-400"
                                style={{ animationDelay: '300ms' }}
                              ></span>
                            </span>
                          </span>
                        ) : (
                          <span
                            className={
                              t.state === 'done'
                                ? 'text-primary-400'
                                : 'text-foreground-300/70'
                            }
                          >
                            {t.state}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mx-6 border-t border-foreground-200/10 pt-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-foreground-300/70">
                    Memory state
                  </p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background-200">
                    <div className="memory-bar h-full w-[72%] rounded-full"></div>
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-foreground-300/70">
                    Context retained // human-verified
                  </p>
                </div>

                <div className="m-6 rounded-md border border-primary-500/30 bg-primary-500/[0.06] p-4">
                  <div className="flex items-center gap-2">
                    <i className="ri-shield-check-line text-primary-400"></i>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary-300">
                      Human approval checkpoint
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-foreground-200 font-medium">
                    1 action requires your sign-off before execution.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}