import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['shared/services/runtime-recovery/**/*.test.ts'],
    environment: 'node',
  },
});
