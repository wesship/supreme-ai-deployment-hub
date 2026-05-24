type Metric = {
  name: string;
  value: number;
  unit: string;
  status: string;
};

type ObservabilityPanelProps = {
  metrics: Metric[];
};

export function ObservabilityPanel({ metrics }: ObservabilityPanelProps) {
  return (
    <div className="operator-card wide">
      <div className="operator-label">Observability</div>
      <div className="operator-value operator-cyan">Monitoring</div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
          marginTop: 18,
        }}
      >
        {metrics.map((metric) => (
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
        ))}
      </div>
    </div>
  );
}

export default ObservabilityPanel;
