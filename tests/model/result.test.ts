/**
 * @fileoverview The result contract: `parsed` fills an empty arXiv ID from an arXiv DOI,
 * a throw a parser did not anticipate becomes a `malformed` result, and a missing optional
 * peer still throws.
 * @module tests/model/result.test
 */
import { describe, expect, it } from 'vitest';
import type { ScholarlyDocument } from '../../src/model/document.js';
import { guard, guardAsync, MissingPeerError, parsed } from '../../src/model/result.js';
import { expectLinear } from '../linear.js';

/** A document holding only `metadata` and `references`. */
const documentWith = ({
  metadata = {},
  references = [],
}: Partial<Pick<ScholarlyDocument, 'metadata' | 'references'>>): ScholarlyDocument => ({
  abstracts: [],
  back: [],
  body: [],
  diagnostics: { quality: 'flat', unhandled: [], warnings: [] },
  floats: [],
  footnotes: [],
  format: 'jats',
  metadata,
  references,
});

/** The document a successful result holds. */
const documentOf = (result: ReturnType<typeof parsed>) => {
  if (!result.ok) throw new Error('expected a document');
  return result.document;
};

describe('parsed: arXiv IDs from arXiv DOIs (#76)', () => {
  it('fills an empty arXiv ID on the article and each reference from an arXiv DOI', () => {
    const { metadata, references } = documentOf(
      parsed(
        documentWith({
          metadata: { identifiers: { doi: '10.48550/arxiv.2105.00001' } },
          references: [
            { doi: '10.48550/arxiv.hep-th/9711200', text: 'A.' },
            { doi: '10.1103/physrevlett.74.2626', text: 'B.' },
            { text: 'C.' },
          ],
        }),
      ),
    );
    expect(metadata.identifiers).toEqual({ arxiv: '2105.00001', doi: '10.48550/arxiv.2105.00001' });
    expect(references).toEqual([
      { arxiv: 'hep-th/9711200', doi: '10.48550/arxiv.hep-th/9711200', text: 'A.' },
      { doi: '10.1103/physrevlett.74.2626', text: 'B.' },
      { text: 'C.' },
    ]);
  });

  it('keeps an arXiv ID already set, whatever the DOI names', () => {
    const { metadata, references } = documentOf(
      parsed(
        documentWith({
          metadata: { identifiers: { arxiv: '2105.00001v3', doi: '10.48550/arxiv.2105.00001' } },
          references: [{ arxiv: '1706.03762v5', doi: '10.48550/arxiv.1706.03762', text: 'A.' }],
        }),
      ),
    );
    expect(metadata.identifiers?.arxiv).toBe('2105.00001v3');
    expect(references[0]?.arxiv).toBe('1706.03762v5');
  });

  it('fills nothing from a DOI that names no arXiv ID, or with no identifiers at all', () => {
    const { metadata, references } = documentOf(
      parsed(
        documentWith({
          metadata: { identifiers: { doi: '10.48550/arxiv.1999.12345' } },
          references: [
            { doi: '10.48550/arxiv.notanid', text: 'A.' },
            { doi: '10.48550/zenodo.123', text: 'B.' },
          ],
        }),
      ),
    );
    expect(metadata.identifiers).toEqual({ doi: '10.48550/arxiv.1999.12345' });
    expect(references.map((r) => r.arxiv)).toEqual([undefined, undefined]);
    expect(documentOf(parsed(documentWith({}))).metadata).toEqual({});
  });

  it('fills copies, leaving the document passed in unchanged, frozen or not', () => {
    const freeze = <T>(value: T): T => {
      for (const child of Object.values(value as object))
        if (child && typeof child === 'object') freeze(child);
      return Object.freeze(value);
    };
    for (const frozen of [true, false]) {
      const shared = { doi: '10.48550/arxiv.hep-th/9711200', text: 'A.' };
      const document = documentWith({
        metadata: { identifiers: { doi: '10.48550/arxiv.2105.00001' } },
        references: [shared],
      });
      const input = frozen ? freeze(document) : document;
      const { metadata, references } = documentOf(parsed(input));
      expect(metadata.identifiers?.arxiv).toBe('2105.00001');
      expect(references[0]?.arxiv).toBe('hep-th/9711200');
      expect(input.metadata.identifiers).toEqual({ doi: '10.48550/arxiv.2105.00001' });
      expect(input.references).toEqual([shared]);
      expect(shared).toEqual({ doi: '10.48550/arxiv.hep-th/9711200', text: 'A.' });
    }
  });

  it('leaves related works alone', () => {
    const related = [{ doi: '10.48550/arxiv.2105.00001', relation: 'preprint' }];
    const { metadata } = documentOf(
      parsed(documentWith({ metadata: { related: structuredClone(related) } })),
    );
    expect(metadata.related).toEqual(related);
  });

  it('reads a long reference list in time linear in its length', async () => {
    const references = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        doi: `10.48550/arxiv.2105.${String(i % 99_999).padStart(5, '0')}`,
        text: 'A.',
      }));
    await expectLinear(
      references,
      (list) => parsed(documentWith({ references: structuredClone(list) })),
      {
        from: 250,
        to: 16_000,
      },
    );
  });
});

describe('guard', () => {
  it('returns what the parse returns', () => {
    const result = parsed({
      abstracts: [],
      back: [],
      body: [],
      diagnostics: { quality: 'flat', unhandled: [], warnings: [] },
      floats: [],
      footnotes: [],
      format: 'jats',
      metadata: {},
      references: [],
    });
    expect(guard(() => result)).toBe(result);
  });

  it('turns an unexpected throw into a malformed result', async () => {
    const boom = () => {
      throw new RangeError('Maximum call stack size exceeded');
    };
    expect(guard(boom)).toEqual({
      error: {
        message: 'The document could not be read: Maximum call stack size exceeded',
        reason: 'malformed',
      },
      ok: false,
    });
    expect(await guardAsync(async () => boom())).toMatchObject({
      error: { reason: 'malformed' },
    });
  });

  it('lets a missing peer throw', async () => {
    const missing = () => {
      throw new MissingPeerError('Install "linkedom" to parse HTML: bun add linkedom');
    };
    expect(() => guard(missing)).toThrow(MissingPeerError);
    await expect(guardAsync(async () => missing())).rejects.toThrow('Install "linkedom"');
  });
});
