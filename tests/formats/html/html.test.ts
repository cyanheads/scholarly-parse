/**
 * @fileoverview `parseHtml` on synthetic publisher pages: interstitial detection,
 * front matter from meta tags, the section outline, page furniture, figures and tables
 * read whole, citation markers, and reference lists.
 * @module tests/formats/html/html.test
 */
import { describe, expect, it } from 'vitest';
import { parseHtml } from '../../../src/formats/html/index.js';
import type { Block, ScholarlyDocument, Section } from '../../../src/model/document.js';

const META = [
  '<meta name="citation_title" content="A study of things">',
  '<meta name="citation_author" content="Doe, Jane">',
  '<meta name="citation_author_institution" content="University of Somewhere">',
  '<meta name="citation_author_orcid" content="https://orcid.org/0000-0002-1825-0097">',
  '<meta name="citation_author" content="Richard Roe">',
  '<meta name="citation_doi" content="doi:10.1234/ABC.5">',
  '<meta name="citation_journal_title" content="Journal of Tests">',
  '<meta name="citation_volume" content="7">',
  '<meta name="citation_firstpage" content="10">',
  '<meta name="citation_lastpage" content="20">',
  '<meta name="citation_publication_date" content="2024/05/12">',
].join('');

function page(main: string, extra = ''): string {
  return `<!doctype html><html lang="en"><head><title>A study of things</title>${META}${extra}</head><body>
    <header><nav><a href="/">Home</a></nav></header>
    <main><article>
      <h1>A study of things</h1>
      <p class="authors">Jane Doe, Richard Roe</p>
      ${main}
    </article></main>
    <footer>Copyright notice</footer></body></html>`;
}

const PROSE = 'Enough prose to make this region the article. '.repeat(8);

async function parse(html: string): Promise<ScholarlyDocument> {
  const result = await parseHtml(html, { baseUrl: 'https://example.org/articles/1' });
  if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
  return result.document;
}

function blocks(sections: Section[]): Block[] {
  return sections.flatMap((section) => [...section.blocks, ...blocks(section.sections)]);
}

describe('interstitials', () => {
  it('reports a Cloudflare challenge as blocked', async () => {
    const result = await parseHtml(
      '<html><head><title>Just a moment...</title></head><body><script src="https://challenges.cloudflare.com/x.js"></script></body></html>',
    );
    expect(result).toMatchObject({ error: { reason: 'blocked' }, ok: false });
  });

  it('reports a CDN access-denied page as blocked', async () => {
    const result = await parseHtml(
      '<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY><H1>Access Denied</H1>Reference #18.1 https://errors.edgesuite.net/18.1</BODY></HTML>',
    );
    expect(result).toMatchObject({
      error: { message: expect.stringContaining('access-denied'), reason: 'blocked' },
      ok: false,
    });
  });

  it('reports a meta-refresh redirect stub with its target', async () => {
    const result = await parseHtml(
      '<html><head><meta http-equiv="refresh" content="2; url=\'/retrieve/article?id=1&amp;key=2\'"><title>Redirecting</title></head><body></body></html>',
    );
    expect(result).toMatchObject({
      error: {
        message: expect.stringContaining('/retrieve/article?id=1&key=2'),
        reason: 'blocked',
      },
      ok: false,
    });
  });

  it('never treats a page with citation metadata as an interstitial', async () => {
    const document = await parse(
      page(
        `<h2>Introduction</h2><p>${PROSE}</p><script src="https://challenges.cloudflare.com/turnstile.js"></script>`,
      ),
    );
    expect(document.body[0]?.title).toBe('Introduction');
  });
});

describe('front matter', () => {
  it('reads authors, affiliations, identifiers, venue, and date from citation tags', async () => {
    const document = await parse(page(`<h2>Introduction</h2><p>${PROSE}</p>`));
    expect(document.metadata).toMatchObject({
      affiliations: ['University of Somewhere'],
      authors: [
        {
          affiliations: [0],
          family: 'Doe',
          given: 'Jane',
          name: 'Jane Doe',
          orcid: '0000-0002-1825-0097',
        },
        { name: 'Richard Roe' },
      ],
      identifiers: { doi: '10.1234/abc.5' },
      language: 'en',
      published: { day: 12, month: 5, year: 2024 },
      title: 'A study of things',
      venue: { pages: '10–20', title: 'Journal of Tests', volume: '7' },
    });
    expect(document.format).toBe('html');
    expect(document.diagnostics.quality).toBe('partial');
  });

  it('keeps a copyright line out of the license', async () => {
    const document = await parse(
      page(
        `<h2>Introduction</h2><p>${PROSE}</p>`,
        '<meta name="dc.rights" content="© 2024 The Authors">',
      ),
    );
    expect(document.metadata.license).toBeUndefined();
  });
});

