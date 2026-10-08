/**
 * @fileoverview `parse` sends each payload to its format's parser, honors an explicit
 * format, and fails as `wrong-format` for payloads no parser reads. A payload behind a
 * byte-order mark, a processing instruction, or an OAI-PMH envelope, and a LaTeXML
 * fragment rooted at `<article>`, reach the parser their format names.
 * @module tests/parse.test
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseJats } from '../src/formats/jats/index.js';
import { parseLatexml } from '../src/formats/latexml/index.js';
import { parse } from '../src/parse.js';
import { toMarkdown } from '../src/render/markdown.js';
import { buildPdf, paragraph } from './formats/pdf/build-pdf.js';

const JATS = `<?xml version="1.0"?>
<article><front><article-meta><title-group><article-title>A JATS article</article-title></title-group></article-meta></front>
<body><sec><title>Introduction</title><p>Text of the introduction.</p></sec></body></article>`;

const HTML = `<!doctype html><html><head><meta name="citation_title" content="A web article"></head>
<body><main><article><h1>A web article</h1><h2>Introduction</h2><p>${'Text of the introduction. '.repeat(20)}See <a href="/b/2">the data</a>.</p></article></main></body></html>`;

const TEI =
  '<TEI><teiHeader><fileDesc><titleStmt><title>A TEI article</title></titleStmt></fileDesc></teiHeader>' +
  '<text><body><div><head n="1">Introduction</head><p>Text.</p></div></body></text></TEI>';

const LATEXML =
  '<article class="ltx_document"><section class="ltx_section">' +
  '<h2 class="ltx_title">Results</h2><p>Body.</p></section></article>';

/** `text` as UTF-16 in either byte order, behind its byte-order mark. */
function utf16(text: string, order: 'le' | 'be'): Uint8Array {
  const units = `\uFEFF${text}`;
  const out = new Uint8Array(units.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < units.length; i++) view.setUint16(i * 2, units.charCodeAt(i), order === 'le');
  return out;
}

/** An OAI-PMH GetRecord response carrying `article` as the record `identifier`. */
const getRecord = (article: string, identifier: string) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">' +
  '<responseDate>2026-09-26T00:00:00Z</responseDate>' +
  `<request verb="GetRecord" identifier="${identifier}" metadataPrefix="pmc">https://example.org/oai</request>` +
  `<GetRecord><record><header><identifier>${identifier}</identifier><datestamp>2023-10-18</datestamp>` +
  '</header><metadata>' +
  article.replace('<article ', '<article xmlns="https://jats.nlm.nih.gov/ns/archiving/1.3/" ') +
  '</metadata></record></GetRecord></OAI-PMH>';

describe('parse', () => {
  it('detects the format and parses', async () => {
    const jats = await parse(JATS);
    expect(jats.ok && jats.document.format).toBe('jats');
    expect(jats.ok && jats.document.metadata.title).toBe('A JATS article');

    const html = await parse(HTML, { baseUrl: 'https://example.org/a/1' });
    expect(html.ok && html.document.format).toBe('html');
    expect(html.ok && html.document.metadata.title).toBe('A web article');
    // The link resolves against the base URL the caller passed.
    expect(html.ok && toMarkdown(html.document)).toContain('[the data](https://example.org/b/2)');

    const pdf = await parse(
      buildPdf({
        pages: [
          [
            { font: 'bold', size: 20, text: 'A PDF article on its own', x: 72, y: 700 },
            ...paragraph(Array(6).fill('Running text set at the size of the body of the page.'), {
              y: 650,
            }),
          ],
        ],
      }),
    );
    expect(pdf.ok && pdf.document.format).toBe('pdf');
    expect(pdf.ok && pdf.document.metadata.title).toBe('A PDF article on its own');
  });

  it('parses bytes behind a byte-order mark as their format\u2019s parser does', async () => {
    const jats = '<article><body><p>Body.</p></body></article>';
    const inputs = [
      new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(jats)]),
      utf16(jats, 'le'),
      utf16(jats, 'be'),
    ];
    for (const input of inputs) {
      const result = await parse(input);
      expect(result.ok && result.document.format).toBe('jats');
      expect(result).toEqual(parseJats(input));
    }
  });

  it('parses a LaTeXML fragment and a JATS article behind a stylesheet', async () => {
    const latexml = await parse(LATEXML);
    expect(latexml.ok && latexml.document.format).toBe('latexml');
    expect(latexml).toEqual(await parseLatexml(LATEXML));

    const styled =
      '<?xml version="1.0"?>\n<?xml-stylesheet type="text/xsl" href="jats.xsl"?>\n' +
      '<article><front><article-meta><title-group><article-title>T</article-title>' +
      '</title-group></article-meta></front><body><p>Body.</p></body></article>';
    const jats = await parse(styled);
    expect(jats.ok && jats.document.metadata.title).toBe('T');
    expect(jats).toEqual(parseJats(styled));
  });

  it('parses the article inside a PMC OAI-PMH record as the bare article', async () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../corpus/jats/pmc-pmc10579850/source.xml'),
      'utf8',
    );
    const article = source.slice(
      source.search(/<article[\s>]/),
      source.lastIndexOf('</article>') + '</article>'.length,
    );
    const bare = parseJats(source);
    if (!bare.ok) throw new Error(bare.error.message);
    expect(bare.document.flavor).toBe('pmc');

    expect(await parse(getRecord(article, 'oai:pubmedcentral.nih.gov:10579850'))).toEqual(bare);
    const elsewhere = await parse(getRecord(article, 'oai:europepmc.org:10579850'));
    expect(elsewhere.ok && elsewhere.document.flavor).toBeUndefined();
    expect(elsewhere).toEqual({ ...bare, document: { ...bare.document, flavor: undefined } });
  });

  it("passes the caller's budgets to the parser", async () => {
    const reason = async (input: string | Uint8Array, options: Parameters<typeof parse>[1]) => {
      const result = await parse(input, options);
      return result.ok ? 'ok' : result.error.reason;
    };
    const pdf = buildPdf({
      pages: [paragraph(Array(20).fill('Body text of the first page.'), { y: 700 }), 0],
    });
    for (const input of [JATS, TEI, LATEXML, HTML, pdf]) {
      expect(await reason(input, {})).toBe('ok');
      expect(await reason(input, { maxInputBytes: 64 })).toBe('too-large');
    }
    const firstPage = await parse(pdf, { maxPages: 1 });
    expect(firstPage.ok && firstPage.document.diagnostics.warnings).toContainEqual({
      code: 'truncated-input',
      message: 'Read 1 of 2 pages',
    });
  });

  it('uses the format the caller names', async () => {
    const result = await parse(JATS, { format: 'tei' });
    expect(result.ok ? 'ok' : result.error.reason).toBe('wrong-format');
  });

  it('fails as wrong-format for payloads it cannot read', async () => {
    for (const input of ['just some text', '%PDF-1.7 as a string']) {
      const result = await parse(input);
      expect(result.ok ? 'ok' : result.error.reason).toBe('wrong-format');
    }
  });

  it('fails as malformed where a document breaks a parser, rather than throwing', async () => {
    const reason = async (input: string | Uint8Array) => {
      const result = await parse(input);
      return result.ok ? 'ok' : result.error.reason;
    };
    const page = buildPdf({
      pages: [paragraph(Array(6).fill('Body text of a page.'), { y: 700 })],
    });
    const looped = new TextDecoder('latin1').decode(page).replace('/Kids [6 0 R]', '/Kids [2 0 R]');
    expect(await reason(Uint8Array.from(looped, (char) => char.charCodeAt(0)))).toBe('malformed');
  });
});
