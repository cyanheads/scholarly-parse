/**
 * @fileoverview The JATS section walk and the block flow: body sections, loose
 * content outside any `<sec>`, lists, quotes, boxes, preformatted text, block elements
 * nested in a `<p>`, section IDs, back-matter kinds, sub-articles, and footnotes.
 * Issue numbers refer to cyanheads/pubmed-mcp-server, where the parser was hardened.
 * @module tests/formats/jats/sections.test
 */
import { describe, expect, it } from 'vitest';
import { toMarkdown } from '../../../src/index.js';
import { blocksOfType, paragraphTexts, parseArticle, parseBody } from './helpers.js';

const p = (text: string) => ({ text, type: 'paragraph' });

describe('body sections', () => {
  it('keeps loose body paragraphs as one untitled section', () => {
    const { body } = parseBody('<p>Direct paragraph text.</p>');
    expect(body).toEqual([
      { blocks: [p('Direct paragraph text.')], id: 's1', kind: 'body', sections: [] },
    ]);
  });

  it('reads titled sections in document order', () => {
    const { body } = parseBody(
      '<sec><title>Introduction</title><p>Intro text.</p></sec>' +
        '<sec><title>Methods</title><p>Methods text.</p></sec>',
    );
    expect(body.map((s) => s.title)).toEqual(['Introduction', 'Methods']);
    expect(body[0]?.blocks).toEqual([p('Intro text.')]);
  });

  it('nests subsections under their section', () => {
    const { body } = parseBody(
      '<sec><title>Results</title><p>Overview.</p>' +
        '<sec><title>Subresult</title><p>Detail.</p></sec></sec>',
    );
    expect(body[0]?.blocks).toEqual([p('Overview.')]);
    expect(body[0]?.sections.map((s) => s.title)).toEqual(['Subresult']);
  });

  it('recurses through three or more levels of nesting (#112)', () => {
    // PMC9575052: body/sec[RESULTS]/sec[Case reports]/sec[Patient N], one level deeper
    // to pin that the walk has no depth cap of its own.
    const { body } = parseBody(
      '<sec><title>RESULTS</title><p>Results overview.</p>' +
        '<sec><title>Case reports of surgical patients</title>' +
        '<sec><title>Patient 4</title><p>Patient 4 narrative.</p></sec>' +
        '<sec><title>Patient 11</title><p>Patient 11 narrative.</p>' +
        '<sec><title>Follow-up</title><p>Follow-up narrative.</p></sec></sec></sec></sec>',
    );
    const caseReports = body[0]?.sections[0];
    expect(caseReports?.title).toBe('Case reports of surgical patients');
    expect(caseReports?.blocks).toEqual([]);
    expect(caseReports?.sections.map((s) => s.title)).toEqual(['Patient 4', 'Patient 11']);
    expect(caseReports?.sections[1]?.sections[0]).toMatchObject({
      blocks: [p('Follow-up narrative.')],
      sections: [],
      title: 'Follow-up',
    });
  });

  it('keeps loose paragraphs before and after sections in untitled sections (#130)', () => {
    const { body } = parseBody(
      '<p>Opening paragraph.</p><p>Second opening paragraph.</p>' +
        '<sec><title>Methods</title><p>Methods text.</p></sec>' +
        '<p>Trailing paragraph.</p>',
    );
    expect(body.map((s) => ({ blocks: s.blocks, title: s.title }))).toEqual([
      { blocks: [p('Opening paragraph.'), p('Second opening paragraph.')], title: undefined },
      { blocks: [p('Methods text.')], title: 'Methods' },
      { blocks: [p('Trailing paragraph.')], title: undefined },
    ]);
  });

  it('drops a section with no content', () => {
    const { body } = parseBody(
      '<sec><title>Empty</title></sec><sec><title>Populated</title><p>Text.</p></sec>',
    );
    expect(body.map((s) => s.title)).toEqual(['Populated']);
  });

  it('drops a section that only wraps a ref-list, keeping its references (#116)', () => {
    const document = parseBody(
      '<sec><title>References</title><sec><ref-list>' +
        '<ref id="r1"><mixed-citation>Alpha 2020.</mixed-citation></ref>' +
        '</ref-list></sec></sec>' +
        '<sec><title>Introduction</title><p>Intro text.</p></sec>',
    );
    expect(document.body.map((s) => s.title)).toEqual(['Introduction']);
    expect(document.references.map((r) => r.text)).toEqual(['Alpha 2020.']);
  });

  it('keeps a section whose only paragraph wrapped a table (#111)', () => {
    // PMC13088883 "Appendix A": the section's one <p> holds nothing but the
    // <table-wrap>, so lifting the table must not empty the section away.
    const { body } = parseBody(
      '<sec><title>Appendix A – Good Agricultural Practice</title><p><table-wrap>' +
        '<label>Table A.1</label><table><tbody><tr><td>Coffee beans</td></tr></tbody></table>' +
        '</table-wrap></p></sec>' +
        '<sec><title>Populated</title><p>Text.</p></sec>',
    );
    expect(body.map((s) => s.title)).toEqual([
      'Appendix A – Good Agricultural Practice',
      'Populated',
    ]);
    expect(body[0]?.blocks.map((b) => b.type)).toEqual(['table']);
  });

  it('keeps a section whose only child is a table-wrap (#111)', () => {
    const { body } = parseBody(
      '<sec><title>Appendix B – Used compound codes</title><table-wrap>' +
        '<table><tbody><tr><td>code</td></tr></tbody></table></table-wrap></sec>',
    );
    expect(body).toHaveLength(1);
    expect(body[0]?.blocks).toMatchObject([{ rows: [['code']], type: 'table' }]);
  });

  it('keeps sections whose only child is a figure or a supplement (#130)', () => {
    // 16 such sections in a 68-record draw: the heading is what places the figure.
    const { body } = parseBody(
      '<sec><title>Figure 3 legend</title>' +
        '<fig id="F3"><caption><p>Uncaptioned deposit.</p></caption></fig></sec>' +
        '<sec><title>Supplement</title><supplementary-material id="S1">' +
        '<media xlink:href="s1.pdf"/></supplementary-material></sec>',
    );
    expect(body.map((s) => ({ blocks: s.blocks, title: s.title }))).toEqual([
      {
        blocks: [{ caption: 'Uncaptioned deposit.', id: 'F3', type: 'figure' }],
        title: 'Figure 3 legend',
      },
      { blocks: [{ href: 's1.pdf', id: 'S1', type: 'supplement' }], title: 'Supplement' },
    ]);
  });

  it('interleaves paragraphs and blocks in document order beside subsections (#130)', () => {
    const { body } = parseBody(
      '<sec><title>Results</title><p>Before.</p>' +
        '<list list-type="bullet"><list-item><p>Item.</p></list-item></list>' +
        '<p>After.</p><sec><title>Detail</title><p>Nested.</p></sec><p>Trailing.</p></sec>',
    );
    const [results] = body;
    expect(results?.blocks.map((b) => b.type)).toEqual([
      'paragraph',
      'list',
      'paragraph',
      'paragraph',
    ]);
    expect(results?.blocks.filter((b) => b.type === 'paragraph')).toEqual([
      p('Before.'),
      p('After.'),
      p('Trailing.'),
    ]);
    expect(results?.sections.map((s) => ({ blocks: s.blocks, title: s.title }))).toEqual([
      { blocks: [p('Nested.')], title: 'Detail' },
    ]);
  });

  it('keeps mixed inline content in document order (#19)', () => {
    const { body } = parseBody(
      '<sec><title>Results</title><p>Our candidates include <italic>NF1</italic> and ' +
        '<italic>MED12</italic>, as well as <italic>NF2</italic>.</p></sec>',
    );
    expect(body[0]?.blocks).toEqual([
      p('Our candidates include *NF1* and *MED12*, as well as *NF2*.'),
    ]);
  });
});

