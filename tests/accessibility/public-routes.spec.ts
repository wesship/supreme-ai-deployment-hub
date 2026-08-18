import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'https://www.d3vonn.io';
const publicRoutes = ['/', '/solutions', '/pricing', '/security', '/security/disclosure', '/resources', '/ai-agents', '/business-automation', '/marketplace', '/film', '/documentation', '/about', '/contact', '/enterprise-readiness', '/terms', '/privacy'];

for (const route of publicRoutes) {
  test(`WCAG 2.2 AA checks: ${route}`, async ({ page }) => {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
