import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Brain, CheckCircle2, Gauge, LineChart, ShieldCheck, TrendingUp } from 'lucide-react';
import { primetimeRelease1Api, type PrimetimeRecord } from '@/lib/primetimeRelease1Api';

function value(record: PrimetimeRecord | undefined, key: string, fallback = '—'): string {
  const raw = record?.[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return String(raw);
}

function numberValue(record: PrimetimeRecord | undefined, key: string): number {
  const raw = record?.[key];
  if (typeof raw === 'number') return raw;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const card = 'rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg shadow-black/20';
const input = 'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400';
const button = 'rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50';
const ghostButton = 'rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50';

export default function PrimetimeExecutiveCommandCenter() {
  const [workspaces, setWorkspaces] = useState<PrimetimeRecord[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState<PrimetimeRecord[]>([]);
  const [dashboards, setDashboards] = useState<PrimetimeRecord[]>([]);
  const [widgets, setWidgets] = useState<PrimetimeRecord[]>([]);
  const [snapshots, setSnapshots] = useState<PrimetimeRecord[]>([]);
  const [funnel, setFunnel] = useState<PrimetimeRecord[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<PrimetimeRecord[]>([]);
  const [compliance, setCompliance] = useState<PrimetimeRecord[]>([]);
  const [aiActions, setAiActions] = useState<PrimetimeRecord[]>([]);
  const [observations, setObservations] = useState<PrimetimeRecord[]>([]);

  const activeDashboard = dashboards[0];
  const latestCompliance = compliance[0];
  const latestAiActions = aiActions[0];
  const latestAgent = agentPerformance[0];

  const summary = useMemo(() => ({
    openExceptions: numberValue(latestCompliance, 'open_exception_count'),
    blockedAiActions: numberValue(latestAiActions, 'blocked_count'),
    pendingApprovals: numberValue(latestCompliance, 'pending_approval_count'),
    agentScore: numberValue(latestAgent, 'score'),
  }), [latestCompliance, latestAiActions, latestAgent]);

  async function loadWorkspace(id: string) {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [metricRows, dashboardRows, widgetRows, snapshotRows, funnelRows, agentRows, complianceRows, aiRows, observationRows] = await Promise.all([
        primetimeRelease1Api.listAnalyticsMetricDefinitions(id),
        primetimeRelease1Api.listExecutiveDashboards(id),
        primetimeRelease1Api.listDashboardWidgets(id),
        primetimeRelease1Api.listAnalyticsSnapshots(id),
        primetimeRelease1Api.listFunnelStageSnapshots(id),
        primetimeRelease1Api.listAgentPerformanceSnapshots(id),
        primetimeRelease1Api.listComplianceMetricSnapshots(id),
        primetimeRelease1Api.listAiActionMetricSnapshots(id),
        primetimeRelease1Api.listReleaseGovernanceObservations(id),
      ]);
      setMetrics(metricRows);
      setDashboards(dashboardRows);
      setWidgets(widgetRows);
      setSnapshots(snapshotRows);
      setFunnel(funnelRows);
      setAgentPerformance(agentRows);
      setCompliance(complianceRows);
      setAiActions(aiRows);
      setObservations(observationRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Release 5 analytics workspace');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    primetimeRelease1Api.listWorkspaces()
      .then((rows) => {
        setWorkspaces(rows);
        const first = value(rows[0], 'id', '');
        if (first) {
          setWorkspaceId(first);
          void loadWorkspace(first);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load workspaces'));
  }, []);

  async function refresh() {
    await loadWorkspace(workspaceId);
  }

  async function createMetricDefinition() {
    if (!workspaceId) return;
    await primetimeRelease1Api.createAnalyticsMetricDefinition({
      workspace_id: workspaceId,
      metric_key: `release5_pipeline_health_${Date.now()}`,
      name: 'Pipeline health',
      description: 'Governed command-center metric for pipeline visibility.',
      category: 'executive',
      calculation_method: 'snapshot-only aggregation from governed PRIMETIME records',
      source_tables: ['leads', 'tasks', 'appointments'],
      owner_role: 'workspace_admin',
      is_active: true,
    });
    await refresh();
  }

  async function createDashboard() {
    if (!workspaceId) return;
    await primetimeRelease1Api.createExecutiveDashboard({
      workspace_id: workspaceId,
      name: 'PRIMETIME Executive Command Center',
      audience: 'executive',
      description: 'Read-only executive dashboard for CRM, scheduling, communications, AI, and compliance health.',
      status: 'active',
      layout: { columns: 3, release: 5 },
    });
    await refresh();
  }

  async function createWidget() {
    if (!workspaceId || !activeDashboard) return;
    await primetimeRelease1Api.createDashboardWidget({
      workspace_id: workspaceId,
      dashboard_id: value(activeDashboard, 'id', ''),
      metric_definition_id: value(metrics[0], 'id', null as unknown as string),
      widget_key: `governance_scorecard_${Date.now()}`,
      title: 'Governance Scorecard',
      widget_type: 'scorecard',
      config: { source: 'release5_snapshot_only', noBusinessMutation: true },
      position_index: widgets.length + 1,
      status: 'active',
    });
    await refresh();
  }

  async function createAnalyticsSnapshot() {
    if (!workspaceId) return;
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    await primetimeRelease1Api.createAnalyticsSnapshot({
      workspace_id: workspaceId,
      metric_definition_id: value(metrics[0], 'id', null as unknown as string),
      metric_key: value(metrics[0], 'metric_key', 'open_leads'),
      snapshot_period: 'hourly',
      period_start: now.toISOString(),
      period_end: end.toISOString(),
      value: 12,
      numerator: 12,
      denominator: 20,
      dimensions: { release: 5, source: 'seeded_ui' },
      generated_by: 'ui_seed',
    });
    await refresh();
  }

  async function createFunnelSnapshot() {
    if (!workspaceId) return;
    await primetimeRelease1Api.createFunnelStageSnapshot({
      workspace_id: workspaceId,
      stage_name: 'Appointment scheduled/completed',
      snapshot_date: today(),
      lead_count: 8,
      entered_count: 3,
      exited_count: 2,
      conversion_rate: 0.25,
      median_age_hours: 18,
    });
    await refresh();
  }

  async function createAgentPerformanceSnapshot() {
    if (!workspaceId) return;
    await primetimeRelease1Api.createAgentPerformanceSnapshot({
      workspace_id: workspaceId,
      agent_user_id: '00000000-0000-0000-0000-000000000001',
      snapshot_date: today(),
      assigned_lead_count: 15,
      open_task_count: 7,
      completed_task_count: 11,
      appointment_count: 4,
      no_show_count: 1,
      communication_draft_count: 5,
      ai_assistance_request_count: 6,
      score: 88,
    });
    await refresh();
  }

  async function createComplianceSnapshot() {
    if (!workspaceId) return;
    await primetimeRelease1Api.createComplianceMetricSnapshot({
      workspace_id: workspaceId,
      snapshot_date: today(),
      open_exception_count: 2,
      blocked_communication_count: 1,
      blocked_ai_action_count: 3,
      pending_approval_count: 4,
      unresolved_finding_count: 1,
      audit_event_count: 42,
      compliance_score: 91,
    });
    await refresh();
  }

  async function createAiActionSnapshot() {
    if (!workspaceId) return;
    await primetimeRelease1Api.createAiActionMetricSnapshot({
      workspace_id: workspaceId,
      snapshot_date: today(),
      proposed_count: 12,
      approval_required_count: 5,
      approved_count: 4,
      blocked_count: 3,
      rejected_count: 1,
      executed_count: 0,
      high_risk_count: 3,
      automation_savings_minutes: 24,
    });
    await refresh();
  }

  async function createGovernanceObservation() {
    if (!workspaceId) return;
    await primetimeRelease1Api.createReleaseGovernanceObservation({
      workspace_id: workspaceId,
      release_key: 'release-5',
      observation_type: 'exit_gate',
      severity: 'warning',
      title: 'Analytics exit gate requires CI and compliance review',
      description: 'Release 5 must preserve read-only observation boundaries before production promotion.',
      status: 'open',
      metadata: { noDelete: true, noBusinessMutation: true },
    });
    await refresh();
  }

  async function resolveObservation(id: string) {
    await primetimeRelease1Api.updateReleaseGovernanceObservation(id, {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      metadata: { resolvedFromUi: true },
    });
    await refresh();
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3 text-cyan-300">
            <Gauge className="h-8 w-8" />
            <span className="text-sm font-semibold uppercase tracking-[0.35em]">PRIMETIME Release 5</span>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Executive Command Center</h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                Analytics are observation records only. This workspace summarizes funnel health, agent performance, compliance pressure,
                AI action governance, and release exit gates without mutating CRM, scheduling, communications, or AI business records.
              </p>
            </div>
            <div className={card}>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Workspace</label>
              <select className={`${input} mt-2`} value={workspaceId} onChange={(event) => { setWorkspaceId(event.target.value); void loadWorkspace(event.target.value); }}>
                <option value="">Select workspace</option>
                {workspaces.map((workspace) => (
                  <option key={value(workspace, 'id')} value={value(workspace, 'id')}>{value(workspace, 'name', 'Workspace')}</option>
                ))}
              </select>
              <button className={`${ghostButton} mt-3 w-full`} onClick={refresh} disabled={!workspaceId || loading}>Refresh analytics</button>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                No send, quote, policy recommendation, application submission, autonomous execution, CRM mutation, or hard-delete behavior is exposed here.
                Release 5 is a governed command center for snapshots, dashboards, widgets, and release observations only.
              </p>
            </div>
          </div>
          {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className={card}><ShieldCheck className="mb-3 h-5 w-5 text-emerald-300" /><p className="text-sm text-slate-400">Open exceptions</p><p className="text-3xl font-bold">{summary.openExceptions}</p></div>
          <div className={card}><Brain className="mb-3 h-5 w-5 text-purple-300" /><p className="text-sm text-slate-400">Blocked AI actions</p><p className="text-3xl font-bold">{summary.blockedAiActions}</p></div>
          <div className={card}><CheckCircle2 className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-sm text-slate-400">Pending approvals</p><p className="text-3xl font-bold">{summary.pendingApprovals}</p></div>
          <div className={card}><TrendingUp className="mb-3 h-5 w-5 text-lime-300" /><p className="text-sm text-slate-400">Agent score</p><p className="text-3xl font-bold">{summary.agentScore}</p></div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className={card}>
            <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-cyan-300" /><h2 className="text-xl font-semibold">Metric definition manager</h2></div>
            <p className="mt-2 text-sm text-slate-400">Define snapshot-only metrics sourced from governed tables.</p>
            <button className={`${button} mt-4`} onClick={createMetricDefinition} disabled={!workspaceId}>Create metric</button>
            <div className="mt-4 space-y-2">
              {metrics.slice(0, 4).map((metric) => <div className="rounded-xl bg-slate-900 p-3" key={value(metric, 'id')}><p className="font-semibold">{value(metric, 'name')}</p><p className="text-xs text-slate-400">{value(metric, 'category')} · {value(metric, 'metric_key')}</p></div>)}
            </div>
          </div>

          <div className={card}>
            <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-cyan-300" /><h2 className="text-xl font-semibold">Dashboard builder</h2></div>
            <p className="mt-2 text-sm text-slate-400">Configure executive dashboard and widgets without altering business records.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className={button} onClick={createDashboard} disabled={!workspaceId}>Create dashboard</button>
              <button className={ghostButton} onClick={createWidget} disabled={!workspaceId || !activeDashboard}>Add widget</button>
            </div>
            <div className="mt-4 space-y-2">
              {dashboards.slice(0, 2).map((dashboard) => <div className="rounded-xl bg-slate-900 p-3" key={value(dashboard, 'id')}><p className="font-semibold">{value(dashboard, 'name')}</p><p className="text-xs text-slate-400">{value(dashboard, 'audience')} · {value(dashboard, 'status')}</p></div>)}
              <p className="text-xs text-slate-500">Widgets configured: {widgets.length}</p>
            </div>
          </div>

          <div className={card}>
            <div className="flex items-center gap-2"><LineChart className="h-5 w-5 text-cyan-300" /><h2 className="text-xl font-semibold">Analytics snapshots</h2></div>
            <p className="mt-2 text-sm text-slate-400">Record period-bounded analytics snapshots with valid time windows.</p>
            <button className={`${button} mt-4`} onClick={createAnalyticsSnapshot} disabled={!workspaceId}>Create snapshot</button>
            <div className="mt-4 space-y-2">
              {snapshots.slice(0, 3).map((snapshot) => <div className="rounded-xl bg-slate-900 p-3" key={value(snapshot, 'id')}><p className="font-semibold">{value(snapshot, 'metric_key')}</p><p className="text-xs text-slate-400">{value(snapshot, 'snapshot_period')} · value {value(snapshot, 'value')}</p></div>)}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className={card}>
            <h2 className="text-xl font-semibold">Funnel metrics view</h2>
            <button className={`${button} mt-4`} onClick={createFunnelSnapshot} disabled={!workspaceId}>Record funnel snapshot</button>
            <div className="mt-4 space-y-2">
              {funnel.map((row) => <div className="rounded-xl bg-slate-900 p-3" key={value(row, 'id')}><p className="font-semibold">{value(row, 'stage_name')}</p><p className="text-xs text-slate-400">Leads {value(row, 'lead_count')} · Conversion {value(row, 'conversion_rate')}</p></div>)}
            </div>
          </div>

          <div className={card}>
            <h2 className="text-xl font-semibold">Agent performance view</h2>
            <button className={`${button} mt-4`} onClick={createAgentPerformanceSnapshot} disabled={!workspaceId}>Record agent performance</button>
            <div className="mt-4 space-y-2">
              {agentPerformance.map((row) => <div className="rounded-xl bg-slate-900 p-3" key={value(row, 'id')}><p className="font-semibold">Score {value(row, 'score')}</p><p className="text-xs text-slate-400">Leads {value(row, 'assigned_lead_count')} · Tasks {value(row, 'completed_task_count')} · Appointments {value(row, 'appointment_count')}</p></div>)}
            </div>
          </div>

          <div className={card}>
            <h2 className="text-xl font-semibold">Compliance metrics view</h2>
            <button className={`${button} mt-4`} onClick={createComplianceSnapshot} disabled={!workspaceId}>Record compliance snapshot</button>
            <div className="mt-4 space-y-2">
              {compliance.map((row) => <div className="rounded-xl bg-slate-900 p-3" key={value(row, 'id')}><p className="font-semibold">Compliance score {value(row, 'compliance_score')}</p><p className="text-xs text-slate-400">Blocked comms {value(row, 'blocked_communication_count')} · Findings {value(row, 'unresolved_finding_count')}</p></div>)}
            </div>
          </div>

          <div className={card}>
            <h2 className="text-xl font-semibold">AI action metrics view</h2>
            <button className={`${button} mt-4`} onClick={createAiActionSnapshot} disabled={!workspaceId}>Record AI action snapshot</button>
            <div className="mt-4 space-y-2">
              {aiActions.map((row) => <div className="rounded-xl bg-slate-900 p-3" key={value(row, 'id')}><p className="font-semibold">Blocked {value(row, 'blocked_count')} / Proposed {value(row, 'proposed_count')}</p><p className="text-xs text-slate-400">Execution stays governed · savings {value(row, 'automation_savings_minutes')} min</p></div>)}
            </div>
          </div>
        </section>

        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Release governance observations</h2>
              <p className="mt-1 text-sm text-slate-400">Track exit gates, risks, policy gaps, test gaps, incidents, and improvements.</p>
            </div>
            <button className={button} onClick={createGovernanceObservation} disabled={!workspaceId}>Create observation</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {observations.map((observation) => (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4" key={value(observation, 'id')}>
                <p className="font-semibold">{value(observation, 'title')}</p>
                <p className="mt-1 text-sm text-slate-400">{value(observation, 'description')}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-cyan-300">{value(observation, 'release_key')} · {value(observation, 'severity')} · {value(observation, 'status')}</p>
                {value(observation, 'status') !== 'resolved' && <button className={`${ghostButton} mt-3`} onClick={() => resolveObservation(value(observation, 'id'))}>Resolve observation</button>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
