/**
 * @fileoverview State one JATS parse carries through its walks: diagnostics, footnotes
 * met inline, the section IDs already issued, and the table budget.
 * @module src/formats/jats/context
 */
import type { DiagnosticsCollector } from '../../model/diagnostics.js';
import type { Footnote } from '../../model/document.js';
import type { GridBudget } from '../../model/table-grid.js';

export interface JatsContext {
  diag: DiagnosticsCollector;
  /** Footnotes collected from inline `<fn>` elements, in document order. */
  footnotes: Footnote[];
  /** What the document's tables may still repeat and hold. */
  gridBudget: GridBudget;
  /** Note ID → names of the authors whose `<xref ref-type="fn">` points at the note. */
  noteOwners: ReadonlyMap<string, readonly string[]>;
  /** Section IDs issued so far (`issueId`), so a duplicate source ID is disambiguated. */
  sectionIds: Set<string>;
}
