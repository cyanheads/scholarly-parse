/**
 * @fileoverview Text runs → lines in reading order. Runs sharing a baseline form a row;
 * a row splits into cells at wide gaps, so two columns set side by side (or the cells of
 * a table) stay apart. A first page's margin column (a sidebar beside the abstract) is
 * split off and read first. Each page is tested for a two-column gutter, its rows are
 * rebuilt on each side of it, and lines are read left column then right within each band
 * between full-width lines. Running headers, footers, page numbers, and margin text (a
 * publisher sidebar, line numbers) are dropped.
 * @module src/formats/pdf/layout
 */
import { append, largest } from '../../model/extremes.js';
import type { Page, Run } from './load.js';

/** A line of text in one column: one cell for prose, several for a table row. */
export interface Line {
  bold: boolean;
  /** Cell texts left to right, as runs; a prose line has one. */
  cells: Run[][];
  /**
   * Column index on a two-column page, `-1` for a line spanning the page, and `-2` for a
   * first-page margin column read apart from the page's other text.
   */
  column: number;
  /** Share of characters set in a math font. */
  math: number;
  page: number;
  right: number;
  size: number;
  text: string;
  x: number;
  y: number;
}

/** The column index of a first page's margin column: a sidebar beside the abstract. */
const MARGIN_COLUMN = -2;

export interface Layout {
  /** The size most of the text is set in. */
  bodySize: number;
  /** The usual distance between consecutive baselines of body text. */
  lineGap: number;
  lines: Line[];
}

/** Round to half a point, the precision font sizes are compared at. */
function half(size: number): number {
  return Math.round(size * 2) / 2;
}

/**
 * Whether a run is set in the size it reports. pdf.js gives a run the size and position of
 * its first glyph, so a run of 15 or more characters advancing under 0.27 em a character
 * (9 pt text after a raised `®`, reported at the `®`'s 16 pt, advances 0.23) was set
 * smaller than it says. Every other run that long in the corpus's PDFs advances 0.33 em a
 * character or more, and a condensed bold heading can advance 0.28.
 */
function sized(run: Run): boolean {
  const holds = (chars: number) => chars < 15 || run.width >= 0.27 * run.size * chars;
  // A string has no more characters than UTF-16 units: count them only when the units fail.
  return holds(run.text.length) || holds([...run.text].length);
}

/** The size carrying the most characters, among the runs set in the size they report when any is. */
function dominantSize(all: Run[]): number {
  const runs = all.some(sized) ? all.filter(sized) : all;
  const weight = new Map<number, number>();
  for (const run of runs)
    weight.set(half(run.size), (weight.get(half(run.size)) ?? 0) + run.text.length);
  return [...weight].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
}

/** Runs sharing a baseline, which the largest of them set in the size it reports sets. */
interface Row {
  base: Run;
  runs: Run[];
}

/**
 * Runs a page's rows are scanned over, in all, for one drawn under a line's text: many
 * times the corpus's most math-dense page (about 6,000). Past it a run joins the row it is
 * level with, so a page of hostile runs costs time in proportion to its runs.
 */
const UNDER_SCANS = 100_000;

/**
 * Whether `run` is drawn under a row's text rather than on its line: set more than a fifth
 * of the smaller size below the row's baseline, inside a run on that baseline at least
 * four times its width and clear of both its ends by 0.3 of its size. A fraction's
 * numerator from the next line set under a heading's middle is; a subscript at its base
 * run's end, and an accent on its letter's baseline, are not.
 */
function drawnUnder(run: Run, { base, runs }: Row): boolean {
  return runs.some((other) => {
    if (Math.abs(other.y - base.y) > 0.2 * Math.min(other.size, base.size)) return false;
    const margin = 0.3 * other.size;
    return (
      other.width >= 4 * run.width &&
      run.x >= other.x + margin &&
      run.x + run.width <= other.x + other.width - margin
    );
  });
}

/**
 * Whether `run`, level with `row`, is raised over `next` instead: smaller than both bases,
 * more than 0.3 of `row`'s size below its baseline, and from a fifth of the smaller size to
 * half of `next`'s size above `next`'s. A subscript drops less than a superscript rises, so
 * a prime set nearer a formula's tall delimiters than its baseline goes on the formula.
 */
