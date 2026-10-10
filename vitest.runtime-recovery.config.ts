import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['services/runtime-recovery/**/*.test.ts'],
    environment: 'node',
  },
});
