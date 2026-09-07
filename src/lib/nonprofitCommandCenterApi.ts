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

export type NonprofitBoardRule = {
  organization_id: string;
  quorum_mode: 'MAJORITY_ACTIVE_BOARD';
  vote_mode: 'MAJORITY_VOTES_CAST';
  written_consent_mode: 'UNANIMOUS_ELIGIBLE_BOARD';
  recused_counts_for_quorum: boolean;
  effective: boolean;
  status: 'DRAFT' | 'ADOPTED' | 'SUPERSEDED';
  authority_basis: string | null;
  adopted_at: string | null;
};

export type NonprofitBoardStatusRow = {
  session_id: string;
  organization_id: string;
  session_type: 'MEETING' | 'WRITTEN_CONSENT';
  title: string;
  session_status: string;
  scheduled_at: string | null;
  agenda_item_id: string | null;
  item_no: number | null;
  agenda_title: string | null;
  action_type: string | null;
  related_party: boolean | null;
  agenda_status: string | null;
  present_directors: number;
  yes_votes: number;
  no_votes: number;
  abstain_votes: number;
  resolution_id: string | null;
  resolution_number: string | null;
  adopted_at: string | null;
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

  async loadBoardGovernance() {
    const [rules, board] = await Promise.all([
      listView<NonprofitBoardRule>('nonprofit_board_rules_v1'),
      listView<NonprofitBoardStatusRow>('nonprofit_board_status_v1'),
    ]);
    return { rules, board };
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

  async markBoardAttendance(sessionId: string, status: 'PRESENT' | 'REMOTE' | 'ABSENT' = 'PRESENT') {
    const { data, error } = await (supabase as any).rpc('nonprofit_mark_board_attendance', {
      p_session_id: sessionId,
      p_status: status,
    });
    if (error) throw error;
    return data as string;
  },

  async castBoardVote(agendaItemId: string, vote: 'YES' | 'NO' | 'ABSTAIN') {
    const { data, error } = await (supabase as any).rpc('nonprofit_cast_board_vote', {
      p_agenda_item_id: agendaItemId,
      p_vote: vote,
    });
    if (error) throw error;
    return data as string;
  },

  async finalizeBoardItem(agendaItemId: string) {
    const { data, error } = await (supabase as any).rpc('nonprofit_finalize_board_item', {
      p_agenda_item_id: agendaItemId,
    });
    if (error) throw error;
    return data as string;
  },
};
