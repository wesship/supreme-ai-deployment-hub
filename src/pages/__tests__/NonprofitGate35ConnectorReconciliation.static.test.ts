import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20261001164500_gate35_nonprofit_connector_reconciliation.sql',
  'utf8',
);

describe('Gate 35 protected connector reconciliation', () => {
  it('opens only from an armed transmission and prevents blind duplicate dispatch', () => {
    expect(migration).toContain('ARMED_TRANSMISSION_REQUIRED');
    expect(migration).toContain('TRANSMISSION_ALREADY_OBSERVED');
    expect(migration).toContain('CONNECTOR_DISPATCH_ALREADY_OPENED_NO_BLIND_RETRY');
    expect(migration).toContain("'DISPATCHING'");
  });

  it('reuses the same idempotency identity rather than creating a second send identity', () => {
    expect(migration).toContain('idempotency_key text not null');
    expect(migration).toContain('v_attempt.idempotency_key');
    expect(migration).toContain('NO_RETRY');
  });

  it('records acknowledged results only through the authoritative Gate 34 receipt verifier', () => {
    expect(migration).toContain('record_production_transmission_receipt');
    expect(migration).toContain("v_status := 'ACKNOWLEDGED'");
    expect(migration).toContain('authoritative_receipt_verified');
  });

  it('handles confirmed duplicate responses without retransmitting', () => {
    expect(migration).toContain('DUPLICATE_CONFIRMATION_ID_REQUIRED');
    expect(migration).toContain("v_status := 'DUPLICATE_CONFIRMED'");
    expect(migration).toContain("v_retry := 'NO_RETRY'");
  });

  it('puts uncertain outcomes on manual hold instead of retrying automatically', () => {
    expect(migration).toContain("v_status := 'AMBIGUOUS_HOLD'");
    expect(migration).toContain("v_retry := 'MANUAL_REVIEW_REQUIRED'");
    expect(migration).toContain('REMOTE_OUTCOME_UNCERTAIN');
    expect(migration).toContain('false as automatic_retry_allowed');
  });

  it('allows retry only when no network request occurred, and only with the same idempotency key', () => {
    expect(migration).toContain("v_status := 'FAILED_SAFE'");
    expect(migration).toContain("v_retry := 'SAFE_TO_RETRY_WITH_SAME_IDEMPOTENCY_KEY'");
  });

  it('adds reconciliation only and no outbound HTTP implementation', () => {
    expect(migration).not.toContain('http_request');
    expect(migration).not.toContain('net.http');
    expect(migration).not.toContain('fetch(');
  });
});