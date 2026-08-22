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
  test('AI Films expose real preview media and honest catalog states', async ({ page }) => {
    await page.goto('/film', { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);

    await expect(page.getByRole('heading', { name: 'Sovereign Signal' }).first()).toBeVisible();

    const filmSection = page.locator('section[aria-label="D3VONN AI Films"]');
    await expect(filmSection).toBeVisible();

    const featuredHeroMedia = filmSection.locator('video, img').first();
    await expect(featuredHeroMedia).toBeVisible();
    await expect(featuredHeroMedia).toHaveAttribute('poster', '/films/sovereign-signal-keyframe.png');

    const sovereignSignalCard = page.locator('button[aria-label="Open Sovereign Signal"]').first();
    await expect(sovereignSignalCard).toBeVisible();
    await expect(sovereignSignalCard.locator('video')).toHaveAttribute('src', '/films/sovereign-signal.mp4');
    await expect(sovereignSignalCard.locator('video')).toHaveAttribute('poster', '/films/sovereign-signal-keyframe.png');

    await sovereignSignalCard.click();
    const sovereignSignalDialog = page.getByRole('dialog', { name: 'Sovereign Signal' });
    await expect(sovereignSignalDialog).toBeVisible();
    await expect(sovereignSignalDialog.getByRole('button', { name: 'Close film details' })).toBeVisible();
    await sovereignSignalDialog.getByLabel('Sovereign Signal preview').toHaveAttribute('src', '/films/sovereign-signal.mp4');
    await sovereignSignalDialog.getByText('Preview clip for').toBeVisible();
    await sovereignSignalDialog.getByRole('button', { name: 'Close film details' }).click();

    for (const title of ['Building D3VONN.IO', 'Inside HERMES', 'GUARDIAN', 'The AI Workforce', 'Agent Zero']) {
      await expect(page.locator(`button[aria-label="Open ${title}"]`)).toBeVisible();
    }
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

      const links = await page.locator('a:visible').evaluateAll((elements) =>
        elements.map((link) => ({
          href: (link.getAttribute('href') ?? '').trim(),
          label: ((link.getAttribute('aria-label') ?? link.textContent) ?? '').trim(),
        })),
      );
      expect(links.length, `${route} contains no visible links`).toBeGreaterThan(0);

      for (const { href, label } of links) {
        expect(label, `Unnamed visible link on ${route}`).not.toBe('');
        expect(DISALLOWED_HREFS.has(href.toLowerCase()), `Dead link "${label}" on ${route}: ${href}`).toBeFalsy();
        if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/api/') && !href.includes('#')) {
          const target = await request.get(href, { failOnStatusCode: false });
          expect(target.status(), `Internal link "${label}" from ${route} failed: ${href}`).toBeLessThan(400);
        }
      }

      const buttons = await page.locator('button:visible').evaluateAll((elements) =>
        elements.map((button) => ({
          label: ((button.getAttribute('aria-label') ?? button.getAttribute('title') ?? button.textContent) ?? '').trim(),
          disabled: (button as HTMLButtonElement).disabled,
          width: button.getBoundingClientRect().width,
          height: button.getBoundingClientRect().height,
        })),
      );

      for (const button of buttons) {
        expect(button.label, `Unnamed visible button on ${route}`).not.toBe('');
        expect(button.disabled, `Button "${button.label}" is disabled on ${route}`).toBe(false);
        expect(button.width, `Button "${button.label}" is too narrow on ${route}`).toBeGreaterThanOrEqual(20);
        expect(button.height, `Button "${button.label}" is too short on ${route}`).toBeGreaterThanOrEqual(20);
      }
    });
  }

  test('homepage navigation links reach their intended destinations', async ({ page, request }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);

    const hrefs = await page.locator('a:visible[href^="/"]').evaluateAll((links) =>
      [...new Set(links.map((link) => link.getAttribute('href') ?? '').filter((href) => href && !href.startsWith('/api/')))],
    );

    for (const href of hrefs) {
      const response = await request.get(href, { failOnStatusCode: false });
      expect(response.status(), `Homepage destination failed: ${href}`).toBeLessThan(400);
    }

    expect(hrefs.length, 'Homepage did not expose any testable internal destinations').toBeGreaterThan(0);
  });

  test('mobile header controls are reachable and remain within the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    const buttons = await page.locator('button:visible').evaluateAll((elements) =>
      elements.map((button) => ({
        label: ((button.getAttribute('aria-label') ?? button.getAttribute('title') ?? button.textContent) ?? '').trim(),
        rect: (() => {
          const box = button.getBoundingClientRect();
          return { x: box.x, right: box.right };
        })(),
      })),
    );

    expect(buttons.length, 'No mobile buttons were visible').toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.label, 'Unnamed mobile button').not.toBe('');
      expect(button.rect.x, `Mobile button "${button.label}" extends off the left edge`).toBeGreaterThanOrEqual(0);
      expect(button.rect.right, `Mobile button "${button.label}" extends off the right edge`).toBeLessThanOrEqual(viewport!.width + 1);
    }
  });
});
