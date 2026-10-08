/**
 * @fileoverview Plain text of JATS nodes, for fields that are values rather than prose:
 * names, identifiers, dates, keywords, table-cell text used as a label.
 *
 * Two elements do not contribute the plain concatenation of their subtree: a
 * `<tex-math>` contributes only the expression inside its LaTeX document wrapper, and
 * an `<alternatives>` contributes exactly one of its equivalent renderings.
 * (pubmed-mcp-server#135)
 * @module src/formats/jats/text
 */
import { isSafeUrl } from '../../render/escape.js';
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

/** Pointers to an external rendering: a file reference, not a rendering itself. */
const POINTER_TAGS: ReadonlySet<string> = new Set([
  'graphic',
  'inline-graphic',
  'media',
  'inline-media',
]);

/**
 * Elements whose text is never content: index entries, alternative-text anchors, and
 * an institution's registry ID beside the name it identifies.
 */
export const SILENT_TAGS: ReadonlySet<string> = new Set([
  'index-term',
  'index-term-range-end',
  'institution-id',
  'target',
]);

/**
 * The child of an `<alternatives>` whose text stands for the whole element: a
 * `<tex-math>` with content first, then any non-pointer rendering with text, then a
 * pointer's own alt text. Undefined when no child carries text under `excluded`.
 */
export function selectAlternative(
  node: XmlNode,
  excluded?: ReadonlySet<string>,
): XmlNode | undefined {
  return pickAlternative(node, excluded)?.node;
}

/**
 * {@link selectAlternative} with the chosen child's text. Each child's text is read once,
 * so nested `<alternatives>` cost one pass rather than one per level above them.
 */
function pickAlternative(
  node: XmlNode,
  excluded: ReadonlySet<string> | undefined,
): { node: XmlNode; text: string } | undefined {
  const withText = childrenOf(node)
    .map((child) => ({ node: child, text: concatText(child, excluded) }))
    .filter((child) => child.text.trim() !== '');
  return (
    withText.find((child) => tagNameOf(child.node) === 'tex-math') ??
    withText.find((child) => !POINTER_TAGS.has(tagNameOf(child.node) ?? '')) ??
    withText[0]
  );
}

/** Ranks a taxonomic name's parts are tagged with (`<named-content content-type="genus">`). */
const TAXON_RANKS: ReadonlySet<string> = new Set([
  'kingdom',
  'phylum',
  'class',
  'superorder',
  'order',
  'suborder',
  'superfamily',
  'family',
  'subfamily',
  'tribe',
  'genus',
  'subgenus',
  'species',
  'subspecies',
  'variety',
  'form',
  'taxon-authority',
  'taxon-status',
]);

/** True for one part of a taxonomic name: a `<named-content>` typed with its rank. */
export function isTaxonPart(node: XmlNode | undefined): boolean {
  return (
    node !== undefined &&
    tagNameOf(node) === 'named-content' &&
    TAXON_RANKS.has(attrOf(node, 'content-type') ?? '')
  );
}

/**
 * The text of `input`. Parts of a taxonomic name set with nothing between them
 * (`Protagonista` then `lugubris`) are separate words; an element that contributes no
 * text never stands between two of them.
 */
function concatText(input: XmlNode | XmlNodeList, excluded?: ReadonlySet<string>): string {
  const nodes = Array.isArray(input) ? input : [input];
  let out = '';
  let previous: XmlNode | undefined;
  for (const node of nodes) {
    if (isTextNode(node)) {
      out += textOf(node);
      previous = node;
      continue;
    }
    const tag = tagNameOf(node) ?? '';
    if (excluded?.has(tag) || SILENT_TAGS.has(tag)) continue;
    if (isTaxonPart(previous) && isTaxonPart(node)) out += ' ';
    previous = node;
    if (tag === 'tex-math') {
      out += cleanTex(concatText(childrenOf(node)));
    } else if (tag === 'alternatives') {
      out += pickAlternative(node, excluded)?.text ?? '';
    } else {
      out += concatText(childrenOf(node), excluded);
    }
  }
  return out;
}

/** Elements that read as links, with their `xlink:href` as the target. */
export const LINK_TAGS: ReadonlySet<string> = new Set(['ext-link', 'uri']);

/** A piece of a sub- or superscript's text: text, or the target of a link that has none. */
export type ScriptPiece = { target: string } | { text: string };

/**
 * The text of a sub- or superscript in pieces, spacing intact: runs of text as
 * {@link rawText} reads them, and apart from them each link with no text of its own, as its
 * target, which `link` writes in its place.
 */
export function scriptPieces(input: XmlNodeList): ScriptPiece[] {
  const pieces: ScriptPiece[] = [];
  let run = '';
  const walk = (nodes: XmlNodeList) => {
    let previous: XmlNode | undefined;
    for (const node of nodes) {
      const tag = isTextNode(node) ? '' : (tagNameOf(node) ?? '');
      if (SILENT_TAGS.has(tag)) continue;
      if (isTaxonPart(previous) && isTaxonPart(node)) run += ' ';
      previous = node;
      const target = LINK_TAGS.has(tag) ? attrOf(node, 'xlink:href') : undefined;
      const content = target ? concatText(childrenOf(node)) : '';
      // As `link` writes it: a safe link with blank text as its target, any other with none.
      if (target && (isSafeUrl(target) ? content.trim() : content) === '') {
        pieces.push({ text: run }, { target });
        run = '';
      } else if (isTextNode(node) || tag === 'tex-math' || tag === 'alternatives') {
        run += concatText(node);
      } else {
        walk(childrenOf(node));
      }
    }
  };
  walk(input);
  pieces.push({ text: run });
  return pieces;
}

/** Text in document order with source spacing intact — no collapsing, no trimming. */
export function rawText(
  input: XmlNode | XmlNodeList | undefined,
  excluded?: ReadonlySet<string>,
): string {
  return input ? concatText(input, excluded) : '';
}

/** Text in document order, whitespace collapsed and trimmed. */
export function text(
  input: XmlNode | XmlNodeList | undefined,
  excluded?: ReadonlySet<string>,
): string {
  return input ? collapseWhitespace(concatText(input, excluded)) : '';
}

/**
 * A formula's TeX, from the children of its `<inline-formula>` or `<disp-formula>`: its
 * `<tex-math>` (directly or under `<alternatives>`), else its MathML converted. Undefined
 * when it has neither.
 */
export function formulaTex(children: XmlNodeList): string | undefined {
  return texOf(children) ?? mathOf(children);
}

function texOf(children: XmlNodeList): string | undefined {
  for (const child of children) {
    const tag = tagNameOf(child);
    const tex =
      tag === 'tex-math'
        ? cleanTex(rawText(childrenOf(child)))
        : tag === 'alternatives'
          ? texOf(childrenOf(child))
          : undefined;
    if (tex) return tex;
  }
  return;
}

function mathOf(children: XmlNodeList): string | undefined {
  for (const child of children) {
    const tex =
      localNameOf(child) === 'math'
        ? mathmlToTex(child)
        : tagNameOf(child) === 'alternatives'
          ? mathOf(childrenOf(child))
          : undefined;
    if (tex) return tex;
  }
  return;
}