describe('lists, quotes, and boxes (#130)', () => {
  const abbreviations =
    '<def-list><title>ABBREVIATIONS</title>' +
    '<def-item><term>ANOVA</term><def><p>analysis of variance</p></def></def-item>' +
    '<def-item><term>SNP</term><def><p>single nucleotide</p></def></def-item></def-list>';
  const abbreviationItems = [
    [p('**ANOVA** — analysis of variance')],
    [p('**SNP** — single nucleotide')],
  ];

  it('titles an untitled <sec> with the lone def-list it holds (#130, #169)', () => {
    // PMC12696417's ABBREVIATIONS: a <def-list> is the untitled <sec>'s only child.
    const { body } = parseBody(`<sec>${abbreviations}</sec>`);
    expect(body).toMatchObject([
      {
        blocks: [{ items: abbreviationItems, ordered: false, type: 'list' }],
        title: 'ABBREVIATIONS',
      },
    ]);
    expect(body[0]?.blocks[0]).not.toHaveProperty('title');
  });

  it('keeps a def-list title on the list under a titled <sec> (#169)', () => {
    const { body } = parseBody(`<sec><title>Glossary</title>${abbreviations}</sec>`);
    expect(body).toMatchObject([
      {
        blocks: [{ items: abbreviationItems, title: 'ABBREVIATIONS', type: 'list' }],
        title: 'Glossary',
      },
    ]);
  });

  it('marks order lists ordered and every other list type unordered (#130)', () => {
    const document = parseBody(
      '<sec><title>Findings</title>' +
        '<list list-type="bullet"><list-item><p>Bulleted.</p></list-item></list>' +
        '<list list-type="order"><list-item><p>First.</p></list-item>' +
        '<list-item><p>Second.</p></list-item></list>' +
        '<list list-type="simple"><list-item><p>Bare.</p></list-item></list>' +
        '<list><list-item><p>Untyped.</p></list-item></list></sec>',
    );
    const lists = blocksOfType(document, 'list');
    expect(lists.map((list) => list.ordered)).toEqual([false, true, false, false]);
    expect(toMarkdown(document)).toContain(
      '- Bulleted.\n\n1. First.\n2. Second.\n\n- Bare.\n\n- Untyped.',
    );
  });

  it('leads each item with its printed label and leaves such a list unordered', () => {
    const { body } = parseBody(
      '<list list-type="order"><list-item><label>(a)</label><p>First.</p></list-item>' +
        '<list-item><label>(b)</label><p>Second.</p></list-item></list>',
    );
    expect(body[0]?.blocks).toEqual([
      { items: [[p('(a) First.')], [p('(b) Second.')]], ordered: false, type: 'list' },
    ]);
  });

  it('keeps a list title on the list and drops an empty list (#130)', () => {
    const { body } = parseBody(
      '<sec><title>Findings</title><p>Prose.</p>' +
        '<list list-type="bullet"><title>Key points</title>' +
        '<list-item><p>Point.</p></list-item></list>' +
        '<list list-type="bullet"></list></sec>',
    );
    expect(body[0]?.blocks).toEqual([
      p('Prose.'),
      { items: [[p('Point.')]], ordered: false, title: 'Key points', type: 'list' },
    ]);
  });

  it('nests a list or def-list inside a list item, indented per level (#130)', () => {
    const document = parseBody(
      '<sec><title>Protocol</title><list list-type="bullet"><list-item>' +
        '<p>Outer step.</p><list list-type="bullet"><list-item><p>Inner step.</p>' +
        '<list list-type="bullet"><list-item><p>Deepest step.</p></list-item></list>' +
        '</list-item></list><def-list><def-item><term>CV</term>' +
        '<def><p>coefficient</p></def></def-item></def-list></list-item></list></sec>',
    );
    const [outer] = blocksOfType(document, 'list');
    const [outerItem] = outer?.items ?? [];
    expect(outerItem?.map((b) => b.type)).toEqual(['paragraph', 'list', 'list']);
    const markdown = toMarkdown(document);
    expect(markdown).toContain('- Outer step.');
    expect(markdown).toContain('\n  - Inner step.');
    expect(markdown).toContain('\n    - Deepest step.');
    expect(markdown).toContain('\n  - **CV** — coefficient');
  });

  it('quotes a disp-quote and trails its attribution (#130)', () => {
    const document = parseBody(
      '<sec><title>Discussion</title><disp-quote><p>First quoted paragraph.</p>' +
        '<p>Second quoted paragraph.</p><attrib>Carson, 1962</attrib></disp-quote></sec>',
    );
    expect(document.body[0]?.blocks).toEqual([
      {
        blocks: [p('First quoted paragraph.'), p('Second quoted paragraph.'), p('— Carson, 1962')],
        type: 'quote',
      },
    ]);
    expect(toMarkdown(document)).toContain(
      '> First quoted paragraph.\n>\n> Second quoted paragraph.\n>\n> — Carson, 1962',
    );
  });

  it('keeps the sections a boxed-text holds as sections of the box (#130)', () => {
    // PMC11726426: the <boxed-text>'s only children are <sec>s; PMC13528390 nests a
    // bullet list in the same position.
    const { body } = parseBody(
      '<sec><title>Introduction</title><p>Opening prose.</p><boxed-text>' +
        '<sec><title>Core Ideas</title><p>Boxed prose.</p></sec>' +
        '<sec><title>Implications</title><list list-type="bullet">' +
        '<list-item><p>Testing can guide dosing.</p></list-item></list></sec>' +
        '</boxed-text></sec>',
    );
    expect(body[0]?.blocks).toMatchObject([
      p('Opening prose.'),
      {
        blocks: [],
        sections: [
          { blocks: [p('Boxed prose.')], title: 'Core Ideas' },
          {
            blocks: [{ items: [[p('Testing can guide dosing.')]], type: 'list' }],
            title: 'Implications',
          },
        ],
        type: 'box',
      },
    ]);
  });

  it('keeps a preformat-only body as one code block, spacing intact (#130)', () => {
    // PMC9663051 / PMC9663116 / PMC5420876: the whole <body> is one OCR <preformat>.
    const document = parseBody(
      '<preformat preformat-type="pmc-ocr-text">\n\t\t\tCME  Infectious diseases - 1\n' +
        'Malaria: treatment\n\t\t</preformat>',
    );
    expect(document.body).toHaveLength(1);
    const [code] = document.body[0]?.blocks ?? [];
    expect(code?.type).toBe('code');
    const text = code?.type === 'code' ? code.text : '';
    // Line breaks and the OCR column spacing survive; only surrounding XML
    // indentation is trimmed.
    expect(text.trim()).toBe('CME  Infectious diseases - 1\nMalaria: treatment');
    expect(text).not.toMatch(/^\n|\s$/);
    expect(document.diagnostics.warnings.map((w) => w.code)).not.toContain('no-body');
  });
});

