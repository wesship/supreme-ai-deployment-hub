import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Loader2,
  LockKeyhole,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Siren,
  XCircle,
} from 'lucide-react';

import {
  CanaryHttpResult,
  CanaryStatus,
  PrimetimeWorkspace,
  useAgentOsCanary,
} from '@/hooks/useAgentOsCanary';

type StepState = 'pending' | 'running' | 'passed' | 'failed';

interface GuidedStep {
  id: string;
  title: string;
  state: StepState;
  detail: string;
}

const coordinator = 'devonn-coordinator';
const isolatedAgent = 'openclaw-bridge';
const leaseSeconds = 180;

const initialSteps = (): GuidedStep[] => [
  { id: 'baseline', title: 'Verify locked production baseline', state: 'pending', detail: 'Kill switch ON, OpenClaw isolated, zero active approvals.' },
  { id: 'dry-run', title: 'Governance dry-run', state: 'pending', detail: 'No provider execution is permitted.' },
  { id: 'locked-deny', title: 'Prove kill-switch rejection', state: 'pending', detail: 'Real plan dispatch must return HTTP 403.' },
  { id: 'unlock', title: 'Start expiring coordinator lease', state: 'pending', detail: `Server-enforced lease expires automatically after ${leaseSeconds} seconds.` },
  { id: 'plan', title: 'Run plan canary', state: 'pending', detail: 'Low-risk coordinator capability.' },
  { id: 'summarize', title: 'Run summarize canary', state: 'pending', detail: 'Second low-risk coordinator capability.' },
  { id: 'approval', title: 'Prove approval gate', state: 'pending', detail: 'Orchestrate must return HTTP 409 with zero approvals.' },
  { id: 'capability', title: 'Prove capability routing', state: 'pending', detail: 'Capability dispatch must reuse governed named dispatch.' },
  { id: 'evidence', title: 'Verify run-scoped audit evidence', state: 'pending', detail: 'Decision/outcome evidence must match this run and exact successful task IDs.' },
  { id: 'relock', title: 'Re-lock production', state: 'pending', detail: 'Global kill switch returns ON after certification.' },
];

function taskId(result: CanaryHttpResult | null): string | null {
  const value = result?.body?.task_id;
  return typeof value === 'string' && value.trim() ? value : null;
}

