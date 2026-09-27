/**
 * @fileoverview The shared XML reader's entity handling: character references to code
 * points a document cannot hold read as U+FFFD, the expansion cap counts only entities a
 * DOCTYPE declares, and both hold through the JATS and TEI parsers.
 * @module tests/xml/ordered.test
 */
import { describe, expect, it } from 'vitest';
import { parseJats } from '../../src/formats/jats/index.js';
import { parseTei } from '../../src/formats/tei/index.js';
import type { ParseResult } from '../../src/model/result.js';
import { childrenOf, parseOrderedXml, textOf } from '../../src/xml/ordered.js';

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

  it('rewrites references in one pass', () => {
    const started = performance.now();
    const text = rootText(`<a>${'&#0;<!---->x'.repeat(100_000)}</a>`);
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(text).toBe('�x'.repeat(100_000));
  });

  it('reads the same through the JATS and TEI parsers', () => {
    expect(paragraph(parseJats(article('A&#xD800;B&#x110000;C&#0;D')))).toBe('A�B�C�D');
    expect(paragraph(parseTei(tei('A&#xD800;B&#x110000;C&#0;D')))).toBe('A�B�C�D');
    expect(paragraph(parseJats(article('a <![CDATA[&#xD800; x]]> b')))).toBe('a \\&#xD800; x b');
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
