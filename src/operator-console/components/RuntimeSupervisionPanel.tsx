import { useEffect, useState } from 'react';

import { operatorAuthHeaders } from '../operatorSession';

type RuntimeAnomaly = {
  severity: string;
  surface: string;
  message: string;
  recommendation: string;
};

type RuntimeSupervision = {
  timestamp: string;
  state: string;
  anomalies: RuntimeAnomaly[];
  summary: {
    totalAnomalies: number;
    critical: number;
    degraded: number;
    elevated: number;
    unknown: number;
  };
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const fallbackSupervision: RuntimeSupervision = {
  timestamp: new Date(0).toISOString(),
  state: 'unknown',
  anomalies: [],
  summary: {
    totalAnomalies: 0,
    critical: 0,
    degraded: 0,
    elevated: 0,
    unknown: 0,
  },
};

async function fetchSupervision(): Promise<RuntimeSupervision> {
  try {
    const response = await fetch(`${API_BASE}/api/operator/supervision`, {
      headers: {
        Accept: 'application/json',
        ...operatorAuthHeaders(),
      },
    });

    if (!response.ok) return fallbackSupervision;
    return (await response.json()) as RuntimeSupervision;
  } catch {
    return fallbackSupervision;
  }
}

function stateClass(state: string) {
  if (state === 'healthy') return 'operator-value operator-green';
  return 'operator-value operator-cyan';
}

export function RuntimeSupervisionPanel() {
  const [supervision, setSupervision] = useState<RuntimeSupervision>(fallbackSupervision);

  useEffect(() => {
    async function load() {
      setSupervision(await fetchSupervision());
    }

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="operator-card wide">
      <div className="operator-label">Autonomous Runtime Supervision</div>
      <div className={stateClass(supervision.state)}>{supervision.state}</div>

      <div style={{ marginTop: 10, color: 'var(--operator-muted)' }}>
        Anomalies: {supervision.summary.totalAnomalies} • Critical: {supervision.summary.critical} •
        Degraded: {supervision.summary.degraded} • Elevated: {supervision.summary.elevated}
      </div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10, maxHeight: 360, overflow: 'auto' }}>
        {supervision.anomalies.length === 0 ? (
          <div className="operator-pill">No runtime anomalies currently visible.</div>
        ) : (
          supervision.anomalies.slice(0, 12).map((item, index) => (
            <div key={`${item.surface}-${item.severity}-${index}`} className="operator-pill">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>{item.surface}</strong>
                <span style={{ color: 'var(--operator-muted)' }}>{item.severity}</span>
              </div>
              <div style={{ marginTop: 6 }}>{item.message}</div>
              <div style={{ marginTop: 8, color: 'var(--operator-muted)', lineHeight: 1.5 }}>
                Recommendation: {item.recommendation}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 14, color: 'var(--operator-muted)', fontSize: '0.8rem' }}>
        Last supervision update: {supervision.timestamp}
      </div>
    </div>
  );
}

export default RuntimeSupervisionPanel;
