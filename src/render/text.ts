/**
 * @fileoverview `ScholarlyDocument` → plain text: the Markdown rendering with its markup
 * removed. The Markdown this package emits comes from a small, known set of constructs,
 * so removing them is exact rather than a general Markdown parse. Code and TeX come out
 * as written: a code span loses its backticks, inline math keeps its dollars, and a code
 * or display-math block loses its fence lines. Every construct is read in one pass, so a
 * run of openers that nothing closes costs time in proportion to its length.
 * @module src/render/text
 */
import type { ScholarlyDocument } from '../model/document.js';
import {
  autolinkAt,
  codeSpanAt,
  codeSpanCloser,
  ESCAPABLE,
  pairBrackets,
  unescapedDollar,
} from './inline.js';
import { type MarkdownOptions, toMarkdown } from './markdown.js';

/** Render a document as plain text. Options are the same as for Markdown. */
export function toText(document: ScholarlyDocument, options: MarkdownOptions = {}): string {
  const lines: string[] = [];
  let block: VerbatimBlock | undefined;
  // A list marker from a dropped opening fence, for the block's first line.
  let marker = '';
  for (const line of toMarkdown(document, options).split('\n')) {
    if (block) {
      const { kept, rest } = insideBlock(line, block.parts);
      if (rest === block.fence) {
        block = undefined;
        if (marker) lines.push(marker.trimEnd());
      } else {
        lines.push((marker || kept) + rest);
      }
      marker = '';
      continue;
    }
    const { kept, parts, rest } = containerPrefix(line);
    const fence = CODE_FENCE.exec(rest)?.[1] ?? (rest === '$$' ? rest : undefined);
    if (fence) {
      block = { fence, parts };
      marker = /\S/.test(kept) ? kept : '';
      continue;
    }
    lines.push(TABLE_RULE.test(rest) ? '' : kept + stripInline(rest.replace(HEADING, '')));
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** A code or display-math block being read: its closing fence and its container prefix. */
interface VerbatimBlock {
  fence: string;
  parts: PrefixPart[];
}

/** One part of a line's container prefix: a quote marker, or the width of indentation or a list marker. */
type PrefixPart = 'quote' | number;

/** A quote marker, a run of indentation, or a list marker (`- `, `12. `), where a line's prefix goes on. */
const PREFIX_PART = /(>) ?|( +)|(?:-|\d{1,9}\.) /y;

/** A code block's opening fence after its prefix, with its language; the closing one is the same backtick run. */
const CODE_FENCE = /^(`{3,})[\w+#.-]{0,32}$/;

/** A table's rule row. */
const TABLE_RULE = /^\|\s*-{3}/;

const HEADING = /^#{1,6}\s+/;

/**
 * A line's container prefix — the quotes, list items, and indentation it sits in — and
 * the rest of the line. Plain text keeps the indentation and list markers and drops the
 * quote markers, at every depth.
 */
function containerPrefix(line: string): { kept: string; parts: PrefixPart[]; rest: string } {
  const parts: PrefixPart[] = [];
  const part = new RegExp(PREFIX_PART);
  let kept = '';
  let at = 0;
  for (let match = part.exec(line); match; match = part.exec(line)) {
    at = part.lastIndex;
    if (match[1]) {
      parts.push('quote');
    } else {
      parts.push(match[0].length);
      kept += match[0];
    }
  }
  return { kept, parts, rest: line.slice(at) };
}

/**
 * A line inside a code or display-math block, read against the container prefix of its
 * opening fence: the quote markers of those containers come off, their indentation is
 * kept, and the rest is the block's text as written. A list item's marker stands as
 * indentation on every line after its first.
 */
function insideBlock(line: string, parts: readonly PrefixPart[]): { kept: string; rest: string } {
  let kept = '';
  let at = 0;
  for (const part of parts) {
    if (part === 'quote') {
      if (line.charAt(at) !== '>') break;
      at += line.charAt(at + 1) === ' ' ? 2 : 1;
      continue;
    }
    let width = 0;
    while (width < part && line.charAt(at + width) === ' ') width++;
    kept += line.slice(at, at + width);
    at += width;
    if (width < part) break;
  }
  return { kept, rest: line.slice(at) };
}

/** Where inline markup can start, or a link's text end. */
const SPECIAL = /[\\`$<![\]*~]/g;

/**
 * Inline Markdown this package emits → plain text, read left to right in one pass. Code
 * span content comes out as written, and inline math with its dollars; a link and an
 * autolink leave their text; a backslash escape leaves its character; emphasis,
 * strong, and strikethrough markers are removed in pairs, and one with no partner stays.
 *
 * A link's text is read in place, its brackets paired beforehand by `pairBrackets` with
 * inline math read as a span, as here and as `link` balances them, and its emphasis pairs
 * only within it. Nothing read inside a link's text reaches past the
 * text's end, so links nested any depth cost no more than their length.
 */
export function stripInline(markdown: string): string {
  const out: string[] = [];
  /** Every delimiter run, to write back once paired. */
  const runs: DelimiterRun[] = [];
  /** The runs of the text around the read position, the innermost link's last. */
  const scopes: DelimiterRun[][] = [[]];
  /** The links whose text is being read, innermost last. */
  const links: LinkAt[] = [];
  const codeSpanEnd = codeSpanCloser(markdown);
  const { pairs } = pairBrackets(markdown, { skipMath: true });
  let mathCloses = true;
  let at = 0;
  const special = new RegExp(SPECIAL);
  for (let found = special.exec(markdown); found; found = special.exec(markdown)) {
    const start = found.index;
    if (start > at) out.push(markdown.slice(at, start));
    const limit = links.at(-1)?.close ?? markdown.length;
    const char = found[0];
    let end = start + 1;
    if (char === '\\') {
      const escaped = markdown.charAt(start + 1);
      if (ESCAPABLE.test(escaped)) end = start + 2;
      out.push(end > start + 1 ? escaped : char);
    } else if (char === '`') {
      const span = codeSpanAt(markdown, start, codeSpanEnd);
      if (span.content === undefined || span.end > limit) {
        while (markdown.charAt(end) === '`') end++;
        out.push(markdown.slice(start, end));
      } else {
        out.push(unpad(span.content));
        end = span.end;
      }
    } else if (char === '$') {
      const close = mathCloses ? unescapedDollar(markdown, start + 1) : -1;
      if (close === -1) mathCloses = false;
      if (close > start + 1 && close < limit) end = close + 1;
      out.push(markdown.slice(start, end));
    } else if (char === '<') {
      const autolink = autolinkAt(markdown, start);
      if (autolink && autolink.end <= limit) {
        end = autolink.end;
        out.push(autolink.target);
      } else {
        out.push(char);
      }
    } else if (char === '*' || char === '~') {
      while (markdown.charAt(end) === char) end++;
      const run: DelimiterRun = {
        canClose: start > 0 && !/\s/.test(markdown.charAt(start - 1)),
        canOpen: end < markdown.length && !/\s/.test(markdown.charAt(end)),
        char,
        left: end - start,
        piece: out.length,
      };
      runs.push(run);
      scopes.at(-1)?.push(run);
      out.push(markdown.slice(start, end));
    } else if (char === ']') {
      const link = links.at(-1);
      if (link?.close === start) {
        // The link's text ends: its emphasis is paired, and its destination dropped.
        links.pop();
        pairRuns(scopes.pop() ?? []);
        end = link.end;
      } else {
        out.push(char);
      }
    } else {
      // `[` opens a link, and `!` before one is dropped with it.
      const open = char === '!' ? start + 1 : start;
      const link = linkAt(markdown, open, pairs, limit);
      if (link) {
        links.push(link);
        scopes.push([]);
        end = open + 1;
      } else {
        out.push(char);
      }
    }
    at = end;
    special.lastIndex = end;
  }
  out.push(markdown.slice(at));
  for (const scope of scopes) pairRuns(scope);
  for (const run of runs) out[run.piece] = run.char.repeat(run.left);
  return out.join('');
}

/** A run of `*` or `~`, and how much of it is left once pairs are removed. */
interface DelimiterRun {
  /** A character other than whitespace comes before it, so it can close a pair. */
  canClose: boolean;
  /** A character other than whitespace comes after it, so it can open a pair. */
  canOpen: boolean;
  char: '*' | '~';
  left: number;
  /** Its index among the output pieces. */
  piece: number;
}

/**
 * Pair the runs of each character: a run that can close takes from the nearest open run
 * of its character, two at a time at most (`**` strong, `*` emphasis, `~~` strikethrough),
 * and whatever is left of a run that can open waits for a closer. Each run is pushed and
 * popped at most once.
 */
function pairRuns(runs: DelimiterRun[]): void {
  const open: Record<DelimiterRun['char'], DelimiterRun[]> = { '*': [], '~': [] };
  for (const run of runs) {
    const stack = open[run.char];
    if (run.canClose) {
      for (let opener = stack.at(-1); opener && run.left > 0; opener = stack.at(-1)) {
        const paired = Math.min(opener.left, run.left, 2);
        opener.left -= paired;
        run.left -= paired;
        if (opener.left === 0) stack.pop();
      }
    }
    if (run.left > 0 && run.canOpen) stack.push(run);
  }
}

/** A code span's content without the space padding both of its sides. */
function unpad(content: string): string {
  return content.startsWith(' ') && content.endsWith(' ') && content.trim() !== ''
    ? content.slice(1, -1)
    : content;
}

/** A link being read: where its text ends, at its `]`, and where its destination does. */
interface LinkAt {
  close: number;
  end: number;
}

/**
 * A link `[text](destination)` whose `[` is at `start` and which ends by `limit`: its
 * text runs to the `]` `pairs` pairs with that `[`, and its destination, which holds no
 * parentheses (a written URL has them percent-encoded), to the next parenthesis.
 */
function linkAt(
  markdown: string,
  start: number,
  pairs: ReadonlyMap<number, number>,
  limit: number,
): LinkAt | undefined {
  const close = pairs.get(start);
  if (close === undefined || markdown.charAt(close + 1) !== '(') return;
  const parenthesis = /[()]/g;
  parenthesis.lastIndex = close + 2;
  const end = parenthesis.exec(markdown);
  if (end?.[0] !== ')' || end.index >= limit) return;
  return { close, end: end.index + 1 };
}
