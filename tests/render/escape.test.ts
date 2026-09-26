/**
 * @fileoverview Escaping source text for Markdown: each rule escapes only where its
 * character could start a construct, so ordinary text stays readable.
 * @module tests/render/escape.test
 */
import { describe, expect, it } from 'vitest';
import {
  codeFence,
  codeSpan,
  escapeBlockStart,
  escapeInline,
  escapeTableCell,
  escapeUrl,
  isSafeUrl,
} from '../../src/render/escape.js';

describe('escapeInline', () => {
  it('always escapes emphasis, code, math, and strikethrough markers', () => {
    expect(escapeInline('a*b `c` $5 ~d')).toBe('a\\*b \\`c\\` \\$5 \\~d');
  });

  it('escapes an underscore only where it could delimit emphasis', () => {
    expect(escapeInline('snake_case and H_2O')).toBe('snake_case and H_2O');
    expect(escapeInline('_lead and trail_')).toBe('\\_lead and trail\\_');
  });

  it('escapes a bracket only where it would open a link', () => {
    expect(escapeInline('[1] and [a](b)')).toBe('[1] and [a\\](b)');
  });

  it('escapes < only before what could open a tag', () => {
    expect(escapeInline('p < 0.05, a<b, </p>, <!x>, <?x>')).toBe(
      'p < 0.05, a\\<b, \\</p>, \\<!x>, \\<?x>',
    );
  });

  it('escapes & only where it would read as an entity', () => {
    expect(escapeInline('R&D, &amp; and &#169;')).toBe('R&D, \\&amp; and \\&#169;');
  });

  it('doubles a backslash that would escape the punctuation after it', () => {
    expect(escapeInline('a\\*b and C:\\dir')).toBe('a\\\\\\*b and C:\\dir');
  });

  it('drops soft hyphens', () => {
    expect(escapeInline('hyphen\u00adation')).toBe('hyphenation');
  });
});

describe('escapeBlockStart', () => {
  it('escapes a line that would open a heading, quote, list, table row, or rule', () => {
    expect(escapeBlockStart('# not a heading')).toBe('\\# not a heading');
    expect(escapeBlockStart('> not a quote')).toBe('\\> not a quote');
    expect(escapeBlockStart('- not an item')).toBe('\\- not an item');
    expect(escapeBlockStart('1. not an item')).toBe('1\\. not an item');
    expect(escapeBlockStart('| not a row')).toBe('\\| not a row');
    expect(escapeBlockStart('---')).toBe('\\---');
    expect(escapeBlockStart('[a]: https://example.org')).toBe('\\[a]: https://example.org');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeBlockStart('#hashtag, -5 degrees, 2024.')).toBe('#hashtag, -5 degrees, 2024.');
  });
});

describe('escapeTableCell', () => {
  it('escapes pipes and folds line breaks into spaces', () => {
    expect(escapeTableCell('a | b\n  c')).toBe('a \\| b c');
  });
});

describe('code spans', () => {
  it('fences with more backticks than any run inside', () => {
    expect(codeFence('plain')).toBe('```');
    expect(codeFence('has ```` four')).toBe('`````');
    expect(codeSpan('a`b')).toBe('``a`b``');
    expect(codeSpan('`edge`')).toBe('`` `edge` ``');
  });
});

describe('URLs', () => {
  it('allows only web and mail schemes', () => {
    expect(isSafeUrl('https://example.org')).toBe(true);
    expect(isSafeUrl('mailto:a@b.org')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,x')).toBe(false);
    expect(isSafeUrl('/relative/path')).toBe(false);
  });

  it('percent-encodes characters that would end a link destination', () => {
    expect(escapeUrl(' https://example.org/a (b)<c> ')).toBe(
      'https://example.org/a%20%28b%29%3Cc%3E',
    );
  });
});
