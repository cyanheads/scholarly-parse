/**
 * @fileoverview JATS front matter: identifiers, title, authors and affiliations, venue,
 * publication date, keywords, license, article type, and every `<abstract>` kept with
 * its kind. Issue numbers refer to cyanheads/pubmed-mcp-server.
 * @module tests/formats/jats/front.test
 */
import { describe, expect, it } from 'vitest';
import { parseJats } from '../../../src/formats/jats/index.js';
import { toMarkdown, toSections } from '../../../src/index.js';
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

  it('reads related works: a sentence, a structured entry, and a bare link', () => {
    const { related } = metadataOf(
      TITLE +
        '<related-article related-article-type="corrected-article">This corrects the article ' +
        '"<ext-link ext-link-type="pmcid" xlink:href="PMC4449160">Seasonal Effects</ext-link>" ' +
        'in volume 10.</related-article>' +
        '<related-article related-article-type="retraction-forward" ext-link-type="pmc" ' +
        'xlink:href="PMC10513824"><article-title>Retracted: A Study</article-title><volume>2023' +
        '</volume><pub-id pub-id-type="doi">10.1155/2023/9862810</pub-id>' +
        '<pub-id pub-id-type="pmid">37744561</pub-id></related-article>' +
        '<related-article related-article-type="commentary-article" ext-link-type="uri" ' +
        'xlink:href="https://example.org/topic/1"/>',
    );
    expect(related).toEqual([
      {
        pmcid: 'PMC4449160',
        relation: 'corrected-article',
        text: 'This corrects the article "Seasonal Effects" in volume 10.',
      },
      {
        doi: '10.1155/2023/9862810',
        pmcid: 'PMC10513824',
        pmid: '37744561',
        relation: 'retraction-forward',
        text: 'Retracted: A Study',
      },
      { relation: 'commentary-article', url: 'https://example.org/topic/1' },
    ]);
  });

  it('takes a resolver or doi: prefix off the article and related-work DOIs (#38)', () => {
    const doiOf = (value: string) =>
      metadataOf(`<article-id pub-id-type="doi">${value}</article-id>${TITLE}`).identifiers?.doi;
    expect(doiOf('https://doi.org/10.1234/AbC')).toBe('10.1234/abc');
    expect(doiOf('http://dx.doi.org/10.1234/AbC')).toBe('10.1234/abc');
    expect(doiOf('doi:10.1234/AbC')).toBe('10.1234/abc');
    expect(doiOf('DOI: 10.1234/AbC')).toBe('10.1234/abc');
    expect(doiOf('https://doi.org/10.1234/x.')).toBe('10.1234/x');
    expect(doiOf('10.1002/(SICI)1097-4636(199907)')).toBe('10.1002/(sici)1097-4636(199907)');
    expect(doiOf('n/a')).toBeUndefined();

    const { related } = metadataOf(
      TITLE +
        '<related-article related-article-type="corrected-article" ext-link-type="doi" ' +
        'xlink:href="doi:10.1234/Href"/>' +
        '<related-article related-article-type="retraction-forward">' +
        '<pub-id pub-id-type="doi">https://doi.org/10.1234/PubId.</pub-id></related-article>' +
        '<related-article related-article-type="commentary-article" ext-link-type="doi" ' +
        'xlink:href="http://dx.doi.org/10.1234/Dx"/>',
    );
    expect(related?.map((work) => work.doi)).toEqual([
      '10.1234/href',
      '10.1234/pubid',
      '10.1234/dx',
    ]);
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

  it('reads an abstract or identifier type named like an object property as data', () => {
    const types = ['__proto__', 'constructor', 'toString'];
    const document = parseArticle({
      meta:
        types.map((type) => `<article-id pub-id-type="${type}">${type}-id</article-id>`).join('') +
        '<title-group><article-title>T</article-title></title-group>' +
        '<abstract abstract-type="constructor"><p>Abs.</p></abstract>',
    });
    expect(document.abstracts[0]?.kind).toBe('other');
    const other = document.metadata.identifiers?.other ?? {};
    expect(Object.entries(other)).toEqual(types.map((type) => [type, `${type}-id`]));
    expect(Object.getPrototypeOf(other)).toBe(Object.prototype);
  });

  it('issues a loose abstract part its ID beside the body sections (#24)', () => {
    const document = parseArticle({
      body: '<sec id="abstract-1-1"><title>Intro</title><p>Body text.</p></sec>',
      meta: `${TITLE}<abstract><p>We did this.</p></abstract>`,
    });
    expect(document.abstracts[0]?.sections.map((section) => section.id)).toEqual(['abstract-1-1']);
    expect(document.body.map((section) => section.id)).toEqual(['abstract-1-1-2']);
    expect(toMarkdown(document, { sections: ['abstract-1-1'] })).toBe('We did this.\n');
  });

  it.each([
    ['a body section named abstract-1', '<abstract><p>A.</p></abstract>', '<sec id="abstract-1">'],
    ['a body section named floats', '', '<sec id="floats">'],
    [
      'a body section named like a loose part',
      '<abstract><p>A.</p></abstract>',
      '<sec id="abstract-1-1">',
    ],
    [
      'an abstract section named like the next abstract',
      '<abstract><sec id="abstract-2"><title>Aim</title><p>A.</p></sec></abstract>' +
        '<abstract abstract-type="teaser"><p>T.</p></abstract>',
      '<sec>',
    ],
  ])('gives every toSections entry its own ID: %s (#24)', (_, abstracts, sec) => {
    const document = parseArticle({
      body: `${sec}<title>Intro</title><p>Body text.</p></sec>`,
      floats: '<fig id="f1"><caption><p>Floating.</p></caption></fig>',
      meta: TITLE + abstracts,
    });
    const ids = toSections(document).map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of toSections(document)) {
      expect(toMarkdown(document, { sections: [entry.id] }).trim()).toBe(entry.markdown);
    }
  });
});

