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
  CanaryStatus,
  PrimetimeWorkspace,
  useAgentOsCanary,
} from '@/hooks/useAgentOsCanary';

type StepState = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

interface GuidedStep {
  id: string;
  title: string;
  state: StepState;
  detail: string;
}

const coordinator = 'devonn-coordinator';
const isolatedAgent = 'openclaw-bridge';

const initialSteps = (): GuidedStep[] => [
  { id: 'baseline', title: 'Verify locked production baseline', state: 'pending', detail: 'Kill switch ON, OpenClaw isolated, zero active approvals.' },
  { id: 'dry-run', title: 'Governance dry-run', state: 'pending', detail: 'No provider execution is permitted.' },
  { id: 'locked-deny', title: 'Prove kill-switch rejection', state: 'pending', detail: 'Real plan dispatch must return HTTP 403.' },
  { id: 'unlock', title: 'Coordinator-only unlock', state: 'pending', detail: 'OpenClaw remains explicitly disabled.' },
  { id: 'plan', title: 'Run plan canary', state: 'pending', detail: 'Low-risk coordinator capability.' },
  { id: 'summarize', title: 'Run summarize canary', state: 'pending', detail: 'Second low-risk coordinator capability.' },
  { id: 'approval', title: 'Prove approval gate', state: 'pending', detail: 'Orchestrate must return HTTP 409 with zero approvals.' },
  { id: 'capability', title: 'Prove capability routing', state: 'pending', detail: 'Capability dispatch must reuse governed named dispatch.' },
  { id: 'evidence', title: 'Verify audit evidence', state: 'pending', detail: 'Decision and outcome evidence must be present.' },
  { id: 'relock', title: 'Re-lock production', state: 'pending', detail: 'Global kill switch returns ON after certification.' },
];

