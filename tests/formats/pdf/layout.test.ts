/**
 * @fileoverview PDF text runs → lines, on runs built by hand where a synthetic PDF
 * cannot reproduce them: pdf.js merges adjacent text drawn in one font, so a heading
 * initial drawn as a glyph of its own only arises from a real publisher's file.
 * @module tests/formats/pdf/layout.test
 */
import { describe, expect, it } from 'vitest';
import { layout } from '../../../src/formats/pdf/layout.js';
import type { Run } from '../../../src/formats/pdf/load.js';

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
    expect(texts).toContain('Technical Validation');
  });

  it('leaves a split lowercase letter alone outside a bold heading', () => {
    const texts = lineTexts([
      run('t', 72, 600),
      run('he results held across every run we made.', 78, 600),
      run('Body text set in the ordinary face runs on under the heading.', 72, 580),
    ]);
    expect(texts).toContain('the results held across every run we made.');
  });
});
