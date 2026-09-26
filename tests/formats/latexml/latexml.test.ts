/**
 * @fileoverview `parseLatexml` on synthetic LaTeXML pages: the section outline rebuilt
 * when an unclosed inline element swallows the sections after it, floats LaTeXML writes
 * as spans, subtable panels, a bare tabular used as a spacer, an abstract set as a
 * section, entity-written text, and `\url` links.
 * @module tests/formats/latexml/latexml.test
 */
import { describe, expect, it } from 'vitest';
import { parseLatexml } from '../../../src/formats/latexml/index.js';
import type { Block, ScholarlyDocument, Section } from '../../../src/model/document.js';
import { toMarkdown } from '../../../src/render/index.js';

const ABSTRACT = `<div class="ltx_abstract"><h6 class="ltx_title ltx_title_abstract">Abstract</h6>
    <p class="ltx_p">The abstract.</p></div>`;

function page(content: string, abstract = ABSTRACT): string {
  return `<!DOCTYPE html><html lang="en"><head><meta name="generator" content="LaTeXML"></head>
    <body><div class="ltx_page_main"><div class="ltx_page_content"><article class="ltx_document">
    <h1 class="ltx_title ltx_title_document">A paper</h1>
    ${abstract}${content}</article></div></div></body></html>`;
}

const heading = (level: number, tag: string, text: string) =>
  `<h${level} class="ltx_title"><span class="ltx_tag">${tag} </span>${text}</h${level}>`;

async function parse(html: string): Promise<ScholarlyDocument> {
  const result = await parseLatexml(html);
  if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
  return result.document;
}

function blocks(sections: Section[]): Block[] {
  return sections.flatMap((section) => [...section.blocks, ...blocks(section.sections)]);
}

describe('abstract', () => {
  it('reads a leading unnumbered section titled Abstract as the abstract', async () => {
    // `\subsection*{Abstract}` in place of the abstract environment.
    const document = await parse(
      page(
        `<section id="S0.SSx1" class="ltx_subsection"><h3 class="ltx_title">Abstract</h3>
        <div class="ltx_para"><p class="ltx_p">What we did.</p></div></section>
        <section id="S1" class="ltx_section">${heading(2, '1', 'Introduction')}
        <div class="ltx_para"><p class="ltx_p">Why.</p></div></section>`,
        '',
      ),
    );
    expect(document.abstracts).toEqual([
      {
        kind: 'main',
        sections: [
          {
            blocks: [{ text: 'What we did.', type: 'paragraph' }],
            id: 'S0.SSx1',
            kind: 'body',
            sections: [],
          },
        ],
      },
    ]);
    expect(document.body.map((section) => section.title)).toEqual(['Introduction']);
    expect(document.diagnostics.warnings.map((w) => w.code)).not.toContain('no-abstract');
  });

  it('reads a front-matter paragraph with a bold Abstract run-in heading as the abstract', async () => {
    const document = await parse(
      page(
        `<div class="ltx_para"><p class="ltx_p"><span class="ltx_text ltx_font_bold">A title set by hand</span></p></div>
        <div class="ltx_para"><p class="ltx_p"><span class="ltx_text ltx_font_bold">Abstract.</span> What we did.</p></div>
        <section id="S1" class="ltx_section">${heading(2, '1', 'Introduction')}
        <div class="ltx_para"><p class="ltx_p">Why.</p></div></section>`,
        '',
      ),
    );
    expect(document.abstracts).toEqual([
      {
        kind: 'main',
        sections: [
          {
            blocks: [{ text: 'What we did.', type: 'paragraph' }],
            id: 'abstract-1',
            kind: 'body',
            sections: [],
          },
        ],
      },
    ]);
    expect(document.body.map((section) => [section.title, section.blocks])).toEqual([
      [undefined, [{ text: '**A title set by hand**', type: 'paragraph' }]],
      ['Introduction', [{ text: 'Why.', type: 'paragraph' }]],
    ]);
  });
});

