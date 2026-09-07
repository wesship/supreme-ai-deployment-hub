import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/App.tsx', 'utf8');
const page = readFileSync('src/pages/NonprofitIdentity.tsx', 'utf8');
const api = readFileSync('src/lib/nonprofitCommandCenterApi.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260907031500_gate21_nonprofit_identity_invites.sql', 'utf8');

describe('Gate 21 nonprofit identity and governance activation', () => {
  it('mounts an authenticated identity route', () => {
    expect(app).toContain('NonprofitIdentity');
    expect(app).toContain('path="/nonprofit/identity"');
    expect(app).toContain('<AuthenticatedRoute><NonprofitIdentity /></AuthenticatedRoute>');
  });

  it('uses safe membership surfaces and invitation RPCs', () => {
    expect(api).toContain('nonprofit_my_memberships_v1');
    expect(api).toContain("rpc('nonprofit_claim_membership_invite'");
    expect(api).toContain("rpc('nonprofit_create_membership_invite'");
    expect(api).not.toContain('membership_invites').or.toContain('nonprofit_claim_membership_invite');
  });

  it('keeps raw invitation identity material hashed and private', () => {
    expect(migration).toContain('email_hash text not null');
    expect(migration).toContain('token_hash text not null unique');
    expect(migration).toContain('revoke all on nonprofit_security.membership_invites from public, anon, authenticated');
    expect(migration).toContain("extensions.digest(v_email::bytea,'sha256')");
    expect(migration).toContain("extensions.digest(btrim(p_token)::bytea,'sha256')");
  });

  it('prevents self-role escalation and requires stronger auth for high-authority roles', () => {
    expect(migration).toContain('GOVERNANCE_ROLE_REQUIRED');
    expect(migration).toContain('MFA_AAL2_REQUIRED_FOR_HIGH_AUTHORITY_ROLE');
    expect(migration).toContain("'BOARD'::nonprofit_security.member_role");
    expect(migration).toContain("'EXECUTIVE'::nonprofit_security.member_role");
    expect(page).toContain('No user can self-assign a role');
  });
});
