/**
 * @fileoverview The shared table grid: a large supplementary table built whole, and the
 * per-document budget on copies of spanned cells and on grid cells, shared by every
 * table in the document.
 * @module tests/model/table-grid.test
 */
import { describe, expect, it } from 'vitest';
import {
  buildGrid,
  createGridBudget,
  MAX_GRID_CELLS,
  MAX_SPAN_COPY_CHARS,
  MAX_TABLE_COLUMNS,
  type SourceRow,
} from '../../src/model/table-grid.js';

const cell = (text: string, colspan = 1, rowspan = 1) => ({
  colspan,
  header: false,
  rowspan,
  text,
});

const row = (...cells: ReturnType<typeof cell>[]): SourceRow => ({ cells, inHead: false });

/** One cell spanning `width` × `height` positions, then a one-cell row for each row it covers below. */
function spanTable(text: string, width: number, height: number): SourceRow[] {
  return [
    row(cell(text, width, height)),
    ...Array.from({ length: height - 1 }, () => row(cell(''))),
  ];
}

/** Characters of every cell but the one at the top left, where the spanning cell's text sits once. */
function copiedChars(rows: string[][]): number {
  let chars = 0;
  rows.forEach((cells, r) => {
    cells.forEach((text, c) => {
      if (r > 0 || c > 0) chars += text.length;
    });
  });
  return chars;
}

const cellCount = (rows: string[][]) => rows.reduce((sum, cells) => sum + cells.length, 0);

describe('buildGrid', () => {
  it('builds a grid of hundreds of thousands of rows, padded to the widest', () => {
    const rows: SourceRow[] = Array.from({ length: 500_000 }, (_, i) =>
      i === 0 ? row(cell('a'), cell('b')) : row(cell(String(i))),
    );
    const grid = buildGrid(rows, createGridBudget());
    expect(grid.rows).toHaveLength(500_000);
    expect(grid.rows[0]).toEqual(['a', 'b']);
    expect(grid.rows.at(-1)).toEqual(['499999', '']);
    expect(grid.truncated).toBe(false);
  });
});

describe('the table budget', () => {
  it('holds a million copied characters and two million cells per document', () => {
    expect(MAX_SPAN_COPY_CHARS).toBe(1_000_000);
    expect(MAX_GRID_CELLS).toBe(2_000_000);
  });

  it('copies a spanned cell until the copies reach the budget, then leaves copies empty', () => {
    const text = 'W'.repeat(10_000);
    const exact = buildGrid([row(cell(text, 101))], createGridBudget());
    expect(exact.rows[0]?.every((value) => value === text)).toBe(true);
    expect(copiedChars(exact.rows)).toBe(MAX_SPAN_COPY_CHARS);
    expect(exact.truncated).toBe(false);

    const over = buildGrid([row(cell(text, 102))], createGridBudget());
    expect(over.rows[0]?.slice(0, 101).every((value) => value === text)).toBe(true);
    expect(over.rows[0]?.[101]).toBe('');
    expect(copiedChars(over.rows)).toBe(MAX_SPAN_COPY_CHARS);
    expect(over.truncated).toBe(true);
  });

  it('keeps the spanning cell its text and the copies within the budget', () => {
    const text = 'W '.repeat(5_000);
    const grid = buildGrid(
      spanTable(text, MAX_TABLE_COLUMNS, MAX_TABLE_COLUMNS),
      createGridBudget(),
    );
    expect(grid.rows).toHaveLength(MAX_TABLE_COLUMNS);
    expect(grid.rows[0]?.[0]).toBe(text);
    // The copies fill the budget exactly, in the first row: the cell's own position, then 100 copies.
    expect(copiedChars(grid.rows)).toBe(MAX_SPAN_COPY_CHARS);
    expect(grid.rows[0]?.indexOf('')).toBe(101);
    expect(grid.truncated).toBe(true);
  });

  it('keeps rows until the grid reaches the cell budget, then drops the rest', () => {
    const padded = (rows: number) => [
      row(...Array.from({ length: 500 }, () => cell(''))),
      ...Array.from({ length: rows - 1 }, () => row(cell('x'))),
    ];
    const exact = buildGrid(padded(4_000), createGridBudget());
    expect(exact.rows).toHaveLength(4_000);
    expect(cellCount(exact.rows)).toBe(MAX_GRID_CELLS);
    expect(exact.truncated).toBe(false);

    const over = buildGrid(padded(4_001), createGridBudget());
    expect(over.rows).toHaveLength(4_000);
    expect(over.truncated).toBe(true);
  });

  it('pads a million narrow rows below a wide one only as far as the cell budget', () => {
    const rows = [
      row(...Array.from({ length: MAX_TABLE_COLUMNS }, () => cell(''))),
      ...Array.from({ length: 1_000_000 }, () => row(cell(''))),
    ];
    const grid = buildGrid(rows, createGridBudget());
    expect(grid.rows).toHaveLength(Math.floor(MAX_GRID_CELLS / MAX_TABLE_COLUMNS));
    expect(grid.truncated).toBe(true);
  });

  it('shares one budget across every table in a document', () => {
    const budget = createGridBudget();
    const text = 'W '.repeat(5_000);
    const grids = Array.from({ length: 8 }, () =>
      buildGrid(spanTable(text, MAX_TABLE_COLUMNS, MAX_TABLE_COLUMNS), budget),
    );
    // The first table spends the whole copy budget; the cells run out in the eighth.
    expect(grids.map((grid) => copiedChars(grid.rows))).toEqual([
      MAX_SPAN_COPY_CHARS,
      ...Array(7).fill(0),
    ]);
    const cells = grids.reduce((sum, grid) => sum + cellCount(grid.rows), 0);
    expect(cells).toBe(MAX_GRID_CELLS - (MAX_GRID_CELLS % MAX_TABLE_COLUMNS));
    expect(grids.map((grid) => grid.rows.length)).toEqual([512, 512, 512, 512, 512, 512, 512, 322]);
    expect(grids.every((grid) => grid.truncated)).toBe(true);
  });
});