function raisedOver(run: Run, row: Row, next: Row | undefined): boolean {
  if (!next || run.size >= row.base.size || run.size >= next.base.size) return false;
  const rise = run.y - next.base.y;
  return (
    row.base.y - run.y > 0.3 * row.base.size &&
    rise > 0.2 * Math.min(run.size, next.base.size) &&
    rise <= 0.5 * next.base.size
  );
}

/**
 * The runs of a row, sorted left to right, that are raised over the next row: each run
 * hung from the run before it goes where that run goes, and every other run goes when
 * `raised` holds for it. A run hangs from the one before it when it abuts it (under 0.3 of
 * the larger size apart) and drops no more than 0.3 of its size below its baseline when
 * that run is larger, or sits level with it when that run is itself hung. A subscript
 * after its letter (`d₄`, `c₋₁`) stays with the letter when a tall delimiter's pieces set
 * the bases of the rows around it.
 */
function raisedRuns(sorted: Run[], raised: (run: Run) => boolean): Set<Run> {
  const moved = new Set<Run>();
  const hung = new Set<Run>();
  for (const [at, run] of sorted.entries()) {
    const before = sorted[at - 1];
    const drop = before ? before.y - run.y : 0;
    const hangs =
      before !== undefined &&
      Math.abs(run.x - (before.x + before.width)) <= 0.3 * Math.max(run.size, before.size) &&
      ((before.size > run.size && drop > 0 && drop <= 0.3 * before.size) ||
        (hung.has(before) && Math.abs(drop) <= 0.1 * run.size));
    if (hangs) hung.add(run);
    if (hangs ? moved.has(before) : raised(run)) moved.add(run);
  }
  return moved;
}

/** Runs sharing a baseline, left to right: a superscript or subscript joins the line it sits on. */
function rows(runs: Run[]): Row[] {
  const sorted = runs.toSorted((a, b) => b.y - a.y || a.x - b.x);
  const result: Row[] = [];
  let scans = UNDER_SCANS;
  for (const run of sorted) {
    const row = result.at(-1);
    const level = row && Math.abs(row.base.y - run.y) <= 0.5 * Math.max(row.base.size, run.size);
    const below = row && run.y < row.base.y - 0.2 * Math.min(run.size, row.base.size);
    let under = false;
    if (row && level && below && scans > 0) {
      scans -= row.runs.length;
      under = drawnUnder(run, row);
    }
    if (row && level && !under) {
      row.runs.push(run);
      if (sized(run) && (run.size > row.base.size || !sized(row.base))) row.base = run;
    } else {
      result.push({ base: run, runs: [run] });
    }
  }
  for (const [at, row] of result.entries()) {
    const next = result[at + 1];
    if (!next || !row.runs.some((run) => raisedOver(run, row, next))) continue;
    const raised = raisedRuns(
      row.runs.toSorted((a, b) => a.x - b.x),
      (run) => raisedOver(run, row, next),
    );
    if (raised.size === 0) continue;
    row.runs = row.runs.filter((run) => !raised.has(run));
    next.runs.push(...raised);
  }
  for (const row of result) row.runs.sort((a, b) => a.x - b.x);
  return result;
}

/**
 * Rows of a page with a column boundary at `split`: assembled on each side of it apart, by
 * each run's left edge, then a row rejoined with the one on the other side whose base
 * shares its baseline (within a fifth of the smaller size), so a line spanning the
 * boundary stays whole. A run off a row's baseline never joins it across the boundary:
 * a footnote line in one column straddling a row in the other, or a superscript level
 * with the other column's row. A row holding a run that crosses the boundary spans it and
 * keeps its rows across the page, so a superscript ending it past the boundary stays on it.
 */
