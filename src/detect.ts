/**
 * @fileoverview Format sniffing: which parser a document needs, from its first bytes.
 * @module src/detect
 */
import type { SourceFormat } from './model/document.js';

/** How much of the input the sniffers read: headers and root elements sit at the start. */
const SNIFF_BYTES = 64 * 1024;

/**
 * The format of `input`, or undefined when it is none this package reads. A challenge or
 * access-denied page is `html`; the HTML parser reports it as `blocked`.
 */
export function detect(input: string | Uint8Array): SourceFormat | undefined {
  const head =
    typeof input === 'string'
      ? input.slice(0, SNIFF_BYTES)
      : latin1(input.subarray(0, SNIFF_BYTES));
  if (/^[\s\S]{0,1024}%PDF-/.test(head)) return 'pdf';
  const text = head.replace(/^﻿/, '').replace(/^\s+/, '');
  if (!text.startsWith('<')) return;
  // TEI before HTML: OpenAlex serves Grobid's TEI wrapped in an HTML page.
  if (/<TEI[\s>]|xmlns=["']http:\/\/www\.tei-c\.org\/ns\/1\.0["']/i.test(text)) return 'tei';
  if (
    /^(?:<!DOCTYPE\s+(?:article|pmc-articleset)\b|<article[\s>]|<pmc-articleset[\s>])/i.test(
      afterProlog(text),
    )
  ) {
    return 'jats';
  }
  // Each `<meta` is read up to the next `<`: a run of unclosed ones is scanned once, not once per tag.
  if (/\bltx_document\b|<meta[^<>]+content=["']LaTeXML/i.test(text)) return 'latexml';
  if (/<(?:!DOCTYPE\s+html|html|head|body)[\s>]/i.test(text)) return 'html';
  return;
}

/**
 * The text from the root element on, past an XML declaration and the comments and
 * whitespace before the root. Scanned forward once: a regex over a run of comments
 * backtracks exponentially when the root after them does not match.
 */
function afterProlog(text: string): string {
  let at = /^<\?xml[^>]*>/i.exec(text)?.[0].length ?? 0;
  for (;;) {
    while (/\s/.test(text.charAt(at))) at++;
    if (!text.startsWith('<!--', at)) return text.slice(at);
    const end = text.indexOf('-->', at + 4);
    if (end === -1) return '';
    at = end + 3;
  }
}

/** Bytes as Latin-1 text: enough to sniff ASCII markup whatever the real encoding. */
function latin1(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}
