/**
 * @fileoverview `detect` on the opening bytes each format starts with, including the
 * wrappers that make formats look alike: TEI served inside an HTML page, a JATS document
 * behind an XML declaration, a comment, a processing instruction, and a doctype, or inside
 * an OAI-PMH record, and a LaTeXML fragment rooted at `<article>`. Bytes are read by their
 * byte-order mark.
 * @module tests/detect.test
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detect } from '../src/detect.js';
import { decodeText } from '../src/model/input.js';
import { expectLinear } from './linear.js';

const bytes = (text: string) => new TextEncoder().encode(text);

/** `text` as UTF-8 behind its byte-order mark. */
const utf8Bom = (text: string) => new Uint8Array([0xef, 0xbb, 0xbf, ...bytes(text)]);

/** `text` as UTF-16 in either byte order, behind its byte-order mark unless `bom` is false. */
function utf16(text: string, order: 'le' | 'be', { bom = true } = {}): Uint8Array {
  const units = bom ? `\uFEFF${text}` : text;
  const out = new Uint8Array(units.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < units.length; i++) view.setUint16(i * 2, units.charCodeAt(i), order === 'le');
  return out;
}

const JATS = '<article><body><p>Body.</p></body></article>';
const LATEXML_FRAGMENT =
  '<article class="ltx_document"><section class="ltx_section">' +
  '<h2 class="ltx_title">Results</h2><p>Body.</p></section></article>';
const STYLED_JATS =
  '<?xml version="1.0"?>\n<?xml-stylesheet type="text/xsl" href="jats.xsl"?>\n' +
  '<article><front><article-meta><title-group><article-title>T</article-title>' +
  '</title-group></article-meta></front><body><p>Body.</p></body></article>';

/** The JATS `<article>` of a corpus fixture PMC serves inside `<pmc-articleset>`. */
const PMC_ARTICLE = (() => {
  const source = readFileSync(
    resolve(import.meta.dirname, '../corpus/jats/pmc-pmc10579850/source.xml'),
    'utf8',
  );
  return source.slice(
    source.search(/<article[\s>]/),
    source.lastIndexOf('</article>') + '</article>'.length,
  );
})();

/** An OAI-PMH GetRecord response around `metadata` (none for an error response). */
function getRecord(metadata: string | undefined, prefix = 'pmc'): string {
  const identifier = 'oai:pubmedcentral.nih.gov:10579850';
  const answer =
    metadata === undefined
      ? '<error code="idDoesNotExist">The value of the identifier argument is unknown.</error>'
      : `<GetRecord><record><header><identifier>${identifier}</identifier>` +
        '<datestamp>2023-10-18</datestamp><setSpec>f1000res</setSpec><setSpec>pmc-open</setSpec>' +
        `</header><metadata>\n${metadata}\n</metadata></record></GetRecord>`;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<responseDate>2026-09-26T00:00:00Z</responseDate>' +
    `<request verb="GetRecord" identifier="${identifier}" metadataPrefix="${prefix}">` +
    `https://pmc.ncbi.nlm.nih.gov/api/oai/v1/mh/</request>${answer}</OAI-PMH>`
  );
}

/** The article as an OAI record carries it: in the JATS default namespace. */
const namespaced = (article: string) =>
  article.replace('<article ', '<article xmlns="https://jats.nlm.nih.gov/ns/archiving/1.3/" ');

