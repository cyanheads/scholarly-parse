/**
 * @fileoverview The inline Markdown builders every parser shares: emphasis, super- and
 * subscripts, citation markers, links, inline math, and code.
 * @module tests/render/inline.test
 */
import { describe, expect, it } from 'vitest';
import {
  emphasis,
  inlineCode,
  inlineMath,
  joinAdjacentMath,
  link,
  subscript,
  superscript,
} from '../../src/render/inline.js';
import { expectLinear } from '../linear.js';

describe('emphasis', () => {
  it('moves edge whitespace outside the markers and leaves empty content alone', () => {
    expect(emphasis(' word ', '*')).toBe(' *word* ');
    expect(emphasis('bold', '**')).toBe('**bold**');
    expect(emphasis('  ', '*')).toBe('  ');
    expect(emphasis('\n a \t', '~~')).toBe('\n ~~a~~ \t');
  });

  it('reads a long run of inner whitespace in time linear in it', async () => {
    await expectLinear(
      (n) => `a${' '.repeat(n)}b`,
      (markdown) => emphasis(markdown, '**'),
      { from: 2_000, to: 512_000 },
    );
  });
});

describe('superscript', () => {
  it('writes a run of citation numbers as a bracketed marker', () => {
    expect(superscript('12, 13', '12, 13', false)).toBe('[12,13]');
    expect(superscript('4–7', '4–7', false)).toBe('[4–7]');
    expect(superscript('[3]', '[3]', true)).toBe('[3]');
  });

  it('writes anything else in TeX-style notation', () => {
    expect(superscript('2', '2', false)).toBe('^2');
    expect(superscript('-5', '-5', false)).toBe('^{-5}');
    expect(superscript('', ' ', false)).toBe('');
  });
});

describe('subscript', () => {
  it('writes TeX-style notation, grouping more than one character', () => {
    expect(subscript('2', '2')).toBe('_2');
    expect(subscript('50', '50')).toBe('_{50}');
    expect(subscript('', '')).toBe('');
  });
});

describe('link', () => {
  it('writes a titled link, or an autolink when the text is the URL', () => {
    expect(link('the paper', 'https://example.org/a')).toBe('[the paper](https://example.org/a)');
    expect(link('https://example.org/a', 'https://example.org/a')).toBe('<https://example.org/a>');
    expect(link('https://example.org/a\\_b', 'https://example.org/a_b')).toBe(
      '<https://example.org/a_b>',
    );
    expect(link('', 'https://example.org/a')).toBe('<https://example.org/a>');
  });

  it('keeps only the text of a link with an unsafe or missing target', () => {
    expect(link('click', 'javascript:alert(1)')).toBe('click');
    expect(link('text', undefined)).toBe('text');
  });

  it('writes an unsafe target with no text as escaped text', () => {
    expect(link('', '<img src=x onerror=alert(1)>')).toBe('\\<img src=x onerror=alert(1)>');
    expect(link('', 'javascript:alert(1)')).toBe('javascript:alert(1)');
  });
});

describe('math and code', () => {
  it('joins inline formulas that touch, leaving an escaped dollar alone', () => {
    expect(joinAdjacentMath('Suppt$(v)$$:=\\{i\\}$ and $a$ $b$')).toBe(
      'Suppt$(v):=\\{i\\}$ and $a$ $b$',
    );
    expect(joinAdjacentMath('costs \\$$x$')).toBe('costs \\$$x$');
  });

  it('wraps TeX in dollars with whitespace collapsed, and renders empty TeX as nothing', () => {
    expect(inlineMath(' x^2 +\n y ')).toBe('$x^2 + y$');
    expect(inlineMath('  ')).toBe('');
  });

  it('spaces TeX apart where it would open an HTML tag or a link', () => {
    expect(inlineMath('<img src=x onerror=alert(1)>')).toBe('$< img src=x onerror=alert(1)>$');
    expect(inlineMath('[a](b) < c')).toBe('$[a] (b) < c$');
  });

  it('writes code in a span no backtick inside can close', () => {
    expect(inlineCode('make')).toBe('`make`');
    expect(inlineCode('a`b')).toBe('``a`b``');
    expect(inlineCode('')).toBe('');
  });
});
