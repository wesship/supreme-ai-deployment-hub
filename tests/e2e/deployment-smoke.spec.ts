import { test, expect } from './fixtures';

/**
 * D3VONN — Deployment Smoke Tests
 *
 * These tests run against the live Vercel preview/production URL after every
 * deployment. Set PLAYWRIGHT_BASE_URL to the Vercel preview URL in CI.
 *
 * In the GitHub Actions deploy.yml, add:
 *   env:
 *     PLAYWRIGHT_BASE_URL: ${{ steps.vercel-deploy.outputs.preview-url }}
 */

test.describe('Deployment Smoke', () => {
  test('app is reachable and returns 200', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('critical assets load (no 404 on JS/CSS)', async ({ page }) => {
    const failedRequests: string[] = [];

    page.on('response', response => {
      const url = response.url();
      const status = response.status();
      // Flag failed asset loads (JS, CSS, fonts)
      if (status >= 400 && (url.includes('/assets/') || url.endsWith('.js') || url.endsWith('.css'))) {
        failedRequests.push(`${status} ${url}`);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(failedRequests).toHaveLength(0);
  });

  test('security headers are present', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() ?? {};

    // These headers should be set by nginx.conf
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBeTruthy();
  });

  test('health endpoint returns ok', async ({ page }) => {
    const response = await page.goto('/health');
    expect(response?.status()).toBe(200);
    const body = await response?.text();
    expect(body).toContain('ok');
  });
});