describe('titled blocks outside any section (#148)', () => {
  it('titles a body-level def-list section with the list title', () => {
    // PMC13546078's <body> opens with its abbreviations <def-list>, before any <sec>.
    const { body } = parseBody(
      '<def-list><title>Abbreviations</title>' +
        '<def-item><term>BS</term><def><p>bariatric surgery</p></def></def-item>' +
        '<def-item><term>CV</term><def><p>cardiovascular</p></def></def-item></def-list>' +
        '<sec><title>Introduction</title><p>Intro text.</p></sec>',
    );
    expect(body.map((s) => s.title)).toEqual(['Abbreviations', 'Introduction']);
    expect(body[0]?.blocks).toEqual([
      {
        items: [[p('**BS** — bariatric surgery')], [p('**CV** — cardiovascular')]],
        ordered: false,
        type: 'list',
      },
    ]);
  });

  it('titles body-level list and boxed-text sections the same way', () => {
    // A <list> carries its title directly; a <boxed-text> in <caption><title>.
    const { body } = parseBody(
      '<list list-type="bullet"><title>Key points</title>' +
        '<list-item><p>Point one.</p></list-item></list>' +
        '<boxed-text><caption><title>Box 1. Study at a glance</title></caption>' +
        '<sec><title>Design</title><p>Randomized.</p></sec></boxed-text>',
    );
    expect(body.map((s) => s.title)).toEqual(['Key points', 'Box 1. Study at a glance']);
    expect(body[0]?.blocks).toEqual([{ items: [[p('Point one.')]], ordered: false, type: 'list' }]);
    expect(body[1]?.blocks).toMatchObject([
      { sections: [{ blocks: [p('Randomized.')], title: 'Design' }], type: 'box' },
    ]);
    expect(body[1]?.blocks[0]).not.toHaveProperty('title');
  });

  it('gives a titled block its own section inside a run of untitled content', () => {
    const { body } = parseBody(
      '<p>Opening paragraph.</p><list list-type="bullet"><title>Key points</title>' +
        '<list-item><p>Point.</p></list-item></list><p>Closing paragraph.</p>' +
        '<sec><title>Methods</title><p>Methods text.</p></sec>',
    );
    expect(body.map((s) => ({ blocks: s.blocks.map((b) => b.type), title: s.title }))).toEqual([
      { blocks: ['paragraph'], title: undefined },
      { blocks: ['list'], title: 'Key points' },
      { blocks: ['paragraph'], title: undefined },
      { blocks: ['paragraph'], title: 'Methods' },
    ]);
  });

  it('keeps a run of untitled blocks in one untitled section', () => {
    const { body } = parseBody(
      '<p>Opening paragraph.</p><list list-type="bullet">' +
        '<list-item><p>Untitled point.</p></list-item></list>' +
        '<boxed-text><sec><title>Core Ideas</title><p>Boxed.</p></sec></boxed-text>' +
        '<sec><title>Methods</title><p>Methods text.</p></sec>',
    );
    expect(body.map((s) => ({ blocks: s.blocks.map((b) => b.type), title: s.title }))).toEqual([
      { blocks: ['paragraph', 'list', 'box'], title: undefined },
      { blocks: ['paragraph'], title: 'Methods' },
    ]);
  });

  it('keeps a titled box caption title and paragraph apart (#169)', () => {
    const { body } = parseBody(
      '<sec><label>1</label><title>Assessment</title><p>Assessment text.</p>' +
        '<boxed-text id="box1"><caption><title>Box 1</title><p>Summary.</p></caption>' +
        '<p>Box body.</p></boxed-text></sec>' +
        '<boxed-text id="box0"><caption><title>Key points</title>' +
        '<p>What the panel concluded.</p></caption>' +
        '<p>The additive is safe for the target species.</p></boxed-text>',
    );
    expect(body[0]?.blocks).toEqual([
      p('Assessment text.'),
      {
        blocks: [p('Summary.'), p('Box body.')],
        id: 'box1',
        sections: [],
        title: 'Box 1',
        type: 'box',
      },
    ]);
    // A box lifted to a section of its own loses only its title, never its caption
    // paragraph.
    expect(body[1]?.title).toBe('Key points');
    expect(body[1]?.blocks).toEqual([
      {
        blocks: [p('What the panel concluded.'), p('The additive is safe for the target species.')],
        id: 'box0',
        sections: [],
        type: 'box',
      },
    ]);
  });
});

