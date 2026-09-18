import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, FileCheck2, Landmark, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import {
  nonprofitCommandCenterApi,
  type NonprofitApprovalRow,
  type NonprofitApprovalStepRow,
  type NonprofitAttachmentComplianceRow,
  type NonprofitAuditSummary,
  type NonprofitComplianceAlert,
  type NonprofitGrantPipelineRow,
  type NonprofitOrgSummary,
  type NonprofitProgramSummary,
  type NonprofitSubmissionReadinessRow,
  type NonprofitSubmissionAuthorizationRow,
  type NonprofitSubmissionPreviewRow,
  type NonprofitSubmissionPreviewCertificationRow,
  type NonprofitSubmissionCanaryRow,
  type NonprofitExternalSandboxTransmissionRow,
} from '@/lib/nonprofitCommandCenterApi';

const card = 'rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg shadow-black/20';
const badge = 'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold';
const actionButton = 'rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40';

function money(value: number | null) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function decisionClass(decision?: string) {
  if (decision === 'RED' || decision === 'REJECTED' || decision?.startsWith('BLOCKED')) return 'border-red-500/40 bg-red-500/10 text-red-200';
  if (decision === 'YELLOW' || decision === 'PENDING' || decision === 'OPTIONAL_MISSING') return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
}

export default function NonprofitCommandCenter() {
  const [organizations, setOrganizations] = useState<NonprofitOrgSummary[]>([]);
  const [programs, setPrograms] = useState<NonprofitProgramSummary[]>([]);
  const [grants, setGrants] = useState<NonprofitGrantPipelineRow[]>([]);
  const [approvals, setApprovals] = useState<NonprofitApprovalRow[]>([]);
  const [approvalSteps, setApprovalSteps] = useState<NonprofitApprovalStepRow[]>([]);
  const [alerts, setAlerts] = useState<NonprofitComplianceAlert[]>([]);
  const [attachmentCompliance, setAttachmentCompliance] = useState<NonprofitAttachmentComplianceRow[]>([]);
  const [submissionReadiness, setSubmissionReadiness] = useState<NonprofitSubmissionReadinessRow[]>([]);
  const [submissionAuthorizations, setSubmissionAuthorizations] = useState<NonprofitSubmissionAuthorizationRow[]>([]);
  const [submissionPreviews, setSubmissionPreviews] = useState<NonprofitSubmissionPreviewRow[]>([]);
  const [submissionPreviewCertifications, setSubmissionPreviewCertifications] = useState<NonprofitSubmissionPreviewCertificationRow[]>([]);
  const [submissionCanaries, setSubmissionCanaries] = useState<NonprofitSubmissionCanaryRow[]>([]);
  const [externalSandboxTransmissions, setExternalSandboxTransmissions] = useState<NonprofitExternalSandboxTransmissionRow[]>([]);
  const [authorizationAction, setAuthorizationAction] = useState('');
  const [previewAction, setPreviewAction] = useState('');
  const [certificationAction, setCertificationAction] = useState('');
  const [canaryAction, setCanaryAction] = useState('');
  const [externalSandboxAction, setExternalSandboxAction] = useState('');
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
      setAttachmentCompliance(result.attachmentCompliance);
      setSubmissionReadiness(result.submissionReadiness);
      setSubmissionAuthorizations(result.submissionAuthorizations);
      setSubmissionPreviews(result.submissionPreviews);
      setSubmissionPreviewCertifications(result.submissionPreviewCertifications);
      setSubmissionCanaries(result.submissionCanaries);
      setExternalSandboxTransmissions(result.externalSandboxTransmissions);
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

  async function requestAuthorization(workflowId: string) {
    setAuthorizationAction(workflowId);
    setError('');
    setMessage('');
    try {
      await nonprofitCommandCenterApi.requestSubmissionAuthorization(workflowId);
      setMessage('Submission authorization requested. A separate authorized human must approve it before any external submission can be enabled.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission authorization request was blocked');
    } finally {
      setAuthorizationAction('');
    }
  }

  async function decideAuthorization(authorizationId: string, decision: 'APPROVED' | 'REJECTED') {
    setAuthorizationAction(authorizationId);
    setError('');
    setMessage('');
    try {
      await nonprofitCommandCenterApi.decideSubmissionAuthorization(authorizationId, decision);
      setMessage(`Submission authorization decision recorded: ${decision}. No grant was submitted.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission authorization decision was blocked');
    } finally {
      setAuthorizationAction('');
    }
  }

  async function generatePreview(workflowId: string, connectorKind: 'MANUAL_PACKAGE' | 'GRANTS_GOV_PREVIEW' | 'FUNDER_PORTAL_PREVIEW' = 'MANUAL_PACKAGE') {
    setPreviewAction(workflowId);
    setError('');
    setMessage('');
    try {
      await nonprofitCommandCenterApi.generateSubmissionPreview(workflowId, connectorKind);
      setMessage('Dry-run submission preview generated and hashed. No external transmission was performed.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission preview generation was blocked');
    } finally {
      setPreviewAction('');
    }
  }

  async function certifyPreview(previewId: string, expectedPayloadHash: string) {
    setCertificationAction(previewId);
    setError('');
    setMessage('');
    try {
      await nonprofitCommandCenterApi.certifySubmissionPreview(previewId, expectedPayloadHash);
      setMessage('Preview payload hash certified and frozen. Any later package, readiness, or authorization change invalidates the certification.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview certification was blocked');
    } finally {
      setCertificationAction('');
    }
  }

  async function runCanary(certificationId: string) {
    setCanaryAction(certificationId);
    setError('');
    setMessage('');
    try {
      await nonprofitCommandCenterApi.runSubmissionCanary(certificationId);
      setMessage('Sandbox transmission canary completed with certified payload hash verification. No external network or production destination was used.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission canary was blocked');
    } finally {
      setCanaryAction('');
    }
  }

  async function runExternalSandbox(certificationId: string) {
    setExternalSandboxAction(certificationId);
    setError('');
    setMessage('');
    try {
      await nonprofitCommandCenterApi.runExternalSandboxTransmission(certificationId);
      setMessage('External sandbox connector returned a receipt. Production destinations remain blocked.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'External sandbox transmission was blocked');
    } finally {
      setExternalSandboxAction('');
    }
  }

  const org = organizations[0];
  const latestAudit = audit[0];
  const redAlerts = useMemo(() => alerts.filter((row) => row.decision === 'RED').length, [alerts]);
  const attachmentBlockers = useMemo(() => attachmentCompliance.filter((row) => row.hard_blocker).length, [attachmentCompliance]);
  const attachmentValid = useMemo(() => attachmentCompliance.filter((row) => row.validation_status === 'VALID').length, [attachmentCompliance]);
  const submissionReady = useMemo(() => submissionReadiness.filter((row) => row.submission_status === 'SUBMISSION_READY').length, [submissionReadiness]);
  const submissionBlocked = useMemo(() => submissionReadiness.filter((row) => row.hard_blocker).length, [submissionReadiness]);
  const liveAuthorizations = useMemo(() => submissionAuthorizations.filter((row) => row.authorization_live).length, [submissionAuthorizations]);
  const pendingAuthorizations = useMemo(() => submissionAuthorizations.filter((row) => row.authorization_status === 'PENDING').length, [submissionAuthorizations]);
  const currentPreviews = useMemo(() => submissionPreviews.filter((row) => row.authorization_still_live && row.readiness_still_valid).length, [submissionPreviews]);
  const validCertifications = useMemo(() => submissionPreviewCertifications.filter((row) => row.certification_valid).length, [submissionPreviewCertifications]);
  const passedCanaries = useMemo(() => submissionCanaries.filter((row) => row.canary_passed).length, [submissionCanaries]);
  const certifiedSandboxConnectors = useMemo(() => externalSandboxTransmissions.filter((row) => row.sandbox_connector_certified).length, [externalSandboxTransmissions]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-cyan-300"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-[0.2em]">D3VONN Nonprofit OS</span></div>
            <h1 className="text-3xl font-semibold tracking-tight">Nonprofit Command Center</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Role-scoped operating view for legal status, programs, GrantAssist/RIPE, approvals, attachment compliance, final submission readiness and audit evidence. Truth Vault and sensitive finance records remain outside this surface.</p>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-cyan-400 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </header>

        {error && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-11">
          <div className={card}><Landmark className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Organization</p><p className="mt-2 text-lg font-semibold">{org?.display_name || org?.legal_name || 'No authorized organization'}</p><span className={`${badge} mt-3 ${decisionClass(org?.tax_status_state)}`}>{org?.tax_status_state || 'NO ACCESS'}</span></div>
          <div className={card}><Sparkles className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Programs</p><p className="mt-2 text-3xl font-semibold">{org?.program_count ?? programs.length}</p><p className="mt-2 text-sm text-slate-400">Mission-linked records</p></div>
          <div className={card}><FileCheck2 className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Grant workflows</p><p className="mt-2 text-3xl font-semibold">{org?.active_grant_workflows ?? grants.length}</p><p className="mt-2 text-sm text-slate-400">GrantAssist / RIPE</p></div>
          <div className={card}><FileCheck2 className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Attachments</p><p className="mt-2 text-3xl font-semibold">{attachmentBlockers}</p><p className="mt-2 text-sm text-slate-400">hard blockers</p></div>
          <div className={card}><BadgeCheck className="mb-3 h-5 w-5 text-emerald-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Submission ready</p><p className="mt-2 text-3xl font-semibold">{submissionReady}</p><p className="mt-2 text-sm text-slate-400">{submissionBlocked} blocked</p></div>
          <div className={card}><ShieldCheck className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Human authorization</p><p className="mt-2 text-3xl font-semibold">{liveAuthorizations}</p><p className="mt-2 text-sm text-slate-400">{pendingAuthorizations} pending</p></div>
          <div className={card}><FileCheck2 className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Dry-run previews</p><p className="mt-2 text-3xl font-semibold">{currentPreviews}</p><p className="mt-2 text-sm text-slate-400">hashed, not transmitted</p></div>
          <div className={card}><BadgeCheck className="mb-3 h-5 w-5 text-emerald-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Certified freezes</p><p className="mt-2 text-3xl font-semibold">{validCertifications}</p><p className="mt-2 text-sm text-slate-400">exact hashes locked</p></div>
          <div className={card}><ShieldCheck className="mb-3 h-5 w-5 text-cyan-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Canary receipts</p><p className="mt-2 text-3xl font-semibold">{passedCanaries}</p><p className="mt-2 text-sm text-slate-400">sandbox hash verified</p></div>
          <div className={card}><BadgeCheck className="mb-3 h-5 w-5 text-emerald-300" /><p className="text-xs uppercase tracking-wider text-slate-500">External sandbox</p><p className="mt-2 text-3xl font-semibold">{certifiedSandboxConnectors}</p><p className="mt-2 text-sm text-slate-400">allowlisted receipts</p></div>
          <div className={card}><AlertTriangle className="mb-3 h-5 w-5 text-amber-300" /><p className="text-xs uppercase tracking-wider text-slate-500">Compliance</p><p className="mt-2 text-3xl font-semibold">{redAlerts}</p><p className="mt-2 text-sm text-slate-400">RED policy blocks</p></div>
        </section>

        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Final application QA + submission readiness</h2><p className="mt-1 text-sm text-slate-400">One deterministic verdict across deadline, eligibility/go-no-go, readiness score, attachments, approvals and policy. This view does not submit anything.</p></div><span className={`${badge} ${submissionBlocked > 0 ? decisionClass('BLOCKED') : decisionClass('GREEN')}`}>{submissionBlocked > 0 ? 'BLOCKERS PRESENT' : 'NO HARD BLOCKERS'}</span></div>
          <div className="space-y-3">
            {submissionReadiness.length === 0 && <p className="text-sm text-slate-500">No visible grant workflows have a final readiness evaluation.</p>}
            {submissionReadiness.map((row) => <div key={row.workflow_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{row.title}</p><p className="text-sm text-slate-400">{row.funder_name} · deadline {row.deadline || 'not set'}</p></div><span className={`${badge} ${decisionClass(row.submission_status)}`}>{row.submission_status.replaceAll('_', ' ')}</span></div><div className="mt-3 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6"><div><p className="text-slate-500">Readiness</p><p>{row.readiness_score ?? '—'}%</p></div><div><p className="text-slate-500">Go/No-Go</p><p>{row.go_no_go || '—'}</p></div><div><p className="text-slate-500">Attachments</p><p>{row.valid_attachments}/{row.attachment_requirements}</p></div><div><p className="text-slate-500">Attachment blocks</p><p>{row.attachment_blockers}</p></div><div><p className="text-slate-500">Pending approvals</p><p>{row.pending_approvals}</p></div><div><p className="text-slate-500">RED policy</p><p>{row.red_policy_blocks}</p></div></div>{Object.keys(row.blocker_reasons || {}).length > 0 && <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">Blocker reasons: {Object.entries(row.blocker_reasons).map(([key, value]) => `${key}=${value}`).join(' · ')}</div>}</div>)}
          </div>
        </section>

        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Submission authorization</h2><p className="mt-1 text-sm text-slate-400">Human-in-the-loop control. A request is allowed only for a currently SUBMISSION READY workflow; approval requires AAL2 MFA, can_approve authority, and a different human from the requester.</p></div><span className={`${badge} ${liveAuthorizations > 0 ? decisionClass('GREEN') : decisionClass('PENDING')}`}>{liveAuthorizations > 0 ? `${liveAuthorizations} LIVE` : `${pendingAuthorizations} PENDING`}</span></div>
          <div className="space-y-3">
            {submissionReadiness.filter((row) => row.submission_status === 'SUBMISSION_READY').map((row) => {
              const existing = submissionAuthorizations.find((auth) => auth.workflow_id === row.workflow_id && ['PENDING','APPROVED'].includes(auth.authorization_status));
              return <div key={row.workflow_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{row.title}</p><p className="text-sm text-slate-400">{row.funder_name} · readiness verified</p></div>{existing ? <span className={`${badge} ${decisionClass(existing.authorization_status)}`}>{existing.authorization_status}</span> : <button className={actionButton} disabled={authorizationAction === row.workflow_id} onClick={() => void requestAuthorization(row.workflow_id)}>Request human authorization</button>}</div>{existing && <div className="mt-3 text-sm text-slate-400"><p>Expires: {new Date(existing.expires_at).toLocaleString()}</p>{existing.authorization_status === 'PENDING' && <div className="mt-3 flex flex-wrap gap-2">{existing.requested_by_current_user ? <span className="text-xs text-amber-300">A different authorized human must decide this request.</span> : <><button className={actionButton} disabled={authorizationAction === existing.authorization_id} onClick={() => void decideAuthorization(existing.authorization_id, 'APPROVED')}>Approve authorization</button><button className={actionButton} disabled={authorizationAction === existing.authorization_id} onClick={() => void decideAuthorization(existing.authorization_id, 'REJECTED')}>Reject authorization</button></>}</div>}{existing.authorization_status === 'APPROVED' && <p className="mt-2 text-xs text-emerald-300">Authorization is live. This gate still does not execute or transmit a grant submission.</p>}</div>}</div>;
            })}
            {submissionReadiness.filter((row) => row.submission_status === 'SUBMISSION_READY').length === 0 && <p className="text-sm text-slate-500">No workflows are eligible to request submission authorization.</p>}
          </div>
        </section>

        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Controlled submission preview</h2><p className="mt-1 text-sm text-slate-400">Dry-run only. The system assembles the exact authorized payload and attachment manifest, stores a SHA-256 hash, and performs no network transmission.</p></div><span className={`${badge} ${decisionClass('PENDING')}`}>PREVIEW ONLY</span></div>
          <div className="space-y-3">
            {submissionAuthorizations.filter((auth) => auth.authorization_live).map((auth) => {
              const preview = submissionPreviews.find((row) => row.workflow_id === auth.workflow_id && row.authorization_id === auth.authorization_id);
              return <div key={auth.authorization_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{auth.title}</p><p className="text-sm text-slate-400">{auth.funder_name} · authorization live until {new Date(auth.expires_at).toLocaleString()}</p></div>{preview ? <span className={`${badge} ${decisionClass('GREEN')}`}>PREVIEW GENERATED</span> : <button className={actionButton} disabled={previewAction === auth.workflow_id} onClick={() => void generatePreview(auth.workflow_id, 'MANUAL_PACKAGE')}>Generate dry-run preview</button>}</div>{preview && <div className="mt-3 grid gap-3 text-sm md:grid-cols-3"><div><p className="text-slate-500">Connector</p><p>{preview.connector_kind}</p></div><div><p className="text-slate-500">Payload hash</p><p className="break-all font-mono text-xs">{preview.payload_hash}</p></div><div><p className="text-slate-500">External transmission</p><p>{preview.external_transmission_performed ? 'YES' : 'NO'}</p></div></div>}</div>;
            })}
            {submissionAuthorizations.filter((auth) => auth.authorization_live).length === 0 && <p className="text-sm text-slate-500">No live human authorization is available for preview generation.</p>}
          </div>
        </section>
        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Preview certification + payload freeze</h2><p className="mt-1 text-sm text-slate-400">Certification is bound to the exact SHA-256 preview hash. The current package fingerprint is recomputed; any readiness, attachment, authorization, or payload change invalidates the certification automatically.</p></div><span className={`${badge} ${validCertifications > 0 ? decisionClass('GREEN') : decisionClass('PENDING')}`}>{validCertifications > 0 ? `${validCertifications} VALID` : 'NO VALID CERTIFICATION'}</span></div>
          <div className="space-y-3">
            {submissionPreviews.map((preview) => {
              const certification = submissionPreviewCertifications.find((row) => row.preview_id === preview.preview_id);
              return <div key={preview.preview_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{preview.title}</p><p className="text-sm text-slate-400">{preview.funder_name} · {preview.connector_kind}</p></div>{certification ? <span className={`${badge} ${decisionClass(certification.certification_status.startsWith('INVALID') ? 'BLOCKED' : 'GREEN')}`}>{certification.certification_status.replaceAll('_', ' ')}</span> : <button className={actionButton} disabled={certificationAction === preview.preview_id || !preview.authorization_still_live || !preview.readiness_still_valid} onClick={() => void certifyPreview(preview.preview_id, preview.payload_hash)}>Certify exact payload hash</button>}</div><div className="mt-3 grid gap-3 text-sm md:grid-cols-3"><div><p className="text-slate-500">Preview hash</p><p className="break-all font-mono text-xs">{preview.payload_hash}</p></div><div><p className="text-slate-500">Authorization</p><p>{preview.authorization_still_live ? 'LIVE' : 'EXPIRED'}</p></div><div><p className="text-slate-500">Readiness</p><p>{preview.readiness_still_valid ? 'VALID' : 'CHANGED'}</p></div></div>{certification && <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400"><p>Certified hash: <span className="font-mono">{certification.certified_payload_hash}</span></p><p className="mt-1">Hash still matches: {certification.hash_still_matches ? 'YES' : 'NO'} · Package unchanged: {certification.package_unchanged ? 'YES' : 'NO'} · Expires: {new Date(certification.expires_at).toLocaleString()}</p></div>}</div>;
            })}
            {submissionPreviews.length === 0 && <p className="text-sm text-slate-500">No dry-run preview exists to certify.</p>}
          </div>
        </section>
        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Certified payload transmission canary</h2><p className="mt-1 text-sm text-slate-400">Sandbox-only execution boundary. A valid frozen certification is copied into an internal canary outbox, independently re-hashed at receipt, and accepted only when the received SHA-256 matches the certified hash. No external network or production destination is reachable in this gate.</p></div><span className={`${badge} ${passedCanaries > 0 ? decisionClass('GREEN') : decisionClass('PENDING')}`}>{passedCanaries > 0 ? `${passedCanaries} PASSED` : 'SANDBOX ONLY'}</span></div>
          <div className="space-y-3">
            {submissionPreviewCertifications.filter((certification) => certification.certification_valid).map((certification) => {
              const canary = submissionCanaries.find((row) => row.certification_id === certification.certification_id);
              return <div key={certification.certification_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">Certified payload</p><p className="text-sm text-slate-400">{certification.connector_kind} · exact hash frozen</p></div>{canary ? <span className={`${badge} ${decisionClass(canary.canary_passed ? 'GREEN' : 'BLOCKED')}`}>{canary.canary_passed ? 'CANARY PASSED' : 'CANARY FAILED'}</span> : <button className={actionButton} disabled={canaryAction === certification.certification_id} onClick={() => void runCanary(certification.certification_id)}>Run sandbox canary</button>}</div><div className="mt-3 grid gap-3 text-sm md:grid-cols-3"><div><p className="text-slate-500">Certified hash</p><p className="break-all font-mono text-xs">{certification.certified_payload_hash}</p></div><div><p className="text-slate-500">Destination</p><p>{canary?.destination_kind || 'INTERNAL_SANDBOX_CANARY'}</p></div><div><p className="text-slate-500">Production/network</p><p>{canary ? `${canary.production_destination ? 'PROD' : 'NON-PROD'} / ${canary.external_network_performed ? 'NETWORK' : 'NO NETWORK'}` : 'NON-PROD / NO NETWORK'}</p></div></div>{canary && <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400"><p>Received hash: <span className="font-mono">{canary.received_payload_hash}</span></p><p className="mt-1">Hash verified: {canary.hash_verified ? 'YES' : 'NO'} · Receipt: {canary.receipt_status}</p></div>}</div>;
            })}
            {submissionPreviewCertifications.filter((certification) => certification.certification_valid).length === 0 && <p className="text-sm text-slate-500">No valid certified payload is available for a sandbox canary.</p>}
          </div>
        </section>
        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">External sandbox connector certification</h2><p className="mt-1 text-sm text-slate-400">Network-capable only for an explicitly configured HTTPS sandbox host. Gate 26 must already pass; production Grants.gov/SAM.gov domains are blocked and the endpoint must be allowlisted with a sandbox/test/staging/dev hostname marker.</p></div><span className={`${badge} ${certifiedSandboxConnectors > 0 ? decisionClass('GREEN') : decisionClass('PENDING')}`}>{certifiedSandboxConnectors > 0 ? `${certifiedSandboxConnectors} CERTIFIED` : 'SANDBOX CONFIG REQUIRED'}</span></div>
          <div className="space-y-3">
            {submissionPreviewCertifications.filter((certification) => certification.certification_valid).map((certification) => {
              const canary = submissionCanaries.find((row) => row.certification_id === certification.certification_id && row.canary_passed);
              const transmission = externalSandboxTransmissions.find((row) => row.certification_id === certification.certification_id);
              return <div key={certification.certification_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{certification.connector_kind}</p><p className="text-sm text-slate-400">Certified hash {certification.certified_payload_hash.slice(0, 16)}…</p></div>{transmission ? <span className={`${badge} ${decisionClass(transmission.sandbox_connector_certified ? 'GREEN' : 'BLOCKED')}`}>{transmission.request_status}</span> : <button className={actionButton} disabled={!canary || externalSandboxAction === certification.certification_id} onClick={() => void runExternalSandbox(certification.certification_id)}>Run external sandbox connector</button>}</div>{!canary && !transmission && <p className="mt-3 text-xs text-amber-300">Gate 26 internal canary must pass first.</p>}{transmission && <div className="mt-3 grid gap-3 text-sm md:grid-cols-4"><div><p className="text-slate-500">Host</p><p>{transmission.endpoint_host || '—'}</p></div><div><p className="text-slate-500">HTTP</p><p>{transmission.response_status ?? '—'}</p></div><div><p className="text-slate-500">Idempotency</p><p className="break-all text-xs">{transmission.idempotency_key}</p></div><div><p className="text-slate-500">Production</p><p>{transmission.production_destination ? 'YES' : 'NO'}</p></div></div>}</div>;
            })}
          </div>
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
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Attachment compliance</h2><span className={`${badge} ${attachmentBlockers > 0 ? decisionClass('BLOCKED') : decisionClass('GREEN')}`}>{attachmentBlockers > 0 ? 'NOT SUBMISSION READY' : 'ATTACHMENTS READY'}</span></div>
            <p className="mb-4 text-sm text-slate-400">Required files are matched against verified content, signature, freshness, size, page-count and format rules. Hard failures remain fail-closed.</p>
            <div className="mb-4 grid grid-cols-3 gap-3 text-sm"><div><p className="text-slate-500">Requirements</p><p className="text-lg font-semibold">{attachmentCompliance.length}</p></div><div><p className="text-slate-500">Valid</p><p className="text-lg font-semibold">{attachmentValid}</p></div><div><p className="text-slate-500">Blockers</p><p className="text-lg font-semibold">{attachmentBlockers}</p></div></div>
            <div className="space-y-3">
              {attachmentCompliance.length === 0 && <p className="text-sm text-slate-500">No attachment requirements have been registered for visible workflows.</p>}
              {attachmentCompliance.map((row) => <div key={row.requirement_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{row.requirement_name}</p><p className="text-sm text-slate-400">{row.document_name || 'No document matched'} · {row.source_kind || 'No source'}</p></div><span className={`${badge} ${decisionClass(row.validation_status)}`}>{row.validation_status.replaceAll('_', ' ')}</span></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{row.required ? 'Required' : 'Optional'}</span>{row.must_be_signed && <span>Signature required</span>}{row.must_be_current && <span>Current version required</span>}{row.allowed_formats.length > 0 && <span>Formats: {row.allowed_formats.join(', ')}</span>}{row.max_file_size_mb && <span>Max {row.max_file_size_mb} MB</span>}</div>{row.source_requirement && <p className="mt-2 text-xs text-slate-500">Source: {row.source_requirement}</p>}</div>)}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
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

          <div className={card}><h2 className="mb-4 text-lg font-semibold">Compliance alerts</h2><div className="space-y-3">{alerts.length === 0 && <p className="text-sm text-slate-500">No YELLOW/RED policy alerts visible.</p>}{alerts.map((row) => <div key={row.policy_decision_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{row.action_type.replaceAll('_', ' ')}</p><p className="text-sm text-slate-400">{row.resource_type} · risk {row.risk_level}</p></div><span className={`${badge} ${decisionClass(row.decision)}`}>{row.decision}</span></div><p className="mt-3 text-xs text-slate-500">Policy {row.policy_version} · {new Date(row.evaluated_at).toLocaleString()}</p></div>)}</div></div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className={card}><h2 className="mb-4 text-lg font-semibold">Programs + evidence</h2><div className="space-y-3">{programs.map((row) => <div key={row.program_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{row.name}</p><p className="text-sm text-slate-400">{row.country || 'Location not set'} · {row.status}</p></div><BadgeCheck className="h-5 w-5 text-emerald-300" /></div><div className="mt-3 grid grid-cols-3 gap-3 text-sm"><div><p className="text-slate-500">Verified</p><p>{row.verified_evidence_count}</p></div><div><p className="text-slate-500">Supported</p><p>{row.supported_evidence_count}</p></div><div><p className="text-slate-500">Unresolved</p><p>{row.unresolved_evidence_count}</p></div></div></div>)}</div></div>
          <section className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Audit evidence summary</h2><p className="text-sm text-slate-400">Aggregate-only view; raw audit hashes and payloads stay restricted.</p></div><div className="text-right"><p className="text-2xl font-semibold">{latestAudit?.total_events ?? 0}</p><p className="text-xs text-slate-500">latest summarized events</p></div></div></section>
        </section>
      </div>
    </div>
  );
}
