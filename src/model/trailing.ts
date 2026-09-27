/**
 * @fileoverview The characters a string ends with, found by walking back from its end. A
 * pattern anchored only at the end (`/[.,;]+$/`) is tried from every position of a run it
 * does not end, and each try reads to the end of the run, so its time grows with the
 * square of the run. Walking back reads the run once.
 * @module src/model/trailing
 */

/**
 * How many characters before `end` match `char`, a pattern for one character (without
 * the `g` or `y` flag), counted back from `end`.
 */
export function trailingLength(text: string, char: RegExp, end = text.length): number {
  let start = end;
  while (start > 0 && char.test(text.charAt(start - 1))) start--;
  return end - start;
}

/** `text` without the characters at its end that `char`, a pattern for one character, matches. */
export function trimTrailing(text: string, char: RegExp): string {
  return text.slice(0, text.length - trailingLength(text, char));
}
