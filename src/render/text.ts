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
  return markdown
    .replace(/(`+)\s?([\s\S]*?)\s?\1/g, '$2')
    .replace(/!?\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    .replace(/<((?:https?|ftp|mailto):[^>]+)>/g, '$1')
    .replace(/(\*\*|~~)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(?<![\\*])\*(?=\S)([\s\S]*?\S)\*/g, '$1')
    .replace(/\\([!-/:-@[-`{-~])/g, '$1');
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
