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
import { gfmFindings, gfmMarkup, gfmText } from '../gfm.js';
import { expectLinear } from '../linear.js';
import { cases, failures, SEEDS, seeded, sourceText } from '../property.js';

describe('escapeInline', () => {
  it('always escapes emphasis, code, math, and strikethrough markers', () => {
    expect(escapeInline('a*b `c` $5 ~d')).toBe('a\\*b \\`c\\` \\$5 \\~d');
  });

  it('escapes an underscore only where it could delimit emphasis', () => {
    expect(escapeInline('snake_case and H_2O')).toBe('snake_case and H_2O');
    expect(escapeInline('_lead and trail_')).toBe('\\_lead and trail\\_');
  });

  it('escapes a single underscore beside punctuation or an edge', () => {
    expect(escapeInline('my_var_')).toBe('my_var\\_');
    expect(escapeInline('_x_')).toBe('\\_x\\_');
    expect(escapeInline('__')).toBe('\\_\\_');
  });

  it.each([
    ['__init__', '\\_\\_init\\_\\_'],
    ['call __init__ now', 'call \\_\\_init\\_\\_ now'],
    ['___x___', '\\_\\_\\_x\\_\\_\\_'],
    ['__main__.py', '\\_\\_main\\_\\_.py'],
    ['f(__x__)', 'f(\\_\\_x\\_\\_)'],
  ])('escapes every underscore of a run that could delimit emphasis: %j', (text, escaped) => {
    expect(escapeInline(text)).toBe(escaped);
    expect(gfmMarkup(escaped)).toEqual([]);
    expect(gfmText(escaped)).toBe(text);
  });

  it.each(['x__init__y', 'foo__bar__baz', '1__2__3', 'snake_case', 'H_2', 'a_b_c'])(
    'leaves an underscore run between letters or digits as written: %j',
    (text) => {
      expect(escapeInline(text)).toBe(text);
      expect(gfmMarkup(text)).toEqual([]);
    },
  );

  it.each([
    ['https://a.co/x<b>bold</b>', '<https://a.co/x>\\<b>bold\\</b>', ['link:https://a.co/x']],
    [
      'see https://example.org/view?id=12&doc=a_b_ now',
      'see <https://example.org/view?id=12&doc=a_b>\\_ now',
      ['link:https://example.org/view?id=12&doc=a_b'],
    ],
    [
      'https://ics.uci.edu/~yunanc/data.html',
      '<https://ics.uci.edu/~yunanc/data.html>',
      ['link:https://ics.uci.edu/~yunanc/data.html'],
    ],
    ['https://a.co/a*b*.', '<https://a.co/a*b>\\*.', ['link:https://a.co/a*b']],
    ['www.a.co/x<b>', '[www.a.co/x](http://www.a.co/x)\\<b>', ['link:http://www.a.co/x']],
    ['(www.a.co/a_b_)', '([www.a.co/a_b](http://www.a.co/a_b)\\_)', ['link:http://www.a.co/a_b']],
    // GFM gives back a `www.` URL's dot and links `www` alone.
    ['www._', '[www](http://www).\\_', ['link:http://www']],
    ['www.<b>', '[www](http://www).\\<b>', ['link:http://www']],
    // A bracket in a `www.` URL is escaped in the link's text, so the link's own enclose it.
    ['www.a.co/x]y_', '[www.a.co/x\\]y](http://www.a.co/x]y)\\_', ['link:http://www.a.co/x]y']],
    ['www.a.co/x[y_', '[www.a.co/x\\[y](http://www.a.co/x[y)\\_', ['link:http://www.a.co/x[y']],
  ])('writes a bare URL whose text it escapes as an autolink: %j', (text, escaped, markup) => {
    expect(escapeInline(text)).toBe(escaped);
    expect(gfmMarkup(escaped)).toEqual(markup);
    expect(gfmText(escaped)).toBe(text);
  });

  it('ends an autolink before a `>`, which it cannot hold, so the text reads as written', () => {
    expect(escapeInline('https://a.co/x>y*z')).toBe('<https://a.co/x>>y\\*z');
    expect(gfmMarkup(escapeInline('https://a.co/x>y*z'))).toEqual(['link:https://a.co/x']);
    expect(gfmText(escapeInline('https://a.co/x>y*z'))).toBe('https://a.co/x>y*z');
  });

  it('leaves a bare URL that needs no escape, and an email address, as written', () => {
    expect(escapeInline('see https://a.co/x_y now, www.a.co.')).toBe(
      'see https://a.co/x_y now, www.a.co.',
    );
    expect(escapeInline('me@x.org<b>')).toBe('me@x.org\\<b>');
    expect(gfmMarkup('me@x.org\\<b>')).toEqual(['link:mailto:me@x.org']);
    expect(escapeInline('ahttps://a.co/x<b>')).toBe('ahttps://a.co/x\\<b>');
    expect(gfmMarkup('ahttps://a.co/x\\<b>')).toEqual([]);
  });

  it.each(['https://a', 'www.a_.', 'https://a.co/(', 'https://a.co/x\\', '*https://a.co/<'])(
    'writes a long run of %j in time linear in it',
    async (run) => {
      await expectLinear((n) => run.repeat(n), escapeInline, { from: 250, to: 64_000 });
    },
  );

  it.each(['.', '.]', '&a', '_', ')'])(
    'reads a URL ending in a long run of %j in time linear in it',
    async (run) => {
      await expectLinear((n) => `https://a.co/${run.repeat(n)}x<`, escapeInline, {
        from: 250,
        to: 64_000,
      });
    },
  );

  it.each([
    // A source backslash before the URL would escape the autolink's `<`.
    ['\\https://a.co/x<b>', '\\\\<https://a.co/x>\\<b>', ['link:https://a.co/x']],
    // Escaping the domain's underscore would make a URL of text that holds none.
    ['https://a_.b<b>', 'https\\://a\\_.b\\<b>', []],
    ['www.a_.b<b>', 'www\\.a\\_.b\\<b>', []],
    // A backslash or a character reference in a `www.` destination stays as written.
    ['www.a.co\\<b>', '[www.a.co\\\\](http://www.a.co\\\\)\\<b>', ['link:http://www.a.co\\']],
    [
      'www.a.co&#64;b.org_',
      '[www.a.co\\&#64;b.org](http://www.a.co\\&#64;b.org)\\_',
      ['link:http://www.a.co&#64;b.org'],
    ],
  ])('links no URL the text does not hold: %j', (text, escaped, markup) => {
    expect(escapeInline(text)).toBe(escaped);
    expect(gfmMarkup(escaped)).toEqual(markup);
    expect(gfmText(escaped)).toBe(text);
  });

  it.each(['(https://a_.b', '(www.a_.b', '\\https://a.co/x*'])(
    'writes a long run of %j, each a URL only once escaped, in time linear in it',
    async (run) => {
      await expectLinear((n) => run.repeat(n), escapeInline, { from: 250, to: 64_000 });
    },
  );

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

  it('closes its end, where the text joined after it could complete a construct', () => {
    expect(escapeInline('a\\')).toBe('a\\\\');
    expect(escapeInline('a <')).toBe('a \\<');
    expect(escapeInline('wow!')).toBe('wow\\!');
    expect(escapeInline('&am')).toBe('\\&am');
    expect(escapeInline('&#6')).toBe('\\&#6');
    expect(escapeInline('R&')).toBe('R\\&');
    expect(escapeInline('a!b <c R&D x')).toBe('a!b \\<c R&D x');
  });

  it('escapes an entity named like an object property', () => {
    // cyanheads/openalex-mcp-server#76.
    const markdown = escapeInline('&constructor;');
    expect(markdown).toBe('\\&constructor;');
    expect(gfmText(markdown)).toBe('&constructor;');
  });

  it.each(SEEDS)('writes generated source text that GFM reads back as written, seed %i', (seed) => {
    const read = (text: string) => {
      const markdown = `x ${escapeInline(text)} x`;
      const problems = gfmFindings(markdown, { text });
      const shown = gfmText(markdown);
      return shown === `x ${text} x` ? problems : [...problems, `reads as ${shown}`];
    };
    expect(
      failures(
        cases(seeded(seed), 600, (random) => sourceText(random, 16)),
        read,
      ),
    ).toEqual([]);
  });

  it.each(['<!--', '<![CDATA[', '<?CDATA', '<span class="a ', '&', '&#', '&amp'])(
    'escapes a long run of the unclosed opener %j in time linear in it',
    async (run) => {
      await expectLinear((n) => run.repeat(n), escapeInline, { from: 250, to: 64_000 });
    },
  );

  it('escapes tag openers nested in each other in time linear in their depth', async () => {
    await expectLinear((n) => `${'<i'.repeat(n)}${'>'.repeat(n)}`, escapeInline, {
      from: 250,
      to: 64_000,
    });
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

  it('leaves a link whose text holds `]:` as a link: its label could not open a definition', () => {
    for (const markdown of [
      '[Note\\]: x](https://y.org)\\<b>',
      '[[1]: x](https://y.org)\\<b>',
      '[a [b]: c](https://y.org)\\<b>',
    ]) {
      expect(escapeBlockStart(markdown)).toBe(markdown);
      expect(gfmMarkup(markdown)).toEqual(['link:https://y.org']);
    }
    expect(escapeBlockStart('[a\\]b]: https://x.org')).toBe('\\[a\\]b]: https://x.org');
  });

  it.each([
    ['-', '\\-'],
    ['+', '\\+'],
    ['*', '\\*'],
    ['1.', '1\\.'],
    ['2)', '2\\)'],
    ['#', '\\#'],
    // Strikethrough nested in strikethrough would open a fenced code block.
    ['~~~~x~~~~ y', '\\~~~~x~~~~ y'],
  ])(
    'escapes a line of %j, which would open an empty list item, a heading, or a fence',
    (line, escaped) => {
      expect(escapeBlockStart(line)).toBe(escaped);
      expect(gfmText(escaped)).toBe(line);
    },
  );

  it('leaves ordinary text alone', () => {
    expect(escapeBlockStart('#hashtag, -5 degrees, 2024.')).toBe('#hashtag, -5 degrees, 2024.');
  });
});

describe('escapeTableCell', () => {
  it('escapes pipes and folds line breaks into spaces', () => {
    expect(escapeTableCell('a | b\n  c')).toBe('a \\| b c');
  });

  it('folds line breaks in one pass over a long run of spaces', async () => {
    const spaces = ' '.repeat(100_000);
    expect(escapeTableCell(`a${spaces}b\n c`)).toBe(`a${spaces}b c`);
    await expectLinear((n) => `a${' '.repeat(n)}b\n c`, escapeTableCell, {
      from: 1_000,
      to: 64_000,
    });
  });
});

describe('code spans', () => {
  it('fences with more backticks than any run inside', () => {
    expect(codeFence('plain')).toBe('```');
    expect(codeFence('has ```` four')).toBe('`````');
    expect(codeSpan('a`b')).toBe('``a`b``');
    expect(codeSpan('`edge`')).toBe('`` `edge` ``');
  });

  it('fences text holding hundreds of thousands of backtick runs', () => {
    expect(codeFence(`${'`a'.repeat(500_000)}\`\`\`\``)).toBe('`````');
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

  it('keeps a destination as written: a backslash, a character reference, a backtick', () => {
    expect(escapeUrl('https://a.co/x\\')).toBe('https://a.co/x\\\\');
    expect(escapeUrl('https://a.co/\\_x\\y')).toBe('https://a.co/\\\\_x\\y');
    expect(escapeUrl('https://a.co&#64;b.org/?a=1&b=2')).toBe('https://a.co\\&#64;b.org/?a=1&b=2');
    expect(escapeUrl('https://a.co/`x')).toBe('https://a.co/%60x');
    // A dollar sign is escaped: an inline-math reading must not open in a destination.
    expect(escapeUrl('https://a.co/$x\\$')).toBe('https://a.co/\\$x\\\\\\$');
    expect(gfmMarkup(`[t](${escapeUrl('https://a.co/$x\\$')})`)).toEqual([
      'link:https://a.co/$x\\$',
    ]);
    for (const url of ['https://a.co/x\\', 'https://a.co&#64;b.org/?a=1&b=2']) {
      expect(gfmMarkup(`[t](${escapeUrl(url)})\\<b>`)).toEqual([`link:${url}`]);
    }
    expect(gfmMarkup(`[t](${escapeUrl('https://a.co/`')}) \`<b>\``)).toEqual([
      'link:https://a.co/%60',
    ]);
  });
});
