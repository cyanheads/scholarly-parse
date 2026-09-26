/**
 * @fileoverview State one LaTeXML parse carries: diagnostics, footnotes, issued section
 * IDs, and the base URL relative image paths resolve against.
 * @module src/formats/latexml/context
 */
import type { DiagnosticsCollector } from '../../model/diagnostics.js';
import type { Footnote } from '../../model/document.js';

export interface LatexmlContext {
  baseUrl: string | undefined;
  diag: DiagnosticsCollector;
  footnotes: Footnote[];
  sectionIds: Set<string>;
}

/**
 * Elements that are page furniture, not paper content. arXiv injects a hidden "Report
 * issue" button after most paragraphs, inside the article element.
 */
export const SKIP_TAGS: ReadonlySet<string> = new Set([
  'button',
  'dialog',
  'form',
  'input',
  'label',
  'nav',
  'noscript',
  'script',
  'style',
  'svg',
  'template',
]);
