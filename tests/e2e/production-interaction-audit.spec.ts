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

    const featuredHeroPoster = page.locator('section[aria-label="D3VONN AI Films"] > div > div > img');
    await expect(featuredHeroPoster).toHaveAttribute('src', '/films/sovereign-signal-keyframe.png');

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
    test(`${route} loads and exposes valid interactive controls`, async ({ page, request }) => {
      const runtimeErrors = await collectRuntimeErrors(page);
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      await waitForApplication(page);

      expect(response, `${route} did not return a document response`).not.toBeNull();
      expect(response?.status(), `${route} returned an error status`).toBeLessThan(400);
      expect(runtimeErrors, `Runtime errors detected on ${route}`).toEqual([]);
      await expect(page.locator('#root')).not.toBeEmpty();
      await expect(page.locator('#main-content')).toBeVisible();

      const visibleLinks = page.locator('a:visible');
      const linkCount = await visibleLinks.count();
      expect(linkCount, `${route} contains no visible links`).toBeGreaterThan(0);

      for (let index = 0; index < linkCount; index += 1) {
        const link = visibleLinks.nth(index);
        const href = (await link.getAttribute('href'))?.trim() ?? '';
        const label = ((await link.getAttribute('aria-label')) ?? (await link.innerText())).trim();

        expect(label, `Unnamed visible link at ${route} index ${index}`).not.toBe('');
        expect(DISALLOWED_HREFS.has(href.toLowerCase()), `Dead link "${label}" on ${route}: ${href}`).toBeFalsy();

        if (
          href.startsWith('/') &&
          !href.startsWith('//') &&
          !href.startsWith('/api/') &&
          !href.includes('#')
        ) {
          const target = await request.get(href, { failOnStatusCode: false });
          expect(target.status(), `Internal link "${label}" from ${route} failed: ${href}`).toBeLessThan(400);
        }
      }

      const visibleButtons = page.locator('button:visible');
      const buttonCount = await visibleButtons.count();

      for (let index = 0; index < buttonCount; index += 1) {
        const button = visibleButtons.nth(index);
        const label = (
          (await button.getAttribute('aria-label')) ??
          (await button.getAttribute('title')) ??
          (await button.innerText())
        ).trim();

        expect(label, `Unnamed visible button at ${route} index ${index}`).not.toBe('');
        await expect(button, `Button "${label}" is disabled on ${route}`).toBeEnabled();

        await expect
          .poll(async () => (await button.boundingBox())?.width ?? 0, {
            message: `Button "${label}" is too narrow to click on ${route}`,
            timeout: 5_000,
          })
          .toBeGreaterThanOrEqual(20);
        await expect
          .poll(async () => (await button.boundingBox())?.height ?? 0, {
            message: `Button "${label}" is too short to click on ${route}`,
            timeout: 5_000,
          })
          .toBeGreaterThanOrEqual(20);
      }

    });
  }

  test('homepage navigation links reach their intended destinations', async ({ page, request }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);

    const hrefs = await page.locator('a:visible[href^="/"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? ''),
    );
    const tested = [...new Set(hrefs.filter((href) => href && !href.startsWith('/api/')))];

    for (const href of tested) {
      const response = await request.get(href, { failOnStatusCode: false });
      expect(response.status(), `Homepage destination failed: ${href}`).toBeLessThan(400);
    }

    expect(tested.length, 'Homepage did not expose any testable internal destinations').toBeGreaterThan(0);
  });

  test('mobile header controls are reachable and do not sit beneath the EXU overlay', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);

    const buttons = page.locator('button:visible');
    const count = await buttons.count();
    expect(count, 'No mobile buttons were visible').toBeGreaterThan(0);

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index);
      const label = (
        (await button.getAttribute('aria-label')) ??
        (await button.getAttribute('title')) ??
        (await button.innerText())
      ).trim();
      const box = await button.boundingBox();
      if (!box) continue;

      expect(box.x, `Mobile button "${label}" extends off the left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `Mobile button "${label}" extends off the right edge`).toBeLessThanOrEqual(viewport!.width + 1);
    }
  });
});
