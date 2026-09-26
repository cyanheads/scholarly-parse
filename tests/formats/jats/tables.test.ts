/**
 * @fileoverview JATS `<table-wrap>` → `TableBlock`: tables at their document position
 * in every part of the article, spans expanded to a rectangular grid, header rows,
 * footnotes, unextractable bodies, and tables lifted out of the paragraphs that nest
 * them. Issue numbers refer to cyanheads/pubmed-mcp-server.
 * @module tests/formats/jats/tables.test
 */
import { describe, expect, it } from 'vitest';
import type { TableBlock } from '../../../src/index.js';
import { MAX_TABLE_COLUMNS } from '../../../src/model/table-grid.js';
import { blocksOfType, paragraphTexts, parseArticle, parseBody } from './helpers.js';

/** PMC11391094's shape: an XHTML body with a `<thead>` and a full-width group-label row. */
const XHTML_TABLE =
  '<table><colgroup><col/></colgroup>' +
  '<thead><tr><th></th><th>Benralizumab (n=23)</th><th>Placebo (n=23)</th></tr></thead>' +
  '<tbody><tr><td>Age, years</td><td>30.4±12.3</td><td>31.5±13.3</td></tr>' +
  '<tr><td colspan="3">Race</td></tr></tbody></table>';

const XHTML_ROWS = [
  ['', 'Benralizumab (n=23)', 'Placebo (n=23)'],
  ['Age, years', '30.4±12.3', '31.5±13.3'],
  ['Race', 'Race', 'Race'],
];

const tableWrap = (id: string, label: string, caption: string) =>
  `<table-wrap id="${id}"><label>${label}</label><caption><p>${caption}</p></caption>` +
  `${XHTML_TABLE}<table-wrap-foot><fn><p>Data are mean±sd.</p></fn></table-wrap-foot></table-wrap>`;

/** The one table in an article whose body holds `table` inside a bare `<table-wrap>`. */
function onlyTable(table: string): TableBlock {
  const tables = blocksOfType(
    parseBody(`<sec><table-wrap id="T1">${table}</table-wrap></sec>`),
    'table',
  );
  expect(tables).toHaveLength(1);
  return tables[0] as TableBlock;
}

