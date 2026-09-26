/**
 * @fileoverview `parse` sends each payload to its format's parser, honors an explicit
 * format, and fails as `wrong-format` for payloads no parser reads.
 * @module tests/parse.test
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse.js';
import { buildPdf, paragraph } from './formats/pdf/build-pdf.js';

const JATS = `<?xml version="1.0"?>
<article><front><article-meta><title-group><article-title>A JATS article</article-title></title-group></article-meta></front>
<body><sec><title>Introduction</title><p>Text of the introduction.</p></sec></body></article>`;

const HTML = `<!doctype html><html><head><meta name="citation_title" content="A web article"></head>
<body><main><article><h1>A web article</h1><h2>Introduction</h2><p>${'Text of the introduction. '.repeat(20)}</p></article></main></body></html>`;

describe('parse', () => {
  it('detects the format and parses', async () => {
    const jats = await parse(JATS);
    expect(jats.ok && jats.document.format).toBe('jats');
    expect(jats.ok && jats.document.metadata.title).toBe('A JATS article');

    const html = await parse(HTML, { baseUrl: 'https://example.org/a/1' });
    expect(html.ok && html.document.format).toBe('html');

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
    const nested = `${'<b>'.repeat(100_000)}x${'</b>'.repeat(100_000)}`;
    expect(await reason(`<html><body><article><p>${nested}</p></article></body></html>`)).toBe(
      'malformed',
    );
  });
});
