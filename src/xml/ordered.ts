/**
 * @fileoverview Bounded XML parsing into fast-xml-parser's ordered tree, and the node
 * helpers every XML format parser walks it with.
 *
 * Ordered mode (`preserveOrder: true`) is required for mixed content: in
 * `<p>text <italic>inline</italic> more</p>` the default object shape collapses all
 * text under one `#text` key and loses where the inline child sat. Each element node
 * is `{ tagName: Node[] }` with attributes under `:@`; a text node is `{ '#text': v }`.
 * @module src/xml/ordered
 */
import { XMLParser } from 'fast-xml-parser';
import { findMarkupFault } from './well-formed.js';

/** A node in the ordered tree: an element `{ tag: Node[], ':@'?: attrs }` or text `{ '#text': v }`. */
export type XmlNode = Record<string, unknown>;

/** An ordered sibling list — every children array, and the document root. */
export type XmlNodeList = XmlNode[];

const ATTR_KEY = ':@';
const TEXT_KEY = '#text';

/**
 * Deepest element nesting accepted. Real articles stay far shallower — body, section,
 * paragraph, and inline markup rarely pass 20 levels, and the deepest MathML seen
 * stays under 60 — so this bounds hostile input and the recursive walks over it.
 */
export const MAX_XML_DEPTH = 256;

/**
 * Parser options shared by every XML format.
 * - `parseTagValue: false` keeps bibliographic tokens verbatim: page ranges like
 *   `4002.e26` and labels like `1.` would otherwise coerce to numbers.
 * - `trimValues: false` keeps the spacing between text and adjacent inline elements.
 * - Entity processing stays on because publishers use character references for
 *   punctuation and diacritics, with expansion capped against entity-expansion attacks.
 *   External entities are never fetched.
 */
const PARSER_OPTIONS = {
  attributeNamePrefix: '@_',
  htmlEntities: true,
  ignoreAttributes: false,
  ignorePiTags: true,
  maxNestedTags: MAX_XML_DEPTH,
  parseAttributeValue: false,
  parseTagValue: false,
  preserveOrder: true,
  processEntities: {
    enabled: true,
    maxEntityCount: 1_000,
    maxEntitySize: 10_000,
    maxTotalExpansions: 100_000,
  },
  trimValues: false,
} as const;

/**
 * Parse XML text into the ordered tree, or return why it could not be: a well-formedness
 * fault (checked first, since the parser tolerates them silently) or the parser's error. With
 * `lowercaseTags`, element names are lowercased so one reader serves a vocabulary that
 * reaches us in more than one casing (TEI's `<teiHeader>` and `<teiheader>`).
 */
export function parseOrderedXml(
  text: string,
  options: { lowercaseTags?: boolean } = {},
): { nodes: XmlNodeList } | { error: string } {
  const fault = findMarkupFault(text);
  if (fault) return { error: fault };
  const config = options.lowercaseTags
    ? { ...PARSER_OPTIONS, transformTagName: (name: string) => name.toLowerCase() }
    : PARSER_OPTIONS;
  try {
    return { nodes: new XMLParser(config).parse(text) as XmlNodeList };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Tag name of an element; undefined for a text node. */
export function tagNameOf(node: XmlNode): string | undefined {
  for (const key in node) {
    if (key !== ATTR_KEY && key !== TEXT_KEY) return key;
  }
  return;
}

/** Tag name without a namespace prefix: `mml:math` → `math`. */
export function localNameOf(node: XmlNode): string | undefined {
  const tag = tagNameOf(node);
  if (!tag) return;
  const colon = tag.indexOf(':');
  return colon === -1 ? tag : tag.slice(colon + 1);
}

/** Ordered children of an element; empty for a text node. */
export function childrenOf(node: XmlNode | undefined): XmlNodeList {
  if (!node) return [];
  const tag = tagNameOf(node);
  if (!tag) return [];
  const value = node[tag];
  return Array.isArray(value) ? (value as XmlNodeList) : [];
}

/** Attribute value by its source name (`id`, `xlink:href`), without the parser's prefix. */
export function attrOf(node: XmlNode | undefined, name: string): string | undefined {
  const attrs = node?.[ATTR_KEY] as Record<string, unknown> | undefined;
  const value = attrs?.[`@_${name}`];
  return value == null ? undefined : String(value);
}

/** True for a text node. */
export function isTextNode(node: XmlNode): boolean {
  return TEXT_KEY in node;
}

/** The string value of a text node, without soft hyphens (they only mark where a word may break). */
export function textOf(node: XmlNode): string {
  const value = node[TEXT_KEY];
  return value == null ? '' : String(value).replace(/\u00AD/g, '');
}

/** A sibling list as given, or an element's children. */
function listOf(input: XmlNode | XmlNodeList | undefined): XmlNodeList {
  return Array.isArray(input) ? input : childrenOf(input);
}

/** First direct child with the given tag. */
export function findOne(
  input: XmlNode | XmlNodeList | undefined,
  tag: string,
): XmlNode | undefined {
  return listOf(input).find((c) => tagNameOf(c) === tag);
}

/** Every direct child with the given tag. */
export function findAll(input: XmlNode | XmlNodeList | undefined, tag: string): XmlNode[] {
  return listOf(input).filter((c) => tagNameOf(c) === tag);
}

/**
 * Every descendant with the given tag, in document order, descending through matches
 * so a container nested in another of the same tag is reported too.
 */
export function findAllDescendants(
  input: XmlNode | XmlNodeList | undefined,
  tag: string,
): XmlNode[] {
  const found: XmlNode[] = [];
  const visit = (nodes: XmlNodeList): void => {
    for (const node of nodes) {
      if (tagNameOf(node) === tag) found.push(node);
      visit(childrenOf(node));
    }
  };
  visit(listOf(input));
  return found;
}

/** First descendant with the given tag, breadth-first, no deeper than `maxDepth`. */
export function findDescendant(
  input: XmlNodeList,
  tag: string,
  maxDepth: number,
): XmlNode | undefined {
  let level = input;
  for (let depth = 0; depth <= maxDepth && level.length > 0; depth++) {
    const hit = level.find((node) => tagNameOf(node) === tag);
    if (hit) return hit;
    level = level.flatMap((node) => childrenOf(node));
  }
  return;
}

/** Collapse whitespace runs to one space and trim. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
