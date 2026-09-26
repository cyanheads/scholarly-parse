/**
 * @fileoverview The parser for each corpus format, called the way the corpus suite and
 * the corpus scripts run a fixture. A format without one yet has no entry.
 * @module tests/corpus/parsers
 */
import { parseHtml } from '../../src/formats/html/index.js';
import { parseJats } from '../../src/formats/jats/index.js';
import { parseLatexml } from '../../src/formats/latexml/index.js';
import { parsePdf } from '../../src/formats/pdf/index.js';
import { parseTei } from '../../src/formats/tei/index.js';
import type { ParseResult } from '../../src/model/result.js';
import type { CorpusFormat } from './fixtures.js';

/** A format's parser; `url` is where the fixture was retrieved, for formats that resolve links against it. */
export type Parser = (input: Uint8Array, url: string) => ParseResult | Promise<ParseResult>;

export const PARSERS: Partial<Record<CorpusFormat, Parser>> = {
  html: (input, url) => parseHtml(input, { baseUrl: url }),
  jats: (input) => parseJats(input),
  latexml: (input, url) => parseLatexml(input, { baseUrl: url }),
  pdf: (input) => parsePdf(input),
  tei: (input) => parseTei(input),
};
