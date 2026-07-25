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

async function signInAndReadAccessToken(page: Page): Promise<string> {
  if (!testEmail || !testPassword) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be configured');
  }

  await page.goto(`${frontendBaseUrl}/login?redirect=%2Fapp`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  const email = page.locator('input[type="email"]');
  const password = page.locator('input[type="password"]');

  await expect(email).toBeVisible();
  await expect(password).toBeVisible();

  await expect(async () => {
    await email.fill(testEmail);
    await password.fill(testPassword);
    await expect(email).toHaveValue(testEmail);
    await expect(password).toHaveValue(testPassword);
  }).toPass({ timeout: 10_000 });

  const submit = page.locator('button[type="submit"]').filter({ hasText: /sign in|log in/i }).first();
  await expect(submit).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });

  await expect.poll(() => readSupabaseAccessToken(page), { timeout: 10_000 }).not.toBeNull();
  const token = await readSupabaseAccessToken(page);
  if (!token) throw new Error('Authenticated session did not expose a Supabase access token');
  return token;
}

test.describe.serial('D3VONN.IO production backend API certification', () => {
  let accessToken = '';

  test.beforeAll(async ({ browser }) => {
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

  test('general and intelligence APIs enforce JWTs and accept the certified session', async ({ request }) => {
    expect((await request.get(`${apiBaseUrl}/api/tools/github/runs/status?limit=1`)).status()).toBe(401);

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

    expect((await request.get(`${apiBaseUrl}/api/intelligence/prompts`)).status()).toBe(401);
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

  test('operator OCC access succeeds while admin data remains denied', async ({ request }) => {
    expect((await request.get(`${apiBaseUrl}/api/occ/stats`)).status()).toBe(401);

    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const stats = await expectJson(
      await request.get(`${apiBaseUrl}/api/occ/stats`, { headers: authHeaders }),
      200,
    );
    for (const field of [
      'total_ai_requests',
      'total_tokens_used',
      'total_cost_usd',
      'unresolved_errors',
      'pending_approvals',
      'total_rag_documents',
    ]) {
      expect(typeof stats[field], `${field} must be numeric`).toBe('number');
    }

    expect((await request.get(`${apiBaseUrl}/api/admin/overview`)).status()).toBe(401);
    expect(
      (await request.get(`${apiBaseUrl}/api/admin/overview`, { headers: authHeaders })).status(),
    ).toBe(403);
  });
});