describe('detect', () => {
  it('reads a PDF by its header, in bytes or text', () => {
    expect(detect(bytes('%PDF-1.7\n%âãÏÓ\n1 0 obj'))).toBe('pdf');
    expect(detect('\n\n%PDF-1.4')).toBe('pdf');
  });

  it('reads JATS behind a declaration, a comment, and a doctype', () => {
    const jats =
      '<?xml version="1.0" encoding="UTF-8"?>\n<!-- exported -->\n<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.3 20210610//EN" "JATS-archivearticle1-3.dtd">\n<article article-type="research-article">';
    expect(detect(jats)).toBe('jats');
    expect(detect('<pmc-articleset><article>')).toBe('jats');
  });

  it('reads JATS behind processing instructions', () => {
    expect(detect(STYLED_JATS)).toBe('jats');
    expect(detect(`<!-- a --><?pi one?>\n<?pi two?>${JATS}`)).toBe('jats');
    expect(detect('<?xml-stylesheet href="unclosed.xsl" <article>')).toBeUndefined();
  });

  it('reads past a long run of comments in one pass', () => {
    const comments = '<!-- a -->\n'.repeat(40);
    expect(detect(`<?xml version="1.0"?>${comments}<x>`)).toBeUndefined();
    expect(detect(`${comments}<article>`)).toBe('jats');
    expect(detect('<!-- unclosed <article>')).toBeUndefined();
  });

  it('reads JATS inside a PMC OAI-PMH record', () => {
    expect(detect(getRecord(namespaced(PMC_ARTICLE)))).toBe('jats');
    const late = PMC_ARTICLE.replace('<body>', `<!--${' '.repeat(64 * 1024)}--><body>`);
    expect(late.indexOf('<body>')).toBeGreaterThan(64 * 1024);
    expect(detect(getRecord(namespaced(late)))).toBe('jats');
    const frontMatter = `${PMC_ARTICLE.slice(0, PMC_ARTICLE.indexOf('</front>') + 8)}</article>`;
    expect(detect(getRecord(namespaced(frontMatter), 'pmc_fm'))).toBe('jats');
  });

  it('reads no format in an OAI-PMH error or a Dublin Core record', () => {
    expect(detect(getRecord(undefined))).toBeUndefined();
    const dublinCore =
      '<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Numerical Scheme</dc:title>' +
      '<dc:description>&lt;p&gt;An &lt;body&gt; of text.&lt;/p&gt;</dc:description></oai_dc:dc>';
    expect(detect(getRecord(dublinCore, 'oai_dc'))).toBeUndefined();
  });

  it('reads Grobid TEI, bare or inside an HTML page', () => {
    expect(
      detect('<?xml version="1.0"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader>'),
    ).toBe('tei');
    expect(detect('<html><body><tei><teiheader><filedesc>')).toBe('tei');
  });

  it('tells LaTeXML pages from other HTML', () => {
    expect(
      detect('<!DOCTYPE html><html><head><meta name="generator" content="LaTeXML"></head>'),
    ).toBe('latexml');
    expect(detect('<!DOCTYPE html><html><body><article class="ltx_document">')).toBe('latexml');
    expect(detect('﻿<!doctype html><html lang="en"><head><title>Article</title>')).toBe('html');
  });

  it('reads a LaTeXML fragment rooted at its article', () => {
    expect(detect(LATEXML_FRAGMENT)).toBe('latexml');
    expect(detect('<article lang="en" class="ltx_document ltx_authors_1line">')).toBe('latexml');
  });

  it('keeps a JATS article whose text names the LaTeXML class', () => {
    const jats =
      '<article><front><article-meta><abstract><p>Pages are rooted at ' +
      '<monospace>&lt;article class="ltx_document"&gt;</monospace>.</p></abstract>' +
      '</article-meta></front></article>';
    expect(detect(jats)).toBe('jats');
  });

  it('reads bytes by their byte-order mark', () => {
    for (const encoded of [utf8Bom(JATS), utf16(JATS, 'le'), utf16(JATS, 'be')]) {
      expect(detect(encoded)).toBe('jats');
    }
    expect(detect(utf8Bom(LATEXML_FRAGMENT))).toBe('latexml');
    expect(detect(utf16(STYLED_JATS, 'be'))).toBe('jats');
    expect(detect(utf8Bom('<!DOCTYPE html><html><body><p>Text.</p>'))).toBe('html');
  });

  it('reads UTF-16 to 64 Ki characters, not 64 KiB', () => {
    const page = (padding: number) =>
      `<!DOCTYPE html><html><head><title>T</title></head><body>${' '.repeat(padding)}` +
      '<article class="ltx_document">';
    expect(detect(utf16(page(40_000), 'le'))).toBe('latexml');
    expect(detect(utf16(page(64 * 1024), 'le'))).toBe('html');
  });

  it('reads no format in UTF-16 without a byte-order mark, as decodeText reads none', () => {
    const unmarked = utf16(JATS, 'le', { bom: false });
    expect(detect(unmarked)).toBeUndefined();
    expect(decodeText(unmarked)).not.toContain('<article');
  });

  it('reads a window of unclosed meta tags in one pass', () => {
    const started = performance.now();
    expect(detect(`<html>${'<meta '.repeat(13_000)}`)).toBe('html');
    expect(performance.now() - started).toBeLessThan(100);
  });

  it('reads runs of unclosed metadata and article tags in time linear in the window', async () => {
    await expectLinear((n) => `<OAI-PMH>${'<metadata '.repeat(n)}`, detect, {
      from: 100,
      to: 6_400,
    });
    await expectLinear((n) => `<article class="${' class="ltx'.repeat(n)}`, detect, {
      from: 80,
      to: 5_120,
    });
  });

  it('returns undefined for anything else', () => {
    expect(detect('plain text, no markup')).toBeUndefined();
    expect(detect('{"title": "json"}')).toBeUndefined();
    expect(detect(bytes('PK\u0003\u0004 a zip archive'))).toBeUndefined();
  });
});