describe('outline', () => {
  it('drops the byline, scopes the abstract to its container, and nests headings', async () => {
    const document = await parse(
      page(`
        <div class="abstract"><a id="abstract0"></a><h2>Abstract</h2><p>The abstract.</p></div>
        <div class="article-info"><p>Citation: Doe J (2024).</p></div>
        <h2>1. Introduction</h2><p>${PROSE}</p>
        <h3>1.1 Background</h3><p>Earlier work.</p>
        <h2>Methods</h2><p>How.</p>`),
    );
    expect(document.abstracts).toEqual([
      {
        kind: 'main',
        sections: [
          {
            blocks: [{ text: 'The abstract.', type: 'paragraph' }],
            id: 'abstract',
            kind: 'body',
            sections: [],
          },
        ],
      },
    ]);
    expect(
      document.body.map((s) => [s.label, s.title, s.sections.map((sub) => [sub.label, sub.title])]),
    ).toEqual([
      ['1', 'Introduction', [['1.1', 'Background']]],
      [undefined, 'Methods', []],
    ]);
    expect(JSON.stringify(document)).not.toContain('Jane Doe, Richard Roe');
  });

  it('classifies back matter and keeps only back matter after the reference list', async () => {
    const document = await parse(
      page(`
        <h2>Abstract</h2><p>Summary.</p>
        <h2>Introduction</h2><p>${PROSE}</p>
        <h2>Acknowledgements</h2><p>Thanks.</p>
        <h2>References</h2><ol><li>Roe R. A cited work. J Tests. 2020.</li></ol>
        <h2>Ethics declarations</h2><p>None.</p>
        <h2>Rights and permissions</h2><p>Open access.</p>
        <h2>Comments</h2><p>Nice paper!</p>`),
    );
    expect(document.body.map((s) => s.title)).toEqual(['Introduction']);
    expect(document.back.map((s) => [s.title, s.kind])).toEqual([
      ['Acknowledgements', 'acknowledgments'],
      ['Ethics declarations', 'declarations'],
    ]);
  });

  it('skips page furniture inside the article region', async () => {
    const document = await parse(
      page(`
        <h2>Introduction</h2><p>${PROSE}</p>
        <div class="c-article-metrics-bar"><p>1234 accesses</p></div>
        <section class="related-articles"><h3>Similar articles</h3><p>Another paper.</p></section>
        <div class="share-buttons"><button>Share</button></div>`),
    );
    expect(JSON.stringify(document)).not.toMatch(/accesses|Another paper|Share/);
  });
});

describe('inline text', () => {
  it('reads in-page citation links as bracketed markers, hiding screen-reader text', async () => {
    const document = await parse(
      page(`<h2>Introduction</h2><p>${PROSE}Known<sup><a href="/articles/1#ref-CR1"><span class="sr-only">Reference Roe</span>1</a></sup> and
        shown<sup><a href="#ref-CR2">2</a>,<a href="#ref-CR3">3</a></sup>. Water is H<sub>2</sub>O.</p>
        <ol class="refs"><li id="ref-CR1">One cited work, long enough to count.</li><li id="ref-CR2">Two cited work, long enough.</li><li id="ref-CR3">Three cited work, long enough.</li></ol>`),
    );
    const [paragraph] = document.body[0]?.blocks ?? [];
    expect(paragraph).toMatchObject({
      text: expect.stringContaining('Known[1] and shown[2,3]. Water is H_2O.'),
    });
  });

  it('turns MathJax source into math', async () => {
    const document = await parse(
      page(`<h2>Methods</h2><p>${PROSE}The loss <span class="mathjax-tex">\\(L = x^2\\)</span> is small.</p>
        <div class="c-article-equation"><div class="c-article-equation__content"><span class="mathjax-tex">$$E = mc^2$$</span></div><div class="c-article-equation__number">(1)</div></div>`),
    );
    const found = blocks(document.body);
    expect(found[0]).toMatchObject({
      text: expect.stringContaining('The loss $L = x^2$ is small.'),
    });
    expect(found[1]).toEqual({ label: '1', tex: 'E = mc^2', type: 'formula' });
  });
});

