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

export type NonprofitMembershipRow = {
  membership_id: string;
  organization_id: string;
  legal_name: string;
  display_name: string | null;
  role: 'BOARD' | 'EXECUTIVE' | 'FINANCE' | 'GRANT' | 'PROGRAM' | 'COMPLIANCE' | 'AUDITOR';
  active: boolean;
  can_approve: boolean;
  created_at: string;
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
    const [organizations, programs, grants, approvals, approvalSteps, memberships, alerts, audit] = await Promise.all([
      listView<NonprofitOrgSummary>('nonprofit_command_org_v1'),
      listView<NonprofitProgramSummary>('nonprofit_programs_v1'),
      listView<NonprofitGrantPipelineRow>('nonprofit_grant_pipeline_v1'),
      listView<NonprofitApprovalRow>('nonprofit_pending_approvals_v1'),
      listView<NonprofitApprovalStepRow>('nonprofit_approval_steps_v1'),
      listView<NonprofitMembershipRow>('nonprofit_my_memberships_v1'),
      listView<NonprofitComplianceAlert>('nonprofit_compliance_alerts_v1'),
      listView<NonprofitAuditSummary>('nonprofit_audit_summary_v1'),
    ]);
    return { organizations, programs, grants, approvals, approvalSteps, memberships, alerts, audit };
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

  async claimMembershipInvite(token: string) {
    const { data, error } = await (supabase as any).rpc('nonprofit_claim_membership_invite', {
      p_token: token,
    });
    if (error) throw error;
    return data;
  },

  async createMembershipInvite(input: {
    organizationId: string;
    email: string;
    role: NonprofitMembershipRow['role'];
    canApprove?: boolean;
    expiresHours?: number;
  }) {
    const { data, error } = await (supabase as any).rpc('nonprofit_create_membership_invite', {
      p_organization_id: input.organizationId,
      p_email: input.email,
      p_role: input.role,
      p_can_approve: input.canApprove ?? false,
      p_expires_hours: input.expiresHours ?? 72,
    });
    if (error) throw error;
    return (data ?? []) as Array<{ invite_id: string; invite_token: string; expires_at: string }>;
  },
};
