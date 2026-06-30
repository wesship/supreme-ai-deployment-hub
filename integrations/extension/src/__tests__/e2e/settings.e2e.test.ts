
import { test, expect } from '@playwright/test';

// E2E tests for the settings screen
test.describe('Settings Screen E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Load the settings page
    await page.goto('chrome-extension://[extensionId]/settings.html');
    
    // Note: when running these tests for real, you'll need to:
    // 1. Load the extension in developer mode
    // 2. Get the extension ID and use it in the URLs
    // 3. Use something like Puppeteer's extensions capabilities
    // For demo purposes, we'll assume it loads
  });

  test('should load settings page correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/DEVONN Settings/i);
    await expect(page.locator('#api-url')).toBeVisible();
    await expect(page.locator('#user-id')).toBeVisible();
    await expect(page.locator('#test-connection')).toBeVisible();
    await expect(page.locator('#save-settings')).toBeVisible();
  });

  test('should validate API URL', async ({ page }) => {
    // Clear and enter invalid URL
    await page.locator('#api-url').clear();
    await page.locator('#api-url').fill('invalid-url');
    
    // Try to save
    await page.locator('#save-settings').click();
    
    // Check error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('valid URL');
  });

  test('should validate email format', async ({ page }) => {
    // Set valid URL first
    await page.locator('#api-url').clear();
    await page.locator('#api-url').fill('https://api.d3vonn.io');
    
    // Set invalid email
    await page.locator('#user-id').clear();
    await page.locator('#user-id').fill('invalid@email');
    
    // Try to save
    await page.locator('#save-settings').click();
    
    // Check error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('valid email');
  });

  test('should save valid settings', async ({ page }) => {
    // Set valid values
    await page.locator('#api-url').clear();
    await page.locator('#api-url').fill('https://api.d3vonn.io');
    await page.locator('#user-id').clear();
    await page.locator('#user-id').fill('user@example.com');
    
    // Make choices for checkboxes
    await page.locator('#notify-task-complete').check();
    await page.locator('#notify-errors').check();
    
    // Save settings
    await page.locator('#save-settings').click();
    
    // Check success message
    await expect(page.locator('.success-message')).toBeVisible();
    await expect(page.locator('.success-message')).toContainText('saved successfully');
  });

  // More tests would go here
});
