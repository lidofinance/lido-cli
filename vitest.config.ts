/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 300000, // 5 minutes for integration tests with Anvil
    hookTimeout: 60000, // 1 minute for setup/teardown hooks
    globals: true,
    environment: 'node',
    include: ['**/*.test.{js,ts}'],
    exclude: ['node_modules/**', 'dist/**'],
    // Keep tests sequential since they share the same Anvil instance
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially in single fork
      },
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@command': new URL('./command', import.meta.url).pathname,
      '@consensus': new URL('./consensus', import.meta.url).pathname,
      '@configs': new URL('./configs', import.meta.url).pathname,
      '@contracts': new URL('./contracts', import.meta.url).pathname,
      '@providers': new URL('./providers', import.meta.url).pathname,
      '@scripts': new URL('./scripts', import.meta.url).pathname,
      '@utils': new URL('./utils', import.meta.url).pathname,
      abi: new URL('./abi', import.meta.url).pathname,
    },
  },
});
