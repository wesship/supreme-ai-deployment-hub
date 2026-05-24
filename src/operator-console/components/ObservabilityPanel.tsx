import type { OperatorMetrics } from '../operatorApi';

type Metric = {
  name: string;
  value: number;
  unit: string;
  status: string;
};

type ObservabilityPanelProps = {
  metrics: OperatorMetrics | Metric[];
};

function prometheusSignalCount(metrics: OperatorMetrics) {
  return Object.values(metrics.prometheus?.results ?? {}).filter(
    (result) => result.configured && result.status === 'success',
  ).length;
}

export function ObservabilityPanel({ metrics }: ObservabilityPanelProps) {
  const metricList = Array.isArray(metrics) ? metrics : metrics.series ?? [];
  const prometheusConfigured = Array.isArray(metrics)
    ? false
    : Boolean(metrics.prometheus?.configured);
  const signalCount = Array.isArray(metrics) ? 0 : prometheusSignalCount(metrics);
  const integrationStatus = Array.isArray(metrics)
    ? 'legacy'
    : metrics.integrationStatus ?? 'unknown';

  return (
    <div className="operator-card wide">
      <div className="operator-label">Prometheus Metrics</div>
      <div className={prometheusConfigured ? 'operator-value operator-green' : 'operator-value operator-cyan'}>
        {prometheusConfigured ? 'Live Adapter' : 'Waiting'}
      </div>

      <div style={{ marginTop: 10, color: 'var(--operator-muted)' }}>
        Integration: {integrationStatus} • Signals: {signalCount}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
          marginTop: 18,
        }}
      >
        {metricList.length === 0 ? (
          <div className="operator-pill">No metric series available yet.</div>
        ) : (
          metricList.map((metric) => (
            <div key={metric.name} className="operator-pill">
              <div style={{ fontWeight: 700 }}>{metric.name}</div>

              <div style={{ marginTop: 6 }}>
                {metric.value} {metric.unit}
              </div>

              <div
                style={{
                  marginTop: 4,
                  color: 'var(--operator-muted)',
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                }}
              >
                {metric.status}
              </div>
            </div>
          ))
        )}
      </div>

      {!Array.isArray(metrics) && metrics.prometheus?.results ? (
        <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
          {Object.entries(metrics.prometheus.results).map(([name, result]) => (
            <div key={name} className="operator-pill">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>{name}</strong>
                <span style={{ color: 'var(--operator-muted)' }}>{result.status ?? 'unknown'}</span>
              </div>
              <div style={{ marginTop: 6, color: 'var(--operator-muted)' }}>
                Configured: {result.configured ? 'yes' : 'no'} • Samples: {result.data?.length ?? 0}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ObservabilityPanel;