function sideRows(runs: Run[], split: number): Row[] {
  const spanning = rows(runs).filter((row) =>
    row.runs.some((run) => run.x < split - 2 && run.x + run.width > split + 2),
  );
  const taken = new Set(spanning.flatMap((row) => row.runs));
  const rest = runs.filter((run) => !taken.has(run));
  const sides = [
    rows(rest.filter((run) => run.x < split - 2)),
    rows(rest.filter((run) => run.x >= split - 2)),
  ];
  const tagged = [
    ...sides.flatMap((side, index) => side.map((row) => ({ row, side: index }))),
    ...spanning.map((row) => ({ row, side: -1 })),
  ].sort((a, b) => b.row.base.y - a.row.base.y || a.side - b.side);
  const result: Row[] = [];
  let last: { row: Row; side: number } | undefined;
  for (const entry of tagged) {
    const { base } = entry.row;
    if (
      last &&
      last.side !== entry.side &&
      last.side >= 0 &&
      entry.side >= 0 &&
      Math.abs(last.row.base.y - base.y) <= 0.2 * Math.min(last.row.base.size, base.size)
    ) {
      const [leftRow, rightRow] = last.side === 0 ? [last.row, entry.row] : [entry.row, last.row];
      last.row.runs = [...leftRow.runs, ...rightRow.runs];
      // Both sides are taken: the next row starts afresh.
      last = undefined;
    } else {
      result.push(entry.row);
      last = entry;
    }
  }
  return result;
}

/** A row split into cells wherever the gap between runs is wider than a word space can be. */
function cellsOf(row: Run[]): Run[][] {
  const cells: Run[][] = [];
  let current: Run[] = [];
  let right = Number.NEGATIVE_INFINITY;
  for (const run of row) {
    // Measured in the smaller of the two sizes: a small label beside a headline is its own cell.
    const size = Math.min(run.size, current.at(-1)?.size ?? run.size);
    if (current.length > 0 && run.x - right > Math.max(1.2 * size, 6)) {
      cells.push(current);
      current = [];
    }
    current.push(run);
    right = Math.max(right, run.x + run.width);
  }
  if (current.length > 0) cells.push(current);
  return cells;
}

function left(cell: Run[]): number {
  return cell[0]?.x ?? 0;
}

function rightOf(cell: Run[]): number {
  return largest(cell.map((run) => run.x + run.width));
}

/**
 * How many cells fill a column on each side of `x`: at least a sixth of the page wide and
 * ending (or starting) close to it. Table cells and equation numbers are too narrow to
 * count, so a single-column page with a table or displayed math shows no gutter.
 */
function columnCells(cells: Run[][], x: number, width: number): number {
  let before = 0;
  let after = 0;
  for (const cell of cells) {
    const [start, end] = [left(cell), rightOf(cell)];
    if (end - start < width / 6) continue;
    if (end <= x && end >= x - width * 0.12) before++;
    else if (start >= x && start <= x + width * 0.12) after++;
  }
  return Math.min(before, after);
}

/**
 * The x of a page's column gutter, or undefined for a single-column page: the middle of
 * the widest clear band that column lines end before and start after. Lines crossing it
 * are full-width lines between the column blocks.
 */
function gutter(cells: Run[][], width: number, minimum: number): number | undefined {
  let best = { count: 0, from: 0, to: 0 };
  for (let x = Math.round(width * 0.3); x <= width * 0.7; x += 2) {
    const count = columnCells(cells, x, width);
    if (count > best.count) best = { count, from: x, to: x };
    else if (count === best.count && best.to === x - 2) best.to = x;
  }
  return best.count >= minimum ? (best.from + best.to) / 2 : undefined;
}

/** Whether `y` lies in a page's top or bottom 8%, where running headers and footers sit. */
function inPageMargin(y: number, height: number): boolean {
  return y > height * 0.92 || y < height * 0.08;
}

/** How many of the ascending `values` lead with `holds` true, by bisection: it holds for a prefix of them. */
function leading(values: number[], holds: (value: number) => boolean): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (holds(values[middle] ?? 0)) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * The x of a first page's margin column edge, or undefined: a publisher sidebar of editors
 * and dates set beside the abstract, which the gutter search, needing prose-wide cells on
 * both sides, never finds. The edge lies between a tenth and 36% of the page width; five
 * or more cells set at least 1 pt below the body size end before it, five or more
 * prose-wide cells (a sixth of the page) start within 3% of the page width after it, and
 * no cell crosses it. Cells in the page's top and bottom 8% are left out, so a running
 * footer may span it. Candidate edges sit just before where prose-wide cells start, and
 * each is settled by bisection over cell edges sorted once.
 */
