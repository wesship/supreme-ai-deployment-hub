#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
};

const baseUrl = required('SUPPORT_TEST_SUPABASE_URL').replace(/\/$/, '');
const publishableKey = required('SUPPORT_TEST_PUBLISHABLE_KEY');
const adminKey = required('SUPPORT_TEST_ADMIN_KEY');

if (!process.env.SUPPORT_TEST_ENV || process.env.SUPPORT_TEST_ENV !== 'staging') {
  throw new Error('refusing non-staging certification run');
}

const runId = `${Date.now()}-${randomBytes(4).toString('hex')}`;
const password = () => `${randomBytes(24).toString('base64url')}Aa1!`;

const identities = [
  { email: `ai-therapy-cert-a-${runId}@example.invalid`, password: password(), tenantId: `synthetic-tenant-a-${runId}` },
  { email: `ai-therapy-cert-b-${runId}@example.invalid`, password: password(), tenantId: `synthetic-tenant-b-${runId}` },
];

async function request(path, { method = 'GET', token = adminKey, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`${method} ${path} failed with ${response.status}`);
  return data;
}

async function createIdentity(identity) {
  const data = await request('/auth/v1/admin/users', {
    method: 'POST',
    body: {
      email: identity.email,
      password: identity.password,
      email_confirm: true,
      app_metadata: { tenant_id: identity.tenantId, synthetic_certification: true },
      user_metadata: { synthetic_certification: true },
    },
  });
  if (!data?.id) throw new Error('admin user creation did not return an id');
  identity.userId = data.id;
}

async function signIn(identity) {
  const data = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    token: publishableKey,
    body: { email: identity.email, password: identity.password },
  });
  if (!data?.access_token) throw new Error('synthetic sign-in did not return an access token');
  identity.accessToken = data.access_token;
}

async function deleteIdentity(identity) {
  if (!identity.userId) return;
  try {
    await request(`/auth/v1/admin/users/${encodeURIComponent(identity.userId)}`, { method: 'DELETE' });
  } catch {
    console.error('warning: synthetic identity cleanup failed');
  }
}

function runHarness() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/certify-ai-therapy-tenant-isolation.mjs'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        SUPPORT_TEST_JWT_A: identities[0].accessToken,
        SUPPORT_TEST_JWT_B: identities[1].accessToken,
      },
    });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`tenant isolation harness exited ${code}`)));
  });
}

try {
  await createIdentity(identities[0]);
  await createIdentity(identities[1]);
  await signIn(identities[0]);
  await signIn(identities[1]);
  await runHarness();
} finally {
  await deleteIdentity(identities[0]);
  await deleteIdentity(identities[1]);
}
