import { defineConfig } from 'vitest/config';

/**
 * Vitest config cho @trishteam/core.
 * Test file pattern: src/**\/__tests__/*.test.ts
 *
 * Phase 14.1 (2026-04-23).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/index.ts'],
    },
  },
});