export default function PrimetimeAgentOsGuidedCanary() {
  const {
    isLoading,
    error,
    listWorkspaces,
    getStatus,
    dryRun,
    setPolicy,
    dispatchNamed,
    dispatchCapability,
  } = useAgentOsCanary();

  const [workspaces, setWorkspaces] = useState<PrimetimeWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [status, setStatus] = useState<CanaryStatus | null>(null);
  const [steps, setSteps] = useState<GuidedStep[]>(initialSteps);
  const [running, setRunning] = useState(false);
  const [finalResult, setFinalResult] = useState<'idle' | 'go' | 'no-go'>('idle');

  const workspace = useMemo(
    () => workspaces.find(item => item.id === workspaceId) ?? null,
    [workspaces, workspaceId]
  );

  const updateStep = (id: string, state: StepState, detail?: string) => {
    setSteps(current =>
      current.map(step =>
        step.id === id ? { ...step, state, detail: detail ?? step.detail } : step
      )
    );
  };

  const refresh = async (id = workspaceId) => {
    if (!id) return null;
    const next = await getStatus(id);
    if (next) setStatus(next);
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
    return () => {
      cancelled = true;
    };
  }, [getStatus, listWorkspaces]);

  const emergencyStop = async (reason: string) => {
    if (!workspaceId) return false;
    const latest = (await getStatus(workspaceId)) ?? status;
    const disabled = Array.from(new Set([...(latest?.policy.disabled_agents ?? []), isolatedAgent]));
    const result = await setPolicy(workspaceId, true, disabled, reason);
    await refresh();
    return Boolean(result);
  };

  const fail = async (stepId: string, detail: string, unlocked: boolean) => {
    updateStep(stepId, 'failed', detail);
    setFinalResult('no-go');
    if (unlocked) {
      updateStep('relock', 'running', 'Unexpected result detected. Emergency Stop is being applied automatically.');
      const stopped = await emergencyStop('Automatic production canary rollback after an unexpected guided-canary result.');
      updateStep(
        'relock',
        stopped ? 'passed' : 'failed',
        stopped ? 'Emergency Stop applied. Global kill switch is ON.' : 'Automatic Emergency Stop failed. Use the visible Emergency Stop control immediately.'
      );
    }
  };

  const runGuidedCanary = async () => {
    if (!workspaceId || running) return;
    const confirmed = window.confirm(
      'Run the guided PRIMETIME production canary? The workflow will briefly unlock only the coordinator, keep OpenClaw disabled, stop on the first unexpected result, and re-lock production automatically at the end.'
    );
    if (!confirmed) return;

    setRunning(true);
    setFinalResult('idle');
    setSteps(initialSteps());
    let unlocked = false;

    try {
      updateStep('baseline', 'running');
      const baseline = await refresh();
      if (!baseline) {
        await fail('baseline', 'Unable to read production Agent OS status.', false);
        return;
      }
      const baselineOk =
        baseline.role === 'workspace_admin' &&
        baseline.policy.kill_switch_enabled &&
        baseline.policy.disabled_agents.includes(isolatedAgent) &&
        baseline.active_approvals.length === 0;
      if (!baselineOk) {
        await fail(
          'baseline',
          `Unsafe baseline: role=${baseline.role}, kill_switch=${baseline.policy.kill_switch_enabled}, OpenClaw_disabled=${baseline.policy.disabled_agents.includes(isolatedAgent)}, approvals=${baseline.active_approvals.length}.`,
          false
        );
        return;
      }
      updateStep('baseline', 'passed', 'Locked baseline confirmed: workspace_admin, kill switch ON, OpenClaw disabled, zero approvals.');

      updateStep('dry-run', 'running');
      const preview = await dryRun(workspaceId, 'plan', coordinator);
      if (!preview || preview.executed !== false) {
        await fail('dry-run', 'Dry-run did not return a non-executing governance result.', false);
        return;
      }
      updateStep('dry-run', 'passed', `${preview.decision.toUpperCase()}: ${preview.reason}`);

      updateStep('locked-deny', 'running');
      const locked = await dispatchNamed(workspaceId, 'plan', {
        goal: 'PRIMETIME guided production canary: prove the global kill switch blocks provider execution.',
        canary: true,
      });
      if (!locked || locked.status !== 403) {
        await fail('locked-deny', locked ? `Expected HTTP 403, received HTTP ${locked.status}: ${locked.detail}` : 'No locked-dispatch response returned.', false);
        return;
      }
      updateStep('locked-deny', 'passed', `HTTP 403 confirmed: ${locked.detail}`);

      updateStep('unlock', 'running');
      const disabled = Array.from(new Set([...baseline.policy.disabled_agents, isolatedAgent]));
      const unlock = await setPolicy(
        workspaceId,
        false,
        disabled,
        'Guided owner-approved production canary unlock: coordinator low-risk capabilities only; OpenClaw remains disabled.'
      );
      if (!unlock) {
        await fail('unlock', 'Coordinator-only unlock request failed.', false);
        return;
      }
      unlocked = true;
      const unlockedStatus = await refresh();
      if (!unlockedStatus || unlockedStatus.policy.kill_switch_enabled || !unlockedStatus.policy.disabled_agents.includes(isolatedAgent)) {
        await fail('unlock', 'Post-unlock policy verification failed.', true);
        return;
      }
      updateStep('unlock', 'passed', 'Coordinator unlocked; OpenClaw remains explicitly disabled.');

      updateStep('plan', 'running');
      const plan = await dispatchNamed(workspaceId, 'plan', {
        goal: 'Return a short, non-executing validation plan confirming PRIMETIME Agent OS coordinator canary health.',
        constraints: ['No external side effects', 'No writes', 'No downstream orchestration'],
        canary: true,
      });
      if (!plan?.ok) {
        await fail('plan', plan ? `HTTP ${plan.status}: ${plan.detail}` : 'No plan-canary response returned.', true);
        return;
      }
      updateStep('plan', 'passed', `HTTP ${plan.status}: coordinator plan canary succeeded.`);

      updateStep('summarize', 'running');
      const summarize = await dispatchNamed(workspaceId, 'summarize', {
        text: 'PRIMETIME Agent OS production canary validates authenticated governance, audit-before-execution, approval gating, and rollback controls.',
        canary: true,
      });
      if (!summarize?.ok) {
        await fail('summarize', summarize ? `HTTP ${summarize.status}: ${summarize.detail}` : 'No summarize-canary response returned.', true);
        return;
      }
      updateStep('summarize', 'passed', `HTTP ${summarize.status}: coordinator summarize canary succeeded.`);

      updateStep('approval', 'running');
      const approval = await dispatchNamed(workspaceId, 'orchestrate', {
        goal: 'PRIMETIME guided approval-gate canary. This request must not execute without explicit approval.',
        canary: true,
      });
      if (!approval || approval.status !== 409) {
        await fail('approval', approval ? `Expected HTTP 409, received HTTP ${approval.status}: ${approval.detail}` : 'No approval-gate response returned.', true);
        return;
      }
      updateStep('approval', 'passed', `HTTP 409 confirmed: ${approval.detail}`);

      updateStep('capability', 'running');
      const capability = await dispatchCapability(workspaceId, 'plan', {
        goal: 'Validate capability dispatch routes through the governed named-agent path without side effects.',
        canary: true,
      });
      if (!capability?.ok) {
        await fail('capability', capability ? `HTTP ${capability.status}: ${capability.detail}` : 'No capability-canary response returned.', true);
        return;
      }
      updateStep('capability', 'passed', `HTTP ${capability.status}: governed capability dispatch succeeded.`);

      updateStep('evidence', 'running');
      const evidence = await refresh();
      const decisions = evidence?.recent_audit.filter(item => item.action === 'agent_os.dispatch.decision') ?? [];
      const outcomes = evidence?.recent_audit.filter(item => item.action === 'agent_os.dispatch.outcome') ?? [];
      if (decisions.length < 4 || outcomes.length < 3) {
        await fail(
          'evidence',
          `Expected recent governance evidence was incomplete: decisions=${decisions.length}, outcomes=${outcomes.length}.`,
          true
        );
        return;
      }
      updateStep('evidence', 'passed', `Recent immutable evidence found: ${decisions.length} decisions and ${outcomes.length} outcomes.`);

      updateStep('relock', 'running');
      const stopped = await emergencyStop('Guided production canary completed successfully: returning Agent OS to locked baseline.');
      unlocked = false;
      if (!stopped) {
        updateStep('relock', 'failed', 'Canary checks passed, but automatic re-lock failed. Use Emergency Stop immediately.');
        setFinalResult('no-go');
        return;
      }
      const finalStatus = await refresh();
      if (!finalStatus?.policy.kill_switch_enabled || !finalStatus.policy.disabled_agents.includes(isolatedAgent)) {
        updateStep('relock', 'failed', 'Final policy verification did not confirm the locked baseline.');
        setFinalResult('no-go');
        return;
      }
      updateStep('relock', 'passed', 'Production re-locked: kill switch ON and OpenClaw isolated.');
      setFinalResult('go');
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : 'Unexpected guided-canary exception.';
      setFinalResult('no-go');
      if (unlocked) {
        updateStep('relock', 'running', `Unexpected exception: ${detail}. Applying Emergency Stop.`);
        const stopped = await emergencyStop('Automatic rollback after guided production canary exception.');
        updateStep('relock', stopped ? 'passed' : 'failed', stopped ? 'Emergency Stop applied after exception.' : 'Emergency Stop failed after exception.');
      }
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
              <ShieldCheck className="h-4 w-4" />
              PRIMETIME · Guided Production Certification
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Run Safe Agent OS Canary</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
              One guided, fail-closed certification run using your authenticated D3VONN session. The workflow starts locked, briefly unlocks only the coordinator, stops on the first unexpected result, and re-locks production automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => emergencyStop('Manual Emergency Stop from guided PRIMETIME production canary console.')}
            disabled={isLoading || !workspaceId}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-300/30 bg-red-500/15 px-5 text-sm font-bold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Siren className="h-5 w-5" />
            Emergency Stop
          </button>
        </header>

        {error && (
          <div className="mt-6 rounded-xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <StateCard label="Kill Switch" value={killSwitchOn ? 'ON · LOCKED' : 'OFF · CANARY'} good={killSwitchOn} icon={LockKeyhole} />
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
                disabled={running}
                onChange={async event => {
                  const next = event.target.value;
                  setWorkspaceId(next);
                  setSteps(initialSteps());
                  setFinalResult('idle');
                  if (next) await refresh(next);
                }}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#081222] px-4 py-3 text-sm text-white outline-none focus:border-blue-300/40"
              >
                {workspaces.map(item => <option key={item.id} value={item.id}>{item.name} {item.slug ? `(${item.slug})` : ''}</option>)}
              </select>
              {workspace && <p className="mt-2 break-all font-mono text-xs text-white/35">{workspace.id}</p>}
            </div>
            <button
              type="button"
              onClick={() => refresh()}
              disabled={running || isLoading || !workspaceId}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-blue-500/10 px-4 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Status
            </button>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-blue-300/15 bg-blue-500/[0.06] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Guided fail-closed run</h2>
              <p className="mt-1 text-sm text-white/55">Requires a locked baseline. Production is automatically re-locked after a successful run.</p>
            </div>
            <button
              type="button"
              onClick={runGuidedCanary}
              disabled={running || isLoading || !workspaceId}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-[0_0_28px_rgba(37,99,235,0.32)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlayCircle className="h-5 w-5" />}
              {running ? 'Running Safe Canary…' : 'Run Safe Canary'}
            </button>
          </div>
        </section>

        {finalResult !== 'idle' && (
          <section className={`mt-6 rounded-2xl border p-5 ${finalResult === 'go' ? 'border-emerald-300/25 bg-emerald-500/10' : 'border-red-300/25 bg-red-500/10'}`}>
            <div className="flex items-start gap-3">
              {finalResult === 'go' ? <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-200" /> : <AlertTriangle className="mt-0.5 h-6 w-6 text-red-200" />}
              <div>
                <p className="font-black">{finalResult === 'go' ? 'CANARY GO · PRODUCTION RE-LOCKED' : 'CANARY NO-GO · REVIEW REQUIRED'}</p>
                <p className="mt-1 text-sm text-white/60">{finalResult === 'go' ? 'All guided checks passed and the global kill switch was restored to ON.' : 'At least one required check failed. Production should remain locked until the failure is reviewed.'}</p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-8 space-y-3">
          {steps.map((step, index) => <StepRow key={step.id} index={index + 1} step={step} />)}
        </section>

        <section className="mt-8 rounded-2xl border border-amber-300/15 bg-amber-500/[0.06] p-5 text-sm text-amber-50/80">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
            <p>
              This workflow never enables OpenClaw, never grants an approval, and never leaves Agent OS intentionally unlocked after the run. If automatic rollback cannot be confirmed, use <strong>Emergency Stop</strong> immediately and treat the certification as NO-GO.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function StateCard({ label, value, good, icon: Icon }: { label: string; value: string; good: boolean; icon: typeof ShieldCheck }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/40">{label}</p>
        <Icon className={`h-4 w-4 ${good ? 'text-emerald-300' : 'text-amber-300'}`} />
      </div>
      <p className={`mt-3 text-sm font-black ${good ? 'text-emerald-100' : 'text-amber-100'}`}>{value}</p>
    </div>
  );
}

function StepRow({ index, step }: { index: number; step: GuidedStep }) {
  const icon =
    step.state === 'passed' ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> :
    step.state === 'failed' ? <XCircle className="h-5 w-5 text-red-300" /> :
    step.state === 'running' ? <Loader2 className="h-5 w-5 animate-spin text-blue-300" /> :
    <div className="h-5 w-5 rounded-full border border-white/20" />;

  return (
    <div className={`flex items-start gap-4 rounded-2xl border p-4 ${step.state === 'failed' ? 'border-red-300/20 bg-red-500/[0.07]' : step.state === 'passed' ? 'border-emerald-300/15 bg-emerald-500/[0.05]' : 'border-white/10 bg-white/[0.025]'}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-xs font-black text-white/50">{index}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="font-bold text-white">{step.title}</p>
          {icon}
        </div>
        <p className="mt-1 text-sm leading-6 text-white/50">{step.detail}</p>
      </div>
    </div>
  );
}
