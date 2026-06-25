// stryker.config.js — D3VONN.IO Mutation Testing Configuration
// Used by the mutation-tests.yml GitHub Actions workflow.
// Run locally: npx stryker run

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
module.exports = {
  // Use the Vitest test runner (matches the project's test setup)
  testRunner: 'vitest',

  // Mutate only production source files — exclude tests, types, and generated code
  mutate: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/**/*.spec.ts',
    '!src/**/*.spec.tsx',
    '!src/**/*.d.ts',
    '!src/integrations/**',
    '!src/components/ui/**',  // shadcn/ui generated components
  ],

  // TypeScript support
  plugins: [
    '@stryker-mutator/vitest-runner',
    '@stryker-mutator/typescript-checker',
  ],

  checkers: ['typescript'],

  tsconfigFile: 'tsconfig.app.json',

  // Reporting
  reporters: ['html', 'clear-text', 'progress', 'json'],
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation-report.json',
  },

  // Thresholds — fail if mutation score drops below these values
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },

  // Concurrency — use half available CPUs to avoid OOM in CI
  concurrency: 2,

  // Timeout multiplier — give mutants extra time to avoid false positives
  timeoutMS: 10000,
  timeoutFactor: 1.5,

  // Incremental mode — only re-test mutants affected by changed files
  incremental: true,
  incrementalFile: 'reports/mutation/.stryker-incremental.json',

  // Ignore static mutants (string literals, comments) for speed
  ignorers: ['@stryker-ignore'],

  // Vitest runner config
  vitest: {
    configFile: 'vitest.config.ts',
  },
};
