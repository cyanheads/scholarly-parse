/**
 * @fileoverview Section IDs: the source's own ID when unused, else a numeric suffix, in
 * time proportional to the IDs issued even when a document repeats one throughout. IDs
 * `toSections` generates are never issued to a section.
 * @module tests/model/section-ids.test
 */
import { describe, expect, it } from 'vitest';
import {
  abstractId,
  FLOATS_ID,
  FOOTNOTES_ID,
  issueId,
  REFERENCES_ID,
  RESERVED_SECTION_ID,
} from '../../src/model/section-ids.js';

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

  it('suffixes a source ID that toSections generates for an entry', () => {
    const issued = new Set<string>();
    expect(issueId(issued, 'abstract-1', 's1')).toBe('abstract-1-2');
    expect(issueId(issued, 'abstract-12', 's2')).toBe('abstract-12-2');
    expect(issueId(issued, 'floats', 's3')).toBe('floats-2');
    expect(issueId(issued, 'footnotes', 's4')).toBe('footnotes-2');
    expect(issueId(issued, 'references', 's5')).toBe('references-2');
    expect(issueId(issued, undefined, 'abstract-1')).toBe('abstract-1-3');
    expect(issueId(issued, undefined, 'abstract-2-1')).toBe('abstract-2-1');
    expect(issueId(issued, 'abstract-1-1', 's6')).toBe('abstract-1-1');
  });

  it('gives a repeated source ID abstract IDs outside the reserved family, without looping', () => {
    const issued = new Set<string>();
    const ids = Array.from({ length: 1_000 }, (_, i) => issueId(issued, 'abstract', `s${i}`));
    expect(ids.slice(0, 3)).toEqual(['abstract', 'abstract-2-2', 'abstract-3-2']);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => RESERVED_SECTION_ID.test(id))).toEqual([]);
  });

  it('reserves exactly the IDs toSections generates', () => {
    for (const id of [abstractId(0), abstractId(41), FLOATS_ID, FOOTNOTES_ID, REFERENCES_ID])
      expect(RESERVED_SECTION_ID.test(id), id).toBe(true);
    for (const id of ['abstract', 'abstract-1-1', 'abstract-x', 'floats-2', 'sec-references'])
      expect(RESERVED_SECTION_ID.test(id), id).toBe(false);
  });
});
