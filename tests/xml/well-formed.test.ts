/**
 * @fileoverview The well-formedness check every XML parse runs first: faults the XML
 * parser would tolerate silently are reported, and well-formed markup passes.
 * @module tests/xml/well-formed.test
 */
import { describe, expect, it } from 'vitest';
import { parseJats } from '../../src/formats/jats/index.js';
import { findMarkupFault } from '../../src/xml/well-formed.js';

describe('findMarkupFault', () => {
  it('passes well-formed markup, including comments, CDATA, PIs, and a DOCTYPE subset', () => {
    expect(findMarkupFault('<a x="1>2" y=\'<\'><b/>text &amp; more</a>')).toBeUndefined();
    expect(
      findMarkupFault('<?xml version="1.0"?><!-- < --><a><![CDATA[ < ]]><?pi < ?></a>'),
    ).toBeUndefined();
    expect(
      findMarkupFault(
        '<!DOCTYPE article PUBLIC "-//NLM//DTD JATS" "x.dtd" [<!ENTITY y "z">]><mml:math/>',
      ),
    ).toBeUndefined();
  });

  it('reports an unescaped less-than sign with its line', () => {
    expect(findMarkupFault('<p>\nSignificant at p < 0.05.</p>')).toBe('line 2: unescaped "<"');
  });

  it('reports mismatched, stray, and unclosed tags', () => {
    expect(findMarkupFault('<a><b></a></b>')).toBe('line 1: </a> where </b> was expected');
    expect(findMarkupFault('</a>')).toBe('line 1: </a> closes no element');
    expect(findMarkupFault('<a><b>')).toBe('<b> is never closed');
  });

  it('reports markup that is never terminated', () => {
    expect(findMarkupFault('<a><!-- open</a>')).toBe('line 1: markup never terminated');
    expect(findMarkupFault('<a title="x"')).toBe('line 1: markup never terminated');
  });
});

describe('parseJats on markup that is not well-formed', () => {
  it('fails as malformed instead of dropping the rest of the section', () => {
    const result = parseJats(
      '<article><front><article-meta><title-group><article-title>T</article-title></title-group>' +
        '</article-meta></front><body><sec><title>Results</title><p>Significant at p < 0.05.</p>' +
        '</sec><sec><title>Discussion</title><p>More.</p></sec></body></article>',
    );
    expect(result).toEqual({
      error: { message: 'XML could not be parsed: line 1: unescaped "<"', reason: 'malformed' },
      ok: false,
    });
  });
});
