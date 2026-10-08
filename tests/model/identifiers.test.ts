/**
 * @fileoverview PMC IDs, PMIDs, and ORCID iDs as the model holds them: a field's value
 * without its label or its PMC, PubMed, or orcid.org link, in canonical form, and nothing
 * from a value that is not one (#59).
 * @module tests/model/identifiers.test
 */
import { describe, expect, it } from 'vitest';
import { normalizeOrcid, normalizePmcid, normalizePmid } from '../../src/model/identifiers.js';
import { expectLinear } from '../linear.js';

describe('normalizePmcid', () => {
  it.each([
    ['PMC999', 'PMC999'],
    ['999', 'PMC999'],
    ['pmc999', 'PMC999'],
    [' PMC999 ', 'PMC999'],
    ['PMCID: PMC123456', 'PMC123456'],
    ['pmcid:pmc123456', 'PMC123456'],
    ['https://www.ncbi.nlm.nih.gov/pmc/articles/PMC123456/', 'PMC123456'],
    ['http://ncbi.nlm.nih.gov/pmc/articles/PMC123456', 'PMC123456'],
    ['https://pmc.ncbi.nlm.nih.gov/articles/PMC123456/', 'PMC123456'],
    ['https://pmc.ncbi.nlm.nih.gov/articles/pmc123456/#sec1', 'PMC123456'],
    ['PMC123456.1', 'PMC123456'],
    ['PMCID: PMC123456.2', 'PMC123456'],
  ])('reads %j as %j', (value, pmcid) => {
    expect(normalizePmcid(value)).toBe(pmcid);
  });

  it.each([
    undefined,
    '',
    'PMC',
    'pending',
    'n/a',
    'PMC12a',
    'PMC 123',
    'PMC123.',
    'PMC123.1.2',
    'https://example.org/pmc/articles/PMC123456/',
    'https://www.ncbi.nlm.nih.gov/pubmed/123456',
  ])('reads nothing from %j', (value) => {
    expect(normalizePmcid(value)).toBeUndefined();
  });
});

describe('normalizePmid', () => {
  it.each([
    ['21491125', '21491125'],
    [' 21491125 ', '21491125'],
    ['PMID: 21491125', '21491125'],
    ['pmid:21491125', '21491125'],
    ['PMID 21491125', '21491125'],
    ['https://pubmed.ncbi.nlm.nih.gov/21491125/', '21491125'],
    ['https://www.ncbi.nlm.nih.gov/pubmed/21491125', '21491125'],
    ['http://www.ncbi.nlm.nih.gov/pubmed/21491125?dopt=Abstract', '21491125'],
  ])('reads %j as %j', (value, pmid) => {
    expect(normalizePmid(value)).toBe(pmid);
  });

  it.each([
    undefined,
    '',
    'n/a',
    '2149A125',
    'PMC21491125',
    '"Carrami EM"[Author]',
    'https://pubmed.ncbi.nlm.nih.gov/?term=Carrami',
    'https://example.org/pubmed/21491125',
  ])('reads nothing from %j', (value) => {
    expect(normalizePmid(value)).toBeUndefined();
  });
});

describe('normalizeOrcid', () => {
  it.each([
    ['0000-0002-1694-233X', '0000-0002-1694-233X'],
    ['0000-0002-1694-233x', '0000-0002-1694-233X'],
    ['0000-0002-1825-0097', '0000-0002-1825-0097'],
    ['https://orcid.org/0000-0002-1694-233X', '0000-0002-1694-233X'],
    ['http://orcid.org/0000-0002-1694-233x/', '0000-0002-1694-233X'],
    ['orcid.org/0000-0002-1825-0097', '0000-0002-1825-0097'],
    ['ORCID: 0000-0002-1825-0097', '0000-0002-1825-0097'],
    ['ORCID: https://orcid.org/0000-0002-1825-0097', '0000-0002-1825-0097'],
  ])('reads %j as %j', (value, orcid) => {
    expect(normalizeOrcid(value)).toBe(orcid);
  });

  it.each([
    undefined,
    '',
    '0000-0002-1694-233',
    '0000-0002-1694-233XX',
    '0000000216942330',
    '0000-0002-1694-23Y3',
    'https://example.org/0000-0002-1825-0097',
  ])('reads nothing from %j', (value) => {
    expect(normalizeOrcid(value)).toBeUndefined();
  });

  it.each([
    ['normalizePmcid', normalizePmcid, 'https://www.ncbi.nlm.nih.gov/pmc/articles/', '1'],
    ['normalizePmid', normalizePmid, 'PMID: ', '1'],
    ['normalizeOrcid', normalizeOrcid, 'https://orcid.org/', '0'],
  ] as const)('%s reads a long value in linear time', async (_, normalize, lead, run) => {
    await expectLinear((n) => `${lead}${run.repeat(n)}x`, normalize, {
      from: 4_000,
      to: 1_024_000,
    });
  });
});