describe('sections and floats', () => {
  it('rebuilds the outline an unclosed inline element swallowed, reading span floats', async () => {
    // LaTeXML left a <span> open around a macro it could not expand: every section after
    // it parses inside §1's paragraph, and the float there is written as spans.
    const document = await parse(
      page(`<section id="S1" class="ltx_section">${heading(2, '1', 'Approach')}
        <div class="ltx_para"><p class="ltx_p">Text <span class="ltx_text">left open
        <section id="S2" class="ltx_section">${heading(2, '2', 'Evaluation')}
        <div class="ltx_para"><span class="ltx_p">Results.</span></div>
        <span id="S2.T1" class="ltx_table"><span class="ltx_caption"><span class="ltx_tag ltx_tag_table">Table 1. </span>Operators</span>
        <span class="ltx_tabular"><span class="ltx_tr"><span class="ltx_td">A</span><span class="ltx_td">B</span></span></span></span>
        <section id="S2.SS1" class="ltx_subsection">${heading(3, '2.1', 'Metrics')}
        <div class="ltx_para"><p class="ltx_p">Detail.</p></div></section>
        </section></span></p></div></section>`),
    );
    expect(
      document.body.map((s) => [s.label, s.title, s.sections.map((sub) => sub.title)]),
    ).toEqual([
      ['1', 'Approach', []],
      ['2', 'Evaluation', ['Metrics']],
    ]);
    expect(blocks(document.body).filter((b) => b.type === 'table')).toEqual([
      {
        caption: 'Operators',
        headerRows: 0,
        id: 'S2.T1',
        label: 'Table 1',
        rows: [['A', 'B']],
        type: 'table',
      },
    ]);
  });

  it('labels each subtable with its panel caption, the float caption heading them', async () => {
    const panel = (id: string, tag: string, cell: string) =>
      `<figure id="${id}" class="ltx_table ltx_figure_panel"><table class="ltx_tabular"><tbody>
        <tr class="ltx_tr"><td class="ltx_td">${cell}</td></tr></tbody></table>
        <figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_table">${tag} </span>Panel ${cell}</figcaption></figure>`;
    const float = (caption: string) =>
      `<figure id="T1" class="ltx_table"><div class="ltx_flex_figure">
        ${panel('T1.sf1', '(a)', 'A')}${panel('T1.sf2', '(b)', 'B')}</div>${caption}</figure>`;

    const uncaptioned = await parse(page(`<div class="ltx_para">${float('')}</div>`));
    expect(
      blocks(uncaptioned.body).map((b) => b.type === 'table' && [b.id, b.label, b.caption]),
    ).toEqual([
      ['T1.sf1', '(a)', 'Panel A'],
      ['T1.sf2', '(b)', 'Panel B'],
    ]);
    const markdown = toMarkdown(uncaptioned);
    expect(markdown).toContain('**(b).** Panel B');
    expect(markdown).not.toContain('**Table.**');

    const captioned = await parse(
      page(
        `<div class="ltx_para">${float(
          '<figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_table">Table 1: </span>Both</figcaption>',
        )}</div>`,
      ),
    );
    expect(blocks(captioned.body).map((b) => b.type)).toEqual(['paragraph', 'table', 'table']);
    expect(toMarkdown(captioned)).toContain('**Table 1.** Both\n\n**(a).** Panel A');
  });

  it('leaves out a bare tabular holding only a rule', async () => {
    const document = await parse(
      page(`<div class="ltx_para"><table class="ltx_tabular"><tbody><tr class="ltx_tr">
        <td class="ltx_td"><span class="ltx_rule" style="width:0pt;height:24pt;"></span></td>
        </tr></tbody></table></div>
        <section id="S1" class="ltx_section">${heading(2, '1', 'Introduction')}
        <div class="ltx_para"><p class="ltx_p">Text.</p></div></section>`),
    );
    expect(blocks(document.body).map((b) => b.type)).toEqual(['paragraph']);
  });

  it('keeps a table set as a panel beside a figure image, after the figure', async () => {
    const document = await parse(
      page(`<figure id="F2" class="ltx_figure"><img src="x1.png" class="ltx_graphics ltx_figure_panel">
        <table class="ltx_tabular ltx_figure_panel"><tbody><tr class="ltx_tr"><td class="ltx_td">What?</td>
        <td class="ltx_td">Quoi? (fra)</td></tr></tbody></table>
        <figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_figure">Figure 2: </span>Question types.</figcaption></figure>`),
    );
    expect(blocks(document.body)).toMatchObject([
      { caption: 'Question types.', label: 'Figure 2', type: 'figure' },
      { headerRows: 0, rows: [['What?', 'Quoi? (fra)']], type: 'table' },
    ]);
  });

  it('heads a theorem box with its label and title, not the punctuation set after them', async () => {
    const box = (tag: string, style: string, name = '') =>
      `<div class="ltx_theorem"><h6 class="ltx_title ltx_runin ltx_title_theorem"><span class="ltx_tag ltx_tag_theorem">
        <span class="ltx_text ltx_font_bold">${tag}</span></span>${name}<span class="ltx_text ${style}">.</span></h6>
        <div class="ltx_para"><p class="ltx_p">Body.</p></div></div>`;
    const document = await parse(
      page(
        box('Theorem 1', 'ltx_font_bold') +
          box('Remark 2', 'ltx_font_italic') +
          box(
            'Theorem 3',
            'ltx_font_bold',
            '<span class="ltx_text ltx_font_bold"> (Informal)</span>',
          ),
      ),
    );
    expect(blocks(document.body).map((b) => b.type === 'box' && [b.label, b.title])).toEqual([
      ['Theorem 1', undefined],
      ['Remark 2', undefined],
      ['Theorem 3', '(Informal)'],
    ]);
    expect(toMarkdown(document)).toContain('> **Theorem 3 (Informal)**\n>\n> Body.');
  });

  it('writes a listing line by line, with math as TeX and no line numbers or layout whitespace', async () => {
    const line = (n: number, content: string) =>
      `<div class="ltx_listingline">
            <span class="ltx_tag ltx_tag_listingline">${n}</span>
          ${content}
      </div>`;
    const document = await parse(
      page(`<div class="ltx_listing">${line(1, 'Input: mesh <math alttext="\\mathcal{M}"><semantics><mi>ℳ</mi><annotation encoding="application/x-tex">\\mathcal{M}</annotation></semantics></math>')}
        ${line(2, '<span class="ltx_text">\u00a0\u00a0return</span>\u00a0x')}</div>`),
    );
    expect(blocks(document.body)).toEqual([
      { text: 'Input: mesh $\\mathcal{M}$\n  return x', type: 'code' },
    ]);
  });
});

