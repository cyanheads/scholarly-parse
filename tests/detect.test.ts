/**
 * @fileoverview `detect` on the opening bytes each format starts with, including the
 * wrappers that make formats look alike: TEI served inside an HTML page, and a JATS
 * document behind an XML declaration, a comment, and a doctype.
 * @module tests/detect.test
 */
import { describe, expect, it } from 'vitest';
import { detect } from '../src/detect.js';

const bytes = (text: string) => new TextEncoder().encode(text);

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

  it('reads past a long run of comments in one pass', () => {
    const comments = '<!-- a -->\n'.repeat(40);
    expect(detect(`<?xml version="1.0"?>${comments}<x>`)).toBeUndefined();
    expect(detect(`${comments}<article>`)).toBe('jats');
    expect(detect('<!-- unclosed <article>')).toBeUndefined();
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

  it('returns undefined for anything else', () => {
    expect(detect('plain text, no markup')).toBeUndefined();
    expect(detect('{"title": "json"}')).toBeUndefined();
    expect(detect(bytes('PK\u0003\u0004 a zip archive'))).toBeUndefined();
  });
});
