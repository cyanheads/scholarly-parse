/**
 * @fileoverview `parseHtml` on synthetic publisher pages: interstitial detection,
 * front matter from meta tags, the section outline and the run after the title, landing
 * pages, page furniture, math with and without TeX, text split across elements, figures
 * and tables read whole, citation markers, reference lists, and the time and depth
 * bounds on hostile markup.
 * @module tests/formats/html/html.test
 */
import { describe, expect, it } from 'vitest';
import { parseHtml } from '../../../src/formats/html/index.js';
import { interstitialReason } from '../../../src/html/interstitial.js';
import type { Block, ScholarlyDocument, Section } from '../../../src/model/document.js';
import { normalizeDoi } from '../../../src/model/doi.js';
import { toMarkdown, toSections, toText } from '../../../src/render/index.js';
import { expectLinear } from '../../linear.js';

/** `text` with every character a regular expression gives meaning to escaped. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

  it('reports a Cloudflare challenge known only by its text as blocked', async () => {
    const result = await parseHtml(
      '<html><head><title>example.org</title></head><body><h1>example.org</h1><p>Checking if the site connection is secure</p><noscript>Enable JavaScript and cookies to continue</noscript></body></html>',
    );
    expect(result).toMatchObject({
      error: { message: expect.stringContaining('Cloudflare challenge'), reason: 'blocked' },
      ok: false,
    });
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

  it('reports a Radware captcha as blocked', async () => {
    const result = await parseHtml(
      '<head><title>Radware Bot Manager Captcha</title><script>(function(){})(window,document,"script","https://cdn.perfdrive.com/aperture/aperture.js")</script></head><body><div id="captcha"></div></body>',
    );
    expect(result).toMatchObject({
      error: { message: expect.stringContaining('Radware'), reason: 'blocked' },
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

  it.each([
    ['A <em>special</em> title', 'A *special* title'],
    ['Energy <span class="mathjax-tex">\\(E=mc^2\\)</span> bound', 'Energy $E=mc^2$ bound'],
    ['p &lt; 0.05 and *star* [x](y)', 'p < 0.05 and \\*star\\* [x\\](y)'],
  ])('takes the <h1> %j as the title once, already inline Markdown', async (h1, title) => {
    const document = await parse(
      `<html><body><article><h1>${h1}</h1><h2>Results</h2><p>Body.</p></article></body></html>`,
    );
    expect(toMarkdown(document)).toMatch(new RegExp(`^# ${escapeRegExp(title)}\n`));
  });

  it('reads the <h1> fallback title as plain text without its markup', async () => {
    const document = await parse(
      '<html><body><article><h1>A <em>special</em> title</h1><h2>Results</h2><p>Body.</p></article></body></html>',
    );
    expect(toText(document)).toMatch(/^A special title\n/);
  });

  it.each([
    ['citation_title', '<h1>Other</h1>'],
    ['og:title', ''],
  ])('escapes a %s tag once', async (name, h1) => {
    const document = await parse(
      `<html><head><meta property="${name}" content="A *special* title"></head><body><article>${h1}<h2>Results</h2><p>Body.</p></article></body></html>`,
    );
    expect(toMarkdown(document)).toMatch(/^# A \\\*special\\\* title\n/);
  });

  it.each([
    ['an <a rel="license">', '', '<a href="https://example.org/by/4.0/" rel="license">CC BY</a>'],
    [
      'an <a rel="noopener license">',
      '',
      '<a rel="noopener License" href="https://example.org/by/4.0/">x</a>',
    ],
    [
      'an <area rel="license">',
      '',
      '<map><area rel="license" href="https://example.org/by/4.0/"></map>',
    ],
    [
      'the first absolute <a rel="license">',
      '',
      '<a rel="license" href="/terms">Terms</a><a rel="license" href="https://example.org/by/4.0/">CC BY</a>',
    ],
    [
      'a <link rel="license noopener">',
      '<link rel="license noopener" href="https://example.org/by/4.0/">',
      '',
    ],
    [
      'a <link rel="license"> ahead of an <a rel="license">',
      '<link rel="license" href="https://example.org/by/4.0/">',
      '<a rel="license" href="https://example.org/other/">CC BY</a>',
    ],
    [
      'a URL in dc.rights ahead of an <a rel="license">',
      '<meta name="dc.rights" content="https://example.org/by/4.0/">',
      '<a rel="license" href="https://example.org/other/">CC BY</a>',
    ],
  ])('reads the license from %s', async (_, head, body) => {
    const document = await parse(page(`<h2>Introduction</h2><p>${PROSE}${body}</p>`, head));
    expect(document.metadata.license).toEqual({ url: 'https://example.org/by/4.0/' });
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
            id: 'abstract-1-1',
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

  it('numbers abstract parts the page gives no ID abstract-<n>-<m>', async () => {
    const headed = await parse(
      page(`<h2>Abstract</h2><p>Lead.</p><h3>Background</h3><p>Why.</p>
        <h2>Summary</h2><p>Lay.</p><h2>Introduction</h2><p>${PROSE}</p>`),
    );
    const tagged = await parse(
      page(
        `<h2>Introduction</h2><p>${PROSE}</p>`,
        '<meta name="citation_abstract" content="From the tags.">',
      ),
    );
    expect(headed.abstracts.map((abstract) => abstract.sections.map((s) => s.id))).toEqual([
      ['abstract-1-1', 'abstract-1-2'],
      ['abstract-2-1'],
    ]);
    expect(tagged.abstracts[0]?.sections.map((s) => s.id)).toEqual(['abstract-1-1']);
  });

  it('keeps the page’s own section IDs out of the IDs toSections generates', async () => {
    const document = await parse(
      page(`<h2>Abstract</h2><p>Summary.</p><h2 id="abstract-1">Introduction</h2><p>${PROSE}</p>
        <h2 id="floats">Methods</h2><p>How.</p><h2 id="references">Results</h2><p>Found.</p>`),
    );
    const ids = toSections(document).map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(document.body.map((section) => section.id)).not.toContain('abstract-1');
    const abstract = toMarkdown(document, { sections: ['abstract-1'] });
    expect(abstract).toContain('Summary.');
    expect(abstract).not.toContain('Enough prose');
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

  it('sets structured-abstract parts directly under the abstract, headed or bold-labelled', async () => {
    const headed = await parse(
      page(`<section><h2>Abstract</h2><div class="content"><h3>Background</h3><p>Why.</p>
        <h3>Conclusion</h3><p>So.</p></div></section><h2>Introduction</h2><p>${PROSE}</p>`),
    );
    // Cambridge sets each part as a block led by a bold label, with no heading.
    const labelled = await parse(
      page(`<div class="abstract"><h2>Abstract</h2><div class="abstract-content">
        <div class="sec"><span class="bold">Background</span><p>Why.</p></div>
        <div class="sec"><span class="bold">Conclusion</span><p>So.</p></div></div></div>
        <h2>Introduction</h2><p>${PROSE}</p>`),
    );
    for (const document of [headed, labelled]) {
      expect(document.abstracts[0]?.sections.map((s) => [s.title, s.blocks])).toEqual([
        ['Background', [{ text: 'Why.', type: 'paragraph' }]],
        ['Conclusion', [{ text: 'So.', type: 'paragraph' }]],
      ]);
    }
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

describe('landing pages', () => {
  const landing = (title: string) => `<html><head>
    <meta name="citation_title" content="A Study  of Things"></head><body><main>
    <h4>Paper 2023/1234</h4>${title}<p>Jane Doe and Richard Roe</p>
    <h5>Abstract</h5><p>${PROSE}</p>
    <h5>Metadata</h5><dl><dt>Category</dt><dd>Foundations</dd><dt>Keywords</dt><dd>lattices</dd></dl>
    <h5>BibTeX</h5><pre>@misc{doe2023, title = {A Study of Things}}</pre>
    </main></body></html>`;

  it.each([
    ['an <h3>', '<h3>A study of things</h3>'],
    ['an <h1>', '<h1>A study of things</h1>'],
  ])('reads a landing page titled in %s as an abstract with no body', async (_, title) => {
    const document = await parse(landing(title));
    expect(document.abstracts.map((abstract) => abstract.kind)).toEqual(['main']);
    expect([document.body, document.back]).toEqual([[], []]);
    const { warnings } = document.diagnostics;
    expect(warnings.map((warning) => warning.code)).not.toContain('no-abstract');
    expect(warnings.find((warning) => warning.code === 'no-body')?.message).toBe(
      'The page has an abstract but no article text: a landing page',
    );
  });

  it('takes the first outline <h1> as the title over a heading the title tag names', async () => {
    const document = await parse(
      `<html><head><meta name="citation_title" content="A study of things"></head><body><main><h3>A study of things</h3><p>${PROSE}</p><h1>Other</h1><h2>Methods</h2><p>How.</p></main></body></html>`,
    );
    expect(document.body.map((section) => section.title)).toEqual(['Methods']);
  });

  it('keeps every heading as a section on a page with neither a title tag nor an <h1>', async () => {
    const document = await parse(
      `<html><body><main><h3>A study of things</h3><p>${PROSE}</p><h3>Methods</h3><p>How.</p></main></body></html>`,
    );
    expect(document.body.map((section) => section.title)).toEqual(['A study of things', 'Methods']);
  });
});

describe('the run between the title and the first section', () => {
  const INTRO =
    'Antibiotic resistance spreads through soil bacteria faster than models predict, and the reasons remain unclear. Here we ask whether plasmid transfer rates explain the gap.';
  const RESULTS = '<h2>Results</h2><p>Results paragraph.</p>';
  const audit = (run: string, rest = RESULTS) =>
    `<html><body><article><h1>Audit paper</h1>${run}${rest}</article></body></html>`;
  const codes = (document: ScholarlyDocument) =>
    document.diagnostics.warnings.map((warning) => warning.code);

  it('keeps an introduction without a heading on a page with no abstract, and drops the byline', async () => {
    const document = await parse(
      audit(`<p class="byline">Jane Doe, Richard Roe</p><p>${INTRO}</p>`),
    );
    expect(toMarkdown(document)).toBe(
      `# Audit paper\n\n${INTRO}\n\n## Results\n\nResults paragraph.\n`,
    );
  });

  it('keeps the introduction as the whole body when the page has no section', async () => {
    const document = await parse(audit(`<p>Jane Doe</p><p>${INTRO}</p>`, ''));
    expect(document.body).toEqual([
      { blocks: [{ text: INTRO, type: 'paragraph' }], id: 's0', kind: 'body', sections: [] },
    ]);
    expect(codes(document)).not.toContain('no-body');
  });

  it('keeps what follows the introduction, link lists left out', async () => {
    const document = await parse(
      audit(`<p>${INTRO}</p><p><a href="/pdf">Download PDF</a></p><ul><li>A point.</li></ul>`),
    );
    expect(document.body[0]?.blocks).toEqual([
      { text: INTRO, type: 'paragraph' },
      { items: [[{ text: 'A point.', type: 'paragraph' }]], ordered: false, type: 'list' },
    ]);
  });

  it.each([
    [
      'a long affiliation line',
      '<p>Department of Physics, University of Somewhere, Some City, Some Country; Department of Chemistry, Other University, Other City; School of Biology, Third University, Canada.</p>',
    ],
    [
      'a statement opened by a front-matter label',
      '<p>Copyright: © 2024 Doe et al. This is an open access article distributed under the terms of the license, which permits unrestricted use, distribution, and reproduction in any medium.</p>',
    ],
    ['a three-word paragraph', '<p>Introduction without heading.</p>'],
    [
      'a paragraph of 19 words',
      '<p>Antibiotic resistance spreads through soil bacteria faster than models predict, and the reasons for that still remain quite unclear.</p>',
    ],
    [
      'a paragraph that ends without a stop',
      '<p>Antibiotic resistance spreads through soil bacteria faster than models predict, and the reasons remain unclear; here we ask whether plasmid transfer rates explain the gap</p>',
    ],
  ])('drops %s', async (_, run) => {
    const document = await parse(audit(run));
    expect(document.body.map((section) => section.title)).toEqual(['Results']);
  });

  it.each([
    ['a citation marker', `${INTRO.slice(0, -1)}.<sup><a href="#r1">1</a></sup>`],
    ['a closing quote', `${INTRO.slice(0, -5)}“gap.”`],
    ['a question mark in brackets', `${INTRO.slice(0, -1)} (do they?)`],
    ['a colon', `${INTRO.slice(0, -1)}:`],
  ])('reads a paragraph ending in %s as prose', async (_, paragraph) => {
    const document = await parse(audit(`<p>${paragraph}</p>`));
    expect(document.body.map((section) => section.title)).toEqual([undefined, 'Results']);
  });

  it.each([
    ['before the title', `<p>${INTRO}</p><h1>Audit paper</h1>`],
    [
      'before the title, inside its container',
      `<div class="head"><p>${INTRO}</p><h1>Audit paper</h1><p>Jane Doe</p></div>`,
    ],
  ])('never keeps prose set %s', async (_, head) => {
    const document = await parse(`<html><body><article>${head}${RESULTS}</article></body></html>`);
    expect(document.metadata.title).toBe('Audit paper');
    expect(document.body.map((section) => section.title)).toEqual(['Results']);
  });

  it('keeps prose after the title inside the title’s container', async () => {
    const document = await parse(
      `<html><body><article><div class="head"><h1>Audit paper</h1><p>Jane Doe</p><p>${INTRO}</p></div>${RESULTS}</article></body></html>`,
    );
    expect(document.body.map((section) => [section.title, section.blocks[0]])).toEqual([
      [undefined, { text: INTRO, type: 'paragraph' }],
      ['Results', { text: 'Results paragraph.', type: 'paragraph' }],
    ]);
  });

  it.each([
    ['<div class="abstract">', `<div class="abstract"><p>${INTRO}</p></div>`],
    ['<blockquote class="abstract">', `<blockquote class="abstract mathjax">${INTRO}</blockquote>`],
    ['an abstract id', `<section id="articleAbstract"><p>${INTRO}</p></section>`],
  ])('drops the run of a landing page whose abstract is a headingless %s', async (_, run) => {
    const document = await parse(audit(`<p>Jane Doe</p>${run}`, ''));
    expect(document.body).toEqual([]);
    expect(codes(document)).toContain('no-body');
  });

  it('looks through the run for an abstract in time linear in its size', async () => {
    await expectLinear(
      (n) => audit(`<p>${INTRO}</p>${'<div class="a-b"><span id="c-d">w</span></div>'.repeat(n)}`),
      parse,
      { from: 500, to: 8_000 },
    );
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

  const SQUARE = '<msup><mi>x</mi><mn>2</mn></msup>';
  it.each([
    ['a <math> with no TeX', `<math>${SQUARE}</math>`, 'Value $x^2$ is measured.'],
    [
      'a math/mml script with no TeX',
      `<script type="math/mml"><math xmlns="http://www.w3.org/1998/Math/MathML">${SQUARE}</math></script>`,
      'Value $x^2$ is measured.',
    ],
    [
      'a <math> with a TeX annotation and alttext',
      `<math alttext="y^2"><semantics>${SQUARE}<annotation encoding="application/x-tex">z^2</annotation></semantics></math>`,
      'Value $z^2$ is measured.',
    ],
    ['a <math> with alttext', `<math alttext="y^2">${SQUARE}</math>`, 'Value $y^2$ is measured.'],
    [
      'a <math> that linearizes to nothing',
      '<math><mphantom><mi>x</mi></mphantom></math>',
      'Value x is measured.',
    ],
    [
      'a math/mml script declaring a DOCTYPE',
      `<script type="math/mml"><!DOCTYPE math [<!ENTITY e "x">]><math><mi>&amp;e;</mi></math></script>`,
      'Value is measured.',
    ],
    [
      'a math/mml script that is not well-formed',
      '<script type="math/mml"><math><msup><mi>x</mi></math></script>',
      'Value is measured.',
    ],
  ])('reads %s', async (_, math, text) => {
    const document = await parse(
      page(`<h2>Methods</h2><p>${PROSE}</p><p>Value ${math} is measured.</p>`),
    );
    expect(blocks(document.body).at(-1)).toEqual({ text, type: 'paragraph' });
  });

  it('linearizes a display <math> with no TeX', async () => {
    const document = await parse(
      page(
        `<h2>Methods</h2><p>${PROSE}</p><math display="block"><mfrac><mi>a</mi><mi>b</mi></mfrac></math>`,
      ),
    );
    expect(blocks(document.body).at(-1)).toEqual({ tex: '\\frac{a}{b}', type: 'formula' });
  });

  it('reads a <math> with no TeX nested 100,000 rows deep', async () => {
    const deep = `<math>${'<mrow>'.repeat(100_000)}<mi>x</mi>${'</mrow>'.repeat(100_000)}</math>`;
    const document = await parse(
      page(`<h2>Methods</h2><p>${PROSE}</p><p>Value ${deep} is measured.</p>`),
    );
    expect(blocks(document.body).at(-1)).toEqual({
      text: 'Value $x$ is measured.',
      type: 'paragraph',
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

  it('keeps an image-only formula as its image, marked in the sentence and reported', async () => {
    // PLOS sets every formula as an image: display ones in <span class="equation"> with
    // the number in <span class="note">, inline ones in <span class="inline-formula">.
    const document = await parse(
      page(
        `<h2>Methods</h2><p>${PROSE}The total is <span class="equation">` +
          '<img src="file?id=e001" class="inline-graphic"><span class="note">(1)</span></span>' +
          ' where <span class="inline-formula"><img src="file?id=e002" class="inline-graphic">' +
          '</span> is the rate.</p>',
      ),
    );
    expect(blocks(document.body).slice(1)).toEqual([
      {
        href: 'https://example.org/articles/file?id=e001',
        label: '1',
        type: 'formula',
      },
      { text: 'where [formula] is the rate.', type: 'paragraph' },
    ]);
    expect(document.diagnostics.warnings.filter((w) => w.code === 'math-without-tex')).toHaveLength(
      2,
    );
  });
});

describe('text split across spans', () => {
  const span = (parts: string[]) => parts.map((part) => `<span>${part}</span>`).join('');

  /** Every field a publisher page writes inline Markdown into, each holding `split`. */
  async function fields(split: string): Promise<string[]> {
    const document = await parse(
      `<html><body><article><h1>T ${split}</h1>
      <h2>H ${split}</h2><p>${PROSE}</p><p>P ${split}</p>
      <figure><img src="a.png"><figcaption>C ${split}</figcaption></figure>
      <table><tr><td>D ${split}</td></tr></table>
      <h2>References</h2><ol><li id="r1">R ${split} in a cited work.</li></ol>
      </article></body></html>`,
    );
    const [section] = document.body;
    const [, paragraph, figure, table] = section?.blocks ?? [];
    return [
      document.metadata.title ?? '',
      section?.title ?? '',
      paragraph?.type === 'paragraph' ? paragraph.text : '',
      figure?.type === 'figure' ? (figure.caption ?? '') : '',
      table?.type === 'table' ? (table.rows[0]?.[0] ?? '') : '',
      document.references[0]?.text ?? '',
    ];
  }

  it.each([
    [['&lt;', 'img src=x onerror=alert(1)&gt;'], '\\<img src=x onerror=alert(1)>'],
    [['[click]', '(javascript:alert(1))'], '[click\\](javascript:alert(1))'],
    [['\\', '&lt;img src=x onerror=alert(1)&gt;'], '\\\\\\<img src=x onerror=alert(1)>'],
    [['&lt;', 'javascript:alert(1)&gt;'], '\\<javascript:alert(1)>'],
    [['!', '[x]', '(https://example.org/a.png)'], '\\![x](https://example.org/a.png)'],
    [['&lt;', '!-- hidden --&gt;'], '\\<!-- hidden -->'],
  ])('writes %j as text in every field, however the spans split it', async (parts, written) => {
    expect(await fields(span(parts))).toEqual([
      `T ${written}`,
      `H ${written}`,
      `P ${written}`,
      `C ${written}`,
      `D ${written}`,
      `R ${written} in a cited work.`,
    ]);
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

  it('spaces name and source fields the stylesheet separates, never doubling the page’s own', async () => {
    const document = await parse(
      page(`<h2>Introduction</h2><p>${PROSE}</p><div class="refs"><h2>References</h2>
        <div class="ref" id="r1"><span class="string-name"><span class="surname">Chesney</span>, <span class="given-names">E</span></span>, <span class="string-name"><span class="surname">Fazel</span>, <span class="given-names">S</span></span>. A meta-review. World Psychiatry 2014.</div>
        <div class="ref" id="r2"><span class="References__name"><!--[--><span class="References__surname">Wu</span><span class="References__givenNames">F.</span></span><!--]--><span class="ReferencesList_etal">et al</span>. (2023). A study. <i class="References__source">Mol. Plant</i><!--[-->16<!--]-->, 849–864.</div>
      </div><div id="figures-tab" class="figures tab-pane"><img src="f1.jpg"><p>Figure 1 A flow diagram of the trial.</p></div>`),
    );
    expect(document.references.map((r) => r.text)).toEqual([
      'Chesney, E, Fazel, S. A meta-review. World Psychiatry 2014.',
      'Wu F., et al. (2023). A study. *Mol. Plant* 16, 849–864.',
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

describe('document-sized lists', () => {
  /** V8 rejects a call spreading ~120,000 arguments, so the case runs past that on Node. */
  it('reads a container of 200,000 paragraphs', async () => {
    const document = await parse(page(`<h2>Intro</h2><div>${'<p>x</p>'.repeat(200_000)}</div>`));
    const intro = document.body.find((section) => section.title === 'Intro');
    expect(intro?.blocks).toHaveLength(200_000);
  });
});

describe('lookups per item', () => {
  const institutions = (n: number) =>
    page(
      `<h2>Introduction</h2><p>${PROSE}</p>`,
      `<meta name="citation_author" content="Roe, Rita">${Array.from(
        { length: n },
        (_, i) => `<meta name="citation_author_institution" content="Institution ${i}">`,
      ).join('')}`,
    );

  it('reads an author with 50,000 distinct institutions in linear time', async () => {
    await expectLinear(institutions, parse, { from: 50_000 / 16, to: 50_000 });
    const document = await parse(institutions(3));
    expect(document.metadata.authors?.at(-1)?.affiliations).toEqual([1, 2, 3]);
  }, 60_000);

  it('keeps each author’s institutions once, in the order the tags give them', async () => {
    const document = await parse(
      page(
        `<h2>Introduction</h2><p>${PROSE}</p>`,
        [
          '<meta name="citation_author" content="Roe, Rita">',
          '<meta name="citation_author_institution" content="Second">',
          '<meta name="citation_author_institution" content="University of Somewhere">',
          '<meta name="citation_author_institution" content="Second">',
        ].join(''),
      ),
    );
    expect(document.metadata.affiliations).toEqual(['University of Somewhere', 'Second']);
    expect(document.metadata.authors?.map((a) => a.affiliations)).toEqual([[0], undefined, [1, 0]]);
  });

  /** A page whose introduction holds `n` links to `href` followed by a number. */
  const links = (href: string, n: number) =>
    page(
      `<h2>Introduction</h2><p>${PROSE}${Array.from(
        { length: n },
        (_, i) => `<a href="${href}${i}">x</a> `,
      ).join('')}</p>`,
    );

  it('reads 50,000 links to fragments the page does not hold in linear time', async () => {
    await expectLinear((n) => links('/articles/1#nowhere', n), parse, {
      from: 50_000 / 16,
      to: 50_000,
    });
  }, 60_000);

  it.each([
    ['/articles/1#nowhere', /\[x\]\(https:\/\/example\.org\/articles\/1#nowhere0\)$/],
    ['#nowhere', / x$/],
  ])('reads a link to %j by whether it is in the page', async (href, text) => {
    const document = await parse(links(href, 1));
    expect(blocks(document.body)[0]).toMatchObject({ text: expect.stringMatching(text) });
  });

  it('reads a link as in-page when its decoded fragment names an element on the page', async () => {
    const document = await parse(
      page(
        `<h2>Introduction</h2><p id="ref one">${PROSE}<a href="/elsewhere#ref%20one">in</a> <a href="/elsewhere#ref%20two">out</a></p>`,
      ),
    );
    expect(blocks(document.body)[0]).toMatchObject({
      text: expect.stringMatching(/ in \[out\]\(https:\/\/example\.org\/elsewhere#ref%20two\)$/),
    });
  });
});

describe('the table budget', () => {
  it('repeats a spanned cell into at most a million characters of copies, and says so', async () => {
    const text = 'W '.repeat(5_000);
    const table = `<table id="t1"><tr><td colspan="512" rowspan="512">${text}</td></tr>${'<tr><td></td></tr>'.repeat(511)}</table>`;
    const document = await parse(page(`<h2>Results</h2><p>${PROSE}</p>${table}`));
    const block = document.body
      .flatMap((section) => section.blocks)
      .find((candidate) => candidate.type === 'table');
    const copied =
      block?.type === 'table' ? block.rows.flat().join('').length - text.trim().length : 0;
    expect(copied).toBeLessThanOrEqual(1_000_000);
    expect(
      document.diagnostics.warnings.filter((warning) => warning.code === 'truncated-input'),
    ).toMatchObject([{ where: 't1' }]);
  });
});

describe('long unclosed runs', () => {
  /** A page whose article holds `main` after an introduction, parsed. */
  const article = (main: string) => parse(page(`<h2>Introduction</h2><p>${PROSE}</p>${main}`));
  /** A page whose reference list holds one entry, `entry`. */
  const reference = (entry: string) =>
    article(`<h2>References</h2><ol class="references"><li id="r1">${entry}</li></ol>`);

  it.each([
    ['<', '<p>', ''],
    ['<meta', '<html><body>', ''],
    [' http-equiv=refresh', '<meta http-equiv=refresh', '>'],
    ['<script', '<p>', ''],
  ])('checks a page for an interstitial in time linear in a run of %j', async (run, lead, end) => {
    // Up to 480,000 characters, inside the 512 KiB an interstitial is read to.
    const to = 4 ** 4 * Math.floor(480_000 / run.length / 4 ** 4);
    await expectLinear((n) => `${lead}${run.repeat(n)}${end}`, interstitialReason, {
      from: to / 4 ** 4,
      to,
    });
  });

  it('still reads a redirect stub whose content comes before its http-equiv', () => {
    expect(
      interstitialReason(
        '<html><head><meta content="0;URL=https://example.org/a" http-equiv="Refresh"></head></html>',
      ),
    ).toBe('The page is a redirect stub to https://example.org/a, not the document');
  });

  it.each([
    ['<annotation', '<p>x <script type="math/mml">', '</script></p>'],
    ['\\(', '<p>', '</p>'],
    ['\\[', '<p><span class="mathjax">', '</span></p>'],
  ])('reads math in time linear in a run of unclosed %j', async (run, lead, end) => {
    await expectLinear((n) => `${lead}${run.repeat(n)}${end}`, article, {
      from: 500,
      to: 32_000,
    });
  });

  it('reads delimited TeX as math and an unclosed delimiter as text', async () => {
    const document = await article(
      '<p>From \\(a\\) and $$b$$ to \\[c <span class="mathjax">$d$ and \\(e</span></p>',
    );
    expect(blocks(document.body).at(-1)).toEqual({
      text: 'From $a$ and $b$ to \\\\[c $d$ and \\\\(e',
      type: 'paragraph',
    });
  });

  it.each([
    [', ;|', 'a', 'b'],
    ['10.1234/.', 'A work. ', '"'],
    ['arxiv.org/abs/', 'A work. <a href="https://arxiv.org/abs/', '!">arXiv</a>'],
  ])('reads a reference in time linear in a run of %j', async (run, lead, end) => {
    await expectLinear((n) => `${lead}${run.repeat(n)}${end}`, reference, {
      from: 250,
      to: 16_000,
    });
  });

  it('reads a DOI in reference text and an arXiv ID from a link, as before', async () => {
    const document = await reference(
      'Roe R. A work. doi:10.1234/Ab.5. <a href="https://arxiv.org/abs/2401.12345v2">arXiv</a>',
    );
    expect(document.references).toMatchObject([{ arxiv: '2401.12345', doi: '10.1234/ab.5' }]);
  });

  it.each([
    ['10.1002/(SICI)1097-4636(199907)', '10.1002/(sici)1097-4636(199907)'],
    ['(doi: 10.1234/xyz).', '10.1234/xyz'],
    ['"10.1234/abc".', '10.1234/abc'],
    ['doi: 10.1234/abc: more', '10.1234/abc'],
  ])('reads the DOI in reference text %j without what closes it', async (text, doi) => {
    const document = await reference(`Roe R. A work. ${text}`);
    expect(document.references[0]?.doi).toBe(doi);
  });

  it('normalizes a DOI in time linear in a run of trailing punctuation', async () => {
    await expectLinear((n) => `10.1234/a${'.'.repeat(n)}b`, normalizeDoi, {
      from: 2_000,
      to: 512_000,
    });
    expect(normalizeDoi('https://doi.org/10.1234/A.b.;,')).toBe('10.1234/a.b');
  });

  it('reads preformatted text in time linear in a run of spaces inside it', async () => {
    await expectLinear((n) => `<pre>\na${' '.repeat(n)}b \n</pre>`, article, {
      from: 2_000,
      to: 512_000,
    });
    const document = await article('<pre>\n  a  b \n\n</pre>');
    expect(blocks(document.body).at(-1)).toEqual({ text: '  a  b', type: 'code' });
  });
});

describe('deep nesting', () => {
  it('renders quotes nested 1,000 deep around 1,000 paragraphs at under four times the page', async () => {
    const paragraphs = Array.from({ length: 1_000 }, (_, i) => `<p>p${i}</p>`).join('');
    const html = page(
      `<h2>Intro</h2><p>${PROSE}</p>${'<blockquote><p>a</p>'.repeat(1_000)}${paragraphs}${'</blockquote>'.repeat(1_000)}`,
    );
    const document = await parse(html);
    const markdown = toMarkdown(document);
    expect(markdown).toContain('p999');
    expect(markdown.length).toBeLessThan(4 * html.length);
    expect(truncations(document)).toHaveLength(1);
  });

  /** Each nesting: what opens a level, the content at the bottom, and what closes a level. */
  const NESTINGS: [string, string, string, string][] = [
    ['<b>', '<b>', 'deep text', '</b>'],
    ['<blockquote>', '<blockquote>', 'deep text', '</blockquote>'],
    ['<ul><li>', '<ul><li>', 'deep text', '</li></ul>'],
    ['<table><tr><td>', '<table><tr><td>', 'deep text', '</td></tr></table>'],
    ['<div> around a section', '<div>', '<h2>Sub</h2><p>deep text</p>', '</div>'],
    ['<span> around a paragraph', '<span>', '<p>deep text</p>', '</span>'],
    ['<p><li><td>', '<p><li><td>', 'deep text', ''],
    ['<div/>', '<div/>', 'deep text', ''],
  ];
  const nested = ([, open, inner, close]: (typeof NESTINGS)[number], depth: number) =>
    page(`<h2>Intro</h2><p>${PROSE}</p>${open.repeat(depth)}${inner}${close.repeat(depth)}`);
  /** Paragraphs in articles nested `depth` deep, with no region around them. */
  const articles = (depth: number) =>
    `<html><body>${'<article><p>Prose here.</p>'.repeat(depth)}deep text${'</article>'.repeat(depth)}</body></html>`;

  it.each(NESTINGS)(
    'reads %s nested 100,000 deep, keeping the deep text and warning once',
    async (...nesting) => {
      const document = await parse(nested(nesting, 100_000));
      expect(toMarkdown(document)).toContain('deep text');
      expect(truncations(document)).toHaveLength(1);
    },
  );

  it('reads <article><p> nested 100,000 deep with no region around it', async () => {
    const document = await parse(articles(100_000));
    expect(toMarkdown(document)).toContain('deep text');
    expect(truncations(document)).toHaveLength(1);
  });

  it.each(NESTINGS)('reads %s in time linear in its depth', async (...nesting) => {
    await expectLinear((depth) => nested(nesting, depth), parse, { from: 1_000, to: 16_000 });
  });

  it('reads <article><p> in time linear in its depth', async () => {
    await expectLinear(articles, parse, { from: 1_000, to: 16_000 });
  });

  it('keeps 1,000 unclosed paragraphs, items, and cells, and the tags inside scripts, comments, and attributes, without a warning', async () => {
    const tags = '<div>'.repeat(1_000);
    const document = await parse(
      page(
        `<h2>Intro</h2><p>${PROSE}</p>${'<p>a'.repeat(1_000)}<ul>${'<li>b'.repeat(1_000)}</ul>` +
          `<table>${`<tr>${'<td>c'.repeat(500)}`.repeat(2)}</table><script>${tags}</script><!--${tags}-->` +
          `<p title="${tags}">d</p>`,
      ),
    );
    const found = blocks(document.body);
    const list = found.find((block) => block.type === 'list');
    const table = found.find((block) => block.type === 'table');
    expect(found.filter((block) => block.type === 'paragraph' && block.text === 'a')).toHaveLength(
      1_000,
    );
    expect(list?.type === 'list' && list.items.length).toBe(1_000);
    expect(table?.type === 'table' && table.rows.flat().length).toBe(1_000);
    expect(found.at(-1)).toEqual({ text: 'd', type: 'paragraph' });
    expect(truncations(document)).toEqual([]);
  });

  /** Chains nested 250 deep: what opens a level, the content at the bottom, what closes a level, and what holds each chain. */
  const CHAINS: [string, string, string, string, (chain: string) => string][] = [
    [
      '<article><p>',
      '<article><p>Prose here.</p>',
      '',
      '</article>',
      (chain) => `<html><body>${chain}</body></html>`,
    ],
    ['<div> around an <h2>', '<div>', '<h2>Sub</h2><p>y</p>', '</div>', (chain) => page(chain)],
    ['<span> around a <p>', '<span>', '<p>y</p>', '</span>', (chain) => page(chain)],
    [
      '<div> in a <figure> caption',
      '<div>',
      '<p>Fig. 1. A caption.</p>',
      '</div>',
      (chain) => page(`<figure><img src="f.png">${chain}</figure>`),
    ],
    [
      '<code> around a link',
      '<code>',
      '<a href="https://example.org/x">y</a>',
      '</code>',
      (chain) => page(`<h2>Intro</h2><p>${chain}</p>`),
    ],
    [
      '<span class="equation"> around a <p>',
      '<span class="equation">',
      '<p>y</p>',
      '</span>',
      (chain) => page(`<h2>Intro</h2>${chain}`),
    ],
    [
      '<div class="figure"> around a <p>',
      '<div class="figure">',
      '<p>y</p>',
      '</div>',
      (chain) => page(`<h2>Intro</h2>${chain}`),
    ],
    [
      '<h2> around a long heading',
      '<h2>',
      `Sub${' w'.repeat(2_000)}`,
      '</h2>',
      (chain) => page(chain),
    ],
  ];

  it.each(CHAINS)(
    'reads 250-deep chains of %s, repeated to 1 MiB, within three times the same tags laid flat',
    async (_, open, inner, close, hold) => {
      const repeated = (chain: string) => chain.repeat(Math.floor(2 ** 20 / hold(chain).length));
      const deep = hold(repeated(open.repeat(250) + inner + close.repeat(250)));
      const flat = hold(repeated((open + close).repeat(250) + inner));
      await expectWithin(
        () => parse(deep),
        () => parse(flat),
        3,
      );
    },
    120_000,
  );
});

/** The `truncated-input` warnings a document reports. */
function truncations(document: ScholarlyDocument) {
  return document.diagnostics.warnings.filter((warning) => warning.code === 'truncated-input');
}

/**
 * Expect `run` to take less than `factor` times the CPU time `baseline` takes. Each side's
 * time is its fastest of a few calls, the two sides alternating so a busy spell slows both.
 */
async function expectWithin(
  run: () => Promise<unknown>,
  baseline: () => Promise<unknown>,
  factor: number,
): Promise<void> {
  const cpuMs = async (call: () => Promise<unknown>) => {
    const before = process.threadCpuUsage();
    await call();
    const after = process.threadCpuUsage(before);
    return (after.user + after.system) / 1000;
  };
  await run();
  await baseline();
  let runMs = Number.POSITIVE_INFINITY;
  let baselineMs = Number.POSITIVE_INFINITY;
  for (let sample = 0; sample < 3; sample++) {
    runMs = Math.min(runMs, await cpuMs(run));
    baselineMs = Math.min(baselineMs, await cpuMs(baseline));
  }
  expect(runMs, `${runMs.toFixed(0)} ms against ${baselineMs.toFixed(0)} ms`).toBeLessThan(
    factor * baselineMs,
  );
}