describe('whole-article shapes (#142, #148, #169)', () => {
  const subsection = (label: string, title: string, text: string) =>
    `<sec><label>${label}</label><title>${title}</title><p>${text}</p></sec>`;

  /** PMC13546078's body, trimmed: a titled def-list before any <sec>, labelled sections. */
  const PMC13546078 = parseArticle({
    attrs: 'article-type="research-article"',
    body:
      '<def-list list-content="abbreviations"><title>Abbreviations</title>' +
      '<def-item><term>BS</term><def><p>bariatric surgery</p></def></def-item>' +
      '<def-item><term>CV</term><def><p>cardiovascular</p></def></def-item>' +
      '<def-item><term>NMA</term><def><p>network meta-analysis</p></def></def-item></def-list>' +
      '<sec><label>1</label><title>Introduction</title><p>Obesity is a major global health ' +
      'issue.</p></sec><sec><label>2</label><title>Methods</title>' +
      subsection('2.1', 'Study Design', 'The transitivity assumption was assessed.') +
      subsection('2.2', 'Search Strategy', 'We searched PubMed, Embase, and Cochrane.') +
      '</sec><sec><label>3</label><title>Results</title><p>Twelve trials met the criteria.</p>' +
      '<fig id="Fig1"><label>Figure 1</label><caption><p>Network of treatment comparisons.</p>' +
      '</caption><alternatives>' +
      '<graphic xlink:href="edm2-70311-g001.tif" specific-use="print" mimetype="image"/>' +
      '<graphic xlink:href="edm2-70311-g001.jpg" specific-use="web" mimetype="image"/>' +
      '</alternatives></fig></sec>',
    meta:
      '<article-id pub-id-type="pmcid">PMC13546078</article-id><title-group>' +
      '<article-title>Bariatric surgery versus GLP-1 receptor agonists</article-title>' +
      '</title-group><abstract><p>Background: Obesity is linked to cardiovascular events.</p>' +
      '</abstract>',
  });

  it('heads the body-level abbreviations list with its own title (#148)', () => {
    const { body } = PMC13546078;
    expect(body.map((s) => [s.label, s.title])).toEqual([
      [undefined, 'Abbreviations'],
      ['1', 'Introduction'],
      ['2', 'Methods'],
      ['3', 'Results'],
    ]);
    expect(body[2]?.sections.map((s) => [s.label, s.title])).toEqual([
      ['2.1', 'Study Design'],
      ['2.2', 'Search Strategy'],
    ]);
    expect(toMarkdown(PMC13546078)).toContain(
      '## Abstract\n\nBackground: Obesity is linked to cardiovascular events.\n\n' +
        '## Abbreviations\n\n- **BS** — bariatric surgery\n- **CV** — cardiovascular\n' +
        '- **NMA** — network meta-analysis\n\n## 1 Introduction\n\n',
    );
    expect(toMarkdown(PMC13546078)).toContain('\n### 2.1 Study Design\n');
  });

  it('resolves the figure pointer under <alternatives> to the web rendering (#142)', () => {
    expect(blocksOfType(PMC13546078, 'figure')).toEqual([
      {
        caption: 'Network of treatment comparisons.',
        href: 'edm2-70311-g001.jpg',
        id: 'Fig1',
        label: 'Figure 1',
        type: 'figure',
      },
    ]);
  });

  it('escapes Markdown delimiters in a section title and its heading (#169)', () => {
    const document = parseBody(
      '<sec><label>1</label><title>Assessment of *risk*, `dose` and _exposure_ [draft]</title>' +
        '<p>Assessment text.</p></sec>',
    );
    const title = 'Assessment of \\*risk\\*, \\`dose\\` and \\_exposure\\_ [draft]';
    expect(document.body[0]?.title).toBe(title);
    expect(toMarkdown(document)).toContain(`\n## 1 ${title}\n`);
  });
});

