import useOperatorRuntimeStream from '../useOperatorRuntimeStream';

export function RuntimeStreamPanel() {
  const { connected, events } = useOperatorRuntimeStream();

  return (
    <div className="operator-card wide">
      <div className="operator-label">Runtime Stream</div>

      <div
        className={`operator-value ${connected ? 'operator-green' : 'operator-cyan'}`}
      >
        {connected ? 'Live' : 'Disconnected'}
      </div>

      <div
        style={{
          marginTop: 18,
          display: 'grid',
          gap: 10,
          maxHeight: 260,
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
              <div style={{ fontWeight: 600 }}>
                {event.surface ?? event.type}
              </div>

              <div style={{ color: 'var(--operator-muted)', marginTop: 4 }}>
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
