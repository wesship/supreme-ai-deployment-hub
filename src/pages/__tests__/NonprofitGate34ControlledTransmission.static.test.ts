import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20261001160000_gate34_nonprofit_controlled_transmission_arm.sql',
  'utf8',
);

describe('Gate 34 controlled production transmission arm', () => {
  it('requires a claimed irreversible approval and valid release certificate', () => {
    expect(migration).toContain('CLAIMED_IRREVERSIBLE_APPROVAL_REQUIRED');
    expect(migration).toContain('VALID_RELEASE_CERTIFICATE_REQUIRED');
    expect(migration).toContain('IRREVERSIBLE_APPROVAL_EXPIRED');
  });

  it('binds the execution token to the exact shadow and payload hash', () => {
    expect(migration).toContain('EXECUTION_TOKEN_SHADOW_MISMATCH');
    expect(migration).toContain('EXECUTION_TOKEN_PAYLOAD_HASH_MISMATCH');
    expect(migration).toContain('consume_production_execution_token');
    expect(migration).toContain('EXECUTION_TOKEN_CONSUMPTION_FAILED');
  });

  it('requires idempotency and endpoint identity before arming', () => {
    expect(migration).toContain('PRODUCTION_ENDPOINT_HOST_REQUIRED');
    expect(migration).toContain('IDEMPOTENCY_KEY_REQUIRED');
    expect(migration).toContain('idempotency_key text not null unique');
    expect(migration).toContain("request_method text not null default 'POST'");
  });

  it('arms without pretending transmission occurred', () => {
    expect(migration).toContain("status text not null default 'ARMED'");
    expect(migration).toContain('network_request_performed boolean not null default false');
    expect(migration).toContain('application_payload_transmitted boolean not null default false');
    expect(migration).toContain("return query select v_attempt_id,'ARMED'::text");
  });

  it('accepts an authoritative receipt only after a real successful transmission', () => {
    expect(migration).toContain('AUTHORITATIVE_RECEIPT_REQUIRES_ACTUAL_TRANSMISSION');
    expect(migration).toContain('SUCCESS_RESPONSE_REQUIRED');
    expect(migration).toContain('AUTHORITATIVE_RECEIPT_ID_REQUIRED');
    expect(migration).toContain('RECEIVED_SHA256_REQUIRED');
    expect(migration).toContain('AUTHORITATIVE_RECEIPT_HASH_MISMATCH');
    expect(migration).toContain("status='RECEIPT_RECORDED'");
  });

  it('does not add an outbound network implementation', () => {
    expect(migration).not.toContain('http_request');
    expect(migration).not.toContain('net.http');
    expect(migration).not.toContain('fetch(');
    expect(migration).toContain('false as production_send_available_effective');
  });
});
