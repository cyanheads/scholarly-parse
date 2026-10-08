/**
 * @fileoverview The shared XML reader's text handling: character references to code
 * points a document cannot hold read as U+FFFD, a `<?CDATA …?>` instruction reads as the
 * CDATA section it stands for while every other instruction is ignored, the expansion cap
 * counts only entities a DOCTYPE declares, and all of it holds through the JATS and TEI
 * parsers.
 * @module tests/xml/ordered.test
 */
import { describe, expect, it } from 'vitest';
import { parseJats } from '../../src/formats/jats/index.js';
import { parseTei } from '../../src/formats/tei/index.js';
import type { ParseResult } from '../../src/model/result.js';
import { childrenOf, parseOrderedXml, textOf } from '../../src/xml/ordered.js';
import { expectLinear } from '../linear.js';

/** The text of the root element of `xml`, or the parser's error. */
function rootText(xml: string): string {
  const tree = parseOrderedXml(xml);
  if ('error' in tree) return `error: ${tree.error}`;
  const root = tree.nodes.find((node) => childrenOf(node).length > 0);
  return childrenOf(root)
    .map((node) => textOf(node))
    .join('');
}

const article = (paragraph: string) =>
  `<article><front><article-meta><title-group><article-title>T</article-title></title-group></article-meta></front><body><sec><title>S</title><p>${paragraph}</p></sec></body></article>`;

const tei = (paragraph: string) =>
  `<TEI><teiHeader><fileDesc><titleStmt><title>T</title></titleStmt></fileDesc></teiHeader><text><body><div><head>S</head><p>${paragraph}</p></div></body></text></TEI>`;

/** The first paragraph of the first body section, or the failure. */
function paragraph(result: ParseResult): string | undefined {
  if (!result.ok) return `${result.error.reason}: ${result.error.message}`;
  const [block] = result.document.body[0]?.blocks ?? [];
  return block?.type === 'paragraph' ? block.text : undefined;
}

describe('character references', () => {
  it('reads a reference to NUL, a surrogate, or a code point past U+10FFFF as U+FFFD', () => {
    expect(rootText('<a>A&#xD800;B&#x110000;C&#0;D</a>')).toBe('A�B�C�D');
    expect(rootText('<a>A&#xDFFF;B&#1114112;C&#55296;D&#XDC00;E</a>')).toBe('A�B�C�D�E');
  });

  it('decodes valid references as before', () => {
    expect(rootText('<a>&#x1F600;&#233;&amp;&#xD7FF;&#xE000;&#x10FFFF;</a>')).toBe(
      '😀é&퟿\u{10FFFF}',
    );
  });

  it('leaves a reference inside a CDATA section as written, and reads past a comment', () => {
    expect(rootText('<a><![CDATA[&#xD800;&#0;]]>&#0;</a>')).toBe('&#xD800;&#0;�');
    expect(rootText('<a><!-- <![CDATA[ -->A&#0;B</a>')).toBe('A�B');
  });

  it('rewrites references between comments in one linear pass', async () => {
    const xml = (n: number) => `<a>${'&#0;<!---->x'.repeat(n)}</a>`;
    await expectLinear(xml, (input) => parseOrderedXml(input), { from: 1_000, to: 64_000 });
    expect(rootText(xml(100_000))).toBe('�x'.repeat(100_000));
  });

  it('reads the same through the JATS and TEI parsers', () => {
    expect(paragraph(parseJats(article('A&#xD800;B&#x110000;C&#0;D')))).toBe('A�B�C�D');
    expect(paragraph(parseTei(tei('A&#xD800;B&#x110000;C&#0;D')))).toBe('A�B�C�D');
    expect(paragraph(parseJats(article('a <![CDATA[&#xD800; x]]> b')))).toBe('a \\&#xD800; x b');
  });
});

