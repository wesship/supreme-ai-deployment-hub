import { expect, test } from '@playwright/test';

test.describe('D3VONN wearable display preview', () => {
  test('is CSP-safe, keyboard-operable, and honest about integration status', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    const response = await page.goto('/glasses/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByText('Simulator', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'D3VONN ready' })).toBeVisible();
    await expect(page.locator('script:not([src])')).toHaveCount(0);
    await expect(page.locator('style')).toHaveCount(0);

    const ask = page.getByRole('button', { name: 'ASK Ask D3VONN' });
    const radio = page.getByRole('button', { name: 'PLAY HNF Radio' });
    await ask.focus();
    await page.keyboard.press('ArrowDown');
    await expect(radio).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'HNF Radio preview' })).toBeVisible();
    await expect(page.getByText(/Playback is not started from this simulator/)).toBeVisible();

    await page.getByRole('button', { name: 'NEXT PRIMETIME' }).click();
    await expect(page.getByRole('heading', { name: 'PRIMETIME preview' })).toBeVisible();
    await expect(page.getByText(/No media or workflow was queued/)).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });

  test('fits narrow viewports without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/glasses/', { waitUntil: 'domcontentloaded' });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);
    await expect(page.getByRole('main')).toBeVisible();
  });
});
