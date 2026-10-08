/**
 * @fileoverview `jatsInlineToMarkdown`: a JATS fragment with no article around it — a
 * Crossref abstract with its `jats:` prefix, a Europe PMC snippet — as Markdown, and
 * input that is not well-formed XML as escaped text.
 * @module tests/formats/jats/fragment.test
 */
import { describe, expect, it } from 'vitest';
import { jatsInlineToMarkdown } from '../../../src/formats/jats/index.js';
import { isSafeUrl } from '../../../src/render/escape.js';
import { stripInline } from '../../../src/render/text.js';
import { gfmFindings, gfmMarkup, gfmSpans, gfmText } from '../../gfm.js';
import { expectLinear } from '../../linear.js';
import { cases, failures, type Random, SEEDS, seeded, sourceText } from '../../property.js';
import { texMath } from './helpers.js';

describe('jatsInlineToMarkdown', () => {
  it('reads a Crossref abstract with its jats: prefix, paragraphs apart', () => {
    expect(
      jatsInlineToMarkdown(
        '<jats:title>Abstract</jats:title><jats:p>Candidates include ' +
          '<jats:italic>NF1</jats:italic> and <jats:italic>MED12</jats:italic> &amp; ' +
          'CO<jats:sub>2</jats:sub>.</jats:p><jats:p>Second paragraph.</jats:p>',
      ),
    ).toBe('**Abstract**\n\nCandidates include *NF1* and *MED12* & CO_2.\n\nSecond paragraph.');
  });

  it('keeps the parts of a taxonomic name separate words', () => {
    // Pensoft sets genus and species with nothing between them.
    expect(
      jatsInlineToMarkdown(
        '<p><italic><named-content content-type="taxon-name"><named-content content-type="genus">V.</named-content>' +
          '<named-content content-type="species">punctata</named-content></named-content></italic> sp. nov.</p>',
      ),
    ).toBe('*V. punctata* sp. nov.');
  });

  it('leaves out an institution registry ID beside the name it identifies', () => {
    expect(
      jatsInlineToMarkdown(
        '<p>Funded by <institution-wrap><institution-id institution-id-type="FundRef">' +
          'http://dx.doi.org/10.13039/100000057</institution-id><institution>NIGMS</institution>' +
          '</institution-wrap>.</p>',
      ),
    ).toBe('Funded by NIGMS.');
  });

  it('keeps structured-abstract headings apart from their text', () => {
    expect(
      jatsInlineToMarkdown(
        '<sec><title>Background</title><p>Why.</p></sec><sec><title>Methods</title><p>How.</p></sec>',
      ),
    ).toBe('**Background**\n\nWhy.\n\n**Methods**\n\nHow.');
  });

  it('reads an inline formula without its LaTeX preamble (#135)', () => {
    expect(
      jatsInlineToMarkdown(
        `<p>We bound <inline-formula>${texMath('$$Q$$')}</inline-formula> from below.</p>`,
      ),
    ).toBe('We bound $Q$ from below.');
  });

  it('keeps a list in the fragment as a list', () => {
    expect(
      jatsInlineToMarkdown(
        '<p>Findings:</p><list list-type="bullet"><list-item><p>One.</p></list-item>' +
          '<list-item><p>Two.</p></list-item></list>',
      ),
    ).toBe('Findings:\n\n- One.\n- Two.');
  });

  it('escapes plain text so it cannot read as Markdown it never was', () => {
    expect(jatsInlineToMarkdown('Plain *text*, 1. not a list, &lt;b&gt;')).toBe(
      'Plain \\*text\\*, 1. not a list, \\<b>',
    );
    expect(jatsInlineToMarkdown('<p># Not a heading</p><p>1. Not a list</p>')).toBe(
      '\\# Not a heading\n\n1\\. Not a list',
    );
  });

  it.each([
    ['https://a.co/x&lt;b&gt;bold&lt;/b&gt;', '<https://a.co/x>\\<b>bold\\</b>'],
    [
      'see https://example.org/view?id=12&amp;doc=a_b_ now',
      'see <https://example.org/view?id=12&doc=a_b>\\_ now',
    ],
    ['https://ics.uci.edu/~yunanc/x.html', '<https://ics.uci.edu/~yunanc/x.html>'],
    ['https://a.co/x<italic>&lt;b&gt;bold</italic> end', '<https://a.co/x>*\\<b>bold* end'],
    ['www.a.co/x&lt;b&gt;', '[www.a.co/x](http://www.a.co/x)\\<b>'],
    ['me@x.org&lt;b&gt;', 'me@x.org\\<b>'],
    [
      '<ext-link xlink:href="https://y.org">https://a.co/x&lt;b&gt;</ext-link>',
      '[https://a.co/x\\<b>](https://y.org)',
    ],
    // The `](` the seam pass escapes across two text nodes.
    ['https://a.co/x]<![CDATA[(y]]>', '<https://a.co/x>\\](y'],
  ])('keeps a bare URL from taking in the escape after it: %j', (inner, markdown) => {
    const rendered = jatsInlineToMarkdown(`<p>${inner}</p>`);
    expect(rendered).toBe(markdown);
    expect(gfmMarkup(rendered).filter((m) => m.startsWith('html:') || m.includes('\\'))).toEqual(
      [],
    );
    expect(stripInline(rendered)).toBe(gfmText(rendered));
  });

  it('keeps emphasis whose edge is punctuation touching a word working', () => {
    const rendered = jatsInlineToMarkdown(
      '<p><italic>Rules that contain constraints.</italic>We observe it.</p><p>a<bold>(x)</bold>b</p>',
    );
    expect(rendered).toBe('*Rules that contain constraints*.We observe it.\n\na(**x**)b');
    expect(gfmSpans(rendered)).toEqual(['emphasis:Rules that contain constraints', 'strong:x']);
    expect(gfmText(rendered)).toBe('Rules that contain constraints.We observe it.\na(x)b');
    const [first, second] = rendered.split('\n\n');
    expect(stripInline(first ?? '')).toBe('Rules that contain constraints.We observe it.');
    expect(stripInline(second ?? '')).toBe('a(x)b');
  });

  it.each([
    // A backtick in TeX would open a code span that closes inside the code after it.
    [
      '<inline-formula><tex-math>a`b</tex-math></inline-formula> and <monospace>x&lt;img src=x&gt;</monospace> end',
      '$a\\grave{}b$ and `x<img src=x>` end',
    ],
    // A trailing backslash would escape the closing dollar, and a dollar would close early.
    [
      '<inline-formula><tex-math>a\\</tex-math></inline-formula> b <inline-formula><tex-math>\\text{$c$}</tex-math></inline-formula> &lt;img src=x&gt;',
      '$a\\ $ b $\\text{\\$c\\$}$ \\<img src=x>',
    ],
    // A `$` in a nested link's destination would pair with a formula's, hiding the link.
    [
      '<ext-link xlink:href="https://z.org">a <ext-link xlink:href="http://a.co/$">b</ext-link> <inline-formula><tex-math>y</tex-math></inline-formula></ext-link>&lt;img src=x&gt;',
      '[a b $y$](https://z.org)\\<img src=x>',
    ],
    // Touching code spans would fuse their fences.
    ['<monospace>a</monospace><monospace>`&lt;img src=x&gt;</monospace>', '``a`<img src=x>``'],
  ])('keeps math and code from turning the text after them into HTML: %j', (inner, markdown) => {
    const rendered = jatsInlineToMarkdown(`<p>${inner}</p>`);
    expect(rendered).toBe(markdown);
    expect(gfmMarkup(rendered).filter((m) => !m.startsWith('link:https://z.org'))).toEqual([]);
  });

  it('writes touching spans of one kind as one span', () => {
    const rendered = jatsInlineToMarkdown(
      '<p><bold>K</bold><bold>-step</bold>: x and <bold>Table 1<italic>.</italic></bold></p>',
    );
    expect(rendered).toBe('**K-step**: x and **Table 1.**');
    expect(gfmSpans(rendered)).toEqual(['strong:K-step', 'strong:Table 1.']);
    expect(stripInline(rendered)).toBe('K-step: x and Table 1.');
    expect(gfmText(rendered)).toBe(stripInline(rendered));
  });

  it('returns input that is not well-formed as escaped text with the tags removed', () => {
    expect(jatsInlineToMarkdown('<p>Significant at p < 0.05 in <b>all</b> *arms*.</p>')).toBe(
      'Significant at p < 0.05 in all \\*arms\\*.',
    );
  });

  it('reads an identifier whose type is named like an object property', () => {
    for (const type of ['constructor', 'toString', '__proto__'])
      expect(
        jatsInlineToMarkdown(
          `<mixed-citation>A. <pub-id pub-id-type="${type}">10.1/x</pub-id></mixed-citation>`,
        ),
      ).toBe('A. 10.1/x');
  });

  it('returns an empty string for an empty fragment', () => {
    expect(jatsInlineToMarkdown('')).toBe('');
  });

  it.each([
    // cyanheads/pubmed-mcp-server#211: emphasis inside a script is plain text.
    ['<sup>-/<italic>y</italic></sup>', '^{-/y}'],
    ['V<sub><italic>max</italic></sub>', 'V_{max}'],
    // cyanheads/openalex-mcp-server#76: a decoded `&lt;` stays text, not a second entity.
    ['&amp;lt;', '\\&lt;'],
  ])('writes %j as %j', (inner, markdown) => {
    const rendered = jatsInlineToMarkdown(`<p>${inner}</p>`);
    expect(rendered).toBe(markdown);
    expect(gfmText(rendered)).toBe(markdown.replace(/\\/g, ''));
    expect(gfmFindings(rendered, { text: markdown })).toEqual([]);
  });

  it('keeps a script that ends in a backslash before whitespace from escaping what follows', () => {
    for (const [inner, markdown] of [
      ['x<sup>\\ </sup>&lt;b&gt;', 'x^\\\\\\<b>'],
      ['x<sub>a\\ </sub>&lt;b&gt;', 'x_{a\\\\}\\<b>'],
    ]) {
      const rendered = jatsInlineToMarkdown(`<p>${inner}</p>`);
      expect(rendered).toBe(markdown);
      expect(gfmFindings(rendered, { text: rendered })).toEqual([]);
    }
  });

  it.each([
    '<ext-link xlink:href="https://y.org"><monospace>]:</monospace></ext-link>&lt;b&gt;',
    '<ext-link xlink:href="https://y.org"><ext-link xlink:href="https://y.org">http://x&lt;x&gt;</ext-link><monospace>]:</monospace></ext-link>',
  ])('reads the text of a link whose [ would open a definition as running text: %j', (inner) => {
    const rendered = jatsInlineToMarkdown(`<p>${inner}</p>`);
    expect(gfmMarkup(rendered).filter((markup) => markup.startsWith('html'))).toEqual([]);
  });

  it('writes the target of a link with no text inside a sub- or superscript', () => {
    const rendered = jatsInlineToMarkdown(
      '<p>a<sub><ext-link xlink:href="https://y.org"/></sub> b<sup>x<uri xlink:href="www.q.org"></uri></sup> ' +
        'c<sup><italic><ext-link xlink:href="javascript:alert(1)"><!--none--></ext-link></italic></sup></p>',
    );
    expect(rendered).toBe('a_{<https://y.org>} b^{xwww.q.org} c^{javascript:alert(1)}');
    expect(gfmText(rendered)).toBe('a_{https://y.org} b^{xwww.q.org} c^{javascript:alert(1)}');
    expect(
      gfmFindings(rendered, { hrefs: ['https://y.org', 'www.q.org'], text: rendered }),
    ).toEqual([]);
  });

  it('writes the target of a link whose only content is a block that renders nothing', () => {
    expect(
      jatsInlineToMarkdown(
        '<p>a <ext-link xlink:href="javascript:alert(1)"><title><?xm ab?></title></ext-link> b</p>',
      ),
    ).toBe('a\n\njavascript:alert(1) b');
    expect(
      jatsInlineToMarkdown('<p>a <ext-link xlink:href="https://y.org"><p/></ext-link> b</p>'),
    ).toBe('a\n\n<https://y.org> b');
  });

  it('reads the TeX in an IOP <?CDATA …?> instruction as the formula', () => {
    expect(
      jatsInlineToMarkdown(
        '<jats:p>sodium blueshifted by <jats:inline-formula><jats:tex-math><?CDATA $(8\\pm 2)$?>' +
          '</jats:tex-math><?MML <mml:math><mml:mn>8</mml:mn></mml:math>?>' +
          '<jats:inline-graphic xlink:href="apj522286ieqn4.gif"/></jats:inline-formula> ' +
          'km s<jats:sup>−1</jats:sup></jats:p>',
      ),
    ).toBe('sodium blueshifted by $(8\\pm 2)$ km s^{−1}');
  });
});

