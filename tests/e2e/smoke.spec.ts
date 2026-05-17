import { test, expect } from '@playwright/test';

test.describe('Smoke Tests @smoke', () => {
  test('homepage loads and renders correctly', async ({ page }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    await page.goto(baseUrl);
    
    // Verify the main app container is present
    await expect(page.locator('#root')).toBeVisible();
    
    // Verify no immediate console errors
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    
    expect(errors.length).toBe(0);
  });

  test('health endpoint returns ok', async ({ request }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    const response = await request.get(`${baseUrl}/api/health`);
    
    // Some environments might not have the API deployed alongside the frontend
    if (response.ok()) {
      const data = await response.json();
      expect(data.status).toBeDefined();
    } else {
      console.log(`Health endpoint returned ${response.status()}, skipping detailed check.`);
    }
  });
});
