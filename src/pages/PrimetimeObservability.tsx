import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bell, CheckCircle2, Gauge, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { primetimeRelease1Api, type PrimetimeRecord } from '@/lib/primetimeRelease1Api';

const card = 'rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg shadow-black/20';
const input = 'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50';
const ghostButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400 hover:bg-slate-900 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50';

function value(record: PrimetimeRecord | undefined, key: string, fallback = '—'): string {
  const raw = record?.[key];
  return raw === undefined || raw === null || raw === '' ? fallback : String(raw);
}

function numberValue(record: PrimetimeRecord | undefined, key: string): number {
  const raw = record?.[key];
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function records(valueToCheck: unknown): PrimetimeRecord[] {
  return Array.isArray(valueToCheck) ? valueToCheck.filter((item): item is PrimetimeRecord => Boolean(item) && typeof item === 'object') : [];
}

function statusStyle(status: string): string {
  if (status === 'breached' || status === 'critical' || status === 'open') return 'border-red-500/30 bg-red-500/10 text-red-200';
  if (status === 'warning' || status === 'acknowledged') return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  if (status === 'resolved' || status === 'compliant' || status === 'healthy') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
  return 'border-slate-700 bg-slate-900 text-slate-300';
}

export default function PrimetimeObservability() {
  const [workspaces, setWorkspaces] = useState<PrimetimeRecord[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [overview, setOverview] = useState<PrimetimeRecord>({});
  const [slos, setSlos] = useState<PrimetimeRecord[]>([]);
  const [evaluations, setEvaluations] = useState<PrimetimeRecord[]>([]);
  const [alerts, setAlerts] = useState<PrimetimeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signalMetric, setSignalMetric] = useState('api_latency_ms');
  const [signalDomain, setSignalDomain] = useState('runtime');
  const [signalValue, setSignalValue] = useState('0');
  const [signalUnit, setSignalUnit] = useState('ms');
  const [sloName, setSloName] = useState('API latency target');
  const [sloMetric, setSloMetric] = useState('api_latency_ms');
  const [sloComparator, setSloComparator] = useState('lte');
  const [sloTarget, setSloTarget] = useState('250');
  const [sloWarning, setSloWarning] = useState('200');
  const [selectedSloId, setSelectedSloId] = useState('');

  const recentSignals = useMemo(() => records(overview.recent_signals), [overview]);
  const activeAlerts = useMemo(() => records(overview.active_alerts), [overview]);
  const summary = useMemo(() => (overview.summary && typeof overview.summary === 'object' ? overview.summary as PrimetimeRecord : {}), [overview]);
  const selectedSlo = useMemo(() => slos.find((slo) => value(slo, 'id', '') === selectedSloId), [slos, selectedSloId]);
  const latestMatchingSignal = useMemo(
    () => recentSignals.find((signal) => value(signal, 'metric_key', '') === value(selectedSlo, 'metric_key', '')),
    [recentSignals, selectedSlo],
  );
  const actionableEvaluation = useMemo(
    () => evaluations.find((evaluation) => ['warning', 'breached'].includes(value(evaluation, 'evaluation_status', ''))),
    [evaluations],
  );

  async function loadWorkspace(id: string) {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [overviewRecord, sloRows, evaluationRows, alertRows] = await Promise.all([
        primetimeRelease1Api.getObservabilityOverview(id),
        primetimeRelease1Api.listSloDefinitions(id),
        primetimeRelease1Api.listSloEvaluations(id),
        primetimeRelease1Api.listTelemetryAlerts(id),
      ]);
      setOverview(overviewRecord);
      setSlos(sloRows);
      setEvaluations(evaluationRows);
      setAlerts(alertRows);
      if (!selectedSloId && sloRows[0]) setSelectedSloId(value(sloRows[0], 'id', ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Release 7 observability data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    primetimeRelease1Api.listWorkspaces()
      .then((rows) => {
        setWorkspaces(rows);
        const firstId = value(rows[0], 'id', '');
        if (firstId) {
          setWorkspaceId(firstId);
          void loadWorkspace(firstId);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load PRIMETIME workspaces'));
  }, []);

  async function refresh() {
    await loadWorkspace(workspaceId);
  }

  async function recordSignal() {
    if (!workspaceId) return;
    const measurement = Number(signalValue);
    if (!Number.isFinite(measurement) || measurement < 0) {
      setError('Signal value must be a finite non-negative number.');
      return;
    }
    try {
      setError('');
      await primetimeRelease1Api.createTelemetrySignal({
        workspace_id: workspaceId,
        metric_key: signalMetric,
        domain: signalDomain,
        value: measurement,
        unit: signalUnit,
        observed_at: new Date().toISOString(),
        source: 'operator_console',
        dimensions: { source_surface: 'release7_console' },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record telemetry signal');
    }
  }

  async function createSlo() {
    if (!workspaceId) return;
    const target = Number(sloTarget);
    const warning = sloWarning.trim() === '' ? undefined : Number(sloWarning);
    if (!Number.isFinite(target) || target < 0 || (warning !== undefined && (!Number.isFinite(warning) || warning < 0))) {
      setError('SLO thresholds must be finite non-negative numbers.');
      return;
    }
    try {
      setError('');
      const record = await primetimeRelease1Api.createSloDefinition({
        workspace_id: workspaceId,
        name: sloName,
        metric_key: sloMetric,
        domain: signalDomain,
        comparator: sloComparator,
        target_value: target,
        warning_threshold: warning,
        evaluation_window_seconds: 300,
        severity: 'warning',
        status: 'active',
        description: 'Governed Release 7 operational SLO.',
      });
      setSelectedSloId(value(record, 'id', ''));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create SLO definition');
    }
  }

  async function evaluateLatestSignal() {
    if (!workspaceId || !selectedSlo || !latestMatchingSignal) {
      setError('Select an SLO with a recent matching telemetry signal before evaluating.');
      return;
    }
    try {
      setError('');
      await primetimeRelease1Api.createSloEvaluation({
        workspace_id: workspaceId,
        slo_definition_id: value(selectedSlo, 'id', ''),
        source_signal_id: value(latestMatchingSignal, 'id', ''),
        measured_value: numberValue(latestMatchingSignal, 'value'),
        evaluated_at: new Date().toISOString(),
        evaluation_metadata: { source_surface: 'release7_console' },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to evaluate SLO');
    }
  }

  async function openAlert() {
    if (!actionableEvaluation) {
      setError('No warning or breached evaluation is available for alert creation.');
      return;
    }
    try {
      setError('');
      await primetimeRelease1Api.openTelemetryAlert(value(actionableEvaluation, 'id', ''));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open telemetry alert');
    }
  }

  async function updateAlert(alertId: string, status: 'acknowledged' | 'resolved' | 'silenced') {
    try {
      setError('');
      await primetimeRelease1Api.updateTelemetryAlert(alertId, { status });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update telemetry alert');
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3 text-cyan-300">
            <Activity className="h-8 w-8" />
            <span className="text-sm font-semibold uppercase tracking-[0.35em]">PRIMETIME Release 7</span>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Advanced Telemetry &amp; Observability</h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                Governed operational signals, SLO evaluations, and alert lifecycle visibility for authorized workspace operators.
                Telemetry stays bounded, workspace-scoped, auditable, and separate from customer, CRM, communications, and AI execution records.
              </p>
            </div>
            <div className={card}>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Workspace</label>
              <select className={`${input} mt-2`} value={workspaceId} onChange={(event) => { setWorkspaceId(event.target.value); void loadWorkspace(event.target.value); }}>
                <option value="">Select workspace</option>
                {workspaces.map((workspace) => <option key={value(workspace, 'id')} value={value(workspace, 'id')}>{value(workspace, 'name', 'Workspace')}</option>)}
              </select>
              <button className={`${ghostButton} mt-3 w-full`} onClick={() => void refresh()} disabled={!workspaceId || loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh telemetry
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <p>No customer payloads, message bodies, credentials, or raw requests may enter this surface. Release 7 exposes no sending, quote, policy, application, autonomous execution, CRM mutation, or delete behavior.</p>
            </div>
          </div>
          {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className={card}><Activity className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-sm text-slate-400">Recent signals</p><p className="text-3xl font-bold">{numberValue(summary, 'recent_signal_count')}</p></div>
          <div className={card}><Gauge className="mb-3 h-5 w-5 text-violet-300" /><p className="text-sm text-slate-400">Active SLOs</p><p className="text-3xl font-bold">{numberValue(summary, 'active_slo_count')}</p></div>
          <div className={card}><AlertTriangle className="mb-3 h-5 w-5 text-amber-300" /><p className="text-sm text-slate-400">Breached evaluations</p><p className="text-3xl font-bold">{numberValue(summary, 'recent_breached_evaluation_count')}</p></div>
          <div className={card}><Bell className="mb-3 h-5 w-5 text-red-300" /><p className="text-sm text-slate-400">Active alerts</p><p className="text-3xl font-bold">{numberValue(summary, 'active_alert_count')}</p></div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className={card}>
            <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-cyan-300" /><h2 className="text-xl font-semibold">Record governed signal</h2></div>
            <p className="mt-2 text-sm text-slate-400">Enter an externally observed operational measurement. Dimensions are intentionally fixed to this console.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className={input} aria-label="Signal metric key" value={signalMetric} onChange={(event) => setSignalMetric(event.target.value)} placeholder="metric key" />
              <select className={input} aria-label="Signal domain" value={signalDomain} onChange={(event) => setSignalDomain(event.target.value)}>
                {['runtime', 'deployment', 'agent', 'scheduler', 'queue', 'compliance', 'infrastructure', 'release'].map((domain) => <option key={domain} value={domain}>{domain}</option>)}
              </select>
              <input className={input} aria-label="Signal value" type="number" min="0" step="any" value={signalValue} onChange={(event) => setSignalValue(event.target.value)} />
              <input className={input} aria-label="Signal unit" value={signalUnit} onChange={(event) => setSignalUnit(event.target.value)} placeholder="unit" />
            </div>
            <button className={`${button} mt-4`} onClick={() => void recordSignal()} disabled={!workspaceId || loading}><Plus className="h-4 w-4" />Record signal</button>
          </div>

          <div className={card}>
            <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-violet-300" /><h2 className="text-xl font-semibold">Create SLO contract</h2></div>
            <p className="mt-2 text-sm text-slate-400">SLOs define transparent threshold logic; they do not initiate automatic remediation.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input className={input} aria-label="SLO name" value={sloName} onChange={(event) => setSloName(event.target.value)} placeholder="SLO name" />
              <input className={input} aria-label="SLO metric key" value={sloMetric} onChange={(event) => setSloMetric(event.target.value)} placeholder="metric key" />
              <select className={input} aria-label="SLO comparator" value={sloComparator} onChange={(event) => setSloComparator(event.target.value)}><option value="lte">at or below target</option><option value="gte">at or above target</option></select>
              <input className={input} aria-label="SLO target" type="number" min="0" step="any" value={sloTarget} onChange={(event) => setSloTarget(event.target.value)} placeholder="target" />
              <input className={input} aria-label="SLO warning threshold" type="number" min="0" step="any" value={sloWarning} onChange={(event) => setSloWarning(event.target.value)} placeholder="warning threshold" />
            </div>
            <button className={`${button} mt-4`} onClick={() => void createSlo()} disabled={!workspaceId || loading}><Plus className="h-4 w-4" />Create SLO</button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">SLO evaluation desk</h2><p className="mt-1 text-sm text-slate-400">Evaluate the latest matching signal using the immutable Release 7 evaluation history.</p></div><button className={ghostButton} onClick={() => void evaluateLatestSignal()} disabled={!workspaceId || !selectedSlo || !latestMatchingSignal}><CheckCircle2 className="h-4 w-4" />Evaluate latest signal</button></div>
            <select className={`${input} mt-4`} value={selectedSloId} onChange={(event) => setSelectedSloId(event.target.value)}><option value="">Select active SLO</option>{slos.filter((slo) => value(slo, 'status') === 'active').map((slo) => <option key={value(slo, 'id')} value={value(slo, 'id')}>{value(slo, 'name')} · {value(slo, 'metric_key')}</option>)}</select>
            <div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-slate-900 p-3"><p className="text-xs text-slate-400">Selected target</p><p className="mt-1 font-semibold">{value(selectedSlo, 'comparator')} {value(selectedSlo, 'target_value')}</p></div><div className="rounded-xl bg-slate-900 p-3"><p className="text-xs text-slate-400">Latest matching signal</p><p className="mt-1 font-semibold">{latestMatchingSignal ? `${numberValue(latestMatchingSignal, 'value')} ${value(latestMatchingSignal, 'unit')}` : 'None'}</p></div><div className="rounded-xl bg-slate-900 p-3"><p className="text-xs text-slate-400">Evaluation source</p><p className="mt-1 font-semibold">Append-only history</p></div></div>
            <div className="mt-5 space-y-2">{evaluations.slice(0, 5).map((evaluation) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900 p-3" key={value(evaluation, 'id')}><div><p className="font-semibold">{value(evaluation, 'evaluation_status')} · {value(evaluation, 'measured_value')}</p><p className="text-xs text-slate-400">{value(evaluation, 'evaluated_at')}</p></div><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusStyle(value(evaluation, 'evaluation_status'))}`}>{value(evaluation, 'evaluation_status')}</span></div>)}</div>
          </div>

          <div className={card}>
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Alert lifecycle</h2><p className="mt-1 text-sm text-slate-400">Alerts open only from warning or breached evaluations.</p></div><button className={ghostButton} onClick={() => void openAlert()} disabled={!actionableEvaluation}><Bell className="h-4 w-4" />Open alert</button></div>
            <div className="mt-4 space-y-3">{alerts.slice(0, 6).map((alert) => <div className="rounded-xl bg-slate-900 p-3" key={value(alert, 'id')}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{value(alert, 'title')}</p><p className="mt-1 text-xs text-slate-400">{value(alert, 'description')}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${statusStyle(value(alert, 'status'))}`}>{value(alert, 'status')}</span></div>{['open', 'acknowledged'].includes(value(alert, 'status')) && <div className="mt-3 flex flex-wrap gap-2"><button className={ghostButton} onClick={() => void updateAlert(value(alert, 'id'), 'acknowledged')}>Acknowledge</button><button className={ghostButton} onClick={() => void updateAlert(value(alert, 'id'), 'resolved')}>Resolve</button><button className={ghostButton} onClick={() => void updateAlert(value(alert, 'id'), 'silenced')}>Silence</button></div>}</div>)}{alerts.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">No telemetry alerts have been opened in this workspace.</p>}</div>
          </div>
        </section>

        <section className={card}>
          <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-cyan-300" /><h2 className="text-xl font-semibold">Recent signal stream</h2></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{recentSignals.map((signal) => <div className="rounded-xl bg-slate-900 p-3" key={value(signal, 'id')}><p className="font-semibold">{value(signal, 'metric_key')}</p><p className="mt-1 text-2xl font-bold text-cyan-200">{numberValue(signal, 'value')} <span className="text-sm font-medium text-slate-400">{value(signal, 'unit')}</span></p><p className="mt-2 text-xs text-slate-400">{value(signal, 'domain')} · {value(signal, 'observed_at')}</p></div>)}{recentSignals.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">No governed telemetry has been recorded for this workspace yet.</p>}</div>
        </section>
      </div>
    </div>
  );
}
