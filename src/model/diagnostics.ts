/**
 * @fileoverview Collects warnings and unhandled-element counts while a parser walks a
 * document, then freezes them into the `Diagnostics` a document reports. Internal to
 * the parsers; not part of the public API.
 * @module src/model/diagnostics
 */
import type { Diagnostics, ParseQuality, ParseWarning, ParseWarningCode } from './document.js';

/** A diagnostics collector bound to one parse. */
export interface DiagnosticsCollector {
  finish(quality: ParseQuality): Diagnostics;
  unhandled(element: string): void;
  warn(code: ParseWarningCode, message: string, where?: string): void;
}

/** Most warnings of one code a document reports; the rest are counted in the last one. */
const MAX_WARNINGS_PER_CODE = 20;

export function createDiagnostics(): DiagnosticsCollector {
  const warnings: ParseWarning[] = [];
  const perCode = new Map<ParseWarningCode, number>();
  const unhandled = new Map<string, number>();

  return {
    finish(quality) {
      for (const [code, count] of perCode) {
        if (count > MAX_WARNINGS_PER_CODE) {
          warnings.push({
            code,
            message: `${count - MAX_WARNINGS_PER_CODE} more "${code}" warnings not listed`,
          });
        }
      }
      return {
        quality,
        unhandled: [...unhandled]
          .map(([element, count]) => ({ count, element }))
          .sort((a, b) => b.count - a.count || a.element.localeCompare(b.element)),
        warnings,
      };
    },
    unhandled(element) {
      unhandled.set(element, (unhandled.get(element) ?? 0) + 1);
    },
    warn(code, message, where) {
      const count = (perCode.get(code) ?? 0) + 1;
      perCode.set(code, count);
      if (count <= MAX_WARNINGS_PER_CODE) {
        warnings.push(where === undefined ? { code, message } : { code, message, where });
      }
    },
  };
}
