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
import { type MarkdownOptions, toMarkdown } from './markdown.js';
import { readInline } from './read-inline.js';

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

/**
 * Inline Markdown this package emits → plain text, as GFM reads it ({@link readInline}):
 * code span content and inline math as written, a link's text, emphasis markers removed
 * in the pairs GFM forms, and one with no partner left in place.
 */
export function stripInline(markdown: string): string {
  return readInline(markdown).text;
}