export default function PrimetimeAgentOsGuidedCanary() {
  const {
    isLoading,
    error,
    listWorkspaces,
    getStatus,
    dryRun,
    setPolicy,
    startCanaryLease,
    dispatchNamed,
    dispatchCapability,
  } = useAgentOsCanary();

  const [workspaces, setWorkspaces] = useState<PrimetimeWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [status, setStatus] = useState<CanaryStatus | null>(null);
  const [steps, setSteps] = useState<GuidedStep[]>(initialSteps);
  const [running, setRunning] = useState(false);
  const [finalResult, setFinalResult] = useState<'idle' | 'go' | 'no-go'>('idle');
  const [lastRunId, setLastRunId] = useState<string | null>(null);

  const workspace = useMemo(
    () => workspaces.find(item => item.id === workspaceId) ?? null,
    [workspaces, workspaceId]
  );

  const updateStep = (id: string, state: StepState, detail?: string) => {
    setSteps(current => current.map(step => step.id === id ? { ...step, state, detail: detail ?? step.detail } : step));
  };

  const refresh = async (id = workspaceId, runId?: string) => {
    if (!id) return null;
    const next = await getStatus(id, runId);
    if (next && !runId) setStatus(next);
    return next;
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await listWorkspaces();
      if (!rows || cancelled) return;
      setWorkspaces(rows);
      const preferred = rows.find(row => row.slug === 'primetime') ?? rows[0];
      if (!preferred) return;
      setWorkspaceId(preferred.id);
      const next = await getStatus(preferred.id);
      if (!cancelled && next) setStatus(next);
    })();
    return () => { cancelled = true; };
  }, [getStatus, listWorkspaces]);

  const emergencyStop = async (reason: string) => {
    if (!workspaceId) return false;
    const latest = (await getStatus(workspaceId)) ?? status;
    const disabled = Array.from(new Set([...(latest?.policy.disabled_agents ?? []), isolatedAgent]));
    const result = await setPolicy(workspaceId, true, disabled, reason);
    const confirmed = await getStatus(workspaceId);
    if (confirmed) setStatus(confirmed);
    return Boolean(result && confirmed?.policy.kill_switch_enabled && confirmed.policy.disabled_agents.includes(isolatedAgent));
  };

  const fail = async (stepId: string, detail: string, rollbackRequired: boolean) => {
    updateStep(stepId, 'failed', detail);
    setFinalResult('no-go');
    if (rollbackRequired) {
      updateStep('relock', 'running', 'A canary lease may have been issued. Applying Emergency Stop and verifying locked state.');
      const stopped = await emergencyStop('Automatic rollback after guided PRIMETIME production canary failure.');
      updateStep(
        'relock',
        stopped ? 'passed' : 'failed',
        stopped
          ? 'Emergency Stop confirmed: kill switch ON and OpenClaw isolated.'
          : 'Emergency Stop could not be confirmed. The server lease still expires automatically; verify status immediately.'
      );
    }
  };

  const runGuidedCanary = async () => {
    if (!workspaceId || running) return;
    const confirmed = window.confirm(
      `Run the guided PRIMETIME production canary? Any coordinator unlock is a server-enforced ${leaseSeconds}-second lease, OpenClaw remains disabled, and the workflow re-locks production after the run.`
    );
    if (!confirmed) return;

    setRunning(true);
    setFinalResult('idle');
    setSteps(initialSteps());
    const runId = crypto.randomUUID();
    setLastRunId(runId);
    let rollbackRequired = false;
    const successfulTaskIds: string[] = [];

    try {
      updateStep('baseline', 'running');
      const baseline = await refresh();
      if (!baseline) {
        await fail('baseline', 'Unable to read production Agent OS status.', false);
        return;
      }
      const baselineOk = baseline.role === 'workspace_admin'
        && baseline.policy.kill_switch_enabled
        && baseline.policy.disabled_agents.includes(isolatedAgent)
        && baseline.active_approvals.length === 0;
      if (!baselineOk) {
        await fail(
          'baseline',
          `Unsafe baseline: role=${baseline.role}, kill_switch=${baseline.policy.kill_switch_enabled}, OpenClaw_disabled=${baseline.policy.disabled_agents.includes(isolatedAgent)}, approvals=${baseline.active_approvals.length}.`,
          false
        );
        return;
      }
      updateStep('baseline', 'passed', 'Locked baseline confirmed.');

      updateStep('dry-run', 'running');
      const preview = await dryRun(workspaceId, 'plan', coordinator);
      if (!preview || preview.executed !== false) {
        await fail('dry-run', 'Dry-run did not return a non-executing governance result.', false);
        return;
      }
      updateStep('dry-run', 'passed', `${preview.decision.toUpperCase()}: ${preview.reason}`);

      updateStep('locked-deny', 'running');
      const locked = await dispatchNamed(workspaceId, 'plan', {
        goal: 'PRIMETIME guided canary: prove global kill switch blocks provider execution.',
        canary: true,
        canary_run_id: runId,
      });
      if (!locked || locked.status !== 403) {
        await fail('locked-deny', locked ? `Expected HTTP 403, received HTTP ${locked.status}: ${locked.detail}` : 'No locked-dispatch response returned.', false);
        return;
      }
      updateStep('locked-deny', 'passed', `HTTP 403 confirmed: ${locked.detail}`);

      updateStep('unlock', 'running');
      const disabled = Array.from(new Set([...baseline.policy.disabled_agents, isolatedAgent]));
      rollbackRequired = true;
      const lease = await startCanaryLease(
        workspaceId,
        disabled,
        leaseSeconds,
        `Guided canary lease ${runId}: coordinator low-risk capabilities only; OpenClaw remains disabled.`
      );
      if (!lease) {
        await fail('unlock', 'Canary lease request returned no confirmation; rollback is being enforced.', true);
        return;
      }
      const leasedStatus = await refresh();
      const expiry = leasedStatus?.policy.canary_unlock_expires_at
        ? new Date(leasedStatus.policy.canary_unlock_expires_at).getTime()
        : 0;
      if (!leasedStatus || leasedStatus.policy.kill_switch_enabled || !leasedStatus.policy.disabled_agents.includes(isolatedAgent) || expiry <= Date.now()) {
        await fail('unlock', 'Server lease was not confirmed as active with OpenClaw isolated.', true);
        return;
      }
      updateStep('unlock', 'passed', `Coordinator lease active until ${new Date(expiry).toLocaleTimeString()}; server will fail closed after expiry.`);

      updateStep('plan', 'running');
      const plan = await dispatchNamed(workspaceId, 'plan', {
        goal: 'Return a short non-executing validation plan confirming coordinator canary health.',
        constraints: ['No external side effects', 'No writes', 'No downstream orchestration'],
        canary: true,
        canary_run_id: runId,
      });
      const planTaskId = taskId(plan);
      if (!plan?.ok || !planTaskId) {
        await fail('plan', plan ? `HTTP ${plan.status}: ${plan.detail}; task_id=${planTaskId ?? 'missing'}` : 'No plan response.', true);
        return;
      }
      successfulTaskIds.push(planTaskId);
      updateStep('plan', 'passed', `Plan succeeded; task ${planTaskId}.`);

      updateStep('summarize', 'running');
      const summarize = await dispatchNamed(workspaceId, 'summarize', {
        text: 'PRIMETIME Agent OS production canary validates governance, audit-before-execution, approval gating, and rollback.',
        canary: true,
        canary_run_id: runId,
      });
      const summarizeTaskId = taskId(summarize);
      if (!summarize?.ok || !summarizeTaskId) {
        await fail('summarize', summarize ? `HTTP ${summarize.status}: ${summarize.detail}; task_id=${summarizeTaskId ?? 'missing'}` : 'No summarize response.', true);
        return;
      }
      successfulTaskIds.push(summarizeTaskId);
      updateStep('summarize', 'passed', `Summarize succeeded; task ${summarizeTaskId}.`);

      updateStep('approval', 'running');
      const approval = await dispatchNamed(workspaceId, 'orchestrate', {
        goal: 'PRIMETIME guided approval-gate canary. This request must not execute without explicit approval.',
        canary: true,
        canary_run_id: runId,
      });
      if (!approval || approval.status !== 409) {
        await fail('approval', approval ? `Expected HTTP 409, received HTTP ${approval.status}: ${approval.detail}` : 'No approval-gate response.', true);
        return;
      }
      updateStep('approval', 'passed', `HTTP 409 confirmed: ${approval.detail}`);

      updateStep('capability', 'running');
      const capability = await dispatchCapability(workspaceId, 'plan', {
        goal: 'Validate capability dispatch routes through the governed named-agent path without side effects.',
        canary: true,
        canary_run_id: runId,
      });
      const capabilityTaskId = taskId(capability);
      if (!capability?.ok || !capabilityTaskId) {
        await fail('capability', capability ? `HTTP ${capability.status}: ${capability.detail}; task_id=${capabilityTaskId ?? 'missing'}` : 'No capability response.', true);
        return;
      }
      successfulTaskIds.push(capabilityTaskId);
      updateStep('capability', 'passed', `Capability routing succeeded; task ${capabilityTaskId}.`);

      updateStep('evidence', 'running');
      const evidence = await getStatus(workspaceId, runId);
      if (!evidence) {
        await fail('evidence', 'Run-scoped audit evidence could not be loaded.', true);
        return;
      }
      const decisions = evidence.recent_audit.filter(item => item.action === 'agent_os.dispatch.decision');
      const outcomes = evidence.recent_audit.filter(item => item.action === 'agent_os.dispatch.outcome');
      const evidenceForTask = (events: typeof evidence.recent_audit, id: string) =>
        events.some(item => item.metadata.task_id === id && item.metadata.canary_run_id === runId);
      const exactTasksOk = successfulTaskIds.every(id => evidenceForTask(decisions, id) && evidenceForTask(outcomes, id));
      if (decisions.length < 5 || outcomes.length < 3 || !exactTasksOk) {
        await fail(
          'evidence',
          `Run ${runId} evidence incomplete: decisions=${decisions.length}/5, outcomes=${outcomes.length}/3, exact_task_pairs=${exactTasksOk}.`,
          true
        );
        return;
      }
      updateStep('evidence', 'passed', `Run ${runId}: ${decisions.length} decisions, ${outcomes.length} outcomes, all ${successfulTaskIds.length} successful task IDs paired exactly.`);

      updateStep('relock', 'running');
      const stopped = await emergencyStop(`Guided production canary ${runId} completed successfully: restoring locked baseline.`);
      rollbackRequired = false;
      if (!stopped) {
        updateStep('relock', 'failed', 'Explicit re-lock could not be confirmed. Server lease remains the fail-safe; verify status immediately.');
        setFinalResult('no-go');
        return;
      }
      updateStep('relock', 'passed', 'Production re-locked: kill switch ON and OpenClaw isolated.');
      setFinalResult('go');
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : 'Unexpected guided-canary exception.';
      await fail('relock', `Unexpected exception: ${detail}`, rollbackRequired);
    } finally {
      setRunning(false);
    }
  };

  const killSwitchOn = status?.policy.kill_switch_enabled ?? true;
  const openclawDisabled = status?.policy.disabled_agents.includes(isolatedAgent) ?? false;

  return (
    <div className="min-h-screen bg-[#020714] text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-blue-200/70">
              <ShieldCheck className="h-4 w-4" /> PRIMETIME · Guided Production Certification
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Run Safe Agent OS Canary</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
              One authenticated certification run with a server-enforced expiring unlock lease, exact run-scoped audit correlation, and automatic rollback.
            </p>
          </div>
          <button
            type="button"
            onClick={() => emergencyStop('Manual Emergency Stop from guided PRIMETIME production canary console.')}
            disabled={isLoading || !workspaceId}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-300/30 bg-red-500/15 px-5 text-sm font-bold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Siren className="h-5 w-5" /> Emergency Stop
          </button>
        </header>

        {error && <div className="mt-6 rounded-xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <StateCard label="Kill Switch" value={killSwitchOn ? 'ON · LOCKED' : 'OFF · LEASED'} good={killSwitchOn} icon={LockKeyhole} />
          <StateCard label="OpenClaw" value={openclawDisabled ? 'DISABLED' : 'NOT ISOLATED'} good={openclawDisabled} icon={CircleOff} />
          <StateCard label="Approvals" value={String(status?.active_approvals.length ?? 0)} good={(status?.active_approvals.length ?? 0) === 0} icon={ShieldCheck} />
          <StateCard label="Role" value={status?.role ?? 'Loading…'} good={status?.role === 'workspace_admin'} icon={ShieldCheck} />
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="guided-workspace" className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Workspace</label>
              <select
                id="guided-workspace"
                value={workspaceId}
                onChange={async event => {
                  const next = event.target.value;
                  setWorkspaceId(next);
                  setSteps(initialSteps());
                  setFinalResult('idle');
                  const nextStatus = next ? await getStatus(next) : null;
                  if (nextStatus) setStatus(nextStatus);
                }}
                disabled={running}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#081222] px-4 py-3 text-sm text-white"
              >
                {workspaces.map(item => <option key={item.id} value={item.id}>{item.name}{item.slug ? ` (${item.slug})` : ''}</option>)}
              </select>
              {workspace && <p className="mt-2 break-all font-mono text-xs text-white/35">{workspace.id}</p>}
              {lastRunId && <p className="mt-1 break-all font-mono text-xs text-white/35">Last run: {lastRunId}</p>}
            </div>
            <button
              type="button"
              onClick={() => refresh()}
              disabled={running || isLoading || !workspaceId}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-blue-500/10 px-4 text-sm font-semibold text-blue-100"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Status
            </button>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-blue-300/15 bg-blue-500/[0.06] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" />
            <div>
              <h2 className="font-bold">Fail-closed guarantees</h2>
              <p className="mt-1 text-sm leading-6 text-white/60">
                The unlock is a server lease, not a permanent browser-controlled switch. If the tab closes or the response is lost, the backend treats the workspace as locked after lease expiry. Audit certification is scoped to the unique run ID and exact successful task IDs.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold">Certification Sequence</h2>
            <button
              type="button"
              onClick={runGuidedCanary}
              disabled={running || isLoading || !workspaceId}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlayCircle className="h-5 w-5" />}
              {running ? 'Running Safe Canary…' : 'Run Safe Canary'}
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {steps.map((step, index) => <StepRow key={step.id} index={index + 1} step={step} />)}
          </div>
        </section>

        {finalResult !== 'idle' && (
          <section className={`mt-8 rounded-2xl border p-5 ${finalResult === 'go' ? 'border-emerald-300/20 bg-emerald-500/10' : 'border-red-300/20 bg-red-500/10'}`}>
            <div className="flex items-start gap-3">
              {finalResult === 'go' ? <CheckCircle2 className="h-6 w-6 text-emerald-200" /> : <XCircle className="h-6 w-6 text-red-200" />}
              <div>
                <p className="font-black">{finalResult === 'go' ? 'GO · CANARY CERTIFIED' : 'NO-GO · PRODUCTION RE-LOCKED OR LEASE FAIL-SAFE ACTIVE'}</p>
                <p className="mt-1 text-sm text-white/60">Review the step evidence above before expanding any production capability.</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StateCard({ label, value, good, icon: Icon }: { label: string; value: string; good: boolean; icon: typeof ShieldCheck }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/40"><Icon className="h-4 w-4" />{label}</div>
      <p className={`mt-3 text-sm font-black ${good ? 'text-emerald-200' : 'text-amber-200'}`}>{value}</p>
    </div>
  );
}

function StepRow({ index, step }: { index: number; step: GuidedStep }) {
  const icon = step.state === 'running'
    ? <Loader2 className="h-5 w-5 animate-spin text-blue-200" />
    : step.state === 'passed'
      ? <CheckCircle2 className="h-5 w-5 text-emerald-200" />
      : step.state === 'failed'
        ? <XCircle className="h-5 w-5 text-red-200" />
        : <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-[10px] text-white/50">{index}</div>;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
      {icon}
      <div className="min-w-0">
        <p className="font-semibold">{step.title}</p>
        <p className="mt-1 text-sm leading-5 text-white/50">{step.detail}</p>
      </div>
    </div>
  );
}
