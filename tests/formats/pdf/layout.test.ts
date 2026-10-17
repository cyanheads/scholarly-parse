/**
 * @fileoverview PDF text runs → lines, on runs built by hand where a synthetic PDF
 * cannot reproduce them: pdf.js merges adjacent text drawn in one font, so a heading
 * initial drawn as a glyph of its own only arises from a real publisher's file, and runs
 * drawn under a line's text come from typeset math.
 * @module tests/formats/pdf/layout.test
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layout } from '../../../src/formats/pdf/layout.js';
import { loadPdf, type Run } from '../../../src/formats/pdf/load.js';
import { DEFAULT_BUDGETS } from '../../../src/formats/pdf/parse.js';
import { expectLinear } from '../../linear.js';

/** A run at 6 points a character, so `x` values line up with the text before them. */
function run(text: string, x: number, y: number, fields: Partial<Run> = {}): Run {
  return {
    bold: false,
    italic: false,
    math: false,
    size: 12,
    text,
    width: 6 * text.length,
    x,
    y,
    ...fields,
  };
}

/** The texts of a corpus PDF's lines on `page`. */
async function corpusLines(fixture: string, page: number): Promise<string[]> {
  const bytes = readFileSync(new URL(`../../../corpus/pdf/${fixture}/source.pdf`, import.meta.url));
  const loaded = await loadPdf(new Uint8Array(bytes), DEFAULT_BUDGETS);
  if (!('pages' in loaded)) throw new Error(loaded.message);
  return layout(loaded.pages)
    .lines.filter((line) => line.page === page)
    .map((line) => line.text);
}

function lineTexts(runs: Run[]): string[] {
  return layout([{ height: 792, number: 1, runs, width: 612 }]).lines.map((line) => line.text);
}