describe('arXiv article IDs (#65)', () => {
  const arxivDocument = (...values: string[]) =>
    parseArticle({
      body: '<p>Body.</p>',
      meta: TITLE + values.map((v) => `<article-id pub-id-type="arxiv">${v}</article-id>`).join(''),
    });

  it('keeps an arXiv ID already in the model form, and drops an arXiv label', () => {
    expect(arxivDocument('2305.05320').metadata.identifiers).toEqual({ arxiv: '2305.05320' });
    expect(arxivDocument('ARXIV:2401.12345v2').metadata.identifiers).toEqual({
      arxiv: '2401.12345v2',
    });
  });

  it('reads an old-style ID without its subject class, and the ID an arxiv.org link names', () => {
    const document = arxivDocument('arXiv:math.GT/0309136v1');
    expect(document.metadata.identifiers).toEqual({ arxiv: 'math/0309136v1' });
    expect(toMarkdown(document)).toContain('arXiv: math/0309136v1');
    expect(arxivDocument('https://arxiv.org/abs/2105.00001v3').metadata.identifiers).toEqual({
      arxiv: '2105.00001v3',
    });
  });

  it('reads no arXiv ID from a value that is not one, and takes a later one that is', () => {
    const none = arxivDocument('pending', 'hep-th/0805123', '2105.00001v0');
    expect(none.metadata.identifiers).toBeUndefined();
    expect(toMarkdown(none)).not.toContain('arXiv:');
    expect(arxivDocument('n/a', 'hep-th/9711200').metadata.identifiers).toEqual({
      arxiv: 'hep-th/9711200',
    });
  });
});

