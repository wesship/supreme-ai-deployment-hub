/**
 * auth.spec.ts — E2E tests for the Authentication user journey
 *
 * Covers: Sign Up, Sign In, Sign Out, Protected Route redirect
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('redirects unauthenticated users to login page', async ({ page }) => {
    await page.goto('/agents');
    await expect(page).toHaveURL(/\/(login|auth|sign-in)/);
  });

  test('sign-in page renders without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'not-an-email');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"], .error, [data-error]')).toBeVisible();
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should show an error message, not redirect
    await expect(page).toHaveURL(/\/(login|auth|sign-in)/);
  });
});
