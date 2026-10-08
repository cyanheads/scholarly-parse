/**
 * @fileoverview Inline Markdown for JATS mixed content: the text of paragraphs, titles,
 * captions, table cells, and list items with their emphasis, links, sub- and
 * superscripts, citation markers, and inline math.
 *
 * Block elements are the flow walk's job (`blocks.ts`). When one turns up somewhere
 * only inline content is expected — a list inside a title — it contributes its text.
 * @module src/formats/jats/inline
 */
import { escapeInline } from '../../render/escape.js';
import {
  collapseInline,
  emphasis,
  FORMULA_IMAGE,
  inlineCode,
  inlineMath,
  link,
  subscript,
  superscript,
} from '../../render/inline.js';
import { cleanTex, mathmlToTex } from '../../xml/mathml.js';
import {
  attrOf,
  childrenOf,
  collapseWhitespace,
  isTextNode,
  localNameOf,
  tagNameOf,
  textOf,
  type XmlNode,
  type XmlNodeList,
} from '../../xml/ordered.js';
import type { JatsContext } from './context.js';
import { citationMarkdown } from './references.js';
import {
  formulaTex,
  isTaxonPart,
  rawText,
  SILENT_TAGS,
  scriptPieces,
  selectAlternative,
  text,
} from './text.js';

/**
 * Elements that carry no formatting of their own: their content reads in place. Tags
 * outside this set and the explicit cases below are reported as unhandled.
 */
