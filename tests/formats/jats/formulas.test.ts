/**
 * @fileoverview JATS formulas and inline markup: `<tex-math>` reduced to its
 * expression (no LaTeX preamble), exactly one rendering read from `<alternatives>`,
 * MathML converted to TeX, display formulas as `FormulaBlock`s at block position, and
 * the inline Markdown for emphasis, scripts, citation markers, links, and escaping.
 * Issue numbers refer to cyanheads/pubmed-mcp-server.
 * @module tests/formats/jats/formulas.test
 */
import { describe, expect, it } from 'vitest';
import { toMarkdown } from '../../../src/index.js';
import {
  blocksOfType,
  paragraphTexts,
  parse,
  parseArticle,
  parseBody,
  texDocument,
  texMath,
} from './helpers.js';

/** The paragraph text a `<p>` holding `content` yields inside a titled section. */
function paragraphOf(content: string): string {
  const texts = paragraphTexts(parseBody(`<sec><title>Methods</title><p>${content}</p></sec>`));
  expect(texts).toHaveLength(1);
  return texts[0] ?? '';
}

/** The blocks of the one section in a body holding `content`. */
const sectionOf = (content: string) =>
  parseBody(`<sec><title>Model</title>${content}</sec>`).body[0]?.blocks;

const PREAMBLE_MARKERS = ['documentclass', 'usepackage', 'begin{document}', 'oddsidemargin'];

