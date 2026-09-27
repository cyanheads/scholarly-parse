/**
 * @fileoverview A PDF reference list → `Reference[]`: entries split at their printed
 * numbers, else at a hanging or first-line indent, else at vertical gaps, with the DOI,
 * arXiv ID, or URL read from each entry's text.
 * @module src/formats/pdf/references
 */
import type { Reference } from '../../model/document.js';
import { doiInText } from '../../model/doi.js';
import { smallest } from '../../model/extremes.js';
import { joinLines, lineMarkdown } from './inline.js';
import { byColumn, type Layout, type Line } from './layout.js';
import { isCaptionStart } from './lines.js';

const NUMBERED_ENTRY =
  /^\s*(?:\[(\d{1,4})\]|(\d{1,4})[.)](?=\s|\p{Lu})|(\d{1,4})(?=\s+[\p{L}"“‘'(]))\s*/u;
const ARXIV = /arXiv[:\s]+(\d{4}\.\d{4,5})(?:v\d+)?/i;
const URL = /\bhttps?:\/\/[^\s<>"]+[^\s<>".,;)]/;

/**
 * Reference entries. Numbered lists split at their numbers; otherwise at a hanging
 * indent (continuation lines indented) or, failing both, at vertical gaps.
 */
export function references(lines: Line[], layout: Layout): Reference[] {
  const texts = lines.filter((line) => line.text.trim() && !isCaptionStart(line));
  if (texts.length === 0) return [];
  let starts = numberedStarts(texts);
  if (starts.size < 3) starts = indentStarts(texts);
  if (starts.size < 3) starts = gapStarts(texts, layout);

  const entries: Line[][] = [];
  for (const line of texts) {
    if (starts.has(line) || entries.length === 0) entries.push([line]);
    else entries.at(-1)?.push(line);
  }
  return entries.flatMap((entry, index) => {
    let text = joinLines(entry.map(lineMarkdown));
    const plain = joinLines(entry.map((line) => line.text));
    const numbered = NUMBERED_ENTRY.exec(text);
    const label = numbered ? (numbered[1] ?? numbered[2] ?? numbered[3]) : undefined;
    if (numbered) text = text.slice(numbered[0].length);
    if (!text) return [];
    const doi = doiInText(plain)?.toLowerCase();
    const arxiv = ARXIV.exec(plain)?.[1];
    const url = doi ? undefined : URL.exec(plain)?.[0];
    return [
      {
        label: label ?? String(index + 1),
        text,
        ...(doi && { doi }),
        ...(arxiv && { arxiv }),
        ...(url && { url }),
      },
    ];
  });
}

function numberedStarts(lines: Line[]): Set<Line> {
  const starts = new Set<Line>();
  let expected = 1;
  for (const line of lines) {
    const match = NUMBERED_ENTRY.exec(line.text);
    const number = match ? Number(match[1] ?? match[2] ?? match[3]) : Number.NaN;
    // One number may go unread (a line that starts oddly); the next one picks the run back up.
    if (
      number === expected ||
      number === expected + 1 ||
      (starts.size === 0 && number >= 1 && number <= 3)
    ) {
      starts.add(line);
      expected = number + 1;
    }
  }
  return starts;
}

/**
 * Entry starts marked by indentation: the lines at a column's left edge under a hanging
 * indent, or the indented lines where each entry's first line is indented instead.
 * Either way the starts are the smaller group, since most entries run over several lines.
 */
function indentStarts(lines: Line[]): Set<Line> {
  const atEdge = new Set<Line>();
  const indented = new Set<Line>();
  for (const group of byColumn(lines).values()) {
    const edge = smallest(group.map((line) => line.x));
    for (const line of group) {
      if (line.x <= edge + line.size * 0.4) atEdge.add(line);
      else if (line.x <= edge + line.size * 3) indented.add(line);
    }
  }
  const starts = indented.size < atEdge.size ? indented : atEdge;
  return starts.size >= lines.length * 0.2 ? starts : new Set();
}

function gapStarts(lines: Line[], layout: Layout): Set<Line> {
  const starts = new Set<Line>();
  lines.forEach((line, i) => {
    const previous = lines[i - 1];
    if (!previous || previous.page !== line.page || previous.column !== line.column) {
      if (!previous || /[.)]$/.test(previous.text.trim())) starts.add(line);
      return;
    }
    if (previous.y - line.y > Math.max(layout.lineGap, line.size * 1.15) * 1.3) starts.add(line);
  });
  return starts;
}
