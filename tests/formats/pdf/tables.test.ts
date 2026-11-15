/**
 * @fileoverview PDF table rows → grids: each cell lands under the column it overlaps or
 * the nearest one left of it, the tables of a document draw on one grid budget, and
 * placing a row's cells costs time in proportion to the cells, not to cells × columns.
 * @module tests/formats/pdf/tables.test
 */
import { describe, expect, it } from 'vitest';
import { parsePdf } from '../../../src/formats/pdf/index.js';
import type { ScholarlyDocument, Section, TableBlock } from '../../../src/model/document.js';
import { MAX_GRID_CELLS, truncatedGridMessage } from '../../../src/model/table-grid.js';
import { expectLinear } from '../../linear.js';
import { buildPdf, paragraph, type TextSpec } from './build-pdf.js';

/** A title, a heading, and running text, so the first page reads as a paper. */
const OPENING: TextSpec[] = [
  { font: 'bold', size: 20, text: 'Tables set on wide pages', x: 72, y: 740 },
  { font: 'bold', size: 12, text: '1 Introduction', x: 72, y: 700 },
  ...paragraph(
    Array.from(
      { length: 12 },
      (_, i) => `Line ${i + 1} of ordinary running text in the body of the paper.`,
    ),
    { y: 680 },
  ),
];

async function parse(bytes: Uint8Array): Promise<ScholarlyDocument> {
  const result = await parsePdf(bytes);
  if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
  return result.document;
}

function tablesOf(sections: Section[]): TableBlock[] {
  return sections.flatMap((section) => [
    ...section.blocks.filter((block): block is TableBlock => block.type === 'table'),
    ...tablesOf(section.sections),
  ]);
}

/**
 * Pages holding a captioned table of `count` rows, each of two one-letter cells: the
 * first where every row's is, the second at an x no other row uses. The columns are the
 * `count + 1` spans the cells cover, so the grid is `count` by `count + 1` from `2 × count`
 * characters of text.
 */
function staircase(label: string, count: number): TextSpec[][] {
  const pages: TextSpec[][] = [[{ font: 'bold', size: 10, text: `${label}.`, x: 72, y: 720 }]];
  let y = 700;
  for (let k = 0; k < count; k++) {
    if (y < 80) {
      pages.push([]);
      y = 720;
    }
    pages.at(-1)?.push({ text: 'a', x: 72, y }, { text: 'b', x: 100 + 10 * k, y });
    y -= 6;
  }
  return pages;
}

