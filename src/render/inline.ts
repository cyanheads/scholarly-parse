/**
 * @fileoverview Builders for inline Markdown that every format parser shares, so a
 * superscript, a link, or an inline formula reads the same whether it came from JATS,
 * TEI, or HTML.
 * @module src/render/inline
 */
import { codeSpan, escapeUrl, isSafeUrl } from './escape.js';

/**
 * Wrap already-rendered Markdown in an emphasis marker (`*`, `**`, `~~`). Whitespace at
 * the edges moves outside the markers, where CommonMark requires it, and empty content
 * renders as itself.
 */
export function emphasis(markdown: string, marker: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(markdown);
  const [, lead = '', core = '', trail = ''] = match ?? [];
  return core ? `${lead}${marker}${core}${marker}${trail}` : markdown;
}

/**
 * Two or more citation numbers joined by commas or dashes (`12,13`, `4–7`). A single
 * number is left alone: `10<sup>5</sup>` is an exponent, not a citation.
 */
const CITATION_RUN = /^\d+(?:\s*[,\u2012\u2013\u2014-]\s*\d+)+$/;

/**
 * A superscript. Citation numbers become a bracketed marker (`[12,13]`), so they do not
 * fuse with the word before them; anything else uses TeX-style notation (`10^{-5}`,
 * `x^2`) that stays readable as plain text.
 *
 * `isCitation` is the parser's judgment that the superscript holds only citation links;
 * an unlinked run of several citation numbers is recognized from its text.
 */
export function superscript(markdown: string, plain: string, isCitation: boolean): string {
  const text = plain.trim();
  if (!text) return '';
  if (isCitation || CITATION_RUN.test(text)) {
    return `[${text.replace(/^\[|\]$/g, '').replace(/\s+/g, '')}]`;
  }
  return [...text].length === 1 ? `^${markdown.trim()}` : `^{${markdown.trim()}}`;
}

/** A subscript in TeX-style notation: `CO_2`, `IC_{50}`. */
export function subscript(markdown: string, plain: string): string {
  const text = plain.trim();
  if (!text) return '';
  return [...text].length === 1 ? `_${markdown.trim()}` : `_{${markdown.trim()}}`;
}

/**
 * A link. An unsafe scheme (`javascript:`, `data:`) renders as its text only; a link
 * whose text is its own URL renders as an autolink.
 */
export function link(markdown: string, url: string | undefined): string {
  const target = url?.trim();
  if (!target || !isSafeUrl(target)) return markdown || (target ?? '');
  const text = markdown.trim();
  if (!text || text === target || text === escapeUrlText(target)) return `<${escapeUrl(target)}>`;
  return `[${text}](${escapeUrl(target)})`;
}

/** How `escapeInline` would have rendered a bare URL, to recognize link text equal to it. */
function escapeUrlText(url: string): string {
  return url.replace(/[*`$~]/g, '\\$&').replace(/_/g, '\\_');
}

/** Inline math: `$tex$`. Empty TeX renders nothing. */
export function inlineMath(tex: string): string {
  const expression = tex.replace(/\s+/g, ' ').trim();
  return expression ? `$${expression}$` : '';
}

/** Inline code. */
export function inlineCode(text: string): string {
  return text ? codeSpan(text) : '';
}
