/**
 * @fileoverview HTML → DOM through the optional `linkedom` peer, loaded on first use,
 * and the node helpers the HTML-based parsers walk it with. `linkedom` runs on Bun,
 * Node, and Workers without a browser.
 * @module src/html/dom
 */

import { MAX_XML_DEPTH } from '../model/limits.js';
import { MissingPeerError } from '../model/result.js';

type LinkedomModule = { parseHTML: (html: string) => { document: Document } };

let linkedom: Promise<LinkedomModule> | undefined;

/**
 * Parse HTML into a document. Throws when `linkedom` is not installed — a setup error,
 * not a property of the input.
 *
 * `linkedom` splits text at every entity (`&lt;bos&gt;` arrives as `<`, `bos`, `>`), and
 * a lone `<` escapes as plain text that the next node then turns into a tag. Merging
 * adjacent text nodes lets escaping see each run whole.
 */
async function loadDocument(html: string): Promise<Document> {
  linkedom ??= (import('linkedom') as Promise<LinkedomModule>).catch((error: unknown) => {
    linkedom = undefined;
    throw new MissingPeerError('Install "linkedom" to parse HTML: bun add linkedom', {
      cause: error,
    });
  });
  const { document } = (await linkedom).parseHTML(html);
  document.documentElement?.normalize();
  return document;
}

/**
 * Parse HTML into a document no element of which nests deeper than `MAX_XML_DEPTH`, and
 * count the tags left out to get there. Each tag of an element that would open deeper is
 * removed before `linkedom` parses, its text kept (see {@link boundNesting}): the DOM
 * engine and every recursive walk over its tree then work at a depth real pages never
 * reach, in time linear in the page. Throws as {@link loadDocument} does.
 */
export async function loadBoundedDocument(
  html: string,
): Promise<{ document: Document; droppedTags: number }> {
  const bounded = boundNesting(html, MAX_XML_DEPTH);
  return { document: await loadDocument(bounded.html), droppedTags: bounded.dropped };
}

/** The `truncated-input` warning for a page {@link loadBoundedDocument} dropped tags from. */
export function truncatedNestingMessage(droppedTags: number): string {
  return `Markup nested deeper than ${MAX_XML_DEPTH} levels: ${droppedTags} tags left out, their text kept`;
}

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
/** A CDATA section's node type: text that `textContent` counts, as it does a text node's. */
export const CDATA_SECTION_NODE = 4;
export const COMMENT_NODE = 8;

/** True for an element node. */
export function isElement(node: Node): node is Element {
  return node.nodeType === ELEMENT_NODE;
}

/** Lowercase tag name. */
export function tagOf(element: Element): string {
  return element.tagName.toLowerCase();
}

/** True when the element carries the class. */
export function hasClass(element: Element, name: string): boolean {
  return element.classList.contains(name);
}

/** Child nodes as an array. */
export function childNodes(node: Node): Node[] {
  return Array.from(node.childNodes);
}

/** Child elements as an array. */
export function childElements(element: Element): Element[] {
  return Array.from(element.children);
}

/** First child element matching the predicate. */
export function childWhere(
  element: Element,
  test: (child: Element) => boolean,
): Element | undefined {
  return childElements(element).find(test);
}

