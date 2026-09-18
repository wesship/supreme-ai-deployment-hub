import { supabase } from '@/integrations/supabase/client';

export type NonprofitOrgSummary = {
  organization_id: string;
  legal_name: string;
  display_name: string | null;
  jurisdiction: string | null;
  tax_status: string | null;
  tax_status_state: string;
  public_charity_classification: string | null;
  mission: string | null;
  website: string | null;
  fiscal_year_end: number | null;
  program_count: number;
  active_grant_workflows: number;
  pending_approvals: number;
  open_policy_alerts: number;
};

export type NonprofitProgramSummary = {
  program_id: string;
  organization_id: string;
  program_code: string;
  name: string;
  mission_category: string | null;
  description: string | null;
  country: string | null;
  region: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  approved_budget: number | null;
  verified_evidence_count: number;
  supported_evidence_count: number;
  unresolved_evidence_count: number;
};

export type NonprofitGrantPipelineRow = {
  workflow_id: string;
  organization_id: string;
  opportunity_id: string;
  funder_name: string;
  title: string;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  geography: string | null;
  opportunity_status: string;
  stage: string;
  readiness_score: number | null;
  go_no_go: string | null;
  workflow_status: string;
  started_at: string;
  submitted_at: string | null;
};

export type NonprofitApprovalRow = {
  approval_id: string;
  organization_id: string;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  authority_basis: string | null;
  amount_limit: number | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  total_steps: number;
  approved_steps: number;
  pending_steps: number;
  recused_steps: number;
};

export type NonprofitApprovalStepRow = {
  step_id: string;
  approval_id: string;
  organization_id: string;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  step_no: number;
  required_role: string;
  approver_user_id: string | null;
  decision: string;
  decided_at: string | null;
  approval_status: string;
  expires_at: string | null;
};

export type NonprofitComplianceAlert = {
  policy_decision_id: string;
  organization_id: string;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  risk_level: number;
  decision: 'GREEN' | 'YELLOW' | 'RED';
  reason_codes: unknown;
  policy_version: string;
  evaluated_at: string;
};

export type NonprofitAttachmentComplianceRow = {
  requirement_id: string;
  organization_id: string;
  workflow_id: string;
  requirement_name: string;
  required: boolean;
  allowed_formats: string[];
  max_file_size_mb: number | null;
  max_pages: number | null;
  must_be_signed: boolean;
  must_be_current: boolean;
  max_age_days: number | null;
  source_requirement: string | null;
  match_id: string | null;
  document_reference: string | null;
  document_name: string | null;
  source_kind: 'VAULT' | 'UPLOAD' | 'GENERATED' | null;
  mime_type: string | null;
  file_size_mb: number | null;
  page_count: number | null;
  document_date: string | null;
  expires_at: string | null;
  signature_verified: boolean | null;
  content_verified: boolean | null;
  content_match_confidence: number | null;
  validation_notes: string | null;
  validation_status:
    | 'VALID'
    | 'OPTIONAL_MISSING'
    | 'BLOCKED_MISSING'
    | 'BLOCKED_UNVERIFIED_CONTENT'
    | 'BLOCKED_UNSIGNED'
    | 'BLOCKED_EXPIRED'
    | 'BLOCKED_STALE'
    | 'BLOCKED_FILE_SIZE'
    | 'BLOCKED_PAGE_COUNT'
    | 'BLOCKED_FILE_TYPE';
  hard_blocker: boolean;
};

export type NonprofitSubmissionReadinessRow = {
  workflow_id: string;
  organization_id: string;
  opportunity_id: string;
  funder_name: string;
  title: string;
  deadline: string | null;
  stage: string;
  workflow_status: string;
  readiness_score: number | null;
  go_no_go: string | null;
  submitted_at: string | null;
  attachment_requirements: number;
  valid_attachments: number;
  attachment_blockers: number;
  pending_approvals: number;
  rejected_approvals: number;
  red_policy_blocks: number;
  yellow_policy_warnings: number;
  submission_status: string;
  blocker_reasons: Record<string, string>;
  hard_blocker: boolean;
};

