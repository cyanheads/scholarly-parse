/**
 * @fileoverview MathML → TeX: the TeX a `<math>` already carries is preferred, else the
 * presentation markup is linearized construct by construct, from the ordered XML tree or
 * any tree read through an accessor; publisher TeX is reduced to its expression.
 * @module tests/xml/mathml.test
 */
import { describe, expect, it } from 'vitest';
import { parseJats } from '../../src/formats/jats/index.js';
import { toMarkdown } from '../../src/render/index.js';
import { cleanTex, type MathNodes, mathmlToTex } from '../../src/xml/mathml.js';
import { parseOrderedXml, type XmlNode } from '../../src/xml/ordered.js';

/** TeX for the `<math>` element whose content is `inner`, with the `mml:` prefix JATS uses. */
function tex(inner: string, attributes = ''): string {
  const tree = parseOrderedXml(`<mml:math${attributes}>${inner}</mml:math>`);
  if ('error' in tree) throw new Error(tree.error);
  return mathmlToTex(tree.nodes[0] as XmlNode);
}

describe('mathmlToTex', () => {
  it('prefers TeX in the alttext, but not a plain-text alttext', () => {
    expect(tex('<mml:mi>x</mml:mi>', ' alttext="$\\alpha$"')).toBe('\\alpha');
    expect(tex('<mml:msup><mml:mi>x</mml:mi><mml:mn>2</mml:mn></mml:msup>', ' alttext="x2"')).toBe(
      'x^2',
    );
  });

  it('reads a TeX annotation inside semantics', () => {
    expect(
      tex(
        '<mml:semantics><mml:mi>y</mml:mi><mml:annotation encoding="application/x-tex">\\gamma</mml:annotation></mml:semantics>',
      ),
    ).toBe('\\gamma');
  });

  it('writes scripts, grouping multi-character ones', () => {
    expect(
      tex(
        '<mml:msubsup><mml:mi>x</mml:mi><mml:mi>i</mml:mi><mml:mn>10</mml:mn></mml:msubsup>' +
          '<mml:munderover><mml:mo>∑</mml:mo><mml:mrow><mml:mi>k</mml:mi><mml:mo>=</mml:mo><mml:mn>1</mml:mn></mml:mrow><mml:mi>n</mml:mi></mml:munderover>',
      ),
    ).toBe('x_i^{10}∑_{k=1}^n');
  });

  it('writes roots, accents, over- and underscripts', () => {
    expect(tex('<mml:mroot><mml:mi>x</mml:mi><mml:mn>3</mml:mn></mml:mroot>')).toBe('\\sqrt[3]{x}');
    expect(tex('<mml:mover accent="true"><mml:mi>v</mml:mi><mml:mo>→</mml:mo></mml:mover>')).toBe(
      '\\vec{v}',
    );
    expect(tex('<mml:mover><mml:mi>x</mml:mi><mml:mo>*</mml:mo></mml:mover>')).toBe(
      '\\overset{*}{x}',
    );
    expect(tex('<mml:munder><mml:mo>lim</mml:mo><mml:mi>n</mml:mi></mml:munder>')).toBe(
      '\\underset{n}{lim}',
    );
  });

  it('writes a multi-letter identifier upright and text as text', () => {
    expect(
      tex('<mml:mi>sin</mml:mi><mml:mo>⁡</mml:mo><mml:mi>x</mml:mi><mml:mtext>if true</mml:mtext>'),
    ).toBe('\\mathrm{sin}x\\text{if true}');
  });

  it('writes a token’s mathvariant as the TeX alphabet it names', () => {
    expect(
      tex(
        '<mml:msub><mml:mi mathvariant="double-struck">F</mml:mi><mml:mi>q</mml:mi></mml:msub>' +
          '<mml:mi mathvariant="script">C</mml:mi><mml:mi mathvariant="bold">v</mml:mi>' +
          '<mml:mn mathvariant="bold">0</mml:mn><mml:mi mathvariant="normal">d</mml:mi>' +
          '<mml:mi mathvariant="italic">x</mml:mi>',
      ),
    ).toBe('\\mathbb{F}_q\\mathcal{C}\\mathbf{v}\\mathbf{0}\\mathrm{d}x');
  });

  it('writes fenced groups with their separators and tables as a matrix', () => {
    expect(
      tex('<mml:mfenced open="[" close="]"><mml:mi>a</mml:mi><mml:mi>b</mml:mi></mml:mfenced>'),
    ).toBe('[a,b]');
    expect(
      tex(
        '<mml:mtable><mml:mtr><mml:mtd><mml:mn>1</mml:mn></mml:mtd><mml:mtd><mml:mn>0</mml:mn></mml:mtd></mml:mtr>' +
          '<mml:mtr><mml:mtd><mml:mn>0</mml:mn></mml:mtd><mml:mtd><mml:mn>1</mml:mn></mml:mtd></mml:mtr></mml:mtable>',
      ),
    ).toBe('\\begin{matrix}1 & 0 \\\\ 0 & 1\\end{matrix}');
  });

  it('escapes braces used as operators and drops invisible ones', () => {
    expect(
      tex(
        '<mml:mo>{</mml:mo><mml:mi>x</mml:mi><mml:mo>⁢</mml:mo><mml:mi>y</mml:mi><mml:mo>}</mml:mo>',
      ),
    ).toBe('\\{xy\\}');
  });

  it('drops phantoms and returns nothing for empty math', () => {
    expect(tex('<mml:mphantom><mml:mi>x</mml:mi></mml:mphantom><mml:mi>y</mml:mi>')).toBe('y');
    expect(tex('')).toBe('');
  });

  it('reads a variant, operator, or accent named like an object property as plain text', () => {
    expect(
      tex(
        '<mml:mi mathvariant="constructor">x</mml:mi><mml:mo>toString</mml:mo>' +
          '<mml:mover><mml:mi>y</mml:mi><mml:mo>__proto__</mml:mo></mml:mover>',
      ),
    ).toBe('xtoString\\overset{__proto__}{y}');
  });
});