describe('processing instructions', () => {
  it('ignores an instruction, wherever it sits', () => {
    expect(rootText('<a>A<?MML <mml:math><mml:mn>8</mml:mn></mml:math>?>B</a>')).toBe('AB');
    expect(rootText('<a>A<?equation-image-name M1.gif?>B<?properties open_access?></a>')).toBe(
      'AB',
    );
    expect(rootText('<a><?CDATAx y?>A<?cdata z?></a>')).toBe('A');
  });

  it('leaves <?CDATA written inside a CDATA section, a comment, or another instruction as written', () => {
    expect(rootText('<a><![CDATA[<?CDATA x?>]]></a>')).toBe('<?CDATA x?>');
    expect(rootText('<a><!-- <?CDATA x?> -->B</a>')).toBe('B');
    expect(rootText('<a><?MML <?CDATA x?>B</a>')).toBe('B');
  });

  it('reads <!--, <?, and <![CDATA[ in an attribute value or an entity value as text', () => {
    const literal = ' --> <?CDATA x?><b>y</b> ';
    expect(rootText(`<a b="<!--"><![CDATA[${literal}]]></a>`)).toBe(literal);
    expect(rootText('<a b="<?"><![CDATA[ ?> <?CDATA x?><b>y</b> ]]></a>')).toBe(
      ' ?> <?CDATA x?><b>y</b> ',
    );
    expect(rootText(`<!DOCTYPE a [<!ENTITY e "<!--">]><a><![CDATA[${literal}]]></a>`)).toBe(
      literal,
    );
    expect(rootText('<a b="<!--"><?pi --> <?CDATA x?> <b>y</b> ?>z</a>')).toBe('  ?>z');
    expect(
      paragraph(
        parseJats(
          `<!DOCTYPE article [<!ENTITY e "<!--">]>${article(`<![CDATA[${literal}]]><?CDATA k?>`)}`,
        ),
      ),
    ).toBe('--> \\<?CDATA x?>\\<b>y\\</b> k');
  });

  it('still rewrites references inside a start tag', () => {
    expect(parseOrderedXml('<a b="&#0;<!--">&#0;<?CDATA k?></a>')).toEqual({
      nodes: [{ ':@': { '@_b': '�<!--' }, a: [{ '#text': '�' }, { '#text': 'k' }] }],
    });
  });

  it('fails an unterminated <?CDATA as markup never terminated', () => {
    expect(rootText('<a><?CDATA x</a>')).toMatch(/^error: .*never terminated/);
    expect(parseJats(article('<?CDATA $x$'))).toMatchObject({
      error: { reason: 'malformed' },
      ok: false,
    });
  });

  it('reads the content of a CDATA instruction as text, as a CDATA section would', () => {
    expect(rootText('<a><?CDATA $(8\\pm 2)$?></a>')).toBe('$(8\\pm 2)$');
    expect(rootText('<a>x <?CDATA a < b & c &#0; <i>?> y</a>')).toBe('x a < b & c &#0; <i> y');
    expect(rootText('<a><?CDATA  \n\tleading?><?CDATA?></a>')).toBe('leading');
  });

  it('keeps ]]> inside a CDATA instruction intact', () => {
    expect(rootText('<a><?CDATA a]]>b]]>?></a>')).toBe('a]]>b]]>');
    expect(paragraph(parseJats(article('x<?CDATA ]]>?>y')))).toBe('x]]>y');
  });

  it('rewrites CDATA instructions in one linear pass', async () => {
    await expectLinear(
      (n) => `<a>${'<?CDATA ]]>?>&#0;<?x ?>'.repeat(n)}</a>`,
      (xml) => parseOrderedXml(xml),
      { from: 1_000, to: 64_000 },
    );
  });
});

describe('a DOCTYPE internal subset', () => {
  it('reads past comments and quoted values in the subset', () => {
    expect(rootText('<!DOCTYPE a [<!-- note ] --><!ENTITY e "x]>">]><a>&e;</a>')).toBe('x]>');
  });

  it('removes an instruction from the subset, whatever it holds (#74)', () => {
    expect(rootText('<!DOCTYPE a [<?p x?><!ENTITY e "y">]><a>&e;</a>')).toBe('y');
    expect(rootText(`<!DOCTYPE a [<?p it's ]> "?><!ENTITY e "y"><?q?>]><a>&e;&#0;</a>`)).toBe('y�');
    // A `<?` in a comment or a quoted value opens nothing: the entity after each still reads.
    expect(
      rootText('<!DOCTYPE a [<!-- <?p --><!ENTITY e \'<?\'><!ENTITY f "y"><?r?>]><a>&f;<?x?></a>'),
    ).toBe('y');
  });

  it('removes subset instructions in linear time', async () => {
    await expectLinear(
      (n) => `<!DOCTYPE a [${'<?p "?><!-- <? -->'.repeat(n)}]><a/>`,
      (xml) => parseOrderedXml(xml),
      { from: 1_000, to: 64_000 },
    );
  });
});

describe('the entity-expansion cap', () => {
  it('does not count predefined, numeric, or HTML named references', () => {
    for (const unit of ['&amp;', '&#233;', '&#x1F600;', '&nbsp;']) {
      const text = paragraph(parseJats(article(`${unit}x `.repeat(100_001))));
      expect(text?.match(/x/g)).toHaveLength(100_001);
    }
    expect(paragraph(parseTei(tei('&amp;x '.repeat(100_001))))?.match(/x/g)).toHaveLength(100_001);
  });

  it('still caps references to an entity the DOCTYPE declares, by count and by length', () => {
    const declared = '<!DOCTYPE a [<!ENTITY e "x">]>';
    expect(rootText(`${declared}<a>${'&e;'.repeat(100_000)}</a>`)).toBe('x'.repeat(100_000));
    expect(rootText(`${declared}<a>${'&e;'.repeat(100_001)}</a>`)).toMatch(/^error: .*limit/);
    const large = `<!DOCTYPE a [<!ENTITY e "${'x'.repeat(10_000)}">]>`;
    expect(rootText(`${large}<a>${'&e;'.repeat(11)}</a>`)).toMatch(/^error: .*limit/);
    const doctype = '<!DOCTYPE article [<!ENTITY e "x">]>';
    expect(parseJats(doctype + article('&e;'.repeat(100_001)))).toMatchObject({
      error: { reason: 'malformed' },
      ok: false,
    });
  });
});
