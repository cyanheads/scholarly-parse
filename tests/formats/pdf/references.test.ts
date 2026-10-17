/**
 * @fileoverview A PDF reference list split into entries: a list of one or two numbered
 * entries splits at its numbers as a longer one does, an unnumbered list splits at the
 * indent its first line sets, and a stray number opening a wrapped line or a line of
 * prose never splits a list, nor does a running footer left between its columns.
 * @module tests/formats/pdf/references.test
 */
import { readFileSync } from 'node:fs';
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
    // An author-year list under a hanging indent whose continuation opens with one: it
    // splits at its indent instead.
    expect(
      (
        await references([
          line('Smith A. (2020). First research article with a long title. J Tests', 0),
          line('2 (4), 100-110.', 1, 86),
          line('Jones B. (2021). Second research article with a long title. J Tests', 2),
          line('5, 1-9.', 3, 86),
          line('Brown C. (2022). Third research article with a title. J Tests 9, 3.', 4),
        ])
      ).map((entry) => entry.text),
    ).toEqual([
      'Smith A. (2020). First research article with a long title. J Tests 2 (4), 100-110.',
      'Jones B. (2021). Second research article with a long title. J Tests 5, 1-9.',
      'Brown C. (2022). Third research article with a title. J Tests 9, 3.',
    ]);
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

describe('PDF reference lists split at an indent (#50)', () => {
  const SMITH = 'Smith A. First research article with a long title that wraps over';
  const SMITH_END = 'two lines. Journal 2020.';
  const JONES = 'Jones B. Second research article with a long title that wraps';
  const JONES_END = 'as well. Journal 2021.';
  const SMITH_TEXT = `${SMITH} ${SMITH_END}`;
  const JONES_TEXT = `${JONES} ${JONES_END}`;
  const INDENT = 86;

  /** The list's entry texts. */
  async function entries(list: TextSpec[]): Promise<string[]> {
    return (await references(list)).map((entry) => entry.text);
  }

  it('splits two entries under a hanging or a first-line indent', async () => {
    expect(
      await entries([
        line(SMITH, 0),
        line(SMITH_END, 1, INDENT),
        line(JONES, 2),
        line(JONES_END, 3, INDENT),
      ]),
    ).toEqual([SMITH_TEXT, JONES_TEXT]);
    expect(
      await entries([
        line(SMITH, 0, INDENT),
        line(SMITH_END, 1),
        line(JONES, 2, INDENT),
        line(JONES_END, 3),
      ]),
    ).toEqual([SMITH_TEXT, JONES_TEXT]);
  });

  it('splits two hanging-indent entries where one fits on a line', async () => {
    expect(await entries([line(SMITH, 0), line(SMITH_END, 1, INDENT), line(SECOND, 2)])).toEqual([
      SMITH_TEXT,
      SECOND,
    ]);
    expect(await entries([line(FIRST, 0), line(JONES, 1), line(JONES_END, 2, INDENT)])).toEqual([
      FIRST,
      JONES_TEXT,
    ]);
  });

  it('starts each entry of a mostly one-line hanging list on its author', async () => {
    const list: TextSpec[] = [];
    const expected: string[] = [];
    for (const [i, name] of ['Adams', 'Baker', 'Clark', 'Davis', 'Evans', 'Ford'].entries()) {
      if (i % 2 === 0) {
        list.push(line(`${name} X. A longer article title that runs on and`, list.length));
        list.push(line(`wraps. J ${2010 + i}.`, list.length, INDENT));
        expected.push(`${name} X. A longer article title that runs on and wraps. J ${2010 + i}.`);
      } else {
        list.push(line(`${name} Y. One-line article. J ${2010 + i}.`, list.length));
        expected.push(`${name} Y. One-line article. J ${2010 + i}.`);
      }
    }
    expect(await entries(list)).toEqual(expected);
  });

  it('keeps one entry under a hanging indent whole', async () => {
    expect(await entries([line(SMITH, 0), line(SMITH_END, 1, INDENT)])).toEqual([SMITH_TEXT]);
    expect(
      await entries([line(SMITH, 0), line(SMITH_END, 1, INDENT), line('Third line.', 2, INDENT)]),
    ).toEqual([`${SMITH_TEXT} Third line.`]);
  });

  it('keeps flush entries that wrap without an indent as one reference', async () => {
    expect(
      await entries([line(SMITH, 0), line(SMITH_END, 1), line(JONES, 2), line(JONES_END, 3)]),
    ).toEqual([`${SMITH_TEXT} ${JONES_TEXT}`]);
  });

  it('never splits a flush list at each line for one indented line', async () => {
    const list: TextSpec[] = [];
    for (let i = 0; i < 8; i++) {
      list.push(
        line(`Author${i} A. A flush reference whose title wraps onto a second`, list.length),
      );
      list.push(line(`line flush as well. Journal ${2010 + i}.`, list.length));
      if (i === 3) list.push(line('doi:10.1000/example.4', list.length, 90));
    }
    expect(await references(list)).toHaveLength(1);
  });

  it('splits a first-line-indent list whose first entry is set flush', async () => {
    // The indent after a heading is often dropped, so only the first entry starts flush.
    const list = [
      line('Adams D. A first article whose title runs onto', 0),
      line('a second line. J 2019.', 1),
      line('Brown E. A second article whose title runs onto', 2, INDENT),
      line('a second line. J 2020.', 3),
      line('Clark F. A third article whose title runs onto', 4, INDENT),
      line('a second line and a third', 5),
      line('line. J 2021.', 6),
      line('Davis G. A fourth article whose title runs onto', 7, INDENT),
      line('a second line. J 2022.', 8),
    ];
    expect((await entries(list)).map((text) => text.slice(0, 8))).toEqual([
      'Adams D.',
      'Brown E.',
      'Clark F.',
      'Davis G.',
    ]);
  });

  it('splits a flush list at its own entry gaps when it is led closer than the body', async () => {
    // Entries set 8 points apart within, 12 between, under body text led at 12.
    const list: TextSpec[] = [];
    let y = 540;
    for (const name of ['Adams', 'Brown', 'Clark', 'Davis']) {
      list.push({ size: 7, text: `${name} D. An article whose title runs onto`, x: 72, y });
      list.push({ size: 7, text: 'a second line of the entry text', x: 72, y: y - 8 });
      list.push({ size: 7, text: 'and a third. J 2019:12.', x: 72, y: y - 16 });
      y -= 28;
    }
    expect((await entries(list)).map((text) => text.slice(0, 8))).toEqual([
      'Adams D.',
      'Brown D.',
      'Clark D.',
      'Davis D.',
    ]);
  });
});

describe('a two-column author-year list across pages with a running footer (#83)', () => {
  it('reads each entry of the Frontiers 2021 list apart, with no footer text', async () => {
    const source = new URL(
      '../../../corpus/pdf/frontiers-fcell.2021.786454/source.pdf',
      import.meta.url,
    );
    const result = await parsePdf(new Uint8Array(readFileSync(source)));
    if (!result.ok) throw new Error(result.error.message);
    const { references } = result.document;
    expect(references.filter((entry) => entry.text.length > 1000)).toEqual([]);
    expect(
      references.filter((entry) => /frontiersin\.org|Article 786454/.test(entry.text)),
    ).toEqual([]);
    expect(references[138]?.text).toMatch(/^Zhou, K\. I\., Parisien, M\., /);
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
