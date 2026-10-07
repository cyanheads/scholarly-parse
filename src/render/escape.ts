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

/** ASCII punctuation CommonMark allows a backslash to escape. */
const ESCAPABLE_AFTER_BACKSLASH = /\\(?=[!-/:-@[-`{-~])/g;

/**
 * Escape source text for use inside inline Markdown.
 *
 * - `\` before punctuation, `*`, `` ` ``, `$` (math delimiter), `~` (GFM strikethrough) — always.
 * - `_` — only where it could delimit emphasis, so `snake_case` and `H_2` stay readable.
 * - `](` — the sequence that would turn bracketed text into a link.
 * - `<` — only before a letter, `/`, `!`, or `?`, where it could open an HTML tag.
 * - `&` — only where it would read as an entity reference.
 *
 * Readers join the escaped text of adjacent elements, so the text's end is closed as if
 * anything could follow it, as the `_` rule already does: a trailing `\` is doubled, and
 * a trailing `<`, `!` (an image's opener), or `&` with a partial entity name is escaped.
 * A `](` split across two pieces is left to `joinInlineSeams`.
 *
 * Soft hyphens are dropped: they only mark where a word may break.
 */
export function escapeInline(text: string): string {
  return text
    .replace(/\u00AD/g, '')
    .replace(ESCAPABLE_AFTER_BACKSLASH, '\\\\')
    .replace(/\\$/, '\\\\')
    .replace(/[*`$~]/g, '\\$&')
    .replace(/(^|[^\p{L}\p{N}])_|_(?=$|[^\p{L}\p{N}])/gu, (match) => match.replace('_', '\\_'))
    .replace(/\]\(/g, '\\](')
    .replace(/<(?=[A-Za-z/!?]|$)/g, '\\<')
    .replace(/!$/, '\\!')
    .replace(/&(?=#?[A-Za-z0-9]+;|#?[A-Za-z0-9]*$)/g, '\\&');
}

/**
 * Escape a character sequence that would change meaning at the start of a block:
 * an ATX heading, a quote, a list marker, a thematic break, a table row, or a link
 * reference definition.
 */
export function escapeBlockStart(text: string): string {
  return text
    .replace(/^(#{1,6})(?=\s|$)/, '\\$1')
    .replace(/^([>|])/, '\\$1')
    .replace(/^([-+])(?=\s)/, '\\$1')
    .replace(/^(\d{1,9})([.)])(?=\s)/, '$1\\$2')
    .replace(/^(=+|-{3,})\s*$/, '\\$1')
    .replace(/^\[(?=[^\]]*\]:)/, '\\[');
}

/**
 * Keep TeX from reading as markup where a Markdown renderer without math support treats
 * `$…$` as ordinary text: a `<` that could open an HTML tag and a `](` that could open a
 * link get a space between them, which math mode ignores.
 */
export function escapeTex(tex: string): string {
  return tex.replace(/<(?=[A-Za-z/!?])/g, '< ').replace(/\]\(/g, '] (');
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

/** Parentheses, which `encodeURIComponent` leaves as they are. */
const PARENTHESES: Readonly<Record<string, string>> = { '(': '%28', ')': '%29' };

/**
 * Escape a URL for use as a Markdown link destination: whitespace, angle brackets, and
 * parentheses (an unbalanced one ends the destination) are percent-encoded.
 */
export function escapeUrl(url: string): string {
  return url.trim().replace(/[\s()<>]/g, (c) => PARENTHESES[c] ?? encodeURIComponent(c));
}
