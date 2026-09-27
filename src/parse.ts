/**
 * @fileoverview `parse`: detect a payload's format and hand it to that format's parser.
 * Parsers load on first use, so importing the package root never loads an HTML or PDF
 * engine a caller does not need.
 * @module src/parse
 */
import { detect } from './detect.js';
import type { SourceFormat } from './model/document.js';
import { failed, type ParseOptions, type ParseResult } from './model/result.js';

/** Options for {@link parse}. Each applies to the formats that read it. */
export interface AutoParseOptions extends ParseOptions {
  /** Where the document was retrieved, so relative links and images resolve (HTML, LaTeXML). */
  baseUrl?: string;
  /** The format, when the caller knows it: skips detection. */
  format?: SourceFormat;
  /** Read no further page once the pages read hold more than this many operators (PDF). */
  maxOperators?: number;
  /** Read at most this many pages (PDF). */
  maxPages?: number;
  /** Read at most this many characters of text (PDF). */
  maxTextChars?: number;
  /** Read at most this many text items (PDF). */
  maxTextItems?: number;
}

/**
 * Parse a document of any supported format. The format comes from the payload itself
 * (see `detect`); a challenge or access-denied page is HTML and fails as `blocked`.
 * PDF needs its bytes: PDF passed as a string fails as `wrong-format`.
 */
export async function parse(
  input: string | Uint8Array,
  options: AutoParseOptions = {},
): Promise<ParseResult> {
  const { baseUrl, format = detect(input), maxInputBytes, ...pdfLimits } = options;
  const budget = maxInputBytes === undefined ? {} : { maxInputBytes };
  const located = baseUrl === undefined ? budget : { ...budget, baseUrl };
  switch (format) {
    case 'jats':
      return (await import('./formats/jats/index.js')).parseJats(input, budget);
    case 'tei':
      return (await import('./formats/tei/index.js')).parseTei(input, budget);
    case 'latexml':
      return (await import('./formats/latexml/index.js')).parseLatexml(input, located);
    case 'html':
      return (await import('./formats/html/index.js')).parseHtml(input, located);
    case 'pdf':
      if (typeof input === 'string')
        return failed(
          'wrong-format',
          'PDF must be passed as bytes: text decoding loses its binary content',
        );
      return (await import('./formats/pdf/index.js')).parsePdf(input, {
        ...budget,
        ...pdfLimits,
      });
    case undefined:
      return failed(
        'wrong-format',
        'Not a format this package reads: no PDF header, XML root element, or HTML markup',
      );
  }
}
