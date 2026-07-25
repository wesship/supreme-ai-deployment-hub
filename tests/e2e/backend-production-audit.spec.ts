import { expect, test, type APIResponse, type Page } from '@playwright/test';

const frontendBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'https://d3vonn.io';
const apiBaseUrl = (process.env.API_BASE_URL ?? 'https://api.d3vonn.io').replace(/\/$/, '');
const testEmail = process.env.E2E_TEST_EMAIL?.trim();
const testPassword = process.env.E2E_TEST_PASSWORD?.trim();

async function expectJson(response: APIResponse, status: number): Promise<Record<string, unknown>> {
  expect(response.status(), await response.text()).toBe(status);
  expect(response.headers()['content-type'] ?? '').toContain('application/json');
  return response.json() as Promise<Record<string, unknown>>;
}

async function expectUnauthorized(response: APIResponse): Promise<void> {
  const body = await expectJson(response, 401);
  expect(String(body.detail ?? '')).toMatch(
    /authorization header required|missing or malformed authorization header|invalid or expired token/i,
  );
}

function tamperToken(token: string): string {
  const finalCharacter = token.at(-1) ?? 'a';
  const replacement = finalCharacter === 'a' ? 'b' : 'a';
  return `${token.slice(0, -1)}${replacement}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Authenticated session returned a malformed JWT');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
}

async function readSupabaseAccessToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.endsWith('-auth-token')) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as {
          access_token?: string;
          currentSession?: { access_token?: string };
          session?: { access_token?: string };
        };
        return (
          parsed.access_token ??
          parsed.currentSession?.access_token ??
          parsed.session?.access_token ??
          null
        );
      } catch {
        // Ignore unrelated or partially written local-storage entries.
      }
    }
    return null;
  });
}

async function attemptSignIn(page: Page): Promise<string | null> {
  await page.goto(`${frontendBaseUrl}/login?redirect=%2Fapp`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  const email = page.locator('input[type="email"]');
  const password = page.locator('input[type="password"]');
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();

  await email.fill(testEmail!);
  await password.fill(testPassword!);
  await expect(email).toHaveValue(testEmail!);
  await expect(password).toHaveValue(testPassword!);

  const submit = page.locator('button[type="submit"]').filter({ hasText: /sign in|log in/i }).first();
  await expect(submit).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();

  try {
    await expect.poll(() => readSupabaseAccessToken(page), { timeout: 20_000 }).not.toBeNull();
  } catch {
    return null;
  }
  return readSupabaseAccessToken(page);
}

async function signInAndReadAccessToken(page: Page): Promise<string> {
  if (!testEmail || !testPassword) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be configured');
  }

  let accessToken: string | null = null;
  await expect(async () => {
    accessToken = await attemptSignIn(page);
    expect(accessToken, `No Supabase session after login attempt at ${page.url()}`).toBeTruthy();
  }).toPass({ timeout: 90_000, intervals: [1_000, 3_000, 5_000] });

  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Authenticated session did not expose a Supabase access token');
  }
  return accessToken;
}

test.describe.serial('D3VONN.IO production backend API certification', () => {
  let accessToken = '';

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      accessToken = await signInAndReadAccessToken(page);
    } finally {
      await context.close();
    }
  });

  test('public liveness, readiness, deployment, and operations probes are healthy', async ({ request }) => {
    const live = await expectJson(await request.get(`${apiBaseUrl}/health`), 200);
    expect(live.status).toBe('ok');

    const ready = await expectJson(await request.get(`${apiBaseUrl}/health/ready`), 200);
    expect(ready.status).toBe('ready');
    expect((ready.services as Record<string, unknown>).api).toBe('healthy');
    expect((ready.services as Record<string, unknown>).redis).toBe('reachable');
    expect((ready.services as Record<string, unknown>).supabase).toBe('configured');

    const deployment = await expectJson(await request.get(`${apiBaseUrl}/health/deployment`), 200);
    expect(deployment.entrypoint).toBe('backend.railway_app:app');
    const routers = deployment.routers as Record<string, unknown>;
    for (const routerName of ['proxy', 'api_v1', 'operations', 'intelligence', 'occ', 'admin']) {
      expect(routers[routerName], `${routerName} router must be mounted`).toBe(true);
    }
    expect(deployment.intelligence_import_error ?? null).toBeNull();

    const versioned = await expectJson(await request.get(`${apiBaseUrl}/api/v1/health`), 200);
    expect(versioned.api).toBe('v1');
    expect(versioned.status).toBe('ok');

    const operations = await expectJson(await request.get(`${apiBaseUrl}/api/v1/ops/health`), 200);
    expect(['healthy', 'degraded']).toContain(operations.overall);
    expect(Array.isArray(operations.components)).toBe(true);
    expect(operations.components as unknown[]).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'api', status: 'healthy' })]),
    );

    const deployProbe = await expectJson(await request.get(`${apiBaseUrl}/api/deploy/probe`), 200);
    expect(deployProbe.status).toBe('ok');
    expect(deployProbe.router_registry).toBe('backend.app.routers');
  });

  test('protected APIs reject missing, malformed, and tampered JWTs and accept the certified session', async ({ request }) => {
    const protectedPath = `${apiBaseUrl}/api/intelligence/prompts`;
    await expectUnauthorized(await request.get(protectedPath));
    await expectUnauthorized(
      await request.get(protectedPath, { headers: { Authorization: 'Bearer not-a-jwt' } }),
    );
    await expectUnauthorized(
      await request.get(protectedPath, { headers: { Authorization: `Bearer ${tamperToken(accessToken)}` } }),
    );

    const payload = decodeJwtPayload(accessToken);
    expect(typeof payload.sub).toBe('string');
    const appMetadata = (payload.app_metadata ?? {}) as Record<string, unknown>;
    expect(['admin', 'operator']).not.toContain(appMetadata.role);

    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const runsResponse = await request.get(`${apiBaseUrl}/api/tools/github/runs/status?limit=1`, {
      headers: authHeaders,
    });
    expect([200, 503]).toContain(runsResponse.status());
    const runsBody = (await runsResponse.json()) as Record<string, unknown>;
    if (runsResponse.status() === 200) {
      expect(Array.isArray(runsBody.runs)).toBe(true);
    } else {
      expect(String(runsBody.detail ?? '')).toContain('GITHUB_TOKEN missing');
    }

    const prompts = await expectJson(
      await request.get(`${apiBaseUrl}/api/intelligence/prompts`, { headers: authHeaders }),
      200,
    );
    expect(Array.isArray(prompts.templates)).toBe(true);

    const workflows = await expectJson(
      await request.get(`${apiBaseUrl}/api/intelligence/workflows`, { headers: authHeaders }),
      200,
    );
    expect(Array.isArray(workflows.workflows)).toBe(true);
  });

  test('ordinary authenticated user is denied OCC and admin boundaries', async ({ request }) => {
    await expectUnauthorized(await request.get(`${apiBaseUrl}/api/occ/stats`));
    await expectUnauthorized(await request.get(`${apiBaseUrl}/api/admin/overview`));

    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    expect(
      (await request.get(`${apiBaseUrl}/api/occ/stats`, { headers: authHeaders })).status(),
    ).toBe(403);
    expect(
      (await request.get(`${apiBaseUrl}/api/admin/overview`, { headers: authHeaders })).status(),
    ).toBe(403);
  });
});
