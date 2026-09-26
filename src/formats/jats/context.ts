/**
 * @fileoverview State one JATS parse carries through its walks: diagnostics, footnotes
 * met inline, and the section IDs already issued.
 * @module src/formats/jats/context
 */
import type { DiagnosticsCollector } from '../../model/diagnostics.js';
import type { Footnote } from '../../model/document.js';

export interface JatsContext {
  diag: DiagnosticsCollector;
  /** Footnotes collected from inline `<fn>` elements, in document order. */
  footnotes: Footnote[];
  /** Section IDs issued so far (`issueId`), so a duplicate source ID is disambiguated. */
  sectionIds: Set<string>;
}
