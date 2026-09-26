/**
 * @fileoverview JATS front matter: identifiers, title, authors and affiliations, venue,
 * publication date, keywords, license, article type, and every `<abstract>` kept with
 * its kind. Issue numbers refer to cyanheads/pubmed-mcp-server.
 * @module tests/formats/jats/front.test
 */
import { describe, expect, it } from 'vitest';
import { parseJats } from '../../../src/formats/jats/index.js';
import { toMarkdown } from '../../../src/index.js';
import { allBlocks, article, paragraphTexts, parseArticle } from './helpers.js';

const TITLE = '<title-group><article-title>Test Article Title</article-title></title-group>';

/** Metadata of an article whose `<article-meta>` holds `meta` and whose body is one paragraph. */
const metadataOf = (meta: string, journalMeta?: string) =>
  parseArticle({ body: '<p>Body.</p>', meta, ...(journalMeta && { journalMeta }) }).metadata;

/** Abstracts of an article whose `<article-meta>` holds a title and `abstracts`. */
const abstractsOf = (abstracts: string) => parseArticle({ meta: TITLE + abstracts }).abstracts;

describe('article metadata', () => {
  it('reads a minimal article', () => {
    const document = parseArticle({
      attrs: 'article-type="research-article"',
      body: '<sec><title>Introduction</title><p>Body text here.</p></sec>',
      meta:
        '<article-id pub-id-type="pmcid">PMC1234567</article-id>' +
        '<article-id pub-id-type="pmid">12345</article-id>' +
        '<article-id pub-id-type="doi">10.1000/TEST</article-id>' +
        TITLE +
        '<contrib-group><contrib contrib-type="author"><name><surname>Smith</surname>' +
        '<given-names>J</given-names></name></contrib></contrib-group>',
    });
    expect(document.format).toBe('jats');
    expect(document.metadata).toEqual({
      articleType: 'research-article',
      authors: [{ family: 'Smith', given: 'J', name: 'J Smith' }],
      identifiers: { doi: '10.1000/test', pmcid: 'PMC1234567', pmid: '12345' },
      title: 'Test Article Title',
    });
    expect(document.body).toHaveLength(1);
  });

  it('adds the PMC prefix to a bare PMC ID', () => {
    const metadata = metadataOf(`${TITLE}<article-id pub-id-type="pmc-uid">1234567</article-id>`);
    expect(metadata.identifiers?.pmcid).toBe('PMC1234567');
  });

  it('keeps other identifiers under their own type label', () => {
    const metadata = metadataOf(
      `${TITLE}<article-id pub-id-type="publisher-id">e20542</article-id>` +
        '<article-id pub-id-type="arxiv">arXiv:2401.12345v2</article-id>',
    );
    expect(metadata.identifiers).toEqual({
      arxiv: '2401.12345v2',
      other: { 'publisher-id': 'e20542' },
    });
  });

  it('reads rich metadata without fabricating missing fields', () => {
    const document = parseArticle({
      attrs: 'article-type="review-article" xml:lang="en"',
      back: '<ref-list><ref id="R1"><mixed-citation>Reference text.</mixed-citation></ref></ref-list>',
      body: '<p>Opening body.</p>',
      journalMeta:
        '<journal-title-group><journal-title>Journal of Tests</journal-title></journal-title-group>' +
        '<issn>1234-5678</issn><publisher><publisher-name>Test Press</publisher-name></publisher>',
      meta:
        '<article-id pub-id-type="pmcid">PMC7654321</article-id>' +
        '<article-id pub-id-type="pmid">7654321</article-id>' +
        '<title-group><article-title>Structured Article</article-title>' +
        '<subtitle>A <italic>subtitle</italic></subtitle></title-group>' +
        '<contrib-group><contrib contrib-type="author"><name><surname>Smith</surname></name>' +
        '</contrib></contrib-group><aff>Department of Testing</aff>' +
        '<pub-date pub-type="ppub"><year>2020</year></pub-date>' +
        '<pub-date pub-type="epub"><year>2021</year><month>03</month></pub-date>' +
        '<volume>12</volume><issue>2</issue><fpage>10</fpage><lpage>12</lpage>' +
        '<permissions><license xlink:href="https://creativecommons.org/licenses/by/4.0/">' +
        '<license-p>This article is distributed under CC BY 4.0.</license-p></license></permissions>' +
        '<abstract><sec><title>Background</title><p>Why it matters.</p></sec>' +
        '<sec><p>Unlabeled abstract text.</p></sec></abstract>' +
        '<kwd-group><kwd>PubMed</kwd><kwd>Testing</kwd></kwd-group>',
    });
    expect(document.metadata).toEqual({
      affiliations: ['Department of Testing'],
      articleType: 'review-article',
      authors: [{ family: 'Smith', name: 'Smith' }],
      identifiers: { pmcid: 'PMC7654321', pmid: '7654321' },
      keywords: ['PubMed', 'Testing'],
      language: 'en',
      license: {
        text: 'This article is distributed under CC BY 4.0.',
        url: 'https://creativecommons.org/licenses/by/4.0/',
      },
      published: { month: 3, year: 2021 },
      subtitle: 'A *subtitle*',
      title: 'Structured Article',
      venue: {
        issn: '1234-5678',
        issue: '2',
        pages: '10-12',
        publisher: 'Test Press',
        title: 'Journal of Tests',
        volume: '12',
      },
    });
    expect(document.metadata.identifiers).not.toHaveProperty('doi');
    expect(document.body[0]?.blocks).toEqual([{ text: 'Opening body.', type: 'paragraph' }]);
    expect(document.references).toEqual([{ id: 'R1', text: 'Reference text.' }]);
  });

  it('reads the print date when there is no electronic one', () => {
    const metadata = metadataOf(
      `${TITLE}<pub-date pub-type="ppub"><year>2022</year><month>11</month><day>05</day></pub-date>`,
    );
    expect(metadata.published).toEqual({ day: 5, month: 11, year: 2022 });
  });

  it('reads an <elocation-id> for an article with no page range', () => {
    // The Plant Genome 18(1), e20542: an article number only, like about half of PMC.
    const metadata = metadataOf(
      `${TITLE}<volume>18</volume><issue>1</issue><elocation-id>e20542</elocation-id>`,
      '<journal-title-group><journal-title>The Plant Genome</journal-title></journal-title-group>',
    );
    expect(metadata.venue).toEqual({
      elocationId: 'e20542',
      issue: '1',
      title: 'The Plant Genome',
      volume: '18',
    });
  });

  it('carries both a first page and an <elocation-id>', () => {
    const metadata = metadataOf(
      `${TITLE}<volume>19</volume><fpage>e0300123</fpage><elocation-id>e0300123</elocation-id>`,
      '<journal-title-group><journal-title>PLoS One</journal-title></journal-title-group>',
    );
    expect(metadata.venue).toMatchObject({ elocationId: 'e0300123', pages: 'e0300123' });
  });

  it('keeps title markup as inline Markdown and escapes literal delimiters', () => {
    // A title carrying every delimiter the inline escape handles keeps them literal.
    const metadata = metadataOf(
      '<title-group><article-title>Assessment of *risk*, `dose` and _exposure_ in ' +
        '<italic>Mus musculus</italic></article-title></title-group>',
    );
    expect(metadata.title).toBe(
      'Assessment of \\*risk\\*, \\`dose\\` and \\_exposure\\_ in *Mus musculus*',
    );
  });

  it('fails an article with no title, abstract, or body as empty', () => {
    const result = parseJats(article({ meta: '<article-id pub-id-type="pmid">1</article-id>' }));
    expect(result).toMatchObject({ error: { reason: 'empty' }, ok: false });
  });

  it('warns when the title, abstract, or body is missing', () => {
    const { diagnostics } = parseArticle({ meta: '<abstract><p>Only an abstract.</p></abstract>' });
    expect(diagnostics.warnings.map((w) => w.code)).toEqual(['no-title', 'no-body']);
  });
});

