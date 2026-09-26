/**
 * @fileoverview JATS `<fig>`, `<graphic>`, `<supplementary-material>`, and `<media>` →
 * `FigureBlock` / `SupplementBlock` at their document position: labels and captions
 * wherever the deposit hangs them, the file pointer (including one under
 * `<alternatives>`), and assets outside the body. Issue numbers refer to
 * cyanheads/pubmed-mcp-server.
 * @module tests/formats/jats/figures.test
 */
import { describe, expect, it } from 'vitest';
import { toMarkdown } from '../../../src/index.js';
import {
  allBlocks,
  blocksOfType,
  paragraphTexts,
  parseArticle,
  parseBody,
  texMath,
} from './helpers.js';

/** A `<fig>` in the shape all 258 figures in a 68-record validation draw carry. */
const fig = (id: string, label: string, caption: string, href: string) =>
  `<fig id="${id}"><label>${label}</label><caption><p>${caption}</p></caption>` +
  `<graphic xlink:href="${href}"/></fig>`;

/** The figure in a body whose one section holds `<fig id="Fig1">` with these children. */
function onlyFigure(children: string) {
  const document = parseBody(`<sec><title>Results</title><fig id="Fig1">${children}</fig></sec>`);
  const figures = blocksOfType(document, 'figure');
  expect(figures).toHaveLength(1);
  return { document, figure: figures[0] };
}

