import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/App.tsx', 'utf8');
const page = readFileSync('src/pages/NonprofitCommandCenter.tsx', 'utf8');
const api = readFileSync('src/lib/nonprofitCommandCenterApi.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260917112000_gate21_nonprofit_attachment_compliance.sql', 'utf8');

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
    expect(migration).toContain("'BLOCKED_MISSING'");
    expect(migration).toContain("'BLOCKED_UNVERIFIED_CONTENT'");
    expect(migration).toContain("'BLOCKED_UNSIGNED'");
    expect(migration).toContain("'BLOCKED_EXPIRED'");
    expect(migration).toContain("'BLOCKED_STALE'");
    expect(migration).toContain("'BLOCKED_FILE_SIZE'");
    expect(migration).toContain("'BLOCKED_PAGE_COUNT'");
    expect(migration).toContain("'BLOCKED_FILE_TYPE'");
  });

  it('protects attachment rows with authenticated membership RLS', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('nonprofit_security.memberships');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('revoke all on public.nonprofit_attachment_compliance_v1 from anon');
  });

  it('shows submission blockers in the command center', () => {
    expect(page).toContain('Attachment compliance');
    expect(page).toContain('NOT SUBMISSION READY');
    expect(page).toContain('hard submission blockers');
    expect(page).toContain('Hard failures remain fail-closed.');
  });
});
