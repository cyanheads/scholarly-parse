/**
 * @fileoverview What a PDF line is, read from its text and type: a heading and how
 * sure that is, a caption's first line, a figure's panel label, a display equation.
 * @module src/formats/pdf/lines
 */
import { cellText, type Line } from './layout.js';

/** Headings a paper commonly uses, matched after any numbering is removed. */
const KNOWN_HEADING =
  /^(?:abstract|summary|introduction|background(?: (?:&|and) summary)?|case (?:presentation|description)|data records|technical validation|usage notes|related work|preliminaries|methods?|materials and methods|methodology|experiments?|experimental (?:setup|section|results)|results(?: and discussion)?|discussion|conclusions?|conclusions? and future work|limitations|acknowledge?ments?|references|bibliography|literature cited|appendix(?: [a-z])?|appendices|supplementary (?:material|information)|data availability(?: statement)?|code availability|funding|author contributions|competing interests|conflicts? of interest|declarations|ethics(?: statement)?|abbreviations)$/i;

export const REFERENCES_HEADING =
  /^(?:references?(?: cited)?|bibliography|literature cited|works cited|reference list)$/i;
export const ABSTRACT_HEADING = /^(?:abstract|summary)$/i;
export const ABSTRACT_RUN_IN = /^(?:abstract|summary)\b\s*[.:—–-]?\s*(?=\S)/i;
export const KEYWORDS_LINE = /^(?:key\s?words?|index terms)\b\s*[.:—–-]?\s*/i;

/** A caption's label at the start of a line: `Figure 3.`, `Fig. 2:`, `Table S1 |`. */
export const CAPTION_START =
  /^((?:Supplementary\s+|Extended\s+Data\s+)?(?:Fig(?:ure)?s?|FIG(?:URE)?S?|Table|TABLE|Scheme|Chart|Box)\.?\s*S?\d+[A-Za-z]?)\s*(?:[.:|—–]\s*|\s+(?=\p{Lu})|$)/u;

/** A printed section number: `1`, `2.1`, `IV.`, `B.` (the last two as IEEE sets them). */
export function stripNumber(text: string): string {
  return text
    .replace(/^(?:\d{1,2}\.)*\d{1,2}\.?\s+/, '')
    .replace(/^(?:[IVX]{1,4}|[A-H])\.\s+/, '')
    .trim();
}

/** A heading's text without its number or closing colon, as its name is matched. */
export function bareTitle(text: string): string {
  return stripNumber(text).replace(/[.:]$/, '');
}

export function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function isCaptionStart(line: Line): boolean {
  const match = CAPTION_START.exec(line.text);
  if (!match) return false;
  // "Table 2 shows…" wrapped onto a line start is prose; a caption's label is bold, punctuated, or on its own line.
  const labelRuns = line.cells[0]?.filter((run) => run.text.trim()) ?? [];
  // A punctuated label goes on with its caption; alone on its line a label carries no full stop:
  // "FIGURE 1" is a label, a sentence ending "…in Table 2." wrapped onto its own line is prose.
  const alone = match[0].length === line.text.length;
  return (
    labelRuns[0]?.bold === true ||
    (/[.:|—–]\s*$/.test(match[0]) && !alone) ||
    (alone && !/\.$/.test(line.text))
  );
}

/** The letter of a one-letter panel label opening a line: `A)`, `(b)`. */
function panelLetter(text: string): string | undefined {
  return /^\(?(\p{L})\)(?:\s|$)/u.exec(text.trim())?.[1];
}

/**
 * Whether a line opens with a figure's panel label: a one-letter label (`A)`, `(A)`) whose
 * next line opens with the next letter's label or starts a caption. A lettered subsection
 * heading (`(a) Background`) goes on with prose instead.
 */
export function isPanelLabel(line: Line, next: Line | undefined): boolean {
  const letter = panelLetter(line.text);
  if (!letter || !next) return false;
  const following = panelLetter(next.text)?.codePointAt(0);
  return following === (letter.codePointAt(0) ?? 0) + 1 || isCaptionStart(next);
}

export interface HeadingStyle {
  bold: boolean;
  /** A bold label opening a paragraph, ranked below a heading on a line of its own. */
  runIn?: boolean;
  size: number;
  /** Set in capitals, ranked above the same style in mixed case. */
  upper: boolean;
}

export function styleOf(line: Line, text: string): HeadingStyle {
  const bare = stripNumber(text);
  return {
    bold: line.bold,
    size: line.size,
    upper: bare === bare.toUpperCase() && /\p{Lu}{3}/u.test(bare),
  };
}

export interface Heading {
  depth?: number;
  /** Numbered, or a name papers use for their sections: enough to end the front matter. */
  strong: boolean;
}

/** Whether a line reads as a heading, and its level when numbering says. */
export function headingOf(line: Line, bodySize: number): Heading | undefined {
  const text = line.text.trim();
  if (!text || text.length > 160 || words(text) > 18 || /[,;]$/.test(text) || isCaptionStart(line))
    return;
  if (line.cells.length > 1 || line.math > 0.3) return;
  const bare = bareTitle(text);
  const known = KNOWN_HEADING.test(bare) && words(bare) <= 6;
  // A panel label ("B)") or a fragment starting in lower case is figure lettering, not a heading.
  if ((bare.match(/\p{L}/gu)?.length ?? 0) < 2 || (/^\p{Ll}/u.test(bare) && !known)) return;
  const numbered = /^((?:\d{1,2}\.)*\d{1,2})\.?\s+\p{Lu}/u.exec(text);
  const roman = /^[IVX]{1,4}\.\s+\p{Lu}/u.test(text);
  const big = line.size >= bodySize + 0.9 && line.size <= bodySize * 2.6;
  const bold = line.bold && line.size >= bodySize - 0.3;
  const upper = bare === bare.toUpperCase() && /\p{Lu}{3}/u.test(bare);
  const terminal = /[.!?]$/.test(text) && !known;
  const heading = () => ({
    strong: known || !!numbered || roman,
    ...(numbered?.[1] ? { depth: numbered[1].split('.').length } : roman && { depth: 1 }),
  });
  if (big && !terminal) return heading();
  if (bold && (numbered || roman || known || words(text) <= 12) && !(terminal && words(text) > 8))
    return heading();
  if (known && (upper || numbered || roman || words(text) === words(bare))) return heading();
  const italic = line.cells.flat().every((run) => run.italic || !run.text.trim());
  if ((numbered || roman) && (upper || italic)) return heading();
  return;
}

/** A display equation: mostly math-font text, or anything ending in a right-set `(3)`. */
export function formulaOf(line: Line): { label?: string; text: string } | undefined {
  const last = line.cells.at(-1);
  const numbered =
    last && line.cells.length > 1 ? /^\((\d+[a-z]?)\)$/.exec(cellText(last))?.[1] : undefined;
  if (line.math < 0.5 && !(numbered && line.math > 0.2)) return;
  let text = (numbered ? line.cells.slice(0, -1) : line.cells)
    .map(cellText)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  // The number may sit in the same cell as the equation when the gap before it is narrow.
  const trailing = numbered ? undefined : /\s\((\d+[a-z]?)\)$/.exec(text);
  if (trailing) text = text.slice(0, trailing.index).trim();
  const label = numbered ?? trailing?.[1];
  // Punctuation closing a numbered equation belongs to the sentence around it.
  if (label) text = text.replace(/\s*[,.:;]$/, '');
  return text ? { text, ...(label && { label }) } : undefined;
}
