/**
 * @fileoverview The largest and smallest of a list of numbers. `Math.max(...values)`
 * passes every value as an argument, and a document-sized list — a table's rows, a
 * page's text items — overflows the call stack (Node rejects a few hundred thousand).
 * @module src/model/extremes
 */

/** The largest value, or `-Infinity` for none, as `Math.max()` returns. */
export function largest(values: readonly number[]): number {
  let result = -Infinity;
  for (const value of values) if (value > result) result = value;
  return result;
}

/** The smallest value, or `Infinity` for none, as `Math.min()` returns. */
export function smallest(values: readonly number[]): number {
  let result = Infinity;
  for (const value of values) if (value < result) result = value;
  return result;
}
