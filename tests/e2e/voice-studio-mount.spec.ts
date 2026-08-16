import { expect, test } from '@playwright/test';

test('Voice Studio remains mounted after deferred providers initialize', async ({ page }) => {
  const pageErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  const response = await page.goto('/voice-studio', { waitUntil: 'domcontentloaded' });
  expect(response, 'Voice Studio did not return a document response').not.toBeNull();
  expect(response?.status(), 'Voice Studio returned an error status').toBeLessThan(400);

  const root = page.locator('#root');
  await expect(root).toBeAttached({ timeout: 15_000 });

  // DeferredProviders switches the application tree after requestIdleCallback.
  // Wait beyond that transition so this test catches post-mount failures rather
  // than only proving that the initial HTML and JavaScript assets were served.
  await page.waitForTimeout(1_500);

  await expect(root, 'React root became empty after deferred initialization').not.toBeEmpty();
  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.locator('[data-d3vonn-boot="failed"]')).toHaveCount(0);
  await expect(page, 'Signed-out Voice Studio must not be hijacked by ChatPage auth').toHaveURL(/\/voice-studio\/?$/);
  await expect(page.getByRole('heading', { name: /Conversation/i })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Authenticated text workspace' })).toBeVisible();
  expect(pageErrors, `Unhandled browser errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
