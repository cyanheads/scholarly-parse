/**
 * @fileoverview `parseTei` on synthetic Grobid TEI: the result contract, both document
 * shapes, front matter from the header, the section tree rebuilt from heading numbers
 * (numbered list items written as headings included), floats, back matter by type, and
 * references from `<biblStruct>`.
 * @module tests/formats/tei/tei.test
 */
import { describe, expect, it } from 'vitest';
import { parseTei } from '../../../src/formats/tei/index.js';
import type { ScholarlyDocument, Section } from '../../../src/model/document.js';
import { toMarkdown, toSections } from '../../../src/render/index.js';
import { expectLinear } from '../../linear.js';
import { liveMarkup, SPLIT_MARKUP } from '../jats/helpers.js';

const HEADER = `<teiHeader xml:lang="en"><fileDesc>
  <titleStmt><title level="a" type="main">A study of things</title></titleStmt>
  <publicationStmt><publisher>Springer</publisher>
    <availability><licence target="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</licence></availability>
    <date type="published" when="2024-05-12">12 May 2024</date></publicationStmt>
  <sourceDesc><biblStruct><analytic>
    <author role="corresp"><persName><forename type="first">Jane</forename><forename type="middle">Q</forename><surname>Doe</surname></persName>
      <email>jane@example.org</email><idno type="ORCID">0000-0002-1825-0097</idno>
      <affiliation><orgName type="institution">University of Somewhere</orgName><address><settlement>Leeds</settlement><country>UK</country></address></affiliation></author>
    <author><persName><forename>Richard</forename><surname>Roe</surname></persName>
      <affiliation><orgName type="institution">University of Somewhere</orgName><address><settlement>Leeds</settlement><country>UK</country></address></affiliation></author>
    <idno type="DOI">10.1234/ABC</idno></analytic>
    <monogr><title level="j">Journal of Tests</title><imprint>
      <biblScope unit="volume">7</biblScope><biblScope unit="issue">2</biblScope>
      <biblScope unit="page" from="10" to="20"/></imprint></monogr></biblStruct></sourceDesc></fileDesc>
  <encodingDesc><appInfo><application ident="GROBID" version="0.8.1"/></appInfo></encodingDesc>
  <profileDesc><textClass><keywords><term>alpha</term><term>beta</term></keywords></textClass>
    <abstract><div><p>We did this.</p></div></abstract></profileDesc></teiHeader>`;

