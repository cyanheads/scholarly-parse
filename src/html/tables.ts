/**
 * @fileoverview An HTML table — `<table>` markup, or LaTeXML's `<span>`-based tabular —
 * read into the shared grid. Rows of a table nested inside a cell belong to that cell's
 * text, not to the outer table.
 * @module src/html/tables
 */
import { buildGrid, type SourceRow, spanValue } from '../model/table-grid.js';
import { childElements, hasClass, tagOf } from './dom.js';

const SECTION_TAGS = new Set(['thead', 'tbody', 'tfoot']);
const SECTION_CLASSES = ['ltx_thead', 'ltx_tbody', 'ltx_tfoot'];

function isRow(element: Element): boolean {
  return tagOf(element) === 'tr' || hasClass(element, 'ltx_tr');
}

function isCell(element: Element): boolean {
  const tag = tagOf(element);
  return tag === 'td' || tag === 'th' || hasClass(element, 'ltx_td');
}

function isHead(element: Element): boolean {
  return tagOf(element) === 'thead' || hasClass(element, 'ltx_thead');
}

/** A cell whose whole text is bold Markdown (`**Model**`, `**Active** **Params**`). */
function isBoldText(text: string): boolean {
  return /^\*\*[^*]+\*\*(?:\s*\*\*[^*]+\*\*)*$/.test(text);
}

/**
 * Read a table into a grid; `cellText` renders one cell's content. With `boldHeaders`,
 * a cell whose text is entirely bold counts as a header cell, so a leading all-bold row
 * becomes the header: LaTeX tables mark their header row that way, with no `<th>`.
 */
export function readHtmlTable(
  table: Element,
  cellText: (cell: Element) => string,
  options: { boldHeaders?: boolean } = {},
): { headerRows: number; rows: string[][] } {
  const rows: SourceRow[] = [];
  const collect = (container: Element, inHead: boolean) => {
    for (const child of childElements(container)) {
      if (isRow(child)) {
        const cells = childElements(child)
          .filter(isCell)
          .map((cell) => {
            const text = cellText(cell);
            const markedHeader = tagOf(cell) === 'th' || hasClass(cell, 'ltx_th');
            return {
              colspan: spanValue(cell.getAttribute('colspan')),
              header:
                markedHeader || (options.boldHeaders === true && (text === '' || isBoldText(text))),
              rowspan: spanValue(cell.getAttribute('rowspan')),
              text,
            };
          });
        // An all-empty row is not a header, however its cells are marked.
        if (cells.every((cell) => cell.text === '')) for (const cell of cells) cell.header = false;
        rows.push({ cells, inHead });
      } else if (
        SECTION_TAGS.has(tagOf(child)) ||
        SECTION_CLASSES.some((c) => hasClass(child, c))
      ) {
        collect(child, inHead || isHead(child));
      }
    }
  };
  collect(table, false);
  return buildGrid(rows);
}
