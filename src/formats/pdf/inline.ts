/**
 * @fileoverview A PDF line's runs as inline Markdown: italics, and superscripts and
 * subscripts from raised and lowered runs; lines joined into a paragraph with
 * hyphenation undone; a footnote's printed label read off its first line.
 * @module src/formats/pdf/inline
 */
import { escapeInline } from '../../render/escape.js';
import { emphasis, joinInlineSeams, subscript, superscript } from '../../render/inline.js';
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

/**
 * Inline Markdown for a cell's runs. Each run is escaped on its own, so the seams between
 * them are repaired once they are joined: text split across runs in two faces
 * (`[click]`, then a bold `(javascript:…)`) never makes a link.
 */
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
  return joinInlineSeams(out);
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

/** A line's cells without its opening `prefix`, matched by its non-space characters (runs may not carry the spaces between them). */
export function trimCells(line: Line, prefix: string): Run[][] {
  let remaining = prefix.replace(/\s/g, '').length;
  return line.cells.map((cell) =>
    cell.flatMap((run) => {
      if (remaining <= 0) return [run];
      let cut = 0;
      while (cut < run.text.length && remaining > 0) {
        if (!/\s/.test(run.text[cut] ?? '')) remaining--;
        cut++;
      }
      const text = run.text.slice(cut).replace(/^\s+/, '');
      return text ? [{ ...run, text }] : [];
    }),
  );
}

/** A note's printed mark: a number, or up to three of `*`, `†`, `‡`, `§`, `¶`, `‖`. */
const NOTE_MARK = /^(?:\d{1,3}|[*†‡§¶‖]{1,3})$/u;

/**
 * A footnote's printed label and the rest of its line as inline Markdown: a number or
 * note mark set smaller than the note (`²https://…`) or on a line of its own, or a number
 * followed by a space and a capital (`1 This note…`).
 */
export function noteLabel(line: Line): { label: string; text: string } | undefined {
  const [first, ...others] = line.cells.flat().filter((run) => run.text.trim());
  if (!first) return;
  const mark = first.text.trim();
  if (NOTE_MARK.test(mark) && (first.size < line.size - 0.5 || others.length === 0)) {
    const cells = line.cells.map((cell) => cell.filter((run) => run !== first));
    return { label: mark, text: lineMarkdown({ ...line, cells }) };
  }
  const label = /^(\d{1,3})\s+(?=\p{Lu})/u.exec(line.text)?.[1];
  if (!label) return;
  return { label, text: lineMarkdown({ ...line, cells: trimCells(line, label) }) };
}
