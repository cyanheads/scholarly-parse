/**
 * @fileoverview Builders for inline Markdown that every format parser shares, so a
 * superscript, a link, or an inline formula reads the same whether it came from JATS,
 * TEI, or HTML.
 * @module src/render/inline
 */
import { codeSpan, escapeInline, escapeTex, escapeUrl, isSafeUrl } from './escape.js';

/**
 * Wrap already-rendered Markdown in an emphasis marker (`*`, `**`, `~~`). Whitespace at
 * the edges moves outside the markers, where CommonMark requires it, and empty content
 * renders as itself. The edges are found by trimming, which reads each end once.
 */
export function emphasis(markdown: string, marker: string): string {
  const core = markdown.trim();
  if (!core) return markdown;
  const lead = markdown.length - markdown.trimStart().length;
  return `${markdown.slice(0, lead)}${marker}${core}${marker}${markdown.slice(lead + core.length)}`;
}

/**
 * Two or more citation numbers joined by commas or dashes (`12,13`, `4–7`). A single
 * number is left alone: `10<sup>5</sup>` is an exponent, not a citation.
 */
const CITATION_RUN = /^\d+(?:\s*[,\u2012\u2013\u2014-]\s*\d+)+$/;

/**
 * A superscript. Citation numbers become a bracketed marker (`[12,13]`), so they do not
 * fuse with the word before them; anything else uses TeX-style notation (`10^{-5}`,
 * `x^2`) that stays readable as plain text. A marker's text is escaped like any source
 * text.
 *
 * `isCitation` is the parser's judgment that the superscript holds only citation links;
 * an unlinked run of several citation numbers is recognized from its text.
 */
