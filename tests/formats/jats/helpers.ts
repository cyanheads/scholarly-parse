/**
 * @fileoverview Builders for the JATS unit tests: wrap a body, back-matter, or
 * front-matter snippet in a minimal `<article>`, parse it, and walk the result for the
 * blocks a test asserts on.
 * @module tests/formats/jats/helpers
 */
import { parseJats } from '../../../src/formats/jats/index.js';
import type { Block, ScholarlyDocument, Section } from '../../../src/model/document.js';

/** The parts of a test article. Each string is the raw XML placed inside its element. */
export interface ArticleParts {
  /** Attributes on `<article>` itself, e.g. `article-type="research-article"`. */
  attrs?: string;
  back?: string;
  body?: string;
  floats?: string;
  journalMeta?: string;
  /** Children of `<article-meta>`. Defaults to a title, so a body-only article parses. */
  meta?: string;
  /** Elements after `<back>`, such as `<sub-article>`. */
  tail?: string;
}

const DEFAULT_META = '<title-group><article-title>Test article</article-title></title-group>';

/** A JATS article around the given parts, namespaces declared the way PMC serves them. */
export function article(parts: ArticleParts): string {
  const attrs = parts.attrs ? ` ${parts.attrs}` : '';
  const journalMeta = parts.journalMeta ? `<journal-meta>${parts.journalMeta}</journal-meta>` : '';
  return [
    `<article xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:mml="http://www.w3.org/1998/Math/MathML"${attrs}>`,
    `<front>${journalMeta}<article-meta>${parts.meta ?? DEFAULT_META}</article-meta></front>`,
    parts.body === undefined ? '' : `<body>${parts.body}</body>`,
    parts.back === undefined ? '' : `<back>${parts.back}</back>`,
    parts.floats === undefined ? '' : `<floats-group>${parts.floats}</floats-group>`,
    parts.tail ?? '',
    '</article>',
  ].join('');
}

/** Parse XML that must succeed; a failed parse throws with its reason. */
export function parse(xml: string): ScholarlyDocument {
  const result = parseJats(xml);
  if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
  return result.document;
}

/** Parse an article built from `parts`. */
export function parseArticle(parts: ArticleParts): ScholarlyDocument {
  return parse(article(parts));
}

/** Parse an article whose `<body>` is `body`. */
export function parseBody(body: string): ScholarlyDocument {
  return parse(article({ body }));
}

/** Every block under these sections, depth first, including blocks nested in blocks. */
export function sectionBlocks(sections: Section[]): Block[] {
  return sections.flatMap((section) => [
    ...nestedBlocks(section.blocks),
    ...sectionBlocks(section.sections),
  ]);
}

function nestedBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap((block): Block[] => {
    switch (block.type) {
      case 'box':
        return [block, ...nestedBlocks(block.blocks), ...sectionBlocks(block.sections)];
      case 'list':
        return [block, ...block.items.flatMap(nestedBlocks)];
      case 'quote':
        return [block, ...nestedBlocks(block.blocks)];
      default:
        return [block];
    }
  });
}

/** Every block in the document: abstracts, body, back matter, and floats. */
export function allBlocks(document: ScholarlyDocument): Block[] {
  return [
    ...sectionBlocks(document.abstracts.flatMap((abstract) => abstract.sections)),
    ...sectionBlocks(document.body),
    ...sectionBlocks(document.back),
    ...nestedBlocks(document.floats),
  ];
}

/** Blocks of one type anywhere in the document. */
export function blocksOfType<T extends Block['type']>(
  document: ScholarlyDocument,
  type: T,
): Extract<Block, { type: T }>[] {
  return allBlocks(document).filter(
    (block): block is Extract<Block, { type: T }> => block.type === type,
  );
}

/** The text of every paragraph in the document, in walk order. */
export function paragraphTexts(document: ScholarlyDocument): string[] {
  return blocksOfType(document, 'paragraph').map((block) => block.text);
}

/**
 * The LaTeX document publishers deposit as a `<tex-math>` body, reproducing the
 * preamble, tab indentation, and `\begin{document}` wrapper of a real Springer Nature
 * deposit (PMC12855809 carries it on every formula).
 */
export function texDocument(expression: string): string {
  return (
    '\\documentclass[12pt]{minimal}\n\t\t\t\t\\usepackage{amsmath}\n\t\t\t\t' +
    '\\usepackage{upgreek}\n\t\t\t\t\\setlength{\\oddsidemargin}{-69pt}\n\t\t\t\t' +
    `\\begin{document}${expression}\\end{document}`
  );
}

/** A `<tex-math>` element carrying the full LaTeX document wrapper around `expression`. */
export function texMath(expression: string): string {
  return `<tex-math>${texDocument(expression)}</tex-math>`;
}

/**
 * Fragments of source text that, joined, spell markup a Markdown renderer passing raw HTML
 * through would make live (#44): a tag, a comment, an autolink of any scheme, an image,
 * and a link with no web or mail destination. Each row's pieces are XML text, escaped.
 */
export const SPLIT_MARKUP: readonly (readonly string[])[] = [
  ['&lt;', 'img src=x onerror=alert(1)&gt;'],
  ['[click]', '(javascript:alert(1))'],
  ['\\', '&lt;img src=x onerror=alert(1)&gt;'],
  ['&lt;', 'javascript:alert(1)&gt;'],
  ['!', '[x]', '(https://example.org/a.png)'],
  ['&lt;', '!-- hidden --&gt;'],
];
