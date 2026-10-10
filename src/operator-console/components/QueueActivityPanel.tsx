import type { OperatorQueues } from '../operatorApi';

type Queue = {
  name: string;
  depth: number;
  status: string;
};

function queuePressure(depth: number) {
  if (depth >= 100) return 'critical';
  if (depth >= 25) return 'elevated';
  if (depth > 0) return 'active';
  return 'idle';
}

function pressureBarWidth(depth: number) {
  return `${Math.min(100, Math.max(4, depth))}%`;
}

export function QueueActivityPanel({ queues }: { queues: OperatorQueues | Queue[] }) {
  const queueList = Array.isArray(queues) ? queues : queues.queues;
  const redisReady = Array.isArray(queues) ? undefined : queues.redisReady;
  const totalDepth = queueList.reduce((total, queue) => total + queue.depth, 0);
  const hasBacklog = queueList.some((queue) => queue.depth >= 25 || queue.status === 'backlog');

  return (
    <div className="operator-card wide">
      <div className="operator-label">Queue Activity</div>
      <div className={hasBacklog ? 'operator-value' : 'operator-value operator-green'}>
        {hasBacklog ? 'Backlog Watch' : 'Stable'}
      </div>

      <div style={{ marginTop: 10, color: 'var(--operator-muted)' }}>
        Redis: {redisReady ? 'connected' : 'not connected'} • Total depth: {totalDepth}
      </div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
        {queueList.length === 0 ? (
          <div className="operator-pill">No queue telemetry available yet.</div>
        ) : (
          queueList.map((queue) => {
            const pressure = queuePressure(queue.depth);
            return (
              <div key={queue.name} className="operator-pill">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{queue.name}</div>
                  <div style={{ color: 'var(--operator-muted)' }}>{pressure}</div>
                </div>

                <div style={{ marginTop: 6 }}>
                  Depth: {queue.depth} • {queue.status}
                </div>

                <div
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 999,
                    height: 8,
                    marginTop: 10,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(66, 255, 190, 0.75)',
                      borderRadius: 999,
                      height: '100%',
                      width: pressureBarWidth(queue.depth),
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default QueueActivityPanel;
