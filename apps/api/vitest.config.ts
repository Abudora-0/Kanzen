import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    hookTimeout: 600_000,
    testTimeout: 45_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
