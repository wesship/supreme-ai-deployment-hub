import { expect, test } from '@playwright/test';

test.describe('D3VONN.IO public launch smoke tests', () => {
  test('homepage presents investor and enterprise launch story', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/D3VONN\.IO.*AI Business Operating System/i);
    await expect(page.getByRole('heading', { name: /welcome to/i })).toBeVisible();
    await expect(page.getByText(/The World's First AI Business Operating System/i)).toBeVisible();
    await expect(page.getByText(/AI Workforce\. Limitless Potential\./i)).toBeVisible();

    await expect(page.getByRole('link', { name: /Launch D3VONN/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Explore Platform/i }).first()).toBeVisible();
  });

  test('homepage includes product proof, architecture, and enterprise CTAs', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/Product Walkthrough/i)).toBeVisible();
    await expect(page.getByText(/From business intent to/i)).toBeVisible();
    await expect(page.getByText(/Hermes Dashboard Preview/i)).toBeVisible();
    await expect(page.getByText(/Enterprise Readiness/i)).toBeVisible();
    await expect(page.getByText(/Architecture/i)).toBeVisible();
    await expect(page.getByText(/Investor & Pilot Readiness/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Schedule Enterprise Demo/i }).first()).toBeVisible();
  });

  test('robots and sitemap expose public crawl controls', async ({ page }) => {
    const robots = await page.request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    const robotsText = await robots.text();
    expect(robotsText).toContain('Allow: /');
    expect(robotsText).toContain('Disallow: /admin');
    expect(robotsText).toContain('Sitemap: https://d3vonn.io/sitemap.xml');

    const sitemap = await page.request.get('/sitemap.xml');
    expect(sitemap.ok()).toBeTruthy();
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain('https://d3vonn.io/');
    expect(sitemapText).toContain('https://d3vonn.io/ai-agents');
    expect(sitemapText).toContain('https://d3vonn.io/business-automation');
  });

  test('login route loads for launch/app entry path', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toContainText(/log in|login|sign in/i);
  });
});
