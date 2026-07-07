import { expect, test } from '@playwright/test';

test.describe('D3VONN landing page', () => {
  test('renders command-center homepage on desktop', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Welcome to D3VONN.IO/i })).toBeVisible();
    await expect(page.getByText(/Hermes Routing/i)).toBeVisible();
    await expect(page.getByText(/DKOS Memory/i)).toBeVisible();
    await expect(page.getByText(/Agent Workforce/i)).toBeVisible();
  });

  test('renders command-center homepage on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Welcome to D3VONN.IO/i })).toBeVisible();
    await expect(page.getByText(/Launch D3VONN/i)).toBeVisible();
  });
});