describe('figures and tables', () => {
  it('reads a figure container whole: label, bold title, description, image, no link lists', async () => {
    const document = await parse(
      page(`<h2>Results</h2><p>${PROSE}</p>
        <div class="c-article-section__figure" id="figure-1"><figure>
          <figcaption><b>Fig. 1: Overview of the method.</b></figcaption>
          <picture><img src="//cdn.example.org/fig1.png" alt="Fig. 1: Overview of the method."></picture>
          <div class="figure-link"><a href="/articles/1/figures/1">Full size image</a></div>
          <div class="c-article-section__figure-description"><p>Panels show things.</p></div>
        </figure></div>`),
    );
    expect(blocks(document.body)[1]).toEqual({
      caption: '**Overview of the method.** Panels show things.',
      href: 'https://cdn.example.org/fig1.png',
      id: 'figure-1',
      label: 'Fig. 1',
      type: 'figure',
    });
  });

  it('takes a table caption from its description and notes from its foot, wherever they sit', async () => {
    const document = await parse(
      page(`<h2>Results</h2><p>${PROSE}</p>
        <div class="ArticleTable" id="T1"><div class="ArticleTable__header"><p class="ArticleTable__title">Table 1</p></div>
          <div class="ArticleTable__content"><table><thead><tr><th>Dose</th><th>Effect</th></tr></thead>
          <tbody><tr><td>1</td><td>None</td></tr></tbody></table></div>
          <div class="ArticleTable__description"><p>Doses and effects.</p></div>
          <div class="ArticleTable__foot"><p>*Measured at day 3.</p></div></div>`),
    );
    expect(blocks(document.body)[1]).toEqual({
      caption: 'Doses and effects.',
      footnotes: ['\\*Measured at day 3.'],
      headerRows: 1,
      id: 'T1',
      label: 'Table 1',
      rows: [
        ['Dose', 'Effect'],
        ['1', 'None'],
      ],
      type: 'table',
    });
  });

  it('treats an in-text link to a table as text, not a table', async () => {
    const document = await parse(
      page(`<h2>Results</h2><p>${PROSE}As <a class="xref table" href="#T1">Table 1</a> shows.</p>`),
    );
    expect(blocks(document.body).map((b) => b.type)).toEqual(['paragraph']);
  });
});

describe('references', () => {
  it('keeps each entry’s label and text, strips lookup links, and mines them for identifiers', async () => {
    const document = await parse(
      page(`<h2>Introduction</h2><p>${PROSE}</p><h2>References</h2><ol class="references">
        <li id="ref1"><span class="label">1.</span><cite>Roe R. A cited work. J Tests. 2020;1:2.</cite>
          [<a href="https://doi.org/10.1000%2Fxyz">DOI</a>] [<a href="https://pubmed.ncbi.nlm.nih.gov/12345678/">PubMed</a>] [<a href="https://scholar.google.com/x">Google Scholar</a>]</li>
        <li id="ref2"><span class="order">2. </span>Doe J. Another work. 2021. <ul class="reflinks"><li><a href="#">View Article</a></li><li><a href="https://scholar.google.com/y">Google Scholar</a></li></ul></li>
      </ol>`),
    );
    expect(document.references).toEqual([
      {
        doi: '10.1000/xyz',
        id: 'ref1',
        label: '1',
        pmid: '12345678',
        text: 'Roe R. A cited work. J Tests. 2020;1:2.',
      },
      { id: 'ref2', label: '2', text: 'Doe J. Another work. 2021.' },
    ]);
  });

  it('falls back to citation_reference tags when the page has no reference list', async () => {
    const document = await parse(
      page(
        `<h2>Introduction</h2><p>${PROSE}</p>`,
        '<meta name="citation_reference" content="citation_title=A cited work;citation_author=R Roe;citation_journal_title=J Tests;citation_year=2020;citation_doi=10.1000/xyz">',
      ),
    );
    expect(document.references).toEqual([
      {
        authors: ['R Roe'],
        doi: '10.1000/xyz',
        label: '1',
        source: 'J Tests',
        text: 'R Roe. A cited work. *J Tests*. 2020 doi:10.1000/xyz',
        title: 'A cited work',
        year: '2020',
      },
    ]);
  });
});
