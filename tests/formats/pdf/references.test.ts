/**
 * @fileoverview A PDF reference list split into entries: a list of one or two numbered
 * entries splits at its numbers as a longer one does, while a stray number opening a
 * wrapped line or a line of prose never splits a list.
 * @module tests/formats/pdf/references.test
 */
import { describe, expect, it } from 'vitest';
import { parsePdf } from '../../../src/formats/pdf/index.js';
import type { Reference } from '../../../src/model/document.js';
import { buildPdf, paragraph, type TextSpec } from './build-pdf.js';

/** A title, an introduction, and a references heading at y 560: the list under test follows. */
const HEAD: TextSpec[] = [
  { font: 'bold', size: 20, text: 'A study of layout inference', x: 72, y: 700 },
  { font: 'bold', size: 12, text: 'Introduction', x: 72, y: 660 },
  ...paragraph(
    [
      'Scholarly papers are mostly read as PDF files, and a PDF file records where',
      'each piece of text is drawn rather than what that text is. A parser has to',
      'work out which lines are headings and which are running text in the body.',
      'We set every page in one column of ten point text, with headings in a bold',
      'face, as many journals do, and we close with a short list of references.',
      'The list below is the case under test, and it holds only a few entries.',
    ],
    { y: 640 },
  ),
  { font: 'bold', size: 12, text: 'References', x: 72, y: 560 },
];

/** One line of the list, 12 points below the one before it. */
function line(text: string, row: number, x = 72): TextSpec {
  return { size: 10, text, x, y: 540 - 12 * row };
}

async function references(entries: TextSpec[]): Promise<{ label?: string; text: string }[]> {
  const result = await parsePdf(buildPdf({ pages: [[...HEAD, ...entries]] }));
  if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
  return result.document.references.map(({ label, text }: Reference) => ({
    ...(label !== undefined && { label }),
    text,
  }));
}

const FIRST = 'Smith A. First research article. Journal 2020.';
const SECOND = 'Jones B. Second research article. Journal 2021.';