export type NonprofitSubmissionAuthorizationRow = {
  authorization_id: string;
  organization_id: string;
  workflow_id: string;
  funder_name: string;
  title: string;
  submission_status: string;
  requested_by: string;
  requested_at: string;
  request_notes: string | null;
  authorization_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  expires_at: string;
  requested_by_current_user: boolean;
  authorization_live: boolean;
};

export type NonprofitSubmissionPreviewRow = {
  preview_id: string;
  organization_id: string;
  workflow_id: string;
  funder_name: string;
  title: string;
  authorization_id: string;
  connector_kind: 'MANUAL_PACKAGE' | 'GRANTS_GOV_PREVIEW' | 'FUNDER_PORTAL_PREVIEW';
  payload_hash: string;
  payload: Record<string, unknown>;
  attachment_manifest: unknown[];
  generated_by: string;
  generated_at: string;
  authorization_expires_at: string;
  readiness_snapshot: Record<string, unknown>;
  status: 'PREVIEW';
  authorization_still_live: boolean;
  readiness_still_valid: boolean;
  external_transmission_performed: false;
};

export type NonprofitSubmissionPreviewCertificationRow = {
  certification_id: string;
  organization_id: string;
  workflow_id: string;
  preview_id: string;
  authorization_id: string;
  connector_kind: 'MANUAL_PACKAGE' | 'GRANTS_GOV_PREVIEW' | 'FUNDER_PORTAL_PREVIEW';
  preview_payload_hash: string;
  current_payload_hash: string;
  certified_payload_hash: string;
  certified_by: string;
  certified_at: string;
  expires_at: string;
  certification_notes: string | null;
  authorization_still_live: boolean;
  readiness_still_valid: boolean;
  package_unchanged: boolean;
  hash_still_matches: boolean;
  certification_status: string;
  certification_valid: boolean;
  frozen_payload: Record<string, unknown>;
  frozen_attachment_manifest: unknown[];
  frozen_readiness_snapshot: Record<string, unknown>;
};

export type NonprofitSubmissionCanaryRow = {
  canary_outbox_id: string;
  canary_receipt_id: string;
  organization_id: string;
  workflow_id: string;
  certification_id: string;
  preview_id: string;
  connector_kind: 'MANUAL_PACKAGE' | 'GRANTS_GOV_PREVIEW' | 'FUNDER_PORTAL_PREVIEW';
  destination_kind: 'INTERNAL_SANDBOX_CANARY';
  certified_payload_hash: string;
  received_payload_hash: string;
  hash_verified: boolean;
  receipt_status: 'HASH_VERIFIED' | 'HASH_MISMATCH';
  dispatched_by: string;
  dispatched_at: string;
  received_at: string;
  external_network_performed: false;
  production_destination: false;
  certification_status: string;
  certification_valid: boolean;
  canary_passed: boolean;
};

export type NonprofitExternalSandboxTransmissionRow = {
  transmission_id: string;
  organization_id: string;
  workflow_id: string;
  certification_id: string;
  preview_id: string;
  connector_kind: 'MANUAL_PACKAGE' | 'GRANTS_GOV_PREVIEW' | 'FUNDER_PORTAL_PREVIEW';
  payload_hash: string;
  idempotency_key: string;
  requested_by: string;
  requested_at: string;
  endpoint_host: string | null;
  request_status: 'REQUESTED' | 'SENT' | 'ACKNOWLEDGED' | 'FAILED' | 'BLOCKED';
  response_status: number | null;
  response_body_hash: string | null;
  response_receipt: Record<string, unknown> | null;
  completed_at: string | null;
  production_destination: false;
  certification_status: string;
  certification_valid: boolean;
  sandbox_connector_certified: boolean;
};

export type NonprofitAuditSummary = {
  organization_id: string;
  event_day: string;
  total_events: number;
  blocked_or_denied_events: number;
  distinct_actors: number;
  approval_linked_events: number;
};

async function listView<T>(view: string): Promise<T[]> {
  const { data, error } = await (supabase as any).from(view).select('*');
  if (error) throw error;
  return (data ?? []) as T[];
}

