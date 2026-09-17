import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, FileCheck2, Landmark, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import {
  nonprofitCommandCenterApi,
  type NonprofitApprovalRow,
  type NonprofitApprovalStepRow,
  type NonprofitAuditSummary,
  type NonprofitComplianceAlert,
  type NonprofitGrantPipelineRow,
  type NonprofitOrgSummary,
  type NonprofitProgramSummary,
} from '@/lib/nonprofitCommandCenterApi';

const card = 'rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg shadow-black/20';
const badge = 'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold';
const actionButton = 'rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40';

function money(value: number | null) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function decisionClass(decision?: string) {
  if (decision === 'RED' || decision === 'REJECTED') return 'border-red-500/40 bg-red-500/10 text-red-200';
  if (decision === 'YELLOW' || decision === 'PENDING') return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
}

export default function NonprofitCommandCenter() {
  const [organizations, setOrganizations] = useState<NonprofitOrgSummary[]>([]);
  const [programs, setPrograms] = useState<NonprofitProgramSummary[]>([]);
  const [grants, setGrants] = useState<NonprofitGrantPipelineRow[]>([]);
  const [approvals, setApprovals] = useState<NonprofitApprovalRow[]>([]);
  const [approvalSteps, setApprovalSteps] = useState<NonprofitApprovalStepRow[]>([]);
  const [alerts, setAlerts] = useState<NonprofitComplianceAlert[]>([]);
  const [audit, setAudit] = useState<NonprofitAuditSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingStep, setSubmittingStep] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const result = await nonprofitCommandCenterApi.load();
      setOrganizations(result.organizations);
      setPrograms(result.programs);
      setGrants(result.grants);
      setApprovals(result.approvals);
      setApprovalSteps(result.approvalSteps);
      setAlerts(result.alerts);
      setAudit(result.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load nonprofit command center');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function decide(stepId: string, decision: 'APPROVED' | 'REJECTED' | 'RECUSED') {
    setSubmittingStep(stepId);
    setError('');
    setMessage('');
    try {
      await nonprofitCommandCenterApi.decideApprovalStep(stepId, decision);
      setMessage(`Decision recorded: ${decision}. The action itself was not executed.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval decision was blocked');
    } finally {
      setSubmittingStep('');
    }
  }

  const org = organizations[0];
  const latestAudit = audit[0];
  const redAlerts = useMemo(() => alerts.filter((row) => row.decision === 'RED').length, [alerts]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-cyan-300"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-[0.2em]">D3VONN Nonprofit OS</span></div>
            <h1 className="text-3xl font-semibold tracking-tight">Nonprofit Command Center</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Role-scoped operating view for legal status, programs, GrantAssist/RIPE, approvals, compliance and audit evidence. Truth Vault and sensitive finance records remain outside this surface.</p>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-cyan-400 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </header>

        {error && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className={card}><Landmark className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Organization</p><p className="mt-2 text-lg font-semibold">{org?.display_name || org?.legal_name || 'No authorized organization'}</p><span className={`${badge} mt-3 ${decisionClass(org?.tax_status_state)}`}>{org?.tax_status_state || 'NO ACCESS'}</span></div>
          <div className={card}><Sparkles className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Programs</p><p className="mt-2 text-3xl font-semibold">{org?.program_count ?? programs.length}</p><p className="mt-2 text-sm text-slate-400">Mission-linked program records</p></div>
          <div className={card}><FileCheck2 className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Grant workflows</p><p className="mt-2 text-3xl font-semibold">{org?.active_grant_workflows ?? grants.length}</p><p className="mt-2 text-sm text-slate-400">GrantAssist / RIPE pipeline</p></div>
          <div className={card}><AlertTriangle className="mb-3 h-5 w-5 text-amber-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Compliance</p><p className="mt-2 text-3xl font-semibold">{redAlerts}</p><p className="mt-2 text-sm text-slate-400">RED policy blocks</p></div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className={card}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">GrantAssist / RIPE pipeline</h2><span className="text-xs text-slate-500">{grants.length} workflows</span></div>
            <div className="space-y-3">
              {grants.length === 0 && <p className="text-sm text-slate-500">No authorized grant workflows.</p>}
              {grants.map((row) => <div key={row.workflow_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{row.title}</p><p className="text-sm text-slate-400">{row.funder_name} · {row.geography || 'Geography not set'}</p></div><span className={`${badge} ${decisionClass(row.go_no_go || row.stage)}`}>{row.stage}</span></div><div className="mt-3 grid grid-cols-3 gap-3 text-sm"><div><p className="text-slate-500">Readiness</p><p>{row.readiness_score ?? '—'}</p></div><div><p className="text-slate-500">Range</p><p>{money(row.amount_min)}–{money(row.amount_max)}</p></div><div><p className="text-slate-500">Go/No-Go</p><p>{row.go_no_go || '—'}</p></div></div></div>)}
            </div>
          </div>

          <div className={card}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Approval inbox</h2><span className="text-xs text-slate-500">MFA + role + policy guarded</span></div>
            <div className="space-y-3">
              {approvals.length === 0 && <p className="text-sm text-slate-500">No pending approvals visible to your role.</p>}
              {approvals.map((row) => <div key={row.approval_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{row.action_type.replaceAll('_', ' ')}</p><p className="text-sm text-slate-400">{row.resource_type} · authority: {row.authority_basis || 'not recorded'}</p></div><span className={`${badge} ${decisionClass(row.status)}`}>{row.status}</span></div><div className="mt-3 text-sm text-slate-400">Steps: {row.approved_steps}/{row.total_steps} approved · {row.pending_steps} pending · {row.recused_steps} recused</div></div>)}
            </div>

            <div className="mt-5 border-t border-slate-800 pt-5">
              <h3 className="text-sm font-semibold">Actionable approval steps</h3>
              <p className="mt-1 text-xs text-slate-500">The database re-checks AAL2 MFA, exact nonprofit role, assignment, recusal and latest policy decision. RED policy decisions are blocked.</p>
              <div className="mt-3 space-y-3">
                {approvalSteps.length === 0 && <p className="text-sm text-slate-500">No approval steps are available to your role.</p>}
                {approvalSteps.map((step) => <div key={step.step_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Step {step.step_no} · {step.required_role}</p><p className="text-xs text-slate-500">{step.action_type.replaceAll('_', ' ')}</p></div><span className={`${badge} ${decisionClass(step.decision)}`}>{step.decision}</span></div>{step.decision === 'PENDING' && <div className="mt-4 flex flex-wrap gap-2"><button className={actionButton} disabled={submittingStep === step.step_id} onClick={() => void decide(step.step_id, 'APPROVED')}>Approve</button><button className={actionButton} disabled={submittingStep === step.step_id} onClick={() => void decide(step.step_id, 'REJECTED')}>Reject</button><button className={actionButton} disabled={submittingStep === step.step_id} onClick={() => void decide(step.step_id, 'RECUSED')}>Recuse</button></div>}</div>)}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className={card}><h2 className="mb-4 text-lg font-semibold">Programs + evidence</h2><div className="space-y-3">{programs.map((row) => <div key={row.program_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{row.name}</p><p className="text-sm text-slate-400">{row.country || 'Location not set'} · {row.status}</p></div><BadgeCheck className="h-5 w-5 text-emerald-300" /></div><div className="mt-3 grid grid-cols-3 gap-3 text-sm"><div><p className="text-slate-500">Verified</p><p>{row.verified_evidence_count}</p></div><div><p className="text-slate-500">Supported</p><p>{row.supported_evidence_count}</p></div><div><p className="text-slate-500">Unresolved</p><p>{row.unresolved_evidence_count}</p></div></div></div>)}</div></div>
          <div className={card}><h2 className="mb-4 text-lg font-semibold">Compliance alerts</h2><div className="space-y-3">{alerts.length === 0 && <p className="text-sm text-slate-500">No YELLOW/RED policy alerts visible.</p>}{alerts.map((row) => <div key={row.policy_decision_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{row.action_type.replaceAll('_', ' ')}</p><p className="text-sm text-slate-400">{row.resource_type} · risk {row.risk_level}</p></div><span className={`${badge} ${decisionClass(row.decision)}`}>{row.decision}</span></div><p className="mt-3 text-xs text-slate-500">Policy {row.policy_version} · {new Date(row.evaluated_at).toLocaleString()}</p></div>)}</div></div>
        </section>

        <section className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Audit evidence summary</h2><p className="text-sm text-slate-400">Aggregate-only view; raw audit hashes and payloads stay restricted.</p></div><div className="text-right"><p className="text-2xl font-semibold">{latestAudit?.total_events ?? 0}</p><p className="text-xs text-slate-500">latest summarized events</p></div></div></section>
      </div>
    </div>
  );
}
