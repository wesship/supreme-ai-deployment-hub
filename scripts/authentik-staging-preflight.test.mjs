import test from 'node:test';
import assert from 'node:assert/strict';
import { preflight, STAGING_REF, validateDiscovery, validateKeys } from './authentik-staging-preflight.mjs';

const issuer = 'https://identity.example.com/application/o/staging/';
const discovery = {
  issuer, authorization_endpoint: 'https://identity.example.com/authorize',
  token_endpoint: 'https://identity.example.com/token', userinfo_endpoint: 'https://identity.example.com/userinfo',
  jwks_uri: 'https://identity.example.com/keys', response_types_supported: ['code'],
  code_challenge_methods_supported: ['S256'], id_token_signing_alg_values_supported: ['RS256'],
};
const keys = { keys: [{ kid: 'one', kty: 'RSA', n: 'public-modulus', e: 'AQAB' }] };
const env = { SUPABASE_PROJECT_REF: STAGING_REF, AUTHENTIK_ISSUER: issuer, AUTHENTIK_STAGING_APP_ORIGIN: 'https://staging.example.com' };

test('checks discovery then keys and reports both callback boundaries without claiming login', async () => {
  const calls = [];
  const result = await preflight(env, async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify(url === discovery.jwks_uri ? keys : discovery), { headers: { 'content-type': 'application/json' } });
  });
  assert.deepEqual(calls, [`${issuer}.well-known/openid-configuration`, discovery.jwks_uri]);
  assert.equal(result.identity_provider_callback, `https://${STAGING_REF}.supabase.co/auth/v1/callback`);
  assert.equal(result.application_callback, 'https://staging.example.com/auth/callback');
  assert.equal(result.status, 'public_metadata_verified');
  assert.ok(result.remaining.includes('verify_account_linking_and_two_account_isolation'));
});

test('blocks production projects and destinations before network access', async () => {
  const request = () => { throw new Error('network must not run'); };
  await assert.rejects(preflight({ ...env, SUPABASE_PROJECT_REF: 'tjygexesognbkwualywq' }, request), /Only.*staging/);
  await assert.rejects(preflight({ ...env, AUTHENTIK_STAGING_APP_ORIGIN: 'https://d3vonn.io' }, request), /Production/);
  await assert.rejects(preflight({ ...env, AUTHENTIK_ISSUER: 'http://identity.example.com' }, request), /HTTPS/);
  await assert.rejects(preflight({ ...env, AUTHENTIK_ISSUER: 'https://secret@identity.example.com' }, request), /credentials/);
});

test('rejects issuer mismatch, missing PKCE, insecure endpoints, and symmetric-only signing', () => {
  assert.throws(() => validateDiscovery(issuer, { ...discovery, issuer: issuer.slice(0, -1) }), /exactly/);
  assert.throws(() => validateDiscovery(issuer, { ...discovery, code_challenge_methods_supported: ['plain'] }), /S256/);
  assert.throws(() => validateDiscovery(issuer, { ...discovery, token_endpoint: 'http://identity.example.com/token' }), /HTTPS/);
  assert.throws(() => validateDiscovery(issuer, { ...discovery, id_token_signing_alg_values_supported: ['HS256'] }), /signing/);
});

test('rejects empty keys and exposed private key material', () => {
  assert.throws(() => validateKeys({ keys: [] }), /No public/);
  assert.throws(() => validateKeys({ keys: [{ ...keys.keys[0], d: 'private' }] }), /private/);
  assert.throws(() => validateKeys({ keys: [{ kty: 'oct', k: 'secret' }] }), /private/);
});

test('rejects failed and non-JSON discovery responses', async () => {
  await assert.rejects(preflight(env, async () => new Response('unavailable', { status: 503 })), /HTTP 503/);
  await assert.rejects(preflight(env, async () => new Response('<html>login</html>')), /JSON/);
});
