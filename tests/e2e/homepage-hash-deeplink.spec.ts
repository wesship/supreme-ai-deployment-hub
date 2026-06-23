import { test, expect, type Page } from '@playwright/test';

/**
 * D3VONN homepage — hash deep-link scroll behavior.
 *
 * Verifies that opening `/#<section>` directly, refreshing on it, and
 * navigating back/forward all scroll the matching anchor into view.
 *
 * The `ScrollToTop` helper retries for ~3s after route mount, so we poll
 * the target element's bounding rect until it lands inside the viewport.
 */

const SECTIONS = ['platform', 'marketplace', 'command-center', 'vault', 'pricing'] as const;

async function expectAnchorInView(page: Page, id: string) {
  const el = page.locator(`#${id}`);
  await expect(el).toBeVisible({ timeout: 10_000 });

  await expect
    .poll(
      async () => {
        return el.evaluate((node) => {
          const rect = (node as HTMLElement).getBoundingClientRect();
          const vh = window.innerHeight || document.documentElement.clientHeight;
          // Top of section should land near the top of the viewport
          // (scroll-mt-24 ≈ 96px), and clearly within the visible band.
          return rect.top >= -2 && rect.top <= Math.min(220, vh * 0.5);
        });
      },
      { timeout: 5_000, intervals: [100, 200, 300, 500] },
    )
    .toBe(true);
}

test.describe('Homepage hash deep-linking', () => {
  for (const id of SECTIONS) {
    test(`direct load of /#${id} scrolls the section into view`, async ({ page }) => {
      await page.goto(`/#${id}`);
      await page.waitForLoadState('domcontentloaded');
      await expectAnchorInView(page, id);
      expect(new URL(page.url()).hash).toBe(`#${id}`);
    });
  }

  test('refresh on a hashed URL re-scrolls the section into view', async ({ page }) => {
    await page.goto('/#vault');
    await expectAnchorInView(page, 'vault');

    await page.reload();
    await expectAnchorInView(page, 'vault');
  });

  test('browser back/forward re-scrolls between hashed sections', async ({ page }) => {
    await page.goto('/#marketplace');
    await expectAnchorInView(page, 'marketplace');

    await page.goto('/#pricing');
    await expectAnchorInView(page, 'pricing');

    await page.goBack();
    await expect.poll(() => new URL(page.url()).hash).toBe('#marketplace');
    await expectAnchorInView(page, 'marketplace');

    await page.goForward();
    await expect.poll(() => new URL(page.url()).hash).toBe('#pricing');
    await expectAnchorInView(page, 'pricing');
  });

  test('native hashchange (location.hash mutation) scrolls to the new section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      window.location.hash = '#command-center';
    });

    await expectAnchorInView(page, 'command-center');
  });
});