describe('tex-math preambles and <alternatives> (#135)', () => {
  it('reads a bare inline <tex-math> in place without its preamble', () => {
    // PMC12855809: 310 bare inline formulae, each wrapped in a LaTeX document.
    const text = paragraphOf(
      `Operations run over <inline-formula id="IEq1">${texMath('$$\\mathbb {F}_q$$')}` +
        '</inline-formula> throughout.',
    );
    expect(text).toBe('Operations run over $\\mathbb {F}_q$ throughout.');
  });

  it('reads an <alternatives>-wrapped inline formula once, from its <tex-math>', () => {
    const text = paragraphOf(
      'Reducing threshold RH <inline-formula id="IEq1"><alternatives>' +
        `${texMath('$$\\eta_{crit}$$')}<mml:math><mml:mi>ηcrit</mml:mi></mml:math>` +
        '</alternatives></inline-formula> by 0.8.',
    );
    expect(text).toBe('Reducing threshold RH $\\eta_{crit}$ by 0.8.');
  });

  it('keeps an <alternatives> formula inside the sentence that holds it (#130)', () => {
    // PMC12816603: <alternatives> takes the placement of whatever holds it; inside
    // an <inline-formula> that is the sentence, not a block of its own.
    const blocks = sectionOf(
      '<p>Transport stalls once <inline-formula id="IEq1"><alternatives>' +
        '<tex-math>\\eta_{crit}</tex-math><mml:math><mml:mi>ηcrit</mml:mi></mml:math>' +
        '</alternatives></inline-formula> is exceeded.</p>',
    );
    expect(blocks).toEqual([
      { text: 'Transport stalls once $\\eta_{crit}$ is exceeded.', type: 'paragraph' },
    ]);
  });

  it('reaches a formula nested inside <italic>', () => {
    const text = paragraphOf(
      'The bound <italic><inline-formula><alternatives>' +
        `${texMath('$$\\eta$$')}<mml:math><mml:mi>η</mml:mi></mml:math>` +
        '</alternatives></inline-formula></italic> holds.',
    );
    expect(text).toBe('The bound *$\\eta$* holds.');
  });

  it('reads a <tex-math> whose document the deposit never closed', () => {
    // A truncated deposit opens \begin{document} and never closes it.
    const text = paragraphOf(
      '<inline-formula><tex-math>\\documentclass[12pt]{minimal}\\usepackage{amsmath}' +
        '\\begin{document}$$\\gamma$$</tex-math></inline-formula>',
    );
    expect(text).toBe('$\\gamma$');
  });

  it('reads a <tex-math> without a preamble as it is, one layer of delimiters removed', () => {
    expect(paragraphOf('<inline-formula><tex-math>\\eta_{crit}</tex-math></inline-formula>')).toBe(
      '$\\eta_{crit}$',
    );
    expect(
      paragraphOf(`<inline-formula>${texMath('\\(x_i\\)')}</inline-formula> is the input.`),
    ).toBe('$x_i$ is the input.');
  });

  it('prefers the <tex-math> rendering wherever it sits in <alternatives>', () => {
    const text = paragraphOf(
      '<inline-formula><alternatives><mml:math><mml:mi>y</mml:mi></mml:math>' +
        '<tex-math>x</tex-math></alternatives></inline-formula>',
    );
    expect(text).toBe('$x$');
  });

  it('reads the MathML beside a <tex-math> that carries no expression', () => {
    // An empty <tex-math> is no rendering at all; preferring it by tag alone drops the
    // MathML beside it and the formula disappears.
    expect(
      paragraphOf(
        'Threshold <inline-formula><alternatives><tex-math></tex-math>' +
          '<mml:math><mml:mi>η</mml:mi><mml:mi>crit</mml:mi></mml:math>' +
          '</alternatives></inline-formula> applies.',
      ),
    ).toBe('Threshold $η\\mathrm{crit}$ applies.');
    expect(
      paragraphOf(
        `<inline-formula><alternatives><tex-math>${texDocument('')}</tex-math>` +
          '<mml:math><mml:mi>η</mml:mi></mml:math></alternatives></inline-formula>',
      ),
    ).toBe('$η$');
  });

  it('prefers a rendering over a pointer that carries alt text', () => {
    // A <graphic>'s alt text names the file rather than stating the object.
    expect(
      paragraphOf(
        '<inline-formula><alternatives><graphic xlink:href="eq1.gif">' +
          '<alt-text>eq1.gif</alt-text></graphic><mml:math><mml:mi>η</mml:mi></mml:math>' +
          '</alternatives></inline-formula>',
      ),
    ).toBe('$η$');
  });

  it('falls back to a pointer alt text, keeping the formula inside its sentence', () => {
    // The pointer is one rendering of an inline formula, so it takes the formula's
    // inline placement: no figure is split out of the sentence around it.
    const document = parseBody(
      '<p>The ring <inline-formula><alternatives><graphic xlink:href="benzene.gif">' +
        '<alt-text>Structure of benzene</alt-text></graphic></alternatives></inline-formula>' +
        ' is planar.</p>',
    );
    expect(document.body[0]?.blocks).toEqual([
      { text: 'The ring Structure of benzene is planar.', type: 'paragraph' },
    ]);
  });

  it('reads a <disp-formula> at block position without its preamble', () => {
    const blocks = sectionOf(
      '<p>We define the delay as</p>' +
        `<disp-formula id="Equ1"><label>1</label>${texMath('$$D = a - b$$')}</disp-formula>` +
        '<p>where a is arrival.</p>',
    );
    expect(blocks).toEqual([
      { text: 'We define the delay as', type: 'paragraph' },
      { id: 'Equ1', label: '1', tex: 'D = a - b', type: 'formula' },
      { text: 'where a is arrival.', type: 'paragraph' },
    ]);
  });

  it('reads a <disp-formula> whose <tex-math> sits under <alternatives>', () => {
    const blocks = sectionOf(
      '<disp-formula><label>2</label><alternatives>' +
        `${texMath('$$E = mc^2$$')}<mml:math><mml:mi>E</mml:mi></mml:math>` +
        '</alternatives></disp-formula>',
    );
    expect(blocks).toEqual([{ label: '2', tex: 'E = mc^2', type: 'formula' }]);
  });

  it('reads a <disp-formula> whose MathML sits beside a pointer carrying alt text', () => {
    // Choosing the pointer left the formula with no body, and it dropped out
    // entirely, label and all.
    const blocks = sectionOf(
      '<p>Before.</p><disp-formula><label>3</label><alternatives>' +
        '<graphic xlink:href="equ3.gif"><alt-text>equ3.gif</alt-text></graphic>' +
        '<mml:math><mml:mi>η</mml:mi></mml:math></alternatives></disp-formula><p>After.</p>',
    );
    expect(blocks).toEqual([
      { text: 'Before.', type: 'paragraph' },
      { label: '3', tex: 'η', type: 'formula' },
      { text: 'After.', type: 'paragraph' },
    ]);
  });

  it('keeps block placement for a <disp-formula> under <alternatives> in a nested <sec>', () => {
    const { body } = parseBody(
      '<sec><title>Results</title><sec><title>Derivation</title><p>Before.</p>' +
        `<alternatives><disp-formula>${texMath('$$x = y$$')}</disp-formula></alternatives>` +
        '<p>After.</p></sec></sec>',
    );
    expect(body[0]?.sections[0]?.blocks).toEqual([
      { text: 'Before.', type: 'paragraph' },
      { tex: 'x = y', type: 'formula' },
      { text: 'After.', type: 'paragraph' },
    ]);
  });

  it('reads a formula in a table cell without its preamble, the table out of the prose', () => {
    // PMC12816603's only <alternatives> sits in a table cell.
    const document = parseBody(
      '<sec><title>Setup</title><p><table-wrap id="Tab1"><label>Table 1</label><table><tbody>' +
        '<tr><td>REF-S2</td><td>Reducing threshold RH <inline-formula><alternatives>' +
        `${texMath('$$\\eta_{crit}$$')}<mml:math><mml:mi>ηcrit</mml:mi></mml:math>` +
        '</alternatives></inline-formula> over the ocean</td></tr></tbody></table>' +
        '</table-wrap></p></sec>',
    );
    const [table] = blocksOfType(document, 'table');
    expect(table?.rows).toEqual([
      ['REF-S2', 'Reducing threshold RH $\\eta_{crit}$ over the ocean'],
    ]);
    expect(JSON.stringify(document)).not.toContain('documentclass');
    // The table's text is carried by the table block, never duplicated into prose.
    expect(document.body[0]?.blocks.map((b) => b.type)).toEqual(['table']);
  });

  it('carries no LaTeX preamble anywhere in a parsed article, one rendering per site', () => {
    const document = parseArticle({
      body:
        '<sec><title>Methods</title><p>Operations run over ' +
        `<inline-formula>${texMath('$$\\mathbb {F}_q$$')}</inline-formula>.</p>` +
        `<disp-formula><label>1</label>${texMath('$$D = a - b$$')}</disp-formula>` +
        '<table-wrap id="Tab1"><caption><p>Symbols used in ' +
        `<inline-formula>${texMath('$$Q$$')}</inline-formula></p></caption><table><tbody>` +
        `<tr><td><inline-formula>${texMath('$$r_i$$')}</inline-formula></td><td>rounds</td></tr>` +
        '</tbody></table></table-wrap></sec>',
      meta:
        '<article-id pub-id-type="pmcid">12855809</article-id>' +
        '<title-group><article-title>Threshold transport</article-title></title-group>' +
        `<abstract><p>We bound <inline-formula>${texMath('$$Q$$')}</inline-formula> ` +
        'from below.</p></abstract>',
    });
    const serialized = JSON.stringify(document);
    for (const marker of PREAMBLE_MARKERS) expect(serialized).not.toContain(marker);
    expect(document.abstracts[0]?.sections[0]?.blocks).toEqual([
      { text: 'We bound $Q$ from below.', type: 'paragraph' },
    ]);
    expect(document.body[0]?.blocks).toEqual([
      { text: 'Operations run over $\\mathbb {F}_q$.', type: 'paragraph' },
      { label: '1', tex: 'D = a - b', type: 'formula' },
      {
        caption: 'Symbols used in $Q$',
        headerRows: 0,
        id: 'Tab1',
        rows: [['$r_i$', 'rounds']],
        type: 'table',
      },
    ]);
  });

  it('leaves text with no <tex-math> and no <alternatives> as it is', () => {
    expect(paragraphOf('Our candidates include <italic>NF1</italic>.')).toBe(
      'Our candidates include *NF1*.',
    );
  });

  it('reads <alternatives> nested deep in one pass, not once per level above', () => {
    const nested = (inner: string) =>
      `${'<alternatives>'.repeat(40)}${inner}${'</alternatives>'.repeat(40)}`;
    expect(paragraphOf(`a ${nested('b')} c`)).toBe('a b c');
    const title = parseArticle({
      meta: `<title-group><article-title>${nested('')}Title</article-title></title-group>`,
    }).metadata.title;
    expect(title).toBe('Title');
  });
});

