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
    const [organizations, programs, grants, approvals, approvalSteps, alerts, attachmentCompliance, submissionReadiness, submissionAuthorizations, audit] = await Promise.all([
      listView<NonprofitOrgSummary>('nonprofit_command_org_v1'),
      listView<NonprofitProgramSummary>('nonprofit_programs_v1'),
      listView<NonprofitGrantPipelineRow>('nonprofit_grant_pipeline_v1'),
      listView<NonprofitApprovalRow>('nonprofit_pending_approvals_v1'),
      listView<NonprofitApprovalStepRow>('nonprofit_approval_steps_v1'),
      listView<NonprofitComplianceAlert>('nonprofit_compliance_alerts_v1'),
      listView<NonprofitAttachmentComplianceRow>('nonprofit_attachment_compliance_v1'),
      listView<NonprofitSubmissionReadinessRow>('nonprofit_submission_readiness_v1'),
      listView<NonprofitSubmissionAuthorizationRow>('nonprofit_submission_authorizations_v1'),
      listView<NonprofitAuditSummary>('nonprofit_audit_summary_v1'),
    ]);
    return { organizations, programs, grants, approvals, approvalSteps, alerts, attachmentCompliance, submissionReadiness, submissionAuthorizations, audit };
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
