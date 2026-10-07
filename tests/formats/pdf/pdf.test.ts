/**
 * @fileoverview `parsePdf` on synthetic PDFs: title and abstract from the first page,
 * numbered headings, paragraphs, running headers and page numbers dropped, two-column
 * reading order, captioned tables, a figure's panel labels, numbered references and the
 * end matter after them, footnotes by label, text split across runs, metadata fallbacks,
 * and the failures a PDF can report.
 * @module tests/formats/pdf/pdf.test
 */
import { describe, expect, it } from 'vitest';
import { parsePdf } from '../../../src/formats/pdf/index.js';
import type { Block, ScholarlyDocument, Section } from '../../../src/model/document.js';
import { toMarkdown } from '../../../src/render/markdown.js';
import { toText } from '../../../src/render/text.js';
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

  it('numbers the abstract’s parts as parts of the first abstract', async () => {
    expect((await parse(PAPER)).abstracts[0]?.sections.map((part) => part.id)).toEqual([
      'abstract-1-1',
    ]);
    const structured = await parse(
      buildPdf({
        pages: [
          [
            { font: 'bold', size: 20, text: 'A study of layout inference', x: 72, y: 700 },
            { font: 'bold', size: 12, text: 'Abstract', x: 72, y: 660 },
            { font: 'bold', size: 10, text: 'Background.', x: 72, y: 645 },
            {
              size: 10,
              text: 'Layout carries the structure of a paper the file omits.',
              x: 136,
              y: 645,
            },
            { font: 'bold', size: 10, text: 'Methods.', x: 72, y: 633 },
            {
              size: 10,
              text: 'We set pages of text in one column and read them back.',
              x: 119,
              y: 633,
            },
            { font: 'bold', size: 12, text: '1 Introduction', x: 72, y: 600 },
            ...paragraph(ABSTRACT, { y: 585 }),
          ],
        ],
      }),
    );
    expect(structured.abstracts[0]?.sections.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'abstract-1-1', title: 'Background' },
      { id: 'abstract-1-2', title: 'Methods' },
    ]);
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

  it('reads a figure’s panel labels as text, and a lettered subsection as a heading', async () => {
    const prose = 'Prose of the introduction runs across the page in ordinary body text here.';
    const body = (top: number, count: number): TextSpec[] =>
      paragraph(Array(count).fill(prose), { leading: 14, y: top });
    const page = (rest: TextSpec[]) =>
      buildPdf({
        pages: [
          [
            { font: 'bold', size: 20, text: 'A Study of Panel Labels in Documents', x: 72, y: 750 },
            { font: 'bold', size: 12, text: 'Introduction', x: 72, y: 700 },
            ...body(675, 6),
            ...rest,
          ],
        ],
      });
    const panels = await parse(
      page([
        { font: 'bold', size: 10, text: 'A) Pathway one', x: 72, y: 560 },
        { font: 'bold', size: 10, text: 'B)', x: 72, y: 420 },
        { size: 10, text: 'Figure 1. The two pathways and their genes.', x: 72, y: 300 },
        ...body(270, 3),
      ]),
    );
    expect(outline(panels.body)).toEqual(['Introduction']);
    expect(toMarkdown(panels)).toContain('\n\nA) Pathway one\n\n');
    const lettered = await parse(
      page([{ font: 'bold', size: 10, text: '(a) Background', x: 72, y: 560 }, ...body(540, 4)]),
    );
    expect(outline(lettered.body)).toEqual(['Introduction', '(a) Background']);
  });

  it('ends a reference list at end matter opened by a bold back-matter label', async () => {
    const opening: TextSpec[] = [
      { font: 'bold', size: 20, text: 'A study of layout inference in papers', x: 72, y: 720 },
      { font: 'bold', size: 12, text: 'Introduction', x: 72, y: 680 },
      ...paragraph(
        Array.from(
          { length: 30 },
          (_, i) => `Line ${i + 1} of ordinary running text in the paper.`,
        ),
        { y: 660 },
      ),
    ];
    // Entries under a hanging indent, or numbered, set in 8 pt; then two paragraphs that open
    // with a bold run-in label, and a licence.
    const list = (numbered: boolean): TextSpec[] =>
      ['Adams', 'Baker', 'Clark', 'Davis', 'Evans', 'Zhou'].flatMap((name, i) => [
        {
          size: 8,
          text: `${numbered ? `${i + 1}. ` : ''}${name}, K. I., and Pan, T. (2016). A title about RNA that runs`,
          x: 72,
          y: 700 - 31 * i,
        },
        {
          size: 8,
          text: 'over two lines and a third one. J. Mol. Biol. 428, 822-833.',
          x: 81,
          y: 690 - 31 * i,
        },
        { size: 8, text: `doi:10.1016/j.jmb.2015.08.${i}`, x: 81, y: 680 - 31 * i },
      ]);
    const endMatter: TextSpec[] = [
      { font: 'bold', size: 8, text: 'Conflict of Interest:', x: 72, y: 500 },
      {
        size: 8,
        text: 'The authors declare that the research was conducted in the',
        x: 147.3,
        y: 500,
      },
      { size: 8, text: 'absence of any commercial or financial relationships.', x: 72, y: 490 },
      { font: 'bold', size: 8, text: "Publisher's Note:", x: 72, y: 476 },
      {
        size: 8,
        text: 'All claims expressed in this article are solely those of the',
        x: 139.5,
        y: 476,
      },
      {
        size: 8,
        text: 'authors and do not necessarily represent those of the publisher.',
        x: 72,
        y: 466,
      },
      {
        size: 8,
        text: 'Copyright (c) 2021 the authors. This is an open-access article.',
        x: 72,
        y: 452,
      },
    ];
    for (const numbered of [false, true]) {
      const document = await parse(
        buildPdf({
          pages: [
            opening,
            [
              { font: 'bold', size: 12, text: 'References', x: 72, y: 720 },
              ...list(numbered),
              ...endMatter,
            ],
          ],
        }),
      );
      expect(document.references).toHaveLength(6);
      expect(document.references.at(-1)?.text).toMatch(
        /^Zhou, K\. I\., .* 822-833\. doi:10\.1016\/j\.jmb\.2015\.08\.5$/,
      );
      expect(document.back.map(({ kind, title }) => ({ kind, title }))).toEqual([
        { kind: 'declarations', title: 'Conflict of Interest' },
        { kind: 'notes', title: "Publisher's Note" },
      ]);
      expect(texts(document.back[0]?.blocks ?? [])).toEqual([
        'The authors declare that the research was conducted in the absence of any commercial or financial relationships.',
      ]);
    }
  });

  it('keeps a bold author name inside a reference list as a reference', async () => {
    const opening = paragraph(
      Array.from({ length: 8 }, (_, i) => `Line ${i + 1} of ordinary running text in the paper.`),
      { y: 680 },
    );
    // Each label's width in 10 pt Helvetica Bold: the entry's text follows a word space after it.
    for (const [author, width] of [
      ['Funder DC:', 54.4],
      ['Funder, D. C.:', 65.6],
      ['Funder D. C.', 59.5],
    ] as const) {
      const document = await parse(
        buildPdf({
          pages: [
            [
              {
                font: 'bold',
                size: 20,
                text: 'A study of layout inference in papers',
                x: 72,
                y: 740,
              },
              { font: 'bold', size: 12, text: 'Introduction', x: 72, y: 700 },
              ...opening,
              { font: 'bold', size: 12, text: 'References', x: 72, y: 560 },
              { size: 10, text: '[1] Smith A. First. Journal 2020.', x: 72, y: 540 },
              { size: 10, text: '[2] Jones B. Second. Journal 2021.', x: 72, y: 528 },
              { size: 10, text: '[3] Brown C. Third. Journal 2022.', x: 72, y: 516 },
              { font: 'bold', size: 10, text: author, x: 72, y: 504 },
              { size: 10, text: 'Fourth paper. Journal 2023.', x: 72 + width + 3, y: 504 },
            ],
          ],
        }),
      );
      expect(document.references.at(-1)?.text).toMatch(
        /Third\. Journal 2022\. .*Fourth paper\. Journal 2023\.$/,
      );
      expect(document.back).toEqual([]);
    }
  });

  it('keeps a footnote set below the text, by its label', async () => {
    const prose = 'Prose of the introduction runs across the page in ordinary body text here.';
    const opening = (heading: string): TextSpec[] => [
      { font: 'bold', size: 12, text: heading, x: 72, y: 700 },
      ...paragraph(Array(6).fill(prose), { leading: 14, y: 675 }),
    ];
    const first: TextSpec[] = [
      { font: 'bold', size: 20, text: 'A Study of Footnotes in Portable Documents', x: 72, y: 750 },
      ...opening('Introduction'),
      { size: 8, text: '1 This substantive footnote gives additional information.', x: 72, y: 80 },
    ];
    const document = await parse(buildPdf({ pages: [first] }));
    expect(document.footnotes).toEqual([
      { label: '1', text: 'This substantive footnote gives additional information.' },
    ]);
    expect(toMarkdown(document)).toContain(
      '## Footnotes\n\n- **1** This substantive footnote gives additional information.\n',
    );
    expect(toText(document)).toContain('This substantive footnote gives additional information.');
    expect(texts(document.body[0]?.blocks ?? []).join(' ')).not.toContain('substantive');

    // A label set small and raised above its note, on a later page.
    const raised = await parse(
      buildPdf({
        pages: [
          first,
          [
            ...opening('Methods'),
            { size: 5, text: '2', x: 72, y: 83 },
            { size: 8, text: 'A second note, set under a raised label.', x: 75, y: 80 },
          ],
        ],
      }),
    );
    expect(raised.footnotes).toEqual([
      { label: '1', text: 'This substantive footnote gives additional information.' },
      { label: '2', text: 'A second note, set under a raised label.' },
    ]);
  });

  it('leaves a labelled affiliation at the foot of the first page out of the footnotes', async () => {
    const document = await parse(
      buildPdf({
        pages: [
          [
            { font: 'bold', size: 20, text: 'A Study of Footnotes in Documents', x: 72, y: 750 },
            { font: 'bold', size: 12, text: 'Introduction', x: 72, y: 700 },
            ...paragraph(Array(6).fill('Prose of the introduction runs across the page here.'), {
              leading: 14,
              y: 675,
            }),
            { size: 5, text: '1', x: 72, y: 83 },
            {
              size: 8,
              text: 'Department of Physics, University of Somewhere, Country.',
              x: 75,
              y: 80,
            },
          ],
        ],
      }),
    );
    expect(document.footnotes).toEqual([]);
    expect(toMarkdown(document)).not.toContain('Department of Physics');
  });

  it('writes no link, tag, or image from text split across a regular and a bold run', async () => {
    // `[click]` is 25 points wide and `<` 5.84 in 10 pt Helvetica: the bold run abuts each.
    const split = (x: number, y: number, size = 10): TextSpec[] => [
      { size, text: '[click]', x, y },
      { font: 'bold', size, text: '(javascript:alert(1)) and', x: x + 2.5 * size, y },
      { size, text: '<', x: x + 2.5 * size + 125, y },
      { font: 'bold', size, text: 'img src=x onerror=alert(1)>', x: x + 3.084 * size + 125, y },
    ];
    const document = await parse(
      buildPdf({
        pages: [
          [
            { font: 'bold', size: 20, text: 'A Study of Split Runs in Documents', x: 72, y: 750 },
            { font: 'bold', size: 12, text: 'Introduction', x: 72, y: 700 },
            ...paragraph(Array(6).fill('Prose of the introduction runs across the page here.'), {
              y: 680,
            }),
            ...split(72, 608),
            { size: 5, text: '1', x: 72, y: 83 },
            ...split(76, 80, 8),
          ],
          [
            { font: 'bold', size: 12, text: 'References', x: 72, y: 700 },
            { size: 10, text: '[1] Smith A. First. Journal 2020.', x: 72, y: 680 },
            { size: 10, text: '[2] Jones B. Second. Journal 2021.', x: 72, y: 668 },
            { size: 10, text: '[3]', x: 72, y: 656 },
            ...split(88, 656),
          ],
        ],
      }),
    );
    const safe = '[click\\](javascript:alert(1)) and \\<img src=x onerror=alert(1)>';
    expect(texts(document.body[0]?.blocks ?? []).at(-1)).toContain(safe);
    expect(document.footnotes).toEqual([{ label: '1', text: safe }]);
    expect(document.references[2]).toMatchObject({ label: '3', text: safe });
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
