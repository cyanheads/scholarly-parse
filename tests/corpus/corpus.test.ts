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

  const references = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `r${i}`, text: `R ${i}.` }));
  const table: Block = { headerRows: 0, rows: [['a']], type: 'table' };
  const figure: Block = { type: 'figure' };

  /** A JATS source holding one table, one figure, and twenty references. */
  const SOURCE = `<article><table-wrap><table/></table-wrap><fig><graphic/></fig><ref-list>${'<ref>r</ref>'.repeat(20)}</ref-list></article>`;
  const accounted = (count: number, blocks: Block[] = []) =>
    document({ body: [section('s1', [table, figure, ...blocks])], references: references(count) });

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

  it('reports markup toText kept where the Markdown reads it as markup (#56)', () => {
    // Escaped, each marker is text in the Markdown and in toText alike.
    const literal = document({
      body: [section('s1', [paragraph('\\*\\*a\\*\\* \\_\\_b\\_\\_ [c\\](d) \\~\\~e\\~\\~')])],
    });
    expect(problems(literal)).toEqual([]);
    // TeX keeps its markers in toText, though GFM, which has no math, pairs them as strong.
    const tex = document({
      body: [
        section('s1', [
          paragraph('Duals $A^{**}$ and $B^{**}$ meet.'),
          { tex: 'C^{**} + D^{**}', type: 'formula' },
        ]),
      ],
    });
    expect(problems(tex)).toEqual([]);
    expect(problems(literal, { markdown: '# A title\n\n**a** __b__ [c](d) ~~e~~\n' })).toEqual([
      "toText holds 2 `**` where the Markdown's text holds 0",
      "toText holds 2 `__` where the Markdown's text holds 0",
      "toText holds 1 `](` where the Markdown's text holds 0",
      "toText holds 2 `~~` where the Markdown's text holds 0",
    ]);
  });

  it('reports a table row off its header’s cell count, and a fence or $$ block left open', () => {
    const sound = document();
    const base = toMarkdown(sound);
    // A quoted table with an escaped pipe, then code and math whose lines read like rows.
    const shapes =
      '> | a | b \\| c |\n> | --- | --- |\n> | 1 | 2 |\n\n```\n| x |\n| y | z |\n```\n\n$$\n|a| + |b|\n|c|\n$$\n';
    expect(problems(sound, { markdown: `${base}\n${shapes}` })).toEqual([]);
    expect(
      problems(sound, { markdown: `${base}\n| a | b |\n| --- | --- |\n| 1 | 2 | 3 |\n| 4 |\n` }),
    ).toEqual([
      'a table row of 3 cells under a header of 2',
      'a table row of 1 cells under a header of 2',
    ]);
    expect(problems(sound, { markdown: `${base}\n\`\`\`\n| x |\n` })).toEqual([
      'an unclosed code fence',
    ]);
    expect(problems(sound, { markdown: `${base}\n$$\nx\n` })).toEqual(['an unclosed $$ block']);
  });

  it('reports JATS supplementary files the parse lost or added (#69)', () => {
    // A file the article lists, the same file in Europe PMC's digest, a figure whose only
    // file is a <media>, and a <media> of its own.
    const source =
      '<article><sec sec-type="associated-data"><sec><p>Files.</p></sec>' +
      '<supplementary-material id="d1"/></sec>' +
      '<supplementary-material id="s1"><media xlink:href="s1.pdf"/></supplementary-material>' +
      '<fig id="r1"><media xlink:href="report.pdf"/></fig><p><media xlink:href="movie.mp4"/></p></article>';
    const files = (n: number) =>
      document({
        body: [
          section(
            's1',
            Array.from({ length: n }, (): Block => ({ type: 'supplement' })),
          ),
        ],
      });
    expect(problems(files(3), { source })).toEqual([]);
    expect(problems(files(2), { source })).toEqual([
      '3 supplementary files in the source, 2 supplements parsed',
    ]);
    expect(problems(files(4), { source })).toEqual([
      '3 supplementary files in the source, 4 supplements parsed',
    ]);
  });

  it('reports JATS text fused across a separating element or a run of touching <xref>s', () => {
    const source =
      '<article><body><sec><title>Methods</title><p>Text [<xref rid="r1">1</xref>' +
      '<xref rid="r2">2</xref><xref rid="r3">3</xref>] and <xref rid="f1">Figure ' +
      '<xref rid="f1">1</xref></xref>a.</p></sec></body></article>';
    const reading = (title: string, text: string) =>
      document({ body: [{ ...section('s1', [paragraph(text)]), title }] });
    // An <xref> nested in an <xref> is one marker: `Figure 1a` is how the source reads.
    expect(problems(reading('Methods', 'Text [1,2,3] and Figure 1a.'), { source })).toEqual([]);
    expect(problems(reading('MethodsText', '[123] and Figure 1a.'), { source })).toEqual([
      'text fused across a JATS boundary: "MethodsText"',
      'text fused across a JATS boundary: "[123]"',
    ]);
  });

  it('reads a character reference no code point answers as U+FFFD, as the parser does', () => {
    const source = '<article><body><sec><p>a&#x110000;b&#xD800;c&#0;d</p></sec></body></article>';
    const parsed = document({ body: [section('s1', [paragraph('a�b�c�d')])] });
    expect(problems(parsed, { source })).toEqual([]);
  });

  it('reports TEI references, figures, and tables the parse lost or added', () => {
    // The header's <biblStruct> describes the article itself, not a reference.
    const source =
      '<TEI><teiHeader><sourceDesc><biblStruct/></sourceDesc></teiHeader><text><body>' +
      '<figure><head>F</head></figure><figure type="table"><table/></figure></body>' +
      `<back><listBibl>${'<biblStruct/>'.repeat(3)}</listBibl></back></text></TEI>`;
    const tei = (count: number, blocks: Block[]) =>
      document({ body: [section('s1', blocks)], format: 'tei', references: references(count) });
    expect(problems(tei(3, [figure, table]), { source })).toEqual([]);
    expect(problems(tei(4, []), { source })).toEqual([
      '3 <biblStruct> in <back>, 4 references parsed',
      '1 <figure> in the source, 0 figures parsed',
      '1 <figure> tables in the source, 0 tables parsed',
    ]);
  });

  it('reports LaTeXML references and floats the parse lost', () => {
    // A figure of two panels, a table, and an algorithm float, which renders as code.
    const source =
      `<article>${'<li class="ltx_bibitem" id="bib.bib1">A.</li>'.repeat(2)}` +
      '<figure class="ltx_figure"><figure class="ltx_figure ltx_figure_panel"><img></figure>' +
      '<figure class="ltx_figure ltx_figure_panel"><img></figure></figure>' +
      '<figure class="ltx_table"><table></table></figure>' +
      '<figure class="ltx_float ltx_float_algorithm"><pre>code</pre></figure></article>';
    const latexml = (count: number, blocks: Block[]) =>
      document({ body: [section('s1', blocks)], format: 'latexml', references: references(count) });
    expect(problems(latexml(2, [figure, figure, table]), { source })).toEqual([]);
    expect(problems(latexml(3, [figure]), { source })).toEqual([
      '2 ltx_bibitem in the source, 3 references parsed',
      '2 top-level <figure> in the source, 1 figures and tables parsed',
    ]);
  });
});
