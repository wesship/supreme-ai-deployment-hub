import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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

type NavTarget =
  | { kind: 'scroll'; anchor: string }
  | { kind: 'route'; path: string };

const navItems: { label: string; target: NavTarget }[] = [
  { label: 'Overview', target: { kind: 'scroll', anchor: 'op-overview' } },
  { label: 'Supervision', target: { kind: 'scroll', anchor: 'op-supervision' } },
  { label: 'CI / CD', target: { kind: 'scroll', anchor: 'op-ci' } },
  { label: 'Memory Vault', target: { kind: 'scroll', anchor: 'op-memory' } },
  { label: 'Connectors', target: { kind: 'scroll', anchor: 'op-connectors' } },
  { label: 'Deployments', target: { kind: 'route', path: '/deployment' } },
  { label: 'Governance', target: { kind: 'route', path: '/admin' } },
  { label: 'Runtime', target: { kind: 'scroll', anchor: 'op-runtime' } },
  { label: 'Agents Mesh', target: { kind: 'route', path: '/agents' } },
  { label: 'Observability', target: { kind: 'scroll', anchor: 'op-observability' } },
  { label: 'Topology', target: { kind: 'scroll', anchor: 'op-topology' } },
  { label: 'Settings', target: { kind: 'route', path: '/admin' } },
];

function OperatorDashboardInner() {
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize active nav from URL hash so direct links highlight correctly.
  const initialNav = (() => {
    const id = location.hash.replace(/^#/, '');
    const match = navItems.find(
      (n) => n.target.kind === 'scroll' && n.target.anchor === id,
    );
    return match?.label ?? navItems[0].label;
  })();
  const [activeNav, setActiveNav] = useState(initialNav);

  // Keep active state in sync with hash changes (back/forward, manual edits).
  useEffect(() => {
    const id = location.hash.replace(/^#/, '');
    if (!id) return;
    const match = navItems.find(
      (n) => n.target.kind === 'scroll' && n.target.anchor === id,
    );
    if (match) setActiveNav(match.label);
  }, [location.hash]);

  // First-load deep-link scroll (retries while lazy panels mount).
  useEffect(() => {
    const id = location.hash.replace(/^#/, '');
    if (!id) return;
    let cancelled = false;
    let attempt = 0;
    const tick = () => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (attempt++ < 30) setTimeout(tick, 100);
    };
    tick();
    return () => {
      cancelled = true;
    };
    // Only run on initial mount; in-app nav uses handleNav directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNav = (item: (typeof navItems)[number]) => {
    setActiveNav(item.label);
    if (item.target.kind === 'route') {
      navigate(item.target.path);
      return;
    }
    // Update URL hash so the section is deep-linkable / shareable.
    navigate({ hash: `#${item.target.anchor}` }, { replace: false });
    const el = document.getElementById(item.target.anchor);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };


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
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>D3VONN.IO</div>
              <div style={{ color: 'var(--operator-muted)' }}>
                Glass Operator Console
              </div>
            </div>
          </div>

          <nav className="operator-nav">
            {navItems.map((item) => (
              <button
                type="button"
                key={item.label}
                onClick={() => handleNav(item)}
                className={`operator-nav-item ${activeNav === item.label ? 'active' : ''}`}
                style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', width: '100%' }}
              >
                {item.label}
              </button>
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

          <section className="operator-grid" id="op-overview">
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

            <div id="op-supervision" style={{ display: 'contents' }}>
              <RuntimeSupervisionPanel />
              <SupervisionTimelinePanel />
            </div>

            <div id="op-memory" style={{ display: 'contents' }}>
              <MemoryVaultPanel memory={memory} />
            </div>

            <div id="op-connectors" style={{ display: 'contents' }}>
              <ConnectorInventoryPanel connectors={connectors} />
            </div>

            <div id="op-observability" style={{ display: 'contents' }}>
              <ObservabilityPanel metrics={metrics} />
              <QueueActivityPanel queues={queues} />
            </div>

            <div id="op-ci" style={{ display: 'contents' }}>
              <CIWorkflowActivityPanel ci={ci} />
            </div>

            <div id="op-runtime" style={{ display: 'contents' }}>
              <RuntimeStreamPanel />
              <LiveLogsPanel logs={logs} />
              <TraceVisualizationPanel traces={traces} />
            </div>

            <div id="op-topology" style={{ display: 'contents' }}>
              <TopologyVisualizationPanel graph={graph} topology={topology} />
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

export function OperatorDashboard() {
  return (
    <OperatorSessionGate>
      <OperatorDashboardInner />
    </OperatorSessionGate>
  );
}

export default OperatorDashboard;
