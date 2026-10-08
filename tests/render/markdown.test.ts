/**
 * @fileoverview The renderers on a hand-built document: `toMarkdown` block by block and
 * with its options, `toText`, and the flat section list `toSections` returns.
 * @module tests/render/markdown.test
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseJats } from '../../src/formats/jats/index.js';
import type { Block, ScholarlyDocument, Section } from '../../src/model/document.js';
import { RESERVED_SECTION_ID } from '../../src/model/section-ids.js';
import { escapeInline, isSafeUrl } from '../../src/render/escape.js';
import { toMarkdown, toSections, toText } from '../../src/render/index.js';
import {
  emphasis,
  inlineCode,
  inlineMath,
  joinInlineSeams,
  link,
} from '../../src/render/inline.js';
import { MAX_BLOCK_NESTING } from '../../src/render/markdown.js';
import { stripInline } from '../../src/render/text.js';
import { CORPUS_DIR, type CorpusFormat, fixtureMetaSchema } from '../corpus/fixtures.js';
import { PARSERS } from '../corpus/parsers.js';
import { allSections } from '../corpus/walk.js';
import { gfmFindings, gfmMarkup, gfmSpans, gfmText } from '../gfm.js';
import { expectLinear } from '../linear.js';
import { cases, failures, type Random, SEEDS, seeded, sourceText } from '../property.js';

function section(id: string, fields: Partial<Section> = {}): Section {
  return { blocks: [], id, kind: 'body', sections: [], ...fields };
}

function documentOf(fields: Partial<ScholarlyDocument> = {}): ScholarlyDocument {
  return {
    abstracts: [],
    back: [],
    body: [],
    diagnostics: { quality: 'structured', unhandled: [], warnings: [] },
    floats: [],
    footnotes: [],
    format: 'jats',
    metadata: {},
    references: [],
    ...fields,
  };
}

/** Markdown for blocks in one untitled section, with nothing around them. */
function blocksMarkdown(blocks: Block[]): string {
  return toMarkdown(documentOf({ body: [section('s1', { blocks })] }), { metadata: false });
}

/**
 * Check that `toSections` gives each entry its own ID and that each ID renders, through
 * `toMarkdown`'s `sections` option, as its entry followed by its subsections' entries.
 */
function expectEachEntryRenders(document: ScholarlyDocument): void {
  const entries = toSections(document);
  const ids = entries.map((entry) => entry.id);
  expect(new Set(ids).size, ids.join(', ')).toBe(ids.length);
  entries.forEach((entry, index) => {
    // A section's subsections are the entries after it, up to the next one at its level or above.
    const next = entries.findIndex((later, i) => i > index && later.level <= entry.level);
    const own = entries.slice(index, next === -1 ? undefined : next);
    expect(toMarkdown(document, { sections: [entry.id] }), entry.id).toBe(
      `${own
        .map((e) => e.markdown)
        .filter(Boolean)
        .join('\n\n')}\n`,
    );
  });
}

/** Every model section's ID, abstracts' sections included. */
function allSectionIds(document: ScholarlyDocument): string[] {
  return allSections(document).map((s) => s.id);
}

/** A JATS article parsed from its XML. */
function jats(xml: string): ScholarlyDocument {
  const result = parseJats(new TextEncoder().encode(xml));
  if (!result.ok) throw new Error(result.error.message);
  return result.document;
}

const PAPER = documentOf({
  abstracts: [
    {
      kind: 'main',
      sections: [section('a1', { blocks: [{ text: 'We did this.', type: 'paragraph' }] })],
    },
    {
      kind: 'graphical',
      sections: [section('a2', { blocks: [{ caption: 'Overview', type: 'figure' }] })],
    },
  ],
  back: [
    section('b1', {
      blocks: [{ text: 'Thanks.', type: 'paragraph' }],
      kind: 'acknowledgments',
    }),
  ],
  body: [
    section('s1', {
      blocks: [{ text: 'Why.', type: 'paragraph' }],
      label: '1',
      sections: [
        section('s1.1', { blocks: [{ text: 'Detail.', type: 'paragraph' }], title: 'Scope' }),
      ],
      title: 'Introduction',
    }),
  ],
  footnotes: [{ label: '1', text: 'A note.' }],
  metadata: {
    authors: [{ name: 'Jane Doe' }, { name: 'Richard Roe' }],
    identifiers: { doi: '10.1234/abc', pmid: '123' },
    license: { url: 'https://creativecommons.org/licenses/by/4.0/' },
    published: { year: 2024 },
    related: [{ doi: '10.1234/r', relation: 'retraction-forward', text: 'Retracted: A study' }],
    title: 'A study',
    venue: { issue: '2', pages: '10–20', title: 'Journal', volume: '7' },
  },
  references: [{ label: '1', text: 'Alpha B. Title. 2020.' }],
});

