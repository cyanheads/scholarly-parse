/**
 * @fileoverview `<table-wrap>` → `TableBlock`: rows of cell text by grid column, with
 * `colspan` and `rowspan` expanded so a well-formed table comes back rectangular.
 *
 * Only XHTML `<table>` bodies are read. Across a 283-table survey of open-access
 * records, 276 were XHTML, 7 graphic-only, and none used the CALS `<tgroup>` model, so
 * graphic-only and CALS bodies return the label and caption with an `unextractable`
 * reason rather than a second table model. (pubmed-mcp-server#111)
 * @module src/formats/jats/tables
 */
import type { TableBlock, TableUnextractableReason } from '../../model/document.js';
import {
  attrOf,
  childrenOf,
  findAll,
  findOne,
  tagNameOf,
  type XmlNode,
} from '../../xml/ordered.js';
import type { JatsContext } from './context.js';
import { inlineText } from './inline.js';
import { text } from './text.js';

/**
 * Widest grid a table row may occupy, and the ceiling every declared span is clamped
 * to. The widest real row observed is 15 columns; the cap turns `colspan="99999999"`
 * into a bounded row instead of an unbounded allocation.
 */
export const MAX_TABLE_COLUMNS = 512;

/** Parse one `<table-wrap>`. `caption` is rendered by the caller's caption rule. */
export function parseTableWrap(
  tableWrap: XmlNode,
  caption: string | undefined,
  ctx: JatsContext,
): TableBlock {
  const id = attrOf(tableWrap, 'id');
  const label = text(findOne(tableWrap, 'label')) || undefined;
  const footnotes = tableFootnotes(findOne(tableWrap, 'table-wrap-foot'), ctx);
  const table = findOne(tableWrap, 'table') ?? findOne(findOne(tableWrap, 'alternatives'), 'table');
  const { headerRows, rows } = table ? readTable(table, ctx) : { headerRows: 0, rows: [] };

  const block: TableBlock = {
    type: 'table',
    ...(id && { id }),
    ...(label && { label }),
    ...(caption && { caption }),
    headerRows,
    rows,
    ...(footnotes.length > 0 && { footnotes }),
  };
  if (rows.length === 0) {
    block.unextractable = classifyUnextractable(tableWrap, table);
    ctx.diag.warn(
      'table-unextractable',
      `Table ${label ?? id ?? ''} has no readable rows (${block.unextractable})`.replace('  ', ' '),
      id,
    );
  }
  return block;
}

/** A table with no wrapper (JATS `<array>`, or a bare `<table>`). */
export function parseBareTable(table: XmlNode, ctx: JatsContext): TableBlock {
  const { headerRows, rows } = readTable(table, ctx);
  return {
    type: 'table',
    headerRows,
    rows,
    ...(rows.length === 0 && { unextractable: 'no-rows' as const }),
  };
}

/** Each `<fn>` or `<p>` in a `<table-wrap-foot>`, with its label, as one footnote line. */
function tableFootnotes(foot: XmlNode | undefined, ctx: JatsContext): string[] {
  if (!foot) return [];
  const items: string[] = [];
  const visit = (node: XmlNode) => {
    for (const child of childrenOf(node)) {
      const tag = tagNameOf(child);
      if (tag === 'fn' || tag === 'p') {
        const label = text(findOne(child, 'label'));
        const body = inlineText(
          childrenOf(child).filter((c) => tagNameOf(c) !== 'label'),
          ctx,
        );
        const line = [label, body].filter(Boolean).join(' ');
        if (line) items.push(line);
      } else if (tag) {
        visit(child);
      }
    }
  };
  visit(foot);
  return items;
}

function classifyUnextractable(
  tableWrap: XmlNode,
  table: XmlNode | undefined,
): TableUnextractableReason {
  if (findOne(tableWrap, 'tgroup') || findOne(table, 'tgroup')) return 'cals-tgroup';
  if (findOne(tableWrap, 'graphic') || findOne(findOne(tableWrap, 'alternatives'), 'graphic')) {
    return 'graphic-only';
  }
  return 'no-rows';
}

/** A `colspan`/`rowspan` value clamped to the grid; anything unparseable is 1. */
function spanOf(cell: XmlNode, name: 'colspan' | 'rowspan'): number {
  const declared = Number.parseInt(attrOf(cell, name) ?? '', 10);
  if (!Number.isFinite(declared) || declared < 1) return 1;
  return Math.min(declared, MAX_TABLE_COLUMNS);
}

/** A cell still owed to the rows below it by a `rowspan`. */
interface RowspanCarry {
  remaining: number;
  value: string;
}

/**
 * Read an XHTML `<table>` into rows. A cell covering N columns fills N entries and one
 * covering M rows fills its column in the M−1 rows below, repeating its text: the value
 * belongs to each position it covers, and keeping the source cell count would put
 * values under the wrong headers. Header rows are those in `<thead>`, plus any leading
 * row of only `<th>` cells in a table without a `<thead>`.
 */
function readTable(table: XmlNode, ctx: JatsContext): { headerRows: number; rows: string[][] } {
  const parsed: { cells: string[]; header: boolean }[] = [];
  const carried: (RowspanCarry | undefined)[] = [];

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

  const pushRow = (tr: XmlNode, inHead: boolean) => {
    const row: string[] = [];
    let col = 0;
    let sourceCells = 0;
    let allHeaderCells = true;

    for (const cell of childrenOf(tr)) {
      const tag = tagNameOf(cell);
      if (tag !== 'td' && tag !== 'th') continue;
      if (tag === 'td') allHeaderCells = false;
      sourceCells += 1;
      col = drainCarried(row, col);
      const value = inlineText(cell, ctx);
      const rowspan = spanOf(cell, 'rowspan');
      const width = Math.min(spanOf(cell, 'colspan'), MAX_TABLE_COLUMNS - col);
      for (let i = 0; i < width; i++) {
        row[col] = value;
        if (rowspan > 1) carried[col] = { remaining: rowspan - 1, value };
        col += 1;
      }
    }

    // Carried cells past the last source cell still hold their columns.
    const rightmost = carried.reduce((last, carry, i) => (carry ? i : last), -1);
    while (col <= rightmost) col = carried[col] ? drainCarried(row, col) : col + 1;

    if (sourceCells === 0) return;
    for (let i = 0; i < row.length; i++) row[i] ??= '';
    parsed.push({ cells: row, header: inHead || allHeaderCells });
  };

  for (const child of childrenOf(table)) {
    const tag = tagNameOf(child);
    if (tag === 'tr') pushRow(child, false);
    else if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') {
      for (const tr of findAll(child, 'tr')) pushRow(tr, tag === 'thead');
    }
  }

  // A row the source left short still needs every column, or cells shift left under the
  // wrong headers when rendered.
  const width = Math.max(0, ...parsed.map((row) => row.cells.length));
  for (const row of parsed) while (row.cells.length < width) row.cells.push('');

  let headerRows = 0;
  while (parsed[headerRows]?.header) headerRows++;
  return { headerRows, rows: parsed.map((row) => row.cells) };
}
