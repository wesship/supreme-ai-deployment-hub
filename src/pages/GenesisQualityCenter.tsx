import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleGauge,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  GenesisEvaluation,
  GenesisFinding,
  GenesisProject,
  GenesisReleaseGate,
  genesisApi,
} from '@/lib/genesisApi';

const scoreLabels: Record<string, string> = {
  canon: 'Canon',
  workflow: 'Workflow',
  continuity: 'Continuity',
  governance: 'Governance',
  assets: 'Assets',
  technical: 'Technical',
  release: 'Release',
};

function GateIcon({ status }: { status: string }) {
  if (status === 'passed') return <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />;
  if (status === 'warning' || status === 'waived') return <AlertTriangle className="h-5 w-5 text-amber-300" aria-hidden="true" />;
  return <XCircle className="h-5 w-5 text-red-300" aria-hidden="true" />;
}

function severityClass(severity: string) {
  if (severity === 'critical' || severity === 'high') return 'border-red-400/25 bg-red-400/8 text-red-100';
  if (severity === 'medium') return 'border-amber-400/25 bg-amber-400/8 text-amber-100';
  return 'border-blue-400/20 bg-blue-400/8 text-blue-100';
}

export default function GenesisQualityCenter() {
  const [projects, setProjects] = useState<GenesisProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [evaluations, setEvaluations] = useState<GenesisEvaluation[]>([]);
  const [findings, setFindings] = useState<GenesisFinding[]>([]);
  const [gates, setGates] = useState<GenesisReleaseGate[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      const response = await genesisApi.listProjects();
      setProjects(response.projects);
      setProjectId(current => current || response.projects[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Genesis projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEvaluations = useCallback(async (selectedProjectId: string) => {
    if (!selectedProjectId) {
      setEvaluations([]);
      setFindings([]);
      setGates([]);
      return;
    }
    setError('');
    try {
      const response = await genesisApi.getEvaluations(selectedProjectId);
      setEvaluations(response.evaluations);
      setFindings(response.findings);
      setGates(response.gates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load quality history.');
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadEvaluations(projectId);
  }, [loadEvaluations, projectId]);

  const latest = evaluations[0];
  const selectedProject = useMemo(
    () => projects.find(project => project.id === projectId),
    [projectId, projects],
  );
  const latestFindings = useMemo(
    () => latest ? findings.filter(finding => !finding.status || finding.status !== 'resolved') : [],
    [findings, latest],
  );
  const blockingCount = latestFindings.filter(finding => finding.blocking).length;

  async function runEvaluation() {
    if (!projectId) return;
    setRunning(true);
    setError('');
    try {
      await genesisApi.runEvaluation(projectId);
      await loadEvaluations(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quality evaluation failed.');
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-950 text-blue-100">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" aria-hidden="true" />
        Loading Genesis Quality Center
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Helmet>
        <title>Genesis Quality Center — D3VONN.IO</title>
        <meta
          name="description"
          content="Run deterministic Genesis evaluations, inspect quality findings, and verify release gates for D3VONN.IO production projects."
        />
      </Helmet>

      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-blue-300/15 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.22),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Link to="/genesis" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200 hover:text-white">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Genesis Command Center
              </Link>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                Verification and release gates
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">Quality is evidence, not confidence.</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                Evaluate canon, workflow completion, continuity, governance, approved assets, provider readiness, and release blockers through a versioned, auditable quality snapshot.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="text-sm font-medium text-slate-300">
                Project
                <select
                  value={projectId}
                  onChange={event => setProjectId(event.target.value)}
                  className="mt-2 min-w-[260px] rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none ring-blue-400 focus:ring-2"
                >
                  <option value="">Select a project</option>
                  {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select>
              </label>
              <button
                type="button"
                onClick={runEvaluation}
                disabled={!projectId || running}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Run verification
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Quality operation did not complete</p>
              <p className="mt-1 break-words text-red-100/80">{error}</p>
            </div>
          </div>
        )}

        {!projectId ? (
          <section className="mt-8 flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-blue-300/20 bg-slate-950/60 p-8 text-center">
            <Sparkles className="h-12 w-12 text-blue-300" aria-hidden="true" />
            <h2 className="mt-5 text-2xl font-semibold">Select or create a Genesis project</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">Quality evaluations become available after a project exists in the Command Center.</p>
          </section>
        ) : latest ? (
          <main className="mt-8 space-y-6">
            <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Latest evaluation</p>
                    <h2 className="mt-2 text-2xl font-semibold">{selectedProject?.title}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{latest.summary}</p>
                  </div>
                  <div className={`flex h-36 w-36 shrink-0 flex-col items-center justify-center rounded-full border-8 ${latest.release_ready ? 'border-emerald-400/40 bg-emerald-400/8' : 'border-blue-400/30 bg-blue-400/8'}`}>
                    <span className="text-4xl font-semibold">{Number(latest.overall_score || 0).toFixed(0)}</span>
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">of 100</span>
                  </div>
                </div>
                <div className={`mt-6 flex items-center gap-3 rounded-2xl border p-4 ${latest.release_ready ? 'border-emerald-400/25 bg-emerald-400/8 text-emerald-100' : 'border-amber-400/25 bg-amber-400/8 text-amber-100'}`}>
                  {latest.release_ready ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
                  <div>
                    <p className="font-semibold">{latest.release_ready ? 'Release ready' : 'Release blocked'}</p>
                    <p className="mt-1 text-sm opacity-80">{blockingCount} blocking finding(s) remain.</p>
                  </div>
                </div>
              </article>

              <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <div className="flex items-center gap-2">
                  <CircleGauge className="h-5 w-5 text-blue-300" aria-hidden="true" />
                  <h2 className="text-xl font-semibold">Quality dimensions</h2>
                </div>
                <div className="mt-5 space-y-4">
                  {Object.entries(latest.scores || {}).map(([key, rawValue]) => {
                    const value = Number(rawValue || 0);
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-300">{scoreLabels[key] || key}</span>
                          <span className="font-semibold text-white">{value.toFixed(0)}</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Decision gates</p>
                    <h2 className="mt-1 text-xl font-semibold">Release readiness</h2>
                  </div>
                  <span className="text-sm text-slate-400">{gates.length} gates</span>
                </div>
                <div className="mt-5 space-y-3">
                  {gates.length === 0 ? <p className="text-sm text-slate-400">Run verification to create release gates.</p> : gates.map(gate => (
                    <div key={gate.gate_key} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <GateIcon status={gate.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-white">{gate.name}</p>
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{gate.status.replaceAll('_', ' ')}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{gate.category}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Evidence</p>
                    <h2 className="mt-1 text-xl font-semibold">Open findings</h2>
                  </div>
                  <span className="text-sm text-slate-400">{latestFindings.length} findings</span>
                </div>
                <div className="mt-5 space-y-3">
                  {latestFindings.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-100">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                      No open findings remain.
                    </div>
                  ) : latestFindings.map(finding => (
                    <div key={finding.id} className={`rounded-xl border p-4 ${severityClass(finding.severity)}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{finding.title}</p>
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">{finding.severity}{finding.blocking ? ' · blocking' : ''}</span>
                      </div>
                      {finding.description && <p className="mt-2 text-sm leading-6 opacity-80">{finding.description}</p>}
                      {finding.remediation && (
                        <p className="mt-3 border-t border-current/10 pt-3 text-sm"><span className="font-semibold">Remediation:</span> {finding.remediation}</p>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 sm:p-6">
              <h2 className="text-xl font-semibold">Evaluation history</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="pb-3 pr-4">Completed</th>
                      <th className="pb-3 pr-4">Type</th>
                      <th className="pb-3 pr-4">Score</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Release</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.map(evaluation => (
                      <tr key={evaluation.id} className="border-t border-white/5">
                        <td className="py-3 pr-4 text-slate-400">{new Date(evaluation.completed_at || evaluation.started_at).toLocaleString()}</td>
                        <td className="py-3 pr-4 text-white">{evaluation.evaluation_type.replaceAll('_', ' ')}</td>
                        <td className="py-3 pr-4 font-semibold text-white">{Number(evaluation.overall_score || 0).toFixed(0)}</td>
                        <td className="py-3 pr-4 text-slate-300">{evaluation.status.replaceAll('_', ' ')}</td>
                        <td className="py-3">{evaluation.release_ready ? 'Ready' : 'Blocked'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        ) : (
          <section className="mt-8 flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-blue-300/20 bg-slate-950/60 p-8 text-center">
            <ClipboardCheck className="h-12 w-12 text-blue-300" aria-hidden="true" />
            <h2 className="mt-5 text-2xl font-semibold">No evaluation has been recorded</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">Run verification to create a scored snapshot, blocking findings, remediation guidance, and release gates.</p>
          </section>
        )}
      </div>
    </div>
  );
}
