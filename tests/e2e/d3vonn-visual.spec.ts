import { expect, test } from '@playwright/test';

test.describe('D3VONN.IO visual operating system', () => {
  test('homepage renders the metallic command landing on desktop', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /Welcome to D3VONN/i })).toBeVisible();
    await expect(page.getByText(/The World’s First AI Business Operating System/i)).toBeVisible();
    await expect(page.getByText(/Hermes Routing/i)).toBeVisible();
    await expect(page.getByText(/DKOS Memory/i)).toBeVisible();
    await expect(page.getByText(/AI WORKFORCE. LIMITLESS POTENTIAL./i)).toBeVisible();
  });

  test('homepage keeps the command layer usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /Welcome to D3VONN/i })).toBeVisible();
    await expect(page.getByText(/Launch D3VONN/i)).toBeVisible();
    await expect(page.getByText(/Explore Platform/i)).toBeVisible();
  });
});