describe('PDF reference lists', () => {
  it('splits a two-entry list at its numbers, in each marker form', async () => {
    for (const [one, two] of [
      ['[1]', '[2]'],
      ['1.', '2.'],
      ['1', '2'],
    ]) {
      expect(await references([line(`${one} ${FIRST}`, 0), line(`${two} ${SECOND}`, 1)])).toEqual([
        { label: '1', text: FIRST },
        { label: '2', text: SECOND },
      ]);
    }
  });

  it('splits a two-entry list whose entries wrap, flush or under a hanging indent', async () => {
    for (const indent of [72, 86]) {
      expect(
        await references([
          line('[1] Smith A. First research article with a long title that wraps over', 0),
          line('two lines. Journal 2020.', 1, indent),
          line('[2] Jones B. Second research article with a long title that wraps', 2),
          line('as well. Journal 2021.', 3, indent),
        ]),
      ).toEqual([
        {
          label: '1',
          text: 'Smith A. First research article with a long title that wraps over two lines. Journal 2020.',
        },
        {
          label: '2',
          text: 'Jones B. Second research article with a long title that wraps as well. Journal 2021.',
        },
      ]);
    }
  });

  it('keeps a one-entry list whole, on one line or wrapped', async () => {
    expect(await references([line(`[1] ${FIRST}`, 0)])).toEqual([{ label: '1', text: FIRST }]);
    expect(
      await references([
        line('[1] Smith A. First research article with a long title that wraps over', 0),
        line('two lines. Journal 2020.', 1),
      ]),
    ).toEqual([
      {
        label: '1',
        text: 'Smith A. First research article with a long title that wraps over two lines. Journal 2020.',
      },
    ]);
  });

  it('splits a list of three or more numbered entries', async () => {
    expect(
      await references([
        line(`[1] ${FIRST}`, 0),
        line(`[2] ${SECOND}`, 1),
        line('[3] Brown C. Third research article. Journal 2022.', 2),
      ]),
    ).toEqual([
      { label: '1', text: FIRST },
      { label: '2', text: SECOND },
      { label: '3', text: 'Brown C. Third research article. Journal 2022.' },
    ]);
  });

  it('reads an entry whose number runs straight into a bracket', async () => {
    const list = await references([
      line(`1. ${FIRST}`, 0),
      line(`2. ${SECOND}`, 1),
      line('3.[No title]. https://www.medrxiv.org/content/a-preprint.full.pdf.', 2),
      line('4. Brown C. Fourth research article. Journal 2022.', 3),
    ]);
    expect(list.map((entry) => entry.label)).toEqual(['1', '2', '3', '4']);
    expect(list[2]?.text).toMatch(/^\\?\[No title\\?\]\. https:\/\/www\.medrxiv\.org\//);
  });

  it('never splits a list at a stray number opening a line', async () => {
    // A one-entry list whose wrapped line opens with a volume and issue.
    expect(
      await references([
        line('[1] Smith A. First research article. J Tests 12', 0),
        line('2 (3), 45-67. 2020.', 1),
      ]),
    ).toEqual([
      { label: '1', text: 'Smith A. First research article. J Tests 12 2 (3), 45-67. 2020.' },
    ]);
    // An author-year list under a hanging indent whose continuation opens with one.
    expect(
      await references([
        line('Smith A. (2020). First research article with a long title. J Tests', 0),
        line('2 (4), 100-110.', 1, 86),
        line('Jones B. (2021). Second research article with a long title. J Tests', 2),
        line('5, 1-9.', 3, 86),
        line('Brown C. (2022). Third research article with a title. J Tests 9, 3.', 4),
      ]),
    ).toHaveLength(1);
    // Prose whose second line opens with a bracketed number.
    expect(
      await references([
        line('This list is not numbered and its prose goes on for a line or two before', 0),
        line('[1] appears at the start of a wrapped line by chance in the text here,', 1),
        line('and the prose then continues to a full stop.', 2),
      ]),
    ).toHaveLength(1);
  });
});

describe('PDF reference arXiv IDs (#65)', () => {
  /** Each entry's arXiv ID and URL, the entries set as a numbered list. */
  async function identifiers(entries: string[]): Promise<Pick<Reference, 'arxiv' | 'url'>[]> {
    const lines = entries.map((entry, i) => line(`[${i + 1}] ${entry}`, i));
    const result = await parsePdf(buildPdf({ pages: [[...HEAD, ...lines]] }));
    if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
    return result.document.references.map(({ arxiv, url }) => ({
      ...(arxiv && { arxiv }),
      ...(url && { url }),
    }));
  }

  it('reads the arXiv ID an entry prints, labelled, linked, or in the old style', async () => {
    expect(
      await identifiers([
        'A. Author. Old paper. arXiv:hep-th/9711200, 1997.',
        'A. Author. Knots. arXiv:math.GT/0309136.',
        'A. Author. Old paper. Nucl. Phys. B 1 (1998) 1, hep-th/9711200.',
        'A. Author. arXiv:cond-mat/0501001v2.',
        'C. Author. Newer. arXiv:2105.00001v2.',
        'B. Author. New. https://arxiv.org/abs/2105.00001.',
        'B. Author. New. https://arxiv.org/abs/2105.00001v3.',
        'B. Author. New. https://arxiv.org/pdf/2105.00001.',
        'B. Author. Old. http://arxiv.org/abs/hep-th/9711200.',
      ]),
    ).toEqual([
      { arxiv: 'hep-th/9711200' },
      { arxiv: 'math/0309136' },
      { arxiv: 'hep-th/9711200' },
      { arxiv: 'cond-mat/0501001v2' },
      { arxiv: '2105.00001v2' },
      { arxiv: '2105.00001', url: 'https://arxiv.org/abs/2105.00001' },
      { arxiv: '2105.00001v3', url: 'https://arxiv.org/abs/2105.00001v3' },
      { arxiv: '2105.00001', url: 'https://arxiv.org/pdf/2105.00001' },
      { arxiv: 'hep-th/9711200', url: 'http://arxiv.org/abs/hep-th/9711200' },
    ]);
  });

  it('reads no arXiv ID from what only looks like one', async () => {
    expect(
      await identifiers([
        'D. Author. Data and/1234567 samples.',
        'D. Author. arXiv:foo-bar/9901001.',
        'D. Author. A preprint, hep-th/0805123.',
        'D. Author. Phys. Rev. 1999.12345 (2001).',
        'E. Author. https://example.org/abs/2105.00001.',
      ]),
    ).toEqual([{}, {}, {}, {}, { url: 'https://example.org/abs/2105.00001' }]);
  });
});
