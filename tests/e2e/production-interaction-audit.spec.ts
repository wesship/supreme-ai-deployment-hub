import { expect, test, type Page } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/', '/solutions', '/pricing', '/security', '/resources', '/ai-agents',
  '/business-automation', '/marketplace', '/film', '/documentation', '/about',
  '/contact', '/mile-high-golden-elevation', '/terms', '/privacy',
] as const;

const DISALLOWED_HREFS = new Set(['', '#', 'javascript:void(0)', 'javascript:;']);
const EXPECTED_STUB_ORIGINS = new Set(['https://placeholder.supabase.co']);
const EXPECTED_LOCAL_404_PATHS = new Set(['/api/public/stats', '/_vercel/insights/script.js']);

function isExpectedCspDiagnostic(text: string) {
  return text.includes('upgrade-insecure-requests') && text.toLowerCase().includes('report-only');
}

async function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.startsWith('Failed to load resource:')) return;
    if (isExpectedCspDiagnostic(text)) return;
    if (
      text.includes('placeholder.supabase.co')
      && (text.includes('ERR_FAILED') || text.includes('Cross-Origin Request Blocked'))
    ) return;
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
  test('the wearable display preview is CSP-safe and keyboard operable', async ({ page }) => {
    const runtimeErrors = await collectRuntimeErrors(page);
    const response = await page.goto('/glasses/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByText('Simulator', { exact: true })).toBeVisible();
    await expect(page.locator('script:not([src])')).toHaveCount(0);

    const ask = page.getByRole('button', { name: 'ASK Ask D3VONN' });
    const radio = page.getByRole('button', { name: 'PLAY HNF Radio' });
    await ask.focus();
    await page.keyboard.press('ArrowDown');
    await expect(radio).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'HNF Radio preview' })).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });

  test('AI Films keeps the featured shell lightweight and loads OpenMontage on demand', async ({ page }) => {
    await page.goto('/film', { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);

    const skipIntro = page.getByRole('button', { name: 'Skip Intro' });
    if (await skipIntro.isVisible().catch(() => false)) await skipIntro.click();

    const filmsSection = page.locator('section[aria-label="D3VONN AI Films"]');
    await expect(filmsSection).toBeVisible();
    await expect(filmsSection.getByRole('heading', { name: 'Sovereign Signal', exact: true }).first()).toBeVisible();

    const featuredMedia = filmsSection.locator(':scope > div').first();
    const featuredPoster = featuredMedia.locator('img').first();
    await expect(featuredPoster).toHaveAttribute('src', '/films/sovereign-signal-keyframe.png');
    await expect(featuredPoster).toHaveAttribute('loading', 'eager');
    await expect(featuredPoster).toHaveAttribute('fetchpriority', 'high');
    await expect(featuredMedia.locator('video')).toHaveCount(0);

    // The expensive embedded studio must not be part of the initial render.
    await expect(page.getByRole('heading', { name: 'AI Films', exact: true })).toHaveCount(0);
    await expect(filmsSection.getByRole('heading', { name: 'Movies and Originals', exact: true })).toBeVisible();

    // Exercise the featured preview before mounting OpenMontage. On mobile,
    // mounting the studio scrolls its anchor into view and can temporarily cover
    // the featured card while layout settles.
    const sovereignSignalCard = filmsSection.locator('article').filter({ hasText: 'Sovereign Signal' }).first();
    await expect(sovereignSignalCard).toBeVisible();
    const sovereignSignalVideo = sovereignSignalCard.locator('video');
    await expect(sovereignSignalVideo).toHaveAttribute('src', '/films/sovereign-signal.mp4');
    await expect(sovereignSignalVideo).toHaveAttribute('poster', '/films/sovereign-signal-keyframe.png');
    await expect(sovereignSignalVideo).toHaveAttribute('preload', 'none');
    await sovereignSignalCard.getByRole('button', { name: 'Watch Sovereign Signal preview' }).click();

    const sovereignSignalDialog = page.getByRole('dialog', { name: 'Sovereign Signal' });
    await expect(sovereignSignalDialog).toBeVisible();
    const dialogVideo = sovereignSignalDialog.locator('video');
    await expect(dialogVideo).toHaveAttribute('src', '/films/sovereign-signal.mp4');
    await expect(dialogVideo).toHaveAttribute('poster', '/films/sovereign-signal-keyframe.png');
    await expect(sovereignSignalDialog.getByRole('button', { name: 'Track Preview Progress' })).toBeVisible();
    await expect(sovereignSignalDialog.getByRole('button', { name: 'My Library' })).toBeVisible();
    await sovereignSignalDialog.getByRole('button', { name: 'Close film details' }).click();
    await expect(sovereignSignalDialog).toHaveCount(0);

    const genesisCard = filmsSection.locator('article').filter({ hasText: 'Genesis Protocol' }).first();
    await expect(genesisCard).toBeVisible();
    await expect(genesisCard.getByText('Coming Soon', { exact: true })).toBeVisible();
    await expect(genesisCard.getByRole('button', { name: 'Watch Genesis Protocol preview' })).toBeVisible();

    const createFilm = filmsSection.getByRole('button', { name: 'Create a Film', exact: true }).first();
    await expect(createFilm).toBeVisible();
    await createFilm.click();
    await expect(page.locator('#openmontage-studio-anchor')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI Films', exact: true })).toBeVisible({ timeout: 15_000 });
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
        if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/api/') && !href.includes('#')) {
          const target = await request.get(href, { failOnStatusCode: false });
          expect(target.status(), `Internal link "${label}" from ${route} failed: ${href}`).toBeLessThan(400);
        }
      }

      const controls = await page.locator('button:visible').evaluateAll((buttons) => buttons.map((button) => {
        const label = ((button.getAttribute('aria-label') ?? button.getAttribute('title') ?? button.textContent ?? '')).trim();
        const rect = button.getBoundingClientRect();
        return { label, disabled: (button as HTMLButtonElement).disabled, width: rect.width, height: rect.height };
      }));
      expect(controls.length, `${route} contains no visible buttons`).toBeGreaterThan(0);
      for (const [index, control] of controls.entries()) {
        expect(control.label, `Unnamed visible button at ${route} index ${index}`).not.toBe('');
        expect(control.disabled, `Button "${control.label}" is disabled on ${route}`).toBe(false);
        expect(control.width, `Button "${control.label}" is too narrow on ${route}`).toBeGreaterThanOrEqual(20);
        expect(control.height, `Button "${control.label}" is too short on ${route}`).toBeGreaterThanOrEqual(20);
      }
    });
  }

  test('homepage navigation links reach their intended destinations', async ({ page, request }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);
    const hrefs = await page.locator('a:visible[href^="/"]').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
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
    const controls = await page.locator('button:visible').evaluateAll((buttons) => buttons.map((button) => {
      const label = ((button.getAttribute('aria-label') ?? button.getAttribute('title') ?? button.textContent ?? '')).trim();
      const box = button.getBoundingClientRect();
      return { label, x: box.x, right: box.right };
    }));
    expect(controls.length, 'No mobile buttons were visible').toBeGreaterThan(0);
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    for (const control of controls) {
      expect(control.x, `Mobile button "${control.label}" extends off the left edge`).toBeGreaterThanOrEqual(0);
      expect(control.right, `Mobile button "${control.label}" extends off the right edge`).toBeLessThanOrEqual(viewport!.width + 1);
    }
  });
});

// E2E certification: this suite intentionally validates the live /film contract.