describe('touching citation links', () => {
  const bibr = (n: string) => `<xref ref-type="bibr" rid="r${n}">${n}</xref>`;

  it('separates touching citation numbers with a comma, in brackets or a superscript', () => {
    expect(
      jatsInlineToMarkdown(
        `<p>Known [${bibr('1')}${bibr('2')}${bibr('3')}].</p>` +
          `<p>Sup<sup>${bibr('1')}${bibr('2')}</sup> text.</p>`,
      ),
    ).toBe('Known [1,2,3].\n\nSup[1,2] text.');
    expect(jatsInlineToMarkdown(`<p>In <italic>vivo</italic> [${bibr('4')}${bibr('5')}]</p>`)).toBe(
      'In *vivo* [4,5]',
    );
  });

  it('separates superscript citation links that sit apart only by whitespace', () => {
    const one = '<xref ref-type="bibr" rid="r1">1 </xref>';
    expect(
      jatsInlineToMarkdown(
        `<p>A<sup>${bibr('1')} ${bibr('2')}</sup> B<sup>\n  ${bibr('3')}\n  ${bibr('4')}\n</sup> ` +
          `C<sup>${one}${bibr('2')}</sup></p>`,
      ),
    ).toBe('A[1,2] B[3,4] C[1,2]');
  });

  it('separates numbers with letters in them by a comma', () => {
    expect(
      jatsInlineToMarkdown(`<p>[${bibr('1a')}${bibr('1b')}] [${bibr('S1')}${bibr('2')}]</p>`),
    ).toBe('[1a,1b] [S1,2]');
  });

  it('separates touching author-year citations as the source lists them, by a semicolon', () => {
    const cite = (content: string) => `<xref ref-type="bibr" rid="r">${content}</xref>`;
    expect(
      jatsInlineToMarkdown(
        `<p>(${cite('Smith 2008')}${cite('Jones 2010')}) ` +
          `(${cite('Smith 2008')}${cite('<italic>Jones</italic> 2010')}${cite('<bold>3</bold>')}) ` +
          `[${bibr('1')}${cite('Lee 2001')}]</p>`,
      ),
    ).toBe('(Smith 2008; Jones 2010) (Smith 2008; *Jones* 2010; **3**) [1; Lee 2001]');
  });

  it('separates citation links that an anchor with no text sits between', () => {
    expect(
      jatsInlineToMarkdown(
        `<p>[${bibr('1')}<target id="t1"/>${bibr('2')}] ` +
          `x<sup>${bibr('3')}<target id="t2"/>${bibr('4')}</sup> ` +
          `<named-content content-type="genus">Vittiblatta</named-content><target id="t3"/>` +
          '<named-content content-type="species">punctata</named-content></p>',
      ),
    ).toBe('[1,2] x[3,4] Vittiblatta punctata');
  });

  it('adds no comma where the link text already ends or starts with a space', () => {
    expect(
      jatsInlineToMarkdown(
        `<p>[<xref ref-type="bibr" rid="r1">1 </xref>${bibr('2')}] ` +
          `[${bibr('3')}<xref ref-type="bibr" rid="r4"> 4</xref>]</p>`,
      ),
    ).toBe('[1 2] [3 4]');
  });

  it('leaves citations the source separates, and touching non-citation links, as written', () => {
    expect(
      jatsInlineToMarkdown(
        `<p>[${bibr('1')}, ${bibr('2')}] [${bibr('1')}–${bibr('4')}] ` +
          '(<xref ref-type="bibr">Smith et al., 2008</xref>; <xref ref-type="bibr">Jones, 2010</xref>) ' +
          'a<xref ref-type="bibr"><sup>1</sup></xref><xref ref-type="bibr"><sup>2</sup></xref> ' +
          'Fig <xref ref-type="fig">1A</xref><xref ref-type="fig">B</xref></p>',
      ),
    ).toBe('[1, 2] [1–4] (Smith et al., 2008; Jones, 2010) a[1][2] Fig 1AB');
  });

  it('keeps the parts of a taxonomic name set straight in a paragraph separate words', () => {
    expect(
      jatsInlineToMarkdown(
        '<p><named-content content-type="genus">Vittiblatta</named-content>' +
          '<named-content content-type="species">punctata</named-content></p>',
      ),
    ).toBe('Vittiblatta punctata');
  });
});

