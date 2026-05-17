import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

/**
 * vitest.config.ts — Replaces the missing vitest config.
 *
 * The repo currently uses jest.config.js for unit tests, but the package.json
 * test script references vitest. This config unifies them under vitest, which
 * is the correct choice for a Vite-based project (no transform overhead).
 *
 * Coverage thresholds enforce a minimum quality gate:
 *   - 70% lines/functions/branches/statements to start
 *   - Raise these incrementally as you add tests
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],

    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}',
    ],

    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/e2e/**',                          // Playwright handles E2E separately
      'src/extension/__tests__/e2e/**',        // Extension E2E tests run via Playwright
      'src/extension/__tests__/setupExtensionTests.ts', // setup helper, not a test suite
      'src/extension/__tests__/storage.mock.ts',        // mock helper, not a test suite
      'src/hooks/__tests__/**/testUtils.ts',            // test utility, not a test suite
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/__tests__/**',
        'src/**/*.stories.{ts,tsx}',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },

    // Report slow tests (> 1s) to identify performance issues
    slowTestThreshold: 1000,
  },
});
