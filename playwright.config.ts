import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4173);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const requestedBrowser = process.env.BROWSER?.toLowerCase();

const projects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'mobile-chrome',
    use: { ...devices['Pixel 7'] },
  },
];

const selectedProjects = requestedBrowser
  ? projects.filter(({ name }) => {
      if (requestedBrowser === 'chrome') return name === 'chromium';
      return name === requestedBrowser;
    })
  : projects;

if (requestedBrowser && selectedProjects.length === 0) {
  throw new Error(`Unsupported Playwright browser: ${requestedBrowser}`);
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
      command: `pnpm build && pnpm preview --host 127.0.0.1 --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: selectedProjects,
});