describe('figures (#130)', () => {
  it('reads a section figure with every field it deposits', () => {
    const { body } = parseBody(
      '<sec><title>Results</title><p>Resistivity rose.</p>' +
        `${fig('F1', 'Figure 1.', 'Apparent resistivity by interval.', 'g001.jpg')}</sec>`,
    );
    expect(body[0]?.blocks).toEqual([
      { text: 'Resistivity rose.', type: 'paragraph' },
      {
        caption: 'Apparent resistivity by interval.',
        href: 'g001.jpg',
        id: 'F1',
        label: 'Figure 1.',
        type: 'figure',
      },
    ]);
  });

  it('reads a one-paragraph caption with its inline markup in place (#111)', () => {
    const { figure } = onlyFigure(
      '<label>Fig. 1</label><caption><p>Expression of <italic>NF1</italic> across 12 ' +
        'tissues.</p></caption>',
    );
    expect(figure?.caption).toBe('Expression of *NF1* across 12 tissues.');
  });

  it('keeps a caption title apart from the paragraphs under it (#111, #130)', () => {
    // PMC12816603 Fig. 1 read `…observational constraints6.Cloud susceptibilities…`:
    // the title's trailing superscript, then the first paragraph, with no gap.
    const { figure } = onlyFigure(
      '<label>Fig. 1</label><caption><title>Cloud susceptibilities from observational ' +
        'constraints</title><p>Susceptibilities are shown for each regime.</p>' +
        '<p>Shading marks the interquartile range.</p></caption>' +
        '<graphic xlink:href="g001.jpg"/>',
    );
    expect(figure?.caption).toBe(
      '**Cloud susceptibilities from observational constraints** Susceptibilities are ' +
        'shown for each regime. Shading marks the interquartile range.',
    );
  });

  it('reads figures in the abstract, the body, the floats-group, and back matter', () => {
    // 17% of figures and 23% of supplements sit outside <body> (PMC10827061's eight
    // figures are all in a <floats-group>).
    const document = parseArticle({
      back:
        '<sec><title>Appendix A</title><p><supplementary-material id="S3">' +
        '<label>Table S3</label><caption><p>Raw measurements.</p></caption>' +
        '<media xlink:href="s003.xlsx"/></supplementary-material></p></sec>',
      body:
        '<sec><title>Results</title>' +
        `<sec>${fig('F1', 'Figure 1.', 'In an untitled subsection.', 'g001.jpg')}</sec></sec>`,
      floats: fig('F2', 'Figure 2.', 'In floats-group.', 'g002.jpg'),
      meta:
        '<title-group><article-title>T</article-title></title-group>' +
        `<abstract>${fig('FA', 'Graphical abstract', 'Overview.', 'ga.jpg')}</abstract>`,
    });
    expect(document.abstracts[0]?.sections[0]?.blocks).toMatchObject([
      { href: 'ga.jpg', id: 'FA', type: 'figure' },
    ]);
    // A figure in an untitled subsection is still inside the section that titles it.
    const results = document.body[0];
    expect(results?.title).toBe('Results');
    expect(results?.sections[0]?.title).toBeUndefined();
    expect(results?.sections[0]?.blocks).toMatchObject([{ id: 'F1', type: 'figure' }]);
    expect(document.floats).toEqual([
      {
        caption: 'In floats-group.',
        href: 'g002.jpg',
        id: 'F2',
        label: 'Figure 2.',
        type: 'figure',
      },
    ]);
    expect(document.back[0]?.blocks).toEqual([
      {
        caption: 'Raw measurements.',
        href: 's003.xlsx',
        id: 'S3',
        label: 'Table S3',
        type: 'supplement',
      },
    ]);
  });

  it('keeps an unlabelled or pointerless asset rather than dropping it', () => {
    // PMC13155148's supplements carry a caption and a <media> but no <label>; 14 of 84
    // in the draw carry no pointer at all.
    const { back } = parseBody(
      '<sec><title>Data availability</title>' +
        '<supplementary-material id="mol270153-supitem-0001"><caption><p>Fig. S1. Vector ' +
        'map.</p></caption><media xlink:href="MOL2-20-1253-s002.pdf"/></supplementary-material>' +
        '<supplementary-material id="bare"/>' +
        '<fig><caption><p>Caption but no label.</p></caption></fig></sec>',
    );
    expect(back[0]?.blocks).toEqual([
      {
        caption: 'Fig. S1. Vector map.',
        href: 'MOL2-20-1253-s002.pdf',
        id: 'mol270153-supitem-0001',
        type: 'supplement',
      },
      { id: 'bare', type: 'supplement' },
      { caption: 'Caption but no label.', type: 'figure' },
    ]);
  });

  it('reads a label and caption hung on the pointer element', () => {
    // `label?, caption?` are in the content model of <media> and <graphic>; 19 of the
    // draw's supplements carry their text there and nothing on the element itself.
    const document = parseBody(
      '<sec><title>Supplementary information</title><supplementary-material id="MOESM1">' +
        '<media xlink:href="41551_2025_1498_MOESM1_ESM.pdf"><label>Supplementary Information' +
        '</label><caption><p>Supplementary Note, Figs. 1–24 and Tables 1–3.</p></caption>' +
        '</media></supplementary-material></sec>',
    );
    expect(document.back[0]?.blocks).toEqual([
      {
        caption: 'Supplementary Note, Figs. 1–24 and Tables 1–3.',
        href: '41551_2025_1498_MOESM1_ESM.pdf',
        id: 'MOESM1',
        label: 'Supplementary Information',
        type: 'supplement',
      },
    ]);
    expect(toMarkdown(document)).toContain(
      '**Supplementary Information.** Supplementary Note, Figs. 1–24 and Tables 1–3. ' +
        '(file: 41551_2025_1498_MOESM1_ESM.pdf)',
    );
  });

  it('prefers the asset element own label and caption over the pointer own', () => {
    const { figure } = onlyFigure(
      '<label>Fig. 1</label><caption><p>The figure caption.</p></caption>' +
        '<graphic xlink:href="g001.jpg"><caption><p>The graphic caption.</p></caption></graphic>',
    );
    expect(figure).toEqual({
      caption: 'The figure caption.',
      href: 'g001.jpg',
      id: 'Fig1',
      label: 'Fig. 1',
      type: 'figure',
    });
  });

  it('appends the attribution to the caption and keeps the alt text', () => {
    const { figure } = onlyFigure(
      '<label>Fig. 2</label><caption><p>Field site.</p></caption>' +
        '<alt-text>Aerial photograph of the field site</alt-text>' +
        '<graphic xlink:href="g002.jpg"/><attrib>Photo: A. Author.</attrib>',
    );
    expect(figure).toMatchObject({
      alt: 'Aerial photograph of the field site',
      caption: 'Field site. Photo: A. Author.',
    });
  });

  it('follows a figure with the figure supplements nested inside it', () => {
    const document = parseBody(
      `<sec><title>Results</title><fig id="F1"><label>Figure 1.</label><caption><p>Main.</p>` +
        '</caption><graphic xlink:href="f1.jpg"/><p content-type="supplemental-figure">' +
        `${fig('F1S1', 'Figure 1—figure supplement 1.', 'Controls.', 'f1s1.jpg')}</p></fig></sec>`,
    );
    expect(document.body[0]?.blocks).toMatchObject([
      { id: 'F1', type: 'figure' },
      { caption: 'Controls.', id: 'F1S1', type: 'figure' },
    ]);
  });

  it('reads a bare body-level <graphic> as a figure', () => {
    const { body } = parseBody(
      '<p>Before.</p><graphic xlink:href="scheme1.gif"><alt-text>Scheme 1</alt-text></graphic>',
    );
    expect(body[0]?.blocks).toEqual([
      { text: 'Before.', type: 'paragraph' },
      { alt: 'Scheme 1', href: 'scheme1.gif', type: 'figure' },
    ]);
  });

  it('lifts a figure nested in a <p> exactly once, out of the prose', () => {
    const document = parseBody(
      '<p>…suggests that further scrutiny is warranted.' +
        `${fig('F1', 'Fig. 1', 'Comparison of apparent resistivity and phase data.', 'f0001.jpg')}</p>`,
    );
    expect(blocksOfType(document, 'figure')).toEqual([
      {
        caption: 'Comparison of apparent resistivity and phase data.',
        href: 'f0001.jpg',
        id: 'F1',
        label: 'Fig. 1',
        type: 'figure',
      },
    ]);
    expect(paragraphTexts(document)).toEqual(['…suggests that further scrutiny is warranted.']);
  });

  it('heads a figure group with its label and caption, its panels after it', () => {
    // Europe PMC preprints: <fig-group><label>Figure 1</label><caption>…</caption>
    // <fig><graphic/></fig><fig><graphic/></fig></fig-group>, the panels bare.
    const document = parseBody(
      '<sec><title>Results</title><fig-group id="F1"><label>Figure 1</label><caption>' +
        '<title>Study overview.</title><p>(A) Design. (B) Results.</p></caption>' +
        '<fig id="F1a"><graphic xlink:href="f001"/></fig>' +
        '<fig id="F1b"><graphic xlink:href="f002"/></fig></fig-group></sec>',
    );
    expect(document.body[0]?.blocks).toEqual([
      { text: '**Figure 1.** **Study overview.** (A) Design. (B) Results.', type: 'paragraph' },
      { href: 'f001', id: 'F1a', type: 'figure' },
      { href: 'f002', id: 'F1b', type: 'figure' },
    ]);
  });

  it('reads a figure with nothing to show but a <media> file as a supplement', () => {
    // A peer-review sub-article whose body is <fig><media xlink:href="….pdf"/></fig>.
    const document = parseBody(
      '<sec><title>Review Process File</title><fig id="d1">' +
        '<media xlink:href="reviewer_comments.pdf" mimetype="application" mime-subtype="pdf"/>' +
        '</fig></sec>',
    );
    expect(document.body[0]?.blocks).toEqual([
      { href: 'reviewer_comments.pdf', id: 'd1', type: 'supplement' },
    ]);
    expect(toMarkdown(document)).toContain(
      '**Supplementary material.** (file: reviewer_comments.pdf)',
    );
  });

  it('renders nothing for a box holding only an image with no label or caption', () => {
    const document = parseBody(
      '<sec><title>Results</title><p>Text.</p>' +
        '<boxed-text><fig><graphic xlink:href="f1.jpg"/></fig></boxed-text></sec>',
    );
    expect(toMarkdown(document)).toMatch(/## Results\n\nText\.\n$/);
  });

  it('reports no figures or supplements for an article that has none', () => {
    const document = parseBody('<sec><title>Results</title><p>No figures here.</p></sec>');
    expect(allBlocks(document).map((b) => b.type)).toEqual(['paragraph']);
  });
});

describe('figures inside a box (#169)', () => {
  it('keeps every figure of a lifted box inside the section the box became', () => {
    const document = parseBody(
      '<boxed-text id="box0"><caption><title>Key points</title><p>What the panel concluded.' +
        '</p></caption><p>The additive is safe for the target species.</p>' +
        '<fig id="BoxFig1"><label>Figure B1</label><caption><p>Exposure pathways.</p>' +
        '</caption><graphic xlink:href="box-fig1.jpg"/></fig>' +
        '<sec><title>Uncertainties</title><p>Data gaps remain.</p><fig id="BoxFig2">' +
        '<label>Figure B2</label><graphic xlink:href="box-fig2.jpg"/></fig></sec></boxed-text>' +
        '<sec><title>Assessment</title><p>Assessment text.</p></sec>',
    );
    const [keyPoints] = document.body;
    expect(keyPoints?.title).toBe('Key points');
    expect(keyPoints?.blocks).toMatchObject([
      {
        blocks: [
          { text: 'What the panel concluded.' },
          { text: 'The additive is safe for the target species.' },
          { href: 'box-fig1.jpg', id: 'BoxFig1', label: 'Figure B1', type: 'figure' },
        ],
        sections: [
          {
            blocks: [
              { text: 'Data gaps remain.' },
              { href: 'box-fig2.jpg', id: 'BoxFig2', label: 'Figure B2', type: 'figure' },
            ],
            title: 'Uncertainties',
          },
        ],
        type: 'box',
      },
    ]);
    const selected = toMarkdown(document, { sections: [keyPoints?.id ?? ''] });
    expect(selected).toContain('**Figure B1.** Exposure pathways.');
    expect(selected).toContain('**Figure B2.**');
    expect(selected).not.toContain('Assessment text.');
  });
});

describe('a pointer wrapped in <alternatives> (#142)', () => {
  /**
   * No figure of this shape turned up in a ~2,000-figure live sample, so these cases
   * follow the JATS content model and JATS4R's display-object recommendation.
   */
  it('takes the first pointer in document order when none is marked for the web', () => {
    const { figure } = onlyFigure(
      '<label>Figure 1</label><caption><p>Study design.</p></caption><alternatives>' +
        '<graphic xlink:href="fig1.tif" mimetype="image" mime-subtype="tiff"/>' +
        '<graphic xlink:href="fig1.jpg" mimetype="image" mime-subtype="jpeg"/></alternatives>',
    );
    expect(figure).toEqual({
      caption: 'Study design.',
      href: 'fig1.tif',
      id: 'Fig1',
      label: 'Figure 1',
      type: 'figure',
    });
  });

  it('prefers the pointer whose specific-use names the web over a print one before it', () => {
    // PMC13546078's Figure 1 carries a print TIFF, then a web JPEG.
    const { figure } = onlyFigure(
      '<label>Figure 1</label><alternatives>' +
        '<graphic xlink:href="fig1-print.tif" specific-use="print"/>' +
        '<graphic xlink:href="fig1-web.jpg" specific-use="web"/></alternatives>',
    );
    expect(figure?.href).toBe('fig1-web.jpg');
  });

  it('matches a specific-use containing web, on a <media> as well as a <graphic>', () => {
    const { figure } = onlyFigure(
      '<label>Movie 1</label><alternatives>' +
        '<media xlink:href="movie1.mov" specific-use="print-only"/>' +
        '<media xlink:href="movie1.mp4" specific-use="Web-Version"/></alternatives>',
    );
    expect(figure?.href).toBe('movie1.mp4');
  });

  it('reads a label and caption hung on the wrapped pointer', () => {
    const { document, figure } = onlyFigure(
      '<alternatives><graphic xlink:href="fig2.jpg" specific-use="web"><label>Figure 2</label>' +
        '<caption><p>Enrollment flow.</p></caption></graphic>' +
        '<graphic xlink:href="fig2.tif" specific-use="print"/></alternatives>',
    );
    expect(figure).toEqual({
      caption: 'Enrollment flow.',
      href: 'fig2.jpg',
      id: 'Fig1',
      label: 'Figure 2',
      type: 'figure',
    });
    expect(toMarkdown(document)).toContain('**Figure 2.** Enrollment flow.');
  });

  it('keeps a direct pointer ahead of any under <alternatives>', () => {
    const wrapped =
      '<alternatives><graphic xlink:href="wrapped.jpg" specific-use="web"/></alternatives>';
    expect(
      onlyFigure(`<label>Figure 1</label><graphic xlink:href="direct.jpg"/>${wrapped}`).figure
        ?.href,
    ).toBe('direct.jpg');
    expect(
      onlyFigure(`<label>Video 1</label><media xlink:href="direct.mp4"/>${wrapped}`).figure?.href,
    ).toBe('direct.mp4');
  });

  it('reports no href when neither the figure nor its <alternatives> holds a pointer', () => {
    const { figure } = onlyFigure(
      '<label>Figure 3</label><caption><p>Schematic.</p></caption>' +
        `<alternatives>${texMath('x^2')}<textual-form>A parabola.</textual-form></alternatives>`,
    );
    expect(figure).toEqual({
      caption: 'Schematic.',
      id: 'Fig1',
      label: 'Figure 3',
      type: 'figure',
    });
  });
});
