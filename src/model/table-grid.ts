/**
 * @fileoverview Source table rows → a rectangular grid of cell text with `colspan` and
 * `rowspan` expanded. Every format's table reader maps its markup into `SourceRow`s and
 * lets this build the grid, so span handling is written once.
 *
 * A cell covering N columns fills N entries and one covering M rows fills its column in
 * the M−1 rows below, repeating its text: the value belongs to each position it covers,
 * and keeping the source cell count would put values under the wrong headers.
 * (pubmed-mcp-server#111)
 * @module src/model/table-grid
 */

import { largest } from './extremes.js';

/**
 * Widest grid a row may occupy, and the ceiling every declared span is clamped to. The
 * widest real row observed is 15 columns; the cap turns `colspan="99999999"` into a
 * bounded row instead of an unbounded allocation.
 */
export const MAX_TABLE_COLUMNS = 512;

export interface SourceCell {
  colspan: number;
  header: boolean;
  rowspan: number;
  text: string;
}

export interface SourceRow {
  cells: SourceCell[];
  /** The row sits in the table head (`<thead>`). */
  inHead: boolean;
}

/** A span attribute value, clamped to the grid; anything unparseable is 1. */
export function spanValue(raw: string | null | undefined): number {
  const declared = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(declared) || declared < 1) return 1;
  return Math.min(declared, MAX_TABLE_COLUMNS);
}

/**
 * Build the grid. Header rows are head rows plus any leading row made only of header
 * cells; a row the source left short is padded so cells never shift under the wrong
 * column.
 */
export function buildGrid(sourceRows: SourceRow[]): { headerRows: number; rows: string[][] } {
  const parsed: { cells: string[]; header: boolean }[] = [];
  const carried: ({ remaining: number; value: string } | undefined)[] = [];

  const drainCarried = (row: string[], col: number): number => {
    let at = col;
    while (at < MAX_TABLE_COLUMNS) {
      const carry = carried[at];
      if (!carry) return at;
      row[at] = carry.value;
      carry.remaining -= 1;
      if (carry.remaining <= 0) carried[at] = undefined;
      at += 1;
    }
    return at;
  };

  for (const source of sourceRows) {
    const row: string[] = [];
    let col = 0;
    for (const cell of source.cells) {
      col = drainCarried(row, col);
      const width = Math.min(cell.colspan, MAX_TABLE_COLUMNS - col);
      for (let i = 0; i < width; i++) {
        row[col] = cell.text;
        if (cell.rowspan > 1) carried[col] = { remaining: cell.rowspan - 1, value: cell.text };
        col += 1;
      }
    }
    const rightmost = carried.findLastIndex(Boolean);
    while (col <= rightmost) col = carried[col] ? drainCarried(row, col) : col + 1;
    if (source.cells.length === 0) continue;
    for (let i = 0; i < row.length; i++) row[i] ??= '';
    parsed.push({ cells: row, header: source.inHead || source.cells.every((c) => c.header) });
  }

  const width = Math.max(0, largest(parsed.map((row) => row.cells.length)));
  for (const row of parsed) while (row.cells.length < width) row.cells.push('');
  let headerRows = 0;
  while (parsed[headerRows]?.header) headerRows++;
  return { headerRows, rows: parsed.map((row) => row.cells) };
}
