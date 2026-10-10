import { useEffect, useState } from 'react';

import { operatorAuthHeaders } from '../operatorSession';

type RuntimePrediction = {
  risk: string;
  likelihood: string;
  message: string;
  watch: string[];
};

type PredictionResponse = {
  timestamp: string;
  state: string;
  predictions: RuntimePrediction[];
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const fallbackPredictions: PredictionResponse = {
  timestamp: new Date(0).toISOString(),
  state: 'unknown',
  predictions: [],
};

async function fetchPredictions(): Promise<PredictionResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/operator/predictions`, {
      headers: {
        Accept: 'application/json',
        ...operatorAuthHeaders(),
      },
    });

    if (!response.ok) return fallbackPredictions;
    return (await response.json()) as PredictionResponse;
  } catch {
    return fallbackPredictions;
  }
}

function likelihoodLabel(value: string) {
  return value ? value.toUpperCase() : 'UNKNOWN';
}

export function PredictionDashboardPanel() {
  const [predictionState, setPredictionState] = useState<PredictionResponse>(fallbackPredictions);

  useEffect(() => {
    async function load() {
      setPredictionState(await fetchPredictions());
    }

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="operator-card wide">
      <div className="operator-label">Runtime Prediction Engine</div>
      <div className="operator-value operator-cyan">{predictionState.state}</div>

      <div style={{ marginTop: 10, color: 'var(--operator-muted)' }}>
        Forecasts: {predictionState.predictions.length} • Mode: advisory only
      </div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10, maxHeight: 360, overflow: 'auto' }}>
        {predictionState.predictions.length === 0 ? (
          <div className="operator-pill">No prediction output available yet.</div>
        ) : (
          predictionState.predictions.slice(0, 12).map((prediction, index) => (
            <div key={`${prediction.risk}-${index}`} className="operator-pill">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>{prediction.risk}</strong>
                <span style={{ color: 'var(--operator-muted)' }}>
                  {likelihoodLabel(prediction.likelihood)}
                </span>
              </div>

              <div style={{ marginTop: 8, lineHeight: 1.5 }}>{prediction.message}</div>

              <div style={{ marginTop: 8, color: 'var(--operator-muted)', lineHeight: 1.5 }}>
                Watch: {prediction.watch.join(' • ')}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 14, color: 'var(--operator-muted)', fontSize: '0.8rem' }}>
        Last prediction refresh: {predictionState.timestamp}
      </div>
    </div>
  );
}

export default PredictionDashboardPanel;