describe('mathmlToTex on mmultiscripts', () => {
  const multi = (...children: string[]) =>
    tex(`<mml:mmultiscripts>${children.join('')}</mml:mmultiscripts>`);
  const none = '<mml:none/>';
  const pre = '<mml:mprescripts/>';
  const mi = (x: string) => `<mml:mi>${x}</mml:mi>`;
  const mn = (x: string) => `<mml:mn>${x}</mml:mn>`;

  it('writes prescripts before the base, each pair after an empty group', () => {
    expect(multi(mi('C'), none, none, pre, mn('6'), mn('14'))).toBe('{}_6^{14}C');
    expect(multi('<mml:mtext>F</mml:mtext>', pre, none, mn('18'))).toBe('{}^{18}\\text{F}');
  });

  it('attaches the first postscript pair to the base and staggers the later ones', () => {
    expect(multi(mi('R'), mi('i'), none, none, mi('j'), mi('k'), none)).toBe('R_i{}^j{}_k');
    expect(multi(mi('x'), mi('a'), mi('b'))).toBe('x_a^b');
  });

  it('reads an empty mrow as an empty script', () => {
    expect(
      multi(
        mi('E'),
        mi('q'),
        '<mml:mrow/>',
        '<mml:mrow/>',
        `<mml:mrow><mml:mo>(</mml:mo>${mi('j')}<mml:mo>)</mml:mo></mml:mrow>`,
      ),
    ).toBe('E_q{}^{(j)}');
  });

  it('reads a lone last script as a subscript, and a base with no scripts as itself', () => {
    expect(multi(mi('x'), mi('a'))).toBe('x_a');
    expect(multi(mi('x'))).toBe('x');
    expect(multi(mi('x'), pre)).toBe('x');
  });

  it('renders through parseJats as inline math, with no new warning', async () => {
    const article = (inner: string) =>
      `<article><body><p><inline-formula><mml:math xmlns:mml="http://www.w3.org/1998/Math/MathML">${inner}</mml:math></inline-formula></p></body></article>`;
    const result = await parseJats(
      article(`<mml:mmultiscripts>${mi('C')}${none}${none}
        ${pre}${mn('6')}${mn('14')}
        </mml:mmultiscripts>`),
    );
    const plain = await parseJats(article(mi('C')));
    if (!result.ok || !plain.ok) throw new Error('parse failed');
    expect(toMarkdown(result.document)).toBe(`\${}_6^{14}C$\n`);
    expect(result.document.diagnostics).toEqual(plain.document.diagnostics);
  });
});

/** A tree that is neither the ordered XML tree nor a DOM. */
interface Plain {
  attrs?: Record<string, string>;
  kids?: Plain[];
  tag?: string;
  text?: string;
}

const PLAIN: MathNodes<Plain> = {
  attr: (node, name) => node.attrs?.[name],
  children: (node) => node.kids ?? [],
  isText: (node) => node.tag === undefined,
  name: (node) => node.tag,
  text: (node) => node.text ?? '',
};

const el = (tag: string, ...kids: Plain[]): Plain => ({ kids, tag });
const txt = (text: string): Plain => ({ text });

describe('mathmlToTex through another accessor', () => {
  it('linearizes the same constructs', () => {
    const math = el(
      'math',
      el('msup', el('mi', txt('x')), el('mn', txt('2'))),
      el('mo', txt('+')),
      el('mfrac', el('mi', txt('a')), el('mi', txt('b'))),
    );
    expect(mathmlToTex(math, PLAIN)).toBe('x^2+\\frac{a}{b}');
    expect(mathmlToTex({ ...math, attrs: { alttext: 'y^{2}' } }, PLAIN)).toBe('y^{2}');
  });

  it('writes what lies past the depth bound as its text, without recursing', () => {
    // 100,000 nested rows: a walk with no depth stop overflows the stack.
    let row = el('msup', el('mi', txt('x')), el('mn', txt('2')));
    for (let i = 0; i < 100_000; i++) row = el('mrow', row);
    expect(mathmlToTex(el('math', row), PLAIN)).toBe('x2');
    expect(mathmlToTex(el('math', el('msup', el('mi', txt('y')), el('mn', txt('3')))), PLAIN)).toBe(
      'y^3',
    );
  });
});

describe('cleanTex', () => {
  it('keeps only the body of a deposited LaTeX document', () => {
    expect(
      cleanTex(
        '\\documentclass[12pt]{minimal}\\usepackage{amsmath}\\begin{document}$$x+y$$\\end{document}',
      ),
    ).toBe('x+y');
    expect(cleanTex('\\documentclass{minimal}\\begin{document}$z$')).toBe('z');
  });

  it('strips one layer of math delimiters', () => {
    expect(cleanTex('$$a$$')).toBe('a');
    expect(cleanTex('\\[b\\]')).toBe('b');
    expect(cleanTex('\\(c\\)')).toBe('c');
    expect(cleanTex('$d$')).toBe('d');
    expect(cleanTex('e')).toBe('e');
  });
});