/** The markup the rows below write: known tags, and comment and CDATA delimiters. */
const KNOWN_MARKUP =
  /<!--[\w:-]+>|<!--|-->|<!\[CDATA\[|\]\]>|<\/?(?:h[1-6]|br|p|sec|b|i|mml:[a-z]+)(?:\s[^>]*)?\/?>/g;

describe('fragments that are not clean JATS', () => {
  it.each([
    [
      'relative intensity <or= 20 or > 20), identified',
      'relative intensity \\<or= 20 or > 20), identified',
    ],
    ['Fish <Actinopterygii> taxonomy', 'Fish \\<Actinopterygii> taxonomy'],
    ['x<y and y>z', 'x\\<y and y>z'],
    ['A<!--inline-formula> <![CDATA[x]]> B ---> C', 'A x B ---> C'],
    ['<h4>Objective</h4>Large language models were', '**Objective**\n\nLarge language models were'],
    ['Second.<br/>Third.', 'Second. Third.'],
    ['<h1>One</h1><p>a</p><h6>Six</h6>b', '**One**\n\na\n\n**Six**\n\nb'],
    ['<sec><h5>Head</h5><p>Text.<br/>More.</p></sec>', '**Head**\n\nText. More.'],
    ['<mml:math><mml:mi>x</mml:mi></mml:math> <Abc> and P<0.01', 'x \\<Abc> and P<0.01'],
    ['1<or= 2b/>x', '1\\<or= 2b/>x'],
    ['x<!y> and z', 'x\\<!y> and z'],
    ['a <__b:c//> d', 'a <\\_\\_b:c//> d'],
    [
      'A <b class="x">bold</b> <i/> and <time to event> p<0.05',
      'A bold and \\<time to event> p<0.05',
    ],
  ])('keeps the text of %j', (fragment, markdown) => {
    const rendered = jatsInlineToMarkdown(fragment);
    expect(rendered).toBe(markdown);
    // A heading is written bold.
    expect(gfmFindings(rendered, { markers: '*', text: fragment })).toEqual([]);
    const text = fragment.replace(KNOWN_MARKUP, ' ');
    expect(keptInOrder(letters(text), letters(gfmText(rendered))), text).toBe(true);
  });

  it.each([
    ['1. Fish <Actinopterygii> taxonomy', '1\\. Fish \\<Actinopterygii> taxonomy'],
    ['21) p<0.05 in <b>all</b>', '21\\) p<0.05 in all'],
    ['# p < 0.05 <i>x</i>', '\\# p < 0.05 x'],
    ['> p<0.05 at baseline', '\\> p<0.05 at baseline'],
  ])('keeps the text of %j from opening a block', (fragment, markdown) => {
    const rendered = jatsInlineToMarkdown(fragment);
    expect(rendered).toBe(markdown);
    expect(gfmText(rendered)).toBe(stripInline(rendered));
    expect(gfmFindings(rendered, { text: fragment })).toEqual([]);
  });

  it.each([
    ['See <https://example.org/> for data', 'See \\<https://example.org/> for data'],
    [
      '<p>See <http://a.co/> or <mailto:a@b.org> here</p>',
      'See \\<http://a.co/> or \\<mailto:a@b.org> here',
    ],
    ['a <time to event/> b', 'a \\<time to event/> b'],
  ])(
    'keeps a tag shape whose attributes are not name="value" pairs as text: %j',
    (fragment, markdown) => {
      const rendered = jatsInlineToMarkdown(fragment);
      expect(rendered).toBe(markdown);
      expect(gfmText(rendered)).toBe(fragment.replace(/<\/?p>/g, ''));
    },
  );

  it.each([
    ['p<0.05 and q>1', 'p<0.05 and q>1'],
    ['-0.45; P<0.001). <b>Conclusions</b> text', '-0.45; P<0.001). Conclusions text'],
    ['A <!-- note --> B', 'A B'],
    ['<jats:p>One <jats:italic>x</jats:italic>.</jats:p>', 'One *x*.'],
    ['Second.<br>Third.', 'Second. Third.'],
    ['<h4>Aim</h4>p < 0.05<br>end', 'Aim p < 0.05 end'],
    ['P<0.05 in <I>vivo</I> at 10<SUP>3</SUP><BR>', 'P<0.05 in vivo at 10 3'],
    ['p < 1 <a href="x" title=\'y\'>link</a> <b class=a>B</b>', 'p < 1 link B'],
  ])('reads %j as before', (fragment, markdown) => {
    expect(jatsInlineToMarkdown(fragment)).toBe(markdown);
  });

  it.each([
    ['p < 1 <a href="x>y">link</a>', 'p < 1 link'],
    ["p < 1 <ext-link xlink:href='a>b' title=\"c'>d\">two</ext-link>", 'p < 1 two'],
    ['p < 1 <a title="x>y<z">t</a>', 'p < 1 \\<a title="x>y\\<z">t'],
  ])('reads a > inside a quoted attribute value of %j as part of the tag', (fragment, markdown) => {
    expect(jatsInlineToMarkdown(fragment)).toBe(markdown);
  });

  it.each([
    ['< and a run of letters', (n: number) => `<${'a'.repeat(n)}`],
    ['an unclosed comment', (n: number) => `<!--${'a'.repeat(n)}`],
    ['repeated comment openers', (n: number) => '<!--b'.repeat(n)],
    ['repeated tag openers', (n: number) => '<a '.repeat(n)],
    ['tag openers each before a long run', (n: number) => `<b ${'x'.repeat(n)}<i ${'y'.repeat(n)}`],
    ['a tag whose attributes never close', (n: number) => `<b${' x=y'.repeat(n)}`],
    ['nested quoted attribute openers', (n: number) => `<b x="${'<b x="'.repeat(n)}`],
    ['nested comment and tag openers', (n: number) => '<!--<i'.repeat(n)],
    ['quoted attribute values never closed', (n: number) => `p<1 ${'<a x="'.repeat(n)}`],
    ['a quoted value full of >', (n: number) => `p<1 <a x="${'>'.repeat(n)}`],
    ['an unclosed CDATA section', (n: number) => `<![CDATA[${'a'.repeat(n)}`],
    ['repeated CDATA openers', (n: number) => '<![CDATA['.repeat(n)],
    ['repeated IOP CDATA instructions never closed', (n: number) => '<?CDATA '.repeat(n)],
    ['repeated span openers with an open attribute', (n: number) => '<span class="a '.repeat(n)],
    ['a run of ampersands', (n: number) => '&'.repeat(n)],
    ['tag openers nested in each other', (n: number) => `${'<i'.repeat(n)}${'>'.repeat(n)}`],
    ['a start tag with many attributes', (n: number) => `<b${' x="y"'.repeat(n)} z>`],
    ['comments before a malformed tag', (n: number) => `${'<!--x-->'.repeat(n)}<a b>`],
    [
      'tags whose values hold > and quotes',
      (n: number) => `p<1 ${'<a x="\'>" y=\'">\'>'.repeat(n)}`,
    ],
  ])('reads %s in linear time', async (_, input) => {
    await expectLinear(input, jatsInlineToMarkdown, { from: 1_000, to: 64_000 });
  });
});

