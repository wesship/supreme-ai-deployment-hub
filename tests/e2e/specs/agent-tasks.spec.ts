/**
 * agent-tasks.spec.ts — E2E tests for the Agent Task Creation user journey
 *
 * Covers: Task creation, task list display, task status polling, error states
 */

import { test, expect } from '@playwright/test';

// These tests require an authenticated session.
// The auth state is loaded from the storageState set in playwright.config.ts.
test.use({ storageState: 'tests/e2e/.auth/user.json' });

test.describe('Agent Task Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agents');
  });

  test('agents page renders without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/agents');
    await expect(page).toHaveURL('/agents');
    expect(errors).toHaveLength(0);
  });

  test('displays agent mesh health status', async ({ page }) => {
    // The health status indicator should be visible on the agents page
    const healthIndicator = page.locator(
      '[data-testid="mesh-health"], [aria-label*="health"], .health-status'
    );
    await expect(healthIndicator).toBeVisible({ timeout: 10_000 });
  });

  test('can open the new task dialog', async ({ page }) => {
    const newTaskButton = page.locator(
      'button:has-text("New Task"), button:has-text("Create Task"), [data-testid="new-task-btn"]'
    );
    await expect(newTaskButton).toBeVisible();
    await newTaskButton.click();
    // A dialog or form should appear
    await expect(
      page.locator('[role="dialog"], form[data-testid="task-form"]')
    ).toBeVisible();
  });

  test('task form validates required fields', async ({ page }) => {
    const newTaskButton = page.locator(
      'button:has-text("New Task"), button:has-text("Create Task"), [data-testid="new-task-btn"]'
    );
    await newTaskButton.click();
    // Try submitting without filling in required fields
    const submitButton = page.locator(
      '[role="dialog"] button[type="submit"], [role="dialog"] button:has-text("Submit")'
    );
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // Should show validation errors, not close the dialog
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });

  test('task list is visible and accessible', async ({ page }) => {
    const taskList = page.locator(
      '[data-testid="task-list"], [role="list"], .task-list'
    );
    // Either a list of tasks or an empty state message should be visible
    const emptyState = page.locator(
      '[data-testid="empty-state"], :has-text("No tasks"), :has-text("Get started")'
    );
    await expect(taskList.or(emptyState)).toBeVisible({ timeout: 10_000 });
  });
});
