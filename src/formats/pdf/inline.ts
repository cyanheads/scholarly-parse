/**
 * @fileoverview A PDF line's runs as inline Markdown: italics, and superscripts and
 * subscripts from raised and lowered runs; lines joined into a paragraph with
 * hyphenation undone.
 * @module src/formats/pdf/inline
 */
import { escapeInline } from '../../render/escape.js';
import { emphasis, subscript, superscript } from '../../render/inline.js';
import type { Line } from './layout.js';
import type { Run } from './load.js';

/** Inline Markdown for a line: italics, raised and lowered runs as super- and subscripts. */
export function lineMarkdown(line: Line): string {
  return line.cells
    .map((cell) => cellMarkdown(cell, line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cellMarkdown(cell: Run[], line: Line): string {
  let out = '';
  let right: number | undefined;
  let italic: string[] = [];
  // Consecutive raised (or lowered) runs are one superscript: "4", "–", "6" set as 4–6.
  let shifted: { kind: 'sub' | 'sup'; plain: string; trailing: string } | undefined;
  const flushItalic = () => {
    if (italic.length > 0) out += emphasis(italic.join(''), '*');
    italic = [];
  };
  const flushShifted = () => {
    if (!shifted) return;
    const { kind, plain, trailing } = shifted;
    out +=
      (kind === 'sup'
        ? superscript(escapeInline(plain.trim()), plain, false)
        : subscript(escapeInline(plain.trim()), plain)) + trailing;
    shifted = undefined;
  };
  for (const run of cell) {
    const spaced = right !== undefined && run.x - right > 0.12 * run.size && !/^\s/.test(run.text);
    right = run.x + run.width;
    const small = run.size < line.size * 0.85;
    const text = run.text;
    const kind =
      small && run.y > line.y + 0.15 * line.size
        ? 'sup'
        : small && run.y < line.y - 0.08 * line.size
          ? 'sub'
          : undefined;
    if (kind) {
      flushItalic();
      if (shifted?.kind !== kind) flushShifted();
      // A raised or lowered run keeps the space it ends with: "population.¹ The".
      shifted = {
        kind,
        plain: (shifted?.plain ?? '') + (shifted && spaced ? ' ' : '') + text,
        trailing: /\s$/.test(text) ? ' ' : '',
      };
      continue;
    }
    flushShifted();
    const piece = (spaced ? ' ' : '') + escapeInline(text);
    if (run.italic && !run.math && text.trim()) {
      italic.push(piece);
    } else {
      flushItalic();
      out += piece;
    }
  }
  flushShifted();
  flushItalic();
  return out;
}

/** Lines as one paragraph: a hyphen broken across lines is rejoined, and so is emphasis. */
export function joinLines(texts: string[]): string {
  let out = '';
  for (const text of texts) {
    if (!out) {
      out = text;
    } else if (/[\p{Ll}][-­]$/u.test(out) && /^\p{Ll}/u.test(text)) {
      out = out.slice(0, -1) + text;
    } else {
      out += ` ${text}`;
    }
  }
  // "*N Engl J* *Med*" set over two lines is one italic span.
  return out.replace(/(?<=[^\s\\])\* \*(?=\S)/g, ' ').trim();
}
