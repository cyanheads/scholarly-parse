/**
 * @fileoverview arXiv IDs as the model holds them: an exact ID, the ID an arxiv.org link
 * names, and the first ID in running text, each in arXiv's preferred external form with
 * its printed version kept, read in time linear in its input (#65).
 * @module tests/model/arxiv.test
 */
import { describe, expect, it } from 'vitest';
import {
  arxivFromPageUrl,
  arxivFromUrl,
  arxivId,
  arxivInText,
  normalizeArxiv,
} from '../../src/model/arxiv.js';
import { expectLinear } from '../linear.js';

describe('arxivId', () => {
  it.each([
    ['0704.0001', '0704.0001'],
    ['1412.9999v12', '1412.9999v12'],
    ['1501.00001', '1501.00001'],
    ['2105.00001v2', '2105.00001v2'],
    ['hep-th/9711200', 'hep-th/9711200'],
    ['math.GT/0309136', 'math/0309136'],
    ['math.GT/0309136v1', 'math/0309136v1'],
    ['cond-mat/0501001v2', 'cond-mat/0501001v2'],
    ['acc-phys/9107001', 'acc-phys/9107001'],
    ['quant-ph/0703999', 'quant-ph/0703999'],
  ])('reads %j as %j', (value, id) => {
    expect(arxivId(value)).toBe(id);
  });

  it.each([
    '',
    '0703.0001',
    '1412.00001',
    '1501.0001',
    '2113.00001',
    '2105.000012',
    'and/1234567',
    'foo-bar/9901001',
    'stat/0501001',
    'hep-th/9106001',
    'hep-th/0704001',
    'hep-th/0805123',
    'hep-th/9713001',
    'hep-th/971120',
    'HEP-TH/9711200',
    'math.GT.XX/0309136',
    '2105.00001v0',
    '2105.00001v01',
    'hep-th/9711200v0',
  ])('reads nothing from %j', (value) => {
    expect(arxivId(value)).toBeUndefined();
  });
});

describe('arxivFromUrl', () => {
  it.each([
    ['https://arxiv.org/abs/2105.00001', '2105.00001'],
    ['https://arxiv.org/abs/2105.00001v3', '2105.00001v3'],
    ['https://arxiv.org/pdf/2105.00001', '2105.00001'],
    ['https://arxiv.org/pdf/2105.00001v1.pdf', '2105.00001v1'],
    ['http://arxiv.org/abs/hep-th/9711200', 'hep-th/9711200'],
    ['https://export.arxiv.org/abs/math.GT/0309136/', 'math/0309136'],
    ['https://www.arxiv.org/abs/2105.00001?context=cs', '2105.00001'],
    ['https://ar5iv.org/abs/1906.00591', '1906.00591'],
    ['//arxiv.org/abs/2105.00001#S1', '2105.00001'],
  ])('reads %j as %j', (url, id) => {
    expect(arxivFromUrl(url)).toBe(id);
  });

  it.each([
    undefined,
    '',
    'https://arxiv.org/html/2407.01449v6',
    'https://arxiv.org/html/2407.01449v6#S2',
    'https://example.org/abs/2105.00001',
    'https://arxiv.org.example.org/abs/2105.00001',
    'https://notarxiv.org/abs/2105.00001',
    'https://arxiv.org/list/hep-th/9711',
    'https://arxiv.org/abs/2105.00001/extra',
    'https://scholar.example.org/?q=https://arxiv.org/abs/2105.00001',
    'https://arxiv.org/abs/2105.00001v0',
  ])('reads nothing from %j', (url) => {
    expect(arxivFromUrl(url)).toBeUndefined();
  });
});

describe('arxivFromPageUrl', () => {
  it.each([
    ['https://arxiv.org/html/2407.01449v6', '2407.01449v6'],
    ['https://arxiv.org/html/2407.01449v6/', '2407.01449v6'],
    ['https://arxiv.org/abs/2407.01449v6', '2407.01449v6'],
    ['https://ar5iv.labs.arxiv.org/html/math.GT/0309136', 'math/0309136'],
    ['https://ar5iv.labs.arxiv.org/html/hep-th/9711200', 'hep-th/9711200'],
    ['https://ar5iv.org/html/1906.00591', '1906.00591'],
  ])('reads %j as %j', (url, id) => {
    expect(arxivFromPageUrl(url)).toBe(id);
  });

  it.each([
    undefined,
    'https://arxiv.org/pdf/2407.01449v6',
    'https://example.org/html/2407.01449v6',
    'https://ar5iv.labs.arxiv.org/html/foo-bar/9901001',
  ])('reads nothing from %j', (url) => {
    expect(arxivFromPageUrl(url)).toBeUndefined();
  });
});

