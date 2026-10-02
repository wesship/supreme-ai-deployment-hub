import React, { useEffect, useState } from 'react';
import { Activity, Gauge, Layers, Timer } from 'lucide-react';
import { defaultHomepageTelemetry, normalizePublicStats, type HomepageTelemetry } from '@/lib/homepageTelemetry';

type Source = 'unavailable' | 'cached' | 'live';

/** Operational telemetry panels. Marks unavailable and cached measurements explicitly. */
const TelemetryPanels: React.FC = () => {
  const [data, setData] = useState<HomepageTelemetry>(defaultHomepageTelemetry);
  const [source, setSource] = useState<Source>('unavailable');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/public/stats', { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('unavailable');
        const payload = await response.json();
        setData(normalizePublicStats(payload));
        setSource(payload.telemetry_available === true ? (payload.cached === true ? 'cached' : 'live') : 'unavailable');
      })
      .catch(() => {
        setSource('unavailable');
      });

    return () => controller.abort();
  }, []);

  const panels = [
    { label: 'Active agents', value: data.activeAgents, icon: Layers },
    { label: 'Workflows completed', value: data.workflowsCompleted, icon: Gauge },
    { label: 'Tasks processed', value: data.tasksProcessed, icon: Activity },
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
          {source === 'live' ? 'Live data' : source === 'cached' ? 'Cached observation' : 'Live feed unavailable'}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {panels.map(({ label, value, icon: Icon }) => (
          <div key={label} className="os-card p-4 md:p-5">
            <div className="flex items-center justify-between">
              <span className="os-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--os-ink-40)]">{label}</span>
              <Icon className="h-4 w-4 text-[color:var(--os-ink-40)]" aria-hidden="true" />
            </div>
            <div className="os-display mt-3 text-2xl font-bold md:text-4xl">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TelemetryPanels;
