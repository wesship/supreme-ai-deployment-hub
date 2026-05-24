import type { OperatorLogs } from '../operatorApi';

export function LiveLogsPanel({ logs }: { logs: OperatorLogs }) {
  return (
    <div className="operator-card wide">
      <div className="operator-label">Live Logs</div>
      <div className="operator-value operator-cyan">{logs.source}</div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10, maxHeight: 320, overflow: 'auto' }}>
        {logs.entries.length === 0 ? (
          <div className="operator-pill">No Loki log entries available yet.</div>
        ) : (
          logs.entries.slice(0, 12).map((entry, index) => (
            <div key={`${entry.timestampNs ?? index}`} className="operator-pill">
              <div style={{ color: 'var(--operator-muted)', fontSize: '0.8rem' }}>
                {entry.timestampNs ?? 'no timestamp'}
              </div>
              <div style={{ marginTop: 6, lineHeight: 1.5 }}>{entry.line ?? 'empty log line'}</div>
              {entry.labels ? (
                <div style={{ marginTop: 6, color: 'var(--operator-muted)', fontSize: '0.75rem' }}>
                  {Object.entries(entry.labels)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(' • ')}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default LiveLogsPanel;
