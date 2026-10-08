/**
 * @fileoverview PDF text runs → lines, on runs built by hand where a synthetic PDF
 * cannot reproduce them: pdf.js merges adjacent text drawn in one font, so a heading
 * initial drawn as a glyph of its own only arises from a real publisher's file, and runs
 * drawn under a line's text come from typeset math.
 * @module tests/formats/pdf/layout.test
 */
import { describe, expect, it } from 'vitest';
import { layout } from '../../../src/formats/pdf/layout.js';
import type { Run } from '../../../src/formats/pdf/load.js';
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