/** Text content with whitespace collapsed. */
export function textOfElement(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Resolve a URL against a base; unchanged when there is no base or it does not parse. */
export function resolveUrl(url: string, base: string | undefined): string {
  if (!base) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

// ─── Nesting bound ──────────────────────────────────────────────────────────
//
// The scan mirrors how htmlparser2 10.1.0, which `linkedom` parses with, reads markup and
// keeps its stack of open elements, so the depth it counts is the depth `linkedom` builds.
// The HTML standard's tree builder would count differently: htmlparser2 closes an element
// implicitly only while it is innermost (`<p><li><td>` repeated nests), and reads `<x/>`
// as an open tag outside `<math>` and `<svg>`.

/** Elements htmlparser2 never puts on its stack. */
const VOID_TAGS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'basefont',
  'br',
  'col',
  'command',
  'embed',
  'frame',
  'hr',
  'img',
  'input',
  'isindex',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const P_TAG: ReadonlySet<string> = new Set(['p']);
const FORM_TAGS: ReadonlySet<string> = new Set([
  'button',
  'datalist',
  'input',
  'optgroup',
  'option',
  'select',
  'textarea',
]);
const TABLE_SECTIONS: ReadonlySet<string> = new Set(['tbody', 'thead']);
const DEFINITION_TAGS: ReadonlySet<string> = new Set(['dd', 'dt']);
const RUBY_TAGS: ReadonlySet<string> = new Set(['rp', 'rt']);

/** For each tag, the elements its open tag closes while one of them is innermost. */
const IMPLIED_CLOSES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['tr', new Set(['td', 'th', 'tr'])],
  ['th', new Set(['th'])],
  ['td', new Set(['td', 'th', 'thead'])],
  ['body', new Set(['head', 'link', 'script'])],
  ['li', new Set(['li'])],
  ...['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((tag): [string, ReadonlySet<string>] => [
    tag,
    P_TAG,
  ]),
  ...['select', 'input', 'output', 'button', 'datalist', 'textarea'].map(
    (tag): [string, ReadonlySet<string>] => [tag, FORM_TAGS],
  ),
  ['option', new Set(['option'])],
  ['optgroup', new Set(['optgroup', 'option'])],
  ['dd', DEFINITION_TAGS],
  ['dt', DEFINITION_TAGS],
  ...[
    'address',
    'article',
    'aside',
    'blockquote',
    'details',
    'div',
    'dl',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'header',
    'hr',
    'main',
    'nav',
    'ol',
    'pre',
    'section',
    'table',
    'ul',
  ].map((tag): [string, ReadonlySet<string>] => [tag, P_TAG]),
  ['rt', RUBY_TAGS],
  ['rp', RUBY_TAGS],
  ['tbody', TABLE_SECTIONS],
  ['tfoot', TABLE_SECTIONS],
]);

/** Elements whose content is foreign, where `<x/>` closes itself. */
const FOREIGN_TAGS: ReadonlySet<string> = new Set(['math', 'svg']);

/** Elements whose content is HTML again inside foreign content. */
const INTEGRATION_TAGS: ReadonlySet<string> = new Set([
  'annotation-xml',
  'desc',
  'foreignobject',
  'mi',
  'mn',
  'mo',
  'ms',
  'mtext',
  'title',
]);

/**
 * Raw-text elements, by the names htmlparser2 recognizes them by, each with the close tag
 * that ends its text. The tokenizer matches a name letter by letter and takes one branch
 * for a name opening with `t` or `x`, so `<xitle>` is read as raw text to `</title>`.
 */
const RAW_TEXT: ReadonlyMap<string, string> = new Map([
  ['script', 'script'],
  ['style', 'style'],
  ['title', 'title'],
  ['xitle', 'title'],
  ['textarea', 'textarea'],
  ['xextarea', 'textarea'],
  ['xmp', 'xmp'],
  ['tmp', 'xmp'],
]);

const LT = 0x3c;
const GT = 0x3e;
const SLASH = 0x2f;
const EXCLAMATION = 0x21;
const QUESTION = 0x3f;
const QUOTE = 0x22;
const APOSTROPHE = 0x27;
const EQUALS = 0x3d;

/** An open tag's name: up to a space, `/`, or `>`. A close tag's: up to a space or `>`. */
const OPEN_NAME = /[^\t\n\f\r />]*/y;
const CLOSE_NAME = /[^\t\n\f\r >]*/y;

function isSpace(code: number): boolean {
  return code === 0x20 || code === 0x0a || code === 0x09 || code === 0x0c || code === 0x0d;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
}

/** Where a sticky pattern's match from `from` ends. */
function matchEnd(pattern: RegExp, text: string, from: number): number {
  pattern.lastIndex = from;
  pattern.exec(text);
  return pattern.lastIndex;
}

