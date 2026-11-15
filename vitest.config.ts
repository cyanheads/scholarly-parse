/**
 * @fileoverview Vitest configuration. Unit tests mirror `src/`; the corpus suite
 * (`tests/corpus/`) runs every fixture under `corpus/` through its parser. The setup
 * file checks the runtime a `devcheck` lane asked for.
 * @module vitest.config
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/runtime.ts'],
    testTimeout: 30_000,
  },
});
