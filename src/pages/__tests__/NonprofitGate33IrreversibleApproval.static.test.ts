import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20261001152000_gate33_nonprofit_irreversible_action_approval.sql',
  'utf8',
);
const edgeFunction = readFileSync(
  'supabase/functions/nonprofit-production-irreversible-approval/index.ts',
  'utf8',
);

describe('Gate 33 irreversible production action approval', () => {
  it('requires AAL2 and an authorized final approver', () => {
    expect(migration).toContain('AAL2_MFA_REQUIRED');
    expect(migration).toContain('FINAL_APPROVER_REQUIRED');
    expect(migration).toContain('can_approve');
  });

  it('requires exact irreversible confirmation and a SHA-256 payload hash', () => {
    expect(migration).toContain('AUTHORIZE IRREVERSIBLE PRODUCTION SUBMISSION');
    expect(migration).toContain('EXACT_IRREVERSIBLE_CONFIRMATION_REQUIRED');
    expect(migration).toContain('SHA256_PAYLOAD_HASH_REQUIRED');
    expect(migration).toContain("'^[0-9a-f]{64}$'");
  });

  it('binds approval to a valid GO release certificate', () => {
    expect(migration).toContain('VALID_RELEASE_CERTIFICATE_REQUIRED');
    expect(migration).toContain('GO_RELEASE_RUN_REQUIRED');
    expect(migration).toContain("decision='GO'");
  });

  it('makes approval short-lived and one-time claimable', () => {
    expect(migration).toContain("interval '10 minutes'");
    expect(migration).toContain('LIVE_APPROVAL_ALREADY_EXISTS');
    expect(migration).toContain('ORIGINAL_APPROVER_REQUIRED');
    expect(migration).toContain('LIVE_APPROVAL_REQUIRED');
    expect(migration).toContain("set status='CLAIMED',claimed_at=now()");
  });

  it('invalidates a changed payload hash', () => {
    expect(migration).toContain('PAYLOAD_HASH_MISMATCH');
    expect(edgeFunction).toContain('expected_payload_hash');
  });

  it('keeps live transmission disabled in Gate 33', () => {
    expect(migration).toContain('check (production_send_available = false)');
    expect(edgeFunction).toContain('production_send_available: false');
    expect(edgeFunction).toContain('production_execution_enabled: false');
    expect(edgeFunction).toContain('network_request_performed: false');
    expect(edgeFunction).toContain('application_payload_transmitted: false');
    expect(edgeFunction).not.toContain('await fetch(');
  });
});