function marginEdge(rowCells: Run[][][], page: Page, bodySize: number): number | undefined {
  const cells = rowCells
    .flat()
    .filter((cell) => !inPageMargin(cell[0]?.y ?? 0, page.height))
    .map((cell) => ({
      left: left(cell),
      right: rightOf(cell),
      small: dominantSize(cell) <= bodySize - 1,
    }));
  const byLeft = cells.toSorted((a, b) => a.left - b.left);
  const lefts = byLeft.map((cell) => cell.left);
  // The furthest right end among the leftmost cells, for each count of them.
  const reach: number[] = [];
  for (const cell of byLeft)
    reach.push(Math.max(reach.at(-1) ?? Number.NEGATIVE_INFINITY, cell.right));
  const smallRights = cells
    .filter((cell) => cell.small)
    .map((cell) => cell.right)
    .sort((a, b) => a - b);
  const wideLefts = cells
    .filter((cell) => cell.right - cell.left >= page.width / 6)
    .map((cell) => cell.left)
    .sort((a, b) => a - b);
  const near = page.width * 0.03;
  const candidates = new Set(wideLefts.flatMap((x) => [Math.floor(x) - 1, Math.ceil(x - near)]));
  let best: { count: number; x: number } | undefined;
  for (const x of candidates) {
    if (x < page.width * 0.1 || x > page.width * 0.36) continue;
    const before = leading(lefts, (value) => value < x - 1);
    if (before > 0 && (reach[before - 1] ?? 0) > x + 1) continue;
    const margin = leading(smallRights, (value) => value <= x);
    const main =
      leading(wideLefts, (value) => value <= x + near) - leading(wideLefts, (value) => value < x);
    if (margin >= 5 && main >= 5 && main > (best?.count ?? 0)) best = { count: main, x };
  }
  return best?.x;
}

/**
 * A first page's margin column split off before its gutter is sought: the margin's lines,
 * read ahead of the page's others so they fall before the title, and the page without
 * them. Its runs leave before rows are built, so no row joins a margin line to one beside it.
 */
function splitMargin(
  page: Page,
  cells: Run[][][],
  bodySize: number,
): { lines: Line[]; page: Page } | undefined {
  const edge = marginEdge(cells, page, bodySize);
  if (edge === undefined) return undefined;
  const inColumn = (run: Run) => run.x + run.width <= edge && !inPageMargin(run.y, page.height);
  return {
    lines: rows(page.runs.filter(inColumn)).map((row) =>
      makeLine(cellsOf(row.runs), page.number, MARGIN_COLUMN),
    ),
    page: { ...page, runs: page.runs.filter((run) => !inColumn(run)) },
  };
}

