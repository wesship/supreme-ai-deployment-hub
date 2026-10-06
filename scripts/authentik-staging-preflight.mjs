import { pathToFileURL } from 'node:url';

export const STAGING_REF = 'ypomzwhtaamxdmcwtpyf';
export const PROVIDER = 'custom:authentik';

export function httpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Expected an HTTPS URL without credentials, query, or fragment');
  }
  return url;
}

export function validateDiscovery(issuer, document) {
  httpsUrl(issuer);
  if (document.issuer !== issuer) throw new Error('Discovery issuer must match exactly');
  for (const field of ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint', 'jwks_uri']) {
    httpsUrl(document[field]);
  }
  if (!document.response_types_supported?.includes('code')) throw new Error('Authorization code flow unavailable');
  if (!document.code_challenge_methods_supported?.includes('S256')) throw new Error('S256 PKCE unavailable');
  if (!document.id_token_signing_alg_values_supported?.some(alg => ['RS256', 'ES256'].includes(alg))) {
    throw new Error('Expected RS256 or ES256 ID-token signing');
  }
}

export function validateKeys(document) {
  const keys = document.keys;
  if (!Array.isArray(keys) || !keys.length) throw new Error('No public signing keys');
  for (const key of keys) {
    if (['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'].some(field => field in key)) {
      throw new Error('JWKS contains private or symmetric key material');
    }
  }
  if (!keys.some(key => key.kid && (!key.use || key.use === 'sig') &&
    ((!key.alg || key.alg === 'RS256') && key.kty === 'RSA' && key.n && key.e ||
     (!key.alg || key.alg === 'ES256') && key.kty === 'EC' && key.crv === 'P-256' && key.x && key.y))) {
    throw new Error('No usable public RSA or P-256 signing key');
  }
}

export async function getJson(url, request = fetch) {
  httpsUrl(url);
  const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Endpoint returned HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.includes('json')) throw new Error('Expected JSON response');
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024 * 1024) throw new Error('JSON response exceeds 1 MiB');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function preflight(env, request = fetch) {
  if (env.SUPABASE_PROJECT_REF !== STAGING_REF) throw new Error('Only the verified staging project is allowed');
  const issuer = env.AUTHENTIK_ISSUER;
  const issuerUrl = httpsUrl(issuer);
  const app = httpsUrl(env.AUTHENTIK_STAGING_APP_ORIGIN);
  if (app.pathname !== '/') throw new Error('App origin must not contain a path');
  if (['d3vonn.io', 'www.d3vonn.io'].includes(app.hostname)) throw new Error('Production app is not allowed');
  const discoveryUrl = new URL(`${issuerUrl.pathname.replace(/\/$/, '')}/.well-known/openid-configuration`, issuerUrl.origin).href;
  const discovery = await getJson(discoveryUrl, request);
  validateDiscovery(issuer, discovery);
  validateKeys(await getJson(discovery.jwks_uri, request));
  return {
    status: 'public_metadata_verified',
    project_ref: STAGING_REF,
    provider: PROVIDER,
    issuer,
    identity_provider_callback: `https://${STAGING_REF}.supabase.co/auth/v1/callback`,
    application_callback: `${app.origin}/auth/callback`,
    remaining: ['configure_provider_with_server_side_secret', 'verify_signed_in_login_and_logout', 'verify_account_linking_and_two_account_isolation'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await preflight(process.env), null, 2));
  } catch {
    // Never echo remote bodies, URLs with credentials, or environment values.
    console.error('Authentik staging preflight failed. Check staging inputs, HTTPS discovery, and public signing keys.');
    process.exitCode = 1;
  }
}
