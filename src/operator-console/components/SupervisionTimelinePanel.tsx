import { useEffect, useState } from 'react';

import { operatorAuthHeaders } from '../operatorSession';

type SupervisionTimelineEvent = {
  timestamp: string;
  type: string;
  surface: string;
  severity: string;
  message: string;
  recommendation: string;
};

type SupervisionTimeline = {
  timestamp: string;
  source: string;
  state: string;
  events: SupervisionTimelineEvent[];
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const fallbackTimeline: SupervisionTimeline = {
  timestamp: new Date(0).toISOString(),
  source: 'fallback',
  state: 'unknown',
  events: [],
};

async function fetchTimeline(): Promise<SupervisionTimeline> {
  try {
    const response = await fetch(`${API_BASE}/api/operator/supervision/timeline`, {
      headers: {
        Accept: 'application/json',
        ...operatorAuthHeaders(),
      },
    });

    if (!response.ok) return fallbackTimeline;
    return (await response.json()) as SupervisionTimeline;
  } catch {
    return fallbackTimeline;
  }
}

export function SupervisionTimelinePanel() {
  const [timeline, setTimeline] = useState<SupervisionTimeline>(fallbackTimeline);

  useEffect(() => {
    async function load() {
      setTimeline(await fetchTimeline());
    }

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="operator-card wide">
      <div className="operator-label">Supervision Timeline</div>
      <div className="operator-value operator-cyan">{timeline.state}</div>

      <div style={{ marginTop: 10, color: 'var(--operator-muted)' }}>
        Source: {timeline.source} • Events: {timeline.events.length}
      </div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10, maxHeight: 360, overflow: 'auto' }}>
        {timeline.events.length === 0 ? (
          <div className="operator-pill">No supervision timeline events available yet.</div>
        ) : (
          timeline.events.slice(0, 16).map((event, index) => (
            <div key={`${event.timestamp}-${event.type}-${index}`} className="operator-pill">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>{event.type}</strong>
                <span style={{ color: 'var(--operator-muted)' }}>{event.severity}</span>
              </div>
              <div style={{ marginTop: 6 }}>
                {event.surface}: {event.message}
              </div>
              <div style={{ marginTop: 8, color: 'var(--operator-muted)', lineHeight: 1.5 }}>
                Recommendation: {event.recommendation}
              </div>
              <div style={{ marginTop: 8, color: 'var(--operator-muted)', fontSize: '0.75rem' }}>
                {event.timestamp}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 14, color: 'var(--operator-muted)', fontSize: '0.8rem' }}>
        Last timeline refresh: {timeline.timestamp}
      </div>
    </div>
  );
}

export default SupervisionTimelinePanel;
