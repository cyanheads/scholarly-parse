/**
 * @fileoverview State one PDF parse carries through its passes: diagnostics, the section
 * IDs already issued, and the table budget.
 * @module src/formats/pdf/context
 */
import type { DiagnosticsCollector } from '../../model/diagnostics.js';
import type { GridBudget } from '../../model/table-grid.js';

export interface PdfContext {
  diag: DiagnosticsCollector;
  /** What the document's tables may still hold. */
  gridBudget: GridBudget;
  /** Section IDs issued so far (`issueId`). */
  sectionIds: Set<string>;
}