describe('layout', () => {
  it('restores a bold initial the font maps to a lowercase letter', () => {
    // Scientific Data draws `Technical Validation` as `t`, then `echnical Validation`.
    const texts = lineTexts([
      run('t', 72, 600, { bold: true }),
      run('echnical Validation', 78, 600, { bold: true }),
      run('Body text set in the ordinary face runs on under the heading.', 72, 580),
    ]);
    expect(texts).toEqual([
      'Technical Validation',
      'Body text set in the ordinary face runs on under the heading.',
    ]);
  });

  it('keeps a subscript on its letter when tall delimiter pieces set the rows around it', () => {
    // Scientific Reports: a brace drawn as a stack of 9.6 pt pieces 2.9 pt apart sets each
    // row's base; the `4` of `d₄` hangs 0.96 pt below `d`, nearer the next piece down.
    const brace = (y: number) => run('', 155.9, y, { size: 9.583, width: 8.5 });
    const texts = lineTexts([
      brace(525.49),
      run('−', 254.7, 522.62, { size: 8.62, width: 6.9 }),
      run('d', 261.6, 522.62, { size: 8.62, width: 4.6 }),
      run('4', 266.2, 521.66, { size: 5.75, width: 3.5 }),
      run('m', 270.2, 522.62, { size: 8.62, width: 7.8 }),
      run('4', 278, 525.09, { size: 5.75, width: 3.5 }),
      brace(522.61),
      brace(519.74),
    ]);
    expect(texts.find((text) => text.includes('m'))).toContain('d4m4');
    expect(texts.map((text) => text.trim())).not.toContain('4');
  });

  it('leaves a split lowercase letter alone outside a bold heading', () => {
    const texts = lineTexts([
      run('t', 72, 600),
      run('he results held across every run we made.', 78, 600),
      run('Body text set in the ordinary face runs on under the heading.', 72, 580),
    ]);
    expect(texts).toEqual([
      'the results held across every run we made.',
      'Body text set in the ordinary face runs on under the heading.',
    ]);
  });

  it('starts a new line at small runs drawn under a heading inside its span', () => {
    // Scientific Reports sets a fraction's numerator from the next line under a heading's middle.
    const texts = lineTexts([
      run('Jacobi elliptic functions and weierstrass solution', 72, 600, { bold: true, size: 10 }),
      run('d2m2(1', 150, 596, { size: 6, width: 18 }),
      run('m2)', 170, 596, { size: 6, width: 9 }),
      run('Body text set in the ordinary face runs on under the heading.', 72, 580, { size: 10 }),
    ]);
    expect(texts).toEqual([
      'Jacobi elliptic functions and weierstrass solution',
      'd2m2(1 m2)',
      'Body text set in the ordinary face runs on under the heading.',
    ]);
  });

  it('keeps a subscript at its base run’s end, an accent, and a same-baseline overlap on their line', () => {
    const texts = lineTexts([
      // A subscript starting at the right end of the run it belongs to.
      run('Weierstrass', 72, 600, { size: 10 }),
      run('2', 138, 597, { size: 6 }),
      run(' function of the lattice', 144, 600, { size: 10 }),
      // An accent set above a one-letter run.
      run('`', 72, 583, { size: 10 }),
      run('a', 72, 580),
      run(' grave accent above a letter', 78, 580),
      // A TeX accent drawn over a letter on the same baseline.
      run('Costa-Juss', 72, 560),
      run('`', 132, 560),
      run('a and colleagues report', 132, 560),
    ]);
    expect(texts).toEqual([
      'Weierstrass2 function of the lattice',
      '`a grave accent above a letter',
      'Costa-Juss`a and colleagues report',
    ]);
  });

  it('keeps a run whose advance contradicts its size from setting its row or line size', () => {
    // Scientific Data: pdf.js gives a 9 pt run the 16 pt size and raised baseline of its `®`.
    const oversized = 'x'.repeat(60);
    const { lines } = layout([
      {
        height: 792,
        number: 1,
        runs: [
          run('QIAamp', 72, 600, { size: 9, width: 30 }),
          run(oversized, 102, 597, { size: 16, width: 0.23 * 16 * 60 }),
          run('lated genomic DNA were assessed by three instruments', 72, 590, { size: 9 }),
        ],
        width: 612,
      },
    ]);
    expect(lines.map((line) => [line.text, line.size])).toEqual([
      [`QIAamp${oversized}`, 9],
      ['lated genomic DNA were assessed by three instruments', 9],
    ]);
  });

  it('keeps a condensed bold heading’s size beside the smaller footnote mark raised after it', () => {
    const width = 0.28 * 14 * 21;
    const { lines } = layout([
      {
        height: 792,
        number: 1,
        runs: [
          run('Materials and Methods', 72, 560, { bold: true, size: 14, width }),
          run('*', 72 + width, 565, { bold: true, size: 8, width: 4 }),
        ],
        width: 612,
      },
    ]);
    expect(lines.map((line) => [line.text, line.size])).toEqual([['Materials and Methods*', 14]]);
  });

  it('keeps the reported size of a short run and of a long run advancing 0.27 em a character', () => {
    // The 16 pt run carries most of the line's characters, so the line takes its size only
    // while the run counts as set in it; otherwise the 9 pt run after it sets the size.
    const size = (text: string, width: number) =>
      layout([
        {
          height: 792,
          number: 1,
          runs: [
            run(text, 72, 600, { size: 16, width }),
            run('ab', 72 + width + 3, 600, { size: 9 }),
          ],
          width: 612,
        },
      ]).lines.map((line) => line.size);
    // Fifteen characters at 0.27 em, and fourteen far under it.
    expect(size('y'.repeat(15), 0.27 * 16 * 15)).toEqual([16]);
    expect(size('z'.repeat(14), 0.1 * 16 * 14)).toEqual([16]);
    // Fifteen far under it.
    expect(size('w'.repeat(15), 0.1 * 16 * 15)).toEqual([9]);
  });

  describe('on a two-column page', () => {
    /** Thirty-six characters, so a left-column line at x 72 ends at 288 and the gutter is clear to 320. */
    const LEFT = 'Left column text set in the 9pt body';
    const RIGHT = 'Right column text set in the 9pt bod';
    /** Ten 9 pt lines in each column from y 700 down, 12 pt apart, so the page shows a gutter. */
    const columns = (from = 700, count = 10): Run[] =>
      Array.from({ length: count }, (_, i) => [
        run(LEFT, 72, from - 12 * i, { size: 9 }),
        run(RIGHT, 320, from - 12 * i, { size: 9 }),
      ]).flat();
    const pageLines = (runs: Run[]) =>
      layout([{ height: 792, number: 1, runs, width: 612 }]).lines.map((line) => [
        line.column,
        line.text,
      ]);

    it('keeps two small right-column lines straddling a left-column row apart', () => {
      // Cambridge: a 6 pt footnote line 4 pt above a 9 pt left-column line, and one 3.5 pt below it.
      const lines = pageLines([
        ...columns(),
        run('tional support for this work was given', 72, 580, { size: 9 }),
        run('her time devoted', 320, 584.03, { size: 6, width: 48 }),
        run('to DBT training', 320, 576.49, { size: 6, width: 45 }),
      ]);
      expect(lines.filter(([column]) => column === 1).slice(-2)).toEqual([
        [1, 'her time devoted'],
        [1, 'to DBT training'],
      ]);
      expect(lines.filter(([column]) => column === 0).at(-1)).toEqual([
        0,
        'tional support for this work was given',
      ]);
    });

    it('keeps a superscript with its word when a row in the other column is level with it', () => {
      // Springer: the `2` of `m²` sits 2.5 pt below a right-column line's baseline.
      const lines = pageLines([
        ...columns(),
        run('375 mg/ m', 72, 580, { size: 9, width: 54 }),
        run('2', 126, 583, { size: 6, width: 3 }),
        run(' weekly for four weeks', 129, 580, { size: 9, width: 132 }),
        run('A right-column line just above it', 320, 585.5, { size: 9 }),
      ]);
      expect(lines).toContainEqual([0, '375 mg/ m2 weekly for four weeks']);
      expect(lines).toContainEqual([1, 'A right-column line just above it']);
    });

    it('keeps a prime raised over a formula on it, not on the tall delimiters set above it', () => {
      // Springer: a display formula's large brackets are drawn 6.9 pt above its baseline,
      // and the primes of `s′` and `ε′` 3.55 pt above it, nearer the brackets.
      const lines = pageLines([
        ...columns(),
        run('E V', 320, 580, { size: 8.5, width: 12 }),
        run('(', 333, 586.9, { size: 8.5, width: 3.5 }),
        run('s', 336.5, 580, { size: 8.5, width: 3.3 }),
        run('′', 339.8, 583.55, { size: 6.5, width: 1.8 }),
        run(', ε', 341.6, 580, { size: 8.5, width: 8 }),
        run('′', 349.6, 583.55, { size: 6.5, width: 1.8 }),
        run(', θ', 351.4, 580, { size: 8.5, width: 8 }),
        run(')', 359.4, 586.9, { size: 8.5, width: 3.5 }),
      ]);
      const right = lines.filter(([column]) => column === 1).map(([, text]) => text);
      expect(right.find((text) => String(text).startsWith('E V'))).toMatch(/s′, ε′, θ/);
      expect(right.find((text) => String(text).includes('('))).not.toMatch(/′/);
    });

    it('rejoins the two sides of a line that spans the gutter on one baseline', () => {
      const lines = pageLines([
        ...columns(700, 6),
        // The second run starts right of the gutter, a word space after the first ends.
        run('A heading set across the page in two', 72, 620, { bold: true, size: 9, width: 245 }),
        run('runs on one baseline', 320, 620, { bold: true, size: 9, width: 120 }),
        ...columns(600, 6),
      ]);
      expect(lines).toContainEqual([
        -1,
        'A heading set across the page in two runs on one baseline',
      ]);
      expect(lines.filter(([column]) => column === -1)).toHaveLength(1);
    });

    it('assembles each side’s rows in time linear in a page of runs', async () => {
      // Each column holds the costliest row for runs drawn under it, below the lines that show the gutter.
      const side = (n: number, x: number): Run[] => [
        ...Array.from({ length: n }, (_, i) =>
          run('wide', x + (i % 10), 400, { size: 10, width: 40 }),
        ),
        ...Array.from({ length: n }, (_, i) =>
          run('x', x + 20 + (i % 10), 397, { size: 6, width: 1 }),
        ),
      ];
      const page = (n: number): Run[] => [...columns(), ...side(n, 72), ...side(n, 320)];
      expect(pageLines(page(32_000)).some(([column]) => column === 1)).toBe(true);
      await expectLinear(page, (runs) => layout([{ height: 792, number: 1, runs, width: 612 }]), {
        from: 2_000,
        to: 32_000,
      });
    });

    it('keeps a footnote label with its URL beside a left-column row (arXiv page 2)', async () => {
      const lines = await corpusLines('arxiv-1906.00591v1', 2);
      expect(lines).toContain('1https://translate.google.com');
      expect(lines).not.toContain('1');
    });

    it('keeps each sidebar line apart from the title row beside it (Frontiers 2024 page 1)', async () => {
      const lines = await corpusLines('frontiers-fmicb.2024.1384204', 1);
      expect(lines).toEqual(
        expect.arrayContaining([
          'Technology, China',
          'REVIEWED BY',
          '*CORRESPONDENCE',
          'D. Wade Abbott',
        ]),
      );
    });
  });

  describe('a first-page margin column', () => {
    /**
     * A 7 pt sidebar of `count` lines at x 50 beside `prose` lines of 10 pt prose from x 190,
     * each sidebar line level with a prose line.
     */
    const sidebarPage = (count: number, prose = count): Run[] =>
      Array.from({ length: Math.max(count, prose) }, (_, i) => [
        ...(i < count
          ? [run(`Sidebar line ${i + 1}`, 50, 600 - 12 * i, { size: 7, width: 60 })]
          : []),
        ...(i < prose
          ? [
              run(
                `Abstract line ${i + 1} set in the body size across the measure`,
                190,
                600 - 12 * i,
                { size: 10, width: 300 },
              ),
            ]
          : []),
      ]).flat();

    it('reads the margin’s lines apart, ahead of the page’s others', () => {
      const { lines } = layout([{ height: 792, number: 1, runs: sidebarPage(6), width: 612 }]);
      expect(lines.map((line) => [line.column, line.text])).toEqual([
        ...Array.from({ length: 6 }, (_, i) => [-2, `Sidebar line ${i + 1}`]),
        ...Array.from({ length: 6 }, (_, i) => [
          0,
          `Abstract line ${i + 1} set in the body size across the measure`,
        ]),
      ]);
    });

    it('needs five small cells before the edge: four leave the sidebar on its rows', () => {
      // Six prose lines, so the prose-wide cells after the edge are enough either way.
      const columns = (count: number) =>
        layout([{ height: 792, number: 1, runs: sidebarPage(count, 6), width: 612 }]).lines.map(
          (line) => [line.column, line.cells.length],
        );
      expect(columns(5)).toEqual([...Array(5).fill([-2, 1]), ...Array(6).fill([0, 1])]);
      expect(columns(4)).toEqual([...Array(4).fill([0, 2]), ...Array(2).fill([0, 1])]);
    });

    it('seeks the edge in time linear in a page of cells', async () => {
      // Every prose-wide cell starts at an x of its own within the band an edge may lie in, so
      // each is a candidate edge; the text is too short for the gutter search to count it.
      const page = (n: number) => {
        const width = 40 * n;
        const runs = Array.from({ length: n }, (_, i) => [
          run('a', 1, 13 * n - 12 * i, { size: 7, width: 2 }),
          run('abc', width * (0.12 + (0.2 * i) / n), 13 * n - 12 * i, {
            size: 10,
            width: width / 5,
          }),
        ]).flat();
        return [{ height: 14 * n, number: 1, runs, width }];
      };
      // The edge is found: the `a` cells read apart as the margin.
      expect(new Set(layout(page(2_000)).lines.map((line) => line.column))).toEqual(
        new Set([-2, 0]),
      );
      await expectLinear(page, layout, { from: 2_000, to: 32_000 });
    });
  });

  it('looks for runs drawn under a line in time linear in a page of runs', async () => {
    // Every run below the line is level with it and none lies inside a run on it, so each
    // one would be compared with every run on the line.
    const page = (n: number): Run[] => [
      ...Array.from({ length: n }, (_, i) => run('wide', i % 10, 600, { size: 10, width: 40 })),
      ...Array.from({ length: n }, (_, i) => run('x', 100 + (i % 10), 597, { size: 6, width: 1 })),
    ];
    await expectLinear(page, (runs) => layout([{ height: 792, number: 1, runs, width: 612 }]), {
      from: 2_000,
      to: 32_000,
    });
  });
});

