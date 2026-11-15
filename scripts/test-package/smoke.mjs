/**
 * @fileoverview The packed-package smoke, shared by the Node, Bun, and workerd entries.
 * Imports the package root and every subpath by name, then parses each fixture through
 * its format's subpath and through `parse()` and compares both renders with the
 * fixture's `expected.md`. `scripts/test-package.ts` copies this directory into a temp
 * app with the tarball installed, so every import resolves to the installed copy.
 * @module scripts/test-package/smoke
 */
import { parse, toMarkdown } from 'scholarly-parse';
import { parseHtml } from 'scholarly-parse/html';
import { parseJats } from 'scholarly-parse/jats';
import { parseLatexml } from 'scholarly-parse/latexml';
import { parsePdf } from 'scholarly-parse/pdf';
import { parseTei } from 'scholarly-parse/tei';

const PARSERS = {
  html: (bytes, baseUrl) => parseHtml(bytes, { baseUrl }),
  jats: (bytes) => parseJats(bytes),
  latexml: (bytes, baseUrl) => parseLatexml(bytes, { baseUrl }),
  pdf: (bytes) => parsePdf(bytes),
  tei: (bytes) => parseTei(bytes),
};

/**
 * @typedef {object} Fixture
 * @property {string} name `<format>/<id>`
 * @property {keyof typeof PARSERS} format
 * @property {string} baseUrl Where the fixture was retrieved (`meta.json` `url`)
 * @property {string} source The source file, base64
 * @property {string} expected The fixture's `expected.md`
 */

/**
 * Parse every fixture both ways.
 * @param {Fixture[]} fixtures
 * @returns {Promise<{ lines: string[], ok: boolean }>} One line per fixture; `ok` when all match
 */
export async function smoke(fixtures) {
  const lines = [];
  let ok = true;
  for (const { baseUrl, expected, format, name, source } of fixtures) {
    // Fresh bytes per parse, in case a parser hands its buffer off.
    const bytes = () => Uint8Array.from(atob(source), (char) => char.charCodeAt(0));
    const viaSubpath = compare(await PARSERS[format](bytes(), baseUrl), expected);
    const viaParse = compare(await parse(bytes(), { baseUrl }), expected);
    ok &&= viaSubpath === 'match' && viaParse === 'match';
    lines.push(`${name}: subpath ${viaSubpath}, parse() ${viaParse}`);
  }
  return { lines, ok };
}

/** `match`, or how a parse result departs from the expected Markdown. */
function compare(result, expected) {
  if (!result.ok) return `FAILED (${result.error.reason}: ${result.error.message})`;
  const actual = toMarkdown(result.document).split('\n');
  const want = expected.split('\n');
  const line = want.findIndex((text, i) => text !== actual[i]);
  if (line === -1 && actual.length === want.length) return 'match';
  return `MISMATCH from line ${(line === -1 ? want.length : line) + 1}`;
}
