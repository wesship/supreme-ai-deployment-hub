/**
 * navbar-protected-routes.spec.ts
 *
 * Verifies the auth-aware navbar behavior wired up in
 * `src/components/navigation/navigationItems.ts`, `NavLink.tsx`, and
 * `MobileMenu.tsx`:
 *
 *   1. Unauthenticated visitors who click a protected navbar link are
 *      redirected to `/login?redirect=<intended path>`.
 *   2. Direct navigation to a protected route is also redirected via
 *      `ProtectedRoute`.
 *   3. Public navbar links remain reachable without auth.
 *   4. Authenticated users (session seeded into localStorage) can reach
 *      protected destinations directly without being bounced to /login.
 *
 * The authenticated case uses a synthetic Supabase session written into
 * localStorage under the storage key derived from the same VITE_SUPABASE_URL
 * used to build/run the local app. This keeps the fixture valid when CI uses
 * an intentionally non-production placeholder Supabase URL.
 */

import { test, expect, type Page } from '@playwright/test';

const PROTECTED_PATH = '/agents';
const PUBLIC_PATHS = ['/platform', '/solutions', '/resources', '/security', '/pricing'];

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://tjygexesognbkwualywq.supabase.co';
const SUPABASE_PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const SUPABASE_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

function fakeSession() {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    expires_at: nowSec + 3600,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'e2e@d3vonn.io',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

async function seedSession(page: Page) {
  // Must establish the origin first so localStorage writes land on it.
  await page.goto('/');
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SUPABASE_STORAGE_KEY, JSON.stringify(fakeSession())] as const,
  );
}

async function clearSession(page: Page) {
  await page.goto('/');
  await page.evaluate((key) => window.localStorage.removeItem(key), SUPABASE_STORAGE_KEY);
}

test.describe('Navbar protected-route gating — unauthenticated', () => {
  test.beforeEach(async ({ page }) => {
    await clearSession(page);
  });

  test('direct navigation to a protected route redirects to /login with redirect param', async ({ page }) => {
    await page.goto(PROTECTED_PATH);
    await page.waitForURL(/\/login\?redirect=/, { timeout: 10_000 });

    const url = new URL(page.url());
    expect(url.pathname).toBe('/login');
    expect(decodeURIComponent(url.searchParams.get('redirect') ?? '')).toBe(PROTECTED_PATH);
  });

  test('clicking the protected "Agents" nav link routes through /login', async ({ page }) => {
    await page.goto('/');

    // Desktop nav renders the link with a precomputed href when signed-out.
    const agentsLink = page.getByRole('link', { name: /^Agents$/ }).first();
    await expect(agentsLink).toBeVisible();

    const href = await agentsLink.getAttribute('href');
    expect(href).not.toBeNull();
    expect(href!).toContain('/login');
    expect(href!).toContain(`redirect=${encodeURIComponent(PROTECTED_PATH)}`);

    await agentsLink.click();
    await page.waitForURL(/\/login\?redirect=/);
    expect(new URL(page.url()).pathname).toBe('/login');
  });

  test('public navbar links remain reachable without auth', async ({ page }) => {
    for (const path of PUBLIC_PATHS) {
      await page.goto(path);
      // Should NOT be bounced to /login.
      expect(new URL(page.url()).pathname).toBe(path);
    }
  });
});

test.describe('Navbar protected-route gating — authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('authenticated user can navigate directly to a protected route', async ({ page }) => {
    await page.goto(PROTECTED_PATH);

    // Give ProtectedRoute a moment to resolve auth state.
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    expect(new URL(page.url()).pathname).toBe(PROTECTED_PATH);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('"Agents" navbar link points at the protected path, not /login', async ({ page }) => {
    await page.goto('/');
    // Allow useAuthState to hydrate.
    await page.waitForTimeout(500);

    const agentsLink = page.getByRole('link', { name: /^Agents$/ }).first();
    await expect(agentsLink).toBeVisible();

    const href = await agentsLink.getAttribute('href');
    expect(href).toBe(PROTECTED_PATH);
  });
});