describe('TeX in a CDATA processing instruction', () => {
  /** IOP's Crossref deposit shape: TeX in `<?CDATA …?>`, MathML in a `<?MML …?>` beside it. */
  const iop =
    '<inline-formula><tex-math><?CDATA $(8\\pm 2)$?></tex-math>' +
    '<?MML <mml:math><mml:mn>8</mml:mn></mml:math>?>' +
    '<inline-graphic xlink:href="apj522286ieqn4.gif"/></inline-formula>';

  it('reads the instruction as the formula, with no math-without-tex warning', () => {
    const document = parseBody(
      `<sec><title>Results</title><p>sodium blueshifted by ${iop} km s<sup>−1</sup></p>` +
        `<sec><title>Lines</title><disp-formula id="e1"><tex-math><?CDATA E = mc^2?></tex-math>` +
        '<graphic xlink:href="e1.gif"/></disp-formula></sec></sec>',
    );
    expect(paragraphTexts(document)).toEqual(['sodium blueshifted by $(8\\pm 2)$ km s^{−1}']);
    expect(blocksOfType(document, 'formula')).toEqual([
      { id: 'e1', tex: 'E = mc^2', type: 'formula' },
    ]);
    expect(toMarkdown(document)).toContain('sodium blueshifted by $(8\\pm 2)$ km s^{−1}');
    expect(document.diagnostics.warnings).not.toContainEqual(
      expect.objectContaining({ code: 'math-without-tex' }),
    );
  });

  it("ignores PMC's own instructions inside <tex-math>", () => {
    expect(
      paragraphOf(
        '<inline-formula><tex-math><?equation-image-name M1.gif?>x^2</tex-math></inline-formula>',
      ),
    ).toBe('$x^2$');
  });
});