describe('toMarkdown', () => {
  it('renders front matter, abstracts, the outline, back matter, notes, and references', () => {
    const parts = [
      '# A study',
      'Jane Doe, Richard Roe  \n*Journal*, 2024, 7(2), 10–20  \nDOI: 10.1234/abc · PMID: 123  \nLicense: <https://creativecommons.org/licenses/by/4.0/>  \nRelated (retraction-forward): Retracted: A study · DOI: 10.1234/r',
      '## Abstract\n\nWe did this.',
      '## Graphical abstract\n\n**Figure.** Overview',
      '## 1 Introduction\n\nWhy.\n\n### Scope\n\nDetail.',
      '## Acknowledgments\n\nThanks.',
      '## Footnotes\n\n- **1** A note.',
      '## References\n\n- [1] Alpha B. Title. 2020.',
    ];
    expect(toMarkdown(PAPER)).toBe(`${parts.join('\n\n')}\n`);
  });

  it('leaves out what the options turn off', () => {
    const markdown = toMarkdown(PAPER, {
      abstracts: 'main',
      back: false,
      footnotes: false,
      metadata: false,
      references: false,
    });
    expect(markdown).toBe(
      '## Abstract\n\nWe did this.\n\n## 1 Introduction\n\nWhy.\n\n### Scope\n\nDetail.\n',
    );
    expect(toMarkdown(PAPER, { abstracts: 'none', metadata: false })).toBe(
      '## 1 Introduction\n\nWhy.\n\n### Scope\n\nDetail.\n\n## Acknowledgments\n\nThanks.\n\n' +
        '## Footnotes\n\n- **1** A note.\n\n## References\n\n- [1] Alpha B. Title. 2020.\n',
    );
  });

  it('renders only the sections asked for, each with its subsections', () => {
    expect(toMarkdown(PAPER, { sections: ['s1.1', 'b1'] })).toBe(
      '### Scope\n\nDetail.\n\n## Acknowledgments\n\nThanks.\n',
    );
    expect(toMarkdown(PAPER, { sections: ['missing'] })).toBe('');
  });

  it('renders every entry toSections returns, by its ID, as that entry and its subsections', () => {
    const appendix = section('app', {
      kind: 'appendix',
      sections: [
        section('app.1', { blocks: [{ text: 'Part.', type: 'paragraph' }], kind: 'appendix' }),
      ],
    });
    const document = documentOf({
      ...PAPER,
      back: [...PAPER.back, appendix],
      floats: [{ caption: 'A chart.', label: 'Figure 1', type: 'figure' }],
    });
    expect(toSections(document).map((entry) => entry.id)).toEqual([
      'abstract-1',
      'abstract-2',
      's1',
      's1.1',
      'b1',
      'app',
      'app.1',
      'floats',
      'footnotes',
      'references',
    ]);
    expectEachEntryRenders(document);
  });

  it('renders the footnotes or the references by their IDs, whatever the other options say', () => {
    expect(toMarkdown(PAPER, { references: false, sections: ['references'] })).toBe(
      '## References\n\n- [1] Alpha B. Title. 2020.\n',
    );
    expect(toMarkdown(PAPER, { sections: ['references', 'footnotes', 's1.1'] })).toBe(
      '### Scope\n\nDetail.\n\n## Footnotes\n\n- **1** A note.\n\n## References\n\n- [1] Alpha B. Title. 2020.\n',
    );
    expect(toMarkdown(documentOf(), { sections: ['footnotes', 'references'] })).toBe('');
  });

  it.each([
    [
      'a body section with the ID of the first abstract',
      '<front><article-meta><abstract><p>We did this.</p></abstract></article-meta></front><body><sec id="abstract-1"><title>Intro</title><p>Body text.</p></sec></body>',
    ],
    [
      'a body section with the ID of the floats',
      '<body><sec id="floats"><title>Floats section</title><p>Body text.</p></sec></body><floats-group><fig id="f1"><label>Figure 1</label><caption><p>A chart.</p></caption></fig></floats-group>',
    ],
    [
      "a body section with the ID of the abstract's loose paragraphs",
      '<front><article-meta><abstract><p>We did this.</p></abstract></article-meta></front><body><sec id="abstract-1-1"><title>Intro</title><p>Body text.</p></sec></body>',
    ],
    [
      "an abstract's own section with the ID of the second abstract",
      '<front><article-meta><abstract><sec id="abstract-2"><title>Background</title><p>Main.</p></sec></abstract><abstract abstract-type="graphical"><p>Graphical.</p></abstract></article-meta></front><body><sec id="s1"><title>Intro</title><p>Body.</p></sec></body>',
    ],
    [
      'body sections with the IDs of the footnotes and the references',
      '<body><sec id="footnotes"><title>A</title><p>a<fn id="n1"><p>Note.</p></fn></p></sec><sec id="references"><title>B</title><p>b</p></sec></body><back><ref-list><ref id="r1"><mixed-citation>Alpha B. 2020.</mixed-citation></ref></ref-list></back>',
    ],
  ])('gives %s an ID of its own', (_, parts) => {
    const document = jats(`<article>${parts}</article>`);
    const ids = allSectionIds(document);
    expect(new Set(ids).size, ids.join(', ')).toBe(ids.length);
    expect(ids.filter((id) => RESERVED_SECTION_ID.test(id))).toEqual([]);
    expectEachEntryRenders(document);
  });

  it('renders the entries asked for in reading order', () => {
    const floats: Block[] = [{ caption: 'A chart.', type: 'figure' }];
    const document = { ...PAPER, floats };
    expect(toMarkdown(document, { sections: ['floats', 'b1', 'abstract-1'] })).toBe(
      '## Abstract\n\nWe did this.\n\n## Acknowledgments\n\nThanks.\n\n## Figures and tables\n\n**Figure.** A chart.\n',
    );
  });

  it('caps heading depth at six', () => {
    let deepest = section('s6', { title: 'Six' });
    for (let depth = 5; depth >= 1; depth--)
      deepest = section(`s${depth}`, { sections: [deepest], title: `Level ${depth}` });
    const markdown = toMarkdown(documentOf({ body: [deepest] }), { metadata: false });
    expect(markdown).toContain('###### Level 5\n\n###### Six');
  });

  it('heads an untitled section with its kind only where that kind begins', () => {
    const appendix = section('app', {
      kind: 'appendix',
      sections: [
        section('app.1', { blocks: [{ text: 'Part.', type: 'paragraph' }], kind: 'appendix' }),
      ],
    });
    expect(toMarkdown(documentOf({ back: [appendix] }), { metadata: false })).toBe(
      '## Appendix\n\nPart.\n',
    );
  });
});

