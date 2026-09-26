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
  /** Section IDs issued so far, so a duplicate source ID is disambiguated. */
  sectionIds: Set<string>;
}

/** Issue a section ID: the source's own when unused, else `preferred` made unique. */
export function issueSectionId(
  ctx: JatsContext,
  sourceId: string | undefined,
  fallback: string,
): string {
  const base = sourceId || fallback;
  let id = base;
  for (let n = 2; ctx.sectionIds.has(id); n++) id = `${base}-${n}`;
  ctx.sectionIds.add(id);
  return id;
}
