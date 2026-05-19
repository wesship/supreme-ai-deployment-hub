import { test as base, expect, Page } from '@playwright/test';

/**
 * Devonn.AI — Playwright Test Fixtures
 *
 * Provides typed page object models and shared helpers for all E2E tests.
 * Import from this file instead of directly from @playwright/test:
 *
 *   import { test, expect } from './fixtures';
 */

// ---------------------------------------------------------------------------
// Page Object Models
// ---------------------------------------------------------------------------

class HomePage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async expectNoConsoleErrors(errors: string[]) {
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  }

  async expectNavigation() {
    // Check that a nav element exists
    await expect(this.page.locator('nav, [role="navigation"]').first()).toBeVisible({ timeout: 10_000 });
  }

  async expectHeroSection() {
    // Check that the main content area renders
    await expect(this.page.locator('main, [role="main"], #root').first()).toBeVisible({ timeout: 10_000 });
  }

  async expectTitle(pattern: RegExp) {
    await expect(this.page).toHaveTitle(pattern, { timeout: 10_000 });
  }
}

// ---------------------------------------------------------------------------
// Custom fixture types
// ---------------------------------------------------------------------------

type CustomFixtures = {
  homePage: HomePage;
  consoleErrors: string[];
};

// ---------------------------------------------------------------------------
// Extended test with fixtures
// ---------------------------------------------------------------------------

export const test = base.extend<CustomFixtures>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await use(errors);
  },

  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await use(homePage);
  },
});

export { expect };
