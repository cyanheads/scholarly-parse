/**
 * @fileoverview Vitest setup file. `scripts/devcheck.ts` runs the suite once on Bun and
 * once on Node, naming each lane's runtime in `SCHOLARLY_PARSE_TEST_RUNTIME`; a test file
 * that loads on the other runtime fails here, so a lane can't pass twice on one runtime.
 * Unset (`bun run test`), the suite runs wherever it lands.
 * @module tests/runtime
 */
const expected = process.env.SCHOLARLY_PARSE_TEST_RUNTIME;

if (expected !== undefined) {
  if (expected !== 'bun' && expected !== 'node') {
    throw new Error(`SCHOLARLY_PARSE_TEST_RUNTIME is "${expected}"; expected "bun" or "node"`);
  }
  const actual = 'bun' in process.versions ? 'bun' : 'node';
  if (actual !== expected) {
    throw new Error(
      `This lane runs the tests on ${expected}, but they loaded on ${actual} (${process.execPath})`,
    );
  }
}