export function superscript(markdown: string, plain: string, isCitation: boolean): string {
  const text = plain.trim();
  if (!text) return '';
  if (isCitation || CITATION_RUN.test(text)) {
    return `[${escapeInline(text.replace(/^\[|\]$/g, '').replace(/\s+/g, ''))}]`;
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
 * A link. An unsafe scheme (`javascript:`, `data:`) renders as its text only, or as the
 * target as escaped text when there is none; a link whose text is its own URL renders as
 * an autolink. A bracket in the text with no partner is escaped, so the link's own
 * brackets enclose the whole text.
 */
export function link(markdown: string, url: string | undefined): string {
  const target = url?.trim();
  if (!target || !isSafeUrl(target)) return markdown || escapeInline(target ?? '');
  const text = markdown.trim();
  if (!text || text === target || text === escapeUrlText(target)) return `<${escapeUrl(target)}>`;
  return `[${escapeUnpaired(text)}](${escapeUrl(target)})`;
}

/**
 * Inline Markdown with a backslash before each bracket that {@link pairBrackets} leaves
 * unpaired. Brackets inside inline math are TeX, so they are left as written.
 */
function escapeUnpaired(markdown: string): string {
  return insertBackslashes(markdown, pairBrackets(markdown, { skipMath: true }).unpaired);
}

/** `markdown` with a backslash inserted before the character at each of `positions`, in ascending order. */
function insertBackslashes(markdown: string, positions: readonly number[]): string {
  if (positions.length === 0) return markdown;
  let out = '';
  let at = 0;
  for (const position of positions) {
    out += `${markdown.slice(at, position)}\\`;
    at = position;
  }
  return out + markdown.slice(at);
}

/** How `escapeInline` would have rendered a bare URL, to recognize link text equal to it. */
function escapeUrlText(url: string): string {
  return url.replace(/[*`$~]/g, '\\$&').replace(/_/g, '\\_');
}

/**
 * Where a formula stands that the source publishes only as an image: its content is not
 * in the text, and the marker keeps the sentence around it from reading as complete.
 */
export const FORMULA_IMAGE = '[formula]';

/** Inline math: `$tex$`. Empty TeX renders nothing. */
export function inlineMath(tex: string): string {
  const expression = tex.replace(/\s+/g, ' ').trim();
  return expression ? `$${escapeTex(expression)}$` : '';
}

/** What can start a seam to repair, or a span the seam pass leaves alone. */
const SEAM = /[\\`<$\]]/g;

/** ASCII punctuation, which a backslash escapes. */
export const ESCAPABLE = /^[!-/:-@[-`{-~]$/;

/** A destination `link` writes: a URL with a scheme it allows, then the closing parenthesis. */
const LINK_DESTINATION = /(?:https?|ftp|mailto):[^\s()]*\)/iy;

/**
 * Inline Markdown assembled from separately escaped pieces, with the seams between them
 * repaired: the escaping of each piece cannot see what the next one adds.
 *
 * - Touching inline formulas join into one (`$a$$b$` would read as a display-math
 *   delimiter), with a space where the TeX at the joint would open an HTML tag or a link,
 *   as `escapeTex` writes it. Source text never yields `$$` (its dollar signs are
 *   escaped), so every `$$` is such a seam.
 * - A `](` that `link` did not write, one not followed by a web or mail destination, is
 *   escaped, so no link forms with any other destination.
 * - A `!` before a link is escaped, so the link does not read as an image.
 *
 * Code spans, autolinks, and link destinations are left as written, and a backslash
 * escapes only the one character after it, so an escaped backslash escapes nothing. The
 * text is read once, plus once more when it holds a `![`.
 */
export function joinInlineSeams(markdown: string): string {
  const out: string[] = [];
  const codeSpanEnd = codeSpanCloser(markdown);
  const seam = new RegExp(SEAM);
  let at = 0;
  for (let found = seam.exec(markdown); found; found = seam.exec(markdown)) {
    const start = found.index;
    let end = start + 1;
    switch (found[0]) {
      case '\\':
        if (ESCAPABLE.test(markdown.charAt(end))) end++;
        break;
      case '`':
        end = codeSpanAt(markdown, start, codeSpanEnd).end;
        break;
      case '<':
        end = autolinkAt(markdown, start)?.end ?? end;
        break;
      case '$':
        if (markdown.charAt(end) === '$') {
          out.push(markdown.slice(at, start), mathJoint(markdown, start));
          at = end = start + 2;
        }
        break;
      default:
        if (markdown.charAt(end) !== '(') break;
        LINK_DESTINATION.lastIndex = start + 2;
        if (LINK_DESTINATION.test(markdown)) {
          end = LINK_DESTINATION.lastIndex;
        } else {
          out.push(markdown.slice(at, start), '\\');
          at = start;
        }
    }
    seam.lastIndex = end;
  }
  out.push(markdown.slice(at));
  const joined = out.join('');
  return joined.includes('![') ? escapeImageOpeners(joined) : joined;
}

/**
 * Inline Markdown as one finished run: whitespace collapsed and trimmed, then the seams
 * between its separately escaped pieces repaired ({@link joinInlineSeams}).
 */
export function collapseInline(markdown: string): string {
  return joinInlineSeams(markdown.replace(/\s+/g, ' ').trim());
}

/**
 * What replaces the `$$` at `at` that joins two formulas: a space where the TeX on its two
 * sides would meet as `<` and a tag's first character or as `](`, and nothing elsewhere.
 */
function mathJoint(markdown: string, at: number): string {
  const before = markdown.charAt(at - 1);
  const after = markdown.charAt(at + 2);
  return (before === '<' && /[A-Za-z/!?]/.test(after)) || (before === ']' && after === '(')
    ? ' '
    : '';
}

/**
 * Markdown with a backslash before each `!` that would make the link after it an image,
 * its brackets paired as a renderer with math support pairs them or as one without does.
 * Every `](` left in it opens a destination `link` writes.
 */
function escapeImageOpeners(markdown: string): string {
  const bangs = new Set<number>();
  for (const skipMath of [false, true]) {
    for (const [open, close] of pairBrackets(markdown, { skipMath }).pairs) {
      if (markdown.charAt(close + 1) === '(' && markdown.charAt(open - 1) === '!') {
        let backslashes = 0;
        while (markdown.charAt(open - 2 - backslashes) === '\\') backslashes++;
        if (backslashes % 2 === 0) bangs.add(open - 1);
      }
    }
  }
  return insertBackslashes(
    markdown,
    [...bangs].sort((a, b) => a - b),
  );
}

/**
 * Each `[` paired with its `]` as CommonMark pairs them, in one pass: a bracket a
 * backslash escapes, or one inside a code span or an autolink, does not count, and nested
 * pairs balance on a stack. Inline math gets no special treatment, as in CommonMark,
 * unless `skipMath` asks for `$…$` to be read as a span too, as `stripInline` reads it.
 * `pairs` maps each paired `[` to its `]`; `unpaired` holds the rest, in ascending order.
 */
export function pairBrackets(
  markdown: string,
  { skipMath = false }: { skipMath?: boolean } = {},
): { pairs: Map<number, number>; unpaired: number[] } {
  const pairs = new Map<number, number>();
  const unpaired: number[] = [];
  const open: number[] = [];
  const codeSpanEnd = codeSpanCloser(markdown);
  const special = skipMath ? /[\\`<[\]$]/g : /[\\`<[\]]/g;
  let mathCloses = true;
  for (let found = special.exec(markdown); found; found = special.exec(markdown)) {
    const start = found.index;
    let end = start + 1;
    switch (found[0]) {
      case '\\':
        if (ESCAPABLE.test(markdown.charAt(end))) end++;
        break;
      case '`':
        end = codeSpanAt(markdown, start, codeSpanEnd).end;
        break;
      case '<':
        end = autolinkAt(markdown, start)?.end ?? end;
        break;
      case '$': {
        const close = mathCloses ? unescapedDollar(markdown, end) : -1;
        if (close === -1) mathCloses = false;
        if (close > end) end = close + 1;
        break;
      }
      case '[':
        open.push(start);
        break;
      default: {
        const opener = open.pop();
        if (opener === undefined) unpaired.push(start);
        else pairs.set(opener, start);
      }
    }
    special.lastIndex = end;
  }
  return { pairs, unpaired: [...unpaired, ...open].sort((a, b) => a - b) };
}

/**
 * The backtick run at `start`, and the code span it opens: `content` is undefined, and
 * `end` the end of the run, when no run of its length closes it.
 */
export function codeSpanAt(
  markdown: string,
  start: number,
  codeSpanEnd: (length: number, from: number) => number | undefined,
): { content?: string; end: number } {
  let open = start + 1;
  while (markdown.charAt(open) === '`') open++;
  const close = codeSpanEnd(open - start, open);
  if (close === undefined) return { end: open };
  return { content: markdown.slice(open, close), end: close + open - start };
}

/**
 * A finder of code-span closers for `markdown`: the start of the first run of exactly
 * `length` backticks at or after `from`, which a run of that length opening before
 * `from` closes. Runs are found once, and the search for each length only moves forward,
 * as the text is read.
 */
export function codeSpanCloser(
  markdown: string,
): (length: number, from: number) => number | undefined {
  const starts = new Map<number, number[]>();
  for (const run of markdown.matchAll(/`+/g)) {
    const list = starts.get(run[0].length);
    if (list) list.push(run.index);
    else starts.set(run[0].length, [run.index]);
  }
  const next = new Map<number, number>();
  return (length, from) => {
    const list = starts.get(length) ?? [];
    let i = next.get(length) ?? 0;
    while (i < list.length && (list[i] ?? from) < from) i++;
    next.set(length, i);
    return list[i];
  };
}

/**
 * The first `$` at or after `from` that no odd run of backslashes escapes, counting none
 * before `from`, or -1. When there is none, there is none after a later `$` either.
 */
export function unescapedDollar(markdown: string, from: number): number {
  for (let at = markdown.indexOf('$', from); at !== -1; at = markdown.indexOf('$', at + 1)) {
    let backslashes = 0;
    for (let i = at - 1; i >= from && markdown.charAt(i) === '\\'; i--) backslashes++;
    if (backslashes % 2 === 0) return at;
  }
  return -1;
}

/** An autolink's target: a URL with a scheme `link` writes as one. */
const AUTOLINK_TARGET = /^(?:https?|ftp|mailto):[\s\S]/i;

/**
 * An autolink at `start`: its target up to the next `>`, which no `<` comes before (a
 * written URL has its angle brackets percent-encoded).
 */
export function autolinkAt(
  markdown: string,
  start: number,
): { end: number; target: string } | undefined {
  const angle = /[<>]/g;
  angle.lastIndex = start + 1;
  const close = angle.exec(markdown);
  if (close?.[0] !== '>') return;
  const target = markdown.slice(start + 1, close.index);
  return AUTOLINK_TARGET.test(target) ? { end: close.index + 1, target } : undefined;
}

/** Inline code. */
export function inlineCode(text: string): string {
  return text ? codeSpan(text) : '';
}
