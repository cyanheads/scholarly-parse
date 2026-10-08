/**
 * @fileoverview Deeply nested markup. The HTML loader both DOM parsers share drops the
 * tags of elements that would open deeper than `MAX_XML_DEPTH`, keeping their text, by
 * a scan that mirrors htmlparser2's stack; `parseLatexml` then reads any page in time
 * linear in its size, warning `truncated-input` once when tags were dropped.
 * @module tests/formats/latexml/nesting.test
 */
import { describe, expect, it } from 'vitest';
import { parseLatexml } from '../../../src/formats/latexml/index.js';
import { boundNesting, loadBoundedDocument } from '../../../src/html/dom.js';
import type { ScholarlyDocument } from '../../../src/model/document.js';
import { MAX_XML_DEPTH } from '../../../src/model/limits.js';
import { expectLinear } from '../../linear.js';

function page(content: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta name="generator" content="LaTeXML"></head>
    <body><article class="ltx_document"><h1 class="ltx_title ltx_title_document">A paper</h1>
    <div class="ltx_abstract"><p class="ltx_p">The abstract.</p></div>
    ${content}</article></body></html>`;
}

async function parse(html: string): Promise<ScholarlyDocument> {
  const result = await parseLatexml(html);
  if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
  return result.document;
}

/** How many elements deep the tree under `root` goes, counted without recursion. */
function depthBelow(root: Node): number {
  let deepest = 0;
  const pending: [Node, number][] = [[root, 0]];
  for (let next = pending.pop(); next; next = pending.pop()) {
    const [node, depth] = next;
    deepest = Math.max(deepest, depth);
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1) pending.push([child, depth + 1]);
    }
  }
  return deepest;
}

/** `open` nested `n` deep around `text`, each closed by `close`. */
const nested = (open: string, close: string, n: number, text = 'deep') =>
  `${open.repeat(n)}${text}${close.repeat(n)}`;

const DEEP_INPUTS: [string, string, string][] = [
  ['<b>', '<b>', '</b>'],
  ['<blockquote>', '<blockquote>', '</blockquote>'],
  ['<ul><li>', '<ul><li>', '</li></ul>'],
  ['<table><tr><td>', '<table><tr><td>', '</td></tr></table>'],
  ['<p><li><td>', '<p><li><td>', ''],
  ['<div/>', '<div/>', ''],
  ['<span> around ltx_para', '<span class="ltx_text">', '</span>'],
];

describe('loadBoundedDocument', () => {
  it.each(DEEP_INPUTS)('keeps %s nested 100,000 deep within the bound', async (_, open, close) => {
    const { document, droppedTags } = await loadBoundedDocument(
      `<html><body>${nested(open, close, 100_000)}</body></html>`,
    );
    expect(droppedTags).toBeGreaterThan(0);
    // The chain fills the bound exactly, `<html>` counting as the first level.
    expect(depthBelow(document)).toBe(MAX_XML_DEPTH);
    expect(document.body.textContent).toContain('deep');
  });

  it('keeps every element of a page of unclosed paragraphs, items, and cells', async () => {
    for (const tag of ['p', 'li', 'td']) {
      const { document, droppedTags } = await loadBoundedDocument(
        `<html><body>${`<${tag}>x`.repeat(1_000)}</body></html>`,
      );
      expect(droppedTags).toBe(0);
      expect(document.body.getElementsByTagName(tag)).toHaveLength(1_000);
    }
  });

  it('counts no tag inside raw text, a comment, or an attribute value', async () => {
    const tags = '<div>'.repeat(1_000);
    for (const html of [
      `<script>${tags}</script>`,
      `<style>${tags}</style>`,
      `<textarea>${tags}</textarea>`,
      // htmlparser2's tokenizer reads these as `<title>` and `<xmp>`.
      `<xitle>${tags}</title>`,
      `<tmp>${tags}</xmp>`,
      `<!--${tags}-->`,
      `<a title="${tags}">x</a>`,
      `<a title='${tags}'>x</a>`,
      `<svg>${'<path/>'.repeat(1_000)}</svg>`,
    ]) {
      expect(boundNesting(html, MAX_XML_DEPTH)).toEqual({ dropped: 0, html });
    }
  });

  it('ends raw text where htmlparser2 does', async () => {
    // Its tokenizer takes `<xitle>` for `<title>`, reads `\x1C/` as `</`, and opens
    // `<script/>` as markup.
    for (const prefix of ['<xitle>a</title>', '<script>\x1C/script>', '<script/>']) {
      const { document, droppedTags } = await loadBoundedDocument(
        `<html><body>${prefix}${nested('<div>', '</div>', 1_000)}</body></html>`,
      );
      expect(droppedTags).toBeGreaterThan(0);
      expect(depthBelow(document)).toBe(MAX_XML_DEPTH);
    }
  });

  it('bounds the depth of any soup of tags', async () => {
    const tokens = [
      '<p>',
      '</p>',
      '<li>',
      '<td>',
      '<tr>',
      '</td>',
      '<div>',
      '</div>',
      '<span>',
      '</span>',
      '<svg>',
      '</svg>',
      '<math>',
      '</math>',
      '<mi>',
      '</mi>',
      '<mi/>',
      '<div/>',
      '<math/>',
      '</br>',
      '<br>',
      '<title>',
      '</title>',
      '<xitle>',
      '<script>',
      '</script>',
      '\x1C\x0Fscript>',
      '<script/>',
      '<!--',
      '-->',
      '<a b=">">',
      'x',
      '<',
    ];
    let seed = 7;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let round = 0; round < 300; round++) {
      const max = 2 + Math.floor(random() * 10);
      let html = '';
      for (let i = 0; i < 200; i++) html += tokens[Math.floor(random() * tokens.length)];
      const bounded = boundNesting(`<html><body>${html}</body></html>`, max + 2);
      // Well within the loader's own bound, which then leaves the markup as it is.
      const { document } = await loadBoundedDocument(bounded.html);
      expect(depthBelow(document.body), html).toBeLessThanOrEqual(max);
    }
  });

  it.each([
    ['<math/>', '<math/>'],
    ['<svg/>', '<svg/>'],
    ['<b><mi>x</b>', '<b><mi>x</b>'],
  ])('loads %s repeated in time linear in the count', async (_, unit) => {
    // Each leaves one entry on htmlparser2's stack of foreign-content flags, which only an
    // explicit close tag of the same name removes, and which it grows by `unshift`.
    await expectLinear((n) => `<html><body>${unit.repeat(n)}</body></html>`, loadBoundedDocument, {
      from: 2_000,
      to: 128_000,
    });
  });

  it('keeps the text around foreign elements past the bound, and every one before it', async () => {
    const { document, droppedTags } = await loadBoundedDocument(
      `<html><body>${'<svg/>x'.repeat(1_000)}<p>end</p></body></html>`,
    );
    expect(droppedTags).toBe(1_000 - MAX_XML_DEPTH);
    expect(document.body.getElementsByTagName('svg')).toHaveLength(MAX_XML_DEPTH);
    expect(document.body.textContent).toBe(
      `${'x'.repeat(MAX_XML_DEPTH)}${' x'.repeat(1_000 - MAX_XML_DEPTH)}end`,
    );
  });

  it('loads a run of close tags no element matches in time linear in it', async () => {
    await expectLinear((n) => `${'<div>'.repeat(n)}${'</span>'.repeat(n)}`, loadBoundedDocument, {
      from: 1_000,
      to: 64_000,
    });
  });
});

describe('parseLatexml on deep nesting', () => {
  it.each(DEEP_INPUTS)('reads %s nested 100,000 deep, warning once', async (_, open, close) => {
    const document = await parse(
      page(
        `<div class="ltx_para"><p class="ltx_p">${nested(open, close, 100_000, '<span>deep</span>')}</p></div>`,
      ),
    );
    expect(JSON.stringify(document.body)).toContain('deep');
    expect(document.diagnostics.warnings.filter((w) => w.code === 'truncated-input')).toEqual([
      {
        code: 'truncated-input',
        message: expect.stringMatching(/^Markup nested deeper than 256 levels/),
      },
    ]);
  });

  it('reads a page of 1,000 unclosed paragraphs, items, and cells and warns nothing', async () => {
    const document = await parse(
      page(
        `<div class="ltx_para">${'<p class="ltx_p">p'.repeat(1_000)}${'<li>i'.repeat(1_000)}${'<td>c'.repeat(1_000)}</div>`,
      ),
    );
    expect(document.diagnostics.warnings).toEqual([]);
    const paragraphs = document.body.flatMap((section) => section.blocks);
    expect(
      paragraphs.filter((block) => block.type === 'paragraph' && block.text === 'p'),
    ).toHaveLength(999);
  });

  it('reads spans nested around a paragraph in time linear in their depth', async () => {
    const chain = (n: number) =>
      page(
        nested(
          '<span class="ltx_text">',
          '</span>',
          n,
          '<div class="ltx_para"><p class="ltx_p">x</p></div>',
        ),
      );
    await expectLinear(chain, parse, { from: 16, to: 4_096 });
  });

  it('reads 250-deep chains of spans around a paragraph about as fast as the same tags laid flat', async () => {
    const paragraph = '<div class="ltx_para"><p class="ltx_p">x</p></div>';
    const deep = nested('<span class="ltx_text">', '</span>', 250, paragraph);
    const flat = `${'<span class="ltx_text"></span>'.repeat(250)}${paragraph}`;
    const repeats = Math.ceil(2 ** 20 / deep.length);
    const time = async (html: string) => {
      await parse(html);
      let best = Number.POSITIVE_INFINITY;
      for (let sample = 0; sample < 3; sample++) {
        const started = cpuMs();
        await parse(html);
        best = Math.min(best, cpuMs() - started);
      }
      return best;
    };
    const flatMs = await time(page(flat.repeat(repeats)));
    const deepMs = await time(page(deep.repeat(repeats)));
    expect(deepMs, `${deepMs.toFixed(0)} ms deep, ${flatMs.toFixed(0)} ms flat`).toBeLessThan(
      3 * flatMs,
    );
  });
});

/** CPU time the calling thread has run for, in milliseconds. */
function cpuMs(): number {
  const { system, user } = process.threadCpuUsage();
  return (system + user) / 1000;
}
