/**
 * @fileoverview Inline Markdown for TEI mixed content (`<p>`, `<head>`, `<figDesc>`,
 * `<cell>`), as Grobid and other TEI producers write it. Tag names arrive lowercased.
 * @module src/formats/tei/inline
 */
import type { DiagnosticsCollector } from '../../model/diagnostics.js';
import type { Footnote } from '../../model/document.js';
import { escapeInline } from '../../render/escape.js';
import { emphasis, link, subscript, superscript } from '../../render/inline.js';
import {
  attrOf,
  childrenOf,
  collapseWhitespace,
  isTextNode,
  tagNameOf,
  textOf,
  type XmlNode,
  type XmlNodeList,
} from '../../xml/ordered.js';

export interface TeiContext {
  diag: DiagnosticsCollector;
  /** Each footnote's printed mark by its `xml:id`. */
  footnoteMarks: ReadonlyMap<string, string>;
  footnotes: Footnote[];
  sectionIds: Set<string>;
}

/** Elements whose content reads in place with no formatting of their own. */
const TRANSPARENT: ReadonlySet<string> = new Set([
  's',
  'seg',
  'term',
  'rs',
  'name',
  'orgname',
  'persname',
  'date',
  'num',
  'measure',
  'unit',
  'foreign',
  'label',
  'title',
  'emph',
  'q',
  'quote',
  'p',
  'head',
  'item',
  'cell',
  'row',
]);

/** Plain text of a node list, whitespace collapsed. */
export function plainText(input: XmlNode | XmlNodeList | undefined): string {
  if (!input) return '';
  const nodes = Array.isArray(input) ? input : [input];
  const concat = (list: XmlNodeList): string =>
    list
      .map((n) => (isTextNode(n) ? textOf(n) : tagNameOf(n) === 'lb' ? ' ' : concat(childrenOf(n))))
      .join('');
  return collapseWhitespace(concat(nodes));
}

/** Inline Markdown for a node list, spacing intact. */
export function inlineMarkdown(nodes: XmlNodeList, ctx: TeiContext): string {
  let out = '';
  for (const node of nodes) out += inlineNode(node, ctx);
  return out;
}

/** Inline Markdown of an element's content, whitespace collapsed. */
export function inlineText(node: XmlNode | undefined, ctx: TeiContext): string {
  return node ? collapseWhitespace(inlineMarkdown(childrenOf(node), ctx)) : '';
}

function inlineNode(node: XmlNode, ctx: TeiContext): string {
  if (isTextNode(node)) return escapeInline(textOf(node));
  const tag = tagNameOf(node) ?? '';
  const children = childrenOf(node);
  switch (tag) {
    case 'hi': {
      const rend = attrOf(node, 'rend') ?? '';
      const inner = inlineMarkdown(children, ctx);
      if (/sup/.test(rend))
        return superscript(escapeInline(plainText(children)), plainText(children), false);
      if (/sub/.test(rend))
        return subscript(escapeInline(plainText(children)), plainText(children));
      if (/bold/.test(rend)) return emphasis(inner, '**');
      if (/italic/.test(rend)) return emphasis(inner, '*');
      return inner;
    }
    case 'ref':
    case 'ptr': {
      const target = attrOf(node, 'target') ?? '';
      // Grobid may write a footnote reference's text as the note's ID (`foot_0`); the
      // note carries the printed mark.
      if (attrOf(node, 'type') === 'foot') {
        const mark = ctx.footnoteMarks.get(target.replace(/^#/, '')) ?? plainText(children);
        return superscript(escapeInline(mark), mark, false);
      }
      const inner = inlineMarkdown(children, ctx);
      return /^(https?|ftp):/i.test(target) ? link(inner, target) : inner;
    }
    case 'lb':
      return ' ';
    case 'formula':
      return escapeInline(plainText(children.filter((c) => tagNameOf(c) !== 'label')));
    case 'note':
      return footnote(node, ctx);
    case 'figure':
    case 'graphic':
    case 'pb':
    case 'fw':
      return '';
    default:
      if (!TRANSPARENT.has(tag)) ctx.diag.unhandled(`tei:${tag}`);
      return inlineMarkdown(children, ctx);
  }
}

/** A footnote met inline: collected, its number left as a superscript mark. */
export function footnote(node: XmlNode, ctx: TeiContext): string {
  const label = attrOf(node, 'n');
  const text = inlineText(node, ctx);
  const id = attrOf(node, 'xml:id');
  if (text) ctx.footnotes.push({ ...(id && { id }), ...(label && { label }), text });
  return label ? superscript(escapeInline(label), label, false) : '';
}