/** The index after the first `token` at or past `from`; the end of the text when there is none. */
function after(text: string, token: string, from: number): number {
  const at = text.indexOf(token, from);
  return at === -1 ? text.length : at + token.length;
}

interface NestingScan {
  copied: number;
  dropped: number;
  /** The same flags as the source parses, for the elements that were dropped. */
  readonly foreignAll: boolean[];
  /** htmlparser2's foreign-content flags, innermost last, as the output parses. */
  readonly foreignKept: boolean[];
  readonly html: string;
  /** How many of the elements at the bottom of `open` the output keeps; those above were dropped. */
  kept: number;
  readonly max: number;
  /** Open element names, innermost last. */
  readonly open: string[];
  /** Each name's indexes in `open`, so a close tag finds its element in one step. */
  readonly openAt: Map<string, number[]>;
  /** The output so far, and how much of the source it covers. */
  readonly out: string[];
}

/**
 * `html` with the tags of every element that would open deeper than `max` levels taken
 * out, and how many tags that was. Each tag removed becomes a space, so the words either
 * side stay apart, and the element's text stays where it was; a close tag whose open tag
 * was removed goes too, and so does every tag inside its element. One pass, in time
 * linear in the markup: an element is found by name in one step rather than by searching
 * the stack, as htmlparser2 does per close tag.
 *
 * htmlparser2 also keeps a stack of foreign-content flags, which it grows by `unshift`: a
 * `<math>`, `<svg>`, or element of {@link INTEGRATION_TAGS} adds one, and only a close tag
 * of one of those names removes one, so each element of them that closes otherwise (`<math/>`,
 * `<b><mi></b>`) leaves its flag behind. Past `max` flags, such an element is removed too.
 *
 * Text htmlparser2 reads raw (`<script>`, `<style>`, `<title>`, `<textarea>`, `<xmp>`) and
 * comments hold no tags. A raw-text element that is itself removed loses its content when
 * that is code (script, style) and keeps it, escaped, otherwise.
 */
export function boundNesting(html: string, max: number): { html: string; dropped: number } {
  const scan: NestingScan = {
    copied: 0,
    dropped: 0,
    foreignAll: [false],
    foreignKept: [false],
    html,
    kept: 0,
    max,
    open: [],
    openAt: new Map(),
    out: [],
  };
  for (let at = html.indexOf('<'); at !== -1 && at < html.length; at = html.indexOf('<', at)) {
    at = readMarkup(scan, at);
  }
  if (scan.dropped === 0) return { dropped: 0, html };
  scan.out.push(html.slice(scan.copied));
  return { dropped: scan.dropped, html: scan.out.join('') };
}

/** Read the markup a `<` opens, if any; returns where text resumes. */
function readMarkup(scan: NestingScan, lt: number): number {
  const { html } = scan;
  const next = html.charCodeAt(lt + 1);
  if (next === EXCLAMATION) return declarationEnd(html, lt);
  if (next === QUESTION) return after(html, '>', lt + 2);
  if (next === SLASH) return readCloseTag(scan, lt);
  if (isAsciiLetter(next)) return readOpenTag(scan, lt);
  return lt + 1;
}

/** The end of a `<!…>` construct: a comment, a CDATA section, or a declaration. */
function declarationEnd(html: string, lt: number): number {
  if (html.startsWith('--', lt + 2)) return after(html, '-->', lt + 2);
  const third = html.charAt(lt + 2);
  // `<!-x` is a declaration from the character after the `x`.
  if (third === '-') return after(html, '>', lt + 4);
  if (third === '[') {
    let matched = 0;
    while (matched < 6 && html.charAt(lt + 3 + matched) === 'CDATA['.charAt(matched)) matched++;
    return matched === 6 ? after(html, ']]>', lt + 9) : after(html, '>', lt + 3 + matched);
  }
  return after(html, '>', lt + 3);
}

