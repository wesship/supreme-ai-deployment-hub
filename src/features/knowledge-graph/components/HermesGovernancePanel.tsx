import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, SlidersHorizontal, Zap } from 'lucide-react';
import { API_BASE_URL } from '@/api/config';
import { supabase } from '@/integrations/supabase/client';

type TaskRow = {
  id: string;
  title: string | null;
  kind: string | null;
  task_type?: string | null;
  status: string;
  agent_name: string | null;
  retry_count: number | null;
  created_at: string;
};

type RunRow = {
  id: string;
  task_id: string;
  agent_name: string | null;
  status: string;
  duration_ms: number | null;
  cost_usd: number | string | null;
};

type HealthRow = {
  key: string;
  label: string;
  tasks: number;
  failed: number;
  retries: number;
  runs: number;
  duration_ms: number;
  cost_usd: number;
};

type ChangeRequest = {
  id: string;
  proposal_id: string;
  category: 'routing' | 'agent' | 'tool' | 'concurrency' | 'workflow';
  target: string;
  severity: 'info' | 'warning' | 'critical';
  risk_classification: string;
  proposed_change: Record<string, unknown>;
  evidence_hash: string;
  status: string;
  canary_task_id: string | null;
  created_at: string;
};

type PromotionCandidate = {
  id: string;
  change_request_id: string;
  proposed_change: Record<string, unknown>;
  evidence_hash: string;
  status: 'pending_promotion_review' | 'approved' | 'rejected' | 'promoted';
  created_at: string;
};

type RolloutRow = {
  id: string;
  promotion_candidate_id: string;
  environment: 'staging' | 'production';
  status: 'validated' | 'applied' | 'rolled_back' | 'failed';
  runtime_changed: boolean;
  rollback_config: Record<string, unknown>;
  created_at: string;
};

type Proposal = {
  id: string;
  category: ChangeRequest['category'];
  target: string;
  severity: ChangeRequest['severity'];
  reason: string;
  guardrail: string;
  proposed_change: Record<string, unknown>;
  baseline: {
    success_rate: number;
    error_rate: number;
    latency_ms: number;
    cost_usd: number;
  };
};

const statusTone = (status: string) => {
  const normalized = status.toUpperCase();
  if (['FAILED', 'REJECTED', 'CANARY_FAILED'].includes(normalized)) return 'text-red-200 border-red-400/30 bg-red-500/[0.06]';
  if (['COMPLETED', 'APPROVED', 'PROMOTED', 'APPLIED'].includes(normalized)) return 'text-emerald-200 border-emerald-300/25 bg-emerald-300/[0.05]';
  if (['RUNNING', 'LOCKED', 'PROCESSING', 'CANARY_QUEUED', 'PENDING_PROMOTION_REVIEW'].includes(normalized)) return 'text-amber-100 border-amber-300/25 bg-amber-300/[0.05]';
  return 'text-stone-300 border-[#34332f] bg-[#0c0c0a]';
};