describe('authors', () => {
  const authorsOf = (contribGroup: string) =>
    metadataOf(`${TITLE}<contrib-group>${contribGroup}</contrib-group>`).authors ?? [];

  it('reads named authors', () => {
    const authors = authorsOf(
      '<contrib contrib-type="author"><name><surname>Smith</surname>' +
        '<given-names>John</given-names></name></contrib>' +
        '<contrib contrib-type="author"><name><surname>Doe</surname>' +
        '<given-names>Jane</given-names></name></contrib>',
    );
    expect(authors).toEqual([
      { family: 'Smith', given: 'John', name: 'John Smith' },
      { family: 'Doe', given: 'Jane', name: 'Jane Doe' },
    ]);
  });

  it('reads a collective author', () => {
    const authors = authorsOf(
      '<contrib contrib-type="author"><collab>COVID-19 Study Group</collab></contrib>',
    );
    expect(authors).toEqual([{ collective: 'COVID-19 Study Group', name: 'COVID-19 Study Group' }]);
  });

  it('skips contributors who are not authors', () => {
    const authors = authorsOf(
      '<contrib contrib-type="editor"><name><surname>Editor</surname>' +
        '<given-names>A</given-names></name></contrib>' +
        '<contrib contrib-type="author"><name><surname>Author</surname>' +
        '<given-names>B</given-names></name></contrib>',
    );
    expect(authors.map((a) => a.family)).toEqual(['Author']);
  });

  it('accepts an untyped contributor and skips a blank collective name', () => {
    const authors = authorsOf(
      '<contrib contrib-type="author"><collab>   </collab></contrib>' +
        '<contrib><name><surname>Untyped</surname></name></contrib>',
    );
    expect(authors).toEqual([{ family: 'Untyped', name: 'Untyped' }]);
  });

  it('resolves ORCID, email, correspondence, and affiliations', () => {
    const metadata = metadataOf(
      `${TITLE}<contrib-group><contrib contrib-type="author" corresp="yes">` +
        '<contrib-id contrib-id-type="orcid">https://orcid.org/0000-0002-1825-0097</contrib-id>' +
        '<name><surname>Carberry</surname><given-names>Josiah</given-names></name>' +
        '<email>josiah@example.edu</email><xref ref-type="aff" rid="aff2 aff1"/></contrib>' +
        '<contrib contrib-type="author"><name><surname>Ng</surname></name>' +
        '<aff>Inline Institute</aff></contrib></contrib-group>' +
        '<aff id="aff1"><label>1</label>Brown University</aff><aff id="aff2">MIT</aff>',
    );
    expect(metadata.affiliations).toEqual(['Inline Institute', 'Brown University', 'MIT']);
    expect(metadata.authors).toEqual([
      {
        affiliations: [1, 2],
        corresponding: true,
        email: 'josiah@example.edu',
        family: 'Carberry',
        given: 'Josiah',
        name: 'Josiah Carberry',
        orcid: '0000-0002-1825-0097',
      },
      { affiliations: [0], family: 'Ng', name: 'Ng' },
    ]);
  });
});

