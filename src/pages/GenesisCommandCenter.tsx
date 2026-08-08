import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Activity,
  AlertTriangle,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clapperboard,
  Database,
  GitBranch,
  Loader2,
  LockKeyhole,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';

import {
  GenesisProject,
  GenesisSnapshot,
  GenesisTask,
  genesisApi,
} from '@/lib/genesisApi';

const projectTypes = ['film', 'series', 'game', 'xr', 'commercial', 'software', 'custom'];

const statusClasses: Record<string, string> = {
  completed: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  approved: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  ready: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  running: 'border-blue-400/30 bg-blue-400/10 text-blue-100',
  in_progress: 'border-blue-400/30 bg-blue-400/10 text-blue-100',
  blocked: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  failed: 'border-red-400/30 bg-red-400/10 text-red-100',
  pending: 'border-violet-400/30 bg-violet-400/10 text-violet-100',
  approval_pending: 'border-violet-400/30 bg-violet-400/10 text-violet-100',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status] || 'border-white/10 bg-white/5 text-slate-300'}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  detail,
}: {
  label: string;
  value: number | string;
  icon: typeof Activity;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-blue-300/10 bg-slate-950/70 p-5 shadow-[0_18px_80px_rgba(3,105,161,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
        </div>
        <div className="rounded-xl border border-blue-300/15 bg-blue-400/10 p-3 text-blue-200">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-400">{detail}</p>
    </article>
  );
}

function taskAction(task: GenesisTask): { label: string; target: string } | null {
  if (task.status === 'ready') return { label: 'Start', target: 'in_progress' };
  if (task.status === 'claimed') return { label: 'Begin', target: 'in_progress' };
  if (task.status === 'in_progress') return { label: 'Send to review', target: 'review' };
  if (task.status === 'review') return { label: 'Approve', target: 'approved' };
  if (task.status === 'approved') return { label: 'Complete', target: 'completed' };
  if (task.status === 'blocked' || task.status === 'revision' || task.status === 'failed') {
    return { label: 'Return to ready', target: 'ready' };
  }
  return null;
}

export default function GenesisCommandCenter() {
  const [projects, setProjects] = useState<GenesisProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [snapshot, setSnapshot] = useState<GenesisSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [title, setTitle] = useState('The Genesis Weave');
  const [projectType, setProjectType] = useState('film');
  const [description, setDescription] = useState('A canon-governed cinematic universe produced through the D3VONN.IO Genesis operating system.');

  const loadProjects = useCallback(async () => {
    setError('');
    try {
      const response = await genesisApi.listProjects();
      setProjects(response.projects);
      setSelectedProjectId(current => current || response.projects[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Genesis projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSnapshot = useCallback(async (projectId: string) => {
    if (!projectId) {
      setSnapshot(null);
      return;
    }
    setError('');
    try {
      const data = await genesisApi.snapshot(projectId);
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the project command center.');
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadSnapshot(selectedProjectId);
  }, [loadSnapshot, selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find(project => project.id === selectedProjectId) || snapshot?.project,
    [projects, selectedProjectId, snapshot],
  );

  async function createProject(event: FormEvent) {
    event.preventDefault();
    setWorking('create-project');
    setError('');
    try {
      const response = await genesisApi.createProject({
        title,
        project_type: projectType,
        description,
      });
      await loadProjects();
      setSelectedProjectId(response.project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Project creation failed.');
    } finally {
      setWorking('');
    }
  }

  async function bootstrap() {
    if (!selectedProjectId) return;
    setWorking('bootstrap');
    setError('');
    try {
      await genesisApi.bootstrap(selectedProjectId);
      await loadSnapshot(selectedProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workflow bootstrap failed.');
    } finally {
      setWorking('');
    }
  }

  async function requestPreviewRender() {
    if (!selectedProjectId) return;
    setWorking('render');
    setError('');
    try {
      await genesisApi.createRenderRequest(selectedProjectId, {
        domain: 'video',
        operation: 'image_to_video',
        objective: 'Generate a restrained eight-second Genesis alignment preview using approved character and environment references.',
        routing_profile: 'canon_critical',
        normalized_request: {
          duration_seconds: 8,
          output_count: 2,
          resolution: '1920x804',
          aspect_ratio: '2.39:1',
          camera_motion: 'slow_dolly_in',
          prohibited: ['superhero pose', 'energy beam', 'costume drift', 'chaotic camera'],
        },
        maximum_cost_usd: 25,
        idempotency_key: `preview-${selectedProjectId}-${Date.now()}`,
      });
      await loadSnapshot(selectedProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render request failed.');
    } finally {
      setWorking('');
    }
  }

  async function transitionTask(task: GenesisTask) {
    const action = taskAction(task);
    if (!action) return;
    setWorking(task.id);
    setError('');
    try {
      await genesisApi.transitionTask(task.id, action.target);
      await loadSnapshot(selectedProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Task transition failed.');
    } finally {
      setWorking('');
    }
  }

  async function decideApproval(approvalId: string, decision: 'approved' | 'rejected') {
    setWorking(approvalId);
    setError('');
    try {
      await genesisApi.decideApproval(approvalId, decision);
      await loadSnapshot(selectedProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval decision failed.');
    } finally {
      setWorking('');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-blue-100">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" aria-hidden="true" />
        Loading Genesis Command Center
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Helmet>
        <title>Genesis Production Command Center — D3VONN.IO</title>
        <meta
          name="description"
          content="Operate canon, goals, workflows, agents, render governance, approvals, and release readiness through the D3VONN.IO Genesis production system."
        />
      </Helmet>

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-3xl border border-blue-300/15 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.22),transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 shadow-[0_28px_100px_rgba(30,64,175,0.16)] sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Genesis Platform Foundation
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
                Production intelligence with memory, governance, and consequence.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                Create projects, lock canon, bootstrap the agent workflow, advance governed tasks, estimate external renders, and approve consequential actions from one operational surface.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadSnapshot(selectedProjectId)}
                disabled={!selectedProjectId || Boolean(working)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh
              </button>
              <button
                type="button"
                onClick={bootstrap}
                disabled={!selectedProjectId || Boolean(working)}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-300/30 bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working === 'bootstrap' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Bootstrap workflow
              </button>
              <button
                type="button"
                onClick={requestPreviewRender}
                disabled={!selectedProjectId || Boolean(working)}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working === 'render' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                Request preview render
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Genesis operation did not complete</p>
              <p className="mt-1 break-words text-red-100/80">{error}</p>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Project context</p>
                  <h2 className="mt-1 text-lg font-semibold">Active production</h2>
                </div>
                <Boxes className="h-5 w-5 text-blue-300" aria-hidden="true" />
              </div>
              <label className="mt-4 block text-sm font-medium text-slate-300" htmlFor="genesis-project-select">
                Project
              </label>
              <select
                id="genesis-project-select"
                value={selectedProjectId}
                onChange={event => setSelectedProjectId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none ring-blue-400 transition focus:ring-2"
              >
                <option value="">Select a project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
              {selectedProject && (
                <div className="mt-4 rounded-xl border border-blue-300/10 bg-blue-400/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{selectedProject.title}</p>
                    <StatusBadge status={selectedProject.status} />
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.15em] text-slate-500">{selectedProject.canonical_key}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{selectedProject.description || 'No description recorded.'}</p>
                </div>
              )}
            </section>

            <form onSubmit={createProject} className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-300" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Create project</h2>
              </div>
              <div className="mt-4 space-y-4">
                <label className="block text-sm font-medium text-slate-300">
                  Title
                  <input
                    value={title}
                    onChange={event => setTitle(event.target.value)}
                    required
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none ring-blue-400 focus:ring-2"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-300">
                  Type
                  <select
                    value={projectType}
                    onChange={event => setProjectType(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none ring-blue-400 focus:ring-2"
                  >
                    {projectTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-300">
                  Description
                  <textarea
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                    rows={4}
                    className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-white outline-none ring-blue-400 focus:ring-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={working === 'create-project'}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold transition hover:bg-blue-400 disabled:opacity-50"
                >
                  {working === 'create-project' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Genesis project
                </button>
              </div>
            </form>
          </aside>

          <main className="min-w-0 space-y-6">
            {snapshot ? (
              <>
                <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                  <MetricCard label="Open tasks" value={snapshot.counts.open_tasks} icon={GitBranch} detail={`${snapshot.counts.blocked_tasks} currently blocked`} />
                  <MetricCard label="Canon" value={snapshot.counts.canon} icon={LockKeyhole} detail={`${snapshot.counts.locked_canon} locked authority entries`} />
                  <MetricCard label="Assets" value={snapshot.counts.assets} icon={Database} detail={`${snapshot.counts.approved_assets} approved production assets`} />
                  <MetricCard label="Approvals" value={snapshot.counts.pending_approvals} icon={ShieldCheck} detail={`${snapshot.counts.active_workflows} active workflows`} />
                </section>

                <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Execution graph</p>
                        <h2 className="mt-1 text-xl font-semibold">Production tasks</h2>
                      </div>
                      <span className="text-sm text-slate-400">{snapshot.tasks.length} registered</span>
                    </div>
                    <div className="mt-5 space-y-3">
                      {snapshot.tasks.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">
                          No workflow tasks yet. Bootstrap the project to create the governed execution graph.
                        </div>
                      ) : snapshot.tasks.map(task => {
                        const action = taskAction(task);
                        return (
                          <article key={task.id} className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusBadge status={task.status} />
                                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">P{task.priority} · {task.task_type}</span>
                                </div>
                                <h3 className="mt-2 font-semibold text-white">{task.title}</h3>
                                <p className="mt-1 text-sm text-slate-400">
                                  {(task.acceptance_criteria || []).length} acceptance criteria · {(task.dependencies || []).length} dependencies
                                </p>
                              </div>
                              {action && (
                                <button
                                  type="button"
                                  onClick={() => transitionTask(task)}
                                  disabled={working === task.id}
                                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-300/20 bg-blue-400/10 px-3 py-2 text-sm font-semibold text-blue-100 hover:bg-blue-400/20 disabled:opacity-50"
                                >
                                  {working === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                                  {action.label}
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                      <div className="flex items-center gap-2">
                        <Workflow className="h-5 w-5 text-blue-300" aria-hidden="true" />
                        <h2 className="text-lg font-semibold">Workflow runtime</h2>
                      </div>
                      <div className="mt-4 space-y-3">
                        {snapshot.workflows.length === 0 ? (
                          <p className="text-sm leading-6 text-slate-400">No workflow runs are active.</p>
                        ) : snapshot.workflows.map(workflow => (
                          <div key={workflow.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium text-white">{workflow.workflow_key.replaceAll('_', ' ')}</p>
                              <StatusBadge status={workflow.status} />
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                              <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.max(2, Math.round((workflow.progress || 0) * 100))}%` }} />
                            </div>
                            <p className="mt-2 text-xs text-slate-500">Phase: {workflow.current_phase || 'pending'} · {Math.round((workflow.progress || 0) * 100)}%</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                      <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                        <h2 className="text-lg font-semibold">Provider routes</h2>
                      </div>
                      <div className="mt-4 space-y-2">
                        {snapshot.provider_health.map(provider => (
                          <div key={`${provider.provider}-${provider.model}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{provider.provider}</p>
                              <p className="truncate text-xs text-slate-500">{provider.model}</p>
                            </div>
                            <span className={`text-xs font-semibold ${provider.configured ? 'text-emerald-300' : 'text-slate-500'}`}>
                              {provider.configured ? (provider.manual ? 'manual' : 'ready') : 'not configured'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <CircleDollarSign className="h-5 w-5 text-violet-300" aria-hidden="true" />
                      <h2 className="text-xl font-semibold">Approval inbox</h2>
                    </div>
                    <div className="mt-5 space-y-3">
                      {snapshot.approvals.length === 0 ? (
                        <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-100">
                          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                          No consequential action is waiting for approval.
                        </div>
                      ) : snapshot.approvals.map(approval => (
                        <article key={approval.id} className="rounded-xl border border-violet-300/20 bg-violet-400/5 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{approval.approval_type.replaceAll('_', ' ')}</p>
                              <p className="mt-1 text-sm text-slate-400">{approval.target_type.replaceAll('_', ' ')} · risk {approval.risk_level}</p>
                              {approval.estimated_cost_usd != null && (
                                <p className="mt-2 text-sm font-medium text-violet-200">Up to ${Number(approval.estimated_cost_usd).toFixed(2)}</p>
                              )}
                            </div>
                            <StatusBadge status={approval.status} />
                          </div>
                          <div className="mt-4 flex gap-2">
                            <button
                              type="button"
                              onClick={() => decideApproval(approval.id, 'approved')}
                              disabled={working === approval.id}
                              className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                            >Approve</button>
                            <button
                              type="button"
                              onClick={() => decideApproval(approval.id, 'rejected')}
                              disabled={working === approval.id}
                              className="rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-400/20 disabled:opacity-50"
                            >Reject</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-300" aria-hidden="true" />
                      <h2 className="text-xl font-semibold">Recent system events</h2>
                    </div>
                    <div className="mt-5 space-y-3">
                      {snapshot.recent_events.length === 0 ? (
                        <p className="text-sm leading-6 text-slate-400">Events will appear after project commands, workflow transitions, approvals, and render activity.</p>
                      ) : snapshot.recent_events.map(event => (
                        <div key={event.id} className="flex gap-3 border-b border-white/5 pb-3 last:border-0">
                          <div className="mt-1 rounded-full bg-blue-400/10 p-2 text-blue-300">
                            <Activity className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">{event.event_type.replaceAll('.', ' · ')}</p>
                            <p className="mt-1 text-xs text-slate-500">{event.aggregate_type} · {new Date(event.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-blue-300/15 bg-[linear-gradient(135deg,rgba(30,64,175,0.14),rgba(8,47,73,0.08))] p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-blue-200">
                        <Rocket className="h-5 w-5" aria-hidden="true" />
                        <span className="text-xs font-semibold uppercase tracking-[0.18em]">Implementation state</span>
                      </div>
                      <h2 className="mt-2 text-xl font-semibold">Foundation is active; providers remain configuration-governed.</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                        Schema, workflow contracts, task state transitions, render estimation, approvals, provenance fields, and the Creator UI are implemented. External provider execution activates only when its server-side credentials and policies are configured.
                      </p>
                    </div>
                    <div className="grid min-w-[280px] grid-cols-2 gap-2 text-xs">
                      {Object.entries(snapshot.implementation).map(([key, value]) => (
                        <div key={key} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                          <p className="text-slate-500">{key.replaceAll('_', ' ')}</p>
                          <p className="mt-1 font-semibold text-blue-100">{value.replaceAll('_', ' ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <section className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-blue-300/20 bg-slate-950/50 p-8 text-center">
                <Sparkles className="h-12 w-12 text-blue-300" aria-hidden="true" />
                <h2 className="mt-5 text-2xl font-semibold">Create the first Genesis project</h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
                  The system will create a project identity, locked provenance law, project-scoped agent workforce, and an auditable command surface ready for workflow bootstrapping.
                </p>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
