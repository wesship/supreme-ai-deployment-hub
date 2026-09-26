import React, { useEffect, useState } from 'react';
import { Activity, Gauge, Layers, Timer } from 'lucide-react';
import { normalizePublicStats, type HomepageTelemetry } from '@/lib/homepageTelemetry';
import { useCalmMotion } from './os-hooks';

const DEMO: HomepageTelemetry = {
  activeAgents: '128',
  workflowsToday: '4,912',
  knowledgeNodes: '86,430',
  systemStatus: 'Operational',
  hermesQueue: '7',
};

type Source = 'demo' | 'live';

const Sparkline: React.FC<{ seed: number; animate: boolean }> = ({ seed, animate }) => (
  <div className="mt-4 grid h-12 grid-cols-12 items-end gap-1" aria-hidden="true">
    {Array.from({ length: 12 }).map((_, index) => (
      <span
        key={index}
        className="rounded-sm"
        style={{
          height: `${28 + ((index * 17 + seed * 9) % 68)}%`,
          background: index % 4 === 0 ? 'var(--os-orange)' : 'var(--os-lime)',
          opacity: 0.55 + (index % 3) * 0.15,
          transition: animate ? 'height 900ms ease' : undefined,
        }}
      />
    ))}
  </div>
);

/** Operational telemetry panels. Clearly marks whether values are live or demo. */
const TelemetryPanels: React.FC = () => {
  const calm = useCalmMotion();
  const [data, setData] = useState<HomepageTelemetry>(DEMO);
  const [source, setSource] = useState<Source>('demo');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/public/stats', { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('unavailable');
        const payload = await response.json();
        setData(normalizePublicStats(payload));
        setSource('live');
      })
      .catch(() => {
        setSource('demo');
      });

    return () => controller.abort();
  }, []);

  const panels = [
    { label: 'Active agents', value: data.activeAgents, icon: Layers },
    { label: 'Workflows completed', value: data.workflowsToday, icon: Gauge },
    { label: 'Knowledge nodes', value: data.knowledgeNodes, icon: Activity },
    { label: 'Hermes queue', value: data.hermesQueue, icon: Timer },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold md:text-4xl">Operational telemetry</h2>
          <p className="mt-2 text-sm text-[color:var(--os-ink-60)] md:text-base">
            System signal from the D3VONN control plane.
          </p>
        </div>
        <span
          className="os-pill os-mono flex w-fit items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-[0.18em]"
          style={{ borderColor: source === 'live' ? 'var(--os-lime-deep)' : 'var(--os-orange)' }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: source === 'live' ? 'var(--os-lime-deep)' : 'var(--os-orange)' }}
          />
          {source === 'live' ? 'Live data' : 'Demo data — live feed unavailable'}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {panels.map(({ label, value, icon: Icon }, index) => (
          <div key={label} className="os-card p-4 md:p-5">
            <div className="flex items-center justify-between">
              <span className="os-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--os-ink-40)]">{label}</span>
              <Icon className="h-4 w-4 text-[color:var(--os-ink-40)]" aria-hidden="true" />
            </div>
            <div className="os-display mt-3 text-2xl font-bold md:text-4xl">{value}</div>
            <Sparkline seed={index} animate={!calm} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TelemetryPanels;
