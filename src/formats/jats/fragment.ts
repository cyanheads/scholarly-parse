/**
 * @fileoverview A JATS fragment with no article around it — a Crossref abstract
 * (`<jats:p>…</jats:p>`, namespace prefix included) or a Europe PMC abstract snippet —
 * as Markdown.
 * @module src/formats/jats/fragment
 */
import { createDiagnostics } from '../../model/diagnostics.js';
import { escapeInline } from '../../render/escape.js';
import { renderBlocks } from '../../render/markdown.js';
import { childrenOf, collapseWhitespace, parseOrderedXml } from '../../xml/ordered.js';
import { flowBlocks } from './blocks.js';
import type { JatsContext } from './context.js';

/** Fragments larger than this are not abstracts; they are returned as escaped text. */
const MAX_FRAGMENT_CHARS = 1_000_000;

/**
 * Markdown for a JATS fragment: paragraphs separated by blank lines, inline markup
 * converted. The `jats:` namespace prefix Crossref uses is accepted. Input that does
 * not parse as XML is returned as escaped text with the tags removed.
 */
export function jatsInlineToMarkdown(fragment: string): string {
  const source = fragment.replace(/<(\/?)jats:/g, '<$1');
  // Only what looks like a tag is removed, so a stray `<` in `p < 0.05` stays in the text.
  const plain = () => escapeInline(collapseWhitespace(source.replace(/<\/?[A-Za-z][^<>]*>/g, ' ')));
  if (source.length > MAX_FRAGMENT_CHARS) return plain();
  const tree = parseOrderedXml(`<fragment>${source}</fragment>`);
  if ('error' in tree) return plain();
  const ctx: JatsContext = {
    diag: createDiagnostics(),
    footnotes: [],
    noteOwners: new Map(),
    sectionIds: new Set(),
  };
  try {
    return renderBlocks(flowBlocks(childrenOf(tree.nodes[0]), ctx));
  } catch {
    // Whatever in the fragment breaks the reader, its text still reads.
    return plain();
  }
}
