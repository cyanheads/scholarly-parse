/**
 * @fileoverview DOIs as the model holds them: a field's value without its resolver or
 * `doi:` prefix (`normalizeDoi`), and the first DOI a label introduces in running text
 * (`labeledDoiInText`), each read in time linear in its input.
 * @module tests/model/doi.test
 */
import { describe, expect, it } from 'vitest';
import { labeledDoiInText, normalizeDoi } from '../../src/model/doi.js';
import { expectLinear } from '../linear.js';

describe('normalizeDoi', () => {
  it('takes off a resolver or doi: prefix in any case, and lowercases the DOI (#38)', () => {
    expect(normalizeDoi('https://doi.org/10.1234/AbC')).toBe('10.1234/abc');
    expect(normalizeDoi('http://dx.doi.org/10.1234/AbC')).toBe('10.1234/abc');
    expect(normalizeDoi('HTTPS://DOI.ORG/10.1234/AbC')).toBe('10.1234/abc');
    expect(normalizeDoi('doi:10.1234/AbC')).toBe('10.1234/abc');
    expect(normalizeDoi(' DOI: 10.1234/AbC ')).toBe('10.1234/abc');
    expect(normalizeDoi('10.1234/AbC')).toBe('10.1234/abc');
  });

  it('leaves out the marks closing a DOI, keeping balanced suffix brackets (#38)', () => {
    expect(normalizeDoi('https://doi.org/10.1234/x.')).toBe('10.1234/x');
    expect(normalizeDoi('10.1234/A.b.;,')).toBe('10.1234/a.b');
    expect(normalizeDoi('https://doi.org/10.1234/A.b.;,')).toBe('10.1234/a.b');
    expect(normalizeDoi('10.1234/abc).')).toBe('10.1234/abc');
    expect(normalizeDoi('10.1002/(SICI)1097-4636(199907)')).toBe('10.1002/(sici)1097-4636(199907)');
  });

  it('reads nothing from a value that is not a DOI (#38)', () => {
    for (const value of [
      undefined,
      '',
      'n/a',
      '10.',
      '10.1234',
      '10.1234/',
      '10.1/x',
      'x 10.1234/y',
    ]) {
      expect(normalizeDoi(value)).toBeUndefined();
    }
  });

  it('reads a long run of closing marks in linear time', async () => {
    await expectLinear((n) => `10.1234/a${'.'.repeat(n)}b`, normalizeDoi, {
      from: 2_000,
      to: 512_000,
    });
    await expectLinear((n) => `doi:${' '.repeat(n)}10.1234/a${')'.repeat(n)}`, normalizeDoi, {
      from: 20_000,
      to: 80_000,
    });
  });
});

describe('labeledDoiInText', () => {
  it.each([
    'doi: 10.1234/abc',
    'doi: "10.1234/abc"',
    'doi:"10.1234/abc"',
    "doi: '10.1234/abc'",
    'See doi: "10.1234/abc". More',
    'DOI 10.1234/abc',
    'doi: “10.1234/abc”',
    'https://doi.org/10.1234/abc.',
    'https://dx.doi.org/10.1234/abc',
  ])('reads the DOI a label introduces in %j (#23)', (text) => {
    expect(labeledDoiInText(text)).toBe('10.1234/abc');
  });

  it.each([
    'Cite 10.1234/abc here',
    'DOIs 10.1234/abc',
    'pseudoi 10.1234/abc',
    'doi: 10.1234/abc"',
  ])('reads no DOI from %j (#23)', (text) => {
    expect(labeledDoiInText(text)).toBeUndefined();
  });

  it('passes over an unlabeled DOI to the labeled one after it (#23)', () => {
    expect(labeledDoiInText('Cite 10.1111/first, then DOI: 10.2222/second.')).toBe(
      '10.2222/second',
    );
  });

  it('keeps the case of the DOI, as doiInText does', () => {
    expect(labeledDoiInText('doi:10.1234/AbC')).toBe('10.1234/AbC');
  });

  it.each([
    ['labeled, quoted runs cut short', 'doi: "10.1234/a< '],
    ['unlabeled runs', '10.1234/a '],
    ['runs closed by an unopened quote', 'doi: 10.1234/a" '],
    ['labels with no run', 'doi: "x '],
  ])('reads a text of many %s in linear time (#23)', async (_, run) => {
    await expectLinear((n) => run.repeat(n), labeledDoiInText, { from: 2_500, to: 40_000 });
  });
});