describe('PMCID, PMID, and ORCID values (#59)', () => {
  const idsOf = (articleIds: string) => metadataOf(TITLE + articleIds).identifiers;
  const articleId = (type: string, value: string) =>
    `<article-id pub-id-type="${type}">${value}</article-id>`;
  const orcidOf = (contribId: string) =>
    metadataOf(
      `${TITLE}<contrib-group><contrib contrib-type="author">${contribId}` +
        '<name><surname>Carberry</surname></name></contrib></contrib-group>',
    ).authors?.[0]?.orcid;
  const relatedOf = (relatedArticle: string) => metadataOf(TITLE + relatedArticle).related?.[0];

  it('keeps PMC IDs, PMIDs, and ORCID iDs already in canonical form', () => {
    expect(idsOf(articleId('pmcid', 'PMC999') + articleId('pmid', '21491125'))).toEqual({
      pmcid: 'PMC999',
      pmid: '21491125',
    });
    expect(idsOf(articleId('pmc', '999'))).toEqual({ pmcid: 'PMC999' });
    expect(orcidOf('<contrib-id contrib-id-type="orcid">0000-0002-1694-233X</contrib-id>')).toBe(
      '0000-0002-1694-233X',
    );
    expect(relatedOf('<related-article ext-link-type="pmc" xlink:href="pmc777"/>')?.pmcid).toBe(
      'PMC777',
    );
  });

  it('reads an article PMC ID or PMID in any case, without a label', () => {
    expect(idsOf(articleId('pmcid', 'pmc999'))).toEqual({ pmcid: 'PMC999' });
    expect(idsOf(articleId('pmid', 'PMID: 21491125'))).toEqual({ pmid: '21491125' });
    expect(idsOf(articleId('pmcid', 'PMCID: PMC999'))).toEqual({ pmcid: 'PMC999' });
  });

  it('reads an article-id type in any case, filing none of them under other', () => {
    expect(
      idsOf(
        articleId('PMID', '21491125') +
          articleId('PMCID', 'PMC999') +
          articleId('DOI', '10.1234/AB'),
      ),
    ).toEqual({ doi: '10.1234/ab', pmcid: 'PMC999', pmid: '21491125' });
  });

  it('reads no identifier from a value that is not one', () => {
    expect(
      idsOf(articleId('pmcid', 'pending') + articleId('pmid', 'n/a') + articleId('pmc', 'PMC')),
    ).toBeUndefined();
    expect(idsOf(articleId('pmid', '2149A125'))).toBeUndefined();
  });

  it('reads related-work PMC IDs and PMIDs from links to PMC and PubMed', () => {
    expect(
      relatedOf(
        '<related-article related-article-type="corrected-article" ext-link-type="pmcid" ' +
          'xlink:href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC777/"/>',
      ),
    ).toEqual({ pmcid: 'PMC777', relation: 'corrected-article' });
    expect(
      relatedOf(
        '<related-article related-article-type="commentary"><ext-link ext-link-type="pubmed" ' +
          'xlink:href="https://pubmed.ncbi.nlm.nih.gov/21491125/">A comment</ext-link></related-article>',
      ),
    ).toEqual({ pmid: '21491125', relation: 'commentary' });
    expect(
      relatedOf(
        '<related-article related-article-type="commentary" ext-link-type="pubmed" ' +
          'xlink:href="&#34;Carrami EM&#34;[Author]">A comment</related-article>',
      ),
    ).toEqual({ relation: 'commentary', text: 'A comment' });
  });

  it('renders the normalized identifiers in the Markdown', () => {
    const document = parseArticle({
      body: '<p>Body.</p>',
      meta:
        TITLE +
        articleId('PMID', 'PMID: 21491125') +
        articleId('pmcid', 'pmc999') +
        '<related-article related-article-type="corrected-article" ext-link-type="pmcid" ' +
        'xlink:href="https://pmc.ncbi.nlm.nih.gov/articles/PMC777/">A correction.</related-article>',
    });
    const markdown = toMarkdown(document);
    expect(markdown).toContain('PMID: 21491125 · PMCID: PMC999');
    expect(markdown).toContain('Related (corrected-article): A correction. · PMCID: PMC777');
    expect(markdown).not.toContain('PMChttps');
  });

  it('reads a contributor ORCID iD whatever the case of its type or check character', () => {
    expect(orcidOf('<contrib-id contrib-id-type="orcid">0000-0002-1694-233x</contrib-id>')).toBe(
      '0000-0002-1694-233X',
    );
    expect(
      orcidOf(
        '<contrib-id contrib-id-type="ORCID">https://orcid.org/0000-0002-1694-233X</contrib-id>',
      ),
    ).toBe('0000-0002-1694-233X');
    expect(
      orcidOf('<contrib-id contrib-id-type="orcid">0000-0002-1694-233</contrib-id>'),
    ).toBeUndefined();
  });
});
