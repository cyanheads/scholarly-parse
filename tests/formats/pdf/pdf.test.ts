/**
 * @fileoverview `parsePdf` on synthetic PDFs: title and abstract from the first page,
 * numbered headings, paragraphs, running headers and page numbers dropped, two-column
 * reading order, captioned tables, numbered references, metadata fallbacks, and the
 * failures a PDF can report.
 * @module tests/formats/pdf/pdf.test
 */
import { describe, expect, it } from 'vitest';
import { parsePdf } from '../../../src/formats/pdf/index.js';
import type { Block, ScholarlyDocument, Section } from '../../../src/model/document.js';
import { toMarkdown } from '../../../src/render/markdown.js';
import { buildPdf, paragraph, type TextSpec } from './build-pdf.js';

async function parse(bytes: Uint8Array): Promise<ScholarlyDocument> {
  const result = await parsePdf(bytes);
  if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
  return result.document;
}

function texts(blocks: Block[]): string[] {
  return blocks.flatMap((block) =>
    'text' in block && typeof block.text === 'string' ? [block.text] : [],
  );
}

function outline(sections: Section[]): string[] {
  return sections.flatMap((section) => [
    `${section.label ?? ''} ${section.title ?? ''}`.trim(),
    ...outline(section.sections),
  ]);
}

/** Running header and page number, repeated on every page. */
function furniture(page: number): TextSpec[] {
  return [
    { size: 8, text: 'Journal of Tests 12 (2024)', x: 72, y: 760 },
    { size: 8, text: String(page), x: 300, y: 30 },
  ];
}

const ABSTRACT = [
  'We describe how the layout of a page carries the structure of a paper when the',
  'file itself records none of it, and we show that sizes, weights and spacing are',
  'enough to recover the title, the abstract, the sections and the reference list.',
];

const PAPER = buildPdf({
  pages: [
    [
      ...furniture(1),
      { font: 'bold', size: 20, text: 'A study of layout inference', x: 72, y: 700 },
      { size: 11, text: 'Jane Doe and Richard Roe', x: 72, y: 675 },
      { font: 'bold', size: 12, text: 'Abstract', x: 72, y: 640 },
      ...paragraph(ABSTRACT, { y: 625 }),
      { font: 'bold', size: 12, text: '1 Introduction', x: 72, y: 570 },
      ...paragraph(
        [
          'Scholarly papers are mostly read as PDF files, and a PDF file records where',
          'each piece of text is drawn rather than what that text is. A parser has to',
          'work out which lines are headings and which are running text.',
        ],
        { y: 555 },
      ),
      { size: 10, text: 'A second paragraph starts with an indented line and goes', x: 84, y: 519 },
      ...paragraph(['on for another line after that one.'], { y: 507 }),
      { font: 'bold', size: 12, text: '2 Methods', x: 72, y: 470 },
      ...paragraph(
        [
          'We set every page in one column of ten point text, with headings in a',
          'larger bold face and numbers in front of them, as many journals do.',
        ],
        { y: 455 },
      ),
    ],
    [
      ...furniture(2),
      { font: 'bold', size: 10, text: 'Table 1.', x: 72, y: 700 },
      { size: 10, text: 'Measured values by group', x: 113, y: 700 },
      { font: 'bold', size: 10, text: 'Group', x: 72, y: 685 },
      { font: 'bold', size: 10, text: 'Mean', x: 250, y: 685 },
      { font: 'bold', size: 10, text: 'Count', x: 400, y: 685 },
      { size: 10, text: 'Alpha', x: 72, y: 673 },
      { size: 10, text: '1.5', x: 250, y: 673 },
      { size: 10, text: '12', x: 400, y: 673 },
      { size: 10, text: 'Beta', x: 72, y: 661 },
      { size: 10, text: '2.5', x: 250, y: 661 },
      { size: 10, text: '14', x: 400, y: 661 },
      { font: 'bold', size: 12, text: 'References', x: 72, y: 620 },
      ...paragraph(
        [
          '1. Doe J. A first reference about layout. J Tests. 2020;1:1-2. doi:10.1234/abc.1',
          '2. Roe R. A second reference about parsing. J Tests. 2021;2:3-4.',
          '3. Poe E. A third reference about pages. arXiv:2101.00001',
        ],
        { y: 605 },
      ),
    ],
  ],
});

