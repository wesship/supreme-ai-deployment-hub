import './operator-theme.css';

const navItems = [
  'Overview',
  'CI / CD',
  'Memory Vault',
  'Connectors',
  'Deployments',
  'Governance',
  'Runtime',
  'Agents Mesh',
  'Observability',
  'Settings',
];

export function OperatorDashboard() {
  return (
    <div className="operator-shell">
      <div className="operator-rain" />
      <div className="operator-water" />

      <div className="operator-layout">
        <aside className="operator-sidebar">
          <div className="operator-brand">
            <div className="operator-logo" />
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>DEVONN.AI</div>
              <div style={{ color: 'var(--operator-muted)' }}>Operator Console</div>
            </div>
          </div>

          <nav className="operator-nav">
            {navItems.map((item, index) => (
              <div
                key={item}
                className={`operator-nav-item ${index === 0 ? 'active' : ''}`}
              >
                {item}
              </div>
            ))}
          </nav>
        </aside>

        <main className="operator-main">
          <div className="operator-topbar">
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>
                Welcome back, Operator.
              </div>
              <div style={{ color: 'var(--operator-muted)', marginTop: 8 }}>
                Unified intelligence. Persistent memory. Operational excellence.
              </div>
            </div>

            <div className="operator-pill">
              <span className="operator-green">●</span> System Online
            </div>
          </div>

          <section className="operator-grid">
            <div className="operator-card metric">
              <div className="operator-label">System Status</div>
              <div className="operator-value operator-green">Operational</div>
              <p>All critical systems healthy.</p>
            </div>

            <div className="operator-card metric">
              <div className="operator-label">Readiness Score</div>
              <div className="operator-value operator-cyan">98.7%</div>
              <p>Production-ready stabilization state.</p>
            </div>

            <div className="operator-card metric">
              <div className="operator-label">Active Surfaces</div>
              <div className="operator-value">12</div>
              <p>Operational services online.</p>
            </div>

            <div className="operator-card metric">
              <div className="operator-label">Memory Vault</div>
              <div className="operator-value">128</div>
              <p>Operational exports available.</p>
            </div>

            <div className="operator-card wide">
              <div className="operator-label">CI / CD Health</div>
              <div className="operator-value">7 / 7</div>
              <p>Production gates stabilized and green.</p>
              <button className="operator-button">View CI Report</button>
            </div>

            <div className="operator-card wide">
              <div className="operator-label">Deployment Topology</div>
              <div className="operator-value operator-cyan">Staging Ready</div>
              <p>Frontend stabilized. API and observability queued.</p>
              <button className="operator-button">View Deployment Details</button>
            </div>

            <div className="operator-card large">
              <div className="operator-label">Connector Inventory</div>
              <div className="operator-value">Production</div>
              <p>GitHub, AWS, Vercel, Supabase, n8n.</p>
              <button className="operator-button">View Connectors</button>
            </div>

            <div className="operator-card large">
              <div className="operator-label">Governance</div>
              <div className="operator-value operator-green">Protected</div>
              <p>Required checks enforced with manual review posture.</p>
              <button className="operator-button">Open Governance Report</button>
            </div>

            <div className="operator-card large">
              <div className="operator-label">Runtime</div>
              <div className="operator-value operator-cyan">Observing</div>
              <p>Agent runtime and orchestration monitoring enabled.</p>
              <button className="operator-button">View Runtime Status</button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default OperatorDashboard;