describe('blocks', () => {
  it('writes a table with merged header rows and escaped cells', () => {
    expect(
      blocksMarkdown([
        {
          caption: 'Results',
          footnotes: ['a Mean.'],
          headerRows: 2,
          label: 'Table 1',
          rows: [
            ['Group', 'Score', 'Score'],
            ['', 'Pre', 'Post'],
            ['A | B', '1', '2'],
          ],
          type: 'table',
        },
      ]),
    ).toBe(
      '**Table 1.** Results\n\n| Group | Score / Pre | Score / Post |\n| --- | --- | --- |\n| A \\| B | 1 | 2 |\n\na Mean.\n',
    );
  });

  it('gives a table with no header rows an empty header, and no caption line when it has none', () => {
    expect(blocksMarkdown([{ headerRows: 0, rows: [['x', 'y']], type: 'table' }])).toBe(
      '|  |  |\n| --- | --- |\n| x | y |\n',
    );
  });

  it('writes a table with hundreds of thousands of rows', () => {
    const rows = Array.from({ length: 500_000 }, (_, i) => [String(i)]);
    const lines = blocksMarkdown([{ headerRows: 0, rows, type: 'table' }])
      .trimEnd()
      .split('\n');
    expect(lines).toHaveLength(500_002);
    expect(lines.at(-1)).toBe('| 499999 |');
  });

  it('says why a table has no content', () => {
    expect(
      blocksMarkdown([
        { headerRows: 0, label: 'Table 2', rows: [], type: 'table', unextractable: 'graphic-only' },
      ]),
    ).toBe('**Table 2.**\n\n*Table content not available (graphic-only).*\n');
  });

  it('writes formulas as math blocks, text, or an image marker, each with its label', () => {
    expect(
      blocksMarkdown([
        { label: '(1)', tex: 'E = mc^2', type: 'formula' },
        { label: '2', text: 'a < b', type: 'formula' },
        { href: 'e3.gif', label: '(3)', type: 'formula' },
      ]),
    ).toBe('$$\nE = mc^2 \\tag{1}\n$$\n\na < b (2)\n\n[formula] (3)\n');
  });

  it('writes display math holding a long run of spaces in time linear in it', async () => {
    const formula = (n: number): Block[] => [{ tex: `a${' '.repeat(n)}b\n  c`, type: 'formula' }];
    expect(blocksMarkdown(formula(128_000))).toBe(`$$\na${' '.repeat(128_000)}b c\n$$\n`);
    await expectLinear(formula, blocksMarkdown, { from: 2_000, to: 128_000 });
  });

  it('nests lists, quotes boxes, and fences code', () => {
    expect(
      blocksMarkdown([
        {
          items: [
            [
              { text: 'First.', type: 'paragraph' },
              { items: [[{ text: 'Inner.', type: 'paragraph' }]], ordered: false, type: 'list' },
            ],
            [{ text: 'Second.', type: 'paragraph' }],
          ],
          ordered: true,
          title: 'Steps',
          type: 'list',
        },
        {
          blocks: [{ text: 'Boxed.', type: 'paragraph' }],
          label: 'Box 1',
          sections: [],
          title: 'Key points',
          type: 'box',
        },
        { language: 'python', text: 'print("```")', type: 'code' },
      ]),
    ).toBe(
      '**Steps**\n\n1. First.\n\n   - Inner.\n2. Second.\n\n> **Box 1 Key points**\n>\n> Boxed.\n\n````python\nprint("```")\n````\n',
    );
  });

  it('keeps a paragraph that begins like block markup a paragraph', () => {
    expect(blocksMarkdown([{ text: '# 5 patients', type: 'paragraph' }])).toBe('\\# 5 patients\n');
  });

  it('labels figures and supplements, and leaves out a figure with nothing to show', () => {
    expect(
      blocksMarkdown([
        { caption: 'A cell.', label: 'Figure 1:', type: 'figure' },
        { href: 'f2.png', type: 'figure' },
        { href: 'data.xlsx', type: 'supplement' },
      ]),
    ).toBe('**Figure 1.** A cell.\n\n**Supplementary material.** (file: data.xlsx)\n');
  });
});

describe('nesting past eight levels', () => {
  const p = (text: string): Block => ({ text, type: 'paragraph' });

  /** A list nested `depth` deep: each item holds its level's paragraph, then the next list. */
  function nestedList(depth: number): Block {
    let block: Block = { items: [[p(`L${depth}`)]], ordered: false, type: 'list' };
    for (let level = depth - 1; level >= 1; level--)
      block = { items: [[p(`L${level}`), block]], ordered: false, type: 'list' };
    return block;
  }

  /** Quotes nested `depth` deep, each opening with its level's paragraph. */
  function nestedQuote(depth: number): Block {
    let block: Block = { blocks: [p(`Q${depth}`)], type: 'quote' };
    for (let level = depth - 1; level >= 1; level--)
      block = { blocks: [p(`Q${level}`), block], type: 'quote' };
    return block;
  }

  const lines = (markdown: string) => markdown.split('\n').filter(Boolean);

  it('caps list, quote, and box nesting at eight levels', () => {
    expect(MAX_BLOCK_NESTING).toBe(8);
  });

  it('renders nesting of eight levels as before', () => {
    const expected = Array.from({ length: 8 }, (_, i) => `${'  '.repeat(i)}- L${i + 1}`);
    expect(blocksMarkdown([nestedList(8)])).toBe(`${expected.join('\n\n')}\n`);
    expect(lines(blocksMarkdown([nestedQuote(8)])).filter((line) => /Q/.test(line))).toEqual(
      Array.from({ length: 8 }, (_, i) => `${'> '.repeat(i + 1)}Q${i + 1}`),
    );
  });

  it('indents list items past the eighth level like the eighth, and adds no quote marker', () => {
    const indent = (level: number) => '  '.repeat(Math.min(level, 8) - 1);
    expect(lines(blocksMarkdown([nestedList(10)]))).toEqual(
      Array.from({ length: 10 }, (_, i) => `${indent(i + 1)}- L${i + 1}`),
    );
    expect(lines(blocksMarkdown([nestedQuote(10)])).filter((line) => /Q/.test(line))).toEqual(
      Array.from({ length: 10 }, (_, i) => `${'> '.repeat(Math.min(i + 1, 8))}Q${i + 1}`),
    );
  });

  it('keeps an ordered item its number and a box its title past the eighth level', () => {
    const box: Block = { blocks: [p('Boxed.')], sections: [], title: 'Key', type: 'box' };
    const deep: Block = { items: [[p('first')], [p('second'), box]], ordered: true, type: 'list' };
    let block = deep;
    for (let level = 8; level >= 1; level--)
      block = { items: [[p(`L${level}`), block]], ordered: false, type: 'list' };
    expect(lines(blocksMarkdown([block])).slice(-4)).toEqual([
      `${'  '.repeat(7)}1. first`,
      `${'  '.repeat(7)}2. second`,
      `${'  '.repeat(7)}   **Key**`,
      `${'  '.repeat(7)}   Boxed.`,
    ]);
  });

  it('renders a list and a quote nested 100,000 deep, in proportion to their size', () => {
    const depth = 100_000;
    // A line and a blank line per level, each prefixed by at most eight levels of markers.
    const bound = 50 * depth;
    const items = (text: string) => text.split('\n').filter((line) => /[LQ]\d/.test(line));
    for (const [block, deepest, deepestText] of [
      [nestedList(depth), `${'  '.repeat(7)}- L${depth}`, `${'  '.repeat(7)}- L${depth}`],
      [nestedQuote(depth), `${'> '.repeat(8)}Q${depth}`, `Q${depth}`],
    ] as const) {
      const document = documentOf({ body: [section('s1', { blocks: [block] })] });
      const markdown = toMarkdown(document);
      const text = toText(document);
      expect(markdown.length).toBeLessThan(bound);
      expect(text.length).toBeLessThan(bound);
      // Every level is written, down to the deepest.
      expect(items(markdown)).toHaveLength(depth);
      expect(items(markdown).at(-1)).toBe(deepest);
      expect(items(text)).toHaveLength(depth);
      expect(items(text).at(-1)).toBe(deepestText);
      expect(toSections(document)[0]?.chars).toBe(markdown.length - 1);
    }
  });

  it('renders a list nested 2,000 deep at under four times the page it came from', () => {
    // The model `parseHtml` reads from this page on a runtime with a deeper stack than Node's.
    const html = `<html><head><meta name="citation_title" content="T"></head><body><article><h1>T</h1><h2>Intro</h2><p>intro</p>${'<ul><li>a'.repeat(2_000)}${'</li></ul>'.repeat(2_000)}</article></body></html>`;
    let list: Block = { items: [[p('a')]], ordered: false, type: 'list' };
    for (let level = 1; level < 2_000; level++)
      list = { items: [[p('a'), list]], ordered: false, type: 'list' };
    const document = documentOf({
      body: [section('s1', { blocks: [p('intro'), list], title: 'Intro' })],
      metadata: { title: 'T' },
    });
    const markdown = toMarkdown(document);
    expect(markdown.length).toBeLessThan(4 * html.length);
    expect(markdown.split('\n').filter((line) => /^ *- a$/.test(line))).toHaveLength(2_000);
  });
});

