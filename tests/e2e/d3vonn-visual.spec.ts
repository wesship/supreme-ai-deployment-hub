import { expect, test } from '@playwright/test';

test.describe('D3VONN.IO visual operating system', () => {
  test('homepage renders the command layer on desktop', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /Command the Signal/i })).toBeVisible();
    await expect(page.getByText(/Hermes Routing/i)).toBeVisible();
    await expect(page.getByText(/DKOS Memory/i)).toBeVisible();
    await expect(page.getByText(/Agent Workforce/i).first()).toBeVisible();
  });

  test('homepage keeps the command layer usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /Command the Signal/i })).toBeVisible();
    await expect(page.getByText(/Enter Command Layer/i)).toBeVisible();
    await expect(page.getByText(/View Intelligence Stack/i)).toBeVisible();
  });
});
