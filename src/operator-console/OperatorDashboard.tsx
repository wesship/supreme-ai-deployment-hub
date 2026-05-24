import { useEffect, useState } from 'react';

import CIWorkflowActivityPanel from './components/CIWorkflowActivityPanel';
import ConnectorInventoryPanel from './components/ConnectorInventoryPanel';
import LiveLogsPanel from './components/LiveLogsPanel';
import MemoryVaultPanel from './components/MemoryVaultPanel';
import ObservabilityPanel from './components/ObservabilityPanel';
import OperatorSessionGate from './components/OperatorSessionGate';
import OperatorStatusCard from './components/OperatorStatusCard';
import QueueActivityPanel from './components/QueueActivityPanel';
import RuntimeStreamPanel from './components/RuntimeStreamPanel';
import RuntimeSupervisionPanel from './components/RuntimeSupervisionPanel';
import SupervisionTimelinePanel from './components/SupervisionTimelinePanel';
import TopologyVisualizationPanel from './components/TopologyVisualizationPanel';
import TraceVisualizationPanel from './components/TraceVisualizationPanel';
import {
  operatorApi,
  operatorFallbacks,
  type OperatorCI,
  type OperatorConnectors,
  type OperatorGraph,
  type OperatorLogs,
  type OperatorMemory,
  type OperatorMetrics,
  type OperatorQueues,
  type OperatorStatus,
  type OperatorTopology,
  type OperatorTraces,
} from './operatorApi';

import './operator-theme.css';

const navItems = [
  'Overview',
  'Supervision',
  'CI / CD',
  'Memory Vault',
  'Connectors',
  'Deployments',
  'Governance',
  'Runtime',
  'Agents Mesh',
  'Observability',
  'Topology',
  'Settings',
];

function OperatorDashboardInner() {
  const [status, setStatus] = useState<OperatorStatus>(operatorFallbacks.status);
  const [ci, setCI] = useState<OperatorCI>(operatorFallbacks.ci);
  const [memory, setMemory] = useState<OperatorMemory>(operatorFallbacks.memory);
  const [connectors, setConnectors] = useState<OperatorConnectors>(
    operatorFallbacks.connectors,
  );
  const [metrics, setMetrics] = useState<OperatorMetrics>(operatorFallbacks.metrics);
  const [logs, setLogs] = useState<OperatorLogs>(operatorFallbacks.logs);
  const [traces, setTraces] = useState<OperatorTraces>(operatorFallbacks.traces);
  const [queues, setQueues] = useState<OperatorQueues>(operatorFallbacks.queues);
  const [graph, setGraph] = useState<OperatorGraph>(operatorFallbacks.graph);
  const [topology, setTopology] = useState<OperatorTopology>(operatorFallbacks.topology);

  useEffect(() => {
    async function load() {
      const [
        statusData,
        ciData,
        memoryData,
        connectorData,
        metricsData,
        logsData,
        tracesData,
        queueData,
        graphData,
        topologyData,
      ] = await Promise.all([
        operatorApi.status(),
        operatorApi.ci(),
        operatorApi.memory(),
        operatorApi.connectors(),
        operatorApi.metrics(),
        operatorApi.logs(),
        operatorApi.traces(),
        operatorApi.queues(),
        operatorApi.graph(),
        operatorApi.topology(),
      ]);

      setStatus(statusData);
      setCI(ciData);
      setMemory(memoryData);
      setConnectors(connectorData);
      setMetrics(metricsData);
      setLogs(logsData);
      setTraces(tracesData);
      setQueues(queueData);
      setGraph(graphData);
      setTopology(topologyData);
    }

    load();

    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const githubSummary = ci.githubActions?.summary;

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

            <OperatorStatusCard
              label="CI Runs"
              value={githubSummary?.total ?? 0}
              description={`${githubSummary?.failures ?? 0} failing workflows observed.`}
            />

            <OperatorStatusCard
              label="Queue Depth"
              value={queues.queues.reduce((total, queue) => total + queue.depth, 0)}
              description={queues.redisReady ? 'Redis telemetry connected.' : 'Redis telemetry pending.'}
            />

            <RuntimeSupervisionPanel />

            <SupervisionTimelinePanel />

            <MemoryVaultPanel memory={memory} />

            <ConnectorInventoryPanel connectors={connectors} />

            <ObservabilityPanel metrics={metrics} />

            <QueueActivityPanel queues={queues} />

            <CIWorkflowActivityPanel ci={ci} />

            <RuntimeStreamPanel />

            <LiveLogsPanel logs={logs} />

            <TraceVisualizationPanel traces={traces} />

            <TopologyVisualizationPanel graph={graph} topology={topology} />

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

export function OperatorDashboard() {
  return (
    <OperatorSessionGate>
      <OperatorDashboardInner />
    </OperatorSessionGate>
  );
}

export default OperatorDashboard;
