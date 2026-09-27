/**
 * @fileoverview Inline Markdown for publisher HTML: emphasis, links, sub- and
 * superscripts, citation markers as printed, and math from whichever form the page
 * carries it in — MathML with TeX annotations (and KaTeX's copy of it), MathJax source
 * scripts, or raw TeX delimiters inside a MathJax container.
 * @module src/formats/html/inline
 */

import {
  COMMENT_NODE,
  childNodes,
  isElement,
  resolveUrl,
  TEXT_NODE,
  tagOf,
  textOfElement,
} from '../../html/dom.js';
import { escapeInline } from '../../render/escape.js';
import {
  emphasis,
  FORMULA_IMAGE,
  inlineCode,
  inlineMath,
  joinAdjacentMath,
  link,
  subscript,
  superscript,
} from '../../render/inline.js';
import { type HtmlContext, isFurniture, nameTokens } from './context.js';

/** Inline Markdown for a list of nodes, spacing intact. */
export function inlineMarkdown(nodes: Node[], ctx: HtmlContext): string {
  let out = '';
  for (const node of nodes) out += inlineNode(node, ctx, false);
  return out;
}

/** Inline Markdown of an element's content, whitespace collapsed. */
export function inlineText(element: Element | null | undefined, ctx: HtmlContext): string {
  return element ? collapse(inlineMarkdown(childNodes(element), ctx)) : '';
}

function collapse(text: string): string {
  return joinAdjacentMath(text.replace(/\s+/g, ' ').trim());
}

/** A `<script>` holding MathJax source: `math/tex`, `math/tex; mode=display`, or `math/mml`. */
export function isMathScript(element: Element): boolean {
  return tagOf(element) === 'script' && /^math\//i.test(element.getAttribute('type') ?? '');
}

/**
 * TeX for a MathML `<math>`: its `application/x-tex` annotation (KaTeX and LaTeXML
 * keep one), else `@alttext`. Empty when the page carries neither.
 */
export function mathmlTex(math: Element): string {
  const annotation = Array.from(math.getElementsByTagName('annotation')).find((a) =>
    /^application\/x-tex$/i.test(a.getAttribute('encoding') ?? ''),
  );
  return (annotation?.textContent ?? math.getAttribute('alttext') ?? '').trim();
}

/** TeX for a MathJax source script; MathML source yields its annotation or alttext. */
export function scriptTex(script: Element): string {
  const source = script.textContent ?? '';
  if (/mml/i.test(script.getAttribute('type') ?? '')) {
    return (texAnnotation(source) ?? /alttext\s*=\s*"([^"]*)"/i.exec(source)?.[1])?.trim() ?? '';
  }
  return source.trim();
}

/** Each `<annotation>` tag in MathML source, read to its `>` or the next `<`. */
const ANNOTATION_TAG = /<annotation[^<>]*/gi;

/**
 * The content of the first `<annotation>` in MathML source whose tag names `x-tex`, up
 * to the next `</annotation>`. Each tag is read once, and the closing tag is searched for
 * once: when there is none after one annotation, there is none after a later one either.
 */
function texAnnotation(source: string): string | undefined {
  for (const tag of source.matchAll(ANNOTATION_TAG)) {
    const content = tag.index + tag[0].length + 1;
    if (source.charAt(content - 1) !== '>' || !/x-tex/i.test(tag[0])) continue;
    const close = /<\/annotation>/gi;
    close.lastIndex = content;
    const end = close.exec(source);
    return end ? source.slice(content, end.index) : undefined;
  }
  return;
}

