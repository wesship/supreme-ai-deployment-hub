import type { OperatorCI } from '../operatorApi';

function conclusionLabel(value: unknown) {
  if (!value) return 'running';
  return String(value);
}

export function CIWorkflowActivityPanel({ ci }: { ci: OperatorCI }) {
  const runs = ci.githubActions?.runs ?? [];
  const summary = ci.githubActions?.summary ?? { total: 0, failures: 0, healthy: false };
  const configured = ci.githubActions?.configured ?? false;

  return (
    <div className="operator-card wide">
      <div className="operator-label">CI Workflow Activity</div>
      <div className={summary.healthy ? 'operator-value operator-green' : 'operator-value operator-cyan'}>
        {summary.healthy ? 'Healthy' : 'Observing'}
      </div>

      <div style={{ marginTop: 10, color: 'var(--operator-muted)' }}>
        GitHub: {configured ? 'connected' : 'not connected'} • Runs: {summary.total ?? 0} • Failures:{' '}
        {summary.failures ?? 0}
      </div>

      <div style={{ marginTop: 18, display: 'grid', gap: 10, maxHeight: 340, overflow: 'auto' }}>
        {runs.length === 0 ? (
          <div className="operator-pill">No GitHub Actions workflow runs available yet.</div>
        ) : (
          runs.slice(0, 10).map((run, index) => (
            <div key={`${String(run.id ?? index)}`} className="operator-pill">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong>{String(run.name ?? 'workflow')}</strong>
                <span style={{ color: 'var(--operator-muted)' }}>
                  {conclusionLabel(run.conclusion)}
                </span>
              </div>

              <div style={{ marginTop: 6 }}>
                {String(run.status ?? 'unknown')} • {String(run.branch ?? 'branch unknown')} •{' '}
                {String(run.event ?? 'event unknown')}
              </div>

              <div style={{ marginTop: 6, color: 'var(--operator-muted)', fontSize: '0.75rem' }}>
                Updated: {String(run.updatedAt ?? 'unknown')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default CIWorkflowActivityPanel;
