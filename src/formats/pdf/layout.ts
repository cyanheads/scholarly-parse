/**
 * @fileoverview Text runs → lines in reading order. Runs sharing a baseline form a row;
 * a row splits into cells at wide gaps, so two columns set side by side (or the cells of
 * a table) stay apart. Each page is tested for a two-column gutter, and lines are read
 * left column then right within each band between full-width lines. Running headers,
 * footers, page numbers, and margin text (a publisher sidebar, line numbers) are dropped.
 * @module src/formats/pdf/layout
 */
import { largest } from '../../model/extremes.js';
import type { Page, Run } from './load.js';

/** A line of text in one column: one cell for prose, several for a table row. */
export interface Line {
  bold: boolean;
  /** Cell texts left to right, as runs; a prose line has one. */
  cells: Run[][];
  /** Column index on a two-column page, `-1` for a line spanning the page. */
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

/** The size carrying the most characters. */
function dominantSize(runs: Run[]): number {
  const weight = new Map<number, number>();
  for (const run of runs)
    weight.set(half(run.size), (weight.get(half(run.size)) ?? 0) + run.text.length);
  return [...weight].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
}

/** Runs sharing a baseline: a superscript or subscript joins the line it sits on. */
function rows(runs: Run[]): Run[][] {
  const sorted = runs.toSorted((a, b) => b.y - a.y || a.x - b.x);
  const result: { base: Run; runs: Run[] }[] = [];
  for (const run of sorted) {
    const row = result.at(-1);
    if (row && Math.abs(row.base.y - run.y) <= 0.5 * Math.max(row.base.size, run.size)) {
      row.runs.push(run);
      if (run.size > row.base.size) row.base = run;
    } else {
      result.push({ base: run, runs: [run] });
    }
  }
  return result.map((row) => row.runs.sort((a, b) => a.x - b.x));
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
    bold: runs.every((run) => run.bold || run.text.trim() === ''),
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

/** A page's rows, each split into cells. */
function pageCells(page: Page): Run[][][] {
  return rows(page.runs).map(cellsOf);
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
      lines.push(...leftBand.filter(within), ...rightBand.filter(within));
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
 * Lines that are page furniture: a running header or footer (the same text in a page's
 * top or bottom margin on several pages), a bare page number, and text outside the
 * frame the body text occupies (a publisher sidebar, line numbers, a margin logo).
 */
function furniture(lines: Line[], pages: Page[], bodySize: number): Set<Line> {
  const drop = new Set<Line>();
  const heights = new Map(pages.map((page) => [page.number, page.height]));
  const inMargin = (line: Line) => {
    const height = heights.get(line.page) ?? 792;
    return line.y > height * 0.92 || line.y < height * 0.08;
  };
  const seen = new Map<string, Set<number>>();
  for (const line of lines.filter(inMargin)) {
    const key = shape(line.text);
    seen.set(key, (seen.get(key) ?? new Set()).add(line.page));
  }
  const repeats = Math.max(2, Math.ceil(pages.length * 0.3));
  for (const line of lines) {
    if (!inMargin(line)) continue;
    const key = shape(line.text);
    if (
      /^(?:page )?#(?: (?:of|\/) #)?$/.test(key) ||
      (seen.get(key)?.size ?? 0) >= Math.min(repeats, pages.length)
    )
      drop.add(line);
  }
  if (pages.length === 1)
    for (const line of lines) if (/^#$/.test(shape(line.text)) && inMargin(line)) drop.add(line);

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
  const cells = pages.map(pageCells);
  const splits = gutters(pages, cells, bodySize);
  const all = pages.flatMap((page, i) => pageLines(page, cells[i] ?? [], splits[i]));
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
