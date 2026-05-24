type Queue = {
  name: string;
  depth: number;
  status: string;
};

export function QueueActivityPanel({ queues }: { queues: Queue[] }) {
  return (
    <div className="operator-card wide">
      <div className="operator-label">Queue Activity</div>
      <div className="operator-value operator-green">Stable</div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
        {queues.map((queue) => (
          <div key={queue.name} className="operator-pill">
            <div style={{ fontWeight: 700 }}>{queue.name}</div>
            <div style={{ marginTop: 6 }}>
              Depth: {queue.depth} • {queue.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default QueueActivityPanel;
