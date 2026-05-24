/**
 * Vitest config for staging smoke tests.
 * Uses node environment (no jsdom) so the mock HTTP server works correctly.
 */
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/contract/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
