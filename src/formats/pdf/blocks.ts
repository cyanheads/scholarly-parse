/**
 * @fileoverview A section's lines as typed blocks: paragraphs split at spacing and
 * indentation, captioned figures and tables (rows read from the lines of several cells
 * beside the caption, aligned into columns), and display equations.
 * @module src/formats/pdf/blocks
 */
import type { Block, FigureBlock, TableBlock } from '../../model/document.js';
import { largest } from '../../model/extremes.js';
import { type GridBudget, truncatedGridMessage } from '../../model/table-grid.js';
import type { PdfContext } from './context.js';
import { cellMarkdown, joinLines, lineMarkdown } from './inline.js';
import type { Layout, Line } from './layout.js';
import { CAPTION_START, formulaOf, isCaptionStart } from './lines.js';
import type { Run } from './load.js';

/**
 * A section's lines as blocks: paragraphs, captioned figures and tables, and formulas.
 * `textSize` is the size its running text is set in: the body's, or an abstract's own.
 */
export function flow(
  lines: Line[],
  layout: Layout,
  ctx: PdfContext,
  textSize = layout.bodySize,
): Block[] {
  const { lineGap } = layout;
  const tables = tableRows(lines, lineGap);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let previous: Line | undefined;
  const flush = () => {
    const text = joinLines(paragraph);
    if (text) blocks.push({ text, type: 'paragraph' });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as Line;
    if (tables.claimed.has(line)) {
      previous = undefined;
      continue;
    }
    if (isCaptionStart(line)) {
      flush();
      const caption: Line[] = [line];
      while (i + 1 < lines.length && continuesCaption(lines[i + 1] as Line, caption, lineGap))
        caption.push(lines[++i] as Line);
      const block = captionBlock(caption);
      const rows = tables.rows.get(line) ?? [];
      if (block.type === 'table' && rows.length > 0) {
        const grid = tableGrid(rows, ctx.gridBudget);
        if (grid.truncated) {
          const message = truncatedGridMessage(block.label ?? 'Table');
          ctx.diag.warn('truncated-input', message, `page ${line.page}`);
        }
        if (grid.rows.length > 0) {
          block.rows = grid.rows;
          // A bold first row is the header.
          block.headerRows = rows[0]?.cells.flat().every((run) => run.bold || !run.text.trim())
            ? 1
            : 0;
          delete block.unextractable;
        }
      }
      blocks.push(block);
      previous = undefined;
      continue;
    }
    const formula = formulaOf(line);
    if (formula) {
      flush();
      blocks.push({ type: 'formula', ...formula });
      previous = undefined;
      continue;
    }
    // Text smaller than the running text, outside a caption, is figure lettering or a footnote;
    // a line without a letter or digit (a stray degree sign) is not prose either.
    if (line.size < textSize * 0.85 || line.cells.length > 2 || !/[\p{L}\p{N}]/u.test(line.text)) {
      previous = undefined;
      continue;
    }
    if (previous && startsParagraph(line, previous, lineGap)) flush();
    paragraph.push(lineMarkdown(line));
    previous = line;
  }
  flush();

  // A paragraph a figure or table interrupted mid-sentence goes on after it.
  for (let k = 0; k < blocks.length; k++) {
    const before = blocks[k];
    if (before?.type !== 'paragraph' || /[.!?:]["”’)]?$/.test(before.text)) continue;
    let next = k + 1;
    while (blocks[next]?.type === 'figure' || blocks[next]?.type === 'table') next++;
    const after = blocks[next];
    if (next > k + 1 && after?.type === 'paragraph' && /^\p{Ll}/u.test(after.text)) {
      before.text = joinLines([before.text, after.text]);
      blocks.splice(next, 1);
      k--;
    }
  }
  return blocks;
}

/** A table row's cells split at every gap wider than a word space: numeric columns sit closer than prose columns. */
function rowCells(row: Line): Run[][] {
  return row.cells.flatMap((cell) => {
    const parts: Run[][] = [];
    for (const run of cell) {
      const last = parts.at(-1)?.at(-1);
      if (last && run.x - (last.x + last.width) <= 0.45 * Math.min(run.size, last.size))
        parts.at(-1)?.push(run);
      else parts.push([run]);
    }
    return parts;
  });
}

/**
 * Table rows as a grid, charged to the document's `budget`. Columns are the horizontal
 * spans the cells of the fuller rows cover; each cell lands in the column it overlaps, or
 * else the nearest one left of it, so a row with an empty cell or a spanning header keeps
 * the others under their headings. Every row is as wide as the columns, so the grid can
 * outgrow its text many times over: rows are kept in order while it fits the cells left.
 */
function tableGrid(rows: Line[], budget: GridBudget): { rows: string[][]; truncated: boolean } {
  const split = rows.map(rowCells);
  const extent = (cell: Run[]): [number, number] => [
    cell[0]?.x ?? 0,
    largest(cell.map((run) => run.x + run.width)),
  ];
  const counts = split.map((cells) => cells.length).sort((a, b) => a - b);
  const typical = counts[Math.floor(counts.length / 2)] ?? 0;
  const spans: [number, number][] = [];
  for (const [left, right] of split
    .filter((cells) => cells.length >= typical)
    .flatMap((cells) => cells.map(extent))
    .sort((a, b) => a[0] - b[0])) {
    const last = spans.at(-1);
    if (last && left <= last[1] + 1) last[1] = Math.max(last[1], right);
    else spans.push([left, right]);
  }
  const kept = Math.min(split.length, Math.floor(budget.cells / spans.length));
  budget.cells -= kept * spans.length;
  const grid = split.slice(0, kept).map((cells, k) => {
    const out = Array<string>(spans.length).fill('');
    for (const cell of cells) {
      const column = columnOf(spans, ...extent(cell));
      const text = cellMarkdown(cell, rows[k] as Line);
      out[column] = out[column] ? `${out[column]} ${text}` : text;
    }
    return out;
  });
  return { rows: grid, truncated: kept < split.length };
}

/**
 * The column of a cell from `left` to `right`: the first span it overlaps, else the last
 * span starting left of it, else the first. The spans are ordered and apart, so the span
 * that settles it is the first ending at or after `left`, found by bisection.
 */
function columnOf(spans: [number, number][], left: number, right: number): number {
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((spans[middle]?.[1] ?? 0) < left) low = middle + 1;
    else high = middle;
  }
  return (spans[low]?.[0] ?? Number.POSITIVE_INFINITY) <= right ? low : Math.max(0, low - 1);
}

/**
 * Each table caption's rows: the lines of several cells after it or, for a caption set
 * below its table, right before it on the same page.
 */
function tableRows(
  lines: Line[],
  lineGap: number,
): { claimed: Set<Line>; rows: Map<Line, Line[]> } {
  const claimed = new Set<Line>();
  const rows = new Map<Line, Line[]>();
  const multiCell = (line: Line | undefined): line is Line =>
    !!line && line.cells.length > 1 && !claimed.has(line);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as Line;
    if (
      !isCaptionStart(line) ||
      !/^(?:Supplementary\s+)?Table/i.test(CAPTION_START.exec(line.text)?.[1] ?? '')
    )
      continue;
    const caption = [line];
    let end = i;
    while (end + 1 < lines.length && continuesCaption(lines[end + 1] as Line, caption, lineGap))
      caption.push(lines[++end] as Line);
    const found: Line[] = [];
    for (let j = end + 1; multiCell(lines[j]); j++) found.push(lines[j] as Line);
    if (found.length === 0) {
      for (let j = i - 1; multiCell(lines[j]) && lines[j]?.page === line.page; j--)
        found.unshift(lines[j] as Line);
    }
    for (const row of found) claimed.add(row);
    rows.set(line, found);
  }
  return { claimed, rows };
}

