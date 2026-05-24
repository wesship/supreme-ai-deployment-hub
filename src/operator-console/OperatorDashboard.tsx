import { useEffect, useState } from 'react';

import ConnectorInventoryPanel from './components/ConnectorInventoryPanel';
import MemoryVaultPanel from './components/MemoryVaultPanel';
import OperatorStatusCard from './components/OperatorStatusCard';
import {
  operatorApi,
  operatorFallbacks,
  type OperatorCI,
  type OperatorConnectors,
  type OperatorMemory,
  type OperatorStatus,
} from './operatorApi';

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
  const [status, setStatus] = useState<OperatorStatus>(operatorFallbacks.status);
  const [ci, setCI] = useState<OperatorCI>(operatorFallbacks.ci);
  const [memory, setMemory] = useState<OperatorMemory>(operatorFallbacks.memory);
  const [connectors, setConnectors] = useState<OperatorConnectors>(
    operatorFallbacks.connectors,
  );

  useEffect(() => {
    async function load() {
      const [statusData, ciData, memoryData, connectorData] = await Promise.all([
        operatorApi.status(),
        operatorApi.ci(),
        operatorApi.memory(),
        operatorApi.connectors(),
      ]);

      setStatus(statusData);
      setCI(ciData);
      setMemory(memoryData);
      setConnectors(connectorData);
    }

    load();

    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

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
              <div style={{ color: 'var(--operator-muted)' }}>
                Glass Operator Console
              </div>
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
                {status.mode} • {status.surfaces.length} operational surfaces online
              </div>
            </div>

            <div className="operator-pill">
              <span className="operator-green">●</span> {status.readiness}
            </div>
          </div>

          <section className="operator-grid">
            <OperatorStatusCard
              label="System Status"
              value="Operational"
              description="All critical systems healthy."
              accent="green"
            />

            <OperatorStatusCard
              label="Production Gates"
              value={ci.requiredChecks.length}
              description="Required production checks enforced."
            />

            <OperatorStatusCard
              label="Memory Entries"
              value={memory.entries}
              description="Operational exports available."
            />

            <OperatorStatusCard
              label="Connectors"
              value={
                connectors.production.length +
                connectors.staging.length +
                connectors.future.length
              }
              description="Connector inventory tracked by lane."
            />

            <MemoryVaultPanel memory={memory} />

            <ConnectorInventoryPanel connectors={connectors} />

            <div className="operator-card wide">
              <div className="operator-label">CI / CD Health</div>
              <div className="operator-value operator-green">{ci.status}</div>

              <div style={{ marginTop: 18 }}>
                {ci.requiredChecks.map((check) => (
                  <div key={check} className="operator-pill" style={{ marginBottom: 8 }}>
                    {check}
                  </div>
                ))}
              </div>
            </div>

            <div className="operator-card wide">
              <div className="operator-label">Advisory Tooling</div>
              <div className="operator-value operator-cyan">Observing</div>

              <div style={{ marginTop: 18 }}>
                {ci.advisoryTools.map((tool) => (
                  <div key={tool} className="operator-pill" style={{ marginBottom: 8 }}>
                    {tool}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default OperatorDashboard;
