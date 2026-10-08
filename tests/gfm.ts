/**
 * @fileoverview The escaping oracle: rendered Markdown read back through a real CommonMark +
 * GFM parser (micromark, via mdast), so a test judges output by what a client renders
 * rather than by the string's shape. GFM has no math, so `$…$` reads as text here.
 * @module tests/gfm
 */
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';

type Root = ReturnType<typeof fromMarkdown>;
type Node = Root | Root['children'][number];

/**
 * Markdown parsed with CommonMark + GFM: autolink literals, strikethrough, tables. With
 * `textPass: false`, mdast's second pass over text nodes for autolink literals is left out,
 * so only the links micromark's own tokenizer forms are read.
 */
export function parseGfm(markdown: string, { textPass = true } = {}): Root {
  const mdastExtensions = textPass
    ? gfmFromMarkdown()
    : gfmFromMarkdown().map(({ transforms: _, ...extension }) => extension);
  return fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions });
}

/**
 * The markup a client renders from `markdown`, in document order: `html:<value>` for raw
 * HTML, `image:<url>`, `link:<url>` for every link (an autolink, a bare URL GFM links, or
 * `[text](url)`), and `emphasis`, `strong`, `delete` for each such span. Text that
 * renders as text appears nowhere.
 */
export function gfmMarkup(markdown: string): string[] {
  const found: string[] = [];
  const walk = (node: Node) => {
    if (node.type === 'html') found.push(`html:${node.value}`);
    else if (node.type === 'image') found.push(`image:${node.url}`);
    else if (node.type === 'link') found.push(`link:${node.url}`);
    else if (node.type === 'emphasis' || node.type === 'strong' || node.type === 'delete')
      found.push(node.type);
    if ('children' in node) for (const child of node.children) walk(child);
  };
  walk(parseGfm(markdown));
  return found;
}

/** Each emphasis, strong, and strikethrough span as `type:text`, in document order. */
export function gfmSpans(markdown: string): string[] {
  const found: string[] = [];
  const walk = (node: Node) => {
    if (node.type === 'emphasis' || node.type === 'strong' || node.type === 'delete')
      found.push(`${node.type}:${inlineText(node)}`);
    if ('children' in node) for (const child of node.children) walk(child);
  };
  walk(parseGfm(markdown));
  return found;
}

/** A node's text as a reader sees it: raw HTML, which a renderer hides, gives nothing. */
function inlineText(node: Node): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  if (node.type === 'image') return node.alt ?? '';
  if (node.type === 'break') return '\n';
  return 'children' in node ? node.children.map(inlineText).join('') : '';
}

/** What a rendering's source holds, which {@link gfmFindings} judges the rendering against. */
export interface GfmSource {
  /** Link targets the source names outside its text (a JATS `<ext-link>`'s `xlink:href`). */
  hrefs?: readonly string[];
  /**
   * The markers the source's own spans open with (`*~` for spans built by `emphasis`): a
   * span one of them opens passes whatever its text. One `_` opens is the source's text
   * read as emphasis.
   */
  markers?: string;
  /**
   * The emphasis, strong, and strikethrough spans the source has, each as {@link gfmSpans}
   * writes one (`strong:Figure 1.`) or as its type alone (`emphasis`) for a span of any text.
   */
  spans?: readonly string[];
  /** The source's text, as a reader should see it: every link destination it holds is in it. */
  text: string;
}

/** The link schemes a rendering may carry. */
const SAFE_SCHEME = /^(?:https?|ftp|mailto):/i;

/**
 * What a client renders from `markdown` that its source did not have: each raw HTML node
 * and image; each link outside `http(s)`, `ftp`, and `mailto`, or whose destination the
 * source neither holds in its text nor names as a target (GFM adds `http://` to a `www.`
 * literal and `mailto:` to an email literal, so those count as held); and each emphasis,
 * strong, or strikethrough span beyond the ones the source has. An empty list is a pass.
 *
 * With `textPassLinks: false`, a link only mdast's text pass forms is not judged: that pass
 * links a `www.` or `http(s)://` after any punctuation to the next space, through markup
 * left as text, which `docs/design.md` names as outside what the escaping bounds.
 */
export function gfmFindings(
  markdown: string,
  source: GfmSource,
  { textPassLinks = true } = {},
): string[] {
  const found: string[] = [];
  const spans = [...(source.spans ?? [])];
  const tokenized = textPassLinks ? [] : linkUrls(parseGfm(markdown, { textPass: false }));
  const judged = (url: string) => {
    if (textPassLinks) return true;
    const at = tokenized.indexOf(url);
    if (at !== -1) tokenized.splice(at, 1);
    return at !== -1;
  };
  const walk = (node: Node) => {
    if (node.type === 'html') found.push(`html:${node.value}`);
    else if (node.type === 'image') found.push(`image:${node.url}`);
    else if (
      node.type === 'link' &&
      judged(node.url) &&
      !(SAFE_SCHEME.test(node.url) && held(node.url, source))
    )
      found.push(`link:${node.url}`);
    else if (node.type === 'emphasis' || node.type === 'strong' || node.type === 'delete') {
      const span = `${node.type}:${inlineText(node)}`;
      const exact = spans.indexOf(span);
      const at = exact === -1 ? spans.indexOf(node.type) : exact;
      const marker = markdown.charAt(node.position?.start.offset ?? -1);
      if (at !== -1) spans.splice(at, 1);
      else if (!source.markers?.includes(marker)) found.push(span);
    }
    if ('children' in node) for (const child of node.children) walk(child);
  };
  walk(parseGfm(markdown));
  return found;
}

/** Every link destination in a tree, in document order. */
function linkUrls(root: Root): string[] {
  const urls: string[] = [];
  const walk = (node: Node) => {
    if (node.type === 'link') urls.push(node.url);
    if ('children' in node) for (const child of node.children) walk(child);
  };
  walk(root);
  return urls;
}

/** True when the source holds `url`: in its text, or as a target it names, decoded or not. */
function held(url: string, { hrefs = [], text }: GfmSource): boolean {
  const targets = hrefs.flatMap((href) => decodings(href.trim()));
  return decodings(url).some((form) => {
    const literal = form.replace(/^http:\/\/(?=www)/i, '').replace(/^mailto:/i, '');
    return [form, literal].some((held) => targets.includes(held) || text.includes(held));
  });
}

/** `url` as written, and percent-decoded where it decodes. */
function decodings(url: string): string[] {
  const forms = [url];
  for (const decode of [decodeURI, decodeURIComponent]) {
    try {
      forms.push(decode(url));
    } catch {
      // A `%` that starts no escape leaves the URL as written.
    }
  }
  return forms;
}

/** The text a reader sees, block by block, joined by newlines; code keeps its value. */
export function gfmText(markdown: string): string {
  const blocks: string[] = [];
  const block = (node: Node) => {
    if (node.type === 'paragraph' || node.type === 'heading') blocks.push(inlineText(node));
    else if (node.type === 'code') blocks.push(node.value);
    else if ('children' in node) for (const child of node.children) block(child);
  };
  block(parseGfm(markdown));
  return blocks.join('\n');
}
