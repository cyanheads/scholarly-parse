/**
 * @fileoverview Inline Markdown for LaTeXML HTML: fonts, links, cross-references and
 * citations as printed, footnotes collected with their mark left in place, and math as
 * the TeX LaTeXML keeps beside every MathML tree.
 * @module src/formats/latexml/inline
 */

import {
  childNodes,
  childWhere,
  hasClass,
  isElement,
  resolveUrl,
  TEXT_NODE,
  tagOf,
  textOfElement,
} from '../../html/dom.js';
import { escapeInline } from '../../render/escape.js';
import {
  emphasis,
  inlineCode,
  inlineMath,
  link,
  subscript,
  superscript,
} from '../../render/inline.js';
import { type LatexmlContext, SKIP_TAGS } from './context.js';

/** Inline Markdown for a list of nodes, spacing intact. */
export function inlineMarkdown(nodes: Node[], ctx: LatexmlContext): string {
  let out = '';
  for (const node of nodes) out += inlineNode(node, ctx);
  return out;
}

/** Inline Markdown of an element's content, whitespace collapsed. */
export function inlineText(element: Element | null | undefined, ctx: LatexmlContext): string {
  return element ? inlineMarkdown(childNodes(element), ctx).replace(/\s+/g, ' ').trim() : '';
}

/**
 * TeX LaTeXML keeps for a `<math>`: the `application/x-tex` annotation, else `@alttext`.
 */
export function mathTex(math: Element): string {
  const annotation = Array.from(math.getElementsByTagName('annotation')).find(
    (a) => (a.getAttribute('encoding') ?? '').toLowerCase() === 'application/x-tex',
  );
  return (annotation?.textContent ?? math.getAttribute('alttext') ?? '').trim();
}

function inlineNode(node: Node, ctx: LatexmlContext): string {
  if (node.nodeType === TEXT_NODE) return escapeInline(node.textContent ?? '');
  if (!isElement(node)) return '';
  const tag = tagOf(node);
  if (SKIP_TAGS.has(tag)) return '';
  const inner = () => inlineMarkdown(childNodes(node), ctx);

  if (tag === 'math') return inlineMath(mathTex(node));
  // LaTeXML's marker for a macro it could not expand holds only the macro's name
  // (`\argmax`, `{inparablank}`); the content around it is converted as usual.
  if (hasClass(node, 'ltx_ERROR')) return '';
  if (hasClass(node, 'ltx_note')) {
    // Other note roles (thanks, affiliation and license notices, venue lines) are front matter.
    return hasClass(node, 'ltx_role_footnote') || hasClass(node, 'ltx_role_endnote')
      ? footnote(node, ctx)
      : '';
  }
  if (hasClass(node, 'ltx_font_bold') || tag === 'b' || tag === 'strong')
    return emphasis(inner(), '**');
  if (
    hasClass(node, 'ltx_font_italic') ||
    hasClass(node, 'ltx_emph') ||
    tag === 'em' ||
    tag === 'i'
  ) {
    return emphasis(inner(), '*');
  }
  if ((hasClass(node, 'ltx_font_typewriter') && tag !== 'a') || tag === 'code' || tag === 'tt') {
    // A typewriter link (`\url` sets its anchor in typewriter) keeps its link; typewriter text is code.
    return node.querySelector('a[href]') ? inner() : inlineCode(textOfElement(node));
  }

  switch (tag) {
    case 'sup':
      return superscript(escapeInline(textOfElement(node)), textOfElement(node), false);
    case 'sub':
      return subscript(escapeInline(textOfElement(node)), textOfElement(node));
    case 'a': {
      const href = node.getAttribute('href') ?? '';
      // Cross-references and citations point inside the page; they read as printed.
      if (!href || href.startsWith('#')) return inner();
      // `\url{example.org}` with no scheme is an address as written, not a path on the page.
      if (hasClass(node, 'ltx_url') && !/^[a-z][a-z\d+.-]*:/i.test(href))
        return inlineCode(textOfElement(node));
      return link(inner(), resolveUrl(href, ctx.baseUrl));
    }
    case 'br':
      return ' ';
    case 'img':
      return '';
    // Block-shaped elements met in an inline context (a tabular nested in a table
    // cell): space them so their words do not run together.
    case 'tr':
    case 'td':
    case 'th':
    case 'p':
    case 'div':
    case 'li':
      return ` ${inner()} `;
    default:
      return inner();
  }
}

/**
 * A footnote: its content collected into the document's footnotes, its mark left as a
 * superscript. LaTeXML repeats the mark inside the content; that copy is dropped.
 */
function footnote(note: Element, ctx: LatexmlContext): string {
  const mark = textOfElement(childWhere(note, (child) => hasClass(child, 'ltx_note_mark')));
  const content = note.querySelector('.ltx_note_content');
  if (content) {
    const parts = childNodes(content).filter(
      (child) =>
        !isElement(child) || !(hasClass(child, 'ltx_note_mark') || hasClass(child, 'ltx_tag_note')),
    );
    const text = inlineMarkdown(parts, ctx).replace(/\s+/g, ' ').trim();
    const id = note.getAttribute('id') ?? undefined;
    if (text) ctx.footnotes.push({ ...(id && { id }), ...(mark && { label: mark }), text });
  }
  return mark ? superscript(escapeInline(mark), mark, false) : '';
}