export const nonprofitCommandCenterApi = {
  async load() {
    const [organizations, programs, grants, approvals, approvalSteps, alerts, attachmentCompliance, submissionReadiness, submissionAuthorizations, submissionPreviews, submissionPreviewCertifications, submissionCanaries, externalSandboxTransmissions, audit] = await Promise.all([
      listView<NonprofitOrgSummary>('nonprofit_command_org_v1'),
      listView<NonprofitProgramSummary>('nonprofit_programs_v1'),
      listView<NonprofitGrantPipelineRow>('nonprofit_grant_pipeline_v1'),
      listView<NonprofitApprovalRow>('nonprofit_pending_approvals_v1'),
      listView<NonprofitApprovalStepRow>('nonprofit_approval_steps_v1'),
      listView<NonprofitComplianceAlert>('nonprofit_compliance_alerts_v1'),
      listView<NonprofitAttachmentComplianceRow>('nonprofit_attachment_compliance_v1'),
      listView<NonprofitSubmissionReadinessRow>('nonprofit_submission_readiness_v1'),
      listView<NonprofitSubmissionAuthorizationRow>('nonprofit_submission_authorizations_v1'),
      listView<NonprofitSubmissionPreviewRow>('nonprofit_submission_previews_v1'),
      listView<NonprofitSubmissionPreviewCertificationRow>('nonprofit_submission_preview_certifications_v1'),
      listView<NonprofitSubmissionCanaryRow>('nonprofit_submission_canaries_v1'),
      listView<NonprofitExternalSandboxTransmissionRow>('nonprofit_external_sandbox_transmissions_v1'),
      listView<NonprofitAuditSummary>('nonprofit_audit_summary_v1'),
    ]);
    return { organizations, programs, grants, approvals, approvalSteps, alerts, attachmentCompliance, submissionReadiness, submissionAuthorizations, submissionPreviews, submissionPreviewCertifications, submissionCanaries, externalSandboxTransmissions, audit };
  },

  async runExternalSandboxTransmission(certificationId: string) {
    const { data, error } = await supabase.functions.invoke('nonprofit-submission-sandbox', {
      body: { certification_id: certificationId },
    });
    if (error) throw error;
    return data;
  },

  async runSubmissionCanary(certificationId: string) {
    const { data, error } = await (supabase as any).rpc('nonprofit_run_submission_canary', {
      p_certification_id: certificationId,
    });
    if (error) throw error;
    return data;
  },

  async certifySubmissionPreview(previewId: string, expectedPayloadHash: string, notes?: string) {
    const { data, error } = await (supabase as any).rpc('nonprofit_certify_submission_preview', {
      p_preview_id: previewId,
      p_expected_payload_hash: expectedPayloadHash,
      p_notes: notes ?? null,
    });
    if (error) throw error;
    return data;
  },

  async generateSubmissionPreview(workflowId: string, connectorKind: 'MANUAL_PACKAGE' | 'GRANTS_GOV_PREVIEW' | 'FUNDER_PORTAL_PREVIEW' = 'MANUAL_PACKAGE') {
    const { data, error } = await (supabase as any).rpc('nonprofit_generate_submission_preview', {
      p_workflow_id: workflowId,
      p_connector_kind: connectorKind,
    });
    if (error) throw error;
    return data;
  },

  async requestSubmissionAuthorization(workflowId: string, notes?: string) {
    const { data, error } = await (supabase as any).rpc('nonprofit_request_submission_authorization', {
      p_workflow_id: workflowId,
      p_notes: notes ?? null,
    });
    if (error) throw error;
    return data;
  },

  async decideSubmissionAuthorization(authorizationId: string, decision: 'APPROVED' | 'REJECTED', notes?: string) {
    const { data, error } = await (supabase as any).rpc('nonprofit_decide_submission_authorization', {
      p_authorization_id: authorizationId,
      p_decision: decision,
      p_notes: notes ?? null,
    });
    if (error) throw error;
    return data;
  },

  async decideApprovalStep(stepId: string, decision: 'APPROVED' | 'REJECTED' | 'RECUSED', notes?: string) {
    const { data, error } = await (supabase as any).rpc('nonprofit_decide_approval_step', {
      p_step_id: stepId,
      p_decision: decision,
      p_notes: notes ?? null,
    });
    if (error) throw error;
    return data;
  },
};
