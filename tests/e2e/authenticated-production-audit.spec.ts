import { expect, test } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'https://d3vonn.io';
const testEmail = process.env.E2E_TEST_EMAIL?.trim();
const testPassword = process.env.E2E_TEST_PASSWORD?.trim();

const authConfigured = Boolean(testEmail && testPassword);

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(`${baseUrl}/login?redirect=%2Fapp`, { waitUntil: 'domcontentloaded' });

  const email = page.locator('input[type="email"]');
  const password = page.locator('input[type="password"]');

  await expect(email).toBeVisible();
  await expect(password).toBeVisible();

  await email.fill(testEmail!);
  await password.fill(testPassword!);

  const submit = page.locator('button[type="submit"]').filter({ hasText: /sign in|log in/i }).first();
  await expect(submit).toBeVisible();
  await submit.click();

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });
}

test.describe('D3VONN.IO production authentication boundary', () => {
  test('unauthenticated users are redirected from /app to login with return path', async ({ page }) => {
    await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/login\?redirect=%2Fapp$/);
    await expect(page.getByRole('heading', { name: 'D3VONN.IO', exact: true })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('login page exposes Google and email sign-in methods', async ({ page }) => {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeEnabled();
  });

  test('restricted production test user can authenticate and open /app', async ({ page }) => {
    test.skip(!authConfigured, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD are not configured');

    await signIn(page);
    await page.goto(`${baseUrl}/app`, { waitUntil: 'networkidle' });

    await expect(page).toHaveURL(/\/app(?:\?|$)/);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText(/verifying your session/i)).toHaveCount(0, { timeout: 15_000 });
  });

  test('authenticated session can load core workspace routes without server failures', async ({ page }) => {
    test.skip(!authConfigured, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD are not configured');

    await signIn(page);

    const routes = ['/app', '/dashboard', '/agents', '/workflows', '/voice-studio', '/security/ops'];

    for (const route of routes) {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
      expect(response, `No document response for ${route}`).not.toBeNull();
      expect(response!.status(), `${route} returned ${response!.status()}`).toBeLessThan(500);
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
