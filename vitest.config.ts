import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Guards against rare intermittent supertest/socket failures under parallel runs.
    retry: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
});