/** Whether `line` goes on with the caption so far. A label set alone on its line runs into text of another size or column width. */
function continuesCaption(line: Line, caption: Line[], lineGap: number): boolean {
  const last = caption.at(-1) as Line;
  const labelOnly =
    caption.length === 1 && CAPTION_START.exec(last.text)?.[0].length === last.text.length;
  if (line.page !== last.page || isCaptionStart(line) || line.cells.length > 1) return false;
  if (
    labelOnly
      ? Math.abs(line.x - last.x) > 4
      : line.column !== last.column || Math.abs(line.size - last.size) > 0.6
  )
    return false;
  return last.y - line.y <= Math.max(lineGap, last.size * 1.2, line.size * 1.2) * 1.45;
}

function captionBlock(lines: Line[]): FigureBlock | TableBlock {
  const [first = '', ...rest] = lines.map(lineMarkdown);
  const match = CAPTION_START.exec(first);
  const label = match?.[1]?.replace(/\s+/g, ' ');
  const caption = joinLines([match ? first.slice(match[0].length) : first, ...rest]);
  if (label && /^(?:Supplementary\s+)?Table/i.test(label)) {
    return {
      type: 'table',
      label,
      ...(caption && { caption }),
      headerRows: 0,
      rows: [],
      unextractable: 'no-rows',
    };
  }
  return { type: 'figure', ...(label && { label }), ...(caption && { caption }) };
}

/** A new paragraph starts after vertical space, at an indented first line, or after a short line that ends a sentence. */
function startsParagraph(line: Line, previous: Line, lineGap: number): boolean {
  if (line.page !== previous.page || line.column !== previous.column) {
    return /[.!?:]["”’)]?$/.test(previous.text) && /^\p{Lu}/u.test(line.text);
  }
  const gap = previous.y - line.y;
  if (gap > lineGap * 1.45 || gap < 0) return true;
  if (line.x > previous.x + line.size * 0.8 && /[.!?:]["”’)]?$/.test(previous.text)) return true;
  return false;
}