describe('block elements nested in a paragraph (#130)', () => {
  it('splits a paragraph around a nested disp-formula', () => {
    // PMC11711298: the <disp-formula> sits inside a <p>.
    const { body } = parseBody(
      '<sec><title>Methods</title><p>The model is <disp-formula><label>(1)</label>' +
        '<tex-math>y = X\\beta + Zu + e</tex-math></disp-formula> where u is random.</p></sec>',
    );
    expect(body[0]?.blocks).toEqual([
      p('The model is'),
      { label: '(1)', tex: 'y = X\\beta + Zu + e', type: 'formula' },
      p('where u is random.'),
    ]);
  });

  it('lifts a nested figure out of the sentence', () => {
    // PMC12715233: `warranted.Fig. 1Comparison` — terminator, label, and caption fused.
    const document = parseBody(
      '<p>…suggests that further scrutiny is warranted.<fig id="F1"><label>Fig. 1</label>' +
        '<caption><p>Comparison of apparent resistivity and phase data.</p></caption>' +
        '<graphic xlink:href="f0001.jpg"/></fig></p>',
    );
    expect(document.body[0]?.blocks).toEqual([
      p('…suggests that further scrutiny is warranted.'),
      {
        caption: 'Comparison of apparent resistivity and phase data.',
        href: 'f0001.jpg',
        id: 'F1',
        label: 'Fig. 1',
        type: 'figure',
      },
    ]);
    for (const text of paragraphTexts(document)) {
      expect(text).not.toContain('Comparison of apparent resistivity');
    }
  });

  it('places a nested list and media at block position, never inside a sentence', () => {
    const { body } = parseBody(
      '<sec><title>Methods</title><p>Samples were prepared as follows.' +
        '<list list-type="bullet"><list-item><p>Rinse twice.</p></list-item></list>' +
        'Then measured.<media xlink:href="movie.mp4"/></p></sec>',
    );
    expect(body[0]?.blocks).toEqual([
      p('Samples were prepared as follows.'),
      { items: [[p('Rinse twice.')]], ordered: false, type: 'list' },
      p('Then measured.'),
      { href: 'movie.mp4', type: 'supplement' },
    ]);
  });
});

