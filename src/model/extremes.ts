/**
 * @fileoverview The largest and smallest of a list of numbers, and one list appended to
 * another, without spreading the list into call arguments. `Math.max(...values)` and
 * `target.push(...items)` pass every element as an argument, and a document-sized list —
 * a table's rows, a page's text items, a section's blocks — overflows the call stack
 * (Node rejects a little over a hundred thousand).
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

/** Append every item to `target` in order, as `target.push(...items)` does. */
export function append<T>(target: T[], items: Iterable<T>): void {
  for (const item of items) target.push(item);
}
