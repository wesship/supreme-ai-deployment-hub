import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TestTube2,
  XCircle,
} from 'lucide-react';

import {
  CanaryHttpResult,
  CanaryStatus,
  GovernanceDryRunResult,
  PrimetimeWorkspace,
  useAgentOsCanary,
} from '@/hooks/useAgentOsCanary';

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

const coordinator = 'devonn-coordinator';
const isolatedAgent = 'openclaw-bridge';

function formatTimestamp(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function checkFromHttp(name: string, result: CanaryHttpResult | null, expectedStatus?: number): CheckResult {
  if (!result) return { name, passed: false, detail: 'No response was returned.' };
  const passed = expectedStatus ? result.status === expectedStatus : result.ok;
  return {
    name,
    passed,
    detail: `HTTP ${result.status}: ${result.detail}`,
  };
}

export default function PrimetimeAgentOsCanary() {
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
  const [lastCheck, setLastCheck] = useState<CheckResult | null>(null);
  const [dryRunResult, setDryRunResult] = useState<GovernanceDryRunResult | null>(null);

  const currentWorkspace = useMemo(
    () => workspaces.find(workspace => workspace.id === workspaceId) ?? null,
    [workspaces, workspaceId]
  );

  const refreshStatus = async (id = workspaceId) => {
    if (!id) return;
    const next = await getStatus(id);
    if (next) setStatus(next);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await listWorkspaces();
      if (!rows || cancelled) return;
      setWorkspaces(rows);
      const preferred = rows.find(row => row.slug === 'primetime') ?? rows[0];
      if (preferred) {
        setWorkspaceId(preferred.id);
        const next = await getStatus(preferred.id);
        if (!cancelled && next) setStatus(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getStatus, listWorkspaces]);

  const runDryRun = async () => {
    if (!workspaceId) return;
    const result = await dryRun(workspaceId, 'plan', coordinator);
    setDryRunResult(result);
    if (result) {
      setLastCheck({
        name: 'Governance dry-run',
        passed: result.executed === false,
        detail: `${result.decision.toUpperCase()}: ${result.reason}`,
      });
    }
  };

  const runKillSwitchTest = async () => {
    if (!workspaceId) return;
    if (!status?.policy.kill_switch_enabled) {
      setLastCheck({
        name: 'Kill-switch rejection',
        passed: false,
        detail: 'Kill switch is OFF. Use Emergency Stop before running the locked rejection test.',
      });
      return;
    }
    const result = await dispatchNamed(workspaceId, 'plan', {
      goal: 'PRIMETIME production canary: prove the global kill switch blocks provider execution.',
      canary: true,
    });
    setLastCheck(checkFromHttp('Kill-switch rejection', result, 403));
    await refreshStatus();
  };

  const emergencyStop = async () => {
    if (!workspaceId || !status) return;
    const disabled = Array.from(new Set([...status.policy.disabled_agents, isolatedAgent]));
    const result = await setPolicy(
      workspaceId,
      true,
      disabled,
      'Production canary emergency stop: global Agent OS kill switch enabled from owner console.'
    );
    setLastCheck({
      name: 'Emergency stop',
      passed: Boolean(result),
      detail: result ? 'Global kill switch is ON and OpenClaw remains isolated.' : 'Emergency stop failed.',
    });
    await refreshStatus();
  };

  const unlockCoordinator = async () => {
    if (!workspaceId || !status) return;
    const confirmed = window.confirm(
      'Unlock the coordinator-only production canary? OpenClaw will remain disabled and approval-gated actions remain governed.'
    );
    if (!confirmed) return;
    const disabled = Array.from(new Set([...status.policy.disabled_agents, isolatedAgent]));
    const result = await setPolicy(
      workspaceId,
      false,
      disabled,
      'Owner-approved production canary unlock: coordinator low-risk capabilities only; OpenClaw remains disabled.'
    );
    setLastCheck({
      name: 'Coordinator canary unlock',
      passed: Boolean(result),
      detail: result
        ? 'Global kill switch is OFF for the workspace; OpenClaw remains explicitly disabled.'
        : 'Canary unlock failed.',
    });
    await refreshStatus();
  };

  const runPlanCanary = async () => {
    if (!workspaceId) return;
    if (status?.policy.kill_switch_enabled) {
      setLastCheck({
        name: 'Plan canary',
        passed: false,
        detail: 'Kill switch is ON. Prove the locked rejection first, then use the explicit coordinator unlock.',
      });
      return;
    }
    const result = await dispatchNamed(workspaceId, 'plan', {
      goal: 'Return a short, non-executing validation plan confirming PRIMETIME Agent OS coordinator canary health.',
      constraints: ['No external side effects', 'No writes', 'No downstream orchestration'],
      canary: true,
    });
    setLastCheck(checkFromHttp('Plan canary', result));
    await refreshStatus();
  };

  const runSummarizeCanary = async () => {
    if (!workspaceId) return;
    const result = await dispatchNamed(workspaceId, 'summarize', {
      text: 'PRIMETIME Agent OS production canary validates authenticated governance, audit-before-execution, and rollback controls.',
      canary: true,
    });
    setLastCheck(checkFromHttp('Summarize canary', result));
    await refreshStatus();
  };

  const runApprovalGateTest = async () => {
    if (!workspaceId) return;
    const result = await dispatchNamed(workspaceId, 'orchestrate', {
      goal: 'PRIMETIME approval-gate canary. This request must not execute without explicit approval.',
      canary: true,
    });
    setLastCheck(checkFromHttp('Approval-required gate', result, 409));
    await refreshStatus();
  };

  const runCapabilityCanary = async () => {
    if (!workspaceId) return;
    const result = await dispatchCapability(workspaceId, 'plan', {
      goal: 'Validate capability dispatch routes through the governed named-agent path without side effects.',
      canary: true,
    });
    setLastCheck(checkFromHttp('Capability dispatch canary', result));
    await refreshStatus();
  };

  const killSwitchOn = status?.policy.kill_switch_enabled ?? true;
  const openclawDisabled = status?.policy.disabled_agents.includes(isolatedAgent) ?? false;
  const hasApprovals = Boolean(status?.active_approvals.length);

  return (
    <div className="min-h-screen bg-[#020714] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-blue-200/70">
              <ShieldCheck className="h-4 w-4" />
              PRIMETIME · Owner Operations
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Agent OS Production Canary</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
              Certify the live Agent OS from your authenticated browser without exposing tokens. Every execution request still passes through workspace membership, persisted policy, approval checks, and mandatory pre-dispatch audit evidence.
            </p>
          </div>

          <button
            type="button"
            onClick={emergencyStop}
            disabled={isLoading || !workspaceId}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-300/30 bg-red-500/15 px-5 text-sm font-bold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Siren className="h-5 w-5" />
            Emergency Stop
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            label="Global Kill Switch"
            value={killSwitchOn ? 'ON · LOCKED' : 'OFF · CANARY'}
            good={killSwitchOn}
            icon={killSwitchOn ? LockKeyhole : ShieldAlert}
          />
          <StatusCard
            label="OpenClaw Isolation"
            value={openclawDisabled ? 'DISABLED' : 'NOT ISOLATED'}
            good={openclawDisabled}
            icon={CircleOff}
          />
          <StatusCard
            label="Active Approvals"
            value={String(status?.active_approvals.length ?? 0)}
            good={!hasApprovals}
            icon={ShieldCheck}
          />
          <StatusCard
            label="Workspace Role"
            value={status?.role ?? 'Loading…'}
            good={status?.role === 'workspace_admin'}
            icon={ShieldCheck}
          />
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="canary-workspace" className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
                PRIMETIME Workspace
              </label>
              <select
                id="canary-workspace"
                value={workspaceId}
                onChange={async event => {
                  const next = event.target.value;
                  setWorkspaceId(next);
                  setStatus(null);
                  setLastCheck(null);
                  if (next) await refreshStatus(next);
                }}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#081222] px-4 py-3 text-sm text-white outline-none focus:border-blue-300/40"
              >
                {workspaces.map(workspace => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name} {workspace.slug ? `(${workspace.slug})` : ''}
                  </option>
                ))}
              </select>
              {currentWorkspace && (
                <p className="mt-2 break-all font-mono text-xs text-white/35">{currentWorkspace.id}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => refreshStatus()}
              disabled={isLoading || !workspaceId}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-blue-500/10 px-4 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Evidence
            </button>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2">
            <TestTube2 className="h-5 w-5 text-blue-200" />
            <h2 className="text-xl font-bold">Certification Sequence</h2>
          </div>
          <p className="mt-2 text-sm text-white/50">
            Run these in order. Opening this console never unlocks Agent OS automatically.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ActionCard
              step="1"
              title="Dry-Run Governance"
              description="Preview the real server-resolved decision without provider execution."
              action="Run Dry-Run"
              onClick={runDryRun}
              disabled={isLoading || !workspaceId}
            />
            <ActionCard
              step="2"
              title="Prove Kill Switch"
              description="Send a real governed plan request while locked. PASS requires HTTP 403."
              action="Test Kill Switch"
              onClick={runKillSwitchTest}
              disabled={isLoading || !workspaceId || !killSwitchOn}
            />
            <ActionCard
              step="3"
              title="Coordinator-Only Unlock"
              description="Turn the global switch off while preserving explicit OpenClaw isolation."
              action="Unlock Canary"
              onClick={unlockCoordinator}
              disabled={isLoading || !workspaceId || !killSwitchOn || !openclawDisabled}
              caution
            />
            <ActionCard
              step="4"
              title="Plan Canary"
              description="Execute the lowest-risk no-side-effect coordinator capability."
              action="Run Plan"
              onClick={runPlanCanary}
              disabled={isLoading || !workspaceId || killSwitchOn}
            />
            <ActionCard
              step="5"
              title="Summarize Canary"
              description="Run a second low-risk coordinator capability and verify outcome evidence."
              action="Run Summarize"
              onClick={runSummarizeCanary}
              disabled={isLoading || !workspaceId || killSwitchOn}
            />
            <ActionCard
              step="6"
              title="Approval Gate"
              description="Attempt orchestrate without approval. PASS requires HTTP 409 and no execution."
              action="Test Approval Gate"
              onClick={runApprovalGateTest}
              disabled={isLoading || !workspaceId || killSwitchOn || hasApprovals}
            />
            <ActionCard
              step="7"
              title="Capability Routing"
              description="Verify capability dispatch selects a healthy agent and reuses named governance."
              action="Run Capability Canary"
              onClick={runCapabilityCanary}
              disabled={isLoading || !workspaceId || killSwitchOn}
            />
            <ActionCard
              step="8"
              title="Re-Lock Production"
              description="Return Agent OS to the safest state after certification or on any anomaly."
              action="Emergency Stop"
              onClick={emergencyStop}
              disabled={isLoading || !workspaceId}
              caution
            />
          </div>
        </section>

        {lastCheck && (
          <section
            className={`mt-8 rounded-2xl border p-5 ${
              lastCheck.passed
                ? 'border-emerald-300/20 bg-emerald-500/10'
                : 'border-red-300/20 bg-red-500/10'
            }`}
          >
            <div className="flex items-start gap-3">
              {lastCheck.passed ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-200" />
              )}
              <div>
                <p className="font-bold">{lastCheck.passed ? 'PASS' : 'CHECK FAILED'} · {lastCheck.name}</p>
                <p className="mt-1 text-sm text-white/65">{lastCheck.detail}</p>
              </div>
            </div>
          </section>
        )}

        {dryRunResult && (
          <section className="mt-6 rounded-2xl border border-blue-300/15 bg-blue-500/[0.06] p-5">
            <h2 className="font-bold">Latest Dry-Run</h2>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <Evidence label="Decision" value={dryRunResult.decision.toUpperCase()} />
              <Evidence label="Agent" value={dryRunResult.agent_name} />
              <Evidence label="Executed" value={String(dryRunResult.executed)} />
            </div>
            <p className="mt-4 text-sm text-white/60">{dryRunResult.reason}</p>
          </section>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="font-bold">Active Approvals</h2>
            <p className="mt-1 text-xs text-white/45">Orchestration canary should run with zero approvals.</p>
            <div className="mt-4 space-y-3">
              {!status?.active_approvals.length && (
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-500/[0.06] p-4 text-sm text-emerald-100">
                  No active approvals. Approval-gated actions remain locked.
                </div>
              )}
              {status?.active_approvals.map(approval => (
                <div key={approval.id} className="rounded-xl border border-amber-300/15 bg-amber-500/[0.06] p-4">
                  <p className="font-mono text-sm text-amber-100">{approval.action}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {approval.agent_name ?? 'all agents'} · expires {formatTimestamp(approval.expires_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-bold">Recent Agent OS Audit Evidence</h2>
                <p className="mt-1 text-xs text-white/45">Newest 25 workspace events from the immutable PRIMETIME audit stream.</p>
              </div>
              <button
                type="button"
                onClick={() => refreshStatus()}
                className="rounded-lg border border-white/10 p-2 text-white/60 transition hover:bg-white/5 hover:text-white"
                aria-label="Refresh audit evidence"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1">
              {!status?.recent_audit.length && (
                <p className="rounded-xl border border-white/8 p-4 text-sm text-white/45">No Agent OS audit events found.</p>
              )}
              {status?.recent_audit.map(event => (
                <div key={event.id} className="rounded-xl border border-white/8 bg-black/15 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs font-semibold text-blue-100">{event.action}</p>
                    <p className="text-[11px] text-white/35">{formatTimestamp(event.created_at)}</p>
                  </div>
                  <p className="mt-2 break-all font-mono text-[11px] text-white/35">
                    {event.entity_type ?? 'event'} · {event.entity_id ?? event.id}
                  </p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-white/45">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-500/[0.06] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
            <div>
              <h2 className="font-bold text-amber-100">Production rollout rule</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Do not enable OpenClaw or grant orchestration approval during the coordinator canary. On any unexpected execution, missing pre-dispatch evidence, provider mismatch, or authentication anomaly, use Emergency Stop immediately and investigate before retrying.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  good,
  icon: Icon,
}: {
  label: string;
  value: string;
  good: boolean;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">{label}</p>
        <Icon className={`h-5 w-5 ${good ? 'text-emerald-200' : 'text-amber-200'}`} />
      </div>
      <p className="mt-4 break-words text-lg font-black">{value}</p>
    </div>
  );
}

function ActionCard({
  step,
  title,
  description,
  action,
  onClick,
  disabled,
  caution = false,
}: {
  step: string;
  title: string;
  description: string;
  action: string;
  onClick: () => void | Promise<void>;
  disabled: boolean;
  caution?: boolean;
}) {
  return (
    <div className="flex min-h-56 flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-300/20 bg-blue-500/10 text-xs font-black text-blue-100">
        {step}
      </div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-white/50">{description}</p>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={disabled}
        className={`mt-5 min-h-11 rounded-xl border px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
          caution
            ? 'border-amber-300/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20'
            : 'border-blue-300/20 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20'
        }`}
      >
        {action}
      </button>
    </div>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/15 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-1 break-all font-mono text-sm text-white/75">{value}</p>
    </div>
  );
}