describe('source text that would become markup', () => {
  it('writes plain-text metadata fields and an unsafe license URL as text', () => {
    const markdown = toMarkdown(
      documentOf({
        metadata: {
          identifiers: { pmcid: 'PMC1<b>', pmid: '<img src=x onerror=alert(1)>' },
          license: { url: 'javascript:alert(2)' },
          related: [{ pmid: '<img src=y>', relation: 'commentary' }],
        },
      }),
    );
    expect(markdown).toBe(
      'PMID: \\<img src=x onerror=alert(1)> · PMCID: PMC1\\<b>  \nLicense: javascript:alert(2)  \nRelated (commentary): PMID: \\<img src=y>\n',
    );
    const angled = toMarkdown(
      documentOf({ metadata: { license: { url: 'https://x.org/a><img src=z>' } } }),
    );
    expect(angled).toBe('License: <https://x.org/a%3E%3Cimg%20src=z%3E>\n');
  });

  it('keeps a bare URL in a metadata line from taking in the escape after it', () => {
    const document = jats(
      '<article xmlns:xlink="http://www.w3.org/1999/xlink"><front><article-meta><permissions>' +
        '<license><license-p>See https://a.co/x&lt;b&gt;bold&lt;/b&gt;</license-p></license>' +
        '</permissions></article-meta></front><body><p>Text.</p></body></article>',
    );
    const markdown = toMarkdown(document);
    expect(markdown).toContain('License: See <https://a.co/x>\\<b>bold\\</b>');
    expect(gfmMarkup(markdown)).toEqual(['link:https://a.co/x']);
    expect(toText(document)).toContain('License: See https://a.co/x<b>bold</b>');
  });

  it('keeps a bare URL in one venue field from taking in the escape the next one writes', () => {
    const markdown = toMarkdown(
      documentOf({
        metadata: { venue: { issue: '<img src=x>', title: 'J', volume: 'https://a.co/x' } },
      }),
    );
    // The volume's URL is written as an autolink that ends where the volume does.
    expect(markdown).toBe('*J*, <https://a.co/x(>\\<img src=x>)\n');
    expect(gfmMarkup(markdown)).toEqual(['emphasis', 'link:https://a.co/x(']);
    expect(gfmText(markdown)).toBe('J, https://a.co/x(<img src=x>)');
  });

  it('escapes what would open a block at the start of each metadata line', () => {
    const markdown = toMarkdown(
      documentOf({
        metadata: {
          authors: [{ name: '# A' }],
          title: 'T',
          venue: { issue: '<img src=x>', volume: '>www.' },
        },
      }),
    );
    expect(markdown).toBe('# T\n\n\\# A  \n\\>www.(\\<img src=x>)\n');
    expect(gfmFindings(markdown, { text: markdown }, { textPassLinks: false })).toEqual([]);
  });

  it('keeps emphasis whose edge punctuation meets a word rendering, at every depth', () => {
    const document = jats(
      '<article><body><sec><title>A</title><sec><title>B <italic>(x)</italic>y</title>' +
        '<p>in a <italic>daf-16-</italic>dependent way and <bold>a<italic>(x)</italic>b</bold>.</p>' +
        '<p>lifespan<italic>.</italic> We</p>' +
        '<fig id="f1"><label>Figure 1</label><caption><p>A <italic>daf-16-</italic>dependent' +
        ' clone.</p></caption></fig></sec></sec></body></article>',
    );
    const markdown = toMarkdown(document);
    expect(markdown).toBe(
      [
        '## A',
        // Only the marker the word blocks moves: the opener after a space already opens.
        '### B *(x*)y',
        'in a *daf-16*-dependent way and **a(*x*)b**.',
        // Emphasis over punctuation alone loses its markers.
        'lifespan. We',
        '**Figure 1.** A *daf-16*-dependent clone.\n',
      ].join('\n\n'),
    );
    expect(gfmSpans(markdown)).toEqual([
      'emphasis:(x',
      'emphasis:daf-16',
      'strong:a(x)b',
      'emphasis:x',
      'strong:Figure 1.',
      'emphasis:daf-16',
    ]);
    const text = toText(document);
    expect(text).toBe(
      'A\n\nB (x)y\n\nin a daf-16-dependent way and a(x)b.\n\nlifespan. We\n\nFigure 1. A daf-16-dependent clone.\n',
    );
    expect(text.replace(/\n+/g, '\n').trim()).toBe(gfmText(markdown));
  });

  it('joins touching spans of one kind, and drops emphasis over punctuation a strong run shares', () => {
    const document = jats(
      '<article><body><p><bold>K</bold><bold>-step</bold>: update, <italic>a</italic><italic>b</italic>,' +
        ' and <bold>Table 1<italic>.</italic></bold> next.</p></body></article>',
    );
    const markdown = toMarkdown(document);
    expect(markdown).toBe('**K-step**: update, *ab*, and **Table 1.** next.\n');
    expect(gfmSpans(markdown)).toEqual(['strong:K-step', 'emphasis:ab', 'strong:Table 1.']);
    expect(toText(document)).toBe('K-step: update, ab, and Table 1. next.\n');
    expect(gfmText(markdown)).toBe(toText(document).trim());
  });

  it('leaves emphasis GFM pairs whole as written, however it was meant', () => {
    // The nested strong pairs as written; freeing `(**a` to close would take the outer opener.
    const markdown = toMarkdown(
      jats(
        '<article><body><p><bold>T (<bold>a</bold>) b. (<bold>c</bold>) d.</bold></p></body></article>',
      ),
    );
    expect(markdown).toBe('**T (**a**) b. (**c**) d.**\n');
    expect(gfmSpans(markdown)).toEqual(['strong:T (a) b. (c) d.', 'strong:a', 'strong:c']);
  });

  it('escapes figure alt text and drops a code language that is not a name', () => {
    expect(
      blocksMarkdown([
        { alt: '<img src=x onerror=alert(1)> *a*', type: 'figure' },
        { language: 'x`\n<b>', text: 'code', type: 'code' },
        { language: 'c++', text: 'code', type: 'code' },
      ]),
    ).toBe(
      '**Figure.** \\<img src=x onerror=alert(1)> \\*a\\*\n\n```\ncode\n```\n\n```c++\ncode\n```\n',
    );
  });

  it('keeps display TeX on its lines and its tag label out of the TeX', () => {
    expect(
      blocksMarkdown([
        { label: '1}\n$$\n<script>', tex: 'a<b\n\n$$\n[x](javascript:y)', type: 'formula' },
      ]),
    ).toBe('$$\na< b $$ [x] (javascript:y) \\tag{1 script}\n$$\n');
  });

  it('keeps text that reads as a link reference definition from defining one', () => {
    const markdown = toMarkdown(
      documentOf({
        body: [
          section('s1', {
            blocks: [
              { text: '[a]: javascript:alert(1)', type: 'paragraph' },
              {
                footnotes: ['[d]: javascript:alert(4)'],
                headerRows: 0,
                rows: [['x']],
                type: 'table',
              },
            ],
          }),
        ],
        footnotes: [{ text: '[b]: javascript:alert(2)' }],
        references: [{ text: '[c]: javascript:alert(3)' }],
      }),
    );
    expect(markdown).toBe(
      '\\[a]: javascript:alert(1)\n\n|  |\n| --- |\n| x |\n\n\\[d]: javascript:alert(4)\n\n## Footnotes\n\n- \\[b]: javascript:alert(2)\n\n## References\n\n- \\[c]: javascript:alert(3)\n',
    );
  });
});