function readCloseTag(scan: NestingScan, lt: number): number {
  const { html } = scan;
  let at = lt + 2;
  while (isSpace(html.charCodeAt(at))) at++;
  if (at >= html.length) return html.length;
  const first = html.charCodeAt(at);
  if (first === GT) return at + 1;
  // `</` and anything but a letter opens a comment that runs to the next `>`.
  if (!isAsciiLetter(first)) return after(html, '>', at);
  const nameEnd = matchEnd(CLOSE_NAME, html, at);
  if (nameEnd >= html.length) return html.length;
  const end = after(html, '>', nameEnd);
  closeTag(scan, html.slice(at, nameEnd).toLowerCase(), lt, end, false);
  return end;
}

function readOpenTag(scan: NestingScan, lt: number): number {
  const { html } = scan;
  const nameEnd = matchEnd(OPEN_NAME, html, lt + 1);
  const tag = openTagEnd(html, nameEnd);
  if (!tag) return html.length;
  const name = html.slice(lt + 1, nameEnd).toLowerCase();
  const kept = openTag(scan, name, tag.selfClosing, lt, tag.end);
  const closer = tag.selfClosing ? undefined : RAW_TEXT.get(name);
  return closer ? readRawText(scan, closer, tag.end, kept) : tag.end;
}

/**
 * The index after an open tag whose name ends at `from`, and whether it ends `/>`.
 * Attributes are read as htmlparser2 reads them, so a `>` in a quoted value does not end
 * the tag. Undefined when the markup ends first, as htmlparser2 then drops the tag.
 */
function openTagEnd(html: string, from: number): { end: number; selfClosing: boolean } | undefined {
  // 0: before an attribute name; 1: after a `/`; 2: in a name; 3: after a name;
  // 4: before a value; 5: in an unquoted value.
  let state = 0;
  for (let at = from; at < html.length; at++) {
    const code = html.charCodeAt(at);
    switch (state) {
      case 0:
        if (code === GT) return { end: at + 1, selfClosing: false };
        if (code === SLASH) state = 1;
        else if (!isSpace(code)) state = 2;
        break;
      case 1:
        if (code === GT) return { end: at + 1, selfClosing: true };
        if (!isSpace(code)) {
          state = 0;
          at--;
        }
        break;
      case 2:
        if (code === EQUALS || code === SLASH || code === GT || isSpace(code)) {
          state = 3;
          at--;
        }
        break;
      case 3:
        if (code === EQUALS) state = 4;
        else if (code === SLASH || code === GT) {
          state = 0;
          at--;
        } else if (!isSpace(code)) state = 2;
        break;
      case 4:
        if (code === QUOTE || code === APOSTROPHE) {
          at = html.indexOf(code === QUOTE ? '"' : "'", at + 1);
          if (at === -1) return;
          state = 0;
        } else if (!isSpace(code)) {
          state = 5;
          at--;
        }
        break;
      default:
        if (code === GT || isSpace(code)) {
          state = 0;
          at--;
        }
    }
  }
  return;
}

/**
 * The text of a raw-text element, up to the close tag that ends it, which is then read
 * like any close tag. htmlparser2 matches that tag as `</name` and a space or `>`,
 * comparing each character `| 0x20`, which also takes `\x1C` for `<` and `\x0F` for `/`.
 */
function readRawText(scan: NestingScan, closer: string, from: number, kept: boolean): number {
  const { html } = scan;
  const at = rawTextEnd(html, closer, from);
  const end = at === -1 ? html.length : at;
  if (!kept) {
    // With its open tag gone the text would be read as markup.
    const text = html.slice(from, end);
    replace(
      scan,
      from,
      end,
      closer === 'script' || closer === 'style'
        ? ''
        : closer === 'title'
          ? text.replace(/</g, '&lt;')
          : text.replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    );
  }
  if (at === -1) return html.length;
  const tagEnd = after(html, '>', at + 2 + closer.length);
  closeTag(scan, closer, at, tagEnd, !kept);
  return tagEnd;
}

