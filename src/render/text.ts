/**
 * @fileoverview `ScholarlyDocument` → plain text: the Markdown rendering with its markup
 * removed. The Markdown this package emits comes from a small, known set of inline
 * constructs, so removing them is exact rather than a general Markdown parse.
 * @module src/render/text
 */
import type { ScholarlyDocument } from '../model/document.js';
import { type MarkdownOptions, toMarkdown } from './markdown.js';

/** Inline Markdown this package emits → plain text. */
export function stripInline(markdown: string): string {
  // Link text stops at the next bracket, and a destination (`escapeUrl` percent-encodes its
  // parentheses) at the next parenthesis, so a run of unclosed ones is scanned once.
  return stripCodeSpans(markdown)
    .replace(/!?\[([^[\]]*)\]\([^()]*\)/g, '$1')
    .replace(/<((?:https?|ftp|mailto):[^>]+)>/g, '$1')
    .replace(/(\*\*|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(?<![\\*])\*(?=\S)([\s\S]*?\S)\*/g, '$1')
    .replace(/\\([!-/:-@[-`{-~])/g, '$1');
}

/**
 * Code spans → their content, in one pass over the backtick runs. A run opens a span
 * unless a backslash escapes it, and the next run of the same length closes it; the
 * space that pads each side is dropped. A run with no partner is text, as CommonMark
 * reads it.
 */
function stripCodeSpans(markdown: string): string {
  const runs: BacktickRun[] = Array.from(markdown.matchAll(/`+/g), (m) => ({
    end: m.index + m[0].length,
    start: m.index,
  }));
  const nextOfLength = new Map<number, BacktickRun>();
  for (const run of runs.toReversed()) {
    const close = nextOfLength.get(run.end - run.start);
    if (close) run.close = close;
    nextOfLength.set(run.end - run.start, run);
  }
  let text = '';
  let copied = 0;
  for (const { close, end, start } of runs) {
    if (!close || start < copied || isEscaped(markdown, start, copied)) continue;
    text += markdown.slice(copied, start) + unpad(markdown.slice(end, close.start));
    copied = close.end;
  }
  return text + markdown.slice(copied);
}

/** A run of backticks, and the next run of the same length, which would close a span it opens. */
interface BacktickRun {
  close?: BacktickRun;
  end: number;
  start: number;
}

/** True when an odd run of backslashes, none before `from`, ends just before `at`. */
function isEscaped(markdown: string, at: number, from: number): boolean {
  let backslashes = 0;
  for (let i = at - 1; i >= from && markdown[i] === '\\'; i--) backslashes++;
  return backslashes % 2 === 1;
}

/** A code span's content without the space padding both of its sides. */
function unpad(content: string): string {
  return content.startsWith(' ') && content.endsWith(' ') && content.trim() !== ''
    ? content.slice(1, -1)
    : content;
}

/** Render a document as plain text. Options are the same as for Markdown. */
export function toText(document: ScholarlyDocument, options: MarkdownOptions = {}): string {
  return toMarkdown(document, options)
    .split('\n')
    .map((line) =>
      stripInline(
        line
          .replace(/^#{1,6}\s+/, '')
          .replace(/^>\s?/, '')
          .replace(/^\|\s*-{3}.*$/, '')
          .replace(/^\$\$$/, ''),
      ),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}
