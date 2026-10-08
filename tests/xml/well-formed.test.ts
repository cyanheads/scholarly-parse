/**
 * @fileoverview The well-formedness check every XML parse runs first: faults the XML
 * parser would tolerate silently are reported, and well-formed markup passes.
 * @module tests/xml/well-formed.test
 */
import { describe, expect, it } from 'vitest';
import { parseJats } from '../../src/formats/jats/index.js';
import { toMarkdown } from '../../src/index.js';
import { findMarkupFault } from '../../src/xml/well-formed.js';
import { expectLinear } from '../linear.js';

describe('findMarkupFault', () => {
  it('passes well-formed markup, including comments, CDATA, PIs, and a DOCTYPE subset', () => {
    expect(findMarkupFault('<a x="1>2" y=\'<\'><b/>text &amp; more</a>')).toBeUndefined();
    expect(
      findMarkupFault('<?xml version="1.0"?><!-- < --><a><![CDATA[ < ]]><?pi < ?></a>'),
    ).toBeUndefined();
    expect(
      findMarkupFault(
        '<!DOCTYPE article PUBLIC "-//NLM//DTD JATS" "x.dtd" [<!ENTITY y "z">]><mml:math/>',
      ),
    ).toBeUndefined();
  });

  it('reports an unescaped less-than sign with its line', () => {
    expect(findMarkupFault('<p>\nSignificant at p < 0.05.</p>')).toBe('line 2: unescaped "<"');
  });

  it('reports mismatched, stray, and unclosed tags', () => {
    expect(findMarkupFault('<a><b></a></b>')).toBe('line 1: </a> where </b> was expected');
    expect(findMarkupFault('</a>')).toBe('line 1: </a> closes no element');
    expect(findMarkupFault('<a><b>')).toBe('<b> is never closed');
  });

  it('reports a start tag whose name runs into what is not a name, which the parser would drop', () => {
    expect(findMarkupFault('<p>1<or= 2b/>x</p>')).toBe('line 1: malformed start tag <or');
    expect(findMarkupFault('<p><a"b"/></p>')).toBe('line 1: malformed start tag <a');
  });

  it('reports a declaration outside a DOCTYPE, which the parser would drop', () => {
    expect(findMarkupFault('<p>x<!y> and <!1></p>')).toBe('line 1: unescaped "<"');
    expect(findMarkupFault('<!doctype a><a/>')).toBeUndefined();
  });

  it('reports markup that is never terminated', () => {
    expect(findMarkupFault('<a><!-- open</a>')).toBe('line 1: markup never terminated');
    expect(findMarkupFault('<a title="x"')).toBe('line 1: markup never terminated');
  });
});

describe('findMarkupFault on a DOCTYPE internal subset', () => {
  it('passes declarations whose quoted values hold brackets and markup', () => {
    expect(
      findMarkupFault('<!DOCTYPE a [<!-- note --><?pi x?><!ENTITY y "]>"><!ENTITY z \'<\'>]><a/>'),
    ).toBeUndefined();
  });

  it.each([
    "<!-- don't -->",
    '<!-- say "so -->',
    '<!-- ] -->',
    '<!-- > ]> -->',
    "<?pi it's ?>",
    '<?pi ]> ?>',
  ])('skips %j in the subset whole, whatever it holds (#74)', (markup) => {
    expect(findMarkupFault(`<!DOCTYPE a [${markup}<!ENTITY x "y">]><a>Hi</a>`)).toBeUndefined();
  });

  it.each(["<!-- don't ]><a/>", '<!-- open ]><a/>', '<?pi ]><a/>', '<!ENTITY x "y]><a/>'])(
    'fails a subset whose %j is never terminated',
    (rest) => {
      expect(findMarkupFault(`<!DOCTYPE a [${rest}`)).toBe('line 1: markup never terminated');
    },
  );

  it.each([
    ['many comments', (n: number) => `<!DOCTYPE a [${"<!-- x's -->".repeat(n)}]><a/>`],
    ['many instructions', (n: number) => `<!DOCTYPE a [${'<?p "?>'.repeat(n)}]><a/>`],
    ['comment openers never closed', (n: number) => `<!DOCTYPE a [${'<!--'.repeat(n)}`],
    ['instruction openers never closed', (n: number) => `<!DOCTYPE a [${"<?p '".repeat(n)}`],
  ])('scans a subset of %s in linear time', async (_, input) => {
    await expectLinear(input, findMarkupFault, { from: 1_000, to: 64_000 });
  });
});

describe('parseJats on markup that is not well-formed', () => {
  it('fails as malformed instead of dropping the rest of the section', () => {
    const result = parseJats(
      '<article><front><article-meta><title-group><article-title>T</article-title></title-group>' +
        '</article-meta></front><body><sec><title>Results</title><p>Significant at p < 0.05.</p>' +
        '</sec><sec><title>Discussion</title><p>More.</p></sec></body></article>',
    );
    expect(result).toEqual({
      error: { message: 'XML could not be parsed: line 1: unescaped "<"', reason: 'malformed' },
      ok: false,
    });
  });

  it('fails as malformed when a comment in the DOCTYPE subset is never closed', () => {
    const result = parseJats(
      "<!DOCTYPE article [<!-- don't ]><article><body><p>Hi</p></body></article>",
    );
    expect(result).toEqual({
      error: {
        message: 'XML could not be parsed: line 1: markup never terminated',
        reason: 'malformed',
      },
      ok: false,
    });
  });
});

describe('parseJats with a DOCTYPE internal subset', () => {
  it.each(["<!-- don't -->", '<!-- ] -->', "<?pi it's ?>"])(
    'reads a document whose subset holds %j (#74)',
    (markup) => {
      const result = parseJats(
        `<?xml version="1.0"?><!DOCTYPE article [${markup}<!ENTITY x "y">]><article>` +
          '<front><article-meta><title-group><article-title>T</article-title></title-group>' +
          '</article-meta></front><body><p>Hi &x;</p></body></article>',
      );
      if (!result.ok) throw new Error(result.error.message);
      expect(result.document.body[0]?.blocks).toEqual([{ text: 'Hi y', type: 'paragraph' }]);
      expect(toMarkdown(result.document)).toContain('\n\nHi y\n');
    },
  );
});
