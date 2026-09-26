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
import { buildGrid, type SourceRow, spanValue } from '../../model/table-grid.js';
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
    // A label usually names the table itself ("Table 2"); a bare number does not.
    const name = label && /^\p{L}/u.test(label) ? label : `Table ${label ?? id ?? ''}`.trim();
    ctx.diag.warn(
      'table-unextractable',
      `${name} has no readable rows (${block.unextractable})`,
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

/**
 * Read an XHTML `<table>` into the shared grid, spans expanded and short rows padded.
 * Header rows are those in `<thead>`, plus any leading row of only `<th>` cells in a
 * table without a `<thead>`.
 */
function readTable(table: XmlNode, ctx: JatsContext): { headerRows: number; rows: string[][] } {
  const sourceRow = (tr: XmlNode, inHead: boolean): SourceRow => ({
    cells: childrenOf(tr).flatMap((cell) => {
      const tag = tagNameOf(cell);
      if (tag !== 'td' && tag !== 'th') return [];
      return [
        {
          colspan: spanValue(attrOf(cell, 'colspan')),
          header: tag === 'th',
          rowspan: spanValue(attrOf(cell, 'rowspan')),
          text: inlineText(cell, ctx),
        },
      ];
    }),
    inHead,
  });
  const rows: SourceRow[] = [];
  for (const child of childrenOf(table)) {
    const tag = tagNameOf(child);
    if (tag === 'tr') rows.push(sourceRow(child, false));
    else if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') {
      for (const tr of findAll(child, 'tr')) rows.push(sourceRow(tr, tag === 'thead'));
    }
  }
  return buildGrid(rows);
}