describe('table placement (#111)', () => {
  it('reads a table-wrap beside the paragraphs of a section', () => {
    const { body } = parseBody(
      '<sec><title>Results</title><p>Baseline characteristics are shown.</p>' +
        `${tableWrap('TB1', 'TABLE 1', 'Demographic and baseline characteristics')}</sec>`,
    );
    expect(body[0]?.blocks).toEqual([
      { text: 'Baseline characteristics are shown.', type: 'paragraph' },
      {
        caption: 'Demographic and baseline characteristics',
        footnotes: ['Data are mean±sd.'],
        headerRows: 1,
        id: 'TB1',
        label: 'TABLE 1',
        rows: XHTML_ROWS,
        type: 'table',
      },
    ]);
  });

  it('places a table in the innermost section holding it', () => {
    const { body } = parseBody(
      '<sec><title>Results</title><sec><title>Biomarkers</title><sec><title>Sputum</title>' +
        `${tableWrap('TB3', 'TABLE 3', 'Allergen-induced biomarkers')}</sec></sec></sec>`,
    );
    const sputum = body[0]?.sections[0]?.sections[0];
    expect(sputum?.title).toBe('Sputum');
    expect(sputum?.blocks).toMatchObject([{ id: 'TB3', type: 'table' }]);
    expect(body[0]?.blocks).toEqual([]);
    expect(body[0]?.sections[0]?.blocks).toEqual([]);
  });

  it('reads tables in the body, floats-group, and back matter, each where it sits', () => {
    const document = parseArticle({
      back:
        '<sec><title>Appendix A</title>' +
        `<table-wrap-group>${tableWrap('TB3', 'TABLE 3', 'In table-wrap-group')}</table-wrap-group>` +
        '</sec>' +
        `<app-group><app>${tableWrap('TB4', 'TABLE 4', 'In app-group')}</app></app-group>`,
      body: `<sec><title>Results</title>${tableWrap('TB1', 'TABLE 1', 'In body')}</sec>`,
      floats: tableWrap('TB2', 'TABLE 2', 'In floats-group'),
    });
    expect(document.body[0]?.blocks).toMatchObject([{ id: 'TB1', type: 'table' }]);
    expect(document.floats).toMatchObject([{ id: 'TB2', type: 'table' }]);
    expect(document.back.map((s) => [s.kind, s.title])).toEqual([
      ['appendix', 'Appendix A'],
      ['appendix', undefined],
    ]);
    expect(document.back[0]?.blocks).toMatchObject([{ id: 'TB3', type: 'table' }]);
    expect(document.back[1]?.blocks).toMatchObject([{ id: 'TB4', type: 'table' }]);
    const tables = blocksOfType(document, 'table');
    expect(tables.map((t) => t.id).sort()).toEqual(['TB1', 'TB2', 'TB3', 'TB4']);
    for (const table of tables) expect(table.rows).toEqual(XHTML_ROWS);
  });

  it('places a back-matter table in the section that holds it', () => {
    // 64 of 283 surveyed tables sit at back/sec: the section is their only position.
    const { back } = parseArticle({
      back:
        '<sec><title>Appendix A – Good Agricultural Practice</title>' +
        `${tableWrap('TB9', 'TABLE A.1', 'Authorised uses')}</sec>`,
      body: '<p>Body.</p>',
    });
    expect(back[0]?.title).toBe('Appendix A – Good Agricultural Practice');
    expect(back[0]?.blocks).toMatchObject([{ id: 'TB9', label: 'TABLE A.1', type: 'table' }]);
  });

  it('lifts a table nested in a <p> out of the prose exactly once', () => {
    // PMC6913007: the whole table sat inside the paragraph, so a flat read fused the
    // grid into the prose and merged adjacent numbers into values that never existed.
    const document = parseBody(
      '<sec><title>Benchmarking</title><p>…used as the ground-truth annotation for ' +
        'benchmarking. <table-wrap id="T1"><label>Table 1</label><caption>' +
        '<p>TE content in the rice genome</p></caption><table><tbody><tr><td>LTR</td>' +
        '<td>14.44</td><td>9.11</td><td>23.54</td></tr></tbody></table></table-wrap></p></sec>',
    );
    expect(document.body[0]?.blocks).toEqual([
      { text: '…used as the ground-truth annotation for benchmarking.', type: 'paragraph' },
      {
        caption: 'TE content in the rice genome',
        headerRows: 0,
        id: 'T1',
        label: 'Table 1',
        rows: [['LTR', '14.44', '9.11', '23.54']],
        type: 'table',
      },
    ]);
    expect(blocksOfType(document, 'table')).toHaveLength(1);
    for (const text of paragraphTexts(document)) {
      expect(text).not.toMatch(/14\.44|9\.11|Table 1|rice genome/);
    }
  });

  it('keeps a table nested in a list inside a paragraph out of every paragraph', () => {
    const document = parseBody(
      '<p>Prose before. <list><list-item><table-wrap><label>Table 1</label><table><tbody>' +
        '<tr><td>14.44</td></tr></tbody></table></table-wrap></list-item></list> Prose after.</p>',
    );
    expect(document.body[0]?.blocks).toMatchObject([
      { text: 'Prose before.', type: 'paragraph' },
      { items: [[{ label: 'Table 1', rows: [['14.44']], type: 'table' }]], type: 'list' },
      { text: 'Prose after.', type: 'paragraph' },
    ]);
    expect(blocksOfType(document, 'table')).toHaveLength(1);
  });

  it('reads an <array> whose rows sit in a bare <tbody> as a table after its paragraph', () => {
    // MDPI's abbreviation glossary: read as prose, the terms ran together.
    const document = parseBody(
      '<sec><title>Abbreviations</title><p>The following abbreviations are used:<array>' +
        '<tbody><tr><td>ED</td><td>Elbow dysplasia</td></tr><tr><td>UAP</td>' +
        '<td>Ununited anconeal process</td></tr></tbody></array></p></sec>',
    );
    expect(document.body[0]?.blocks).toEqual([
      { text: 'The following abbreviations are used:', type: 'paragraph' },
      {
        headerRows: 0,
        rows: [
          ['ED', 'Elbow dysplasia'],
          ['UAP', 'Ununited anconeal process'],
        ],
        type: 'table',
      },
    ]);
    expect(document.diagnostics.unhandled).toEqual([]);
  });

  it('reports no tables for an article that has none', () => {
    const document = parseBody('<sec><title>Results</title><p>No tables here.</p></sec>');
    expect(blocksOfType(document, 'table')).toEqual([]);
    expect(document.diagnostics.warnings.map((w) => w.code)).not.toContain('table-unextractable');
  });
});