const HermesGovernancePanel: React.FC = () => {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [candidates, setCandidates] = useState<PromotionCandidate[]>([]);
  const [rollouts, setRollouts] = useState<RolloutRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('Governance surface ready.');
  const [reviewNote, setReviewNote] = useState('Reviewed against current evidence, guardrails, and rollback readiness.');
  const [productionAuthorization, setProductionAuthorization] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const accessToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSignedIn(Boolean(session?.access_token));
    return session?.access_token ?? null;
  }, []);

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = await accessToken();
    if (!token) throw new Error('Sign in is required for governed Hermes operations.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof payload?.detail === 'string' ? payload.detail : `Request failed with HTTP ${response.status}`;
      throw new Error(detail);
    }
    return payload;
  }, [accessToken]);

  const refreshTelemetry = useCallback(async () => {
    const [taskResult, runResult] = await Promise.all([
      supabase
        .from('hermes_tasks')
        .select('id,title,kind,task_type,status,agent_name,retry_count,created_at')
        .order('created_at', { ascending: false })
        .limit(150),
      supabase
        .from('hermes_runs')
        .select('id,task_id,agent_name,status,duration_ms,cost_usd')
        .order('created_at', { ascending: false })
        .limit(300),
    ]);
    if (taskResult.error) throw taskResult.error;
    if (runResult.error) throw runResult.error;
    setTasks((taskResult.data ?? []) as unknown as TaskRow[]);
    setRuns((runResult.data ?? []) as unknown as RunRow[]);
  }, []);

  const refreshGovernance = useCallback(async () => {
    const token = await accessToken();
    if (!token) {
      setChangeRequests([]);
      setCandidates([]);
      setRollouts([]);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    const [requestsRes, candidatesRes, rolloutsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/hermes/adaptive-change-requests?limit=30`, { headers }),
      fetch(`${API_BASE_URL}/api/hermes/adaptive-promotion-candidates?limit=30`, { headers }),
      fetch(`${API_BASE_URL}/api/hermes/adaptive-rollouts?limit=30`, { headers }),
    ]);
    const [requestRows, candidateRows, rolloutRows] = await Promise.all([
      requestsRes.json().catch(() => []),
      candidatesRes.json().catch(() => []),
      rolloutsRes.json().catch(() => []),
    ]);
    if (!requestsRes.ok) throw new Error(requestRows?.detail || 'Change-request load failed');
    if (!candidatesRes.ok) throw new Error(candidateRows?.detail || 'Promotion-candidate load failed');
    if (!rolloutsRes.ok) throw new Error(rolloutRows?.detail || 'Rollout load failed');
    setChangeRequests(Array.isArray(requestRows) ? requestRows : []);
    setCandidates(Array.isArray(candidateRows) ? candidateRows : []);
    setRollouts(Array.isArray(rolloutRows) ? rolloutRows : []);
  }, [accessToken]);

  const refreshAll = useCallback(async () => {
    try {
      await Promise.all([refreshTelemetry(), refreshGovernance()]);
      setMessage('Hermes telemetry and governance ledger refreshed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Refresh failed.');
    }
  }, [refreshGovernance, refreshTelemetry]);

  useEffect(() => {
    refreshAll();
    const timer = window.setInterval(refreshAll, 60_000);
    return () => window.clearInterval(timer);
  }, [refreshAll]);

  const health = useMemo<HealthRow[]>(() => {
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const buckets = new Map<string, HealthRow>();
    const ensure = (label: string) => {
      const key = label || 'Unassigned';
      if (!buckets.has(key)) {
        buckets.set(key, { key, label: key, tasks: 0, failed: 0, retries: 0, runs: 0, duration_ms: 0, cost_usd: 0 });
      }
      return buckets.get(key)!;
    };
    for (const task of tasks) {
      const row = ensure(task.agent_name?.trim() || 'Unassigned');
      row.tasks += 1;
      row.retries += Number(task.retry_count ?? 0);
      if (task.status.toUpperCase() === 'FAILED') row.failed += 1;
    }
    for (const run of runs) {
      const task = taskById.get(run.task_id);
      const row = ensure(run.agent_name?.trim() || task?.agent_name?.trim() || 'Unassigned');
      row.runs += 1;
      row.duration_ms += Number(run.duration_ms ?? 0);
      row.cost_usd += Number(run.cost_usd ?? 0);
    }
    return Array.from(buckets.values())
      .sort((a, b) => (b.failed * 5 + b.retries * 2 + b.duration_ms / 30_000 + b.cost_usd * 10)
        - (a.failed * 5 + a.retries * 2 + a.duration_ms / 30_000 + a.cost_usd * 10))
      .slice(0, 10);
  }, [runs, tasks]);

  const proposals = useMemo<Proposal[]>(() => {
    const result: Proposal[] = [];
    const unassigned = health.find((row) => row.label === 'Unassigned');
    if (unassigned && unassigned.tasks >= 3 && unassigned.runs > 0 && unassigned.cost_usd > 0) {
      result.push({
        id: 'routing-unassigned',
        category: 'routing',
        target: 'Hermes router',
        severity: unassigned.tasks >= 8 ? 'critical' : 'warning',
        reason: `${unassigned.tasks} recent tasks are unassigned; review the routing fallback before changing production behavior.`,
        guardrail: 'Evaluation-only canary; do not mutate production routing until certification and promotion review pass.',
        proposed_change: { scope: 'routing-policy', operation: 'review_default_agent_fallback', target: 'TARS' },
        baseline: {
          success_rate: Math.max(0, 1 - unassigned.failed / unassigned.tasks),
          error_rate: unassigned.failed / unassigned.tasks,
          latency_ms: unassigned.duration_ms / unassigned.runs,
          cost_usd: unassigned.cost_usd / unassigned.tasks,
        },
      });
    }

    for (const row of health) {
      if (row.label === 'Unassigned' || row.tasks < 2 || row.runs < 1 || row.cost_usd <= 0) continue;
      if (row.failed >= 2 || row.retries >= 3) {
        result.push({
          id: `agent-${row.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          category: 'agent',
          target: row.label,
          severity: row.failed >= 4 ? 'critical' : 'warning',
          reason: `${row.failed} failures and ${row.retries} retries observed across ${row.tasks} recent tasks.`,
          guardrail: 'Keep current production agent policy until a completed evaluation-only canary is certified.',
          proposed_change: { scope: 'agent-policy', operation: 'review_agent_assignment', target: row.label },
          baseline: {
            success_rate: Math.max(0, 1 - row.failed / row.tasks),
            error_rate: row.failed / row.tasks,
            latency_ms: row.duration_ms / row.runs,
            cost_usd: row.cost_usd / row.tasks,
          },
        });
      } else if (row.duration_ms / row.runs > 30_000) {
        result.push({
          id: `workflow-latency-${row.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          category: 'workflow',
          target: row.label,
          severity: 'warning',
          reason: `Average observed run latency is ${Math.round(row.duration_ms / row.runs)} ms.`,
          guardrail: 'Only evaluate a workflow-policy proposal; preserve current production workflow until certification.',
          proposed_change: { scope: 'workflow-policy', operation: 'review_latency_path', target: row.label },
          baseline: {
            success_rate: Math.max(0, 1 - row.failed / row.tasks),
            error_rate: row.failed / row.tasks,
            latency_ms: row.duration_ms / row.runs,
            cost_usd: row.cost_usd / row.tasks,
          },
        });
      }
    }
    return result.slice(0, 6);
  }, [health]);

  const runAction = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      setMessage(success);
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Governed action failed.');
    } finally {
      setBusy(null);
    }
  };

  const stageProposal = (proposal: Proposal) => runAction(
    `proposal:${proposal.id}`,
    () => api('/api/hermes/adaptive-change-requests', {
      method: 'POST',
      body: JSON.stringify({
        proposal_id: proposal.id,
        category: proposal.category,
        target: proposal.target,
        severity: proposal.severity,
        evidence: {
          reason: proposal.reason,
          generated_at: new Date().toISOString(),
          baseline_metrics: proposal.baseline,
          health_snapshot: health,
        },
        proposed_change: proposal.proposed_change,
        guardrail: proposal.guardrail,
        rollback_plan: `Abort the canary and retain the current production ${proposal.category} policy for ${proposal.target}.`,
      }),
    }),
    `Governed review staged for ${proposal.target}.`,
  );

  const decideChange = (id: string, decision: 'approved' | 'rejected') => runAction(
    `change:${id}`,
    () => api(`/api/hermes/adaptive-change-requests/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, rationale: reviewNote.trim() || 'Operator review completed.' }),
    }),
    `Change request ${decision}.`,
  );

  const queueCanary = (id: string) => runAction(
    `canary:${id}`,
    () => api(`/api/hermes/adaptive-change-requests/${encodeURIComponent(id)}/canary`, { method: 'POST' }),
    'Evaluation-only canary queued.',
  );

  const certifyCanary = (id: string) => runAction(
    `certify:${id}`,
    () => api(`/api/hermes/adaptive-change-requests/${encodeURIComponent(id)}/certify`, { method: 'POST' }),
    'Completed canary certification recorded.',
  );

  const taskAction = (task: TaskRow, action: 'cancel' | 'retry' | 'pause' | 'resume') => runAction(
    `task:${task.id}`,
    () => api(`/api/hermes/tasks/${encodeURIComponent(task.id)}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, reason: 'Knowledge Graph operator action.' }),
    }),
    `Task ${action} accepted for ${task.title ?? task.id}.`,
  );

  const decidePromotion = (id: string, decision: 'approved' | 'rejected') => runAction(
    `promotion:${id}`,
    () => api(`/api/hermes/adaptive-promotion-candidates/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, rationale: reviewNote.trim() || 'Promotion evidence reviewed.' }),
    }),
    `Promotion ${decision}.`,
  );

  const validateRollout = (id: string, environment: 'staging' | 'production') => runAction(
    `rollout:${id}:${environment}`,
    async () => {
      if (environment === 'production' && productionAuthorization.trim().length < 16) {
        throw new Error('Production authorization must be at least 16 characters.');
      }
      return api(`/api/hermes/adaptive-promotion-candidates/${encodeURIComponent(id)}/rollout`, {
        method: 'POST',
        body: JSON.stringify({
          environment,
          production_authorization: environment === 'production' ? productionAuthorization : null,
        }),
      });
    },
    `${environment} rollout package validated; runtime remains unchanged until an executor supplies deployment evidence.`,
  );

  const actionForTask = (task: TaskRow) => {
    const status = task.status.toUpperCase();
    if (status === 'FAILED') return <button onClick={() => taskAction(task, 'retry')} className="text-[10px] font-bold text-amber-100">Retry</button>;
    if (status === 'PAUSED') return <button onClick={() => taskAction(task, 'resume')} className="text-[10px] font-bold text-amber-100">Resume</button>;
    if (status === 'RUNNING') {
      return (
        <div className="flex gap-2">
          <button onClick={() => taskAction(task, 'pause')} className="text-[10px] font-bold text-amber-100">Pause</button>
          <button onClick={() => taskAction(task, 'cancel')} className="text-[10px] font-bold text-red-200">Cancel</button>
        </div>
      );
    }
    if (['PENDING', 'LOCKED'].includes(status)) return <button onClick={() => taskAction(task, 'cancel')} className="text-[10px] font-bold text-red-200">Cancel</button>;
    return null;
  };

  return (
    <section className="mx-auto max-w-[1920px] px-3 pb-6 xl:px-4" aria-labelledby="hermes-governance-heading">
      <div className="border border-[#34332f] bg-[#0b0b09] shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2d2c28] bg-[#10100d] px-5 py-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-200/70">Hermes governed operations</p>
            <h2 id="hermes-governance-heading" className="mt-1 text-xl font-black text-white">Observe → Review → Canary → Certify → Promote</h2>
            <p className="mt-1 text-[11px] text-stone-400">{message}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`border px-2.5 py-1 text-[10px] font-semibold ${signedIn ? 'border-emerald-300/25 text-emerald-200' : 'border-[#34332f] text-stone-300'}`}>
              {signedIn === null ? 'Auth · checking' : signedIn ? 'Auth · operator' : 'Auth · sign in required'}
            </span>
            <button onClick={refreshAll} disabled={busy !== null} className="flex items-center gap-2 border border-[#34332f] bg-[#11110f] px-3 py-2 text-[10px] font-bold text-stone-200 disabled:opacity-40">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-3">
          <section className="border border-[#2d2c28] bg-[#0d0d0b] p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-200" />
              <h3 className="text-sm font-bold text-white">System-wide health</h3>
            </div>
            <div className="mt-3 space-y-2">
              {health.slice(0, 6).map((row) => (
                <div key={row.key} className="border border-[#25241f] bg-[#090907] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-semibold text-stone-200">{row.label}</span>
                    <span className="text-[10px] text-stone-400">{row.tasks} tasks · {row.runs} runs</span>
                  </div>
                  <p className="mt-1 text-[10px] text-stone-400">
                    failures {row.failed} · retries {row.retries} · avg latency {row.runs ? Math.round(row.duration_ms / row.runs) : 0} ms · cost {row.cost_usd.toFixed(4)}
                  </p>
                </div>
              ))}
              {!health.length && <p className="text-[11px] text-stone-400">No persisted Hermes health data is available yet.</p>}
            </div>
          </section>

          <section className="border border-[#2d2c28] bg-[#0d0d0b] p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-200" />
              <h3 className="text-sm font-bold text-white">Adaptive recommendations</h3>
            </div>
            <div className="mt-3 space-y-2">
              {proposals.map((proposal) => (
                <div key={proposal.id} className="border border-[#25241f] bg-[#090907] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-stone-100">{proposal.target}</span>
                    <span className={`border px-2 py-0.5 text-[9px] font-bold uppercase ${proposal.severity === 'critical' ? 'border-red-400/30 text-red-200' : 'border-amber-300/25 text-amber-100'}`}>{proposal.severity}</span>
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-stone-400">{proposal.reason}</p>
                  <button disabled={busy !== null} onClick={() => stageProposal(proposal)} className="mt-3 w-full border border-amber-300/25 bg-amber-300/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-100 disabled:opacity-40">
                    Stage governed review
                  </button>
                </div>
              ))}
              {!proposals.length && <p className="text-[11px] text-stone-400">No recommendation currently meets the measured-evidence threshold.</p>}
            </div>
          </section>

          <section className="border border-[#2d2c28] bg-[#0d0d0b] p-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-amber-200" />
              <h3 className="text-sm font-bold text-white">Recent task controls</h3>
            </div>
            <div className="mt-3 space-y-2">
              {tasks.slice(0, 8).map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 border border-[#25241f] bg-[#090907] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-stone-200">{task.title ?? task.kind ?? task.id}</p>
                    <p className="mt-1 truncate text-[9px] text-stone-400">{task.agent_name || 'Unassigned'} · {task.id.slice(0, 8)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`border px-2 py-1 text-[9px] font-bold uppercase ${statusTone(task.status)}`}>{task.status}</span>
                    {busy === `task:${task.id}` ? <span className="text-[9px] text-stone-400">Working…</span> : actionForTask(task)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-4 border-t border-[#2d2c28] p-4 xl:grid-cols-2">
          <section className="border border-[#2d2c28] bg-[#0d0d0b] p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-200" />
              <h3 className="text-sm font-bold text-white">Governed change requests</h3>
            </div>
            <textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              className="mt-3 min-h-20 w-full border border-[#34332f] bg-[#090907] p-3 text-[11px] text-stone-200 outline-none"
              aria-label="Operator review rationale"
            />
            <div className="mt-3 space-y-2">
              {changeRequests.map((request) => (
                <div key={request.id} className="border border-[#25241f] bg-[#090907] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-stone-100">{request.target}</p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-stone-400">{request.category} · risk {request.risk_classification}</p>
                    </div>
                    <span className={`border px-2 py-1 text-[9px] font-bold uppercase ${statusTone(request.status)}`}>{request.status}</span>
                  </div>
                  <p className="mt-2 truncate font-mono text-[9px] text-stone-400">evidence {request.evidence_hash}</p>
                  {request.status === 'pending_review' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button disabled={busy !== null} onClick={() => decideChange(request.id, 'approved')} className="border border-emerald-300/25 px-3 py-2 text-[10px] font-bold text-emerald-200 disabled:opacity-40">Approve</button>
                      <button disabled={busy !== null} onClick={() => decideChange(request.id, 'rejected')} className="border border-red-400/25 px-3 py-2 text-[10px] font-bold text-red-200 disabled:opacity-40">Reject</button>
                    </div>
                  )}
                  {request.status === 'approved' && (
                    <button disabled={busy !== null} onClick={() => queueCanary(request.id)} className="mt-3 w-full border border-amber-300/25 px-3 py-2 text-[10px] font-bold text-amber-100 disabled:opacity-40">Queue evaluation-only canary</button>
                  )}
                  {request.status === 'canary_queued' && (
                    <button disabled={busy !== null} onClick={() => certifyCanary(request.id)} className="mt-3 w-full border border-emerald-300/25 px-3 py-2 text-[10px] font-bold text-emerald-200 disabled:opacity-40">Certify completed canary</button>
                  )}
                  {request.canary_task_id && <p className="mt-2 text-[9px] text-stone-400">canary task {request.canary_task_id.slice(0, 12)}</p>}
                </div>
              ))}
              {!changeRequests.length && <p className="text-[11px] text-stone-400">No governed adaptive change requests are staged.</p>}
            </div>
          </section>

          <section className="border border-[#2d2c28] bg-[#0d0d0b] p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-200" />
              <h3 className="text-sm font-bold text-white">Certification & promotion</h3>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-stone-400">
              Passing certification creates a promotion candidate only. Production remains unchanged until a separately authorized executor supplies deployment evidence.
            </p>
            <div className="mt-3 space-y-2">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="border border-[#25241f] bg-[#090907] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] text-stone-200">{candidate.id.slice(0, 10)}</span>
                    <span className={`border px-2 py-1 text-[9px] font-bold uppercase ${statusTone(candidate.status)}`}>{candidate.status}</span>
                  </div>
                  <p className="mt-2 break-all text-[9px] text-stone-400">{JSON.stringify(candidate.proposed_change)}</p>
                  {candidate.status === 'pending_promotion_review' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button disabled={busy !== null} onClick={() => decidePromotion(candidate.id, 'approved')} className="border border-emerald-300/25 px-3 py-2 text-[10px] font-bold text-emerald-200 disabled:opacity-40">Approve promotion</button>
                      <button disabled={busy !== null} onClick={() => decidePromotion(candidate.id, 'rejected')} className="border border-red-400/25 px-3 py-2 text-[10px] font-bold text-red-200 disabled:opacity-40">Reject</button>
                    </div>
                  )}
                  {candidate.status === 'approved' && (
                    <div className="mt-3 space-y-2">
                      <button disabled={busy !== null} onClick={() => validateRollout(candidate.id, 'staging')} className="w-full border border-[#34332f] px-3 py-2 text-[10px] font-bold text-stone-200 disabled:opacity-40">Validate staging package</button>
                      <input
                        type="password"
                        value={productionAuthorization}
                        onChange={(event) => setProductionAuthorization(event.target.value)}
                        placeholder="Production authorization (16+ characters)"
                        aria-label="Production authorization"
                        className="w-full border border-[#34332f] bg-[#090907] px-3 py-2 text-[10px] text-stone-200 outline-none"
                      />
                      <button disabled={busy !== null || productionAuthorization.trim().length < 16} onClick={() => validateRollout(candidate.id, 'production')} className="w-full border border-amber-300/25 px-3 py-2 text-[10px] font-bold text-amber-100 disabled:opacity-40">Validate production package</button>
                    </div>
                  )}
                </div>
              ))}
              {!candidates.length && <p className="text-[11px] text-stone-400">No passing canary has produced a promotion candidate.</p>}
            </div>

            <div className="mt-4 border-t border-[#25241f] pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-200" />
                <h4 className="text-xs font-bold text-white">Validated rollout ledger</h4>
              </div>
              <div className="mt-2 space-y-2">
                {rollouts.map((rollout) => (
                  <div key={rollout.id} className="border border-[#25241f] bg-[#090907] p-3 text-[9px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-stone-200">{rollout.id.slice(0, 10)}</span>
                      <span className={`border px-2 py-1 font-bold uppercase ${statusTone(rollout.status)}`}>{rollout.environment} · {rollout.status}</span>
                    </div>
                    <p className="mt-2 text-stone-400">runtime_changed={String(rollout.runtime_changed)} · rollback snapshot retained={String(Boolean(rollout.rollback_config && Object.keys(rollout.rollback_config).length))}</p>
                  </div>
                ))}
                {!rollouts.length && <p className="text-[10px] text-stone-400">No validated rollout packages yet.</p>}
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
};

export default HermesGovernancePanel;
