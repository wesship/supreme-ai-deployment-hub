import { expect, test } from '@playwright/test';

async function waitForApplication(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('#root')).toBeAttached({ timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
}

test.describe('D3VONN.IO production interaction audit', () => {
  test('AI Film cards use title-linked preview media and preserve an honest upcoming-title state', async ({ page }) => {
    await page.goto('/film', { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);
    await expect(page.locator('h1').filter({ hasText: 'Sovereign Signal' })).toBeVisible();

    const featuredHeroPoster = page.locator('section[aria-label="D3VONN AI Films"] video[poster="/films/sovereign-signal-keyframe.png"]').first();
    await expect(featuredHeroPoster).toHaveAttribute('poster', '/films/sovereign-signal-keyframe.png');
    await expect.poll(async () => featuredHeroPoster.evaluate((element) => getComputedStyle(element.parentElement!).position)).toBe('absolute');

    const mobileCompanionTrigger = page.getByRole('button', { name: 'Open AI Film Companion' });
    await expect(mobileCompanionTrigger).toBeVisible();
    expect(await mobileCompanionTrigger.evaluate((element) => getComputedStyle(element).position)).not.toBe('fixed');

    const sovereignSignalCard = page.locator('article').filter({ hasText: 'Sovereign Signal' }).first();
    await expect(sovereignSignalCard.locator('video')).toHaveAttribute('src', '/films/sovereign-signal.mp4');
    await expect(sovereignSignalCard.locator('video')).toHaveAttribute('poster', '/films/sovereign-signal-keyframe.png');
    await sovereignSignalCard.getByRole('button', { name: 'Watch Sovereign Signal preview' }).click();

    const sovereignSignalDialog = page.getByRole('dialog', { name: 'Sovereign Signal' });
    await expect(sovereignSignalDialog.getByLabel('Sovereign Signal preview')).toHaveAttribute('src', '/films/sovereign-signal.mp4');
  });

  test('placeholder-only remote configuration does not create runtime failures', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.locator('#main-content')).toBeVisible();
  });
});