describe('table bodies (#111)', () => {
  it('reads an XHTML table wrapped in <alternatives> beside a graphic', () => {
    const table = onlyTable(
      `<label>Table 1</label><alternatives><graphic xlink:href="t1.jpg"/>${XHTML_TABLE}</alternatives>`,
    );
    expect(table.rows).toEqual(XHTML_ROWS);
    expect(table).not.toHaveProperty('unextractable');
  });

  it('marks a graphic-only table unextractable and keeps its label, caption, and footnote', () => {
    const document = parseBody(
      '<sec><title>Results</title><table-wrap id="T1"><label>Table 1</label>' +
        '<caption><p>Scanned table</p></caption><graphic xlink:href="tbl1.jpg"/>' +
        '<table-wrap-foot><p>Source: authors.</p></table-wrap-foot></table-wrap></sec>',
    );
    expect(document.body[0]?.blocks).toEqual([
      {
        caption: 'Scanned table',
        footnotes: ['Source: authors.'],
        headerRows: 0,
        id: 'T1',
        label: 'Table 1',
        rows: [],
        type: 'table',
        unextractable: 'graphic-only',
      },
    ]);
    expect(document.diagnostics.warnings).toContainEqual(
      expect.objectContaining({ code: 'table-unextractable', where: 'T1' }),
    );
  });

  it('marks a CALS tgroup body unextractable rather than parsing it', () => {
    // 0 of 283 surveyed tables used the CALS model, so it is disclosed, not read.
    const table = onlyTable(
      '<label>Table 1</label><tgroup cols="1"><tbody><row><entry>cell</entry></row></tbody></tgroup>',
    );
    expect(table.rows).toEqual([]);
    expect(table.unextractable).toBe('cals-tgroup');
  });

  it('counts a leading all-<th> row as a header when there is no <thead>', () => {
    const table = onlyTable(
      '<table><tr><th>Gene</th><th>Count</th></tr><tr><td>NF1</td><td>12</td></tr></table>',
    );
    expect(table.headerRows).toBe(1);
    expect(table.rows).toEqual([
      ['Gene', 'Count'],
      ['NF1', '12'],
    ]);
  });

  it('keeps a table caption title apart from the paragraphs under it', () => {
    // <caption> children carry no punctuation between them, so a flat read ran the
    // title's last word into the first paragraph's first word.
    const table = onlyTable(
      '<label>Table 1</label><caption><title>Baseline characteristics</title>' +
        '<p>Values are mean (SD).</p><p>Missing entries are left blank.</p></caption>' +
        '<table><tbody><tr><td>Age, years</td></tr></tbody></table>',
    );
    expect(table.caption).toBe(
      '**Baseline characteristics** Values are mean (SD). Missing entries are left blank.',
    );
  });

  it('reads cell markup as inline Markdown', () => {
    const table = onlyTable(
      '<table><tbody><tr><td><italic>NF1</italic><sup>a</sup></td><td>IC<sub>50</sub></td>' +
        '<td>p = 0.01*</td></tr></tbody></table>',
    );
    expect(table.rows).toEqual([['*NF1*^a', 'IC_{50}', 'p = 0.01\\*']]);
  });

  it('collects every footnote line in a table-wrap-foot with its label', () => {
    const table = onlyTable(
      '<table><tbody><tr><td>x</td></tr></tbody></table><table-wrap-foot>' +
        '<fn id="tf1"><label>a</label><p>Adjusted for age.</p></fn>' +
        '<fn-group><fn><p>Unadjusted.</p></fn></fn-group></table-wrap-foot>',
    );
    expect(table.footnotes).toEqual(['a Adjusted for age.', 'Unadjusted.']);
  });
});