describe('margin lines and lines that span the gutter', () => {
  const at = (number: number, runs: Run[]) => ({ height: 792, number, runs, width: 612 });
  const body = (count: number, from: number): Run[] =>
    Array.from({ length: count }, (_, i) =>
      run(`Body prose line ${i} of the paper set across the full measure`, 72, from - 12 * i, {
        size: 10,
        width: 440,
      }),
    );
  const columns = (from: number, count: number): Run[] =>
    Array.from({ length: count }, (_, i) => [
      run(`Left column prose line ${i} with words`, 72, from - 12 * i, { size: 10, width: 220 }),
      run(`Right column prose line ${i} with words`, 320, from - 12 * i, { size: 10, width: 220 }),
    ]).flat();
  const cell = (text: string, x: number, y: number) =>
    run(text, x, y, { size: 10, width: 5 * text.length });
  const texts = (pages: ReturnType<typeof at>[]) => layout(pages).lines.map((line) => line.text);

  it('keeps a table row of bare numbers in the bottom margin', () => {
    const lines = texts([
      at(1, [
        ...body(20, 700),
        cell('Total', 72, 55),
        cell('40', 250, 55),
        cell('52', 350, 55),
        cell('128', 72, 42),
        cell('140', 250, 42),
        cell('166', 350, 42),
      ]),
    ]);
    expect(lines).toContain('128 140 166');
  });

  it('keeps a margin row whose only recurring cells are numbers', () => {
    const lines = texts([
      at(1, [...body(20, 700), cell('Algerian', 72, 50), cell('6,76', 250, 50)]),
      at(2, [
        ...body(20, 700),
        cell('Algerian', 72, 50),
        cell('12,2', 250, 50),
        cell('0,08', 350, 50),
      ]),
    ]);
    expect(lines).toContain('Algerian 12,2 0,08');
  });

  it('keeps a superscript ending a line that spans the gutter on that line', () => {
    const lines = texts([
      at(1, [
        ...columns(700, 10),
        run('Figure 2. Mean dose per body surface area across both arms, in mg/m', 72, 560, {
          size: 10,
          width: 420,
        }),
        run('2', 492, 563.5, { size: 6, width: 3 }),
        ...columns(540, 10),
      ]),
    ]);
    expect(lines).toContain('Figure 2. Mean dose per body surface area across both arms, in mg/m2');
    expect(lines).not.toContain('2');
  });
});
