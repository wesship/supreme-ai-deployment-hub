import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/App.tsx', 'utf8');
const page = readFileSync('src/pages/NonprofitCommandCenter.tsx', 'utf8');
const api = readFileSync('src/lib/nonprofitCommandCenterApi.ts', 'utf8');
const attachmentMigration = readFileSync('supabase/migrations/20260917112000_gate21_nonprofit_attachment_compliance.sql', 'utf8');
const readinessMigration = readFileSync('supabase/migrations/20260917114500_gate22_nonprofit_final_submission_readiness.sql', 'utf8');
const authorizationMigration = readFileSync('supabase/migrations/20260917171500_gate23_nonprofit_submission_authorization.sql', 'utf8');

describe('Gate 20 nonprofit command center wiring', () => {
  it('registers authenticated nonprofit routes', () => {
    expect(app).toContain('NonprofitCommandCenter');
    expect(app).toContain('path="/nonprofit"');
    expect(app).toContain('<AuthenticatedRoute><NonprofitCommandCenter /></AuthenticatedRoute>');
  });

  it('reads only command-center summary views', () => {
    expect(api).toContain('nonprofit_command_org_v1');
    expect(api).toContain('nonprofit_programs_v1');
    expect(api).toContain('nonprofit_grant_pipeline_v1');
    expect(api).toContain('nonprofit_pending_approvals_v1');
    expect(api).toContain('nonprofit_approval_steps_v1');
    expect(api).toContain('nonprofit_compliance_alerts_v1');
    expect(api).toContain('nonprofit_attachment_compliance_v1');
    expect(api).toContain('nonprofit_submission_readiness_v1');
    expect(api).toContain('nonprofit_submission_authorizations_v1');
    expect(api).toContain('nonprofit_audit_summary_v1');
    expect(api).not.toContain('nonprofit_vault.documents');
  });

  it('uses the guarded approval RPC and exposes no direct execution control', () => {
    expect(api).toContain("rpc('nonprofit_decide_approval_step'");
    expect(page).toContain('MFA + role + policy guarded');
    expect(page).toContain('RED policy decisions are blocked');
    expect(page).toContain('The action itself was not executed.');
  });
});

describe('Gate 21 attachment compliance engine', () => {
  it('is fail-closed on required attachment failures', () => {
    expect(attachmentMigration).toContain("'BLOCKED_MISSING'");
    expect(attachmentMigration).toContain("'BLOCKED_UNVERIFIED_CONTENT'");
    expect(attachmentMigration).toContain("'BLOCKED_UNSIGNED'");
    expect(attachmentMigration).toContain("'BLOCKED_EXPIRED'");
    expect(attachmentMigration).toContain("'BLOCKED_STALE'");
    expect(attachmentMigration).toContain("'BLOCKED_FILE_SIZE'");
    expect(attachmentMigration).toContain("'BLOCKED_PAGE_COUNT'");
    expect(attachmentMigration).toContain("'BLOCKED_FILE_TYPE'");
  });

  it('protects attachment rows with authenticated membership RLS', () => {
    expect(attachmentMigration).toContain('enable row level security');
    expect(attachmentMigration).toContain('nonprofit_security.memberships');
    expect(attachmentMigration).toContain('auth.uid()');
    expect(attachmentMigration).toContain('revoke all on public.nonprofit_attachment_compliance_v1 from anon');
  });

  it('shows submission blockers in the command center', () => {
    expect(page).toContain('Attachment compliance');
    expect(page).toContain('NOT SUBMISSION READY');
    expect(page).toContain('hard blockers');
    expect(page).toContain('Hard failures remain fail-closed.');
  });
});

describe('Gate 22 final application QA and submission readiness', () => {
  it('aggregates all hard readiness dimensions', () => {
    expect(readinessMigration).toContain("'BLOCKED_DEADLINE'");
    expect(readinessMigration).toContain("'BLOCKED_GO_NO_GO_REQUIRED'");
    expect(readinessMigration).toContain("'BLOCKED_ELIGIBILITY'");
    expect(readinessMigration).toContain("'BLOCKED_READINESS_UNKNOWN'");
    expect(readinessMigration).toContain("'BLOCKED_READINESS_INCOMPLETE'");
    expect(readinessMigration).toContain("'BLOCKED_ATTACHMENTS'");
    expect(readinessMigration).toContain("'BLOCKED_REJECTED_APPROVAL'");
    expect(readinessMigration).toContain("'BLOCKED_PENDING_APPROVAL'");
    expect(readinessMigration).toContain("'BLOCKED_POLICY'");
    expect(readinessMigration).toContain("'SUBMISSION_READY'");
  });

  it('remains read-only and fail-closed', () => {
    expect(readinessMigration).toContain('create or replace view public.nonprofit_submission_readiness_v1');
    expect(readinessMigration).toContain('hard_blocker');
    expect(readinessMigration).toContain('blocker_reasons');
    expect(readinessMigration).toContain('revoke all on public.nonprofit_submission_readiness_v1 from anon');
    expect(readinessMigration).not.toContain('insert into');
    expect(readinessMigration).not.toContain('update nonprofit');
  });

  it('surfaces one final verdict without adding a submit action', () => {
    expect(page).toContain('Final application QA + submission readiness');
    expect(page).toContain('One deterministic verdict');
    expect(page).toContain('This view does not submit anything.');
    expect(page).toContain('Blocker reasons:');
    expect(page).not.toContain('Submit application');
  });
});


describe('Gate 23 submission authorization and human approval', () => {
  it('allows authorization requests only after deterministic submission readiness', () => {
    expect(authorizationMigration).toContain("v_ready.submission_status <> 'SUBMISSION_READY'");
    expect(authorizationMigration).toContain('WORKFLOW_NOT_SUBMISSION_READY');
    expect(authorizationMigration).toContain('LIVE_SUBMISSION_AUTHORIZATION_EXISTS');
    expect(authorizationMigration).toContain("status in ('PENDING','APPROVED')");
  });

  it('requires MFA, approval authority, and separation of duties for approval', () => {
    expect(authorizationMigration).toContain('MFA_AAL2_REQUIRED');
    expect(authorizationMigration).toContain('can_approve');
    expect(authorizationMigration).toContain('SEPARATION_OF_DUTIES_REQUIRED');
    expect(authorizationMigration).toContain('READINESS_CHANGED_REAUTHORIZATION_REQUIRED');
  });

  it('does not execute an external grant submission', () => {
    expect(authorizationMigration).not.toContain('http_request');
    expect(authorizationMigration).not.toContain('net.http');
    expect(authorizationMigration).not.toContain('submit_grant');
    expect(page).toContain('This gate still does not execute or transmit a grant submission.');
    expect(page).not.toContain('Submit application');
  });

  it('wires guarded authorization request and decision RPCs', () => {
    expect(api).toContain("rpc('nonprofit_request_submission_authorization'");
    expect(api).toContain("rpc('nonprofit_decide_submission_authorization'");
    expect(page).toContain('Request human authorization');
    expect(page).toContain('Approve authorization');
    expect(page).toContain('A different authorized human must decide this request.');
  });
});