describe('PDF tables', () => {
  it('places a cell right of every column in the last column', async () => {
    const document = await parse(
      buildPdf({
        pages: [
          [
            ...OPENING,
            { font: 'bold', size: 10, text: 'Table 1.', x: 72, y: 480 },
            { text: 'Measured values by group', x: 113, y: 480 },
            { text: 'Group', x: 72, y: 465 },
            { text: 'Mean', x: 250, y: 465 },
            { text: 'Count', x: 400, y: 465 },
            { text: 'Alpha', x: 72, y: 453 },
            { text: '1.5', x: 250, y: 453 },
            { text: '12', x: 400, y: 453 },
            { text: 'Beta', x: 72, y: 441 },
            { text: '14', x: 480, y: 441 },
          ],
        ],
      }),
    );
    expect(tablesOf(document.body)[0]?.rows).toEqual([
      ['Group', 'Mean', 'Count'],
      ['Alpha', '1.5', '12'],
      ['Beta', '', '14'],
    ]);
  });

  it('continues a caption whose lines are centred under a label set alone on its line', async () => {
    // Each line centred on x 306 at its 10 pt Helvetica width (40.02, 137.83, 175.65).
    const document = await parse(
      buildPdf({
        pages: [
          [
            ...OPENING,
            { text: 'TABLE 1', x: 286, y: 500 },
            { text: 'Mean fruit yield of each cultivar', x: 237.1, y: 488 },
            { text: 'over three seasons, in tonnes a hectare', x: 218.2, y: 476 },
            { text: 'Cultivar', x: 150, y: 460 },
            { text: 'Yield', x: 300, y: 460 },
            { text: 'Corfu', x: 150, y: 448 },
            { text: '1,503', x: 300, y: 448 },
          ],
        ],
      }),
    );
    expect(tablesOf(document.body)).toMatchObject([
      {
        caption: 'Mean fruit yield of each cultivar over three seasons, in tonnes a hectare',
        label: 'TABLE 1',
        rows: [
          ['Cultivar', 'Yield'],
          ['Corfu', '1,503'],
        ],
      },
    ]);
  });

  it('keeps single-cell lines under a row in the table: a wrapped cell goes on with it, a label stands alone (#49)', async () => {
    const row = (y: number, cells: [string, number][], font?: 'bold'): TextSpec[] =>
      cells.map(([text, x]) => ({ ...(font && { font }), size: 8, text, x, y }));
    // Rows 12 points apart and a wrapped cell's next line 7 points under it, all inside the
    // frame the running text sets, which ends near x 320.
    const document = await parse(
      buildPdf({
        pages: [
          [
            ...OPENING,
            { font: 'bold', size: 9, text: 'Table 2.', x: 72, y: 480 },
            { size: 9, text: 'Laboratory results', x: 110, y: 480 },
            ...row(
              465,
              [
                ['Test name', 72],
                ['Normal range', 200],
                ['Results', 280],
              ],
              'bold',
            ),
            ...row(453, [
              ['Direct Coombs test (DCT)', 72],
              ['Positive + 4', 280],
            ]),
            ...row(446, [['(IgG) / + 2', 280]]),
            ...row(439, [['(C3d)', 280]]),
            ...row(427, [
              ['Indirect Coombs test (ICT)', 72],
              ['Positive + 3', 280],
            ]),
            ...row(415, [
              ['Troponin high sensitivity quan-', 72],
              ['0.008-0.02', 200],
              ['0.027', 280],
            ]),
            ...row(408, [['titative', 72]]),
            ...row(396, [['HBc total', 72]]),
            ...row(384, [
              ['Haptoglobin', 72],
              ['0.3-2', 200],
              ['0.01', 280],
            ]),
            ...paragraph(['Running text of the paper goes on below the table here.'], { y: 340 }),
          ],
        ],
      }),
    );
    expect(tablesOf(document.body)).toMatchObject([
      {
        headerRows: 1,
        rows: [
          ['Test name', 'Normal range', 'Results'],
          ['Direct Coombs test (DCT)', '', 'Positive + 4 (IgG) / + 2 (C3d)'],
          ['Indirect Coombs test (ICT)', '', 'Positive + 3'],
          ['Troponin high sensitivity quantitative', '0.008-0.02', '0.027'],
          ['HBc total', '', ''],
          ['Haptoglobin', '0.3-2', '0.01'],
        ],
      },
    ]);
  });

  it('leaves running text set close under a table in its own size out of the table', async () => {
    // The paragraph opens 18 points under the last row, within 1.6 of its 12-point line gaps.
    const document = await parse(
      buildPdf({
        pages: [
          [
            ...OPENING,
            { font: 'bold', size: 10, text: 'Table 1.', x: 72, y: 500 },
            { text: 'Measured values by group', x: 113, y: 500 },
            { text: 'Group', x: 72, y: 486 },
            { text: 'Mean', x: 250, y: 486 },
            { text: 'Alpha', x: 72, y: 474 },
            { text: '1.5', x: 250, y: 474 },
            ...paragraph(
              [
                'Running text of the paper goes on under the table,',
                'its second line set under the first at the same gap.',
              ],
              { y: 456 },
            ),
          ],
        ],
      }),
    );
    expect(tablesOf(document.body)[0]?.rows).toEqual([
      ['Group', 'Mean'],
      ['Alpha', '1.5'],
    ]);
    expect(document.body.flatMap((section) => section.blocks)).toContainEqual({
      text: 'Running text of the paper goes on under the table, its second line set under the first at the same gap.',
      type: 'paragraph',
    });
  });

  it('draws every table of a document from one grid budget, and says where it ran out', async () => {
    const first = staircase('Table 1', 1_000);
    const second = staircase('Table 2', 1_000);
    const document = await parse(
      buildPdf({ pages: [OPENING, ...first, ...second], width: 10_200 }),
    );
    const tables = tablesOf(document.body);
    // The first fits whole; the second keeps the rows the 2,000,000 cells left room for.
    expect(tables.map((table) => [table.label, table.rows.length, table.rows[0]?.length])).toEqual([
      ['Table 1', 1_000, 1_001],
      ['Table 2', 998, 1_001],
    ]);
    const cells = tables.reduce((sum, table) => sum + table.rows.length * 1_001, 0);
    expect(cells).toBeLessThanOrEqual(MAX_GRID_CELLS);
    expect(
      document.diagnostics.warnings.filter((warning) => warning.code === 'truncated-input'),
    ).toEqual([
      {
        code: 'truncated-input',
        message: truncatedGridMessage('Table 2'),
        where: `page ${2 + first.length}`,
      },
    ]);
  });

  it('places the cells of rows wider than the page in linear time', async () => {
    // Four rows of `n` cells, each cell at an x of its own: `4n` columns.
    const build = (n: number) => {
      const page: TextSpec[] = [
        ...OPENING,
        { font: 'bold', size: 10, text: 'Table 1.', x: 72, y: 500 },
      ];
      for (let row = 0; row < 4; row++)
        for (let i = 0; i < n; i++)
          page.push({ text: 'x', x: 100 + 8 * (4 * i + row), y: 480 - 12 * row });
      return buildPdf({ pages: [page], width: 200 + 32 * n });
    };
    // The largest page timed is read whole into its table: four rows of 24,000 columns.
    const [table] = tablesOf((await parse(build(6_000))).body);
    expect([table?.rows.length, table?.rows[0]?.length]).toEqual([4, 24_000]);
    await expectLinear(build, parsePdf, { from: 1_500, to: 6_000 });
  });
});
