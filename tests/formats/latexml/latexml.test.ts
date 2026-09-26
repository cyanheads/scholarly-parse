/**
 * @fileoverview `parseLatexml` on synthetic LaTeXML pages: the section outline rebuilt
 * when an unclosed inline element swallows the sections after it, floats LaTeXML writes
 * as spans, and a bare tabular used as a spacer.
 * @module tests/formats/latexml/latexml.test
 */
import { describe, expect, it } from 'vitest';
import { parseLatexml } from '../../../src/formats/latexml/index.js';
import type { Block, ScholarlyDocument, Section } from '../../../src/model/document.js';

function page(content: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta name="generator" content="LaTeXML"></head>
    <body><div class="ltx_page_main"><div class="ltx_page_content"><article class="ltx_document">
    <h1 class="ltx_title ltx_title_document">A paper</h1>
    <div class="ltx_abstract"><h6 class="ltx_title ltx_title_abstract">Abstract</h6>
    <p class="ltx_p">The abstract.</p></div>${content}</article></div></div></body></html>`;
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
});