describe('abstracts', () => {
  it('keeps mixed inline content in document order (#19)', () => {
    const abstracts = abstractsOf(
      '<abstract><p>Candidates include <italic>NF1</italic> and <italic>MED12</italic>, as ' +
        'well as <italic>NF2</italic>, <italic>CUL3</italic>.</p></abstract>',
    );
    expect(abstracts).toEqual([
      {
        kind: 'main',
        sections: [
          {
            blocks: [
              {
                text: 'Candidates include *NF1* and *MED12*, as well as *NF2*, *CUL3*.',
                type: 'paragraph',
              },
            ],
            id: 'abstract-1-1',
            kind: 'body',
            sections: [],
          },
        ],
      },
    ]);
  });

  it('keeps a structured abstract as titled sections in order (#134)', () => {
    const document = parseArticle({
      meta:
        TITLE +
        '<abstract><sec><title>Background</title><p>First paragraph.</p>' +
        '<p>Second paragraph.</p></sec><sec><p>Untitled section prose.</p></sec></abstract>',
    });
    const [main] = document.abstracts;
    expect(main?.sections.map((s) => ({ blocks: s.blocks, title: s.title }))).toEqual([
      {
        blocks: [
          { text: 'First paragraph.', type: 'paragraph' },
          { text: 'Second paragraph.', type: 'paragraph' },
        ],
        title: 'Background',
      },
      { blocks: [{ text: 'Untitled section prose.', type: 'paragraph' }], title: undefined },
    ]);
    expect(toMarkdown(document)).toContain(
      '## Abstract\n\n### Background\n\nFirst paragraph.\n\nSecond paragraph.\n\nUntitled section prose.',
    );
  });

  it('reads abstract text that sits directly under <abstract>', () => {
    const [main] = abstractsOf('<abstract>Plain abstract text.</abstract>');
    expect(main?.sections[0]?.blocks).toEqual([
      { text: 'Plain abstract text.', type: 'paragraph' },
    ]);
  });

  it('keeps every abstract with its kind, the untyped one as main and first (#134)', () => {
    // PMC13131449 and PMC13539245 deposit `graphical`, `author-highlights`, then the
    // untyped abstract; reading the first one returned the graphical abstract's title.
    const document = parseArticle({
      meta:
        TITLE +
        '<abstract abstract-type="graphical"><title>Graphical abstract</title>' +
        '<fig id="ga"><graphic xlink:href="ga.jpg"/></fig></abstract>' +
        '<abstract abstract-type="author-highlights"><p>Highlight one.</p></abstract>' +
        '<abstract><p>The article’s own abstract.</p></abstract>',
    });
    expect(document.abstracts.map((a) => [a.kind, a.title])).toEqual([
      ['main', undefined],
      ['graphical', 'Graphical abstract'],
      ['other', undefined],
    ]);
    expect(document.abstracts[0]?.sections[0]?.blocks).toEqual([
      { text: 'The article’s own abstract.', type: 'paragraph' },
    ]);
    expect(document.abstracts[1]?.sections[0]?.blocks).toEqual([
      { href: 'ga.jpg', id: 'ga', type: 'figure' },
    ]);
    const main = toMarkdown(document, { abstracts: 'main' });
    expect(main).toContain('## Abstract\n\nThe article’s own abstract.');
    expect(main).not.toContain('Highlight one.');
  });

  it('keeps typed abstracts in source order when none is untyped (#134)', () => {
    const document = parseArticle({
      meta:
        TITLE +
        '<abstract abstract-type="executive-summary"><p>Executive summary prose.</p></abstract>' +
        '<abstract abstract-type="short"><p>Short form.</p></abstract>' +
        '<abstract abstract-type="synopsis"><title>Synopsis</title><p>Lay prose.</p></abstract>',
    });
    expect(document.abstracts.map((a) => a.kind)).toEqual([
      'plain-language',
      'teaser',
      'plain-language',
    ]);
    expect(document.diagnostics.warnings.map((w) => w.code)).not.toContain('no-abstract');
    expect(toMarkdown(document)).toContain('Executive summary prose.');
    const main = toMarkdown(document, { abstracts: 'main' });
    expect(main).toContain('Executive summary prose.');
    expect(main).not.toContain('Short form.');
  });

  it('reads a translated abstract with its language', () => {
    const [, translated] = abstractsOf(
      '<abstract><p>Main.</p></abstract>' +
        '<trans-abstract xml:lang="es"><title>Resumen</title><p>Principal.</p></trans-abstract>',
    );
    expect(translated).toMatchObject({ kind: 'translated', language: 'es', title: 'Resumen' });
  });

  it('lifts a figure out of an abstract paragraph and keeps a list as a list (#134)', () => {
    // PMC13316352's graphical abstract reached the output through <p><fig><caption>,
    // so the abstract arrived as a 453-character figure caption.
    const document = parseArticle({
      meta:
        TITLE +
        '<abstract><p>Attachment is promoted by stress fibers.<fig id="fx1"><label>Fig. 7</label>' +
        '<caption><p>STK11 facilitates influenza A virus attachment.</p></caption></fig></p>' +
        '<list list-type="bullet"><list-item><p>Sialic acid clusters stay disordered.</p>' +
        '</list-item></list></abstract>',
    });
    expect(document.abstracts[0]?.sections[0]?.blocks).toEqual([
      { text: 'Attachment is promoted by stress fibers.', type: 'paragraph' },
      {
        caption: 'STK11 facilitates influenza A virus attachment.',
        id: 'fx1',
        label: 'Fig. 7',
        type: 'figure',
      },
      {
        items: [[{ text: 'Sialic acid clusters stay disordered.', type: 'paragraph' }]],
        ordered: false,
        type: 'list',
      },
    ]);
    for (const text of paragraphTexts(document)) expect(text).not.toContain('STK11 facilitates');
    expect(allBlocks(document).filter((b) => b.type === 'figure')).toHaveLength(1);
  });
});