describe('display formulas (#130)', () => {
  it('keeps a graphic-only formula as its image, marked and reported', () => {
    // Europe PMC serves formulas it has no source for as GIFs: the content is not in the
    // text, so the output marks where it stood instead of closing up around it.
    const document = parseBody(
      '<sec><title>Model</title>' +
        '<disp-formula><label>(1)</label><alternatives><graphic xlink:href="eq1.gif"/>' +
        '<tex-math>E = mc^2</tex-math></alternatives></disp-formula>' +
        '<disp-formula id="Equ2"><label>(2)</label><graphic xlink:href="e2.gif"/></disp-formula>' +
        '<p>where <inline-formula id="IEq1"><inline-graphic xlink:href="i1.gif"/>' +
        '</inline-formula> is the speed of light.</p></sec>',
    );
    expect(document.body[0]?.blocks).toEqual([
      { label: '(1)', tex: 'E = mc^2', type: 'formula' },
      { href: 'e2.gif', id: 'Equ2', label: '(2)', type: 'formula' },
      { text: 'where [formula] is the speed of light.', type: 'paragraph' },
    ]);
    expect(toMarkdown(document)).toContain('[formula] (2)\n\nwhere [formula] is');
    expect(
      document.diagnostics.warnings.filter((warning) => warning.code === 'math-without-tex'),
    ).toEqual([
      {
        code: 'math-without-tex',
        message: 'A formula is published only as an image (e2.gif)',
        where: 'Equ2',
      },
      {
        code: 'math-without-tex',
        message: 'A formula is published only as an image (i1.gif)',
        where: 'IEq1',
      },
    ]);
  });

  it('converts presentation MathML to TeX', () => {
    const blocks = sectionOf(
      '<disp-formula id="e1"><mml:math><mml:mrow><mml:msup><mml:mi>x</mml:mi>' +
        '<mml:mn>2</mml:mn></mml:msup><mml:mo>+</mml:mo><mml:mfrac><mml:mn>1</mml:mn>' +
        '<mml:mi>n</mml:mi></mml:mfrac><mml:mo>=</mml:mo><mml:msqrt><mml:mi>y</mml:mi>' +
        '</mml:msqrt></mml:mrow></mml:math></disp-formula>',
    );
    expect(blocks).toEqual([{ id: 'e1', tex: 'x^2+\\frac{1}{n}=\\sqrt{y}', type: 'formula' }]);
  });

  it('prefers the TeX a MathML element carries in its alttext or annotation', () => {
    const blocks = sectionOf(
      '<disp-formula><mml:math alttext="\\alpha_{i}"><mml:msub><mml:mi>α</mml:mi>' +
        '<mml:mi>i</mml:mi></mml:msub></mml:math></disp-formula>' +
        '<disp-formula><mml:math><mml:semantics><mml:mi>β</mml:mi>' +
        '<mml:annotation encoding="application/x-tex">\\beta</mml:annotation>' +
        '</mml:semantics></mml:math></disp-formula>',
    );
    expect(blocks).toEqual([
      { tex: '\\alpha_{i}', type: 'formula' },
      { tex: '\\beta', type: 'formula' },
    ]);
  });

  it('keeps a formula with no TeX and no MathML as plain text', () => {
    expect(sectionOf('<disp-formula><label>(4)</label>a + b = c</disp-formula>')).toEqual([
      { label: '(4)', text: 'a + b = c', type: 'formula' },
    ]);
  });

  it('renders a display formula as a math block tagged with its label', () => {
    const document = parseBody(
      `<sec><title>Model</title><disp-formula><label>(1)</label>${texMath('$$D = a - b$$')}` +
        '</disp-formula></sec>',
    );
    expect(toMarkdown(document)).toContain('$$\nD = a - b \\tag{1}\n$$');
  });
});

