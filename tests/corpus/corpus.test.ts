/**
 * @fileoverview Every corpus fixture through its format's parser: `detect` names its
 * format, the parse succeeds, every invariant holds, the fixture's own assertions hold,
 * the parse is deterministic, and the Markdown matches the reviewed snapshot. Each
 * invariant is also run on a document broken the way it guards against, so a pass means
 * something.
 *
 * `SCHOLARLY_PARSE_UPDATE_SNAPSHOTS=1` (`bun run corpus:snapshot`) rewrites
 * `expected.md` instead of comparing. Review every rewritten snapshot before committing.
 * @module tests/corpus/corpus.test
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detect } from '../../src/detect.js';
import type { Block, ScholarlyDocument, Section } from '../../src/model/document.js';
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

describe('checkInvariants on a broken document', () => {
  const paragraph = (text: string): Block => ({ text, type: 'paragraph' });
  const section = (id: string, blocks: Block[] = [paragraph('Text.')]): Section => ({
    blocks,
    id,
    kind: 'body',
    sections: [],
    title: 'Introduction',
  });
  const document = (parts: Partial<ScholarlyDocument> = {}): ScholarlyDocument => ({
    abstracts: [],
    back: [],
    body: [section('s1')],
    diagnostics: { quality: 'structured', unhandled: [], warnings: [] },
    floats: [],
    footnotes: [],
    format: 'jats',
    metadata: { title: 'A title' },
    references: [],
    ...parts,
  });
  const problems = (
    parsed: ScholarlyDocument,
    { markdown = toMarkdown(parsed), source }: { markdown?: string; source?: string } = {},
  ) => checkInvariants({ document: parsed, format: parsed.format, markdown, source });

  /** A JATS source holding one table, one figure, and twenty references. */
  const SOURCE = `<article><table-wrap><table/></table-wrap><fig><graphic/></fig><ref-list>${'<ref>r</ref>'.repeat(20)}</ref-list></article>`;
  const accounted = (references: number, blocks: Block[] = []) =>
    document({
      body: [
        section('s1', [
          { headerRows: 0, rows: [['a']], type: 'table' },
          { type: 'figure' },
          ...blocks,
        ]),
      ],
      references: Array.from({ length: references }, (_, i) => ({ id: `r${i}`, text: `R ${i}.` })),
    });

  it('finds nothing in a sound document', () => {
    expect(problems(document())).toEqual([]);
    // Nineteen of twenty references is the 95% the reference check allows.
    expect(problems(accounted(19), { source: SOURCE })).toEqual([]);
    // A token the source itself holds is content.
    expect(problems(document({ metadata: { title: 'NaN' } }), { source: 'NaN' })).toEqual([]);
  });

  it.each([
    ['a leaked tag', '<italic>x</italic> text.', /^leaked source tag "<italic>/],
    ['an undecoded entity', 'a &amp; b', /^undecoded entity "&amp;"$/],
    ['a TeX preamble', '\\documentclass{article} body', /^a LaTeX document preamble/],
    ['a split surrogate pair', 'a\uD800b', /^a split surrogate pair$/],
  ])('reports %s in the Markdown', (_, text, problem) => {
    expect(problems(document({ body: [section('s1', [paragraph(text)])] }))).toEqual([
      expect.stringMatching(problem),
    ]);
  });

  it('reports an empty heading and a missing value rendered as content', () => {
    const sound = document();
    expect(problems(sound, { markdown: `${toMarkdown(sound)}\n## \n` })).toEqual([
      'an empty heading',
    ]);
    expect(problems(sound, { markdown: `${toMarkdown(sound)}\nnull\n` })).toEqual([
      '"null" rendered as content',
    ]);
  });

  it('reports a missing value or object stringified into the model', () => {
    expect(problems(document({ metadata: { title: 'undefined' } }))).toEqual([
      'a stringified missing value or object at metadata.title',
    ]);
    expect(problems(document({ body: [section('s1', [paragraph('[object Object]')])] }))).toEqual([
      'a stringified missing value or object at body[0].blocks[0].text',
      '"[object Object]" rendered as content',
    ]);
  });

  it('reports duplicate and reserved section IDs', () => {
    expect(problems(document({ body: [section('s1'), section('s1')] }))).toEqual([
      'duplicate section id "s1"',
      'duplicate toSections id "s1"',
    ]);
    expect(problems(document({ body: [section('references')] }))).toEqual([
      'section id "references" is one toSections generates',
    ]);
  });

  it('reports JATS tables, figures, and references the parse lost', () => {
    expect(problems(document(), { source: SOURCE })).toEqual([
      '1 <table-wrap> or <array> in the source, 0 tables parsed',
      '1 <fig> in the source, 0 figures parsed',
      '20 <ref> in the source, 0 references parsed',
    ]);
    expect(problems(accounted(18), { source: SOURCE })).toEqual([
      '20 <ref> in the source, 18 references parsed',
    ]);
    const extra = accounted(20, [{ headerRows: 0, rows: [['b']], type: 'table' }]);
    expect(problems(extra, { source: SOURCE })).toEqual([
      '1 <table-wrap> or <array> in the source, 2 tables parsed',
    ]);
  });
});
