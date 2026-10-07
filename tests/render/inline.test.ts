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
  joinInlineSeams,
  link,
  pairBrackets,
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

  it('escapes the text of a citation marker, leaving numbers as they are', () => {
    expect(superscript('', '1*', true)).toBe('[1\\*]');
    expect(superscript('', '12, 13', true)).toBe('[12,13]');
    expect(superscript('', '<img src=x>\\', true)).toBe('[\\<imgsrc=x>\\\\]');
    expect(superscript('', '[a](javascript:x)', true)).toBe('[a\\](javascript:x)]');
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

  it('escapes a bracket in its text that has no partner, so the link covers the whole text', () => {
    expect(link('A trial] result', 'https://example.org')).toBe(
      '[A trial\\] result](https://example.org)',
    );
    expect(link('A [trial result', 'https://example.org')).toBe(
      '[A \\[trial result](https://example.org)',
    );
    expect(link('A [trial] `]` \\] result', 'https://example.org')).toBe(
      '[A [trial] `]` \\] result](https://example.org)',
    );
  });

  it('leaves the brackets inside inline math in its text as they are', () => {
    expect(link('see $[0,1)$', 'https://example.org')).toBe('[see $[0,1)$](https://example.org)');
    expect(link('$a]$ and b]', 'https://example.org')).toBe('[$a]$ and b\\]](https://example.org)');
    expect(link('costs \\$[1 and $x$', 'https://example.org')).toBe(
      '[costs \\$\\[1 and $x$](https://example.org)',
    );
  });

  it.each(['$[', '$', '[$', '$\\$['])(
    'balances a long run of %j in time linear in it',
    async (run) => {
      await expectLinear(
        (n) => run.repeat(n),
        (label) => link(label, 'https://example.org'),
        { from: 250, to: 64_000 },
      );
    },
  );
});

describe('pairBrackets', () => {
  it('pairs brackets on a stack, leaving out escaped ones and those in code spans or autolinks', () => {
    expect(pairBrackets('[a [b] c] d]')).toEqual({
      pairs: new Map([
        [3, 5],
        [0, 8],
      ]),
      unpaired: [11],
    });
    expect(pairBrackets('[a \\] `]` <https://x.org/]> [')).toEqual({
      pairs: new Map(),
      unpaired: [0, 28],
    });
  });

  it('reads inline math as a span its brackets do not count in, when asked', () => {
    expect(pairBrackets('[a $[0,1)$ b]', { skipMath: true })).toEqual({
      pairs: new Map([[0, 12]]),
      unpaired: [],
    });
    expect(pairBrackets('[a $[0,1)$ b]')).toEqual({ pairs: new Map([[4, 12]]), unpaired: [0] });
    expect(pairBrackets('[a \\$[ $$ b]', { skipMath: true })).toEqual({
      pairs: new Map([[5, 11]]),
      unpaired: [0],
    });
  });

  it.each(['[[x', '[a [b]', '[`]`', '[\\]', '`a]', '$[', '$', '$\\$['])(
    'reads a long run of %j in time linear in it',
    async (run) => {
      await expectLinear(
        (n) => run.repeat(n),
        (markdown) => pairBrackets(markdown, { skipMath: true }),
        { from: 250, to: 64_000 },
      );
    },
  );
});

describe('joinInlineSeams', () => {
  it('joins inline formulas that touch, as escapeTex would write them as one', () => {
    expect(joinInlineSeams('Suppt$(v)$$:=\\{i\\}$ and $a$ $b$')).toBe(
      'Suppt$(v):=\\{i\\}$ and $a$ $b$',
    );
    expect(joinInlineSeams('costs \\$$x$')).toBe('costs \\$$x$');
    expect(joinInlineSeams('$a\\\\$$b$')).toBe('$a\\\\b$');
    expect(joinInlineSeams('$[0,1]$$(x)$ and $a<$$img src=x>$')).toBe(
      '$[0,1] (x)$ and $a< img src=x>$',
    );
  });

  it('leaves code, autolinks, and link destinations as written', () => {
    expect(joinInlineSeams('`echo $$PID` and `[a](b)`')).toBe('`echo $$PID` and `[a](b)`');
    expect(joinInlineSeams('<https://x.org/$$> and [a](https://x.org/$$)')).toBe(
      '<https://x.org/$$> and [a](https://x.org/$$)',
    );
  });

  it('escapes a ]( that a link does not write: one with no web or mail destination', () => {
    expect(joinInlineSeams('[click](javascript:alert(1)) [19](Summation by parts)')).toBe(
      '[click\\](javascript:alert(1)) [19\\](Summation by parts)',
    );
    expect(joinInlineSeams('[a](/path) [b](data:x) [c]($x$)')).toBe(
      '[a\\](/path) [b\\](data:x) [c\\]($x$)',
    );
    expect(
      joinInlineSeams('[a](https://x.org) [b](HTTP://x.org) [c](ftp://x.org) [d](mailto:a@b.org)'),
    ).toBe('[a](https://x.org) [b](HTTP://x.org) [c](ftp://x.org) [d](mailto:a@b.org)');
  });

  it('reads a backslash run to its end, so an escaped backslash escapes nothing', () => {
    expect(joinInlineSeams('[a\\](b) [c\\\\](d) \\`[e](f)`')).toBe(
      '[a\\](b) [c\\\\\\](d) \\`[e\\](f)`',
    );
  });

  it('keeps a link from reading as an image', () => {
    expect(joinInlineSeams('![x](https://x.org/a.png) and \\![y](https://x.org)')).toBe(
      '\\![x](https://x.org/a.png) and \\![y](https://x.org)',
    );
    expect(joinInlineSeams('![a [b](https://x.org) c](https://y.org) and ![z] (x)')).toBe(
      '\\![a [b](https://x.org) c](https://y.org) and ![z] (x)',
    );
    expect(joinInlineSeams('![a $[$](https://x.org) and ![b $]$](https://y.org)')).toBe(
      '\\![a $[$](https://x.org) and \\![b $]$](https://y.org)',
    );
  });

  it.each(['\\', '](', '`', '``a', '$$', '![x](https://x.org)', '\\$$', '<https:'])(
    'reads a long run of %j in time linear in it',
    async (run) => {
      await expectLinear((n) => run.repeat(n), joinInlineSeams, { from: 250, to: 64_000 });
    },
  );
});

describe('math and code', () => {
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
