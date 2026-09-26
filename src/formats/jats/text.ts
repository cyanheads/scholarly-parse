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
import { cleanTex, mathmlToTex } from '../../xml/mathml.js';
import {
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
  const children = childrenOf(node);
  const carriesText = (child: XmlNode) => concatText(child, excluded).trim() !== '';
  return (
    children.find((child) => tagNameOf(child) === 'tex-math' && carriesText(child)) ??
    children.find((child) => !POINTER_TAGS.has(tagNameOf(child) ?? '') && carriesText(child)) ??
    children.find(carriesText)
  );
}

function concatText(input: XmlNode | XmlNodeList, excluded?: ReadonlySet<string>): string {
  const nodes = Array.isArray(input) ? input : [input];
  let out = '';
  for (const node of nodes) {
    if (isTextNode(node)) {
      out += textOf(node);
      continue;
    }
    const tag = tagNameOf(node) ?? '';
    if (excluded?.has(tag) || SILENT_TAGS.has(tag)) continue;
    if (tag === 'tex-math') {
      out += cleanTex(concatText(childrenOf(node)));
    } else if (tag === 'alternatives') {
      const chosen = selectAlternative(node, excluded);
      if (chosen) out += concatText(chosen, excluded);
    } else {
      out += concatText(childrenOf(node), excluded);
    }
  }
  return out;
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

/** {@link text}, or undefined when empty. */
export function optionalText(input: XmlNode | XmlNodeList | undefined): string | undefined {
  return text(input) || undefined;
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