describe('spans (#111)', () => {
  it('expands a colspan cell across every column it covers', () => {
    const table = onlyTable(
      '<table><thead><tr><th></th><th colspan="3">Benralizumab</th>' +
        '<th colspan="3">Placebo</th></tr></thead><tbody><tr><td>Blood eosinophils</td>' +
        '<td>268.4±183.6</td><td>10.0±23.7</td><td>7.8±16.5</td><td>241.7±141.8</td>' +
        '<td>232.6±147.9</td><td>251.3±152.2</td></tr></tbody></table>',
    );
    // One entry per grid column, so `Placebo` heads the three columns it spans.
    expect(table.rows).toEqual([
      ['', 'Benralizumab', 'Benralizumab', 'Benralizumab', 'Placebo', 'Placebo', 'Placebo'],
      [
        'Blood eosinophils',
        '268.4±183.6',
        '10.0±23.7',
        '7.8±16.5',
        '241.7±141.8',
        '232.6±147.9',
        '251.3±152.2',
      ],
    ]);
  });

  it('carries a rowspan cell down the rows it covers', () => {
    const table = onlyTable(
      '<table><tbody><tr><td rowspan="3">Cohort A</td><td>Week 0</td><td>1.1</td></tr>' +
        '<tr><td>Week 4</td><td>2.2</td></tr><tr><td>Week 9</td><td>3.3</td></tr>' +
        '<tr><td>Cohort B</td><td>Week 0</td><td>4.4</td></tr></tbody></table>',
    );
    expect(table.rows).toEqual([
      ['Cohort A', 'Week 0', '1.1'],
      ['Cohort A', 'Week 4', '2.2'],
      ['Cohort A', 'Week 9', '3.3'],
      ['Cohort B', 'Week 0', '4.4'],
    ]);
  });

  it('aligns two header rows when the first spans both', () => {
    // PMC11391094 TABLE 2: a rowspan="2" stub beside two colspan="3" group headers,
    // with the per-column labels on the second header row.
    const table = onlyTable(
      '<table><thead><tr><th rowspan="2"></th><th colspan="3">Benralizumab</th>' +
        '<th colspan="3">Placebo</th></tr><tr><th>Baseline</th><th>Week 4</th>' +
        '<th>Week 9</th><th>Baseline</th><th>Week 4</th><th>Week 9</th></tr></thead>' +
        '<tbody><tr><td>Blood eosinophils</td><td>268.4±183.6</td><td>a</td><td>b</td>' +
        '<td>c</td><td>d</td><td>e</td></tr></tbody></table>',
    );
    expect(table.headerRows).toBe(2);
    expect(table.rows.map((row) => row.length)).toEqual([7, 7, 7]);
    // The second header row is offset by the stub, so `Baseline` sits under
    // `Benralizumab` rather than in the label column.
    expect(table.rows[1]).toEqual([
      '',
      'Baseline',
      'Week 4',
      'Week 9',
      'Baseline',
      'Week 4',
      'Week 9',
    ]);
  });

  it('keeps a rowspan cell in its column past the last source cell of a row', () => {
    const table = onlyTable(
      '<table><tbody><tr><td>a</td><td rowspan="2">tall</td></tr><tr><td>b</td></tr></tbody></table>',
    );
    expect(table.rows).toEqual([
      ['a', 'tall'],
      ['b', 'tall'],
    ]);
  });

  it('pads a short row so later cells stay under their headers', () => {
    const table = onlyTable(
      '<table><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>' +
        '<tbody><tr><td>1</td></tr></tbody></table>',
    );
    expect(table.rows).toEqual([
      ['A', 'B', 'C'],
      ['1', '', ''],
    ]);
  });

  it('caps an absurd declared span instead of allocating for it', () => {
    const table = onlyTable(
      '<table><tbody><tr><td colspan="99999999">boom</td></tr><tr><td>after</td></tr></tbody></table>',
    );
    expect(table.rows[0]).toHaveLength(MAX_TABLE_COLUMNS);
    expect(table.rows[0]?.every((cell) => cell === 'boom')).toBe(true);
    // The model keeps a table rectangular, so the short row is padded to the grid.
    expect(table.rows[1]?.[0]).toBe('after');
    expect(table.rows[1]?.slice(1).every((cell) => cell === '')).toBe(true);
  });

  it('reads a non-numeric, zero, or negative span as 1 rather than dropping the cell', () => {
    const table = onlyTable(
      '<table><tbody><tr><td colspan="0">a</td><td colspan="wide">b</td>' +
        '<td rowspan="-4">c</td></tr></tbody></table>',
    );
    expect(table.rows).toEqual([['a', 'b', 'c']]);
  });
});
