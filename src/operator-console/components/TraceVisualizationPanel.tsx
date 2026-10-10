import type { OperatorTraces } from '../operatorApi';

export function TraceVisualizationPanel({ traces }: { traces: OperatorTraces }) {
  return (
    <div className="operator-card wide">
      <div className="operator-label">Distributed Traces</div>
      <div className="operator-value operator-cyan">{traces.source}</div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10, maxHeight: 320, overflow: 'auto' }}>
        {traces.spans.length === 0 ? (
          <div className="operator-pill">No Tempo or Jaeger trace spans available yet.</div>
        ) : (
          traces.spans.slice(0, 12).map((span, index) => (
            <div key={`${span.traceId ?? span.name ?? index}`} className="operator-pill">
              <div style={{ fontWeight: 700 }}>{span.name ?? 'trace'}</div>
              <div style={{ marginTop: 6 }}>
                Duration: {span.durationMs ?? 0} ms • {span.status ?? 'observed'}
              </div>
              <div style={{ marginTop: 6, color: 'var(--operator-muted)', fontSize: '0.75rem' }}>
                Trace ID: {span.traceId ?? 'unavailable'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TraceVisualizationPanel;