function tei(body: string, back = '', header = HEADER): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}<text><body>${body}</body><back>${back}</back></text></TEI>`;
}

function parse(xml: string): ScholarlyDocument {
  const result = parseTei(xml);
  if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
  return result.document;
}

const div = (n: string | undefined, head: string | undefined, text: string) =>
  `<div>${head === undefined ? '' : `<head${n ? ` n="${n}"` : ''}>${head}</head>`}<p>${text}</p></div>`;

/** Each section as its label, or its title when it has none, followed by its subsections. */
const tree = (sections: Section[]): unknown[] =>
  sections.map((s) => [s.label ?? s.title, ...(s.sections.length ? [tree(s.sections)] : [])]);

/** The outline of a body built from `[n, heading]` pairs, each div holding one paragraph. */
const outlineOf = (...heads: [string | undefined, string][]) =>
  tree(parse(tei(heads.map(([n, head], i) => div(n, head, `p${i}`)).join(''))).body);

describe('the result contract', () => {
  it('reports what is not TEI, broken, empty, or over budget', () => {
    expect(parseTei('<html><body>No TEI</body></html>')).toMatchObject({
      error: { reason: 'wrong-format' },
      ok: false,
    });
    expect(parseTei('<TEI><text><body><p>unclosed</body></text></TEI>')).toMatchObject({
      error: { reason: 'malformed' },
      ok: false,
    });
    expect(parseTei('<TEI><teiHeader/><text><body/></text></TEI>')).toMatchObject({
      error: { reason: 'empty' },
      ok: false,
    });
    expect(parseTei(tei(div('1', 'A', 'x')), { maxInputBytes: 100 })).toMatchObject({
      error: { reason: 'too-large' },
      ok: false,
    });
  });

  it('finds the last closing tag in one pass over a run of them', () => {
    const started = performance.now();
    const result = parseTei(`<TEI>${'</tei >'.repeat(20_000)}${'x'.repeat(500_000)}`);
    expect(result).toMatchObject({ error: { reason: 'malformed' }, ok: false });
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('reads the lowercase TEI OpenAlex serves inside an HTML page, divs directly under <text>', () => {
    const document = parse(
      `<html><body><tei><teiheader><filedesc><titlestmt><title>Wrapped</title></titlestmt></filedesc></teiheader>
       <text><div><head n="1">Introduction</head><p>Hello.</p></div></text></tei></body></html>`,
    );
    expect(document.metadata.title).toBe('Wrapped');
    expect(document.body.map((s) => [s.label, s.title, s.blocks])).toEqual([
      ['1', 'Introduction', [{ text: 'Hello.', type: 'paragraph' }]],
    ]);
  });

  it('reads the back matter OpenAlex places beside <text> in the lowercase TEI', () => {
    const document = parse(
      `<html><body><tei><teiheader><filedesc><titlestmt><title>Wrapped</title></titlestmt></filedesc></teiheader>
       <text><div><head n="1">Introduction</head><p>Hello.</p></div></text>
       <back><div type="acknowledgement"><div xmlns="http://www.tei-c.org/ns/1.0"><p>Thanks.</p></div></div>
         <div type="references"><listbibl><biblstruct xml:id="b0"><analytic><title level="a">A cited work</title></analytic>
           <monogr><imprint><date when="2020"/></imprint></monogr></biblstruct></listbibl></div></back></tei></body></html>`,
    );
    expect(document.back.map((s) => [s.kind, s.blocks])).toEqual([
      ['acknowledgments', [{ text: 'Thanks.', type: 'paragraph' }]],
    ]);
    expect(document.references.map((r) => r.title)).toEqual(['A cited work']);
  });
});

describe('front matter', () => {
  it('reads title, authors, affiliations, identifiers, venue, date, keywords, license, and language', () => {
    const document = parse(tei(div('1', 'Introduction', 'Text.')));
    expect(document.flavor).toBe('grobid');
    expect(document.metadata).toEqual({
      affiliations: ['University of Somewhere, Leeds, UK'],
      authors: [
        {
          affiliations: [0],
          corresponding: true,
          email: 'jane@example.org',
          family: 'Doe',
          given: 'Jane Q',
          name: 'Jane Q Doe',
          orcid: '0000-0002-1825-0097',
        },
        { affiliations: [0], family: 'Roe', given: 'Richard', name: 'Richard Roe' },
      ],
      identifiers: { doi: '10.1234/abc' },
      keywords: ['alpha', 'beta'],
      language: 'en',
      license: { text: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
      published: { day: 12, month: 5, year: 2024 },
      title: 'A study of things',
      venue: {
        issue: '2',
        pages: '10-20',
        publisher: 'Springer',
        title: 'Journal of Tests',
        volume: '7',
      },
    });
    expect(document.abstracts).toEqual([
      {
        kind: 'main',
        sections: [
          {
            blocks: [{ text: 'We did this.', type: 'paragraph' }],
            id: 'abstract-1-1',
            kind: 'body',
            sections: [],
          },
        ],
      },
    ]);
  });
});

describe('abstract part IDs (#24)', () => {
  it('numbers abstract parts abstract-1-<m>, apart from the IDs toSections generates', () => {
    const header = HEADER.replace(
      '<abstract><div><p>We did this.</p></div></abstract>',
      '<abstract><div><p>Aim.</p></div><div xml:id="abstract-2"><p>Method.</p></div></abstract>',
    );
    const document = parse(
      tei(
        '<div xml:id="abstract-1"><head n="1">Intro</head><p>Text.</p></div>' +
          '<div xml:id="floats"><head n="2">Floats</head><p>Text.</p></div>',
        '',
        header,
      ),
    );
    expect(document.abstracts[0]?.sections.map((section) => section.id)).toEqual([
      'abstract-1-1',
      'abstract-2-2',
    ]);
    expect(document.body.map((section) => section.id)).toEqual(['abstract-1-2', 'floats-2']);
    const ids = toSections(document).map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('affiliations', () => {
  /** A header whose authors each list the affiliations given, by name. */
  const withAuthors = (authors: string[][]) =>
    HEADER.replace(
      /<analytic>[\s\S]*<\/analytic>/,
      `<analytic>${authors
        .map(
          (affs, i) =>
            `<author><persName><surname>A${i}</surname></persName>${affs
              .map(
                (aff) => `<affiliation><orgName type="institution">${aff}</orgName></affiliation>`,
              )
              .join('')}</author>`,
        )
        .join('')}</analytic>`,
    );
  const metadataOf = (authors: string[][]) =>
    parse(tei(div('1', 'A', 'x'), '', withAuthors(authors))).metadata;

  it('lists each affiliation once, in order of first mention, and indexes authors into it', () => {
    const metadata = metadataOf([
      ['X', 'Y'],
      ['Y', 'Z', 'X'],
      ['Z', 'Z'],
    ]);
    expect(metadata.affiliations).toEqual(['X', 'Y', 'Z']);
    expect(metadata.authors?.map((a) => a.affiliations)).toEqual([[0, 1], [1, 2, 0], [2]]);
  });

  it('reads 50,000 authors with distinct affiliations in time linear in their count', async () => {
    const xml = (n: number) =>
      tei(
        div('1', 'A', 'x'),
        '',
        withAuthors(Array.from({ length: n }, (_, i) => [`Institute ${i}`])),
      );
    await expectLinear(xml, parseTei, { from: 3_125, to: 50_000 });
    const { affiliations, authors } = parse(xml(50_000)).metadata;
    expect(affiliations).toHaveLength(50_000);
    expect(affiliations?.every((aff, i) => aff === `Institute ${i}`)).toBe(true);
    expect(authors?.map((a) => a.affiliations)).toEqual(affiliations?.map((_, i) => [i]));
  }, 60_000);
});

describe('keywords', () => {
  it('keeps keywords Grobid could not split into terms as one keyword', () => {
    const header = HEADER.replace(
      '<keywords><term>alpha</term><term>beta</term></keywords>',
      '<keywords>physical education -teacher training</keywords>',
    );
    expect(parse(tei(div('1', 'A', 'x'), '', header)).metadata.keywords).toEqual([
      'physical education -teacher training',
    ]);
  });
});

describe('sections', () => {
  it('rebuilds the tree from heading numbers, the flat run of divs Grobid writes', () => {
    const document = parse(
      tei(
        div('1', 'Introduction', 'a') +
          div('2', 'Methods', 'b') +
          div('2.1', 'Data', 'c') +
          div('2.1.1', 'Sources', 'd') +
          div('2.2', 'Model', 'e') +
          div('3', 'Results', 'f'),
      ),
    );
    const outline = (sections: ScholarlyDocument['body']): unknown[] =>
      sections.map((s) => [s.label, s.title, ...(s.sections.length ? [outline(s.sections)] : [])]);
    expect(outline(document.body)).toEqual([
      ['1', 'Introduction'],
      [
        '2',
        'Methods',
        [
          ['2.1', 'Data', [['2.1.1', 'Sources']]],
          ['2.2', 'Model'],
        ],
      ],
      ['3', 'Results'],
    ]);
  });

  it('continues the section before a heading-less div, and drops the number punctuation Grobid leaves', () => {
    const document = parse(
      tei(div('2', '. Soil chemistry', 'First.') + div(undefined, undefined, 'More.')),
    );
    expect(document.body).toEqual([
      {
        blocks: [
          { text: 'First.', type: 'paragraph' },
          { text: 'More.', type: 'paragraph' },
        ],
        id: 's1',
        kind: 'body',
        label: '2',
        sections: [],
        title: 'Soil chemistry',
      },
    ]);
  });

  it('gives a back-matter heading in the body its kind and starts the outline over', () => {
    const document = parse(
      tei(
        div('1', 'Introduction', 'a') +
          div(undefined, 'Acknowledgements', 'Thanks.') +
          div('2', 'Results', 'b'),
      ),
    );
    expect(document.body.map((s) => [s.title, s.kind])).toEqual([
      ['Introduction', 'body'],
      ['Acknowledgements', 'acknowledgments'],
      ['Results', 'body'],
    ]);
  });

  it('reads inline markup, formulas, lists, and footnotes', () => {
    const document = parse(
      tei(
        '<div><head n="1">Methods</head><p>We used <hi rend="italic">E. coli</hi> at 10<hi rend="superscript">5</hi> cells ' +
          'as in <ref type="bibr" target="#b0">[1]</ref>, see <ref target="https://example.org">the site</ref>.' +
          '<note place="foot" n="1">A footnote.</note></p>' +
          '<formula xml:id="formula_0">E = mc 2<label>(1)</label></formula>' +
          '<list><item>One</item><item>Two</item></list></div>',
      ),
    );
    expect(document.body[0]?.blocks).toEqual([
      {
        text: 'We used *E. coli* at 10^5 cells as in [1], see [the site](https://example.org).^1',
        type: 'paragraph',
      },
      { id: 'formula_0', label: '(1)', text: 'E = mc 2', type: 'formula' },
      {
        items: [[{ text: 'One', type: 'paragraph' }], [{ text: 'Two', type: 'paragraph' }]],
        ordered: false,
        type: 'list',
      },
    ]);
    expect(document.footnotes).toEqual([{ label: '1', text: 'A footnote.' }]);
  });

  it("prints a footnote reference as its note's mark, not the note ID Grobid may write", () => {
    const document = parse(
      tei(
        '<div><head n="1">Systems</head><p>Google Translate,<ref type="foot" target="#foot_0">foot_0</ref> and more.</p></div>' +
          '<note place="foot" n="1" xml:id="foot_0">https://translate.google.com</note>',
      ),
    );
    expect(document.body[0]?.blocks).toEqual([
      { text: 'Google Translate,^1 and more.', type: 'paragraph' },
    ]);
  });

  it('keeps a numbered heading with no text of its own for the headings after it', () => {
    // 3.1's content sits in the divs after it, under unnumbered paragraph headings.
    const document = parse(
      tei(
        div('3', 'Evaluation', 'a') +
          '<div><head n="3.1">Setup</head></div>' +
          div(undefined, 'Systems', 'b') +
          div(undefined, 'Languages', 'c') +
          div('3.2', 'Results', 'd') +
          div('4', 'Discussion', 'e') +
          div(undefined, 'Limitations', 'f'),
      ),
    );
    const outline = (sections: ScholarlyDocument['body']): unknown[] =>
      sections.map((s) => [s.title, ...(s.sections.length ? [outline(s.sections)] : [])]);
    expect(outline(document.body)).toEqual([
      ['Evaluation', [['Setup', [['Systems'], ['Languages']]], ['Results']]],
      ['Discussion', [['Limitations']]],
    ]);
  });

  it('nests an unnumbered heading under a top-level section numbered `2.` as under one numbered `2`', () => {
    for (const [one, two] of [
      ['1', '2'],
      ['1.', '2.'],
    ] as const) {
      expect(outlineOf([one, 'Intro'], [two, 'Methods'], [undefined, 'Outcome'])).toEqual([
        [one],
        [two, [['Outcome']]],
      ]);
    }
    expect(outlineOf(['2.', 'Methods'], ['2.1.', 'Data'], [undefined, 'Sources'])).toEqual([
      ['2.', [['2.1.', [['Sources']]]]],
    ]);
  });

  it('spaces the sentences Grobid segments into adjacent <s> elements', () => {
    const document = parse(
      tei(
        '<div><head>Methods</head><p><s>First one.</s><s>Second <hi rend="italic">one</hi>.</s></p></div>' +
          '<note place="foot" n="1"><p><s>Shah et al.</s><s>Cureus 14(4).</s></p></note>',
      ),
    );
    expect(document.body[0]?.blocks).toEqual([
      { text: 'First one. Second *one*.', type: 'paragraph' },
    ]);
    expect(document.footnotes).toEqual([{ label: '1', text: 'Shah et al. Cureus 14(4).' }]);
  });

  it('keeps an unnumbered heading with no text of its own ahead of the sections after it', () => {
    // Without numbers the outline stays flat, but the heading is not lost.
    const document = parse(
      tei(
        div(undefined, 'Introduction', 'a') +
          '<div><head>Results</head></div>' +
          div(undefined, 'Analysis overview', 'b') +
          div(undefined, 'Discussion', 'c'),
      ),
    );
    expect(document.body.map((s) => [s.title, s.blocks.length])).toEqual([
      ['Introduction', 1],
      ['Results', 0],
      ['Analysis overview', 1],
      ['Discussion', 1],
    ]);
  });

  it('drops a heading nothing follows', () => {
    const document = parse(
      tei(`${div('1', 'Introduction', 'a')}<div><head n="2">Empty</head></div>`),
    );
    expect(document.body.map((s) => s.title)).toEqual(['Introduction']);
  });
});

describe('numbered list items Grobid writes as headings', () => {
  it('nests the items under the section they interrupt', () => {
    const document = parse(
      tei(
        div('1.', 'Introduction', 'a') +
          div('2.', 'Methods', 'b') +
          div('2.1.', 'Data', 'c') +
          div('1.', 'First step.', 'd') +
          div('2.', 'Second step.', 'e') +
          div('2.2.', 'Model', 'f'),
      ),
    );
    expect(toMarkdown(document).match(/^#{2,} \d.*/gm)).toEqual([
      '## 1. Introduction',
      '## 2. Methods',
      '### 2.1. Data',
      '#### 1. First step.',
      '#### 2. Second step.',
      '### 2.2. Model',
    ]);
  });

  it('keeps the empty section a list interrupts, and the sections after it in place', () => {
    const document = parse(
      tei(
        div('5.', 'Discussion', 'a') +
          '<div><head n="5.5.">Limitations</head></div>' +
          div('1.', 'Retrospective design. Hidden confounding may persist.', 'b') +
          div('5.6.', 'Future Directions', 'c'),
      ),
    );
    expect(tree(document.body)).toEqual([['5.', [['5.5.', [['1.']]], ['5.6.']]]]);
    expect(document.body[0]?.sections[0]?.sections[0]?.title).toBe(
      'Retrospective design. Hidden confounding may persist.',
    );
  });

  it('nests a list that starts past 1', () => {
    expect(
      outlineOf(
        ['5.', 'Results'],
        ['5.1.', 'Validation'],
        ['5.1.4.', 'Comparison'],
        ['2.', 'Single-vehicle against multi-vehicle'],
        ['3.', 'Basic against improved'],
        ['5.2.', 'Application'],
      ),
    ).toEqual([['5.', [['5.1.', [['5.1.4.', [['2.'], ['3.']]]]], ['5.2.']]]]);
  });

  it('ends a list at the section that resumes the outline, even one numbered like an item', () => {
    // Items 1-4 and 6 under section 2, item 5 lost in a running header, then section 3.
    expect(
      outlineOf(
        ['1.', 'Introduction'],
        ['2.', 'Materials and methods'],
        ['1.', 'Attendance (%):'],
        ['2.', 'Completion of sessions (%):'],
        ['3.', 'Compliance with exercises (%):'],
        ['4.', 'Follow-up participation (%):'],
        [undefined, 'Journal of Tests | Volume 14 5. Session duration (%):'],
        ['6.', 'Overall adherence (%):'],
        ['3.', 'RESULTS'],
        ['4.', 'DISCUSSION'],
      ),
    ).toEqual([
      ['1.'],
      [
        '2.',
        [
          ['1.'],
          ['2.'],
          ['3.'],
          ['4.'],
          ['Journal of Tests | Volume 14 5. Session duration (%):'],
          ['6.'],
        ],
      ],
      ['3.'],
      ['4.'],
    ]);
  });

  it('leaves the next section out of a list whose numbers it continues', () => {
    expect(
      outlineOf(
        ['1.', 'Introduction'],
        ['2.', 'Methods'],
        ['1.', 'One'],
        ['2.', 'Two'],
        ['3.', 'Results'],
        ['3.1.', 'Data'],
      ),
    ).toEqual([['1.'], ['2.', [['1.'], ['2.']]], ['3.', [['3.1.']]]]);
  });

  it('continues an item with the heading-less div after it', () => {
    const document = parse(
      tei(
        div('5.', 'Discussion', 'a') +
          div('5.5.', 'Limitations', 'b') +
          div('1.', 'Retrospective design.', 'c') +
          '<div><p>d</p></div>' +
          div('5.6.', 'Future Directions', 'e'),
      ),
    );
    const limitations = document.body[0]?.sections[0];
    expect(limitations?.blocks).toEqual([{ text: 'b', type: 'paragraph' }]);
    expect(limitations?.sections.map((s) => [s.label, s.blocks])).toEqual([
      [
        '1.',
        [
          { text: 'c', type: 'paragraph' },
          { text: 'd', type: 'paragraph' },
        ],
      ],
    ]);
  });

  it('leaves a section Grobid writes twice, number and title repeated', () => {
    expect(
      outlineOf(
        ['5.', 'Results'],
        ['6.', 'Discussion'],
        ['6.', 'Discussion'],
        ['7.', 'Conclusions'],
      ),
    ).toEqual([['5.'], ['6.'], ['6.'], ['7.']]);
  });

  it('leaves numbering that starts over after a back-matter heading', () => {
    expect(
      outlineOf(
        ['1.', 'Introduction'],
        ['2.', 'Methods'],
        [undefined, 'Appendix'],
        ['1.', 'Proofs'],
        ['2.', 'Data'],
        ['2.1.', 'Sources'],
      ),
    ).toEqual([['1.'], ['2.'], ['Appendix'], ['1.'], ['2.', [['2.1.']]]]);
  });

  it('leaves a run the outline never resumes', () => {
    // The body ends after the run.
    expect(outlineOf(['5.', 'Discussion'], ['5.5.', 'Limitations'], ['1.', 'First.'])).toEqual([
      ['5.', [['5.5.']]],
      ['1.'],
    ]);
    // 5.7 skips 5.6, so it does not resume where 5.5 stopped.
    expect(
      outlineOf(['5.', 'Discussion'], ['5.5.', 'Limitations'], ['1.', 'First.'], ['5.7.', 'Next']),
    ).toEqual([['5.', [['5.5.']]], ['1.'], ['5.7.']]);
  });

  it('leaves multi-part numbers that go back, table values written as headings', () => {
    expect(
      outlineOf(
        ['4.', 'Numerical results'],
        ['4.4.', 'Comparison'],
        ['2.5', '7.5 Stable'],
        ['3.5', '8.8 Stable'],
        ['5.', 'Conclusions'],
      ),
    ).toEqual([['4.', [['4.4.']]], ['2.5'], ['3.5'], ['5.']]);
  });
});

describe('floats', () => {
  it('reports figures and tables placed after the body text as floats', () => {
    const document = parse(
      tei(
        div('1', 'Results', 'See Fig. 1.') +
          '<figure xml:id="fig_0"><head>Fig. 1.</head><label>1</label><figDesc>Cells.</figDesc><graphic url="f1.png"/></figure>' +
          '<figure xml:id="tab_0" type="table"><head>Table 1</head><figDesc>Scores.</figDesc>' +
          '<table><row role="label"><cell>Group</cell><cell>Score</cell></row><row><cell cols="2">None</cell></row></table>' +
          '<note>Mean values.</note></figure>' +
          '<figure type="table"><head>Table 2</head></figure>',
      ),
    );
    expect(document.floats).toEqual([
      { caption: 'Cells.', href: 'f1.png', id: 'fig_0', label: 'Fig. 1.', type: 'figure' },
      {
        caption: 'Scores.',
        footnotes: ['Mean values.'],
        headerRows: 1,
        id: 'tab_0',
        label: 'Table 1',
        rows: [
          ['Group', 'Score'],
          ['None', 'None'],
        ],
        type: 'table',
      },
      { headerRows: 0, label: 'Table 2', rows: [], type: 'table', unextractable: 'no-rows' },
    ]);
    expect(document.diagnostics.warnings.map((w) => w.code)).toEqual(['table-unextractable']);
  });

  it('reads a caption Grobid wraps in <div> and <p>, sentences and paragraphs spaced', () => {
    const document = parse(
      tei(
        div('1', 'Results', 'See Fig. 1.') +
          '<figure xml:id="fig_0"><head>Fig. 1</head><figDesc><div><p><s>Fig. 1</s><s>Growth curves.</s></p>' +
          '<p>Means of three runs.</p></div></figDesc></figure>',
      ),
    );
    expect(document.floats).toEqual([
      {
        caption: 'Fig. 1 Growth curves. Means of three runs.',
        id: 'fig_0',
        label: 'Fig. 1',
        type: 'figure',
      },
    ]);
    expect(document.diagnostics.unhandled).toEqual([]);
  });

  it('reports the figures and tables Grobid places after the parts of an annex as floats', () => {
    const document = parse(
      tei(
        div('1', 'Results', 'a'),
        '<div type="annex"><div><p>Table 2. Trends by season.</p></div>' +
          '<figure xml:id="fig_9"><head>Fig. 5</head><figDesc>Time series.</figDesc></figure>' +
          '<figure type="table" xml:id="tab_0"><head>Table 1</head><table><row><cell>a</cell></row></table></figure></div>',
      ),
    );
    expect(document.back.map((s) => [s.kind, s.blocks.length])).toEqual([['appendix', 1]]);
    expect(document.floats.map((b) => [b.type, 'label' in b ? b.label : undefined])).toEqual([
      ['figure', 'Fig. 5'],
      ['table', 'Table 1'],
    ]);
  });
});

describe('back matter and references', () => {
  it('kinds back-matter divs by their type and skips the reference list', () => {
    const document = parse(
      tei(
        div('1', 'Introduction', 'a'),
        '<div type="acknowledgement"><div><head>Acknowledgements</head><p>Thanks.</p></div></div>' +
          '<div type="annex"><div><head n="A">Proofs</head><p>QED.</p></div></div>' +
          '<div type="references"><listBibl/></div>',
      ),
    );
    expect(document.back.map((s) => [s.label, s.title, s.kind])).toEqual([
      [undefined, 'Acknowledgements', 'acknowledgments'],
      ['A', 'Proofs', 'appendix'],
    ]);
  });

  it('kinds a div whose type is named like an object property by its heading', () => {
    const document = parse(
      tei(
        div('1', 'Introduction', 'a'),
        '<div type="constructor"><head>Funding</head><p>A grant.</p></div>' +
          '<div type="__proto__"><head>Notes</head><p>More.</p></div>',
      ),
    );
    expect(document.back.map((s) => [s.title, s.kind])).toEqual([
      ['Funding', 'declarations'],
      ['Notes', 'notes'],
    ]);
  });

  it('keeps a back-matter statement Grobid writes entirely as a heading, not a stray heading at the end', () => {
    const document = parse(
      tei(
        div('1', 'Introduction', 'a'),
        '<div type="funding"><div><head>Funding Open access funding provided by a university.</head></div></div>' +
          '<div type="funding"><div><head>------</head></div></div>' +
          '<div type="annex"><div><p>Open Access This article is licensed under CC BY 4.0.</p></div></div>' +
          '<div type="annex"><div><head>Declarations</head></div></div>',
      ),
    );
    expect(document.back.map((s) => [s.title, s.kind])).toEqual([
      ['Funding Open access funding provided by a university.', 'declarations'],
      [undefined, 'appendix'],
    ]);
  });

  it('gathers untitled parts of one kind under one heading', () => {
    const document = parse(
      tei(
        div('1', 'Introduction', 'a'),
        '<div type="contribution"><div><p>AB wrote it.</p></div></div>' +
          '<div type="contribution"><div><p>CD checked it.</p></div></div>',
      ),
    );
    expect(document.back).toEqual([
      {
        blocks: [
          { text: 'AB wrote it.', type: 'paragraph' },
          { text: 'CD checked it.', type: 'paragraph' },
        ],
        id: 'back1',
        kind: 'declarations',
        sections: [],
      },
    ]);
  });

  it('drops the category Grobid appends to an arXiv identifier', () => {
    const header = HEADER.replace(
      '<idno type="DOI">10.1234/ABC</idno>',
      '<idno type="arXiv">arXiv:1906.00591v1[cs.CL]</idno>',
    );
    expect(parse(tei(div('1', 'A', 'x'), '', header)).metadata.identifiers).toEqual({
      arxiv: '1906.00591v1',
    });
  });

  it("prefers Grobid's raw citation and builds one from the fields otherwise", () => {
    const document = parse(
      tei(
        div('1', 'Introduction', 'a'),
        `<div type="references"><listBibl>
          <biblStruct xml:id="b0"><analytic><title level="a">Raw one</title></analytic>
            <monogr><imprint><date when="2019"/></imprint></monogr>
            <note type="raw_reference">Doe J. Raw one. J Tests 2019;1:2.</note></biblStruct>
          <biblStruct xml:id="b1"><analytic><title level="a">Built one</title>
            <author><persName><forename>Ann</forename><surname>Lee</surname></persName></author>
            <idno type="DOI">10.5555/XYZ</idno></analytic>
            <monogr><title level="j">Journal of Tests</title><imprint><date when="2020-01"/>
              <biblScope unit="volume">7</biblScope><biblScope unit="issue">2</biblScope>
              <biblScope unit="page" from="1" to="10"/></imprint></monogr></biblStruct>
        </listBibl></div>`,
      ),
    );
    expect(document.references).toEqual([
      { id: 'b0', text: 'Doe J. Raw one. J Tests 2019;1:2.', title: 'Raw one', year: '2019' },
      {
        authors: ['Ann Lee'],
        doi: '10.5555/xyz',
        id: 'b1',
        source: 'Journal of Tests',
        text: 'Ann Lee. (2020). Built one. *Journal of Tests* 7(2):1–10. DOI 10.5555/xyz',
        title: 'Built one',
        year: '2020',
      },
    ]);
  });

  it('escapes the fields a built citation is made from', () => {
    const document = parse(
      tei(
        div('1', 'Introduction', 'a'),
        `<div type="references"><listBibl><biblStruct><analytic><title>T</title>
          <author><persName><surname>&lt;img src=a&gt;</surname></persName></author></analytic>
          <monogr><title level="j">J</title><imprint><date when="2020"/>
            <biblScope unit="volume">&lt;b&gt;</biblScope><biblScope unit="issue">*2*</biblScope>
            <biblScope unit="page">&lt;i&gt;</biblScope></imprint></monogr>
          <idno type="DOI">10.1234/&lt;s&gt;</idno></biblStruct></listBibl></div>`,
      ),
    );
    expect(document.references[0]?.text).toBe(
      '\\<img src=a>. (2020). T. *J* \\<b>(\\*2\\*):\\<i>. DOI 10.1234/\\<s>',
    );
  });

  it('takes a resolver or doi: prefix off the header and reference DOIs (#38)', () => {
    const doiOf = (value: string) =>
      parse(
        tei(div('1', 'A', 'x'), '', HEADER.replace('10.1234/ABC', value.replaceAll('&', '&amp;'))),
      ).metadata.identifiers?.doi;
    expect(doiOf('https://doi.org/10.1234/AbC')).toBe('10.1234/abc');
    expect(doiOf('http://dx.doi.org/10.1234/AbC')).toBe('10.1234/abc');
    expect(doiOf('doi:10.1234/AbC')).toBe('10.1234/abc');
    expect(doiOf('DOI: 10.1234/AbC.')).toBe('10.1234/abc');
    expect(doiOf('n/a')).toBeUndefined();

    const references = parse(
      tei(
        div('1', 'Introduction', 'a'),
        `<div type="references"><listBibl>
          <biblStruct xml:id="b0"><analytic><title level="a">A</title>
            <idno type="DOI">doi:10.1234/RefA</idno></analytic></biblStruct>
          <biblStruct xml:id="b1"><analytic><title level="a">B</title>
            <idno type="DOI">https://doi.org/10.1002/(SICI)1097-4636(199907).</idno></analytic>
            <note type="raw_reference">B. https://doi.org/10.1002/(SICI)1097-4636(199907).</note></biblStruct>
        </listBibl></div>`,
      ),
    ).references;
    expect(references.map((reference) => reference.doi)).toEqual([
      '10.1234/refa',
      '10.1002/(sici)1097-4636(199907)',
    ]);
    expect(references.map((reference) => reference.text)).toEqual([
      'A. DOI 10.1234/refa',
      'B. https://doi.org/10.1002/(SICI)1097-4636(199907).',
    ]);
  });
});

describe('document-sized lists', () => {
  /** V8 rejects a call spreading ~120,000 arguments, so each case runs past that on Node. */
  it('joins a heading-less div of 200,000 paragraphs to the section before it', () => {
    const document = parse(
      tei(`${div(undefined, 'Intro', 'a')}<div>${'<p>x</p>'.repeat(200_000)}</div>`),
    );
    expect(document.body).toHaveLength(1);
    expect(document.body[0]?.blocks).toHaveLength(200_001);
  });

  it('joins an untitled back-matter part of 200,000 paragraphs to the part before it', () => {
    const document = parse(
      tei(
        div('1', 'Introduction', 'a'),
        `<div type="acknowledgement"><div><p>a</p></div><div>${'<p>x</p>'.repeat(200_000)}</div></div>`,
      ),
    );
    expect(document.back).toHaveLength(1);
    expect(document.back[0]?.blocks).toHaveLength(200_001);
  });
});

describe('the table budget', () => {
  it('repeats a spanned cell into at most a million characters of copies, and says so', () => {
    const text = 'W '.repeat(5_000);
    const table = `<figure xml:id="tab_0" type="table"><head>Table 1</head><table><row><cell cols="512" rows="512">${text}</cell></row>${'<row><cell/></row>'.repeat(511)}</table></figure>`;
    const document = parse(tei(`${div('1', 'Results', 'a')}${table}`));
    const [block] = document.floats;
    const copied =
      block?.type === 'table' ? block.rows.flat().join('').length - text.trim().length : 0;
    expect(copied).toBeLessThanOrEqual(1_000_000);
    expect(
      document.diagnostics.warnings.filter((warning) => warning.code === 'truncated-input'),
    ).toMatchObject([{ message: expect.stringMatching(/^Table 1 /), where: 'tab_0' }]);
  });
});

describe('source text split across inline elements (#44)', () => {
  it.each(SPLIT_MARKUP)('makes no live markup of %j in any field', (...row) => {
    const split = row.map((piece) => `<seg>${piece}</seg>`).join('');
    const header = HEADER.replace('A study of things', split);
    const document = parse(
      tei(
        `<div><head n="1">Intro</head><p>${split}</p><p>Noted<note place="foot" n="1">${split}</note>.</p>` +
          `<figure xml:id="f1"><head>Figure 1</head><figDesc>${split}</figDesc></figure>` +
          `<figure type="table" xml:id="t1"><head>Table 1</head><table><row><cell>${split}</cell></row></table></figure></div>`,
        `<div type="references"><listBibl><biblStruct><analytic><title>${split}</title></analytic>` +
          '<monogr><title level="j">J</title></monogr></biblStruct></listBibl></div>',
        header,
      ),
    );
    const blocks = [...document.body.flatMap((section) => section.blocks), ...document.floats];
    const fields = [
      document.metadata.title ?? '',
      ...blocks.flatMap((block) =>
        block.type === 'paragraph'
          ? [block.text]
          : block.type === 'figure'
            ? [block.caption ?? '']
            : block.type === 'table'
              ? block.rows.flat()
              : [],
      ),
      ...document.footnotes.map((footnote) => footnote.text),
      ...document.references.map((reference) => reference.text),
      toMarkdown(document),
    ];
    expect(fields.filter((field) => liveMarkup(field).length > 0)).toEqual([]);
  });

  it('escapes a link the fields of a built citation spell together', () => {
    const [reference] = parse(
      tei(
        div('1', 'Introduction', 'a'),
        '<div type="references"><listBibl><biblStruct><analytic><title>T</title></analytic>' +
          '<monogr><title level="j">J</title><imprint><biblScope unit="volume">[click]</biblScope>' +
          '<biblScope unit="issue">javascript:alert(1)</biblScope></imprint></monogr></biblStruct>' +
          '</listBibl></div>',
      ),
    ).references;
    expect(reference?.text).toBe('T. *J* [click\\](javascript:alert(1)).');
  });
});
