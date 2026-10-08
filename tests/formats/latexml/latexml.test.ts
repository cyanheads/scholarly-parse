/**
 * @fileoverview `parseLatexml` on synthetic LaTeXML pages: the section outline rebuilt
 * when an unclosed inline element swallows the sections after it, floats LaTeXML writes
 * as spans, subfigure and subtable panels, a bare tabular used as a spacer, an abstract
 * set as a section, entity-written text, `\url` links, MathML with no TeX, text split
 * across spans, and front matter at document size.
 * @module tests/formats/latexml/latexml.test
 */
import { describe, expect, it } from 'vitest';
import { parseLatexml } from '../../../src/formats/latexml/index.js';
import type { Block, ScholarlyDocument, Section } from '../../../src/model/document.js';
import { toMarkdown } from '../../../src/render/index.js';
import { expectLinear } from '../../linear.js';

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
            id: 'abstract-1-1',
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
    // No float caption heads the panels: the first follows the abstract directly.
    const markdown = toMarkdown(uncaptioned);
    expect(markdown).toContain('The abstract.\n\n**(a).** Panel A');
    expect(markdown).toContain('**(b).** Panel B');

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

  it('keeps the image of every subfigure panel, captioned or not', async () => {
    const panel = (id: string, image: string, caption = '') =>
      `<figure id="${id}" class="ltx_figure ltx_figure_panel"><object type="image/svg+xml"
        data="${image}" class="ltx_graphics"></object>${caption}</figure>`;
    const document = await parse(
      page(`<figure id="F3" class="ltx_figure"><div class="ltx_flex_figure">
        ${panel('F3.sf1', 'a.svg')}${panel('F3.sf2', 'b.svg')}
        ${panel('F3.sf3', 'c.svg', '<figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_figure">(c) </span>Late.</figcaption>')}
        </div><figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_figure">Figure 3: </span>Runs.</figcaption></figure>`),
    );
    expect(blocks(document.body)).toEqual([
      { caption: 'Runs.', href: 'a.svg', id: 'F3', label: 'Figure 3', type: 'figure' },
      { href: 'b.svg', id: 'F3.sf2', type: 'figure' },
      { caption: 'Late.', href: 'c.svg', id: 'F3.sf3', label: '(c)', type: 'figure' },
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

  it('collects a note set outside any paragraph without leaving its mark behind', async () => {
    const note = (text: string) =>
      `<span class="ltx_note ltx_role_footnote"><sup class="ltx_note_mark">†</sup><span class="ltx_note_outer">
        <span class="ltx_note_content"><sup class="ltx_note_mark">†</sup>${text}</span></span></span>`;
    const document = await parse(
      page(`${note('Corresponding author.')}
        <section id="S1" class="ltx_section">${heading(2, '1', 'Introduction')}
        <div class="ltx_para"><p class="ltx_p">Text.${note('A note in the text.')}</p></div></section>`),
    );
    expect(blocks(document.body)).toEqual([{ text: 'Text.^†', type: 'paragraph' }]);
    expect(document.footnotes.map((fn) => fn.text)).toEqual([
      'Corresponding author.',
      'A note in the text.',
    ]);
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

describe('MathML with no TeX', () => {
  const squared = '<math><msup><mi>x</mi><mn>2</mn></msup></math>';

  it('linearizes it inline, in a listing line, and in an equation row', async () => {
    const document = await parse(
      page(`<div class="ltx_para"><p class="ltx_p">Value ${squared} is measured.</p></div>
        <div class="ltx_listing"><div class="ltx_listingline">Input: <math><msub><mi>x</mi><mi>i</mi></msub></math></div></div>
        <table id="S1.E1" class="ltx_equation ltx_eqn_table"><tbody><tr class="ltx_equation ltx_eqn_row">
        <td class="ltx_eqn_cell">${squared}</td>
        <td class="ltx_eqn_cell ltx_eqn_eqno"><span class="ltx_tag ltx_tag_equation">(1)</span></td></tr></tbody></table>`),
    );
    expect(blocks(document.body)).toEqual([
      { text: 'Value $x^2$ is measured.', type: 'paragraph' },
      { text: 'Input: $x_i$', type: 'code' },
      { id: 'S1.E1', label: '(1)', tex: 'x^2', type: 'formula' },
    ]);
  });

  it('prefers the TeX annotation, then the alttext, as before', async () => {
    const document = await parse(
      page(`<div class="ltx_para"><p class="ltx_p">A <math alttext="y^{2}"><semantics><msup><mi>x</mi><mn>2</mn></msup>
        <annotation encoding="application/x-tex">x^{2}</annotation></semantics></math>,
        B <math alttext="z"><mi>q</mi></math>.</p></div>`),
    );
    expect(blocks(document.body)).toEqual([{ text: 'A $x^{2}$, B $z$.', type: 'paragraph' }]);
  });

  it('decodes the entities in a TeX annotation', async () => {
    // cyanheads/arxiv-mcp-server#4; the corpus entity invariant skips math, so this pins it.
    const document = await parse(
      page(`<div class="ltx_para"><p class="ltx_p">If <math alttext="a&lt;b"><semantics><mi>a</mi>
        <annotation encoding="application/x-tex">a &lt; b &amp;&amp; c</annotation></semantics></math> holds.</p></div>`),
    );
    expect(blocks(document.body)).toEqual([{ text: 'If $a < b && c$ holds.', type: 'paragraph' }]);
  });

  it('writes nothing for math whose linearization is empty', async () => {
    const document = await parse(
      page(`<div class="ltx_para"><p class="ltx_p">Value <math><mphantom><mi>x</mi></mphantom></math> is.</p></div>
        <div class="ltx_listing"><div class="ltx_listingline">Input: <math><mrow></mrow></math></div></div>`),
    );
    expect(blocks(document.body)).toEqual([
      { text: 'Value is.', type: 'paragraph' },
      { text: 'Input:', type: 'code' },
    ]);
  });

  it('reads 100,000 nested rows, keeping their text', async () => {
    const deep = `<math>${'<mrow>'.repeat(100_000)}<mi>x</mi>${'</mrow>'.repeat(100_000)}</math>`;
    const document = await parse(
      page(`<div class="ltx_para"><p class="ltx_p">Value ${deep} is measured.</p></div>`),
    );
    expect(blocks(document.body)).toEqual([{ text: 'Value $x$ is measured.', type: 'paragraph' }]);
  });
});

describe('text split across spans', () => {
  const span = (parts: string[]) =>
    parts.map((part) => `<span class="ltx_text">${part}</span>`).join('');

  /** Every field a LaTeXML page writes inline Markdown into, each holding `split`. */
  async function fields(split: string): Promise<string[]> {
    const document = await parse(
      `<html><body><article class="ltx_document"><h1 class="ltx_title ltx_title_document">T ${split}</h1>
      <section id="S1" class="ltx_section"><h2 class="ltx_title">H ${split}</h2>
      <div class="ltx_para"><p class="ltx_p">P ${split}<span class="ltx_note ltx_role_footnote"><sup class="ltx_note_mark">1</sup>
      <span class="ltx_note_outer"><span class="ltx_note_content"><sup class="ltx_note_mark">1</sup>N ${split}</span></span></span></p></div>
      <figure id="F1" class="ltx_figure"><img src="a.png"><figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_figure">Figure 1: </span>C ${split}</figcaption></figure>
      <table class="ltx_tabular"><tr class="ltx_tr"><td class="ltx_td">D ${split}</td></tr></table>
      <div class="ltx_theorem"><h6 class="ltx_title ltx_runin"><span class="ltx_tag">Theorem 1</span> (M ${split})</h6>
      <div class="ltx_para"><p class="ltx_p">Body.</p></div></div></section>
      <section class="ltx_bibliography"><ul class="ltx_biblist"><li class="ltx_bibitem" id="bib.bib1">
      <span class="ltx_tag ltx_tag_bibitem">[1]</span><span class="ltx_bibblock">R ${split}</span></li></ul></section>
      </article></body></html>`,
    );
    const [section] = document.body;
    const [paragraph, figure, table, box] = section?.blocks ?? [];
    return [
      document.metadata.title ?? '',
      section?.title ?? '',
      paragraph?.type === 'paragraph' ? paragraph.text : '',
      document.footnotes[0]?.text ?? '',
      figure?.type === 'figure' ? (figure.caption ?? '') : '',
      table?.type === 'table' ? (table.rows[0]?.[0] ?? '') : '',
      box?.type === 'box' ? (box.title ?? '') : '',
      document.references[0]?.text ?? '',
    ];
  }

  it.each([
    [['&lt;', 'img src=x onerror=alert(1)&gt;'], '\\<img src=x onerror=alert(1)>'],
    [['[click]', '(javascript:alert(1))'], '[click\\](javascript:alert(1))'],
    [['\\', '&lt;img src=x onerror=alert(1)&gt;'], '\\\\\\<img src=x onerror=alert(1)>'],
    [['&lt;', 'javascript:alert(1)&gt;'], '\\<javascript:alert(1)>'],
    [['!', '[x]', '(https://example.org/a.png)'], '\\![x](https://example.org/a.png)'],
    [['&lt;', '!-- hidden --&gt;'], '\\<!-- hidden -->'],
  ])('writes %j as text in every field, however the spans split it', async (parts, written) => {
    expect(await fields(span(parts))).toEqual([
      `T ${written}`,
      `H ${written}`,
      `P ${written}^1`,
      `N ${written}`,
      `C ${written}`,
      `D ${written}`,
      `(M ${written})`,
      `R ${written}`,
    ]);
  });
});

describe('front matter at document size', () => {
  /** One author with `n` affiliation lines, each distinct, or all the same. */
  const affiliated = (n: number, distinct = true) =>
    page(
      `<div class="ltx_authors"><span class="ltx_creator ltx_role_author"><span class="ltx_personname">An Author${Array.from(
        { length: n },
        (_, i) =>
          `<br class="ltx_break">Department of Applied Mathematics, University ${String(distinct ? i : 0).padStart(6, '0')}`,
      ).join('')}</span></span></div><div class="ltx_para"><p class="ltx_p">Text.</p></div>`,
    );

  it('lists each affiliation once, in order of first mention, and indexes authors into it', async () => {
    const creator = (name: string, ...lines: string[]) =>
      `<span class="ltx_creator ltx_role_author"><span class="ltx_personname">${[name, ...lines].join('<br class="ltx_break">')}</span></span>`;
    const document = await parse(
      page(
        `<div class="ltx_authors">${creator('A One', 'X', 'Y')}${creator('B Two', 'Y', 'Z', 'X')}${creator('C Three', 'Z', 'Z')}</div>`,
      ),
    );
    expect(document.metadata.affiliations).toEqual(['X', 'Y', 'Z']);
    expect(document.metadata.authors?.map((a) => a.affiliations)).toEqual([[0, 1], [1, 2, 0], [2]]);
  });

  it('reads 50,000 distinct affiliation lines in time linear in their count', async () => {
    await expectLinear(affiliated, parse, { from: 3_125, to: 50_000 });
    const { affiliations, authors } = (await parse(affiliated(50_000))).metadata;
    expect(affiliations).toHaveLength(50_000);
    expect(authors?.[0]?.affiliations).toEqual(affiliations?.map((_, i) => i));
  }, 60_000);
});

describe('document-sized lists', () => {
  it('reads a paragraph of footnotes in time linear in their number', async () => {
    const words = ' word'.repeat(50);
    const note = (i: number) =>
      `<span class="ltx_note ltx_role_footnote"><sup class="ltx_note_mark">${i}</sup><span class="ltx_note_outer"><span class="ltx_note_content"><sup class="ltx_note_mark">${i}</sup>Note ${i}.</span></span></span>`;
    const notes = (n: number) =>
      page(
        `<div class="ltx_para"><p class="ltx_p">${Array.from({ length: n }, (_, i) => `${note(i)}${words}`).join('')}</p></div>`,
      );
    const document = await parse(notes(3));
    // The first note has no text before it for its mark to follow.
    expect(blocks(document.body)).toEqual([
      { text: `${words.trim()}^1${words}^2${words}`, type: 'paragraph' },
    ]);
    expect(document.footnotes.map((fn) => fn.text)).toEqual(['Note 0.', 'Note 1.', 'Note 2.']);
    await expectLinear(notes, parse, { from: 500, to: 8_000 });
  }, 60_000);

  /** V8 rejects a call spreading ~120,000 arguments, so the case runs past that on Node. */
  it('reads a paragraph block of 200,000 paragraphs', async () => {
    const document = await parse(
      page(
        `<section class="ltx_section" id="S1"><h2 class="ltx_title ltx_title_section">Intro</h2><div class="ltx_para">${'<p class="ltx_p">x</p>'.repeat(200_000)}</div></section>`,
      ),
    );
    expect(blocks(document.body)).toHaveLength(200_000);
  });
});

describe('long unclosed runs', () => {
  const bibitem = (entry: string) =>
    `<section class="ltx_bibliography"><ul class="ltx_biblist"><li class="ltx_bibitem" id="bib.bib1"><span class="ltx_tag ltx_tag_bibitem">[1]</span><span class="ltx_bibblock">${entry}</span></li></ul></section>`;
  const theorem = (title: string) =>
    `<div class="ltx_theorem"><h6 class="ltx_title ltx_runin"><span class="ltx_tag">Theorem 1</span>${title}</h6><div class="ltx_para"><p class="ltx_p">Body.</p></div></div>`;
  const listing = (line: string) =>
    `<div class="ltx_listing"><div class="ltx_listingline">${line}</div></div>`;
  const watermarked = (watermark: string) =>
    page('<p class="ltx_p">Text.</p>').replace(
      '<div class="ltx_page_main">',
      `<div class="ltx_page_main"><div id="watermark-tr">${watermark}</div>`,
    );
  it.each([
    ['a <pre> of spaces', (n: number) => page(`<pre>a${' '.repeat(n)}b</pre>`)],
    ['a listing line of spaces', (n: number) => page(listing(`a${' '.repeat(n)}b`))],
    ['a listing line of no-break spaces', (n: number) => page(listing(`a${' '.repeat(n)}b`))],
    ['a theorem title of dots', (n: number) => page(theorem(`a${'.'.repeat(n)}b`))],
    ['a DOI run', (n: number) => page(bibitem(`A work. ${'10.1234/.'.repeat(n / 8)}"`))],
    ['a watermark of brackets', (n: number) => watermarked('arXiv:1234.12345 ['.repeat(n / 16))],
  ])('reads a page in time linear in %s that closes nothing', async (_, html) => {
    await expectLinear(html, parse, { from: 2_000, to: 512_000 });
  });

  it('reads the watermark, a theorem title, a listing, and a DOI as before', async () => {
    const document = await parse(
      watermarked('arXiv:2401.04088v1 [cs.LG] 08 Jan 2024').replace(
        '<p class="ltx_p">Text.</p>',
        theorem(' (Informal).:') + listing('a  b  \n  c ') + bibitem('A work. doi:10.1234/AB.5.'),
      ),
    );
    expect(document.metadata).toMatchObject({
      identifiers: { arxiv: '2401.04088v1' },
      published: { day: 8, month: 1, year: 2024 },
    });
    expect(blocks(document.body).map((block) => block.type === 'box' && block.title)).toContain(
      '(Informal)',
    );
    expect(blocks(document.body)).toContainEqual({ text: 'a  bc', type: 'code' });
    expect(document.references[0]?.doi).toBe('10.1234/ab.5');
  });

  it.each([
    ['10.1002/(SICI)1097-4636(199907)', '10.1002/(sici)1097-4636(199907)'],
    ['(doi: 10.1234/xyz).', '10.1234/xyz'],
    ['"10.1234/abc".', '10.1234/abc'],
    ['doi: 10.1234/abc: more', '10.1234/abc'],
  ])('reads the DOI in a bibitem %j without what closes it', async (text, doi) => {
    const document = await parse(page(bibitem(`A work. ${text}`)));
    expect(document.references[0]?.doi).toBe(doi);
  });
});

describe('reference arXiv IDs (#65)', () => {
  const bibitem = (entry: string) =>
    `<section class="ltx_bibliography"><ul class="ltx_biblist"><li class="ltx_bibitem" id="bib.bib1"><span class="ltx_tag ltx_tag_bibitem">[1]</span><span class="ltx_bibblock">${entry}</span></li></ul></section>`;
  const reference = async (entry: string) => (await parse(page(bibitem(entry)))).references[0];
  const link = (href: string) => `<a href="${href}" class="ltx_ref ltx_url">${href}</a>`;

  it('keeps a labelled new-style ID with its version, and a link as the URL', async () => {
    expect(await reference('C. Author. Newer. arXiv:2105.00001v2.')).toMatchObject({
      arxiv: '2105.00001v2',
    });
    expect(
      await reference(`B. Author. New. ${link('https://arxiv.org/abs/2105.00001')}.`),
    ).toMatchObject({ url: 'https://arxiv.org/abs/2105.00001' });
  });

  it.each([
    ['A. Author. Old paper. arXiv:hep-th/9711200, 1997.', 'hep-th/9711200'],
    ['A. Author. Knots. arXiv:math.GT/0309136.', 'math/0309136'],
    ['A. Author. Old paper. Nucl. Phys. B 1 (1998) 1, hep-th/9711200.', 'hep-th/9711200'],
    ['A. Author. arXiv:cond-mat/0501001v2.', 'cond-mat/0501001v2'],
    ['C. Author. arXiv preprint arXiv:1706.03762, 2017.', '1706.03762'],
    [`B. Author. New. ${link('https://arxiv.org/abs/2105.00001')}.`, '2105.00001'],
    [`B. Author. New. ${link('https://arxiv.org/abs/2105.00001v3')}.`, '2105.00001v3'],
    [`B. Author. New. ${link('https://arxiv.org/pdf/2105.00001')}.`, '2105.00001'],
    [`B. Author. Old. ${link('http://arxiv.org/abs/hep-th/9711200')}.`, 'hep-th/9711200'],
  ])('reads the arXiv ID in %j', async (entry, arxiv) => {
    expect((await reference(entry))?.arxiv).toBe(arxiv);
  });

  it.each([
    'D. Author. Data and/1234567 samples.',
    'D. Author. arXiv:foo-bar/9901001.',
    'D. Author. A preprint, hep-th/0805123.',
    'D. Author. Phys. Rev. 1999.12345 (2001).',
    `E. Author. ${link('https://example.org/abs/2105.00001')}.`,
  ])('reads no arXiv ID in %j', async (entry) => {
    expect((await reference(entry))?.arxiv).toBeUndefined();
  });

  it('reads no ID from a back-link to the citing paper itself', async () => {
    const result = await parseLatexml(
      page(
        bibitem(
          'A. Author. A blog post. <a href="https://example.org/post" class="ltx_ref">Link</a>. ' +
            'Cited by: <a href="#S1.p1.1" class="ltx_ref">§1</a>.',
        ),
      ),
      { baseUrl: 'https://arxiv.org/html/2604.21816v1' },
    );
    expect(result.ok && result.document.references[0]).toMatchObject({
      url: 'https://example.org/post',
    });
    expect(result.ok && result.document.references[0]?.arxiv).toBeUndefined();
  });

  it.each([
    ['https://arxiv.org/abs/2604.21816v1', '#S1.p1.1'],
    ['https://ar5iv.org/abs/2604.21816', '#bib.bib2'],
    ['https://arxiv.org/abs/2604.21816v1', ''],
    ['https://ar5iv.org/abs/2604.21816', '?context=cs'],
    ['https://arxiv.org/html/2604.21816v1', ''],
  ])(
    'reads neither an ID nor a URL from a link to the page at %s itself (%j)',
    async (baseUrl, href) => {
      const result = await parseLatexml(
        page(bibitem(`A. Author. A talk. Cited by: <a href="${href}" class="ltx_ref">§1</a>.`)),
        { baseUrl },
      );
      const reference = result.ok ? result.document.references[0] : undefined;
      expect(reference?.text).toContain('A talk');
      expect(reference?.arxiv).toBeUndefined();
      expect(reference?.url).toBeUndefined();
    },
  );

  it('reads the ID an entry prints before the one its link names', async () => {
    expect(
      await reference(
        'C. Author. arXiv:2105.00001v2. <a href="https://arxiv.org/abs/2105.00001">link</a>.',
      ),
    ).toMatchObject({ arxiv: '2105.00001v2', url: 'https://arxiv.org/abs/2105.00001' });
  });

  it('reads an old-style ID from the watermark or page URL without its subject class', async () => {
    const watermarked = page('<p class="ltx_p">Text.</p>').replace(
      '<div class="ltx_page_main">',
      '<div class="ltx_page_main"><div id="watermark-tr">arXiv:math.GT/0309136v1 [math.GT] 8 Sep 2003</div>',
    );
    const fromWatermark = await parse(watermarked);
    expect(fromWatermark.metadata).toMatchObject({
      identifiers: { arxiv: 'math/0309136v1' },
      published: { day: 8, month: 9, year: 2003 },
    });
    expect(toMarkdown(fromWatermark)).toContain('arXiv: math/0309136v1');

    for (const [baseUrl, arxiv] of [
      ['https://ar5iv.labs.arxiv.org/html/math.GT/0309136', 'math/0309136'],
      ['https://ar5iv.labs.arxiv.org/html/hep-th/9711200', 'hep-th/9711200'],
      ['https://arxiv.org/html/2407.01449v6', '2407.01449v6'],
    ] as const) {
      const result = await parseLatexml(page('<p class="ltx_p">Text.</p>'), { baseUrl });
      expect(result.ok && result.document.metadata.identifiers).toEqual({ arxiv });
    }
  });

  describe('the watermark', () => {
    const stamped = (watermark: string) =>
      page('<p class="ltx_p">Text.</p>').replace(
        '<div class="ltx_page_main">',
        `<div class="ltx_page_main"><div id="watermark-tr">${watermark}</div>`,
      );

    it('reads a stamp with no subject class, as arXiv prints it for an archive without classes', async () => {
      const document = await parse(stamped('arXiv:hep-th/9901001v2 10 May 1999'));
      expect(document.metadata).toMatchObject({
        identifiers: { arxiv: 'hep-th/9901001v2' },
        published: { day: 10, month: 5, year: 1999 },
      });
      expect(toMarkdown(document)).toContain('arXiv: hep-th/9901001v2');
    });

    it('reads no ID or date from a stamp whose ID is not one, and reads a later one that is', async () => {
      for (const watermark of [
        'arXiv:foo-bar/9901001 [hep-th] 10 May 1999',
        'arXiv:2105.00001v0 [cs.LG] 1 May 2021',
        'arXiv:hep-th/9901001v 2 May 1999',
      ]) {
        const document = await parse(stamped(watermark));
        expect(document.metadata.identifiers).toBeUndefined();
        expect(document.metadata.published).toBeUndefined();
      }
      const later = await parse(
        stamped('arXiv:foo-bar/9901001 [x] 1 Jan 2000; arXiv:2401.04088v1 [cs.LG] 08 Jan 2024'),
      );
      expect(later.metadata).toMatchObject({
        identifiers: { arxiv: '2401.04088v1' },
        published: { day: 8, month: 1, year: 2024 },
      });
    });

    it('takes the ID from the page URL but no date when the stamp is not one', async () => {
      const result = await parseLatexml(stamped('arXiv:foo-bar/9901001 [hep-th] 10 May 1999'), {
        baseUrl: 'https://arxiv.org/html/2407.01449v6',
      });
      expect(result.ok && result.document.metadata.identifiers).toEqual({ arxiv: '2407.01449v6' });
      expect(result.ok && result.document.metadata.published).toBeUndefined();
    });

    it.each([
      ['stamps with no subject class', 'arXiv:hep-th/9901001v2 '],
      ['labels and spaces', 'arXiv: '],
    ])('reads a page in time linear in a watermark of %s', async (_, run) => {
      await expectLinear((n) => stamped(run.repeat(n / run.length)), parse, {
        from: 2_000,
        to: 512_000,
      });
    });
  });

  it.each([
    ['arXiv: labels with no ID', 'arXiv: '],
    ['a digit run', '1'],
    ['a run of /-separated archives', 'hep-th/'],
    ['a run of arxiv.org links', 'arxiv.org/abs/'],
  ])('reads a bibitem in time linear in %s', async (_, run) => {
    await expectLinear((n) => page(bibitem(`A work. ${run.repeat(n / run.length)}`)), parse, {
      from: 2_000,
      to: 512_000,
    });
  });
});
