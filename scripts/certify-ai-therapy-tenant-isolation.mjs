#!/usr/bin/env node

import fs from 'node:fs/promises';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
};

const baseUrl = required('SUPPORT_TEST_SUPABASE_URL').replace(/\/$/, '');
const publishableKey = required('SUPPORT_TEST_PUBLISHABLE_KEY');
const tokenA = required('SUPPORT_TEST_JWT_A');
const tokenB = required('SUPPORT_TEST_JWT_B');
const artifactPath = process.env.SUPPORT_TEST_ARTIFACT || '.ai-therapy-evidence/tenant-isolation.json';

function decodeJwt(token) {
  const [, payload] = token.split('.');
  if (!payload) throw new Error('invalid JWT');
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
  const userId = decoded.sub;
  const tenantId = decoded.app_metadata?.tenant_id;
  if (!userId || !tenantId) throw new Error('synthetic JWT requires sub and app_metadata.tenant_id');
  return { userId, tenantId };
}

const identityA = decodeJwt(tokenA);
const identityB = decodeJwt(tokenB);
if (identityA.userId === identityB.userId) throw new Error('synthetic identities must be distinct users');
if (identityA.tenantId === identityB.tenantId) throw new Error('synthetic identities must be distinct tenants');

async function api(token, path, { method = 'GET', body, prefer } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: response.ok, status: response.status, data };
}

const checks = [];
const record = (name, passed, detail = {}) => checks.push({ name, passed, detail });

async function insertJournal(token, identity, marker) {
  return api(token, '/rest/v1/support_journal_records', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      tenant_id: identity.tenantId,
      user_id: identity.userId,
      payload_ciphertext: `synthetic-sealed-v1:${marker}`,
      payload_format: 'sealed-v1',
      safety_state: 'synthetic-test',
      policy_version: 'synthetic-certification-v1',
      consent_version: 'synthetic-consent-v1',
      consented_at: new Date().toISOString(),
      retention_policy_version: 'synthetic-ephemeral',
      retention_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });
}

async function run() {
  const insertedA = await insertJournal(tokenA, identityA, 'tenant-a');
  const insertedB = await insertJournal(tokenB, identityB, 'tenant-b');
  record('own_insert_a', insertedA.ok, { status: insertedA.status });
  record('own_insert_b', insertedB.ok, { status: insertedB.status });
  if (!insertedA.ok || !insertedB.ok) throw new Error('synthetic own-tenant inserts must succeed before isolation checks');

  const idA = insertedA.data?.[0]?.id;
  const idB = insertedB.data?.[0]?.id;
  if (!idA || !idB) throw new Error('inserted synthetic rows must return IDs');

  const ownReadA = await api(tokenA, `/rest/v1/support_journal_records?id=eq.${encodeURIComponent(idA)}&select=id,tenant_id,user_id`);
  record('own_read_a', ownReadA.ok && Array.isArray(ownReadA.data) && ownReadA.data.length === 1, { status: ownReadA.status });

  const crossReadAtoB = await api(tokenA, `/rest/v1/support_journal_records?id=eq.${encodeURIComponent(idB)}&select=id`);
  record('cross_tenant_read_hidden', crossReadAtoB.ok && Array.isArray(crossReadAtoB.data) && crossReadAtoB.data.length === 0, { status: crossReadAtoB.status });

  const crossInsert = await api(tokenA, '/rest/v1/support_journal_records', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      tenant_id: identityB.tenantId,
      user_id: identityA.userId,
      payload_ciphertext: 'synthetic-sealed-v1:cross-tenant-write',
      payload_format: 'sealed-v1',
      safety_state: 'synthetic-test',
      policy_version: 'synthetic-certification-v1',
      consent_version: 'synthetic-consent-v1',
      consented_at: new Date().toISOString(),
      retention_policy_version: 'synthetic-ephemeral',
    },
  });
  record('cross_tenant_insert_blocked', !crossInsert.ok, { status: crossInsert.status });

  const exportA = await api(tokenA, '/rest/v1/rpc/support_export_my_context', { method: 'POST', body: {} });
  const exported = exportA.data;
  const exportIsolated = exportA.ok && exported?.tenant_id === identityA.tenantId && exported?.user_id === identityA.userId &&
    Array.isArray(exported?.journals) && exported.journals.every((row) => row.tenant_id === identityA.tenantId && row.user_id === identityA.userId);
  record('export_is_tenant_scoped', exportIsolated, { status: exportA.status });

  const auditA = await api(tokenA, `/rest/v1/support_context_audit_events?target_id=eq.${encodeURIComponent(idA)}&select=target_id,tenant_id,user_id,event_type`);
  const auditVisible = auditA.ok && Array.isArray(auditA.data) && auditA.data.some((row) => row.target_id === idA && row.tenant_id === identityA.tenantId && row.user_id === identityA.userId);
  record('audit_event_visible_to_owner', auditVisible, { status: auditA.status });

  const crossAudit = await api(tokenB, `/rest/v1/support_context_audit_events?target_id=eq.${encodeURIComponent(idA)}&select=target_id`);
  record('cross_tenant_audit_hidden', crossAudit.ok && Array.isArray(crossAudit.data) && crossAudit.data.length === 0, { status: crossAudit.status });

  const deleteA = await api(tokenA, '/rest/v1/rpc/support_delete_my_context', { method: 'POST', body: {} });
  record('owner_delete_a', deleteA.ok && Number(deleteA.data?.journals_deleted ?? 0) >= 1, { status: deleteA.status });

  const afterDeleteA = await api(tokenA, `/rest/v1/support_journal_records?id=eq.${encodeURIComponent(idA)}&select=id`);
  record('deleted_row_absent_a', afterDeleteA.ok && Array.isArray(afterDeleteA.data) && afterDeleteA.data.length === 0, { status: afterDeleteA.status });

  const bStillPresent = await api(tokenB, `/rest/v1/support_journal_records?id=eq.${encodeURIComponent(idB)}&select=id`);
  record('delete_does_not_cross_tenant', bStillPresent.ok && Array.isArray(bStillPresent.data) && bStillPresent.data.length === 1, { status: bStillPresent.status });

  const cleanupB = await api(tokenB, '/rest/v1/rpc/support_delete_my_context', { method: 'POST', body: {} });
  record('cleanup_b', cleanupB.ok, { status: cleanupB.status });

  const passed = checks.every((check) => check.passed);
  const artifact = {
    schema_version: '1',
    certification: passed ? 'PASS' : 'FAIL',
    environment: 'staging',
    synthetic_only: true,
    production_enabled: false,
    identity_a: { tenant_hash_input_present: Boolean(identityA.tenantId), user_id_present: Boolean(identityA.userId) },
    identity_b: { tenant_hash_input_present: Boolean(identityB.tenantId), user_id_present: Boolean(identityB.userId) },
    checks,
    generated_at: new Date().toISOString(),
  };
  await fs.mkdir(artifactPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  await fs.writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ certification: artifact.certification, checks: checks.length }));
  if (!passed) process.exitCode = 1;
}

run().catch(async (error) => {
  const artifact = {
    schema_version: '1',
    certification: 'FAIL',
    environment: 'staging',
    synthetic_only: true,
    production_enabled: false,
    error: error instanceof Error ? error.message : String(error),
    checks,
    generated_at: new Date().toISOString(),
  };
  await fs.mkdir(artifactPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  await fs.writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  console.error(artifact.error);
  process.exitCode = 1;
});
