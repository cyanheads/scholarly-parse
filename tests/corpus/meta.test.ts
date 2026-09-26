/**
 * @fileoverview Every corpus fixture is well-formed: a source file, a valid
 * `meta.json` with an open license, and an ID that matches its directory and format.
 * @module tests/corpus/meta.test
 */
import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fixtureMetaSchema, listFixtures } from './fixtures.js';

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

describe.each(listFixtures())('corpus/$format/$name', (fixture) => {
  it('has a valid meta.json', () => {
    const result = fixtureMetaSchema.safeParse(fixture.meta);
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.data?.id).toBe(fixture.name);
    expect(result.data?.format).toBe(fixture.format);
  });

  it('has a source file of reviewable size', () => {
    expect(existsSync(fixture.sourcePath)).toBe(true);
    expect(statSync(fixture.sourcePath).size).toBeGreaterThan(0);
    expect(statSync(fixture.sourcePath).size).toBeLessThanOrEqual(MAX_SOURCE_BYTES);
  });
});
