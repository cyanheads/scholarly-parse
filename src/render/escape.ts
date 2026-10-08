/**
 * @fileoverview Escaping for text that came from a source document and is about to
 * become inline Markdown. The goal is text that reads naturally and cannot turn into
 * markup it never was: emphasis, links, math, strikethrough, or live HTML.
 *
 * Escaping is minimal on purpose. A backslash before every punctuation mark is valid
 * Markdown but unreadable to a person or a model, so each rule escapes only where the
 * character could start a construct.
 * @module src/render/escape
 */

import { largest } from '../model/extremes.js';
import { bareUrlEnd, bareUrlStarts } from './bare-url.js';
import { ESCAPABLE } from './scan.js';

/** ASCII punctuation CommonMark allows a backslash to escape. */
const ESCAPABLE_AFTER_BACKSLASH = /\\(?=[!-/:-@[-`{-~])/g;

/** A letter or digit ending the text before an underscore run. */
const ENDS_IN_LETTER_OR_DIGIT = /[\p{L}\p{N}]$/u;

/** A letter or digit starting the text after an underscore run. */
const STARTS_WITH_LETTER_OR_DIGIT = /^[\p{L}\p{N}]/u;

/**
 * Escape source text for use inside inline Markdown.
 *
 * - `\` before punctuation, `*`, `` ` ``, `$` (math delimiter), `~` (GFM strikethrough) — always.
 * - `_` — every one in a run that could delimit emphasis; a run with a letter or digit on
 *   both sides never can, so `snake_case`, `H_2`, and `foo__bar` stay readable.
 * - `](` — the sequence that would turn bracketed text into a link.
 * - `<` — only before a letter, `/`, `!`, or `?`, where it could open an HTML tag.
 * - `&` — only where it would read as an entity reference.
 * - A bare URL GFM would link (`https://…`, `www.…`) that holds or meets one of those
 *   escapes becomes an explicit link to the URL as the source has it, and text that only
 *   the escapes would make a URL links nothing ({@link bareUrlReader}).
 *
 * Readers join the escaped text of adjacent elements, so the text's end is closed as if
 * anything could follow it, as the `_` rule already does: a trailing `\` is doubled, and
 * a trailing `<`, `!` (an image's opener), or `&` with a partial entity name is escaped.
 * A `](` split across two pieces, and markup another piece writes after a bare URL, are
 * left to `joinInlineSeams`.
 *
 * Soft hyphens are dropped: they only mark where a word may break.
 */
export function escapeInline(text: string): string {
  return writeBareUrls(escapeText(text));
}

/**
 * {@link escapeInline} without its bare-URL rule, for link text: GFM links no bare URL
 * there, and an explicit link would nest inside the outer one.
 */
export function escapeText(text: string): string {
  return text
    .replace(/\u00AD/g, '')
    .replace(ESCAPABLE_AFTER_BACKSLASH, '\\\\')
    .replace(/\\$/, '\\\\')
    .replace(/[*`$~]/g, '\\$&')
    .replace(/_+/g, (run: string, at: number, whole: string) =>
      ENDS_IN_LETTER_OR_DIGIT.test(whole.slice(Math.max(0, at - 2), at)) &&
      STARTS_WITH_LETTER_OR_DIGIT.test(whole.slice(at + run.length, at + run.length + 2))
        ? run
        : run.replace(/_/g, '\\_'),
    )
    .replace(/\]\(/g, '\\](')
    .replace(/<(?=[A-Za-z/!?]|$)/g, '\\<')
    .replace(/!$/, '\\!')
    .replace(/&(?=#?[A-Za-z0-9]+;|#?[A-Za-z0-9]*$)/g, '\\&');
}

/** Where a bare URL can start. */
const BARE_URL_START = /https?:\/\/|www\./gi;

/** Escaped text with each bare URL in it written as {@link bareUrlReader} writes it, in one pass. */
function writeBareUrls(markdown: string): string {
  const bareUrlAt = bareUrlReader(markdown);
  let out = '';
  let at = 0;
  const start = new RegExp(BARE_URL_START);
  for (let found = start.exec(markdown); found; found = start.exec(markdown)) {
    const url = bareUrlAt(found.index);
    if (!url) continue;
    out += markdown.slice(at, found.index) + url.written;
    at = start.lastIndex = url.end;
  }
  return out + markdown.slice(at);
}

/** Markup this package writes that GFM reads as part of a bare URL it touches. */
const MARKUP = new Set(['*', '~', '$', '`']);

const SPACE = /^\s$/;

/** A bare URL in Markdown and how to write it: what ends there is the same text. */
export interface BareUrl {
  end: number;
  written: string;
}

/**
 * A reader of the bare URLs GFM links in `markdown`: given where one may start, whether it
 * does, where it ends, and how to write it. One that holds a backslash escape or markup
 * this package writes (an emphasis marker, a math or code delimiter, or the `[` of a link,
 * at one of `linkOpeners`) is written as an explicit link to the URL GFM would link in the
 * text as the source has it — its escapes undone, up to the first marker — and ends there:
 * an autolink, or for a `www.` URL a link that keeps its text. Any other bare URL is
 * written as it is, to the end GFM gives it. Asked in ascending order, it reads each
 * stretch of the text a bounded number of times.
 */
export function bareUrlReader(
  markdown: string,
  linkOpeners: ReadonlySet<number> = new Set(),
): (start: number) => BareUrl | undefined {
  /** The stretch last searched for markup: from where, and the markup, space, or `<` that ends it. */
  let searchedFrom = -1;
  let markupAt = -1;
  const firstMarkup = (start: number): number => {
    if (start < searchedFrom || start > markupAt) {
      searchedFrom = markupAt = start;
      for (let c = markdown.charAt(markupAt); c && c !== '<' && !SPACE.test(c); ) {
        if (MARKUP.has(c) || linkOpeners.has(markupAt)) break;
        if (c === '\\' && ESCAPABLE.test(markdown.charAt(markupAt + 1))) break;
        c = markdown.charAt(++markupAt);
      }
    }
    return markupAt;
  };
  /**
   * The stretch last read as the source has it, and where each of its characters starts in
   * `markdown`. A URL starting later in the same stretch reads the rest of it, so the
   * stretch is read once.
   */
  let stretch: { at: Map<number, number>; from: number[]; source: string } | undefined;
  const sourceFrom = (start: number) => {
    let offset = stretch?.at.get(start);
    if (!stretch || offset === undefined) {
      const { from, source } = sourceUrl(markdown, start, linkOpeners);
      stretch = { at: new Map(from.map((position, index) => [position, index])), from, source };
      offset = 0;
    }
    return { offset, ...stretch };
  };
  return (start) => {
    if (!bareUrlStarts(markdown, start)) return;
    const limit = firstMarkup(start);
    const end = bareUrlEnd(markdown, start, limit);
    if (end === -1) return;
    if (end <= limit) return { end, written: markdown.slice(start, end) };
    const { from, offset, source } = sourceFrom(start);
    const urlEnd = bareUrlEnd(source, offset);
    if (urlEnd === -1) return unlinked(markdown, start);
    const url = source.slice(offset, urlEnd);
    // GFM links a `www.` URL whose dot it gives back as `www` alone.
    const written = /^https?:/i.test(url)
      ? `<${escapeAutolink(url)}>`
      : `[${wwwLinkText(url)}](http://${escapeUrl(url)})`;
    return {
      end: from[urlEnd] ?? start,
      // A backslash the text has before the link would escape its `<`.
      written: oddBackslashesBefore(markdown, start) ? `\\${written}` : written,
    };
  };
}

/**
 * A bare URL that only the escapes make one (a `_` escaped in the domain's last two
 * segments, where GFM accepts none) written with its scheme's `:` or its `www.` dot
 * escaped, so GFM links nothing there, and ending past that character.
 */
function unlinked(markdown: string, start: number): BareUrl {
  const at = markdown.indexOf(/^www\./i.test(markdown.slice(start, start + 4)) ? '.' : ':', start);
  return { end: at + 1, written: `${markdown.slice(start, at)}\\${markdown.charAt(at)}` };
}

/** True when an odd run of backslashes ends right before `at`: the last one escapes what follows. */
export function oddBackslashesBefore(markdown: string, at: number): boolean {
  let backslashes = 0;
  while (markdown.charAt(at - 1 - backslashes) === '\\') backslashes++;
  return backslashes % 2 === 1;
}

/**
 * The text of the bare URL at `start` as the source has it: escapes undone, up to a
 * marker, a link's `[` (one of `linkOpeners`), a space, an angle bracket (which an
 * autolink cannot hold as written), or a `](` or `][` (where the URL ends whatever
 * follows), with where in `markdown` each character came from, and where the text stops
 * last.
 */
function sourceUrl(
  markdown: string,
  start: number,
  linkOpeners: ReadonlySet<number>,
): { from: number[]; source: string } {
  let source = '';
  const from: number[] = [];
  let at = start;
  for (;;) {
    const escaped = markdown.charAt(at) === '\\' && ESCAPABLE.test(markdown.charAt(at + 1));
    const next = at + (escaped ? 1 : 0);
    const char = markdown.charAt(next);
    const after = markdown.charAt(next + 1);
    if (!char || char === '<' || char === '>' || SPACE.test(char)) break;
    if (!escaped && (MARKUP.has(char) || linkOpeners.has(next))) break;
    if (char === ']' && (after === '(' || after === '[')) break;
    from.push(at);
    source += char;
    at = next + 1;
  }
  from.push(at);
  return { from, source };
}

/** A `www.` URL escaped as link text, every bracket escaped so the link's own enclose it. */
function wwwLinkText(url: string): string {
  return escapeText(url).replace(/\\[\s\S]|[[\]]/g, (m) => (m.length === 2 ? m : `\\${m}`));
}

/**
 * Escape a character sequence that would change meaning at the start of a block:
 * an ATX heading, a quote, a list marker (alone on the line too, where it would open an
 * empty item), a tilde code fence, a thematic break, a table row, or a link
 * reference definition, whose label holds no unescaped bracket (a `[` before a link's
 * text that holds `]:` opens no definition, and escaping it would break the link).
 */
export function escapeBlockStart(text: string): string {
  return text
    .replace(/^(#{1,6})(?=\s|$)/, '\\$1')
    .replace(/^([>|]|~(?=~~))/, '\\$1')
    .replace(/^([-+*])(?=\s|$)/, '\\$1')
    .replace(/^(\d{1,9})([.)])(?=\s|$)/, '$1\\$2')
    .replace(/^(=+|-{3,})\s*$/, '\\$1')
    .replace(/^\[(?=(?:\\[\s\S]|[^\\[\]])*\]:)/, '\\[');
}

/**
 * Keep TeX from reading as markup where a Markdown renderer without math support treats
 * it as ordinary text: a `<` that could open an HTML tag and a `](` that could open a link
 * get a space between them, which math mode ignores, and a backtick, which could open a
 * code span, is written `\grave{}` (the accent command `` \` `` as `\grave`), which both
 * KaTeX and MathJax list. For TeX between `$…$` (`inline`), what would end the delimiters
 * early is closed too: a `$` is escaped, and a trailing backslash, which would escape the
 * closing `$`, becomes a control space. Every backslash run is read once.
 */
export function escapeTex(tex: string, { inline = false }: { inline?: boolean } = {}): string {
  const escaped = tex
    .replace(/\\+|[`$]/g, (match, at: number, whole: string) => {
      if (match.startsWith('\\')) {
        // An odd run escapes the character after it: `` \` `` is the grave accent.
        return match.length % 2 === 1 && whole.charAt(at + match.length) === '`'
          ? `${match.slice(0, -1)}\\grave `
          : match;
      }
      const escapedBefore = countBackslashesBefore(whole, at) % 2 === 1;
      if (match === '`') return escapedBefore ? '' : '\\grave{}';
      return inline && !escapedBefore ? `\\${match}` : match;
    })
    .replace(/<(?=[A-Za-z/!?])/g, '< ')
    .replace(/\]\(/g, '] (');
  return inline && countBackslashesBefore(escaped, escaped.length) % 2 === 1
    ? `${escaped} `
    : escaped;
}

/** How many backslashes come right before `at`. */
function countBackslashesBefore(text: string, at: number): number {
  let backslashes = 0;
  while (text.charAt(at - 1 - backslashes) === '\\') backslashes++;
  return backslashes;
}

/** Escape a value for a GFM table cell: pipes and line breaks would break the row. */
export function escapeTableCell(text: string): string {
  return foldLineBreaks(text.replace(/\|/g, '\\|'));
}

/**
 * Each whitespace run holding a line break folded to one space, in one pass: `\s*\n\s*`
 * rescans a long run of spaces from every position in it.
 */
export function foldLineBreaks(text: string): string {
  return text.replace(/\s+/g, (run) => (run.includes('\n') ? ' ' : run));
}

/** The shortest backtick fence that no run of backticks inside `text` can close. */
export function codeFence(text: string, minimum = 3): string {
  const longest = Math.max(0, largest([...text.matchAll(/`+/g)].map((m) => m[0].length)));
  return '`'.repeat(Math.max(minimum, longest + 1));
}

/** Wrap text as an inline code span that no backtick inside it can close. */
export function codeSpan(text: string): string {
  const fence = codeFence(text, 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** URL schemes a rendered link may carry. Anything else stays plain text. */
const SAFE_URL = /^(?:https?|ftp|mailto):/i;

/** True when `url` is safe to emit as a Markdown link target. */
export function isSafeUrl(url: string): boolean {
  return SAFE_URL.test(url.trim());
}

/**
 * Escape a URL for use as an autolink's target, `<…>`: whitespace, control characters,
 * and angle brackets, which an autolink cannot hold, are percent-encoded. Parentheses are
 * left as written.
 */
export function escapeAutolink(url: string): string {
  return url.trim().replace(/[\p{Cc}\s<>]/gu, encodeURIComponent);
}

/** Parentheses, which `encodeURIComponent` leaves as they are. */
const PARENTHESES: Readonly<Record<string, string>> = { '(': '%28', ')': '%29' };

/**
 * Escape a URL for use as a Markdown link destination, so the destination holds the URL as
 * written: whitespace, angle brackets, parentheses (an unbalanced one ends the destination),
 * and backticks (one could open a code span across the link) are percent-encoded; a
 * backslash before punctuation or at the end, an `&` that would read as a character
 * reference, and a `$` (which the readers of inline math would pair with another) are
 * escaped.
 */
export function escapeUrl(url: string): string {
  return url
    .trim()
    .replace(/[\s()<>`]/g, (c) => PARENTHESES[c] ?? encodeURIComponent(c))
    .replace(/\\(?=[!-/:-@[-`{-~]|$)/g, '\\\\')
    .replace(/&(?=#?[A-Za-z0-9]+;)/g, '\\&')
    .replace(/\$/g, '\\$');
}
