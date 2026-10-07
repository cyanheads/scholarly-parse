/**
 * @fileoverview DOIs as the model holds them: a field's DOI without its resolver or `doi:`
 * prefix, and the first DOI in running text, read in one pass over its runs of DOI
 * characters without the punctuation, quotes, and brackets that close it. JATS and TEI
 * identifier fields and HTML `<meta>` tags normalize here; PDF, HTML, and LaTeXML
 * references read the DOI in an entry's text here, and a PDF's first page reads the DOI
 * a label introduces.
 * @module src/model/doi
 */

/** A DOI's `10.` prefix and every character after it that a DOI can hold. */
const DOI_RUN = /\b10\.\d{4,9}\/[^\s"<>]+/g;

/** Marks that close a DOI rather than belong to it: a sentence's punctuation, closing quotes. */
const CLOSING_MARKS = '.,;:"\'”’';

/** A resolver URL or `doi:` label leading a DOI field's value. */
const DOI_PREFIX = /^(?:https?:\/\/(?:dx\.|www\.)?doi\.org\/|doi:\s*)/i;

/** A value that starts as a DOI does: `10.`, a registrant code, and a `/`. */
const DOI_START = /^10\.\d{4,9}\//;

/**
 * A label ending right before a DOI: `doi.org/`, `doi:`, or `doi` and a space, then
 * optionally one opening quote. Its whitespace is bounded, so it fits {@link LABEL_WINDOW}.
 */
const DOI_LABEL = /\bdoi(?:\.org\/|:\s{0,8}|\s{1,8})["'“‘]?$/i;

/** How far back from a DOI run its label is looked for: the longest label and the character before it. */
const LABEL_WINDOW = 14;

/**
 * A DOI field's value as the model holds it: without a resolver (`https://doi.org/`,
 * `http://dx.doi.org/`) or `doi:` prefix in any case, without the marks closing it
 * ({@link trimDoi}), lowercased. Undefined for a value that is not a DOI (`n/a`, `10.`,
 * `10.1234/`).
 */
export function normalizeDoi(value: string | undefined): string | undefined {
  if (value === undefined) return;
  const doi = value.trim().replace(DOI_PREFIX, '');
  return DOI_START.test(doi) ? trimDoi(doi)?.toLowerCase() : undefined;
}

/**
 * The first DOI in `text` whose run of DOI characters ends at whitespace, the end of the
 * text, or a quote closing one opened right before it, without the marks closing it
 * ({@link trimDoi}). A run cut short at `<`, `>`, or any other quote is not a whole DOI,
 * and a run that leaves no suffix is passed over. Each run is read once, so a long run
 * that ends at a quote costs one pass, not one per `10.` inside it.
 */
export function doiInText(text: string): string | undefined {
  return firstDoi(text, () => true);
}

/**
 * The first DOI in `text` that a label introduces, read as {@link doiInText} reads one:
 * its run must follow `doi.org/`, `doi:`, or `doi` and a space (in any case), optionally
 * with one opening quote between (`doi: "10.1234/abc"`, `DOI 10.1234/abc`). A DOI with no
 * label before it is passed over. The label is looked for in a bounded window before each
 * run, so the text is still read in one pass.
 */
export function labeledDoiInText(text: string): string | undefined {
  return firstDoi(text, (index) =>
    DOI_LABEL.test(text.slice(Math.max(0, index - LABEL_WINDOW), index)),
  );
}

/** The first whole DOI run in `text` that `accept`, given where the run starts, takes. */
function firstDoi(text: string, accept: (index: number) => boolean): string | undefined {
  for (const { 0: run, index } of text.matchAll(DOI_RUN)) {
    if (!accept(index)) continue;
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
