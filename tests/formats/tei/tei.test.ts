/**
 * @fileoverview `parseTei` on synthetic Grobid TEI: the result contract, both document
 * shapes, front matter from the header, the section tree rebuilt from heading numbers,
 * floats, back matter by type, and references from `<biblStruct>`.
 * @module tests/formats/tei/tei.test
 */
import { describe, expect, it } from 'vitest';
import { parseTei } from '../../../src/formats/tei/index.js';
import type { ScholarlyDocument } from '../../../src/model/document.js';

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
            id: 'abstract-1',
            kind: 'body',
            sections: [],
          },
        ],
      },
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
      ['Discussion'],
      ['Limitations'],
    ]);
  });

  it('drops a heading nothing follows', () => {
    const document = parse(
      tei(`${div('1', 'Introduction', 'a')}<div><head n="2">Empty</head></div>`),
    );
    expect(document.body.map((s) => s.title)).toEqual(['Introduction']);
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
});