describe('toText', () => {
  it('removes the markup this package writes', () => {
    const document = documentOf({
      body: [
        section('s1', {
          blocks: [
            {
              text: 'Some **bold**, *italic*, `code`, [a link](https://example.org), <https://x.org>, and a \\* star.',
              type: 'paragraph',
            },
            { headerRows: 1, rows: [['H'], ['v']], type: 'table' },
          ],
          title: 'Results',
        }),
      ],
    });
    expect(toText(document, { metadata: false })).toBe(
      'Results\n\nSome bold, italic, code, a link, https://x.org, and a * star.\n\n| H |\n\n| v |\n',
    );
  });

  it('keeps escaped backticks as text and a run with no partner as written', () => {
    const document = documentOf({
      body: [
        section('s1', {
          blocks: [
            { text: 'Run \\`ls\\`, then `rm -r`, `` a`b ``, and ```x``.', type: 'paragraph' },
          ],
        }),
      ],
    });
    expect(toText(document, { metadata: false })).toBe('Run `ls`, then rm -r, a`b, and ```x``.\n');
  });

  it('reads a long run of backticks in time linear in it', async () => {
    const code = (n: number) =>
      documentOf({
        body: [section('s1', { blocks: [{ text: `a${'`'.repeat(n)}b`, type: 'code' }] })],
      });
    const text = (document: ScholarlyDocument) => toText(document, { metadata: false });
    expect(text(code(64_000))).toBe(`a${'`'.repeat(64_000)}b\n`);
    await expectLinear(code, text, { from: 1_000, to: 64_000 });
  });

  it('reads long runs of unclosed brackets and link destinations in time linear in them', async () => {
    const runs = (n: number) =>
      documentOf({
        body: [
          section('s1', {
            blocks: [
              { text: '['.repeat(n), type: 'paragraph' },
              { text: '[]('.repeat(n), type: 'paragraph' },
            ],
          }),
        ],
      });
    const text = (document: ScholarlyDocument) => toText(document, { metadata: false });
    expect(text(runs(64_000))).toBe(`${'['.repeat(64_000)}\n\n${'[]('.repeat(64_000)}\n`);
    await expectLinear(runs, text, { from: 1_000, to: 64_000 });
  });

  it('leaves code and TeX as written, and drops the code fence lines', () => {
    const document = documentOf({
      body: [
        section('s1', {
          blocks: [
            { text: 'Use `a*b*c` or `[x](y)`.', type: 'paragraph' },
            { text: 'Let $a*b*c$ and $\\{x\\}\\,y$ hold.', type: 'paragraph' },
            { language: 'python', text: 'y = a*b*c  # **ok**\nprint("\\\\n")', type: 'code' },
            { tex: '\\{x \\mid x_1\\} \\, a*b*c', type: 'formula' },
          ],
        }),
      ],
    });
    expect(toText(document, { metadata: false })).toBe(
      'Use a*b*c or [x](y).\n\nLet $a*b*c$ and $\\{x\\}\\,y$ hold.\n\ny = a*b*c  # **ok**\nprint("\\\\n")\n\n\\{x \\mid x_1\\} \\, a*b*c\n',
    );
  });

  it('keeps code lines that look like block markup, in a list item or a quote too', () => {
    const code: Block = { text: '# not a heading\n> not a quote\n| --- |\n$$\n\\*', type: 'code' };
    const lines = '# not a heading\n> not a quote\n| --- |\n$$\n\\*';
    const document = documentOf({
      body: [
        section('s1', {
          blocks: [
            code,
            { items: [[{ text: 'Step.', type: 'paragraph' }, code]], ordered: false, type: 'list' },
            { items: [[code]], ordered: true, type: 'list' },
            { blocks: [code], type: 'quote' },
          ],
        }),
      ],
    });
    const indented = (prefix: string) =>
      lines
        .split('\n')
        .map((line) => prefix + line)
        .join('\n');
    expect(toText(document, { metadata: false })).toBe(
      `${lines}\n\n- Step.\n\n${indented('  ')}\n\n1. ${indented('   ').slice(3)}\n\n${lines}\n`,
    );
  });

  it('strips quote markers at every depth', () => {
    const deep: Block = { blocks: [{ text: 'deep', type: 'paragraph' }], type: 'quote' };
    const document = documentOf({
      body: [
        section('s1', {
          blocks: [
            { blocks: [deep], type: 'quote' },
            { items: [[deep]], ordered: false, type: 'list' },
          ],
        }),
      ],
    });
    expect(toText(document, { metadata: false })).toBe('deep\n\n- deep\n');
  });

  it('reads long runs of unclosed autolinks in time linear in them', async () => {
    await expectLinear(
      (n) =>
        documentOf({
          body: [section('s1', { blocks: [{ text: '\\<https:'.repeat(n), type: 'paragraph' }] })],
        }),
      (document) => toText(document, { metadata: false }),
      { from: 250, to: 64_000 },
    );
  });

  it('reads a link whose text holds brackets as its text alone', () => {
    const paragraphs = [
      '[A [trial] result](https://example.org)',
      '[see `a]b`](https://example.org)',
      'arXiv:[2304.05660 [math.NA]](https://arxiv.org/abs/2304.05660)',
      '[[email protected]](https://www.medrxiv.org/cdn-cgi/l/email-protection)',
      '[x\\](y)',
      '[a \\] b](https://example.org)',
    ];
    const document = documentOf({
      body: [section('s1', { blocks: paragraphs.map((text) => ({ text, type: 'paragraph' })) })],
    });
    expect(toText(document, { metadata: false }).split('\n\n')).toEqual([
      'A [trial] result',
      'see a]b',
      'arXiv:2304.05660 [math.NA]',
      '[email protected]',
      '[x](y)',
      'a ] b\n',
    ]);
  });

  it('reads back the text of a link written around a bracket with no partner', () => {
    for (const label of ['A trial] result', 'A [trial result', 'see $[0,1)$', '$a]$ b]']) {
      const text = link(label, 'https://example.org');
      expect(stripInline(text)).toBe(label);
    }
  });

  it.each([
    ['latexml', 'arxiv-2402.16746v1'],
    ['html', 'medrxiv-2026.05.05.26351600v2'],
  ] as const)('leaves no link in the text of corpus/%s/%s', async (format, name) => {
    const dir = join(CORPUS_DIR, format, name);
    const { url } = fixtureMetaSchema.parse(
      JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')),
    );
    const source = new Uint8Array(readFileSync(join(dir, 'source.html')));
    const result = await PARSERS[format as CorpusFormat]?.(source, url);
    if (!result?.ok) throw new Error(`corpus/${format}/${name} did not parse`);
    expect(toMarkdown(result.document)).toMatch(/\]\(http/);
    expect(toText(result.document)).not.toMatch(/\]\(http/);
  });

  it('keeps a ! that comes right before a link', () => {
    expect(stripInline('Wow\\![x](https://x.org)')).toBe('Wow!x');
  });

  it('reads links nested deep in time linear in their depth', async () => {
    await expectLinear((n) => `${'['.repeat(n)}x${'](https://x.org)'.repeat(n)}`, stripInline, {
      from: 250,
      to: 64_000,
    });
    expect(stripInline('[*a [b*](u) c*](v) d')).toBe('a b* c d');
  });
});

/** Inline Markdown built as the readers build it, and what its source holds. */
interface Built {
  hrefs: string[];
  /** Every formula's TeX reads as written in GFM, which has no math: no backslash escape in it. */
  literalMath: boolean;
  markdown: string;
  /** The source's text, a link's target where the link renders as it. */
  text: string;
}

const BUILT_URLS = [
  'https://y.org',
  'https://y.org/a_b',
  'http://z.org/(x)',
  'https://y.org/x\\',
  'https://y.org/a b',
  'https://y.org/&amp;x',
  'https://y.org/$x',
  'www.q.org',
  'mailto:a@b.org',
  'javascript:alert(1)',
];

const BUILT_TEX = [
  'x',
  'x^2',
  'a_{b}',
  '\\alpha',
  'a`b',
  'a\\',
  'a$b',
  '\\\\',
  '<img src=x>',
  '[a](b)',
];

/** One to three pieces of inline Markdown from `escapeInline`, `emphasis`, `link`, `inlineMath`, and `inlineCode`, nested up to three deep. */
function built(random: Random, depth = 0): Built {
  const out: Built = { hrefs: [], literalMath: true, markdown: '', text: '' };
  for (let n = 1 + random.int(3); n > 0; n--) {
    const piece = builtPiece(random, depth);
    out.hrefs.push(...piece.hrefs);
    out.literalMath &&= piece.literalMath;
    out.markdown += piece.markdown;
    out.text += piece.text;
  }
  return out;
}

function builtPiece(random: Random, depth: number): Built {
  const plain = { hrefs: [], literalMath: true };
  switch (depth > 2 ? 0 : random.int(7)) {
    case 1:
    case 2: {
      const inner = built(random, depth + 1);
      return { ...inner, markdown: emphasis(inner.markdown, random.pick(['*', '**', '~~'])) };
    }
    case 3: {
      const inner = random.chance(0.2)
        ? { ...plain, markdown: '', text: '' }
        : built(random, depth + 1);
      const url = random.pick(BUILT_URLS);
      const markdown = link(inner.markdown, url);
      const text = isSafeUrl(url)
        ? markdown.startsWith('<')
          ? url
          : inner.text
        : inner.markdown
          ? inner.text
          : url;
      return { ...inner, hrefs: [...inner.hrefs, url], markdown, text };
    }
    case 4: {
      const markdown = inlineMath(random.pick(BUILT_TEX));
      return {
        ...plain,
        literalMath: !/\\[!-/:-@[-`{-~]/.test(markdown),
        markdown,
        text: markdown,
      };
    }
    case 5: {
      const code = sourceText(random, 4).replace(/\s+/g, ' ');
      return { ...plain, markdown: inlineCode(code), text: code };
    }
    default: {
      const text = sourceText(random, 8);
      return { ...plain, markdown: escapeInline(text), text };
    }
  }
}

/**
 * True for a link whose destination source text spells after a `](` split across pieces,
 * run on into the markup a later piece writes (`[](http:` then a struck-through `)` links
 * `http:~~`). `link` writes a destination's `*`, `~`, `_`, `^`, braces, and brackets as they
 * are, so the seam pass cannot tell that `](` from one `link` writes; `docs/design.md`
 * names it as outside what the escaping bounds.
 */
function runsOnFromSplitLink(finding: string, text: string): boolean {
  if (!finding.startsWith('link:')) return false;
  const url = finding.slice('link:'.length);
  for (const { index } of text.matchAll(/\]\((?=(?:https?|ftp|mailto):)/gi)) {
    const spelled = text.slice(index + 2);
    let common = 0;
    while (common < url.length && url[common] === spelled[common]) common++;
    if (common > url.indexOf(':') && common < url.length) return true;
  }
  return false;
}

/**
 * The letters and digits of `text`, which escaping, markers, and a link's encoded spaces
 * (`a%20b` for `a b`, the one encoding the built URLs need) never change.
 */
function words(text: string): string {
  return text.replaceAll('%20', '').replace(/[^\p{L}\p{N}]/gu, '');
}

describe('stripInline', () => {
  it.each(SEEDS)(
    'reads generated inline Markdown as GFM does, and the Markdown holds no markup its source lacks, seed %i',
    (seed) => {
      const read = ({ hrefs, literalMath, markdown, text }: Built) => {
        const joined = joinInlineSeams(`x ${markdown} x`);
        const problems = gfmFindings(
          joined,
          { hrefs, markers: '*~', text: `x ${text} x` },
          { textPassLinks: false },
        ).filter((finding) => !runsOnFromSplitLink(finding, text));
        const stripped = stripInline(joined);
        // Every letter and digit of the source reads back, so no finding comes of text lost.
        if (words(stripped) !== words(`x ${text} x`))
          problems.push(`${JSON.stringify(joined)} reads as ${JSON.stringify(stripped)}`);
        // GFM reads a backslash escape in TeX as one; inline math is kept as written.
        if (literalMath && stripped !== gfmText(joined))
          problems.push(`${JSON.stringify(joined)} strips to ${JSON.stringify(stripped)}`);
        return problems;
      };
      expect(failures(cases(seeded(seed), 400, built), read)).toEqual([]);
    },
  );

  it('removes emphasis in pairs and leaves a delimiter with no partner as written', () => {
    expect(stripInline('**a *b* c**, ~~d~~, *a\\*b*, **~~e~~**, and 2 * 3 **')).toBe(
      'a b c, d, a*b, e, and 2 * 3 **',
    );
  });

  it.each([
    ['**x (*t*) y**', 'x (t) y'],
    ['**a*b*c**', 'abc'],
    ['**V*max***', 'Vmax'],
    ['**(*a*)**', '(a)'],
    ['*(**a**)*', '(a)'],
    ['**Plot of *I*(*t*) for different choice of κ.**', 'Plot of I(t) for different choice of κ.'],
    ['*a*b*', 'ab*'],
    ['**~~e~~** and ~~(a)~~b', 'e and ~~(a)~~b'],
    ['*Rules*.We and a(**x**)b and **a *b*.c**', 'Rules.We and a(x)b and a b.c'],
    // A `*` beside a `~` opens or closes as micromark's GFM reads it, whatever the flank.
    ['a*~~b~~*c', 'abc'],
    ['x*~~(a)~~*y', 'x(a)y'],
    // Emphasis resolves before strikethrough when a `*` comes first: the `~~` stay text.
    ['*~~*/*~~*', '~~/~~'],
  ])('pairs emphasis as GFM does, by its flanking rules: %j', (markdown, text) => {
    expect(stripInline(markdown)).toBe(text);
    expect(stripInline(markdown)).toBe(gfmText(markdown));
  });

  it.each([
    // An opener left with markers after a pair can pair again with a closer it barred before.
    ['x ****)**`b`****\\*** x', 'x )**b*** x'],
    ['x ****/**\\&**\\~****\\\\ x', 'x /&~\\ x'],
    // Strikethrough resolves first when a tilde run comes first, link text included.
    ['~~/~~*~~*/*~~*', '//'],
    ['[~~](https://a.co) *~~*/*~~*', '~~ /'],
    ['~~\\!~~*~~*.*~~*', '!.'],
    ['~~a~~ *~~b*~~*', 'a b*'],
    // In link text, strikethrough resolves first wherever the first run stands.
    ['[x *~a*~ y](https://a.co)', 'x *a* y'],
    ['*q* [x *~a*~ y](https://a.co)', 'q x *a* y'],
    // An underscore GFM reads as an emphasis run puts emphasis first, in math too.
    ['y_z ~~x~~ *~~*y*~~*', 'y_z x ~~y~~'],
    ['$a_b$ ~~*~~*y*~~*', '$a_b$ ~~~~y~~'],
    ['x $a_{b}$~~*~~;~~*~~ x', 'x $a_{b}$; x'],
    ['[https://y.org/a_b](mailto:x) ~~*~~*y*~~*', 'https://y.org/a_b ~~~~y~~'],
    ['www.a_b.co/x ~~*~~*y*~~*', 'www.a_b.co/x ~~~~y~~'],
    ['x/me_x@a.co ~~*~~*y*~~*', 'x/me_x@a.co ~~~~y~~'],
    // One inside a code span, or an autolink literal GFM forms, does not.
    ['`a_b` ~~*~~*y*~~*', 'a_b *y~~*'],
    ['https://y.org/a_b ~~x~~ *~~*y*~~*', 'https://y.org/a_b x y'],
    ['me_x@a.co ~~*~~*y*~~*', 'me_x@a.co *y~~*'],
  ])('pairs emphasis and strikethrough in the order GFM resolves them: %j', (markdown, text) => {
    expect(gfmText(markdown)).toBe(text);
    expect(stripInline(markdown)).toBe(text);
  });

  it.each([
    ['jats', 'epmc-pmc10702718'],
    ['jats', 'epmc-pone.0310152'],
    ['html', 'plos-pone.0310152'],
  ] as const)('leaves no strong marker in the text of corpus/%s/%s', async (format, name) => {
    const dir = join(CORPUS_DIR, format, name);
    const { url } = fixtureMetaSchema.parse(
      JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')),
    );
    const source = new Uint8Array(
      readFileSync(join(dir, format === 'jats' ? 'source.xml' : 'source.html')),
    );
    const result = await PARSERS[format as CorpusFormat]?.(source, url);
    if (!result?.ok) throw new Error(`corpus/${format}/${name} did not parse`);
    expect(toMarkdown(result.document)).toContain('**');
    expect(toText(result.document)).not.toContain('**');
  });

  it('keeps a link destination out of the text and an escaped angle bracket in it', () => {
    expect(
      stripInline('[the $x$ value](https://x.org/$a), \\<https://y.org>, <https://z.org>'),
    ).toBe('the $x$ value, <https://y.org>, https://z.org');
  });

  it.each([
    '**x ',
    '*x ',
    '~~x ',
    '\\<https:',
    '<https:',
    '$x \\$',
    '[x](',
    '`x ``',
    '[[x',
    '[a [b]',
    '[`]`',
    '[\\]',
    '(*',
    '*(',
    '*a(**',
    // Underscores in autolink literals, read for which kind GFM resolves first.
    'w_@x.yz,',
    'https://a.co/_ ',
    'https://a.co/_',
    'a_b@c_d.e',
    '(www.a_',
    '$\\_~~~$',
  ])('reads a long run of %j in time linear in it', async (run) => {
    await expectLinear((n) => run.repeat(n), stripInline, { from: 250, to: 64_000 });
  });
});

describe('toSections', () => {
  it('lists every section in reading order with its path, depth, and size', () => {
    const sections = toSections(PAPER);
    expect(sections.map(({ id, kind, level, path }) => ({ id, kind, level, path }))).toEqual([
      { id: 'abstract-1', kind: 'abstract', level: 1, path: ['Abstract'] },
      { id: 'abstract-2', kind: 'abstract', level: 1, path: ['Graphical abstract'] },
      { id: 's1', kind: 'body', level: 1, path: ['1 Introduction'] },
      { id: 's1.1', kind: 'body', level: 2, path: ['1 Introduction', 'Scope'] },
      { id: 'b1', kind: 'acknowledgments', level: 1, path: ['Acknowledgments'] },
      { id: 'footnotes', kind: 'footnotes', level: 1, path: ['Footnotes'] },
      { id: 'references', kind: 'references', level: 1, path: ['References'] },
    ]);
    const intro = sections[2];
    expect(intro?.markdown).toBe('## 1 Introduction\n\nWhy.');
    expect(intro?.chars).toBe(intro?.markdown.length);
    expect(sections[4]?.markdown).toBe('## Acknowledgments\n\nThanks.');
  });

  it('ends with the figures and tables outside any section, as toMarkdown renders them', () => {
    const floats: Block[] = [
      { caption: 'A chart.', label: 'Figure 1', type: 'figure' },
      { headerRows: 1, rows: [['a'], ['1']], type: 'table' },
    ];
    const markdown = '## Figures and tables\n\n**Figure 1.** A chart.\n\n| a |\n| --- |\n| 1 |';
    const document = { ...PAPER, floats };
    expect(toSections(document).at(-3)).toEqual({
      chars: markdown.length,
      id: 'floats',
      kind: 'floats',
      level: 1,
      markdown,
      path: ['Figures and tables'],
      title: 'Figures and tables',
    });
    expect(toMarkdown(document)).toContain(`\n\n${markdown}\n\n`);
    expect(toSections(PAPER).map((entry) => entry.kind)).not.toContain('floats');
  });

  it('ends with the footnotes and then the references, as toMarkdown renders them', () => {
    const footnotes = '## Footnotes\n\n- **1** A note.';
    const references = '## References\n\n- [1] Alpha B. Title. 2020.';
    expect(toSections(PAPER).slice(-2)).toEqual([
      {
        chars: footnotes.length,
        id: 'footnotes',
        kind: 'footnotes',
        level: 1,
        markdown: footnotes,
        path: ['Footnotes'],
        title: 'Footnotes',
      },
      {
        chars: references.length,
        id: 'references',
        kind: 'references',
        level: 1,
        markdown: references,
        path: ['References'],
        title: 'References',
      },
    ]);
    expect(toMarkdown(PAPER).endsWith(`\n\n${footnotes}\n\n${references}\n`)).toBe(true);
    const bare = documentOf({ body: PAPER.body });
    expect(toSections(bare).map((entry) => entry.kind)).toEqual(['body', 'body']);
    expect(toSections({ ...bare, references: PAPER.references }).at(-1)?.id).toBe('references');
  });
});
