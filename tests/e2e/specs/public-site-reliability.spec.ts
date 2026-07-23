import { expect, test } from '@playwright/test';

test.describe('Public site reliability', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Platform navigation lands on the homepage platform section', async ({ page }) => {
    await page.goto('/platform');
    await page.waitForURL(/\/#platform$/);

    const target = page.locator('#platform');
    await expect(target).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test('shared public banners render without broken images', async ({ page }) => {
    for (const route of ['/contact', '/status']) {
      await page.goto(route);
      await expect(page.locator('section[aria-label="D3VONN.IO banner"]')).toBeVisible();

      const brokenImages = await page.evaluate(() =>
        Array.from(document.images)
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => image.currentSrc || image.src),
      );

      expect(brokenImages, `broken images on ${route}`).toEqual([]);
    }
  });

  test('desktop logo stays inside the fixed header', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header').first();
    const logo = page.getByRole('img', {
      name: 'D3VONN.IO — One Platform. Infinite Intelligence.',
    });

    await expect(header).toBeVisible();
    await expect(logo).toBeVisible();

    const [headerBox, logoBox] = await Promise.all([
      header.boundingBox(),
      logo.boundingBox(),
    ]);

    expect(headerBox).not.toBeNull();
    expect(logoBox).not.toBeNull();
    expect(logoBox!.y).toBeGreaterThanOrEqual(headerBox!.y);
    expect(logoBox!.y + logoBox!.height).toBeLessThanOrEqual(
      headerBox!.y + headerBox!.height,
    );
  });
});
