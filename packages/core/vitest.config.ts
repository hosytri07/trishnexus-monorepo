import { defineConfig } from 'vitest/config';

/**
 * Vitest config cho @trishteam/core.
 * Test file pattern: src/**\/__tests__/*.test.ts
 *
 * Phase 14.1 (2026-04-23). Phase 21 prep: thêm coverage threshold + JSON reporter.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/index.ts'],
      // Phase 21 prep — baseline thresholds (current 55 test pass theo CHANGELOG Phase 14.1).
      // Set conservative để không fail build hiện tại; nâng dần khi viết thêm test.
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 60,
        statements: 50,
      },
    },
  },
});
