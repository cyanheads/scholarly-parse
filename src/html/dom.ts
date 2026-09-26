/**
 * @fileoverview HTML → DOM through the optional `linkedom` peer, loaded on first use,
 * and the node helpers the HTML-based parsers walk it with. `linkedom` runs on Bun,
 * Node, and Workers without a browser.
 * @module src/html/dom
 */

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
export async function loadDocument(html: string): Promise<Document> {
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

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
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
