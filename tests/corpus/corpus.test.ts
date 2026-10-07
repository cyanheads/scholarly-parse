/**
 * @fileoverview Every corpus fixture through its format's parser: `detect` names its
 * format, the parse succeeds, every invariant holds, the fixture's own assertions hold,
 * the parse is deterministic, and the Markdown matches the reviewed snapshot.
 *
 * `SCHOLARLY_PARSE_UPDATE_SNAPSHOTS=1` (`bun run corpus:snapshot`) rewrites
 * `expected.md` instead of comparing. Review every rewritten snapshot before committing.
 * @module tests/corpus/corpus.test
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detect } from '../../src/detect.js';
import { decodeText } from '../../src/model/input.js';
import { toMarkdown } from '../../src/render/markdown.js';
import { checkExpect, fixtureExpectSchema } from './expect.js';
import { type CorpusFormat, fixtureMetaSchema, listFixtures } from './fixtures.js';
import { checkInvariants } from './invariants.js';
import { PARSERS } from './parsers.js';

const UPDATE = process.env.SCHOLARLY_PARSE_UPDATE_SNAPSHOTS === '1';
const TEXT_FORMATS: ReadonlySet<CorpusFormat> = new Set(['jats', 'tei', 'latexml', 'html']);

/** `text` as UTF-16LE behind its byte-order mark. */
function utf16le(text: string): Uint8Array {
  const units = `\uFEFF${text}`;
  const out = new Uint8Array(units.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < units.length; i++) view.setUint16(i * 2, units.charCodeAt(i), true);
  return out;
}

describe.each(listFixtures())('corpus/$format/$name', (fixture) => {
  // A text source also behind a UTF-8 byte-order mark, and re-encoded as UTF-16LE with one.
  it('detects as its format', () => {
    const bytes = new Uint8Array(readFileSync(fixture.sourcePath));
    expect(detect(bytes)).toBe(fixture.format);
    if (!TEXT_FORMATS.has(fixture.format)) return;
    const marked = new Uint8Array(bytes.byteLength + 3);
    marked.set([0xef, 0xbb, 0xbf]);
    marked.set(bytes, 3);
    expect(detect(marked)).toBe(fixture.format);
    expect(detect(utf16le(decodeText(bytes)))).toBe(fixture.format);
  });

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
