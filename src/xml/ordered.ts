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
import { MAX_XML_DEPTH } from '../model/limits.js';
import { declarationEnd, findMarkupFault, startTagEnd } from './well-formed.js';

/** A node in the ordered tree: an element `{ tag: Node[], ':@'?: attrs }` or text `{ '#text': v }`. */
export type XmlNode = Record<string, unknown>;

/** An ordered sibling list — every children array, and the document root. */
export type XmlNodeList = XmlNode[];

const ATTR_KEY = ':@';
const TEXT_KEY = '#text';

/**
 * Parser options shared by every XML format.
 * - `parseTagValue: false` keeps bibliographic tokens verbatim: page ranges like
 *   `4002.e26` and labels like `1.` would otherwise coerce to numbers.
 * - `trimValues: false` keeps the spacing between text and adjacent inline elements.
 * - Entity processing stays on because publishers use character references for
 *   punctuation and diacritics, with expansion capped against entity-expansion attacks.
 *   The cap counts only entities a DOCTYPE declares (`appliesTo: 'external'`), the only
 *   ones that expand past a character or two; counting `&amp;` and `&#233;` too would
 *   reject a large article for its punctuation. External entities are never fetched.
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
    appliesTo: 'external',
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
    return { nodes: new XMLParser(config).parse(prepareForParser(text)) as XmlNodeList };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The text with three rewrites the parser cannot make itself, in one pass:
 * - Every character reference to a code point no document can hold — U+0000, a surrogate,
 *   or one past U+10FFFF — becomes a reference to U+FFFD, the replacement character, which
 *   is how the HTML parsers decode all three. The XML decoder would drop the first two and
 *   leave the third as text. Digits run no longer than the decoder reads a reference.
 * - A `<?CDATA …?>` processing instruction becomes the CDATA section it stands for: IOP's
 *   Crossref deposits carry a formula's TeX that way, and fast-xml-parser keeps no
 *   instruction's content. A `]]>` in the content is split across two sections. Every
 *   other instruction stays as written, for the parser to ignore.
 * - A processing instruction in a DOCTYPE's internal subset is removed: fast-xml-parser
 *   fails the whole document on one (`Invalid DOCTYPE`), and an instruction declares
 *   nothing the parser reads.
 *
 * CDATA sections, comments, and instructions are skipped, since a reference or a
 * `<?CDATA` there is text as written. A start tag or a declaration is read whole, quoted
 * values included, as the well-formedness check reads it: a `<!--`, `<?`, or `<![CDATA[`
 * inside an attribute value or an entity's replacement text opens nothing, so it cannot
 * move where the pass resumes into a CDATA section and end it early. Only the tag's or
 * declaration's character references are rewritten. The text has passed the
 * well-formedness check, so each of them is terminated.
 */
function prepareForParser(text: string): string {
  if (!text.includes('&#') && !text.includes('<?CDATA') && !doctypeHoldsInstruction(text))
    return text;
  const pattern =
    /&#(?:[xX]([\dA-Fa-f]{1,30})|(\d{1,31}));|<!\[CDATA\[|<!--|<\?|<!|<[A-Za-z_:À-￿]/g;
  let out = '';
  let copied = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const [token, hex, decimal] = match;
    if (token === '<?') {
      const start = pattern.lastIndex;
      const end = text.indexOf('?>', start);
      if (end === -1) break;
      pattern.lastIndex = end + 2;
      if (!isCdataInstruction(text, start, end)) continue;
      const content = text.slice(start + 5, end).replace(/^[ \t\r\n]+/, '');
      out += `${text.slice(copied, match.index)}<![CDATA[${content.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
      copied = pattern.lastIndex;
      continue;
    }
    if (token === '<!--' || token === '<![CDATA[') {
      const end = text.indexOf(token === '<!--' ? '-->' : ']]>', pattern.lastIndex);
      if (end === -1) break;
      pattern.lastIndex = end + 3;
      continue;
    }
    if (token.startsWith('<')) {
      const end =
        token === '<!' ? declarationEnd(text, match.index + 2) : startTagEnd(text, match.index + 1);
      if (end === -1) break;
      const span = text.slice(match.index, end + 1);
      out +=
        text.slice(copied, match.index) +
        withValidReferences(token === '<!' ? withoutInstructions(span) : span);
      copied = end + 1;
      pattern.lastIndex = end + 1;
      continue;
    }
    if (isUnreadable(hex, decimal)) {
      out += `${text.slice(copied, match.index)}&#xFFFD;`;
      copied = pattern.lastIndex;
    }
  }
  return out + text.slice(copied);
}

/**
 * True when the first `<!DOCTYPE` holds a processing instruction. Only then does a document
 * without references to rewrite need the pass.
 */
function doctypeHoldsInstruction(text: string): boolean {
  const at = text.indexOf('<!DOCTYPE');
  if (at === -1) return false;
  const instruction = text.indexOf('<?', at);
  return instruction !== -1 && instruction < declarationEnd(text, at + 2);
}

/**
 * A declaration with each processing instruction in it removed, quoted values and comments
 * read as written. The declaration has passed the well-formedness check, which skips each
 * instruction and comment whole, so every one of them is terminated inside it.
 */
function withoutInstructions(declaration: string): string {
  if (!declaration.includes('<?')) return declaration;
  let out = '';
  let copied = 0;
  let quote = '';
  for (let i = 0; i < declaration.length; i++) {
    const char = declaration[i];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (declaration.startsWith('<!--', i)) {
      i = declaration.indexOf('-->', i + 4) + 2;
    } else if (declaration.startsWith('<?', i)) {
      out += declaration.slice(copied, i);
      copied = declaration.indexOf('?>', i + 2) + 2;
      i = copied - 1;
    }
  }
  return out + declaration.slice(copied);
}

/** `span` with each reference to a code point no document can hold rewritten as `&#xFFFD;`. */
function withValidReferences(span: string): string {
  if (!span.includes('&#')) return span;
  return span.replace(
    /&#(?:[xX]([\dA-Fa-f]{1,30})|(\d{1,31}));/g,
    (reference, hex: string | undefined, decimal: string | undefined) =>
      isUnreadable(hex, decimal) ? '&#xFFFD;' : reference,
  );
}

/** True when a reference's hex or decimal digits name U+0000, a surrogate, or a code point past U+10FFFF. */
function isUnreadable(hex: string | undefined, decimal: string | undefined): boolean {
  const code = hex === undefined ? Number.parseInt(decimal ?? '', 10) : Number.parseInt(hex, 16);
  return code === 0 || (code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff;
}

/** True when the instruction whose target starts at `start` and which ends at `end` is `CDATA`. */
function isCdataInstruction(text: string, start: number, end: number): boolean {
  return (
    text.startsWith('CDATA', start) &&
    (start + 5 === end || /[ \t\r\n]/.test(text[start + 5] ?? ''))
  );
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