/** A generated JATS fragment, and what its source holds. */
interface Fragment {
  /** Link targets the fragment names. */
  hrefs: string[];
  /** True when its text is written into the XML as it is, unescaped: often not well-formed. */
  raw: boolean;
  /** Every character a reader may see: {@link Fragment.text} and each unsafe link's target. */
  seen: string;
  /** The character of a subscript that holds one, which the renderer writes after a `_`. */
  subscript?: string;
  /** Every character outside markup, as a reader should see it. */
  text: string;
  xml: string;
}

const FRAGMENT_URLS = ['https://y.org', 'https://y.org/a_b', 'www.q.org', 'javascript:alert(1)'];

/** Text that only looks like markup, for a fragment written raw (#61). */
const NOT_MARKUP = [
  '<Actinopterygii>',
  '<or= 2',
  'p<0.05',
  '<time to event>',
  'R&D',
  '&constructor;',
];

const xmlEscape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * One to four pieces of a JATS fragment — text, emphasis, code, a sub- or superscript, a
 * link, a comment, a processing instruction, a CDATA section, a heading, or text that only
 * looks like markup — nested up to three deep. At most one subscript is generated per
 * fragment: two can pair as emphasis (#77).
 */
function fragment(random: Random, raw: boolean): Fragment {
  /** The subscript's one character, or '' once a subscript of more is generated. */
  let subscript: string | undefined;
  // Raw text is read back by {@link rawText}, so text the XML holds as written is escaped.
  const literal = (text: string) => (raw ? xmlEscape(text) : text);
  const pieces = (depth: number): Fragment => {
    const out: Fragment = { hrefs: [], raw, seen: '', text: '', xml: '' };
    const add = ({
      hrefs,
      seen,
      text,
      xml,
    }: Omit<Fragment, 'raw' | 'seen'> & { seen?: string }) => {
      out.hrefs.push(...hrefs);
      out.seen += seen ?? text;
      out.text += text;
      out.xml += xml;
    };
    const wrap = (open: string, close: string) => {
      const inner = pieces(depth + 1);
      add({ ...inner, xml: open + inner.xml + close });
    };
    for (let n = 1 + random.int(4); n > 0; n--) {
      const kind = depth > 2 ? 0 : random.int(13);
      if (kind === 1) wrap('<italic>', '</italic>');
      else if (kind === 2) wrap('<bold>', '</bold>');
      else if (kind === 3) {
        const code = sourceText(random, 4);
        // Code reads with its whitespace collapsed, and blank code reads as nothing.
        const text = literal(code.replace(/\s+/g, ' ').trim());
        add({ hrefs: [], text, xml: `<monospace>${xmlEscape(code)}</monospace>` });
      } else if (kind === 4 && subscript === undefined) {
        subscript = '';
        const inner = pieces(depth + 1);
        const [only, more] = [...(raw ? rawText(inner.text) : inner.text).trim()];
        if (more === undefined) subscript = only ?? '';
        add({ ...inner, xml: `<sub>${inner.xml}</sub>` });
      } else if (kind === 5) wrap('<sup>', '</sup>');
      else if (kind === 6) {
        const url = random.pick(FRAGMENT_URLS);
        const inner = pieces(depth + 1);
        /*
         * A link with no text writes its target: an unsafe one as text, a safe one as an
         * autolink. Written raw, the fragment may not parse, and the fallback keeps no
         * attribute.
         */
        const shown = (isSafeUrl(url) ? inner.seen.trim() : inner.seen) ? inner.seen : url;
        add({
          hrefs: [...inner.hrefs, url],
          seen: shown,
          text: raw ? inner.text : shown,
          xml: `<ext-link xlink:href="${xmlEscape(url)}">${inner.xml}</ext-link>`,
        });
      } else if (kind === 7) {
        const xml = `<!--${random.pick(['note', ' x ', 'inline-formula'])}-->`;
        add({ hrefs: [], text: '', xml });
      } else if (kind === 8) {
        // IOP's `<?CDATA …?>` stands for a CDATA section; any other instruction says nothing.
        const [target, content] = [random.pick(['xm', 'CDATA']), random.pick(['ab', 'z'])];
        add({
          hrefs: [],
          text: target === 'CDATA' ? content : '',
          xml: `<?${target} ${content}?>`,
        });
      } else if (kind === 9) {
        const text = sourceText(random, 4);
        add({ hrefs: [], text: literal(text), xml: `<![CDATA[${text}]]>` });
      } else if (kind === 10) {
        const tag = random.pick(['h4', 'p', 'title']);
        // Written raw, a heading is sometimes left open.
        wrap(`<${tag}>`, raw && random.chance(0.5) ? '' : `</${tag}>`);
      } else if (kind === 11 && raw) {
        const text = random.pick(NOT_MARKUP);
        add({ hrefs: [], text, xml: text });
      } else {
        const text = sourceText(random, 6);
        add({ hrefs: [], text, xml: raw ? text : xmlEscape(text) });
      }
    }
    return out;
  };
  const generated = pieces(0);
  return subscript ? { ...generated, subscript } : generated;
}

/** Letters and digits only. */
const letters = (text: string) => text.replace(/[^\p{L}\p{N}]/gu, '');

/** True when `wanted`'s characters all appear in `kept`, in order. */
function keptInOrder(wanted: string, kept: string): boolean {
  let at = 0;
  for (const char of kept) if (char === wanted[at]) at++;
  return at === wanted.length;
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};

/**
 * The text a raw fragment's reader should see: each tag shape the fallback removes (a known
 * name with nothing or `/` after it) left out (#61), in code and CDATA sections too, which
 * the fallback reads as text, then its entities decoded. The pieces spell tag names only
 * from the alphabet's letters, so `a`, `b`, and `x` are the known ones.
 */
function rawText(text: string): string {
  return text
    .replace(/(?:<|&lt;)\/?[abx]\s*\/?\s*(?:>|&gt;)/g, '')
    .replace(/&(amp|apos|gt|lt|quot);/g, (_, name: string) => ENTITIES[name] ?? '');
}

/**
 * True for a finding outside what the escaping bounds. A link a bare URL forms by running
 * into a sub- or superscript's notation (`https://a.co/x^{2}`), which `docs/design.md` names:
 * its destination holds the notation's start. And emphasis a subscript's `_` opens (#77):
 * its text starts with the subscript. The source never spells `^` or `{`, so either is the
 * renderer's; a one-character subscript is told by its character after a `_`.
 */
function outsideBound(finding: string, markdown: string, { subscript }: Fragment): boolean {
  const [kind = '', text = ''] = finding.split(/:(.*)/s);
  const opensScript = (from: string) =>
    from.startsWith('{') ||
    (!!subscript &&
      from.startsWith(subscript) &&
      (markdown.includes(`_${subscript}`) || markdown.includes(`_\\${subscript}`)));
  if (kind === 'link') return /[\^{]/.test(text) || (!!subscript && text.includes(`_${subscript}`));
  return (kind === 'emphasis' || kind === 'strong') && opensScript(text);
}

describe('jatsInlineToMarkdown on generated fragments', () => {
  it.each(SEEDS)(
    'keeps every letter outside markup, and writes no markup the source lacks, seed %i',
    (seed) => {
      const check = (source: Fragment) => {
        const markdown = jatsInlineToMarkdown(`<p>${source.xml}</p>`);
        const text = source.raw ? rawText(source.text) : source.text;
        const kept = letters(gfmText(markdown));
        const problems = gfmFindings(
          markdown,
          {
            hrefs: source.hrefs,
            markers: '*~',
            text: source.raw ? `${source.xml} ${source.seen} ${rawText(source.seen)}` : text,
          },
          { textPassLinks: false },
        ).filter((finding) => !outsideBound(finding, markdown, source));
        if (!keptInOrder(letters(text), kept))
          problems.push(`${JSON.stringify(markdown)} keeps ${kept} of ${letters(text)}`);
        return problems;
      };
      const generate = (random: Random) => fragment(random, random.chance(0.4));
      expect(failures(cases(seeded(seed), 400, generate), check)).toEqual([]);
    },
  );
});
