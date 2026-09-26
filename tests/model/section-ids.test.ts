/**
 * @fileoverview Section IDs: the source's own ID when unused, else a numeric suffix, in
 * time proportional to the IDs issued even when a document repeats one throughout.
 * @module tests/model/section-ids.test
 */
import { describe, expect, it } from 'vitest';
import { issueId } from '../../src/model/section-ids.js';

describe('issueId', () => {
  it('keeps an unused source ID, else suffixes it, else uses the fallback', () => {
    const issued = new Set<string>();
    expect(issueId(issued, 'sec1', 's1')).toBe('sec1');
    expect(issueId(issued, 'sec1', 's2')).toBe('sec1-2');
    expect(issueId(issued, undefined, 's3')).toBe('s3');
    expect(issueId(issued, 'sec1-3', 's4')).toBe('sec1-3');
    expect(issueId(issued, 'sec1', 's5')).toBe('sec1-4');
  });

  it('issues a repeated ID thousands of times without searching from the start each time', () => {
    const issued = new Set<string>();
    const started = performance.now();
    for (let i = 0; i < 20_000; i++) issueId(issued, 'dup', `s${i}`);
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(issued.size).toBe(20_000);
    expect(issued.has('dup-20000')).toBe(true);
  });
});