const TRANSPARENT_TAGS: ReadonlySet<string> = new Set([
  'abbrev',
  'addr-line',
  'award-group',
  'award-id',
  'funding-source',
  'funding-statement',
  'principal-award-recipient',
  'principal-investigator',
  'city',
  'country',
  'email',
  'fax',
  'glyph-data',
  'institution',
  'institution-wrap',
  'label',
  'named-content',
  'object-id',
  'overline',
  'phone',
  'postal-code',
  'private-char',
  'roman',
  'ruby',
  'sans-serif',
  'sc',
  'state',
  'styled-content',
  'underline',
  'x',
  // Elements that are blocks elsewhere but are read as text here.
  'p',
  'title',
  'caption',
  'def',
  'term',
  'list',
  'list-item',
  'def-list',
  'def-item',
  'disp-quote',
  'attrib',
  'statement',
  'boxed-text',
  'sec',
  'related-article',
  'related-object',
  'chem-struct',
  'chem-struct-wrap',
  'address',
  'bio',
  'speech',
  'speaker',
  'verse-group',
  'verse-line',
  // HTML headings in a fragment, read as `title` is.
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

/**
 * Blocks whose content reads as text with a space on each side, so the paragraphs of a
 * note, a definition, or a table cell read `One. Two.`, not `One.Two.`. A `<term>` is
 * left out: a `<def-item>` and the `<def>` after it space it already, and inline in a
 * paragraph a space would split `(<term>BMI</term>)`.
 */
const SPACED_TAGS: ReadonlySet<string> = new Set([
  'boxed-text',
  'def',
  'def-item',
  'disp-quote',
  'list-item',
  'p',
  'sec',
  'statement',
  'verse-line',
]);

function isCitationLink(node: XmlNode | undefined): boolean {
  return node !== undefined && tagNameOf(node) === 'xref' && attrOf(node, 'ref-type') === 'bibr';
}

/**
 * True when a letter or digit ends `before` and starts `after`, emphasis markers at the
 * seam set aside (`2008` then `*Jones*`): the two read as one word.
 */
function fuses(before: string, after: string): boolean {
  return (
    /[\p{L}\p{N}][*~]*$/u.test(before.slice(-8)) && /^[*~]*[\p{L}\p{N}]/u.test(after.slice(0, 8))
  );
}

/** True when a citation link's text holds a word (`Smith 2008`), not just a number (`12`, `S1`). */
function citesByName(text: string): boolean {
  return /\p{L}{2}/u.test(text);
}

/**
 * What goes between two siblings set with nothing between them, given what each reads as:
 * a space between the parts of a taxonomic name (`Vittiblatta` then `punctata`), and
 * between citation links whose text would otherwise fuse, the separator a citation list
 * uses — a comma between numbers (`[1,2,3]`, as Europe PMC's copy of an NCBI deposit
 * writes them), and `; ` once either link cites by name (`Smith 2008; Jones 2010`), as 72
 * of the corpus's 86 author-year citations the source separates are written.
 */
function siblingSeparator(
  previous: XmlNode | undefined,
  previousText: string,
  node: XmlNode,
  nodeText: string,
): string {
  if (isTaxonPart(previous) && isTaxonPart(node)) return ' ';
  if (!isCitationLink(previous) || !isCitationLink(node) || !fuses(previousText, nodeText))
    return '';
  return citesByName(previousText) || citesByName(nodeText) ? '; ' : ',';
}

/**
 * Inline Markdown for a node list, spacing intact (the caller collapses whitespace), with
 * the {@link siblingSeparator} between siblings that touch. An element that reads as
 * nothing (a `<target/>` anchor) does not stand between two siblings.
 */
export function inlineMarkdown(nodes: XmlNodeList, ctx: JatsContext): string {
  let out = '';
  let previous: XmlNode | undefined;
  let previousText = '';
  for (const node of nodes) {
    const piece = inlineNode(node, ctx);
    if (!piece) continue;
    out += siblingSeparator(previous, previousText, node, piece) + piece;
    previous = node;
    previousText = piece;
  }
  return out;
}

/** Inline Markdown for a node list, whitespace collapsed and trimmed. */
export function inlineText(input: XmlNode | XmlNodeList | undefined, ctx: JatsContext): string {
  if (!input) return '';
  const nodes = Array.isArray(input) ? input : childrenOf(input);
  return collapseInline(inlineMarkdown(nodes, ctx));
}

function inlineNode(node: XmlNode, ctx: JatsContext): string {
  if (isTextNode(node)) return escapeInline(textOf(node));
  const tag = tagNameOf(node) ?? '';
  if (SILENT_TAGS.has(tag)) return '';
  const children = childrenOf(node);

  switch (tag) {
    case 'italic':
    case 'em':
      return emphasis(inlineMarkdown(children, ctx), '*');
    case 'bold':
    case 'strong':
      return emphasis(inlineMarkdown(children, ctx), '**');
    case 'strike':
      return emphasis(inlineMarkdown(children, ctx), '~~');
    case 'monospace':
      return inlineCode(text(children));
    // Script content is plain text: emphasis inside a subscript (`*s*_*i*`) is noise.
    case 'sup': {
      const citations = isCitationGroup(children);
      if (citations) {
        const plain = citationGroupText(children);
        return superscript(escapeInline(plain), plain, true);
      }
      const { markdown, plain } = script(children);
      return superscript(markdown, plain, false);
    }
    case 'sub': {
      const { markdown, plain } = script(children);
      return subscript(markdown, plain);
    }
    case 'element-citation':
    case 'nlm-citation':
    case 'mixed-citation':
      // A citation inside running text (a dataset in a data-availability statement).
      return citationMarkdown(node);
    case 'hr':
      return ' ';
    case 'xref':
      return xref(node, children, ctx);
    case 'ext-link':
    case 'uri':
      return link(inlineMarkdown(children, ctx), attrOf(node, 'xlink:href') ?? text(children));
    case 'inline-formula':
    case 'disp-formula': {
      const parts = formulaParts(node, ctx);
      if (!parts) return '';
      if ('tex' in parts) return inlineMath(parts.tex);
      return 'text' in parts ? escapeInline(parts.text) : FORMULA_IMAGE;
    }
    case 'tex-math':
      return inlineMath(cleanTex(rawText(children)));
    case 'alternatives': {
      const chosen = selectAlternative(node);
      return chosen ? inlineNode(chosen, ctx) : '';
    }
    case 'inline-graphic':
    case 'graphic':
    case 'media':
    case 'inline-media':
    case 'alt-text':
    case 'long-desc':
      return '';
    case 'break':
    case 'br':
      return ' ';
    case 'fn':
      return inlineFootnote(node, ctx);
    default: {
      if (localNameOf(node) === 'math') return inlineMath(mathmlToTex(node));
      if (!TRANSPARENT_TAGS.has(tag)) ctx.diag.unhandled(`jats:${tag}`);
      const content = inlineMarkdown(children, ctx);
      return SPACED_TAGS.has(tag) ? ` ${content} ` : content;
    }
  }
}

/**
 * A sub- or superscript's content as plain text, and as Markdown: its text escaped, with a
 * link that has no text of its own written as `link` writes one, so its target neither
 * goes missing nor runs into the text after it.
 */
function script(children: XmlNodeList): { markdown: string; plain: string } {
  const pieces = scriptPieces(children);
  const markdown = pieces
    .map((piece) =>
      'target' in piece ? link('', piece.target) : escapeInline(piece.text.replace(/\s+/g, ' ')),
    )
    .join('');
  const plain = pieces.map((piece) => ('target' in piece ? piece.target : piece.text)).join('');
  return { markdown, plain: collapseWhitespace(plain) };
}

/**
 * An `<xref>` reads as the text the source prints for it. A citation link whose only
 * content is a superscript number is a bracketed marker, like a superscript made of
 * citation links.
 */
function xref(node: XmlNode, children: XmlNodeList, ctx: JatsContext): string {
  const only = children.filter((c) => !isTextNode(c) || textOf(c).trim() !== '');
  const [first] = only;
  if (
    attrOf(node, 'ref-type') === 'bibr' &&
    only.length === 1 &&
    first &&
    tagNameOf(first) === 'sup'
  ) {
    return superscript('', text(first), true);
  }
  return inlineMarkdown(children, ctx);
}

/**
 * True when a superscript holds nothing but citation links, the punctuation between them,
 * and anchors with no text: `<sup><xref ref-type="bibr">1</xref>,<xref …>2</xref></sup>`.
 */
function isCitationGroup(children: XmlNodeList): boolean {
  let links = 0;
  for (const child of children) {
    if (isTextNode(child)) {
      if (!/^[\s,;‒–—-]*$/.test(textOf(child))) return false;
      continue;
    }
    if (SILENT_TAGS.has(tagNameOf(child) ?? '')) continue;
    if (!isCitationLink(child)) return false;
    links++;
  }
  return links > 0;
}

/**
 * A citation group's text, with the {@link siblingSeparator} between links that touch or
 * sit apart only by whitespace: the marker drops whitespace, which would fuse them too.
 */
function citationGroupText(children: XmlNodeList): string {
  let out = '';
  let previous: XmlNode | undefined;
  let previousText = '';
  for (const child of children) {
    const piece = rawText(child).trim();
    if (!piece) continue;
    out += siblingSeparator(previous, previousText, child, piece) + piece;
    previous = child;
    previousText = piece;
  }
  return out;
}

/** Elements a formula can be published as an image through. */
const FORMULA_IMAGE_TAGS: ReadonlySet<string> = new Set(['graphic', 'inline-graphic', 'media']);

/**
 * A formula's content: TeX from its `<tex-math>` (directly or under `<alternatives>`),
 * else its MathML converted to TeX, else its plain text. A formula published only as an
 * image (Europe PMC serves many that way) yields the image's file, reported as
 * `math-without-tex`: its content is not in the text. Undefined for an empty formula.
 */
export function formulaParts(
  formula: XmlNode,
  ctx: JatsContext,
): { tex: string } | { text: string } | { href: string } | undefined {
  const children = childrenOf(formula).filter((c) => tagNameOf(c) !== 'label');
  const tex = formulaTex(children);
  if (tex) return { tex };
  const plain = text(children.filter((c) => !FORMULA_IMAGE_TAGS.has(tagNameOf(c) ?? '')));
  if (plain) return { text: plain };
  const href = imageOf(children);
  if (!href) return;
  const id = attrOf(formula, 'id');
  ctx.diag.warn('math-without-tex', `A formula is published only as an image (${href})`, id);
  return { href };
}

function imageOf(children: XmlNodeList): string | undefined {
  for (const child of children) {
    const tag = tagNameOf(child) ?? '';
    const href = FORMULA_IMAGE_TAGS.has(tag)
      ? attrOf(child, 'xlink:href')
      : tag === 'alternatives'
        ? imageOf(childrenOf(child))
        : undefined;
    if (href) return href;
  }
  return;
}

/** An inline `<fn>` is collected as a footnote and leaves its label as a marker. */
function inlineFootnote(node: XmlNode, ctx: JatsContext): string {
  const label = text(childrenOf(node).filter((c) => tagNameOf(c) === 'label')) || undefined;
  const body = inlineText(
    childrenOf(node).filter((c) => tagNameOf(c) !== 'label'),
    ctx,
  );
  const id = attrOf(node, 'id');
  if (body) ctx.footnotes.push({ ...(id && { id }), ...(label && { label }), text: body });
  return label ? superscript(escapeInline(label), label, false) : '';
}
