/**
 * @fileoverview The first DOI in running text, read in one pass over its runs of DOI
 * characters, without the punctuation, quotes, and brackets that close it. PDF, HTML, and
 * LaTeXML references read the DOI in an entry's text here.
 * @module src/model/doi
 */

/** A DOI's `10.` prefix and every character after it that a DOI can hold. */
const DOI_RUN = /\b10\.\d{4,9}\/[^\s"<>]+/g;

/** Marks that close a DOI rather than belong to it: a sentence's punctuation, closing quotes. */
const CLOSING_MARKS = '.,;:"\'”’';

/**
 * The first DOI in `text` whose run of DOI characters ends at whitespace, the end of the
 * text, or a quote closing one opened right before it, without the marks closing it
 * ({@link trimDoi}). A run cut short at `<`, `>`, or any other quote is not a whole DOI,
 * and a run that leaves no suffix is passed over. Each run is read once, so a long run
 * that ends at a quote costs one pass, not one per `10.` inside it.
 */
export function doiInText(text: string): string | undefined {
  for (const { 0: run, index } of text.matchAll(DOI_RUN)) {
    const after = text.charAt(index + run.length);
    const whole = !after || /\s/.test(after) || (after === '"' && text.charAt(index - 1) === '"');
    const doi = whole ? trimDoi(run) : undefined;
    if (doi) return doi;
  }
  return;
}

/**
 * `doi` without the punctuation, quotes, and brackets closing it, or undefined when that
 * leaves no suffix. A `)` or `]` goes only when nothing before it in the DOI opens it, so
 * `10.1002/(SICI)1097-4636(199907)` stays whole. One pass matches the brackets and one
 * walks back from the end.
 */
export function trimDoi(doi: string): string | undefined {
  const unmatched = new Set<number>();
  const open = { ')': 0, ']': 0 };
  for (let i = 0; i < doi.length; i++) {
    const char = doi.charAt(i);
    if (char === '(') open[')']++;
    else if (char === '[') open[']']++;
    else if (char === ')' || char === ']') {
      if (open[char] > 0) open[char]--;
      else unmatched.add(i);
    }
  }
  let end = doi.length;
  while (end > 0 && (CLOSING_MARKS.includes(doi.charAt(end - 1)) || unmatched.has(end - 1))) end--;
  const kept = doi.slice(0, end);
  return kept.length > kept.indexOf('/') + 1 ? kept : undefined;
}
