/**
 * @fileoverview The renderers on a hand-built document: `toMarkdown` block by block and
 * with its options, `toText`, and the flat section list `toSections` returns.
 * @module tests/render/markdown.test
 */
import { describe, expect, it } from 'vitest';
import type { Block, ScholarlyDocument, Section } from '../../src/model/document.js';
import { toMarkdown, toSections, toText } from '../../src/render/index.js';

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
    expect(toMarkdown(PAPER, { abstracts: 'none', metadata: false })).not.toContain('Abstract');
  });

  it('renders only the sections asked for, each with its subsections', () => {
    expect(toMarkdown(PAPER, { sections: ['s1.1', 'b1'] })).toBe(
      '### Scope\n\nDetail.\n\n## Acknowledgments\n\nThanks.\n',
    );
    expect(toMarkdown(PAPER, { sections: ['missing'] })).toBe('');
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

  it('writes display math holding a long run of spaces in one pass', () => {
    const spaces = ' '.repeat(100_000);
    const started = performance.now();
    const markdown = blocksMarkdown([{ tex: `a${spaces}b\n  c`, type: 'formula' }]);
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(markdown).toBe(`$$\na${spaces}b c\n$$\n`);
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

  it('reads a long run of backticks in one pass', () => {
    const run = '`'.repeat(100_000);
    const document = documentOf({
      body: [section('s1', { blocks: [{ text: `a${run}b`, type: 'code' }] })],
    });
    const started = performance.now();
    const text = toText(document, { metadata: false });
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(text).toContain(`a${run}b`);
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
    ]);
    const intro = sections[2];
    expect(intro?.markdown).toBe('## 1 Introduction\n\nWhy.');
    expect(intro?.chars).toBe(intro?.markdown.length);
    expect(sections[4]?.markdown).toBe('## Acknowledgments\n\nThanks.');
  });
});