/** Where the close tag that ends raw text named `name` starts; -1 when none does. */
function rawTextEnd(html: string, name: string, from: number): number {
  const sequence = `</${name}`;
  let matched = 0;
  for (let at = from; at < html.length; at++) {
    const code = html.charCodeAt(at);
    if (matched === sequence.length) {
      if (code === GT || isSpace(code)) return at - sequence.length;
      matched = 0;
    }
    if ((code | 0x20) === sequence.charCodeAt(matched)) matched++;
    else if (matched > 0) matched = code === LT ? 1 : 0;
    else if (name !== 'title') {
      // Outside a title the tokenizer skips to the next `<` and counts it matched.
      at = html.indexOf('<', at + 1);
      if (at === -1) return -1;
      matched = 1;
    }
  }
  return -1;
}

/** Read an open tag into the stack; false when its element is too deep and the tag was dropped. */
function openTag(
  scan: NestingScan,
  name: string,
  selfClosing: boolean,
  start: number,
  end: number,
): boolean {
  const { open } = scan;
  const closes = IMPLIED_CLOSES.get(name);
  while (closes?.has(open.at(-1) ?? '')) pop(scan);
  const flagged = FOREIGN_TAGS.has(name) || INTEGRATION_TAGS.has(name);
  // No name with a flag implies a close, so a tag dropped here closed nothing the output keeps.
  const kept = hasRoom(scan) && !(flagged && scan.foreignKept.length > scan.max);
  if (!VOID_TAGS.has(name)) {
    push(scan, name);
    if (kept) scan.kept++;
    if (flagged) {
      const foreign = FOREIGN_TAGS.has(name);
      scan.foreignAll.push(foreign);
      if (kept) scan.foreignKept.push(foreign);
    }
    if (selfClosing && (kept ? scan.foreignKept : scan.foreignAll).at(-1)) pop(scan);
  }
  if (!kept) {
    scan.dropped++;
    replace(scan, start, end, ' ');
  }
  return kept;
}

/**
 * Read a close tag into the stack, dropping it when the element it closes was dropped.
 * `ofDropped` marks the tag ending the text of a raw-text element that was dropped: it
 * goes with its element, so it closes nothing the output keeps.
 */
function closeTag(
  scan: NestingScan,
  name: string,
  start: number,
  end: number,
  ofDropped: boolean,
): void {
  const { open } = scan;
  let kept: boolean;
  if (VOID_TAGS.has(name)) {
    // `</br>` makes a `<br>`; any other void close tag is ignored.
    kept = !ofDropped && (name !== 'br' || hasRoom(scan));
  } else {
    const at = scan.openAt.get(name)?.at(-1);
    // An unmatched `</p>` makes a `<p>`.
    if (at === undefined) kept = !ofDropped && (name !== 'p' || hasRoom(scan));
    else kept = !ofDropped && at < scan.kept;
    if (FOREIGN_TAGS.has(name) || INTEGRATION_TAGS.has(name)) {
      scan.foreignAll.pop();
      if (kept) scan.foreignKept.pop();
    }
    if (at !== undefined && (kept || at >= scan.kept)) while (open.length > at) pop(scan);
  }
  if (!kept) {
    scan.dropped++;
    replace(scan, start, end, ' ');
  }
}

function push(scan: NestingScan, name: string): void {
  const indexes = scan.openAt.get(name);
  if (indexes) indexes.push(scan.open.length);
  else scan.openAt.set(name, [scan.open.length]);
  scan.open.push(name);
}

function pop(scan: NestingScan): void {
  const name = scan.open.pop();
  if (name !== undefined) scan.openAt.get(name)?.pop();
  scan.kept = Math.min(scan.kept, scan.open.length);
}

/** True when an element opened now would be kept: none open is dropped, and it is not too deep. */
function hasRoom(scan: NestingScan): boolean {
  return scan.open.length === scan.kept && scan.kept < scan.max;
}

/** Write the source up to `start`, then `text` in place of `start`…`end`. */
function replace(scan: NestingScan, start: number, end: number, text: string): void {
  scan.out.push(scan.html.slice(scan.copied, start), text);
  scan.copied = end;
}
