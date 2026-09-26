/**
 * @fileoverview Vitest configuration. Unit tests mirror `src/`; the corpus suite
 * (`tests/corpus/`) runs every fixture under `corpus/` through its parser.
 * @module vitest.config
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
