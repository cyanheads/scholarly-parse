/**
 * @fileoverview Format sniffing: which parser a document needs, from its first bytes.
 * @module src/detect
 */
import type { SourceFormat } from './model/document.js';
import { bomEncoding } from './model/input.js';

/** How many characters of the input the sniffers read: headers and root elements sit at the start. */
const SNIFF_CHARS = 64 * 1024;

/**
 * The format of `input`, or undefined when it is none this package reads. Bytes are read
 * by their byte-order mark, else as Latin-1. A challenge or access-denied page is `html`;
 * the HTML parser reports it as `blocked`.
 */
export function detect(input: string | Uint8Array): SourceFormat | undefined {
  const head = typeof input === 'string' ? input.slice(0, SNIFF_CHARS) : opening(input);
  if (/^[\s\S]{0,1024}%PDF-/.test(head)) return 'pdf';
  const text = head.replace(/^﻿/, '').replace(/^\s+/, '');
  if (!text.startsWith('<')) return;
  // TEI before HTML: OpenAlex serves Grobid's TEI wrapped in an HTML page.
  if (/<TEI[\s>]|xmlns=["']http:\/\/www\.tei-c\.org\/ns\/1\.0["']/i.test(text)) return 'tei';
  const root = afterProlog(text);
  // LaTeXML before JATS: an arXiv fragment is rooted at `<article class="ltx_document">`.
  if (/^<article\s[^<>]*\bclass\s*=\s*["'][^"'<>]*\bltx_document\b/i.test(root)) return 'latexml';
  if (
    /^(?:<!DOCTYPE\s+(?:article|pmc-articleset)\b|<article[\s>]|<pmc-articleset[\s>])/i.test(root)
  ) {
    return 'jats';
  }
  // PMC's OAI-PMH record carries the article in `<metadata>`; an error or `oai_dc` record does not.
  if (/^<OAI-PMH[\s>]/i.test(root) && /<metadata[^<>]*>\s*<article[\s>]/i.test(root)) {
    return 'jats';
  }
  // After the JATS roots, since a JATS article's text can name the class.
  // Each `<meta` is read up to the next `<`: a run of unclosed ones is scanned once, not once per tag.
  if (/\bltx_document\b|<meta[^<>]+content=["']LaTeXML/i.test(text)) return 'latexml';
  if (/<(?:!DOCTYPE\s+html|html|head|body)[\s>]/i.test(text)) return 'html';
  return;
}

/** Markup the prolog may hold before the root, by how it opens and closes. */
const PROLOG_MARKUP = [
  ['<!--', '-->'],
  ['<?', '?>'],
] as const;

/**
 * The text from the root element on, past the XML declaration, processing instructions,
 * comments, and whitespace before the root. Scanned forward once: a regex over a run of
 * comments backtracks exponentially when the root after them does not match.
 */
function afterProlog(text: string): string {
  let at = 0;
  for (;;) {
    while (/\s/.test(text.charAt(at))) at++;
    const markup = PROLOG_MARKUP.find(([open]) => text.startsWith(open, at));
    if (!markup) return text.slice(at);
    const [open, close] = markup;
    const end = text.indexOf(close, at + open.length);
    if (end === -1) return '';
    at = end + close.length;
  }
}

/**
 * The first {@link SNIFF_CHARS} characters of `bytes`, decoded by their byte-order mark as
 * `decodeText` does — UTF-16 takes twice the bytes — else as Latin-1, which reads ASCII
 * markup whatever the real encoding.
 */
function opening(bytes: Uint8Array): string {
  const encoding = bomEncoding(bytes);
  const width = encoding === 'utf-16le' || encoding === 'utf-16be' ? 2 : 1;
  return new TextDecoder(encoding ?? 'latin1').decode(bytes.subarray(0, SNIFF_CHARS * width));
}
