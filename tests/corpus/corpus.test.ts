/**
 * @fileoverview Every corpus fixture through its format's parser: the parse succeeds,
 * every invariant holds, the fixture's own assertions hold, the parse is deterministic,
 * and the Markdown matches the reviewed snapshot.
 *
 * `SCHOLARLY_PARSE_UPDATE_SNAPSHOTS=1` (`bun run corpus:snapshot`) rewrites
 * `expected.md` instead of comparing. Review every rewritten snapshot before committing.
 * @module tests/corpus/corpus.test
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHtml } from '../../src/formats/html/index.js';
import { parseJats } from '../../src/formats/jats/index.js';
import { parseLatexml } from '../../src/formats/latexml/index.js';
import { parseTei } from '../../src/formats/tei/index.js';
import type { ParseResult } from '../../src/model/result.js';
import { toMarkdown } from '../../src/render/markdown.js';
import { checkExpect, fixtureExpectSchema } from './expect.js';
import { type CorpusFormat, fixtureMetaSchema, listFixtures } from './fixtures.js';
import { checkInvariants } from './invariants.js';

/** A format's parser; `url` is where the fixture was retrieved, for formats that resolve links against it. */
type Parser = (input: Uint8Array, url: string) => ParseResult | Promise<ParseResult>;

/** The parser for each format. A format without one yet is listed as pending. */
const PARSERS: Partial<Record<CorpusFormat, Parser>> = {
  html: (input, url) => parseHtml(input, { baseUrl: url }),
  jats: (input) => parseJats(input),
  latexml: (input, url) => parseLatexml(input, { baseUrl: url }),
  tei: (input) => parseTei(input),
};

const UPDATE = process.env.SCHOLARLY_PARSE_UPDATE_SNAPSHOTS === '1';
const TEXT_FORMATS: ReadonlySet<CorpusFormat> = new Set(['jats', 'tei', 'latexml', 'html']);

describe.each(listFixtures())('corpus/$format/$name', (fixture) => {
  const parse = PARSERS[fixture.format];
  if (!parse) {
    it.todo(`parse with the ${fixture.format} parser`);
    return;
  }

  it('parses, holds every invariant and assertion, and matches its snapshot', async () => {
    const bytes = new Uint8Array(readFileSync(fixture.sourcePath));
    const { url } = fixtureMetaSchema.parse(fixture.meta);
    const result = await parse(bytes, url);
    if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
    const { document } = result;
    const markdown = toMarkdown(document);
    const source = TEXT_FORMATS.has(fixture.format) ? new TextDecoder().decode(bytes) : undefined;

    const problems = checkInvariants({ document, format: fixture.format, markdown, source });
    const expectPath = join(fixture.dir, 'expect.json');
    if (existsSync(expectPath)) {
      const assertions = fixtureExpectSchema.parse(JSON.parse(readFileSync(expectPath, 'utf8')));
      problems.push(...checkExpect(assertions, document, markdown));
    }
    expect(problems).toEqual([]);

    const again = await parse(bytes, url);
    expect(again).toEqual(result);

    const snapshotPath = join(fixture.dir, 'expected.md');
    if (UPDATE) {
      writeFileSync(snapshotPath, markdown);
    } else {
      expect(
        existsSync(snapshotPath),
        'no expected.md — run `bun run corpus:snapshot` and review it',
      ).toBe(true);
      expect(markdown).toBe(readFileSync(snapshotPath, 'utf8'));
    }
  });
});
