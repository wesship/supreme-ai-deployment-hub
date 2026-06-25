import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration — D3VONN.IO
 *
 * Replaces the stub `test:e2e` script ("echo No E2E tests && exit 0").
 * Tests live in tests/e2e/ and run against the local Vite dev server.
 *
 * Usage:
 *   npm run test:e2e              # headless, all browsers
 *   npm run test:e2e:ui           # interactive UI mode
 *   npm run test:e2e:debug        # headed debug mode
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.{spec,test}.ts',

  // Run tests in parallel across workers
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests once on CI to reduce flakiness noise
  retries: process.env.CI ? 1 : 0,

  // Use 1 worker on CI to avoid resource contention; unlimited locally
  workers: process.env.CI ? 1 : undefined,

  outputDir: 'test-results/artifacts',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Reasonable timeouts
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  // In CI: serve the pre-built dist/ with `npm run preview` (fast, no HMR overhead).
  // Locally: use the Vite dev server for hot reloading.
  webServer: {
    command: process.env.CI ? 'npm run preview -- --port 5173' : 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
