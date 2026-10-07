/**
 * @fileoverview DOIs read from a PDF's first page and its reference entries: the closing
 * punctuation, quotes, and brackets around one are left out while brackets its suffix
 * balances stay, a first-page DOI is read only after a label, and a long run of DOI
 * characters reads in time linear in its length.
 * @module tests/formats/pdf/doi.test
 */
import { describe, expect, it } from 'vitest';
import { parsePdf } from '../../../src/formats/pdf/index.js';
import type { ScholarlyDocument } from '../../../src/model/document.js';
import { trimDoi } from '../../../src/model/doi.js';
import { expectLinear } from '../../linear.js';
import { buildPdf, paragraph, type TextSpec } from './build-pdf.js';

/** A heading and running text, so the page reads as a paper. */
const BODY: TextSpec[] = [
  { font: 'bold', size: 12, text: '1 Introduction', x: 72, y: 720 },
  ...paragraph(
    Array.from(
      { length: 12 },
      (_, i) => `Line ${i + 1} of ordinary running text in the body of the paper.`,
    ),
    { y: 700 },
  ),
];

/** Small enough that a run of tens of thousands of characters stays one item on the page. */
const TINY = 0.005;

function firstPage(doi: TextSpec): Uint8Array {
  return buildPdf({ pages: [[...BODY, { text: 'doi:', x: 72, y: 500 }, doi]] });
}

/**
 * A first page with `line` below the body, its `^` and `|` set as typographic quotes: the
 * test PDF's text is ASCII, and the font's encoding has the quotes at single bytes.
 */
function firstPageLine(line: TextSpec): Uint8Array {
  const pdf = new TextDecoder('latin1').decode(buildPdf({ pages: [[...BODY, line]] }));
  return Uint8Array.from(pdf.replaceAll('^', '\x93').replaceAll('|', '\x94'), (char) =>
    char.charCodeAt(0),
  );
}

/** A numbered reference list whose first entry ends with `run`. */
function referenceList(run: TextSpec): Uint8Array {
  return buildPdf({
    pages: [
      [
        ...BODY,
        { font: 'bold', size: 12, text: 'References', x: 72, y: 500 },
        { text: '[1] Doe J. A first title. J Tests. 2020.', x: 72, y: 485 },
        run,
        { text: '[2] Roe R. A second title. J Tests. 2021.', x: 72, y: 473 },
        { text: '[3] Poe E. A third title. J Tests. 2022.', x: 72, y: 461 },
      ],
    ],
  });
}

async function parse(bytes: Uint8Array): Promise<ScholarlyDocument> {
  const result = await parsePdf(bytes);
  if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
  return result.document;
}

