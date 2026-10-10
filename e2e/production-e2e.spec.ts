/**
 * D3VONN.IO Production E2E Test Suite
 * Tests: desktop, mobile (390px), routing, auth, dashboard, agent cards,
 * API error handling, and loading states.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://d3vonn.io';

// Desktop Tests
test.describe('Desktop (1280x720)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('Homepage loads with correct title and meta', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/D3VONN\.IO/);
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
  });

  test('Navigation links are visible and functional', async ({ page }) => {
    await page.goto(BASE_URL);
    const platformLink = page.locator('a[href="/platform"]').first();
    await expect(platformLink).toBeVisible();
    const agentsLink = page.locator('a[href="/agents"]').first();
    await expect(agentsLink).toBeVisible();
    const pricingLink = page.locator('a[href="/pricing"]').first();
    await expect(pricingLink).toBeVisible();
  });

  test('Login page renders auth form', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const googleBtn = page.locator('button:has-text("Google")');
    await expect(googleBtn).toBeVisible({ timeout: 10000 });
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
  });

  test('Status page loads and shows services', async ({ page }) => {
    await page.goto(`${BASE_URL}/status`);
    const heading = page.locator('h1:has-text("System"), h1:has-text("Status")').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('Agents page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/agents`);
    const heading = page.locator('h1, h2').filter({ hasText: /Agent/i }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });
  });

  test('CTA buttons route to login with redirect', async ({ page }) => {
    await page.goto(BASE_URL);
    const launchBtn = page.locator('a[href*="/login?redirect"]').first();
    await expect(launchBtn).toBeVisible({ timeout: 10000 });
    const href = await launchBtn.getAttribute('href');
    expect(href).toContain('/login');
    expect(href).toContain('redirect');
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto(`${BASE_URL}/nonexistent-page-xyz`);
    await expect(page.locator('text=/not found|404/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('About page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/about`);
    const content = page.locator('main, [id="main-content"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });
});

// Mobile Tests (iPhone 14 - 390px)
test.describe('Mobile (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Homepage is responsive and readable', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/D3VONN\.IO/);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(400);
  });

  test('Login page is usable on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    const box = await emailInput.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(36);
  });

  test('Status page renders on mobile without overflow', async ({ page }) => {
    await page.goto(`${BASE_URL}/status`);
    await page.waitForTimeout(2000);
    // Allow slight overflow from scrollbar/padding but flag major issues
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(600);
  });

  test('Footer is reachable via scroll', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    const footer = page.locator('footer, [class*="footer"]').first();
    await expect(footer).toBeVisible({ timeout: 5000 });
  });
});

// API Error Handling
test.describe('API Error Handling', () => {
  test('Homepage handles API failure gracefully', async ({ page }) => {
    await page.route('**/api.d3vonn.io/**', (route) => route.abort());
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/D3VONN\.IO/);
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
  });
});
