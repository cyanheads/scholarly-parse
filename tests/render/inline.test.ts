/**
 * @fileoverview The inline Markdown builders every parser shares: emphasis, super- and
 * subscripts, citation markers, links, inline math, and code.
 * @module tests/render/inline.test
 */
import { describe, expect, it } from 'vitest';
import { escapeInline } from '../../src/render/escape.js';
import {
  emphasis,
  inlineCode,
  inlineMath,
  joinInlineSeams,
  link,
  subscript,
  superscript,
} from '../../src/render/inline.js';
import { pairBrackets } from '../../src/render/scan.js';
import { stripInline } from '../../src/render/text.js';
import { gfmFindings, gfmMarkup, gfmSpans, gfmText } from '../gfm.js';
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
  it('keeps the closing brace out of a bare URL the group ends with', () => {
    for (const [script, written] of [
      [subscript(escapeInline('https://a.co/x'), 'https://a.co/x'), '_{<https://a.co/x>}'],
      [
        superscript(escapeInline('www.a.co/x.'), 'www.a.co/x.', false),
        '^{[www.a.co/x](http://www.a.co/x).}',
      ],
      [
        subscript(escapeInline('see https://a.co/x y'), 'see https://a.co/x y'),
        '_{see https://a.co/x y}',
      ],
    ]) {
      expect(script).toBe(written);
      const markdown = `x${script}\\<img src=x>`;
      expect(gfmMarkup(markdown).filter((m) => m.startsWith('html') || m.includes('}'))).toEqual(
        [],
      );
    }
  });

  it('escapes a backslash the trim leaves at the end of the script', () => {
    for (const [script, written] of [
      [superscript(escapeInline('\\ '), '\\ ', false), '^\\\\'],
      [subscript(escapeInline('\\ '), '\\ '), '_\\\\'],
      [superscript(escapeInline('a\\ '), 'a\\ ', false), '^{a\\\\}'],
      [subscript(escapeInline(' a \\\t'), ' a \\\t'), '_{a \\\\}'],
    ]) {
      expect(script).toBe(written);
      expect(gfmMarkup(`x${script}\\<img src=x>`)).toEqual([]);
    }
  });

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
    expect(link(escapeInline('https://example.org/a~b'), 'https://example.org/a~b')).toBe(
      '<https://example.org/a~b>',
    );
    expect(link('', 'https://example.org/a')).toBe('<https://example.org/a>');
  });

  it.each([
    'https://example.org/~a/b_c',
    'https://wwwuser.gwdg.de/~compbiol/data/hhsuite/databases/hhsuite_dbs/',
    'https://wwwuser.gwdg.de/~compbiol/uniclust/2018_08/',
    'https://www.tolobio.com/product_details/32118_AapCas12b_(C2c1)_Nuclease.html',
    'https://a.co/x_y_',
  ])('writes a link whose text is its own URL, as escaped, as an autolink: %s', (url) => {
    expect(link(escapeInline(url), url)).toBe(`<${url}>`);
    expect(gfmMarkup(link(escapeInline(url), url))).toEqual([`link:${url}`]);
  });

  it('writes the parentheses of an autolink as they are, and encodes them in a destination', () => {
    expect(link('', 'https://x.org/(a)')).toBe('<https://x.org/(a)>');
    expect(stripInline(link('', 'https://x.org/(a)'))).toBe('https://x.org/(a)');
    expect(gfmMarkup(link('', 'https://x.org/(a)'))).toEqual(['link:https://x.org/(a)']);
    expect(link('see', 'https://x.org/a)b')).toBe('[see](https://x.org/a%29b)');
    expect(link('', 'https://x.org/a b<c>')).toBe('<https://x.org/a%20b%3Cc%3E>');
  });

  it('writes a URL in its text as text, since no bare URL links in link text', () => {
    expect(link(escapeInline('https://a.co/x<b>'), 'https://y.org')).toBe(
      '[https://a.co/x\\<b>](https://y.org)',
    );
    expect(link(escapeInline('see www.a.co/x<b> and https://z.org/a~b'), 'https://y.org')).toBe(
      '[see www.a.co/x\\<b> and https://z.org/a\\~b](https://y.org)',
    );
    expect(link(`a ${link('', 'https://z.org/(1)')} b`, 'https://y.org')).toBe(
      '[a https://z.org/(1) b](https://y.org)',
    );
    for (const text of ['https://a.co/x<b>', 'see www.a.co/x<b> and https://z.org/a~b']) {
      const markdown = link(escapeInline(text), 'https://y.org');
      expect(gfmMarkup(markdown)).toEqual(['link:https://y.org']);
      expect(gfmText(markdown)).toBe(text);
    }
  });

  it('writes a link its text holds as that link’s text, so the outer link forms', () => {
    expect(link(link('a', 'https://z.org'), 'https://y.org')).toBe('[a](https://y.org)');
    expect(link(`see ${link('a', 'https://z.org/x\\')} b`, 'https://y.org')).toBe(
      '[see a b](https://y.org)',
    );
    const joined = joinInlineSeams(
      `${link(link('a', 'https://z.org'), 'https://y.org')}x.${escapeInline('<img src=x>')}`,
    );
    expect(gfmMarkup(joined)).toEqual(['link:https://y.org']);
    expect(gfmText(joined)).toBe('ax.<img src=x>');
  });

  it('keeps its text from opening a link of its own once a link inside it is written as text', () => {
    const inner = link(escapeInline('(http:)'), 'https://y.org');
    const joined = joinInlineSeams(
      `${link(`${escapeInline('[]')}${inner}`, 'https://y.org')}${inlineCode('<b>')}`,
    );
    expect(gfmMarkup(joined)).toEqual(['link:https://y.org']);
    expect(gfmText(joined)).toBe('[](http:)<b>');
  });

  it('reads the code spans in its text joined, as the seam pass will join them', () => {
    const inner = link(`${inlineCode(')')}${inlineCode('``')}`, 'https://y.org');
    const joined = joinInlineSeams(
      `${link(`${inner}${inlineCode(']')}`, 'https://y.org')}${escapeInline('<x>')}`,
    );
    expect(gfmMarkup(joined)).toEqual(['link:https://y.org']);
    expect(gfmText(joined)).toBe(')``]<x>');
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

  it.each(['$[', '$', '[$', '$\\$[', '[a](b)', '`a``b`', '\\``a``', '[`a`](`b``'])(
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

describe('a backslash at the end of emphasized or linked text', () => {
  it.each([
    [link(escapeInline('a\\ '), 'https://y.org'), '[a\\\\](https://y.org)', ['link:https://y.org']],
    [emphasis(escapeInline('a\\ '), '*'), '*a\\\\* ', ['emphasis']],
    [emphasis(escapeInline('a\\ '), '~~'), '~~a\\\\~~ ', ['delete']],
  ])('stays text, escaping no closing marker or bracket: %j', (markdown, written, markup) => {
    expect(markdown).toBe(written);
    expect(gfmMarkup(markdown)).toEqual(markup);
    expect(gfmText(markdown).trim()).toBe('a\\');
  });
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

  it.each([
    ['`a``` `<img src=x> ``', '``a`<img src=x>``', 'a`<img src=x>'],
    ['`a``b`', '`ab`', 'ab'],
    ['x `a``b``c` y', 'x `abc` y', 'x abc y'],
    ['``a`b```` ` ``', '`` a`b` ``', 'a`b`'],
  ])(
    'writes touching code spans, whose fences meet as one run, as one span: %j',
    (markdown, joined, text) => {
      expect(joinInlineSeams(markdown)).toBe(joined);
      expect(gfmMarkup(joined)).toEqual([]);
      expect(gfmText(joined)).toBe(text);
      expect(stripInline(joined)).toBe(text);
    },
  );

  it.each([
    [['a', '<b>', '``'], '`a<b>``'],
    [['<b>', '``'], '`<b>``'],
    [['<!--', '-->``'], '`<!---->``'],
  ])('joins touching code spans %j that open after an escaped backtick', (spans, text) => {
    const joined = joinInlineSeams(`${escapeInline('`')}${spans.map(inlineCode).join('')}`);
    expect(gfmMarkup(joined)).toEqual([]);
    expect(gfmText(joined)).toBe(text);
  });

  it('leaves code, autolinks, and link destinations as written', () => {
    expect(joinInlineSeams('`echo $$PID` and `[a](b)`')).toBe('`echo $$PID` and `[a](b)`');
    // A destination as `link` writes it, its dollar signs escaped.
    expect(link('a', 'https://x.org/$$')).toBe('[a](https://x.org/\\$\\$)');
    expect(joinInlineSeams('<https://x.org/$$> and [a](https://x.org/\\$\\$)')).toBe(
      '<https://x.org/$$> and [a](https://x.org/\\$\\$)',
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

  it.each([
    // A code span's opening fence, so the code after it comes out of its span as HTML.
    [
      '[a](https://y.org/`q)` `<img src=x>`',
      '[a\\](https://y.org/`q)` `<img src=x>`',
      '[a](https://y.org/q) <img src=x>',
    ],
    [
      '[a](https://y.org/<https://z.org>)',
      '[a\\](https://y.org/<https://z.org>)',
      '[a](https://y.org/https://z.org)',
    ],
    ['[a](https://y.org/$q$)', '[a\\](https://y.org/$q$)', '[a](https://y.org/$q$)'],
  ])(
    'escapes a ]( whose destination runs into markup another piece wrote, which link never writes: %j',
    (markdown, written, text) => {
      const joined = joinInlineSeams(`x ${markdown} x`);
      expect(joined).toBe(`x ${written} x`);
      expect(gfmFindings(joined, { text: `x ${text} x` }, { textPassLinks: false })).toEqual([]);
      expect(gfmText(joined)).toBe(`x ${text} x`);
    },
  );

  it('keeps a ]( split across pieces before a destination as link writes one, through markers', () => {
    // Outside what the escaping bounds (docs/design.md): `link` writes `~` and `*` as they are.
    const joined = joinInlineSeams(
      `x ${escapeInline('[]')}${escapeInline('(http:')}${emphasis(')', '~~')} x`,
    );
    expect(joined).toBe('x [](http:~~)~~ x');
    expect(gfmMarkup(joined)).toEqual(['link:http:~~']);
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

  it('spaces a control word at a joint apart from the letters after it', () => {
    expect(joinInlineSeams('See $\\alpha$$x$ here.')).toBe('See $\\alpha x$ here.');
    expect(joinInlineSeams('$\\cdot$$y$')).toBe('$\\cdot y$');
  });

  it.each([
    ['$\\alpha$$2$', '$\\alpha2$'],
    ['$\\alpha$$\\beta$', '$\\alpha\\beta$'],
    ['$\\alpha$$_1$', '$\\alpha_1$'],
    ['$\\,$$x$', '$\\,x$'],
    ['$a\\\\b$$c$', '$a\\\\bc$'],
    ['$a$$b$', '$ab$'],
  ])('joins %j with no space where no control word ends', (markdown, joined) => {
    expect(joinInlineSeams(markdown)).toBe(joined);
  });

  it.each([
    ['https://a.co/x*\\<b>bold* end', '<https://a.co/x>*\\<b>bold* end', 'link:https://a.co/x'],
    ['[a] https://a.co/x*\\<b>*', '[a] <https://a.co/x>*\\<b>*', 'link:https://a.co/x'],
    ['https://a.co/x`<b>`', '<https://a.co/x>`<b>`', 'link:https://a.co/x'],
    ['www.a.co/x~~\\<b>~~', '[www.a.co/x](http://www.a.co/x)~~\\<b>~~', 'link:http://www.a.co/x'],
  ])(
    'writes a bare URL that markup or an escape after it would join as an autolink: %j',
    (markdown, joined, href) => {
      expect(joinInlineSeams(markdown)).toBe(joined);
      expect(
        gfmMarkup(joined).filter((m) => m.startsWith('link:') || m.startsWith('html:')),
      ).toEqual([href]);
      expect(gfmText(joined)).toBe(stripInline(joined));
    },
  );

  it.each([
    // A link right after a bare URL: GFM would link `…/x[here` and the link would not form.
    [
      'www.a.co/x[here](https://y.org)',
      '[www.a.co/x](http://www.a.co/x)[here](https://y.org)',
      ['link:http://www.a.co/x', 'link:https://y.org'],
    ],
    [
      'https://a.co/x[here](https://y.org)\\<img src=x>',
      '<https://a.co/x>[here](https://y.org)\\<img src=x>',
      ['link:https://a.co/x', 'link:https://y.org'],
    ],
    // A bracket that opens no link stays part of the URL.
    ['https://a.co/q?x[0]=1 y', 'https://a.co/q?x[0]=1 y', ['link:https://a.co/q?x[0]=1']],
  ])('ends a bare URL where a link written after it opens: %j', (markdown, joined, links) => {
    expect(joinInlineSeams(markdown)).toBe(joined);
    expect(gfmMarkup(joined)).toEqual(links);
    expect(gfmText(joined)).toBe(stripInline(joined));
  });

  it.each([
    ['https://a.co/x](y', '<https://a.co/x>\\](y', 'link:https://a.co/x'],
    [
      'see www.a.co/x](y) z',
      'see [www.a.co/x](http://www.a.co/x)\\](y) z',
      'link:http://www.a.co/x',
    ],
  ])(
    'writes a bare URL that the escape of a `](` after it would join as a link: %j',
    (markdown, joined, href) => {
      expect(joinInlineSeams(markdown)).toBe(joined);
      expect(gfmMarkup(joined)).toEqual([href]);
      expect(gfmText(joined)).toBe(markdown);
    },
  );

  it('writes a bare URL that a repaired marker comes to stand before as a link', () => {
    const joined = joinInlineSeams('x*-www.a.co/y*\\<img src=x>');
    expect(joined).toBe('x-*[www.a.co/y](http://www.a.co/y)*\\<img src=x>');
    expect(gfmMarkup(joined)).toEqual(['emphasis', 'link:http://www.a.co/y']);
    expect(gfmText(joined)).toBe('x-www.a.co/y<img src=x>');
  });

  it('writes a bare URL in inline math as an autolink when markup after the math would join it', () => {
    // GFM has no math, so a URL in `$…$` links as a bare one and runs on past the `$`.
    expect(joinInlineSeams('$https://a.co$*\\<b>*')).toBe('$<https://a.co>$*\\<b>*');
    expect(gfmMarkup('$<https://a.co>$*\\<b>*')).toEqual(['link:https://a.co', 'emphasis']);
  });

  it('leaves a clean bare URL, and a URL in link text, as written', () => {
    const written = [
      'see https://a.co/x_y *now*',
      '[https://a.co/x\\<b>](https://y.org)',
      '[x https://a.co/x\\<b>',
    ];
    for (const markdown of written) expect(joinInlineSeams(markdown)).toBe(markdown);
    expect(gfmMarkup(written[1] ?? '')).toEqual(['link:https://y.org']);
  });

  it.each([
    // Trailing punctuation inside a closer with a word after it.
    [
      '*Rules that contain constraints.*We observe it.',
      '*Rules that contain constraints*.We observe it.',
      ['emphasis:Rules that contain constraints'],
    ],
    ['a *daf-16-*dependent b', 'a *daf-16*-dependent b', ['emphasis:daf-16']],
    ['*SpliceAI (*RRID:SCR_026278)', '*SpliceAI* (RRID:SCR_026278)', ['emphasis:SpliceAI']],
    // Leading punctuation inside an opener with a word before it.
    ['like RNAi*, ddl-1* RNAi', 'like RNAi, *ddl-1* RNAi', ['emphasis:ddl-1']],
    // Both edges.
    ['a**(x)**b', 'a(**x**)b', ['strong:x']],
    ['F59E12.10*, ddl-2/*Y48E1B.1', 'F59E12.10, *ddl-2*/Y48E1B.1', ['emphasis:ddl-2']],
    // A digit on either side of the marker.
    ['3*(x)*4', '3(*x*)4', ['emphasis:x']],
    ['*step 1.*2', '*step 1*.2', ['emphasis:step 1']],
    // Strikethrough.
    ['a~~(y)~~z', 'a(~~y~~)z', ['delete:y']],
    // Nested: GFM pairs the stuck closer with the strong run's closer, so strong is lost.
    ['**a *b.*c**', '**a *b*.c**', ['strong:a b.c', 'emphasis:b']],
    ['a***(x)***b', 'a(***x***)b', ['emphasis:x', 'strong:x']],
    // An escape at the edge moves as one, and a formula right at the edge.
    ['[see x*\\<b>* now](https://y.org)', '[see x\\<*b>* now](https://y.org)', ['emphasis:b>']],
    ['**73.2$\\uparrow$**8.9', '**73.2**$\\uparrow$8.9', ['strong:73.2']],
    ['x*(.$y$)*z', 'x(.*$y$*)z', ['emphasis:$y$']],
    // GFM pairs `/*Y57` with `F59*`, whole; the chain from the runs it leaves unpaired
    // reaches that pair.
    [
      '(*sinh-1/*Y57, *ddl-1*/F59*, ddl-2/*Y48',
      '(*sinh-1*/Y57, *ddl-1*/F59, *ddl-2*/Y48',
      ['emphasis:sinh-1', 'emphasis:ddl-1', 'emphasis:ddl-2'],
    ],
  ])('moves edge punctuation outside a marker that cannot pair: %j', (markdown, joined, spans) => {
    const text = stripInline(markdown.replace(/[*~]/g, ''));
    expect(joinInlineSeams(markdown)).toBe(joined);
    expect(gfmSpans(joined)).toEqual(spans);
    expect(gfmText(joined)).toBe(text);
    expect(stripInline(joined)).toBe(text);
  });

  it.each([
    // Emphasis over punctuation alone has nothing a marker can stand beside.
    ['lifespan*.* We', 'lifespan. We', []],
    ['x*(.)*y', 'x(.)y', []],
    ['P(*a*_t*, . . .*)', 'P(*a*_t, . . .)', ['emphasis:a']],
    // GFM pairs `.*01` with the next `0*.`, whole, and the chain reaches every pair.
    [
      '−0*.*01, *α*_3 = 0*.*5, *α*_5 = −1*.*5',
      '−0.01, *α*_3 = 0.5, *α*_5 = −1.5',
      ['emphasis:α', 'emphasis:α'],
    ],
    // A formula alone is moved out whole, which leaves nothing emphasized.
    ['a**$x$**b', 'a$x$b', []],
    // Moving the punctuation would join the marker to the strong run inside it.
    ['a*(**x**)*b', 'a(**x**)b', ['strong:x']],
    // Sub- and superscript notation stays whole.
    ['pKa*_2*', 'pKa_2', []],
    // A run two pairs share is reached from both, and its pair over `)` dropped once.
    ['((a*)***', '((a)**', []],
  ])('drops the markers of a pair no shift makes pair: %j', (markdown, joined, spans) => {
    expect(joinInlineSeams(markdown)).toBe(joined);
    expect(gfmSpans(joined)).toEqual(spans);
    expect(gfmText(joined)).toBe(stripInline(joined));
    const unmarked = (text: string) => text.replace(/(?<!\\)[*~]/g, '');
    expect(unmarked(joined)).toBe(unmarked(markdown));
  });

  it.each([
    // Two spans of one kind that touch: the run between them closes one and opens the next.
    ['**K****-step**: Update', '**K-step**: Update', ['strong:K-step']],
    ['*a**b*', '*ab*', ['emphasis:ab']],
    ['~~a~~~~b~~', '~~ab~~', ['delete:ab']],
    ['x **a****b** y', 'x **ab** y', ['strong:ab']],
    // Only the outer spans join: a strong span inside the first one stays.
    ['***a****b*', '***a**b*', ['emphasis:ab', 'strong:a']],
  ])('joins touching spans of one kind into one: %j', (markdown, joined, spans) => {
    expect(joinInlineSeams(markdown)).toBe(joined);
    expect(gfmSpans(joined)).toEqual(spans);
    const text = markdown.replace(/[*~]/g, '');
    expect(gfmText(joined)).toBe(text);
    expect(stripInline(joined)).toBe(text);
  });

  it.each([
    // A run two pairs share: the pair over punctuation alone loses its markers, the other stays.
    ['**Table 1*.***', '**Table 1.**', ['strong:Table 1.']],
    ['**Table 1*.*** next', '**Table 1.** next', ['strong:Table 1.']],
    // The edge punctuation moves across the whole run the pairs share.
    ['**a *(b)***c', '**a *(b***)c', ['strong:a (b', 'emphasis:(b']],
    ['c***(b)* a**', 'c(***b)* a**', ['strong:b) a', 'emphasis:b)']],
  ])('repairs a stuck run that two pairs share: %j', (markdown, joined, spans) => {
    expect(joinInlineSeams(markdown)).toBe(joined);
    expect(gfmSpans(joined)).toEqual(spans);
    const text = markdown.replace(/[*~]/g, '');
    expect(gfmText(joined)).toBe(text);
    expect(stripInline(joined)).toBe(text);
  });

  it.each([
    // Nested strong GFM pairs as written: freeing `(**a` to close would take the outer opener.
    '**T (**a**) b. (**c**) d.**',
    // Every run pairs whole as written, if not as meant: which pairs were meant cannot be read.
    '(*A. nitens;*Figure 1B; t-Glc*p* x',
    // A repair here would leave more markers unpaired than it fixes.
    'x **)b*/*(/*.a',
    // Moving `).` out of the strong run would put its closer inside the strikethrough pair.
    '**a))~~a).**a~~',
    // Read as a closer and an opener, `**` would join spans GFM already pairs, and break them.
    ')*)**aaa***)',
    // Joining at `***` would not pair the spans it joins.
    '*b**b***a*a.a',
  ])('leaves runs GFM pairs whole as written, and a repair that pairs fewer: %j', (markdown) => {
    expect(joinInlineSeams(markdown)).toBe(markdown);
  });

  it('leaves emphasis that already opens and closes as written', () => {
    for (const markdown of [
      '(*E. coli*) and *a* b',
      '**Fig. 1.** Text',
      'a *b.* c',
      '*(a)* and x*y*z',
      '**a *b* c** and `x*(y)*z` and $a*(b)*c$',
      // Touching spans GFM already reads apart.
      '***a*****b**',
      '*a***b**',
    ]) {
      expect(joinInlineSeams(markdown)).toBe(markdown);
    }
  });

  it.each([
    '\\',
    '](',
    '`',
    '``a',
    '$$',
    '![x](https://x.org)',
    '\\$$',
    '<https:',
    '$\\a$',
    'https://a*',
    'https://a.co/\\<',
    '[https://a\\<',
    'www.a.*',
    'a.*b',
    '(*a*)',
    'x**(',
    'a**(x)**b ',
    'a*(b.)*c',
    'x*(.)*y',
    'a~~(y)~~z ',
    '**a *b.*c** ',
    'a*(**x**)*b',
    'a*(',
    '.)*b',
    '0*.*0',
    '/*Y, *d*/F*, ',
    '**1$x$**2 ',
    '**K****-step** ',
    '*a**b',
    '~~a~~~~b',
    '***a****b*',
    '**Table 1*.***',
    '**a *(b)***c ',
    'c***(b)* a**',
    '`a``b`',
    '`a``',
    '```a`',
    '``a`` `',
    '\\``a``b`',
    '\\```a``',
  ])('reads a long run of %j in time linear in it', async (run) => {
    await expectLinear((n) => run.repeat(n), joinInlineSeams, { from: 250, to: 64_000 });
  });

  it.each([
    (n: number) => `a*${'('.repeat(n)}x${')'.repeat(n)}*b`,
    (n: number) => `a*${'(. '.repeat(n)}*b`,
    (n: number) => `a*${'\\<'.repeat(n)}x*b`,
    (n: number) => `${'a*(x'.repeat(n)}${')*b'.repeat(n)}`,
    // Spans nested deep, then a span of each kind touching them.
    (n: number) => `${'**a*'.repeat(n)}x${'*'.repeat(3 * n)}*b*`,
    (n: number) => `${'x*'.repeat(n)}(y)${'*'.repeat(n)}z`,
    // A long fence nothing closes, before many short spans that touch.
    (n: number) => `${'`'.repeat(n)}a${'`b``c`'.repeat(n)}`,
    (n: number) => `${'`a'.repeat(n)}${'`'.repeat(n)}`,
  ])('reads a long punctuation edge in time linear in it: %#', async (input) => {
    await expectLinear(input, joinInlineSeams, { from: 250, to: 64_000 });
  });
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

  it('keeps TeX from opening a code span or ending its own delimiters', () => {
    // A backtick would open a code span in a renderer without math; `\\grave` is in both
    // KaTeX's and MathJax's lists.
    expect(inlineMath('a`b')).toBe('$a\\grave{}b$');
    expect(inlineMath('\\`{e} and \\\\`')).toBe('$\\grave {e} and \\\\\\grave{}$');
    // A trailing backslash would escape the closing dollar; a dollar would close early.
    expect(inlineMath('a\\')).toBe('$a\\ $');
    expect(inlineMath('a\\\\')).toBe('$a\\\\$');
    expect(inlineMath('\\text{$x$} \\$')).toBe('$\\text{\\$x\\$} \\$$');
    // Before a code span, each formula reads as its text, and the span as its code.
    for (const [tex, text] of [
      ['a`b', '$a\\grave{}b$ <img src=x>'],
      ['a\\', '$a\\ $ <img src=x>'],
      ['\\text{$x$}', '$\\text{$x$}$ <img src=x>'],
    ] as const) {
      const markdown = `${inlineMath(tex)} \`<img src=x>\``;
      expect(gfmMarkup(markdown)).toEqual([]);
      expect(gfmText(markdown)).toBe(text);
    }
  });

  it.each(['\\', '$', '`', '\\`', '\\$'])(
    'writes TeX holding a long run of %j in time linear in it',
    async (run) => {
      await expectLinear((n) => `a${run.repeat(n)}`, inlineMath, { from: 250, to: 64_000 });
    },
  );

  it('writes code in a span no backtick inside can close', () => {
    expect(inlineCode('make')).toBe('`make`');
    expect(inlineCode('a`b')).toBe('``a`b``');
    expect(inlineCode('')).toBe('');
  });
});
