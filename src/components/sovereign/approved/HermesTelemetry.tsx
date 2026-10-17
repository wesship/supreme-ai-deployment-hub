import type { HomepageTelemetry } from '@/lib/homepageTelemetry';

export default function HermesTelemetry({ telemetry }: { telemetry: HomepageTelemetry }) {
  const live = telemetry.source === 'live';
  const stats = [
    { label: 'Active agents', value: telemetry.activeAgents },
    { label: 'Active goals', value: telemetry.activeGoals },
    { label: 'Tasks completed', value: telemetry.tasksCompleted },
    { label: 'Tasks running', value: telemetry.tasksRunning },
    { label: 'Hermes queue', value: telemetry.hermesQueue },
  ];

  return (
    <section aria-labelledby="hermes-telemetry-title" className="relative py-10 md:py-14">
      <div className="mx-auto max-w-[1680px] px-5 md:px-8">
        <div className="glass rounded-lg p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="hermes-telemetry-title" className="font-mono text-[11px] uppercase tracking-[0.25em] text-foreground-300">
              Hermes telemetry
            </h2>
            <span
              data-testid="telemetry-source"
              className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${
                live ? 'border-accent-500/40 text-accent-400' : 'border-foreground-200/30 text-foreground-300'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-accent-500 animate-pulse' : 'bg-foreground-300'}`} />
              {live ? 'Live Hermes data' : 'Demo data — live stats unavailable'}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((s) => (
              <div key={s.label} className="rounded-md border border-foreground-200/10 p-4">
                <dt className="text-xs text-foreground-300">{s.label}</dt>
                <dd className="mt-1 font-heading text-2xl font-semibold text-foreground-900">{s.value}</dd>
              </div>
            ))}
          </dl>
          {live && telemetry.lastActivityAt && (
            <p className="mt-3 font-mono text-[10px] text-foreground-300">
              Last activity {new Date(telemetry.lastActivityAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