describe('PDF DOIs', () => {
  it('leaves out the punctuation that closes a first-page DOI', async () => {
    const doi = async (text: string) =>
      (await parse(firstPage({ text, x: 95, y: 500 }))).metadata.identifiers?.doi;
    expect(await doi('10.1234/Abc.Def.')).toBe('10.1234/abc.def');
    expect(await doi('10.1234/abc).')).toBe('10.1234/abc');
    expect(await doi('10.1234/abc],;')).toBe('10.1234/abc');
  });

  it('reads a first-page DOI after its label, quoted or not', async () => {
    const doi = async (text: string) =>
      (await parse(firstPageLine({ text, x: 72, y: 500 }))).metadata.identifiers?.doi;
    for (const text of [
      'doi: 10.1234/abc',
      'doi: "10.1234/abc"',
      'doi:"10.1234/abc"',
      "doi: '10.1234/abc'",
      'See doi: "10.1234/abc". More',
      'DOI 10.1234/abc',
      'doi: ^10.1234/abc|',
    ])
      expect(await doi(text)).toBe('10.1234/abc');
    // With no label before it, a DOI on the first page is not the paper's own.
    expect(await doi('Cite 10.1234/abc here')).toBeUndefined();
    expect(await doi('DOIs 10.1234/abc')).toBeUndefined();
  });

  it('leaves out the punctuation that closes a reference DOI', async () => {
    const doi = async (text: string) =>
      (await parse(referenceList({ text, x: 250, y: 485 }))).references[0]?.doi;
    expect(await doi('doi:10.1234/Ref.One.')).toBe('10.1234/ref.one');
    expect(await doi('10.1234/two,')).toBe('10.1234/two');
    expect(await doi('10.1234/three..')).toBe('10.1234/three');
    expect(await doi('10.1234/four;.')).toBe('10.1234/four');
  });

  it('leaves out the brackets and quotes around a reference DOI', async () => {
    const doi = async (text: string) =>
      (await parse(referenceList({ text, x: 250, y: 485 }))).references[0]?.doi;
    expect(await doi('(doi: 10.1234/xyz).')).toBe('10.1234/xyz');
    expect(await doi('[10.1234/xyz];')).toBe('10.1234/xyz');
    expect(await doi('"10.1234/abc"')).toBe('10.1234/abc');
    expect(await doi('doi: "10.1234/abc".')).toBe('10.1234/abc');
    expect(await doi("'10.1234/abc',")).toBe('10.1234/abc');
    // A quote that opens nowhere cuts the run short of a whole DOI.
    expect(await doi('10.1234/abc"')).toBeUndefined();
  });

  it('keeps the balanced parentheses of a DOI suffix whole', async () => {
    const reference = async (text: string) =>
      (await parse(referenceList({ text, x: 250, y: 485 }))).references[0]?.doi;
    const first = async (text: string) =>
      (await parse(firstPage({ text, x: 95, y: 500 }))).metadata.identifiers?.doi;
    for (const doi of [reference, first]) {
      expect(await doi('10.1002/(SICI)1097-4636')).toBe('10.1002/(sici)1097-4636');
      expect(await doi('10.1002/(SICI)1097-4636(199907).')).toBe('10.1002/(sici)1097-4636(199907)');
    }
    expect(await reference('(doi:10.1002/(SICI)1097-4636(199907)).')).toBe(
      '10.1002/(sici)1097-4636(199907)',
    );
  });

  it('leaves out typographic quotes closing a DOI', () => {
    expect(trimDoi('10.1234/abc”.')).toBe('10.1234/abc');
    expect(trimDoi('10.1234/abc’,')).toBe('10.1234/abc');
  });

  it('reads a first-page DOI with a long run of dots in linear time', async () => {
    const build = (n: number) =>
      firstPage({ size: TINY, text: `10.1234/a${'.'.repeat(n)}b`, x: 95, y: 500 });
    expect((await parse(build(1_000))).metadata.identifiers?.doi).toBe(
      `10.1234/a${'.'.repeat(1_000)}b`,
    );
    await expectLinear(build, parsePdf, { from: 20_000, to: 80_000 });
  });

  it('reads a first page of labeled, quoted DOI runs in linear time', async () => {
    // Each run is labeled and quoted, and leaves no suffix once its full stop goes.
    const build = (n: number) =>
      firstPageLine({ size: TINY, text: 'doi: "10.1234/." '.repeat(n), x: 72, y: 500 });
    expect((await parse(build(100))).metadata.identifiers?.doi).toBeUndefined();
    await expectLinear(build, parsePdf, { from: 1_000, to: 4_000 });
  });

  it('reads a reference DOI with a long run of dots in linear time', async () => {
    const build = (n: number) =>
      referenceList({ size: TINY, text: `10.1234/a${'.'.repeat(n)}b`, x: 250, y: 485 });
    expect((await parse(build(1_000))).references[0]?.doi).toBe(`10.1234/a${'.'.repeat(1_000)}b`);
    await expectLinear(build, parsePdf, { from: 20_000, to: 80_000 });
  });

  it('rejects a run of DOI prefixes closed by a quote in linear time', async () => {
    const build = (n: number) =>
      referenceList({ size: TINY, text: `${'10.1234/.'.repeat(n)}"`, x: 250, y: 485 });
    expect((await parse(build(100))).references[0]?.doi).toBeUndefined();
    await expectLinear(build, parsePdf, { from: 2_500, to: 10_000 });
  });

  it('matches the brackets of a reference DOI in linear time', async () => {
    const suffix = (n: number) => `a${'('.repeat(n)}b${')'.repeat(n)}`;
    const build = (n: number) =>
      referenceList({ size: TINY, text: `(10.1234/${suffix(n)}).`, x: 250, y: 485 });
    expect((await parse(build(1_000))).references[0]?.doi).toBe(`10.1234/${suffix(1_000)}`);
    await expectLinear(build, parsePdf, { from: 20_000, to: 80_000 });
  });
});
