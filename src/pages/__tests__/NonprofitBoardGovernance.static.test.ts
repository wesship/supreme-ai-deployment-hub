import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/App.tsx', 'utf8');
const page = readFileSync('src/pages/NonprofitBoardGovernance.tsx', 'utf8');
const api = readFileSync('src/lib/nonprofitCommandCenterApi.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260907033035_nonprofit_board_governance_gate22.sql', 'utf8');
const perfMigration = readFileSync('supabase/migrations/20260907033207_nonprofit_board_governance_gate22_rls_perf.sql', 'utf8');

describe('Gate 22 nonprofit board governance controls', () => {
  it('mounts only behind authenticated routing', () => {
    expect(app).toContain('NonprofitBoardGovernance');
    expect(app).toContain('path="/nonprofit/governance"');
    expect(app).toContain('<AuthenticatedRoute><NonprofitBoardGovernance /></AuthenticatedRoute>');
  });

  it('keeps legal governance fail-closed until evidence-backed adoption', () => {
    expect(migration).toContain("status text not null default 'DRAFT'");
    expect(migration).toContain('effective boolean not null default false');
    expect(migration).toContain('GOVERNANCE_RULES_NOT_ADOPTED');
    expect(page).toContain('No software-generated legal authority is substituted.');
    expect(page).toContain('No demo vote, fake director, or synthetic resolution is created.');
  });

  it('requires real authenticated BOARD humans and AAL2 for voting/finalization', () => {
    expect(migration).toContain('voter_user_id=(select auth.uid())');
    expect(migration).toContain("m.role='BOARD'");
    expect(migration).toContain("MFA_AAL2_REQUIRED");
    expect(perfMigration).toContain("((select auth.jwt())->>'aal')='aal2'");
    expect(migration).not.toContain('agent_id uuid references nonprofit_security.agents');
  });

  it('enforces recusal, quorum, written consent, approval and audit evidence', () => {
    expect(migration).toContain('RECUSAL_BLOCKS_APPROVAL');
    expect(migration).toContain('QUORUM_NOT_MET');
    expect(migration).toContain('WRITTEN_CONSENT_NOT_UNANIMOUS');
    expect(migration).toContain('nonprofit_security.approvals');
    expect(migration).toContain('BOARD_RESOLUTION_ADOPTED');
    expect(migration).toContain('previous_event_hash');
  });

  it('uses guarded RPCs rather than browser resolution inserts', () => {
    expect(api).toContain("rpc('nonprofit_cast_board_vote'");
    expect(api).toContain("rpc('nonprofit_mark_board_attendance'");
    expect(api).toContain("rpc('nonprofit_finalize_board_item'");
    expect(migration).toContain('grant select on nonprofit_security.board_resolutions to authenticated');
    expect(migration).not.toContain('grant insert on nonprofit_security.board_resolutions to authenticated');
  });
});