describe('section IDs', () => {
  it('uses the source ID, else a path-derived one', () => {
    const { body } = parseBody(
      '<sec id="sec-intro"><title>Introduction</title><p>Intro.</p></sec>' +
        '<sec><title>Results</title><p>Overview.</p>' +
        '<sec><title>Detail</title><p>Nested.</p></sec></sec>',
    );
    expect(body.map((s) => s.id)).toEqual(['sec-intro', 's2']);
    expect(body[1]?.sections[0]?.id).toBe('s2.1');
  });

  it('makes a repeated source ID unique', () => {
    const { body } = parseBody(
      '<sec id="dup"><title>One</title><p>A.</p></sec>' +
        '<sec id="dup"><title>Two</title><p>B.</p></sec>',
    );
    expect(body.map((s) => s.id)).toEqual(['dup', 'dup-2']);
  });

  it('releases the ID of a section that is dropped', () => {
    const { body } = parseBody(
      '<sec id="x"><title>Empty</title></sec><sec id="x"><title>Kept</title><p>A.</p></sec>',
    );
    expect(body.map((s) => ({ id: s.id, title: s.title }))).toEqual([{ id: 'x', title: 'Kept' }]);
  });
});

describe('back matter', () => {
  it('reports each back-matter section with its kind', () => {
    const { back } = parseArticle({
      back:
        '<ack><title>Acknowledgements</title><p>We thank the lab.</p></ack>' +
        '<app-group><app id="app1"><title>Appendix A</title><p>Extra.</p></app></app-group>' +
        '<sec sec-type="data-availability"><title>Data</title><p>On request.</p></sec>' +
        '<notes notes-type="competing-interests"><p>None declared.</p></notes>' +
        '<sec><title>Conflicts of interest</title><p>None.</p></sec>' +
        '<sec><title>Funding</title><p>Grant 1.</p></sec>' +
        '<sec><title>Abbreviations</title><p>BS: bariatric surgery.</p></sec>' +
        '<ref-list><ref id="r1"><mixed-citation>Ref.</mixed-citation></ref></ref-list>',
      body: '<p>Body.</p>',
    });
    expect(back.map((s) => [s.kind, s.title])).toEqual([
      ['acknowledgments', 'Acknowledgements'],
      ['appendix', 'Appendix A'],
      ['data-availability', 'Data'],
      ['declarations', undefined],
      ['declarations', 'Conflicts of interest'],
      ['declarations', 'Funding'],
      ['notes', 'Abbreviations'],
    ]);
    expect(back[1]?.id).toBe('app1');
  });

  it('collects back-matter and author-note footnotes', () => {
    const { footnotes } = parseArticle({
      back: '<fn-group><fn id="fn1"><label>1</label><p>Deposited at Zenodo.</p></fn></fn-group>',
      body: '<p>Body.</p>',
      meta:
        '<title-group><article-title>T</article-title></title-group>' +
        '<author-notes><fn id="afn1"><p>Equal contribution.</p></fn></author-notes>',
    });
    expect(footnotes).toEqual([
      { id: 'afn1', text: 'Equal contribution.' },
      { id: 'fn1', label: '1', text: 'Deposited at Zenodo.' },
    ]);
  });

  it('collects an inline footnote and leaves its label as a marker', () => {
    const document = parseBody(
      '<p>Measured twice<fn id="fn2"><label>a</label><p>By two raters.</p></fn> in total.</p>',
    );
    expect(document.footnotes).toEqual([{ id: 'fn2', label: 'a', text: 'By two raters.' }]);
    expect(paragraphTexts(document)).toEqual(['Measured twice^a in total.']);
  });

  it('reads each sub-article as a back section holding its own body', () => {
    const document = parseArticle({
      body: '<p>Main text.</p>',
      tail:
        '<sub-article id="sa1" article-type="decision-letter"><front-stub><title-group>' +
        '<article-title>Decision letter</article-title></title-group></front-stub>' +
        '<body><p>The reviewers agree.</p><sec><title>Major points</title><p>One.</p></sec>' +
        '</body></sub-article>' +
        '<sub-article id="sa2"><front-stub><title-group><article-title>Empty</article-title>' +
        '</title-group></front-stub><body/></sub-article>',
    });
    expect(document.back).toMatchObject([
      {
        blocks: [],
        id: 'sa1',
        kind: 'sub-article',
        sections: [
          { blocks: [p('The reviewers agree.')], kind: 'sub-article' },
          { kind: 'sub-article', title: 'Major points' },
        ],
        title: 'Decision letter',
      },
    ]);
    expect(blocksOfType(document, 'paragraph').map((b) => b.text)).toContain('One.');
  });
});
