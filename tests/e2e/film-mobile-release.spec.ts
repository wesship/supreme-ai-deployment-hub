import { test, expect } from '@playwright/test';

for (const width of [390, 768]) {
  test(`Film responsive acceptance at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/film', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText('Sovereign Signal', { timeout: 20_000 });
    const skip = page.getByRole('button', { name: /skip intro/i });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.screenshot({ path: `test-results/film-${width}.png`, fullPage: true });
    const sizes = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(sizes.documentWidth, `unexpected horizontal overflow at ${width}px`).toBeLessThanOrEqual(sizes.viewportWidth + 1);
    expect(errors, 'uncaught browser exceptions').toEqual([]);
  });
}
