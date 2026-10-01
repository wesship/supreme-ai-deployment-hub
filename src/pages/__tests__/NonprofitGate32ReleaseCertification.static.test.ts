import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20261001143000_gate32_nonprofit_final_release_certification.sql',
  'utf8',
);
const edgeFunction = readFileSync(
  'supabase/functions/nonprofit-production-release-certify/index.ts',
  'utf8',
);

describe('Gate 32 final production release certification', () => {
  it('requires protected CI and configuration attestations', () => {
    expect(migration).toContain('BLOCKED_CI_ATTESTATION_MISSING');
    expect(migration).toContain('BLOCKED_CI_NOT_GREEN');
    expect(migration).toContain('BLOCKED_CI_CHECKS_INCOMPLETE');
    expect(migration).toContain('BLOCKED_CONFIG_ATTESTATION_MISSING');
    expect(migration).toContain('BLOCKED_CONFIG_NOT_GREEN');
    expect(migration).toContain('BLOCKED_CONFIG_CHECKS_INCOMPLETE');
  });

  it('requires every critical CI signal to be explicitly green', () => {
    expect(migration).toContain("v_ci.details->>'test_coverage'");
    expect(migration).toContain("v_ci.details->>'accessibility_ci'");
    expect(migration).toContain("v_ci.details->>'edge_functions_typecheck'");
    expect(migration).toContain("v_ci.details->>'pr_automation'");
    expect(migration).toContain("v_ci.details->>'vps_deployment_validation'");
  });

  it('requires production configuration presence without storing secret values', () => {
    expect(migration).toContain("v_config.details->>'production_endpoint_configured'");
    expect(migration).toContain("v_config.details->>'production_allowed_hosts_configured'");
    expect(migration).toContain("v_config.details->>'production_credentials_present'");
    expect(migration).toContain("v_config.details->>'tls_required'");
    expect(migration).toContain("v_config.details->>'idempotency_required'");
    expect(migration).toContain("v_config.details->>'payload_hash_required'");
    expect(migration).toContain("v_config.details->>'receipt_hash_required'");
    expect(migration).toContain('SECRET_MATERIAL_FORBIDDEN_IN_ATTESTATION');
    expect(migration).toContain('private_key');
    expect(migration).toContain('access_token');
    expect(migration).toContain('client_secret');
  });

  it('requires a valid Gate 31 dry-commit and the upstream release chain', () => {
    expect(migration).toContain('BLOCKED_DRY_COMMIT_EXPIRED');
    expect(migration).toContain('BLOCKED_DRY_COMMIT_INVALID');
    expect(migration).toContain('BLOCKED_HASH_CHAIN_MISMATCH');
    expect(migration).toContain('BLOCKED_SHADOW_INVALID');
    expect(migration).toContain('BLOCKED_PROMOTION_NOT_APPROVED');
    expect(migration).toContain('BLOCKED_PROTECTED_ENVIRONMENT_APPROVAL_MISSING');
    expect(migration).toContain('BLOCKED_SANDBOX_CERTIFICATION_EXPIRED');
  });

  it('creates a GO certificate only when there are zero blockers', () => {
    expect(migration).toContain("case when jsonb_array_length(v_blockers)=0 then 'GO' else 'NO_GO' end");
    expect(migration).toContain("if v_decision='GO' then");
    expect(migration).toContain("interval '1 hour'");
    expect(migration).toContain("'grantassist.production-release-certification.v1'");
    expect(migration).toContain("'sha256'");
  });

  it('hard-disables production execution and submission even for GO', () => {
    expect(migration).toContain('check (production_send_available = false)');
    expect(migration).toContain('check (production_execution_enabled = false)');
    expect(edgeFunction).toContain('production_send_available: false');
    expect(edgeFunction).toContain('production_execution_enabled: false');
    expect(edgeFunction).toContain('application_payload_transmitted: false');
    expect(edgeFunction).toContain('network_request_performed: false');
    expect(edgeFunction).not.toContain('await fetch(');
  });

  it('defines GO as implementation eligibility, never submission authorization', () => {
    expect(edgeFunction).toContain('eligible for the next production-send implementation gate');
    expect(edgeFunction).toContain('it is not authorization to submit a grant');
    expect(edgeFunction).toContain('secrets_read_by_this_function: false');
  });
});