describe('inline text', () => {
  it('escapes a tag-like token the source wrote as entities', async () => {
    // The DOM splits text at each entity: `<`, `bos`, `>` arrive as separate nodes.
    const document = await parse(
      page(`<div class="ltx_para"><p class="ltx_p">Tokens &lt;bos&gt; and a&lt;b.</p>
        <table class="ltx_tabular"><tbody><tr class="ltx_tr"><td class="ltx_td">
        <span class="ltx_p">&lt;bos&gt;, safe</span></td></tr></tbody></table></div>`),
    );
    const [paragraph, table] = blocks(document.body);
    expect(paragraph).toEqual({ text: 'Tokens \\<bos> and a\\<b.', type: 'paragraph' });
    expect(table?.type === 'table' && table.rows).toEqual([['\\<bos>, safe']]);
  });

  it('links a \\url and keeps one with no scheme as written', async () => {
    const url = (href: string) =>
      `<a href="${href}" class="ltx_ref ltx_url ltx_font_typewriter">${href}</a>`;
    const document = await parse(
      page(`<div class="ltx_para"><p class="ltx_p">See ${url('https://example.org/a_b')} or
        ${url('example.org/c')}; run <span class="ltx_text ltx_font_typewriter">make</span>.</p></div>`),
    );
    expect(blocks(document.body)).toEqual([
      {
        text: 'See <https://example.org/a_b> or `example.org/c`; run `make`.',
        type: 'paragraph',
      },
    ]);
  });

  it('unwraps a DOI link LaTeXML prefixed twice', async () => {
    // A BibTeX `doi` field that already held a URL.
    const document = await parse(
      page(`<div class="ltx_para"><p class="ltx_p">See
        <a href="https://dx.doi.org/https://doi.org/10.1201/9781439894552" class="ltx_ref">the book</a>.</p></div>`),
    );
    expect(blocks(document.body)).toEqual([
      { text: 'See [the book](https://doi.org/10.1201/9781439894552).', type: 'paragraph' },
    ]);
  });
});