describe('parsePdf', () => {
  it('reads the title, abstract, numbered sections, and paragraphs', async () => {
    const document = await parse(PAPER);
    expect(document.format).toBe('pdf');
    expect(document.metadata.title).toBe('A study of layout inference');
    expect(texts(document.abstracts[0]?.sections[0]?.blocks ?? [])).toEqual([ABSTRACT.join(' ')]);
    expect(outline(document.body)).toEqual(['1 Introduction', '2 Methods']);
    expect(texts(document.body[0]?.blocks ?? [])).toEqual([
      'Scholarly papers are mostly read as PDF files, and a PDF file records where each piece of text is drawn rather than what that text is. A parser has to work out which lines are headings and which are running text.',
      'A second paragraph starts with an indented line and goes on for another line after that one.',
    ]);
    expect(document.diagnostics.quality).toBe('partial');
  });

  it('drops running headers and page numbers', async () => {
    const markdown = toMarkdown(await parse(PAPER));
    expect(markdown).not.toContain('Journal of Tests');
    expect(markdown).not.toMatch(/^\s*[12]\s*$/m);
  });

  it('keeps the margin lines of a one-page read, dropping only its page number', async () => {
    const page: TextSpec[] = [
      { font: 'bold', size: 20, text: 'A title set near the top edge', x: 72, y: 750 },
      { font: 'bold', size: 12, text: '1 Introduction', x: 72, y: 700 },
      ...paragraph(
        Array.from({ length: 14 }, (_, i) => `Body line ${i + 1} of the running text on the page`),
        { y: 214 },
      ),
      { size: 10, text: '1', x: 300, y: 30 },
    ];
    const once = await parse(buildPdf({ pages: [page] }));
    // One page of two read: nothing on it can be shown to repeat.
    const result = await parsePdf(buildPdf({ pages: [page, page] }), { maxPages: 1 });
    if (!result.ok) throw new Error(result.error.message);
    for (const document of [once, result.document]) {
      expect(document.metadata.title).toBe('A title set near the top edge');
      const markdown = toMarkdown(document);
      expect(markdown).toContain('Body line 14 of the running text on the page');
      expect(markdown).not.toMatch(/^\s*1\s*$/m);
    }
  });

  it('reads a captioned table with its rows, the bold first row as header', async () => {
    const table = (await parse(PAPER)).body[1]?.blocks.find((block) => block.type === 'table');
    expect(table).toMatchObject({
      caption: 'Measured values by group',
      headerRows: 1,
      label: 'Table 1',
      rows: [
        ['Group', 'Mean', 'Count'],
        ['Alpha', '1.5', '12'],
        ['Beta', '2.5', '14'],
      ],
    });
  });

  it('splits a numbered reference list and reads identifiers', async () => {
    const { references } = await parse(PAPER);
    expect(references.map((reference) => reference.label)).toEqual(['1', '2', '3']);
    expect(references[0]).toMatchObject({
      doi: '10.1234/abc.1',
      text: expect.stringMatching(/^Doe J\. A first reference/),
    });
    expect(references[2]).toMatchObject({ arxiv: '2101.00001' });
  });

  it('reads headings neither numbered nor named when only the back matter is', async () => {
    const document = await parse(
      buildPdf({
        pages: [
          [
            {
              font: 'bold',
              size: 20,
              text: 'How RNA shapes the condensates it joins',
              x: 72,
              y: 720,
            },
            { size: 9, text: 'Jane Doe and Richard Roe', x: 72, y: 695 },
            { font: 'bold', size: 12, text: 'RNA AS A SCAFFOLD FOR CONDENSATES', x: 72, y: 660 },
            ...paragraph(
              [
                'Condensates form where many weak contacts add up, and RNA supplies many of',
                'them at once, so a long transcript can hold a whole droplet together.',
              ],
              { y: 645 },
            ),
            { font: 'bold', size: 12, text: 'Modified RNA as a Switch', x: 72, y: 610 },
            ...paragraph(
              ['A methyl group on one base changes which proteins the transcript can bind.'],
              { y: 595 },
            ),
            { font: 'bold', size: 12, text: 'FUNDING', x: 72, y: 560 },
            ...paragraph(['This work was supported by a grant from a research council.'], {
              y: 545,
            }),
          ],
        ],
      }),
    );
    expect(outline(document.body)).toEqual([
      'RNA AS A SCAFFOLD FOR CONDENSATES',
      'Modified RNA as a Switch',
    ]);
    expect(outline(document.back)).toEqual(['FUNDING']);
  });

  it('reads an abstract set in small type as the whole of the first column', async () => {
    const body = Array.from({ length: 14 }, (_, i) => `Body line ${i + 1} of the introduction`);
    const document = await parse(
      buildPdf({
        pages: [
          [
            { font: 'bold', size: 20, text: 'A study of layout inference', x: 72, y: 740 },
            ...paragraph(
              [
                'Abstract. Layout carries structure',
                'when a file records none of it, and',
                'sizes, weights and spacing recover',
                'the title, abstract and sections.',
              ],
              { leading: 11, size: 9, y: 690 },
            ).map((spec) => ({ ...spec, font: 'bold' as const })),
            ...paragraph(['Index Terms: layout, parsing, reading order.'], { size: 9, y: 640 }),
            ...paragraph(['Manuscript received 16 November 2022.'], { size: 8, y: 120 }),
            { size: 10, text: 'I. INTRODUCTION', x: 320, y: 690 },
            ...paragraph(body, { x: 320, y: 675 }),
          ],
          [...paragraph(body, { y: 700 }), ...paragraph(body, { x: 320, y: 700 })],
        ],
      }),
    );
    expect(document.abstracts[0]?.sections).toMatchObject([
      { blocks: [{ text: expect.stringMatching(/^Layout carries structure when a file/) }] },
    ]);
    expect(document.abstracts[0]?.sections[0]?.title).toBeUndefined();
    expect(document.metadata.keywords).toEqual(['layout', 'parsing', 'reading order']);
    expect(outline(document.body)).toEqual(['I. INTRODUCTION']);
  });

  it('reads a two-column page left column first', async () => {
    const left = Array.from(
      { length: 8 },
      (_, i) => `Left column line ${i + 1} of the first part${i === 7 ? '.' : ''}`,
    );
    const right = Array.from(
      { length: 8 },
      (_, i) => `${i === 0 ? 'Right' : 'right'} column line ${i + 1} of the second part`,
    );
    const document = await parse(
      buildPdf({
        pages: [
          [
            { font: 'bold', size: 20, text: 'Two columns of running text', x: 72, y: 720 },
            { font: 'bold', size: 12, text: '1 Introduction', x: 72, y: 660 },
            ...paragraph(left, { y: 640 }),
            ...paragraph(right, { x: 320, y: 640 }),
          ],
        ],
      }),
    );
    const [first, second] = texts(document.body[0]?.blocks ?? []);
    expect(first).toMatch(/^Left column line 1 .* Left column line 8 of the first part\.$/);
    expect(second).toMatch(/^Right column line 1 .* right column line 8 of the second part$/);
  });

  it('falls back to the Info title, but not to a word processor placeholder', async () => {
    const body = paragraph(
      Array.from(
        { length: 6 },
        () => 'Body text with no title set larger than the rest of the page.',
      ),
      { y: 700 },
    );
    const titled = await parse(
      buildPdf({ info: { Title: 'A title from the document information' }, pages: [body] }),
    );
    expect(titled.metadata.title).toBe('A title from the document information');

    const placeholder = await parse(
      buildPdf({ info: { Title: 'Microsoft Word - draft.docx' }, pages: [body] }),
    );
    expect(placeholder.metadata.title).toBeUndefined();
    expect(placeholder.diagnostics.warnings.map((warning) => warning.code)).toContain('no-title');
  });

  it('reports what it cannot read', async () => {
    const reason = async (bytes: Uint8Array, options = {}) => {
      const result = await parsePdf(bytes, options);
      return result.ok ? 'ok' : result.error.reason;
    };
    expect(await reason(new TextEncoder().encode('<!doctype html><p>not a pdf</p>'))).toBe(
      'wrong-format',
    );
    expect(await reason(PAPER, { maxInputBytes: 100 })).toBe('too-large');
    expect(await reason(buildPdf({ pages: [[]] }))).toBe('empty');
    expect(await reason(new TextEncoder().encode('%PDF-1.4\nnot really a pdf\n'))).toBe(
      'malformed',
    );
  });
});