describe('normalizeArxiv', () => {
  it.each([
    ['2305.05320', '2305.05320'],
    ['  2105.00001v2  ', '2105.00001v2'],
    ['arXiv:2401.12345v2', '2401.12345v2'],
    ['ARXIV: 2105.00001', '2105.00001'],
    ['arXiv 2105.00001', '2105.00001'],
    ['math.GT/0309136', 'math/0309136'],
    ['arXiv:math.GT/0309136v1 [math.GT]', 'math/0309136v1'],
    ['arXiv:1906.00591v1[cs.CL]', '1906.00591v1'],
    ['arXiv:1706.03762 [cs.CL]', '1706.03762'],
    ['https://arxiv.org/abs/2105.00001v3', '2105.00001v3'],
    ['http://arxiv.org/pdf/hep-th/9711200', 'hep-th/9711200'],
    ['arXiv: https://arxiv.org/abs/2105.00001', '2105.00001'],
  ])('reads %j as %j', (value, id) => {
    expect(normalizeArxiv(value)).toBe(id);
  });

  it.each([
    undefined,
    '',
    'arXiv:',
    'pending',
    'n/a',
    'hep-th/0805123',
    'foo-bar/9901001',
    '2105.00001v0',
    '2105.00001 extra',
    '2105.00001 [cs.CL] extra',
    'arXiv:2105.00001 [cs.CL',
    'https://example.org/abs/2105.00001',
    'https://arxiv.org/html/2105.00001',
  ])('reads nothing from %j', (value) => {
    expect(normalizeArxiv(value)).toBeUndefined();
  });

  it.each([
    ['spaces after a label', (n: number) => `arXiv${' '.repeat(n)}x`],
    ['unclosed brackets after a label', (n: number) => `arXiv:${'['.repeat(n)}`],
    ['spaces before an unclosed class', (n: number) => `2105.00001${' '.repeat(n)}[cs.CL`],
    ['a long ID-like body', (n: number) => `arXiv:${'1'.repeat(n)} [cs.CL]`],
  ])('reads a value in time linear in %s', async (_, value) => {
    await expectLinear(value, normalizeArxiv, { from: 4_000, to: 1_024_000 });
  });
});

describe('arxivInText', () => {
  it.each([
    ['A. Author. Old paper. arXiv:hep-th/9711200, 1997.', 'hep-th/9711200'],
    ['A. Author. Knots. arXiv:math.GT/0309136.', 'math/0309136'],
    ['A. Author. Old paper. Nucl. Phys. B 1 (1998) 1, hep-th/9711200.', 'hep-th/9711200'],
    ['A. Author. arXiv:cond-mat/0501001v2.', 'cond-mat/0501001v2'],
    ['C. Author. Newer. arXiv:2105.00001v2.', '2105.00001v2'],
    ['C. Author. arXiv preprint arXiv:1706.03762, 2017.', '1706.03762'],
    ['C. Author. ARXIV: 1706.03762 [cs.CL].', '1706.03762'],
    ['C. Author. arXiv 1706.03762.', '1706.03762'],
    ['C. Author. arXiv preprint arXiv : 1706.03762.', '1706.03762'],
    ['C. Author. arXiv preprintarXiv:1706.03762.', '1706.03762'],
    ['B. Author. https://arxiv.org/abs/2105.00001.', '2105.00001'],
    ['B. Author. https://arxiv.org/abs/2105.00001v3.', '2105.00001v3'],
    ['B. Author. https://arxiv.org/pdf/2105.00001.pdf', '2105.00001'],
    ['B. Author. http://export.arxiv.org/abs/hep-th/9711200.', 'hep-th/9711200'],
    ['B. Author. (hep-th/9711200).', 'hep-th/9711200'],
    ['D. Author. arXiv:foo-bar/9901001; arXiv:hep-th/9711200.', 'hep-th/9711200'],
  ])('reads the ID in %j as %j', (text, id) => {
    expect(arxivInText(text)).toBe(id);
  });

  it.each([
    'D. Author. Data and/1234567 samples.',
    'D. Author. arXiv:foo-bar/9901001.',
    'D. Author. A preprint, hep-th/0805123.',
    'D. Author. Phys. Rev. 1999.12345 (2001).',
    'D. Author. Preprint 2105.00001.',
    'E. Author. https://example.org/abs/2105.00001.',
    'E. Author. https://example.org/hep-th/9711200.',
    'E. Author. https://my-arxiv.org/abs/2105.00001.',
    'E. Author. https://arxiv.org/html/2105.00001.',
    'E. Author. arXiv:2105.000012.',
    'E. Author. xhep-th/9711200.',
    'E. Author. arXiv:2105.00001v0.',
  ])('reads no ID in %j', (text) => {
    expect(arxivInText(text)).toBeUndefined();
  });

  it.each([
    ['arXiv labels with no ID', 'arXiv: '],
    ['spaced arXiv labels with no ID', 'arXiv        :        '],
    ['a digit run after a label', '1'],
    ['a letter run', 'a'],
    ['a run of /-separated archives', 'hep-th/'],
    ['a run of arxiv.org links', 'arxiv.org/abs/'],
    ['a run of new-style numbers', '2105.0000'],
  ])('reads text in time linear in %s', async (_, run) => {
    await expectLinear((n) => `arXiv:${run.repeat(n / run.length)}`, arxivInText, {
      from: 4_000,
      to: 1_024_000,
    });
  });

  it('reads a long link in time linear in its host', async () => {
    await expectLinear((n) => `https://${'a.'.repeat(n / 2)}org/abs/2105.00001`, arxivFromUrl, {
      from: 4_000,
      to: 1_024_000,
    });
  });
});
