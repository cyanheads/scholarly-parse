/**
 * @fileoverview A publisher page's reference list → `Reference[]`. Entries are the
 * items of the section's longest list (or its repeated entry elements); each keeps its
 * printed label and citation text, with the lookup links publishers append ("Google
 * Scholar", "PubMed", "CrossRef") left out of the text but mined for identifiers.
 * @module src/formats/html/references
 */

import {
  childElements,
  childNodes,
  isElement,
  resolveUrl,
  tagOf,
  textOfElement,
} from '../../html/dom.js';
import { arxivFromUrl, arxivInText } from '../../model/arxiv.js';
import type { Reference } from '../../model/document.js';
import { doiInText, normalizeDoi } from '../../model/doi.js';
import { trimTrailing } from '../../model/trailing.js';
import { collapseInline } from '../../render/inline.js';
import { isLinkList, LINK_LABEL } from './blocks.js';
import { type HtmlContext, isFurniture, nameTokens } from './context.js';
import { inlineMarkdown, safeDecode } from './inline.js';
import { textLength } from './subtree.js';

/** Class tokens of an element holding an entry's printed number. */
const LABEL_TOKENS = new Set(['label', 'order', 'number', 'counter', 'num']);
/** Class tokens of an element holding the citation itself. */
const TEXT_TOKENS = new Set(['citation', 'cite', 'content', 'text', 'mixed']);

/** The entry elements of a reference list among `nodes`. */
function entries(nodes: Node[], ctx: HtmlContext): Element[] {
  const elements = nodes.filter(isElement).filter((el) => !isFurniture(el));
  const lists = elements.flatMap((el) =>
    ['ul', 'ol'].includes(tagOf(el)) ? [el] : Array.from(el.querySelectorAll('ul, ol')),
  );
  const longest = lists
    .filter((list) => !list.parentElement?.closest('li'))
    .map((list) =>
      childElements(list).filter((child) => tagOf(child) === 'li' && !isLinkList(child, ctx)),
    )
    .sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length > 0) return longest;
  // No list: entries are repeated siblings (`<div class="ref">`, `<p>`), found under the deepest wrapper holding them.
  let level = elements;
  while (level.length === 1 && level[0] && childElements(level[0]).length > 0)
    level = childElements(level[0]);
  return sameShape(
    level.filter((el) => !isFurniture(el) && !isLinkList(el, ctx) && textLength(el, ctx) > 20),
  );
}

/**
 * Repeated entries share one element shape, tag and class. When most of them do, one
 * unlike the rest is not an entry: Cambridge follows its reference list with the
 * Figures tab, a sibling holding a copy of every figure.
 */
function sameShape(elements: Element[]): Element[] {
  const shape = (el: Element) => `${tagOf(el)}.${el.getAttribute('class') ?? ''}`;
  const counts = new Map<string, number>();
  for (const el of elements) counts.set(shape(el), (counts.get(shape(el)) ?? 0) + 1);
  const [common, count = 0] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
  return count >= 2 && count * 2 >= elements.length
    ? elements.filter((el) => shape(el) === common)
    : elements;
}

/** A leading printed number: `1.`, `[12]`, `12)`. */
const LEADING_LABEL = /^\s*\[?(\d{1,4}[a-z]?)[\].)]?\s+(?=\S)/;

function labelOf(entry: Element, labelEl: Element | undefined): string | undefined {
  const printed = textOfElement(labelEl) || entry.getAttribute('data-counter') || '';
  return printed.replace(/^\[|[\].)]$|\.$/g, '').trim() || undefined;
}

/** Inline Markdown of an entry's citation: its text element when it has one, else the entry without label and link lists. */
function citationText(entry: Element, labelEl: Element | undefined, ctx: HtmlContext): string {
  const textEl =
    entry.querySelector('cite') ??
    Array.from(entry.querySelectorAll('*')).find(
      (el) =>
        nameTokens(el.getAttribute('class')).some((t) => TEXT_TOKENS.has(t)) &&
        !isLinkList(el, ctx) &&
        textLength(el, ctx) > 20,
    );
  const nodes = textEl ? childNodes(textEl) : childNodes(entry).filter((node) => node !== labelEl);
  const kept = nodes.filter(
    (node) =>
      !isElement(node) ||
      !(
        isFurniture(node) ||
        node === labelEl ||
        isLinkList(node, ctx) ||
        (tagOf(node) === 'a' && LINK_LABEL.test(textOfElement(node)))
      ),
  );
  const markdown = collapseInline(inlineMarkdown(kept, ctx).replace(/\[\s*\]|\(\s*\)/g, ' '));
  return trimTrailing(markdown, /[\s|,;]/);
}

/** References from the nodes of a References section. */
export function extractReferences(nodes: Node[], ctx: HtmlContext): Reference[] {
  return entries(nodes, ctx).flatMap((entry) => {
    const labelEl = Array.from(entry.querySelectorAll('*')).find((el) =>
      nameTokens(el.getAttribute('class')).some((t) => LABEL_TOKENS.has(t)),
    );
    let text = citationText(entry, labelEl, ctx);
    let label = labelOf(entry, labelEl);
    const leading = LEADING_LABEL.exec(text);
    if (leading) {
      label ??= leading[1];
      text = text.slice(leading[0].length);
    }
    if (!text) return [];

    // In-page anchors and script links (`href="#"` on a "View Article" button) point nowhere.
    const hrefs = Array.from(entry.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href && !href.startsWith('#') && !/^javascript:/i.test(href))
      .map((href) => resolveUrl(href, ctx.baseUrl));
    const plain = textOfElement(entry);
    const doi =
      normalizeDoi(
        hrefs
          .map((h) => /doi\.org\/(10\.\d{4,9}\/[^?#\s]+)/i.exec(safeDecode(h))?.[1])
          .find(Boolean),
      ) ?? normalizeDoi(doiInText(plain));
    const pmid = hrefs
      .map((h) => /pubmed(?:\.ncbi\.nlm\.nih\.gov|\/)\/?(\d{4,9})\b|[?&]list_uids=(\d+)/i.exec(h))
      .find(Boolean);
    const pmcid = hrefs
      .map((h) => /\/(PMC\d+)\b/i.exec(h)?.[1])
      .find(Boolean)
      ?.toUpperCase();
    // The ID the entry prints, its version kept, ahead of one a link names.
    const arxiv = arxivInText(plain) ?? hrefs.map(arxivFromUrl).find(Boolean);
    const url = doi
      ? undefined
      : hrefs.find(
          (h) =>
            /^https?:/i.test(h) &&
            !/scholar\.google|pubmed|ncbi\.nlm\.nih\.gov|crossref\.org|doi\.org/i.test(h),
        );
    const id =
      entry.getAttribute('id') ?? entry.querySelector('[id]')?.getAttribute('id') ?? undefined;
    return [
      {
        ...(id && { id }),
        ...(label && { label }),
        text,
        ...(doi && { doi }),
        ...(pmid && { pmid: pmid[1] ?? pmid[2] }),
        ...(pmcid && { pmcid }),
        ...(arxiv && { arxiv }),
        ...(url && { url }),
      },
    ];
  });
}
