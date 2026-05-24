import useOperatorRuntimeStream from '../useOperatorRuntimeStream';

function surfaceLabel(surface?: string, type?: string) {
  return surface ?? type ?? 'runtime';
}

export function RuntimeStreamPanel() {
  const { connected, events } = useOperatorRuntimeStream();
  const latest = events[0];
  const uniqueSurfaces = new Set(events.map((event) => surfaceLabel(event.surface, event.type))).size;

  return (
    <div className="operator-card wide">
      <div className="operator-label">Runtime Event Stream</div>

      <div
        className={`operator-value ${connected ? 'operator-green' : 'operator-cyan'}`}
      >
        {connected ? 'Live' : 'Disconnected'}
      </div>

      <div style={{ marginTop: 10, color: 'var(--operator-muted)' }}>
        Events: {events.length} • Surfaces: {uniqueSurfaces} • Latest:{' '}
        {latest ? surfaceLabel(latest.surface, latest.type) : 'waiting'}
      </div>

      <div
        style={{
          marginTop: 18,
          display: 'grid',
          gap: 10,
          maxHeight: 320,
          overflow: 'auto',
        }}
      >
        {events.length === 0 ? (
          <div className="operator-pill">
            Waiting for runtime events…
          </div>
        ) : (
          events.map((event, index) => (
            <div key={`${event.timestamp}-${index}`} className="operator-pill">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontWeight: 700 }}>
                  {surfaceLabel(event.surface, event.type)}
                </div>
                <div style={{ color: 'var(--operator-muted)' }}>
                  {event.status ?? event.severity ?? 'observed'}
                </div>
              </div>

              <div style={{ color: 'var(--operator-muted)', marginTop: 6 }}>
                {event.message}
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: '0.8rem',
                  color: 'var(--operator-muted)',
                }}
              >
                {event.timestamp}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RuntimeStreamPanel;
