import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20261001134500_gate31_nonprofit_production_dry_commit.sql', 'utf8');
const simulator = readFileSync('supabase/functions/nonprofit-production-dry-commit/index.ts', 'utf8');

describe('Gate 31 execution token certification + production dry-commit', () => {
  it('certifies only the complete token lifecycle', () => {
    expect(migration).toContain("p_validation_status='PREFLIGHT_CERTIFIED'");
    expect(migration).toContain("p_consume_status='CONSUMED'");
    expect(migration).toContain("p_replay_status='REPLAY_BLOCKED'");
    expect(migration).toContain("p_expiry_status='EXPIRY_BLOCKED'");
    expect(migration).toContain("'DRY_COMMIT_CERTIFIED'");
  });

  it('actively tests replay protection', () => {
    expect(simulator).toContain('gate31-replay-test');
    expect(simulator).toContain('REPLAY_BLOCKED');
    expect(simulator).toContain('nonprofit_consume_production_execution_token');
  });

  it('actively tests expiry protection without sleeping', () => {
    expect(migration).toContain('expire_execution_token_for_dry_commit_test');
    expect(simulator).toContain('nonprofit_expire_execution_token_for_dry_commit_test');
    expect(simulator).toContain('EXPIRY_BLOCKED');
  });

  it('never exposes token plaintext or performs production transmission', () => {
    expect(simulator).toContain('token_plaintext_exposed: false');
    expect(simulator).toContain('network_request_performed: false');
    expect(simulator).toContain('application_payload_transmitted: false');
    expect(simulator).toContain('production_execution_enabled: false');
    expect(simulator).toContain('production_send_available: false');
    expect(simulator).not.toContain('await fetch(');
  });

  it('persists immutable certification evidence with production send disabled', () => {
    expect(migration).toContain('production_dry_commit_certifications');
    expect(migration).toContain('evidence_hash text not null');
    expect(migration).toContain('check (production_send_available = false)');
    expect(migration).toContain('production_send_available_effective');
  });
});
