import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/App.tsx', 'utf8');
const page = readFileSync('src/pages/NonprofitCommandCenter.tsx', 'utf8');
const api = readFileSync('src/lib/nonprofitCommandCenterApi.ts', 'utf8');

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
    expect(api).toContain('nonprofit_compliance_alerts_v1');
    expect(api).toContain('nonprofit_audit_summary_v1');
    expect(api).not.toContain('nonprofit_vault.documents');
  });

  it('uses the guarded approval RPC', () => {
    expect(api).toContain("rpc('nonprofit_decide_approval_step'");
    expect(page).toContain('MFA + role + policy guarded');
    expect(page).toContain('non-RED policy decision');
  });
});
