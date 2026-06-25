/**
 * D3VONN.IO — Smoke Tests (Playwright)
 *
 * Lightweight, fast-running tests that validate critical paths:
 *   1. Homepage renders with correct title and H1
 *   2. Login page loads auth form
 *   3. /sitemap.xml is accessible and valid XML
 *   4. /robots.txt is accessible with correct directives
 *   5. /app redirects unauthenticated users to /login
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('Homepage loads with correct title and visible heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/D3VONN\.IO/);
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('Login page renders email and password fields', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible({ timeout: 10_000 });
  });

  test('/sitemap.xml returns valid XML with expected URLs', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('<?xml');
    expect(body).toContain('<urlset');
    expect(body).toContain('https://d3vonn.io');
    // Verify key public pages are listed
    expect(body).toContain('/ai-agents');
    expect(body).toContain('/business-automation');
    expect(body).toContain('/marketplace');
  });

  test('/robots.txt returns correct directives', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const body = await response.text();
    // Should allow public crawling
    expect(body).toMatch(/User-agent:\s*\*/i);
    expect(body).toMatch(/Allow:\s*\//);
    // Should block private routes
    expect(body).toContain('/app');
    expect(body).toContain('/admin');
    expect(body).toContain('/login');
    // Should reference sitemap
    expect(body).toMatch(/Sitemap:/i);
  });

  test('/app redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/app');
    // Should redirect to login (URL may include redirect param)
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });
});