/** Where delimited TeX can open: `\(`, `\[`, `$$`, and `$`. */
const TEX_OPENER = /\\[([]|\$/g;

/**
 * Text with its delimited TeX as inline math and everything else escaped. Delimiters are
 * `\(…\)`, `\[…\]`, `$$…$$`, and — `singleDollar`, inside a MathJax container — `$…$`
 * with no line break inside; each holds at least one character, and an opener with no
 * closer is text. Each closer is found with one forward search that later openers of its
 * kind reuse, so a run of unclosed openers is read once.
 */
function textWithMath(text: string, singleDollar: boolean): string {
  const found = new Map<string, number>();
  /** The first `closer` at or after `from`, or -1. */
  const closerAt = (closer: string, from: number): number => {
    const known = found.get(closer);
    if (known !== undefined && (known === -1 || known >= from)) return known;
    const at = text.indexOf(closer, from);
    found.set(closer, at);
    return at;
  };
  let out = '';
  let last = 0;
  const opener = new RegExp(TEX_OPENER);
  for (let open = opener.exec(text); open; open = opener.exec(text)) {
    const start = open.index;
    const math = delimitedTex(text, start, singleDollar, closerAt);
    if (!math) {
      opener.lastIndex = start + 1;
      continue;
    }
    out += escapeInline(text.slice(last, start)) + inlineMath(math.tex);
    last = math.end;
    opener.lastIndex = math.end;
  }
  return out + escapeInline(text.slice(last));
}

/** The TeX delimited at `start` and where its closer ends, or undefined when nothing closes it there. */
function delimitedTex(
  text: string,
  start: number,
  singleDollar: boolean,
  closerAt: (closer: string, from: number) => number,
): { end: number; tex: string } | undefined {
  const dollar = text.charAt(start) === '$';
  const next = text.charAt(start + 1);
  const pair = dollar ? (next === '$' ? '$$' : undefined) : next === '(' ? '\\)' : '\\]';
  if (pair) {
    const close = closerAt(pair, start + 3);
    if (close !== -1) return { end: close + 2, tex: text.slice(start + 2, close) };
  }
  if (!singleDollar || !dollar) return;
  // `$…$`: the first `$` after at least one character, with no line break before it.
  const stop = /[$\n]/g;
  stop.lastIndex = start + 1;
  const close = stop.exec(text)?.index;
  if (close === undefined || close === start + 1 || text.charAt(close) !== '$') return;
  return { end: close + 1, tex: text.slice(start + 1, close) };
}

/** True for an element MathJax reads raw TeX from (`span.mathjax-tex`, `.tex2jax_process`). */
function isTexContainer(element: Element): boolean {
  return nameTokens(element.getAttribute('class')).some(
    (token) => token === 'mathjax' || token === 'tex2jax',
  );
}

/**
 * True for a link to an element on this page: `#ref-CR1`, or the page's own path with a
 * fragment (`/articles/s41467-024-44824-z#ref-CR1`), as publishers link citations.
 */
function isInPageLink(link: Element): boolean {
  const href = link.getAttribute('href') ?? '';
  const hash = href.indexOf('#');
  if (hash === -1) return false;
  const target = safeDecode(href.slice(hash + 1));
  return hash === 0 || (target !== '' && link.ownerDocument.getElementById(target) !== null);
}

/** A percent-encoded URL or URL part decoded; unchanged when its encoding is malformed. */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** A superscript that holds only in-page links (`<sup><a href="#ref-CR12">12</a></sup>`) is a citation. */
function isCitationSup(sup: Element): boolean {
  const links = Array.from(sup.querySelectorAll('a[href]'));
  if (links.length === 0 || !links.every(isInPageLink)) return false;
  const outside = Array.from(sup.childNodes)
    .map((node) => (isElement(node) && tagOf(node) === 'a' ? '' : (node.textContent ?? '')))
    .join('');
  return /^[\s,–—\-[\]()]*$/.test(outside);
}

function inlineNode(node: Node, ctx: HtmlContext, inTex: boolean): string {
  if (node.nodeType === TEXT_NODE) {
    const text = node.textContent ?? '';
    // A citation's source ends where the stylesheet spaces it: `<i class="References__source">J. Mol. Biol.</i>215`.
    const lead = /^[\p{L}\p{N}]/u.test(text) && followsSource(node) ? ' ' : '';
    return (
      lead +
      (inTex || text.includes('\\(') || text.includes('\\[') || text.includes('$$')
        ? textWithMath(text, inTex)
        : escapeInline(text))
    );
  }
  if (!isElement(node)) return '';
  const tag = tagOf(node);
  if (tag === 'math') return mathOrText(node);
  if (isMathScript(node)) return inlineMath(scriptTex(node));
  if (isFurniture(node)) return '';
  const tokens = nameTokens(node.getAttribute('class'));
  // MathJax's rendered output; the source script beside it carries the TeX.
  if (tokens.includes('mjx') || /^MathJax/.test(node.getAttribute('class') ?? '')) return '';
  const texHere = inTex || isTexContainer(node);
  const inner = () => {
    let out = '';
    for (const child of childNodes(node)) out += inlineNode(child, ctx, texHere);
    return out;
  };

  if (tag === 'mjx-container') {
    const math = node.querySelector('math');
    return math ? mathOrText(math) : '';
  }
  // Name parts that rely on stylesheet separators: `<span class="surname">Takeuchi</span><span class="given-names">O</span>`.
  // A page that writes its own (`Chesney</span>, <span…`) needs none added.
  if (tokens.includes('surname') && !separatedFromNext(node)) return `${inner()} `;
  const nextPart = nameTokens(node.nextElementSibling?.getAttribute('class') ?? null).at(-1);
  if (
    tokens.at(-1) === 'name' &&
    (nextPart === 'name' || nextPart === 'etal') &&
    !separatedFromNext(node)
  ) {
    return `${inner()}, `;
  }

  switch (tag) {
    case 'b':
    case 'strong':
      return emphasis(inner(), '**');
    case 'i':
    case 'em':
    case 'var':
      return emphasis(inner(), '*');
    case 's':
    case 'strike':
    case 'del':
      return emphasis(inner(), '~~');
    case 'sup': {
      const plain = visibleText(node);
      return superscript(escapeInline(plain), plain, isCitationSup(node));
    }
    case 'sub': {
      const plain = visibleText(node);
      return subscript(escapeInline(plain), plain);
    }
    case 'a': {
      const href = node.getAttribute('href') ?? '';
      // Cross-references and citations point inside the page; they read as printed.
      if (!href || isInPageLink(node)) return inner();
      return link(inner(), resolveUrl(href, ctx.baseUrl));
    }
    case 'code':
    case 'kbd':
    case 'samp':
    case 'tt':
      return node.querySelector('a[href]') ? inner() : inlineCode(textOfElement(node));
    case 'br':
      return ' ';
    case 'img':
      return formulaImage(node, ctx) ? FORMULA_IMAGE : '';
    case 'picture':
      return '';
    // Block-shaped elements met inline: keep their words apart.
    case 'div':
    case 'p':
    case 'li':
    case 'td':
    case 'th':
    case 'tr':
    case 'dt':
    case 'dd':
      return ` ${inner()} `;
    default:
      return inner();
  }
}

/** A node's neighbour, past the comments Vue marks its render slots with (`<!--[-->`). */
function sibling(node: Node, side: 'nextSibling' | 'previousSibling'): Node | null {
  let found = node[side];
  while (found && found.nodeType === COMMENT_NODE) found = found[side];
  return found;
}

/** True when text other than whitespace (a page's own `, `) follows an element before the next one. */
function separatedFromNext(element: Element): boolean {
  const next = sibling(element, 'nextSibling');
  return next !== null && next.nodeType === TEXT_NODE && (next.textContent ?? '').trim() !== '';
}

/** True when a text node directly follows an element whose class names a citation's source. */
function followsSource(text: Node): boolean {
  const previous = sibling(text, 'previousSibling');
  return (
    previous !== null &&
    isElement(previous) &&
    nameTokens(previous.getAttribute('class')).includes('source')
  );
}

/** Text a reader sees: screen-reader-only and hidden elements left out, whitespace collapsed. */
function visibleText(element: Element): string {
  const collect = (node: Node): string => {
    if (!isElement(node)) return node.textContent ?? '';
    return isFurniture(node) ? '' : Array.from(node.childNodes).map(collect).join('');
  };
  return collect(element).replace(/\s+/g, ' ').trim();
}

/** Report a formula whose content is not in the page, only an image of it. */
export function warnImageFormula(ctx: HtmlContext, href: string, id: string | undefined): void {
  ctx.diag.warn('math-without-tex', `A formula is published only as an image (${href})`, id);
}

/**
 * True for an image that is a formula's only form: it sits in an element whose class
 * names a formula or equation (PLOS's `<span class="inline-formula">`), and that element
 * carries no MathML, math source, or TeX. Such an image is reported once, here.
 */
function formulaImage(img: Element, ctx: HtmlContext): boolean {
  const container = formulaContainer(img);
  const src = img.getAttribute('src');
  if (!container || !src || container.querySelector('math, script[type^="math/"]')) return false;
  warnImageFormula(ctx, resolveUrl(src, ctx.baseUrl), container.getAttribute('id') ?? undefined);
  return true;
}

/** The nearest of an image's three closest ancestors whose class names a formula or equation. */
function formulaContainer(img: Element): Element | undefined {
  let element = img.parentElement;
  for (let depth = 0; element && depth < 3; depth++, element = element.parentElement) {
    const tokens = nameTokens(element.getAttribute('class'));
    if (tokens.some((t) => t === 'formula' || t === 'equation')) return element;
  }
  return;
}

function mathOrText(math: Element): string {
  const tex = mathmlTex(math);
  return tex ? inlineMath(tex) : escapeInline(textOfElement(math));
}