describe('inline markup', () => {
  it('writes sub- and superscripts in TeX-style notation', () => {
    expect(
      paragraphOf(
        'x<sup>2</sup>, 10<sup>−5</sup>, CO<sub>2</sub>, IC<sub>50</sub>, 10<sup>5</sup>',
      ),
    ).toBe('x^2, 10^{−5}, CO_2, IC_{50}, 10^5');
  });

  it('writes citation markers as printed numbers in brackets', () => {
    const text = paragraphOf(
      'Shown before<sup><xref ref-type="bibr" rid="b1">1</xref>,' +
        '<xref ref-type="bibr" rid="b2">2</xref></sup> and since' +
        '<xref ref-type="bibr" rid="b3"><sup>3</sup></xref>, again<sup>4–7</sup>, ' +
        'and by Smith (<xref ref-type="bibr" rid="b8">2020</xref>).',
    );
    expect(text).toBe('Shown before[1,2] and since[3], again[4–7], and by Smith (2020).');
  });

  it('separates touching citation numbers in a paragraph, a caption, and a table cell', () => {
    const bibr = (n: number) => `<xref ref-type="bibr" rid="b${n}">${n}</xref>`;
    const document = parseBody(
      `<sec><title>Intro</title><p>Known [${bibr(1)}${bibr(2)}${bibr(3)}].</p>` +
        `<sec><title>Detail</title><p>Sup<sup>${bibr(1)}${bibr(2)}</sup> text.</p>` +
        `<fig id="f1"><label>Figure 1</label><caption><p>Cap<sup>${bibr(4)}${bibr(5)}</sup> ` +
        `and [${bibr(6)}${bibr(7)}].</p></caption><graphic xlink:href="f1.jpg"/></fig>` +
        '<table-wrap id="t1"><table><tbody><tr>' +
        `<td>Cell<sup>${bibr(8)}${bibr(9)}</sup></td><td>${bibr(1)}${bibr(2)}</td>` +
        '</tr></tbody></table></table-wrap></sec></sec>',
    );
    expect(paragraphTexts(document)).toEqual(['Known [1,2,3].', 'Sup[1,2] text.']);
    expect(blocksOfType(document, 'figure')[0]?.caption).toBe('Cap[4,5] and [6,7].');
    expect(blocksOfType(document, 'table')[0]?.rows).toEqual([['Cell[8,9]', '1,2']]);
    expect(toMarkdown(document)).toContain(
      'Known [1,2,3].\n\n### Detail\n\nSup[1,2] text.\n\n**Figure 1.** Cap[4,5] and [6,7].',
    );
    expect(toMarkdown(document)).toContain('| Cell[8,9] | 1,2 |');
  });

  it('separates touching author-year citations as a citation list, wherever they sit', () => {
    const cite = (rid: string, content: string) =>
      `<xref ref-type="bibr" rid="${rid}">${content}</xref>`;
    const pair = `${cite('b1', 'Smith 2008')}${cite('b2', '<italic>Jones</italic> 2010')}`;
    const document = parseBody(
      `<sec><title>Intro</title><p>Known (${pair}).</p>` +
        `<p>Marked [${cite('b1', '1')}<target id="t1"/>${cite('b2', '2')}].</p>` +
        `<fig id="f1"><label>Figure 1</label><caption><p>Cap (${pair}).</p></caption>` +
        '<graphic xlink:href="f1.jpg"/></fig>' +
        `<table-wrap id="t1"><table><tbody><tr><td>${pair}</td></tr></tbody></table></table-wrap></sec>`,
    );
    expect(paragraphTexts(document)).toEqual([
      'Known (Smith 2008; *Jones* 2010).',
      'Marked [1,2].',
    ]);
    expect(blocksOfType(document, 'figure')[0]?.caption).toBe('Cap (Smith 2008; *Jones* 2010).');
    expect(blocksOfType(document, 'table')[0]?.rows).toEqual([['Smith 2008; *Jones* 2010']]);
    expect(toMarkdown(document)).toContain('Known (Smith 2008; *Jones* 2010).\n\nMarked [1,2].');
  });

  it('writes links, keeping an unsafe scheme as text', () => {
    const text = paragraphOf(
      'See <ext-link ext-link-type="uri" xlink:href="https://example.org/a">the site</ext-link>, ' +
        '<uri>https://example.org/b</uri>, and ' +
        '<ext-link xlink:href="javascript:alert(1)">this</ext-link>.',
    );
    expect(text).toBe('See [the site](https://example.org/a), <https://example.org/b>, and this.');
  });

  it('writes emphasis, strike, and monospace', () => {
    expect(
      paragraphOf(
        '<bold>Bold</bold>, <italic>italic</italic>, <bold><italic>both</italic></bold>, ' +
          '<strike>struck</strike>, <monospace>code()</monospace>',
      ),
    ).toBe('**Bold**, *italic*, ***both***, ~~struck~~, `code()`');
  });

  it('escapes source punctuation that would otherwise read as Markdown', () => {
    expect(paragraphOf('A * B, snake_case, _under_, $5, ~x, &lt;tag&gt;, &amp;amp; [a](b)')).toBe(
      'A \\* B, snake_case, \\_under\\_, \\$5, \\~x, \\<tag>, \\&amp; [a\\](b)',
    );
  });

  it('collapses whitespace and keeps Unicode as it is', () => {
    expect(paragraphOf('  β-catenin   in\n\tGarcía-López   cohorts  ')).toBe(
      'β-catenin in García-López cohorts',
    );
  });

  it('drops index terms and reads a line break as a space', () => {
    expect(
      paragraphOf(
        'Growth<index-term><primary>growth</primary></index-term> slowed<break/>sharply.',
      ),
    ).toBe('Growth slowed sharply.');
  });

  it('reads an unknown inline element as its text and reports it', () => {
    const document = parseBody('<p>A <mystery-tag>hidden</mystery-tag> word.</p>');
    expect(paragraphTexts(document)).toEqual(['A hidden word.']);
    expect(document.diagnostics.unhandled).toEqual([{ count: 1, element: 'jats:mystery-tag' }]);
  });

  it('reads an article served inside PMC\u2019s <pmc-articleset>', () => {
    const document = parse(
      '<?xml version="1.0"?><pmc-articleset><article><front><article-meta><title-group>' +
        '<article-title>Wrapped</article-title></title-group></article-meta></front>' +
        '<body><p>Text.</p></body></article></pmc-articleset>',
    );
    expect(document.flavor).toBe('pmc');
    expect(document.metadata.title).toBe('Wrapped');
  });
});
