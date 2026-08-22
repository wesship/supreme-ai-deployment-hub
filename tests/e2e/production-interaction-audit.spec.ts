import { expect, test, type Page } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/',
  '/solutions',
  '/pricing',
  '/security',
  '/resources',
  '/ai-agents',
  '/business-automation',
  '/marketplace',
  '/film',
  '/documentation',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
] as const;

const DISALLOWED_HREFS = new Set(['', '#', 'javascript:void(0)', 'javascript:;']);
const EXPECTED_STUB_ORIGINS = new Set(['https://placeholder.supabase.co']);
const EXPECTED_LOCAL_404_PATHS = new Set(['/api/public/stats', '/_vercel/insights/script.js']);

async function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;

    const text = message.text();
    // Chromium emits this anonymous message for failed responses. The response
    // listener below records the status and URL so failures stay actionable.
    if (text.startsWith('Failed to load resource:')) return;
    errors.push(`console: ${text}`);
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;

    const url = new URL(response.url());
    if (EXPECTED_STUB_ORIGINS.has(url.origin)) return;
    if (url.hostname === '127.0.0.1' && EXPECTED_LOCAL_404_PATHS.has(url.pathname)) return;
    errors.push(`response ${response.status()}: ${url.href}`);
  });

  return errors;
}

async function waitForApplication(page: Page) {
  await expect(page.locator('#root')).toBeAttached({ timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
}

test.describe('D3VONN.IO production interaction audit', () => {
  test('AI Film cards use title-linked preview media and preserve an honest upcoming-title state', async ({ page }) => {
    await page.goto('/film', { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);
    await expect(page.locator('h1').filter({ hasText: 'Sovereign Signal' })).toBeVisible();

    const featuredSection = page.locator('section[aria-label="D3VONN AI Films"]');
    const featuredHeroMedia = featuredSection.locator('video, img').first();
    await expect(featuredHeroMedia).toBeVisible();
    await expect(featuredHeroMedia).toHaveAttribute('poster', '/films/sovereign-signal-keyframe.png').catch(async () => {
      await expect(featuredHeroMedia).toHaveAttribute('src', '/films/sovereign-signal-keyframe.png');
    });
    await expect.poll(async () => featuredHeroMedia.evaluate((element) => getComputedStyle(element.parentElement!).position)).toBe('absolute');

    const mobileCompanionTrigger = page.getByRole('button', { name: 'Open AI Film Companion' });
    await expect(mobileCompanionTrigger).toBeVisible();
    expect(await mobileCompanionTrigger.evaluate((element) => getComputedStyle(element).position)).not.toBe('fixed');

    const sovereignSignalCard = page.locator('article').filter({ hasText: 'Sovereign Signal' }).first();
    await expect(sovereignSignalCard.locator('video')).toHaveAttribute('src', '/films/sovereign-signal.mp4');
    await expect(sovereignSignalCard.locator('video')).toHaveAttribute('poster', '/films/sovereign-signal-keyframe.png');
    await sovereignSignalCard.getByRole('button', { name: 'Watch Sovereign Signal preview' }).click();

    const sovereignSignalDialog = page.getByRole('dialog', { name: 'Sovereign Signal' });
    await expect(sovereignSignalDialog.getByLabel('Sovereign Signal preview')).toHaveAttribute('src', '/films/sovereign-signal.mp4');
    await expect(sovereignSignalDialog.getByText('Preview clip for')).toBeVisible();
    await expect(sovereignSignalDialog.getByText('Spoken-word captions will be added when a verified transcript is available.')).toBeVisible();
    await sovereignSignalDialog.getByRole('button', { name: 'Close film details' }).click();

    const genesisProtocolCard = page.locator('article').filter({ hasText: 'Genesis Protocol' }).first();
    await expect(genesisProtocolCard.locator('video')).toHaveCount(0);
    await expect(genesisProtocolCard.getByRole('button', { name: 'View Genesis Protocol details' })).toBeVisible();
  });

  test('the malformed encoded film path redirects to the canonical film page', async ({ page }) => {
    await page.goto('/film%60', { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);
    await expect(page).toHaveURL(/\/film$/);
    await expect(page.locator('#main-content')).toBeVisible();
  });

  for (const route of PUBLIC_ROUTES) {
    test(`${route} loads and exposes valid interactive controls`, async ({ page }) => {
      const runtimeErrors = await collectRuntimeErrors(page);
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      await waitForApplication(page);
      expect(response, `${route} did not return a document response`).not.toBeNull();
      expect(response?.status(), `${route} returned an error status`).toBeLessThan(400);
      expect(runtimeErrors, `Runtime errors detected on ${route}`).toEqual([]);
      await expect(page.locator('#root')).not.toBeEmpty();
      await expect(page.locator('#main-content')).toBeVisible();

      const interactiveElements = page.locator('a[href], button, input, select, textarea');
      const count = await interactiveElements.count();
      expect(count, `${route} has no interactive controls`).toBeGreaterThan(0);

      const hrefs = await page.locator('a[href]').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
      for (const href of hrefs) {
        expect(DISALLOWED_HREFS.has(href), `${route} contains a disallowed href: ${href}`).toBe(false);
      }
    });
  }
});
