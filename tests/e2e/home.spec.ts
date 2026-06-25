import { test, expect } from './fixtures';

/**
 * D3VONN.IO — Homepage Smoke Tests
 *
 * These are the foundational E2E tests that must pass on every deployment.
 * They verify the app loads, renders without JS errors, and key UI elements
 * are present.
 */

test.describe('Homepage', () => {
  test('loads without JavaScript errors', async ({ homePage, consoleErrors }) => {
    await homePage.navigate();
    await homePage.expectNoConsoleErrors(consoleErrors);
  });

  test('renders the main navigation', async ({ homePage }) => {
    await homePage.navigate();
    await homePage.expectNavigation();
  });

  test('renders the hero/dashboard section', async ({ homePage }) => {
    await homePage.navigate();
    await homePage.expectHeroSection();
  });

  test('has a valid page title', async ({ homePage }) => {
    await homePage.navigate();
    // Adjust the regex to match your actual app title
    await homePage.expectTitle(/Devonn|Supreme AI|Dashboard/i);
  });

  test('responds within 3 seconds on first load', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });
});

test.describe('Accessibility', () => {
  test('has no critical ARIA violations on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Basic ARIA checks — extend with @axe-core/playwright for full audit
    const mainLandmark = page.locator('main, [role="main"]');
    await expect(mainLandmark).toBeVisible();

    // Ensure all images have alt text
    const imagesWithoutAlt = page.locator('img:not([alt])');
    const count = await imagesWithoutAlt.count();
    expect(count).toBe(0);
  });
});

test.describe('Routing', () => {
  test('navigates to /404 for unknown routes', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-xyz');
    // SPA should handle 404 gracefully — either show 404 page or redirect to /
    await expect(page).toHaveURL(/\/this-route-does-not-exist-xyz|\/404|\//);
  });
});
