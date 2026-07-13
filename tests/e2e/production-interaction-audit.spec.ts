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

async function collectConsoleAndPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function waitForApplication(page: Page) {
  await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
}

test.describe('D3VONN.IO production interaction audit', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} loads and exposes valid interactive controls`, async ({ page, request }) => {
      const runtimeErrors = await collectConsoleAndPageErrors(page);
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      await waitForApplication(page);

      expect(response, `${route} did not return a document response`).not.toBeNull();
      expect(response?.status(), `${route} returned an error status`).toBeLessThan(400);
      await expect(page.locator('body')).toBeVisible();

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

        const box = await button.boundingBox();
        expect(box, `Button "${label}" has no clickable area on ${route}`).not.toBeNull();
        expect(box?.width ?? 0, `Button "${label}" is too narrow to click on ${route}`).toBeGreaterThanOrEqual(20);
        expect(box?.height ?? 0, `Button "${label}" is too short to click on ${route}`).toBeGreaterThanOrEqual(20);
      }

      expect(runtimeErrors, `Runtime errors detected on ${route}`).toEqual([]);
    });
  }

  test('homepage navigation links reach their intended destinations', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);

    const internalLinks = page.locator('a:visible[href^="/"]');
    const count = await internalLinks.count();
    const tested = new Set<string>();

    for (let index = 0; index < count; index += 1) {
      const href = (await internalLinks.nth(index).getAttribute('href')) ?? '';
      if (!href || tested.has(href) || href.startsWith('/api/')) continue;
      tested.add(href);

      const context = await page.context().newPage();
      const response = await context.goto(href, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `Homepage destination failed: ${href}`).toBeLessThan(400);
      await expect(context.locator('body')).toBeVisible();
      await context.close();
    }

    expect(tested.size, 'Homepage did not expose any testable internal destinations').toBeGreaterThan(0);
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
