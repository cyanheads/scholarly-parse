/**
 * @fileoverview Source table rows → a rectangular grid of cell text with `colspan` and
 * `rowspan` expanded. Every format's table reader maps its markup into row groups of
 * `SourceRow`s and lets this build the grid, so span handling is written once.
 *
 * A cell covering N columns fills N entries and one covering M rows fills its column in
 * the M−1 rows below, repeating its text: the value belongs to each position it covers,
 * and keeping the source cell count would put values under the wrong headers.
 * (pubmed-mcp-server#111) As in HTML, a rowspan never reaches past its row group, and a
 * rowspan of 0 covers the rest of the group.
 *
 * The grids of one document draw on one {@link GridBudget}: what the tables of a document
 * may repeat and hold is capped where the grid is built, where a parser can still record
 * what it cut.
 * @module src/model/table-grid
 */

/**
 * Widest grid a row may occupy, and the ceiling every declared span is clamped to. The
 * widest real row observed is 15 columns; the cap turns `colspan="99999999"` into a
 * bounded row instead of an unbounded allocation.
 */
export const MAX_TABLE_COLUMNS = 512;

/**
 * Characters the tables of one document may repeat from a spanned cell into the other
 * positions it covers. Past it, a covered position is empty; the cell's own position
 * keeps its text. The most any corpus document repeats is about a thousand.
 */
export const MAX_SPAN_COPY_CHARS = 1_000_000;

/**
 * Grid cells the tables of one document may hold together, padding included. Past it, a
 * table's remaining rows are dropped. The largest corpus document holds under a thousand;
 * a supplementary table of 500,000 rows by two columns fits whole.
 */
export const MAX_GRID_CELLS = 2_000_000;

/** What the tables of one document may still spend. Every grid built for the document draws on it. */
export interface GridBudget {
  /** Grid cells left. */
  cells: number;
  /** Characters left for copies of spanned cells. */
  copyChars: number;
}

/** A fresh budget for one document. */
export function createGridBudget(): GridBudget {
  return { cells: MAX_GRID_CELLS, copyChars: MAX_SPAN_COPY_CHARS };
}

/**
 * What a warning calls a table: its label when the label names it ("Table 2"), else
 * `Table` and the bare number or the id.
 */
export function tableName(label: string | undefined, id?: string): string {
  return label && /^\p{L}/u.test(label) ? label : `Table ${label ?? id ?? ''}`.trim();
}

/** The `truncated-input` warning for a grid the budget cut, naming its table. */
export function truncatedGridMessage(name: string): string {
  return `${name} exceeds the document's table budget: copies of spanned cells past it are empty, and rows past it dropped`;
}

/** A built grid. */
export interface Grid {
  headerRows: number;
  rows: string[][];
  /** The budget ran out while this grid was built: some copies are empty, or rows were dropped. */
  truncated: boolean;
}

export interface SourceCell {
  colspan: number;
  header: boolean;
  /** Rows the cell covers, its own included; 0 covers the rest of its row group. */
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
 * A `rowspan` attribute value: 0, read as HTML reads a non-negative integer, spans the
 * rest of the row group; anything else is a {@link spanValue}.
 */
export function rowspanValue(raw: string | null | undefined): number {
  return Number.parseInt(raw ?? '', 10) === 0 ? 0 : spanValue(raw);
}

/**
 * Build the grid from a table's row groups, in the order they are shown, charging the
 * document's `budget`. A rowspan ends with its group. Header rows are head rows plus any
 * leading row made only of header cells; a row the source left short is padded so cells
 * never shift under the wrong column, and a row with no cells only counts among the rows
 * a rowspan covers. Rows are kept in order while the grid, padded to its widest row so
 * far, fits the cells left.
 */
export function buildGrid(groups: SourceRow[][], budget: GridBudget): Grid {
  const parsed: { cells: string[]; header: boolean }[] = [];
  /** Per column, the cell a rowspan carries down into it and the row of its group it ends before. */
  let carried: ({ end: number; value: string } | undefined)[] = [];
  let truncated = false;

  /** A spanned cell's text for one more position it covers, while the budget lasts. */
  const copy = (text: string): string => {
    if (text.length > budget.copyChars) {
      truncated = true;
      return '';
    }
    budget.copyChars -= text.length;
    return text;
  };

  /** Whether a rowspan covers column `col` at row `r` of the group. */
  const covered = (col: number, r: number): boolean => (carried[col]?.end ?? 0) > r;

  /** Fill `row` with the carried cells from `col` on, up to the first column none covers. */
  const drainCarried = (row: string[], col: number, r: number): number => {
    let at = col;
    while (at < MAX_TABLE_COLUMNS) {
      const carry = carried[at];
      if (!carry || carry.end <= r) return at;
      row[at] = copy(carry.value);
      at += 1;
    }
    return at;
  };

  let width = 0;
  build: for (const group of groups) {
    carried = [];
    let r = -1;
    for (const source of group) {
      r += 1;
      // Nothing is carried into a row with no cells: it would be dropped.
      if (source.cells.length === 0) continue;
      const row: string[] = [];
      let col = 0;
      for (const cell of source.cells) {
        col = drainCarried(row, col, r);
        const span = Math.min(cell.colspan, MAX_TABLE_COLUMNS - col);
        const end = cell.rowspan === 0 ? Number.POSITIVE_INFINITY : r + cell.rowspan;
        for (let i = 0; i < span; i++) {
          row[col] = i === 0 ? cell.text : copy(cell.text);
          if (cell.rowspan !== 1) carried[col] = { end, value: cell.text };
          col += 1;
        }
      }
      const rightmost = carried.findLastIndex((_, at) => covered(at, r));
      while (col <= rightmost) col = covered(col, r) ? drainCarried(row, col, r) : col + 1;
      const widest = Math.max(width, row.length);
      if ((parsed.length + 1) * widest > budget.cells) {
        truncated = true;
        break build;
      }
      width = widest;
      for (let i = 0; i < row.length; i++) row[i] ??= '';
      parsed.push({ cells: row, header: source.inHead || source.cells.every((c) => c.header) });
    }
  }

  budget.cells -= parsed.length * width;
  for (const row of parsed) while (row.cells.length < width) row.cells.push('');
  let headerRows = 0;
  while (parsed[headerRows]?.header) headerRows++;
  return { headerRows, rows: parsed.map((row) => row.cells), truncated };
}