/** Plain text of a cell's runs, spaced where the runs are apart. */
export function cellText(cell: Run[]): string {
  let text = '';
  let right: number | undefined;
  for (const run of cell) {
    if (
      right !== undefined &&
      run.x - right > 0.12 * run.size &&
      !/\s$/.test(text) &&
      !/^\s/.test(run.text)
    )
      text += ' ';
    text += run.text;
    right = run.x + run.width;
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** Whether `right` follows `left` with no word space between them: under 0.12 em apart, no whitespace at the join. */
function abuts(left: Run, right: Run): boolean {
  return (
    right.x - (left.x + left.width) <= 0.12 * right.size &&
    !/\s$/.test(left.text) &&
    !/^\s/.test(right.text)
  );
}

/**
 * Whether the regular run at `index` sits inside a bold word: bold runs abut it on both
 * sides (`Con` · `fl` · `ict`), as pdf.js reports a ligature or an apostrophe drawn from
 * another, regular font.
 */
export function insideBoldWord(runs: Run[], index: number): boolean {
  const [before, run, after] = [runs[index - 1], runs[index], runs[index + 1]];
  return (
    run !== undefined &&
    /^\S+$/.test(run.text) &&
    before?.bold === true &&
    after?.bold === true &&
    abuts(before, run) &&
    abuts(run, after)
  );
}

/**
 * A bold initial drawn as a glyph of its own that the font maps to a lowercase letter:
 * Nature's Scientific Data sets `Technical Validation` as `t` then `echnical Validation`.
 * A short line whose first run is one lowercase bold letter, abutting a bold run that
 * carries on the word, gets its capital back.
 */
function restoreInitial(cells: Run[][]): Run[][] {
  const [first, ...rest] = cells;
  const [initial, next] = first ?? [];
  if (!first || !initial || !next) return cells;
  const abutting = Math.abs(next.x - (initial.x + initial.width)) <= 0.15 * initial.size;
  const short = cells.map(cellText).join(' ').split(' ').length <= 12;
  if (
    !/^\p{Ll}$/u.test(initial.text) ||
    !/^\p{Ll}/u.test(next.text) ||
    !initial.bold ||
    !next.bold ||
    !abutting ||
    !short
  )
    return cells;
  return [[{ ...initial, text: initial.text.toUpperCase() }, ...first.slice(1)], ...rest];
}

function makeLine(lineCells: Run[][], page: number, column: number): Line {
  const cells = restoreInitial(lineCells);
  const runs = cells.flat();
  const chars = runs.reduce((n, run) => n + run.text.replace(/\s/g, '').length, 0) || 1;
  const size = dominantSize(runs);
  const main = runs.filter((run) => half(run.size) === size);
  return {
    bold: runs.every(
      (run, index) => run.bold || run.text.trim() === '' || insideBoldWord(runs, index),
    ),
    cells,
    column,
    math:
      runs.reduce((n, run) => n + (run.math ? run.text.replace(/\s/g, '').length : 0), 0) / chars,
    page,
    right: largest(cells.map(rightOf)),
    size,
    text: cells.map(cellText).join(' '),
    x: left(cells[0] ?? []),
    y: main[0]?.y ?? runs[0]?.y ?? 0,
  };
}

/** Rows, each split into cells. */
function rowCells(rowList: Row[]): Run[][][] {
  return rowList.map((row) => cellsOf(row.runs));
}

/** Cells of text no larger than the body: a sidebar set smaller than the body is still a column. */
function textCells(rowCells: Run[][][], bodySize: number): Run[][] {
  return rowCells
    .flat()
    .filter((cell) => dominantSize(cell) <= bodySize + 0.6 && cellText(cell).length >= 4);
}

/**
 * Each page's gutter. A page with too few column lines to show its own (a first page
 * that is mostly title and abstract) takes the gutter most other pages share, when it has
 * column lines on both sides of it.
 */
function gutters(pages: Page[], cells: Run[][][][], bodySize: number): (number | undefined)[] {
  const own = pages.map((page, i) => gutter(textCells(cells[i] ?? [], bodySize), page.width, 5));
  const votes = new Map<number, number>();
  for (const x of own)
    if (x !== undefined) votes.set(Math.round(x / 8), (votes.get(Math.round(x / 8)) ?? 0) + 1);
  const [bucket, count = 0] = [...votes].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (bucket === undefined || count < Math.max(2, pages.length * 0.3)) return own;
  const shared = own.filter((x): x is number => x !== undefined && Math.round(x / 8) === bucket);
  const typical = shared.reduce((sum, x) => sum + x, 0) / shared.length;
  return own.map((x, i) => {
    const page = pages[i];
    if (x !== undefined || !page) return x;
    return columnCells(textCells(cells[i] ?? [], bodySize), typical, page.width) >= 2
      ? typical
      : undefined;
  });
}

/** The size carrying the most characters across `lines`. */
export function linesSize(lines: Line[]): number {
  const weight = new Map<number, number>();
  for (const line of lines) weight.set(line.size, (weight.get(line.size) ?? 0) + line.text.length);
  return [...weight].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

/**
 * Heights, top first, where a band of two columns divides in two: both columns are clear
 * across a gap wider than a paragraph break, and in each the text above it is set in a
 * different size from the text below. A boxed abstract above the body, or back matter
 * above a smaller-set reference list, reads through before what follows; section
 * headings that happen to sit level in both columns do not divide the band.
 */
function bandBreaks(leftLines: Line[], rightLines: Line[]): number[] {
  // A column's blocks lie between its clear gaps; a break needs the blocks either side of one to differ in size.
  const clear = (lines: Line[]) => {
    const cuts = [0];
    for (let i = 1; i < lines.length; i++) {
      const [above, below] = [lines[i - 1] as Line, lines[i] as Line];
      if (above.y - below.y >= 1.8 * Math.max(above.size, below.size)) cuts.push(i);
    }
    cuts.push(lines.length);
    const gaps: [number, number][] = [];
    for (let k = 1; k < cuts.length - 1; k++) {
      const [start, cut, end] = [cuts[k - 1] ?? 0, cuts[k] ?? 0, cuts[k + 1] ?? 0];
      if (Math.abs(linesSize(lines.slice(start, cut)) - linesSize(lines.slice(cut, end))) < 0.5)
        continue;
      gaps.push([(lines[cut] as Line).y + (lines[cut] as Line).size, (lines[cut - 1] as Line).y]);
    }
    return gaps;
  };
  const breaks: number[] = [];
  for (const [low, high] of clear(leftLines)) {
    for (const [otherLow, otherHigh] of clear(rightLines)) {
      if (Math.max(low, otherLow) < Math.min(high, otherHigh))
        breaks.push((Math.max(low, otherLow) + Math.min(high, otherHigh)) / 2);
    }
  }
  return breaks.sort((a, b) => b - a);
}

/** A page's lines in reading order. */
function pageLines(page: Page, rowCells: Run[][][], split: number | undefined): Line[] {
  if (split === undefined) {
    return rowCells.map((cells) => makeLine(cells, page.number, 0));
  }
  // Two columns: a band of column text ends at each line that spans the gutter.
  const lines: Line[] = [];
  let leftBand: Line[] = [];
  let rightBand: Line[] = [];
  const flush = () => {
    let top = Number.POSITIVE_INFINITY;
    for (const y of [...bandBreaks(leftBand, rightBand), Number.NEGATIVE_INFINITY]) {
      const within = (line: Line) => line.y < top && line.y > y;
      append(lines, leftBand.filter(within));
      append(lines, rightBand.filter(within));
      top = y;
    }
    leftBand = [];
    rightBand = [];
  };
  for (const cells of rowCells) {
    // A left-column heading or line may overhang the gutter a little; a table row's cell may not,
    // or a full-width table would split into two columns.
    const overhang = cells.length === 1 ? page.width * 0.03 : 2;
    const rightCells = cells.filter((cell) => left(cell) >= split - 2);
    const leftCells = cells.filter(
      (cell) => left(cell) < split - 2 && rightOf(cell) <= split + overhang,
    );
    if (leftCells.length + rightCells.length < cells.length) {
      flush();
      lines.push(makeLine(cells, page.number, -1));
      continue;
    }
    if (leftCells.length > 0) leftBand.push(makeLine(leftCells, page.number, 0));
    if (rightCells.length > 0) rightBand.push(makeLine(rightCells, page.number, 1));
  }
  flush();
  return lines;
}

/** The label a figure or table caption starts with. */
const FLOAT_LABEL = /^(?:Fig(?:ure)?s?|FIG(?:URE)?S?|Table|TABLE)\.?\s*S?\d/;

/** Text of a line with digits generalized, so "Page 3" and "Page 4" compare equal. */
function shape(text: string): string {
  return text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

/**
 * Lines that are page furniture: a running header or footer (a margin line each of whose
 * cells is a page number or the same text in a page's top or bottom margin on several
 * pages), a page number, and text outside the frame the body text occupies (a publisher
 * sidebar, line numbers, a margin logo). Repetition needs two pages read: on one, only a
 * page number in the margin is dropped.
 */
function furniture(lines: Line[], pages: Page[], bodySize: number): Set<Line> {
  const drop = new Set<Line>();
  const heights = new Map(pages.map((page) => [page.number, page.height]));
  const inMargin = (line: Line) => inPageMargin(line.y, heights.get(line.page) ?? 792);
  // Compared cell by cell: a centred page number joins whichever half of a footer its
  // page's gutter leaves it beside, so only the halves repeat.
  // A cell counts as recurring only with a letter in it: a table's numbers recur by shape alone.
  const shapes = new Map<Line, { cells: string[]; whole: string }>();
  const seen = new Map<string, Set<number>>();
  for (const line of lines.filter(inMargin)) {
    const cells = line.cells.map((cell) => shape(cellText(cell))).filter(Boolean);
    const whole = shape(line.text);
    shapes.set(line, { cells, whole });
    for (const key of new Set([whole, ...cells]))
      seen.set(key, (seen.get(key) ?? new Set()).add(line.page));
  }
  const repeats = Math.max(2, Math.ceil(pages.length * 0.3));
  const pageNumber = (key: string) => /^(?:page )?#(?: (?:of|\/) #)?$/.test(key);
  const recurs = (key: string) => pages.length > 1 && (seen.get(key)?.size ?? 0) >= repeats;
  for (const [line, { cells, whole }] of shapes) {
    if (
      pageNumber(whole) ||
      recurs(whole) ||
      (cells.every((key) => pageNumber(key) || (/\p{L}/u.test(key) && recurs(key))) &&
        cells.filter(pageNumber).length <= 1)
    )
      drop.add(line);
  }

  // The body frame: where lines of body text start and end, ignoring the widest outliers.
  const body = lines.filter(
    (line) => Math.abs(line.size - bodySize) <= 0.6 && line.text.length > 30 && !drop.has(line),
  );
  if (body.length >= 10) {
    const starts = body.map((line) => line.x).sort((a, b) => a - b);
    const ends = body.map((line) => line.right).sort((a, b) => a - b);
    const frameLeft = starts[Math.floor(starts.length * 0.03)] ?? 0;
    const frameRight = ends[Math.ceil(ends.length * 0.97) - 1] ?? Number.POSITIVE_INFINITY;
    for (const line of lines) {
      // A float's caption may start in the margin a figure or table spans into.
      if ((line.right < frameLeft - 4 || line.x > frameRight + 4) && !FLOAT_LABEL.test(line.text))
        drop.add(line);
    }
  }
  return drop;
}

/** Lines grouped by page and column, each group in reading order. */
export function byColumn(lines: Line[]): Map<string, Line[]> {
  const groups = new Map<string, Line[]>();
  for (const line of lines) {
    const key = `${line.page}:${line.column}`;
    const group = groups.get(key);
    if (group) group.push(line);
    else groups.set(key, [line]);
  }
  return groups;
}

/** The pages' lines in reading order, furniture removed. */
export function layout(pages: Page[]): Layout {
  const bodySize = dominantSize(pages.flatMap((page) => page.runs));
  // The pages without a first-page margin column, which is split off before any gutter is sought.
  const bodyPages = [...pages];
  const cells = bodyPages.map((page) => rowCells(rows(page.runs)));
  const [first] = bodyPages;
  const margin = first && splitMargin(first, cells[0] ?? [], bodySize);
  if (margin) {
    bodyPages[0] = margin.page;
    cells[0] = rowCells(rows(margin.page.runs));
  }
  const splits = gutters(bodyPages, cells, bodySize);
  // The gutter is found from rows built across the page; with it known, they are rebuilt on each side.
  for (const [i, page] of bodyPages.entries()) {
    const split = splits[i];
    if (split !== undefined) cells[i] = rowCells(sideRows(page.runs, split));
  }
  const all = [
    ...(margin?.lines ?? []),
    ...bodyPages.flatMap((page, i) => pageLines(page, cells[i] ?? [], splits[i])),
  ];
  const drop = furniture(all, pages, bodySize);
  const lines = all.filter((line) => !drop.has(line) && line.text !== '');
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [a, b] = [lines[i - 1], lines[i]];
    if (
      a &&
      b &&
      a.page === b.page &&
      a.column === b.column &&
      Math.abs(a.size - bodySize) <= 0.6 &&
      Math.abs(b.size - bodySize) <= 0.6
    ) {
      const gap = a.y - b.y;
      if (gap > 0 && gap < bodySize * 3) gaps.push(gap);
    }
  }
  gaps.sort((a, b) => a - b);
  return { bodySize, lineGap: gaps[Math.floor(gaps.length / 2)] ?? bodySize * 1.2, lines };
}
