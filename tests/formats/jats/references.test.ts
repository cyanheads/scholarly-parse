/**
 * @fileoverview The JATS reference list: every `<ref>` under any `<ref-list>`, its
 * citation as readable text (element-citation fields delimited, mixed-citation
 * zero-gap adjacencies spaced, typed identifiers labeled), and its structured fields.
 * Issue numbers refer to cyanheads/pubmed-mcp-server.
 * @module tests/formats/jats/references.test
 */
import { describe, expect, it } from 'vitest';
import { toMarkdown } from '../../../src/index.js';
import { expectLinear } from '../../linear.js';
import { paragraphTexts, parseArticle, parseBody, texMath } from './helpers.js';

/** References of an article whose `<back>` is `back`. */
const referencesOf = (back: string) => parseArticle({ back, body: '<p>Body.</p>' }).references;

/** The citation text of a single `<ref>` whose `<mixed-citation>` holds `content`. */
const mixedCitation = (content: string, id = 'R1') =>
  referencesOf(
    `<ref-list><ref id="${id}"><mixed-citation>${content}</mixed-citation></ref></ref-list>`,
  )[0]?.text;

describe('reference forms', () => {
  it('reads a mixed-citation with its id and label', () => {
    const references = referencesOf(
      '<ref-list><ref id="ref1"><label>1</label>' +
        '<mixed-citation>Smith J et al. Nature 2024.</mixed-citation></ref></ref-list>',
    );
    expect(references).toEqual([{ id: 'ref1', label: '1', text: 'Smith J et al. Nature 2024.' }]);
  });

  it('falls back to an element-citation', () => {
    const references = referencesOf(
      '<ref-list><ref><element-citation>Citation text here.</element-citation></ref></ref-list>',
    );
    expect(references.map((r) => r.text)).toEqual(['Citation text here.']);
  });

  it('skips a reference with no citation text', () => {
    const references = referencesOf(
      '<ref-list><ref><label>1</label></ref>' +
        '<ref><mixed-citation>   </mixed-citation></ref></ref-list>',
    );
    expect(references).toEqual([]);
  });

  it('reads references wrapped in citation-alternatives, preferring the mixed form (#66)', () => {
    // The AlphaFold record (PMC8371605) shape that dropped 64 of 84 references.
    const references = referencesOf(
      '<ref-list><ref id="CR15"><label>15</label><citation-alternatives>' +
        '<element-citation>Structured citation form.</element-citation>' +
        '<mixed-citation>Jumper J, et al. Nature. 2021;596:583-9.</mixed-citation>' +
        '</citation-alternatives></ref>' +
        '<ref id="CR16"><mixed-citation>Direct ref. Science. 2020.</mixed-citation></ref>' +
        '</ref-list>',
    );
    expect(references).toEqual([
      { id: 'CR15', label: '15', text: 'Jumper J, et al. Nature. 2021;596:583-9.' },
      { id: 'CR16', text: 'Direct ref. Science. 2020.' },
    ]);
  });

  it('falls back to an element-citation inside citation-alternatives', () => {
    const references = referencesOf(
      '<ref-list><ref id="CR1"><citation-alternatives>' +
        '<element-citation>Element only.</element-citation></citation-alternatives></ref></ref-list>',
    );
    expect(references).toEqual([{ id: 'CR1', text: 'Element only.' }]);
  });

  it('escapes citation text so it cannot read as Markdown it never was', () => {
    expect(mixedCitation('Doe J. The *p53* pathway [2020](draft).')).toBe(
      'Doe J. The \\*p53\\* pathway [2020\\](draft).',
    );
  });

  it('reads a formula in a citation as math, with the text around it escaped', () => {
    expect(
      mixedCitation(
        `Observation of <inline-formula><alternatives>${texMath('$$\\bar{p}p$$')}` +
          '<mml:math><mml:mi>p</mml:mi></mml:math></alternatives></inline-formula> collisions at ' +
          '<inline-formula><mml:math><mml:msqrt><mml:mi>s</mml:mi></mml:msqrt></mml:math></inline-formula>' +
          ' in *pp*.',
      ),
    ).toBe('Observation of $\\bar{p}p$ collisions at $\\sqrt{s}$ in \\*pp\\*.');
    const [reference] = referencesOf(
      '<ref-list><ref id="a"><element-citation><article-title>The anti-<inline-formula>' +
        `${texMath('$$k_{T}$$')}</inline-formula> jet algorithm</article-title>` +
        '<source>JHEP</source><year>2008</year></element-citation></ref></ref-list>',
    );
    expect(reference?.text).toBe('The anti-$k_{T}$ jet algorithm. JHEP. 2008.');
  });

  it('renders the reference list with each printed label', () => {
    const document = parseArticle({
      back: '<ref-list><ref id="r1"><label>1</label><mixed-citation>Alpha 2020.</mixed-citation></ref></ref-list>',
      body: '<p>Body.</p>',
    });
    expect(toMarkdown(document)).toContain('## References\n\n- [1] Alpha 2020.');
  });
});

describe('element-citation (#69)', () => {
  it('delimits structured fields, keeps page tokens verbatim, and labels identifiers', () => {
    // PMC12973387 (an Elsevier deposit) ships <element-citation> only. Its children
    // carry no punctuation, so a flat read ran every field together
    // (DomanJ.L.…Cell18618…), and `4002.e26` once coerced to 4.002e+29.
    const [reference] = referencesOf(
      '<ref-list><ref id="bib2"><label>2</label><element-citation>' +
        '<person-group person-group-type="author">' +
        '<name><surname>Doman</surname><given-names>J.L.</given-names></name>' +
        '<name><surname>Pandey</surname><given-names>S.</given-names></name></person-group>' +
        '<article-title>Phage-assisted evolution yields compact prime editors</article-title>' +
        '<source>Cell</source><volume>186</volume><issue>18</issue><year>2023</year>' +
        '<fpage>3983</fpage><lpage>4002.e26</lpage>' +
        '<pub-id pub-id-type="pmid">37657419</pub-id>' +
        '<pub-id pub-id-type="doi">10.1016/j.cell.2023.07.039</pub-id>' +
        '<pub-id pub-id-type="pmcid">PMC10482982</pub-id></element-citation></ref></ref-list>',
    );
    expect(reference).toEqual({
      authors: ['Doman J.L.', 'Pandey S.'],
      doi: '10.1016/j.cell.2023.07.039',
      id: 'bib2',
      label: '2',
      pmcid: 'PMC10482982',
      pmid: '37657419',
      source: 'Cell',
      text:
        'Doman J.L., Pandey S. Phage-assisted evolution yields compact prime editors. Cell. ' +
        '2023;186(18):3983–4002.e26. PMID 37657419 DOI 10.1016/j.cell.2023.07.039 PMCID PMC10482982',
      title: 'Phage-assisted evolution yields compact prime editors',
      year: '2023',
    });
  });

  it('renders collab and etal author forms', () => {
    const [reference] = referencesOf(
      '<ref-list><ref id="bib9"><element-citation><person-group person-group-type="author">' +
        '<collab>The ENCODE Project Consortium</collab><etal/></person-group>' +
        '<source>Nature</source><year>2012</year></element-citation></ref></ref-list>',
    );
    expect(reference?.text).toBe('The ENCODE Project Consortium, et al. Nature. 2012.');
    expect(reference?.authors).toEqual(['The ENCODE Project Consortium', 'et al.']);
  });

  it('lays fields out in citation order and shows each identifier once', () => {
    // PMC11701261 lists the volume before the year; Europe PMC repeats the PMID as a
    // `medline` ID and the DOI as a `pii`.
    const [journal, chapter] = referencesOf(
      '<ref-list><ref id="a"><element-citation><person-group person-group-type="author">' +
        '<name><surname>Kempfer</surname><given-names>R.</given-names></name></person-group>' +
        '<article-title>Methods for mapping 3D chromosome architecture</article-title>' +
        '<source>Nat. Rev. Genet.</source><volume>21</volume><year>2020</year>' +
        '<fpage>207</fpage><lpage>226</lpage><pub-id pub-id-type="medline">31848476</pub-id>' +
        '<pub-id pub-id-type="doi">10.1038/s41576-019-0195-2</pub-id>' +
        '<pub-id pub-id-type="pii">10.1038/s41576-019-0195-2</pub-id>' +
        '<pub-id pub-id-type="pmid">31848476</pub-id></element-citation></ref>' +
        '<ref id="b"><element-citation publication-type="book"><person-group>' +
        '<name><surname>Roe</surname><given-names>R</given-names></name></person-group>' +
        '<chapter-title>Methods</chapter-title><person-group person-group-type="editor">' +
        '<name><surname>Doe</surname><given-names>J</given-names></name></person-group>' +
        '<source>Handbook</source><edition>2nd ed</edition><publisher-loc>Oxford</publisher-loc>' +
        '<publisher-name>OUP</publisher-name><year>2019</year><fpage>12</fpage><lpage>30</lpage>' +
        '</element-citation></ref></ref-list>',
    );
    expect(journal?.text).toBe(
      'Kempfer R. Methods for mapping 3D chromosome architecture. Nat. Rev. Genet. ' +
        '2020;21:207–226. PMID 31848476 DOI 10.1038/s41576-019-0195-2',
    );
    expect(chapter?.text).toBe(
      'Roe R. Methods. In: Doe J, editors. Handbook. 2nd ed. Oxford: OUP; 2019, 12–30.',
    );
  });

  it('reads an element-citation with punctuation of its own as written', () => {
    const [reference] = referencesOf(
      '<ref-list><ref id="a"><element-citation><person-group><name><surname>Roe</surname>' +
        '<given-names>R</given-names></name></person-group>. Title. <source>Journal</source> ' +
        '(<year>2019</year>).</element-citation></ref></ref-list>',
    );
    expect(reference?.text).toBe('Roe R. Title. Journal (2019).');
  });

  it('reads a DOI from a doi.org link and keeps any other link as the URL', () => {
    const references = referencesOf(
      '<ref-list><ref id="a"><element-citation><source>Data</source>' +
        '<ext-link xlink:href="https://doi.org/10.5281/ZENODO.123">link</ext-link>' +
        '</element-citation></ref><ref id="b"><element-citation><source>Site</source>' +
        '<ext-link xlink:href="https://example.org/data">link</ext-link>' +
        '</element-citation></ref></ref-list>',
    );
    expect(references[0]).toMatchObject({ doi: '10.5281/zenodo.123' });
    expect(references[0]).not.toHaveProperty('url');
    expect(references[1]).toMatchObject({ url: 'https://example.org/data' });
  });

  it('reads identifiers from typed ext-links, never a bare identifier as the URL', () => {
    // Europe PMC appends empty typed links to a citation string.
    const [reference] = referencesOf(
      '<ref-list><ref id="a"><mixed-citation><named-content content-type="citation-string">' +
        'Qiu B. Mitochondria. J Transl Med. 2024;22:1126.</named-content>' +
        '<ext-link ext-link-type="doi" xlink:href="10.1186/s12967-024-05943-9"/>' +
        '<ext-link ext-link-type="pmcid" xlink:href="PMC11662537"/>' +
        '<ext-link ext-link-type="pmid" xlink:href="39707402"/>' +
        '<ext-link ext-link-type="google-scholar" xlink:href="title=Mitochondria"/>' +
        '</mixed-citation></ref></ref-list>',
    );
    expect(reference).toEqual({
      id: 'a',
      text: 'Qiu B. Mitochondria. J Transl Med. 2024;22:1126.',
      doi: '10.1186/s12967-024-05943-9',
      pmid: '39707402',
      pmcid: 'PMC11662537',
    });
  });

  it('takes a resolver or doi: prefix off a reference DOI, keeping the text as printed (#38)', () => {
    const doiOf = (citation: string) => {
      const references = referencesOf(`<ref-list><ref id="a">${citation}</ref></ref-list>`);
      expect(references).toHaveLength(1);
      return references[0]?.doi;
    };
    const pubId = (value: string) =>
      `<element-citation><article-title>A</article-title><pub-id pub-id-type="doi">${value}</pub-id></element-citation>`;
    expect(doiOf(pubId('doi:10.1234/RefA'))).toBe('10.1234/refa');
    expect(doiOf(pubId('https://doi.org/10.1234/RefA.'))).toBe('10.1234/refa');
    expect(doiOf(pubId('DOI: 10.1234/RefA'))).toBe('10.1234/refa');
    expect(doiOf(pubId('n/a'))).toBeUndefined();
    expect(
      doiOf(
        '<mixed-citation>A. <ext-link ext-link-type="doi" xlink:href="doi:10.1234/Typed"/></mixed-citation>',
      ),
    ).toBe('10.1234/typed');
    expect(
      doiOf(
        '<mixed-citation>A. <ext-link ext-link-type="doi" xlink:href="http://dx.doi.org/10.1234/Typed"/></mixed-citation>',
      ),
    ).toBe('10.1234/typed');
    expect(
      doiOf(
        '<mixed-citation>A. <ext-link xlink:href="https://doi.org/10.1234/Untyped).">x</ext-link></mixed-citation>',
      ),
    ).toBe('10.1234/untyped');

    const [reference] = referencesOf(
      `<ref-list><ref id="a">${pubId('doi:10.1234/RefA')}</ref></ref-list>`,
    );
    expect(reference?.text).toBe('A. DOI doi:10.1234/RefA');
  });
});

describe('reference PMC IDs and PMIDs (#59)', () => {
  const idsOf = (content: string) => {
    const references = referencesOf(
      `<ref-list><ref id="a"><mixed-citation>A. Work.${content}</mixed-citation></ref></ref-list>`,
    );
    expect(references).toHaveLength(1);
    const [reference] = references;
    return { pmcid: reference?.pmcid, pmid: reference?.pmid };
  };
  const pubId = (type: string, value: string) => `<pub-id pub-id-type="${type}">${value}</pub-id>`;
  const extLink = (type: string, href: string) =>
    `<ext-link ext-link-type="${type}" xlink:href="${href}"/>`;

  it('keeps PMC IDs and PMIDs already in canonical form', () => {
    expect(idsOf(pubId('pmcid', 'PMC123456') + pubId('pmid', '21491125'))).toEqual({
      pmcid: 'PMC123456',
      pmid: '21491125',
    });
    expect(idsOf(pubId('pmc', '123456'))).toEqual({ pmcid: 'PMC123456', pmid: undefined });
  });

  it('reads a PMC ID or PMID in any case, without a label', () => {
    expect(idsOf(pubId('pmcid', 'pmc123456') + pubId('pmid', 'PMID: 21491125'))).toEqual({
      pmcid: 'PMC123456',
      pmid: '21491125',
    });
  });

  it('reads the identifier a link to PubMed or PMC names', () => {
    expect(
      idsOf(
        extLink('pmid', 'https://pubmed.ncbi.nlm.nih.gov/21491125/') +
          extLink('pmcid', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC123456/'),
      ),
    ).toEqual({ pmcid: 'PMC123456', pmid: '21491125' });
  });

  it('reads no identifier from a value that is not one, and takes a later one that is', () => {
    expect(
      idsOf(extLink('pubmed', '&#34;Carrami EM&#34;[Author]') + pubId('pmcid', 'pending')),
    ).toEqual({ pmcid: undefined, pmid: undefined });
    expect(idsOf(pubId('pmid', 'n/a') + extLink('pmid', '21491125'))).toEqual({
      pmcid: undefined,
      pmid: '21491125',
    });
  });

  it('prints the citation text as the source has it', () => {
    const [reference] = referencesOf(
      '<ref-list><ref id="a"><element-citation><article-title>A</article-title>' +
        `${pubId('pmid', 'PMID: 21491125')}</element-citation></ref></ref-list>`,
    );
    expect(reference).toMatchObject({ pmid: '21491125', text: 'A. PMID PMID: 21491125' });
  });
});

describe('reference arXiv IDs (#65)', () => {
  const arxivOf = (...values: string[]) => {
    const references = referencesOf(
      `<ref-list><ref id="a"><mixed-citation>A. Work.${values
        .map((v) => `<pub-id pub-id-type="arxiv">${v}</pub-id>`)
        .join('')}</mixed-citation></ref></ref-list>`,
    );
    expect(references).toHaveLength(1);
    return references[0]?.arxiv;
  };

  it('keeps an arXiv ID already in the model form, and drops an arXiv label', () => {
    expect(arxivOf('2105.00001')).toBe('2105.00001');
    expect(arxivOf('arXiv:2105.00001v2')).toBe('2105.00001v2');
  });

  it('reads an old-style ID without its subject class, and the ID an arxiv.org link names', () => {
    expect(arxivOf('math.GT/0309136')).toBe('math/0309136');
    expect(arxivOf('http://arxiv.org/abs/hep-th/9711200')).toBe('hep-th/9711200');
  });

  it('reads no arXiv ID from a value that is not one, and takes a later one that is', () => {
    expect(arxivOf('pending')).toBeUndefined();
    expect(arxivOf('2105.00001v0')).toBeUndefined();
    expect(arxivOf('n/a', '2105.00001')).toBe('2105.00001');
  });

  it('prints the citation text as the source has it', () => {
    const [reference] = referencesOf(
      '<ref-list><ref id="a"><element-citation><article-title>A</article-title>' +
        '<pub-id pub-id-type="arxiv">math.GT/0309136</pub-id></element-citation></ref></ref-list>',
    );
    expect(reference).toMatchObject({ arxiv: 'math/0309136' });
    expect(reference?.text).toContain('math.GT/0309136');
  });
});

describe('mixed-citation adjacency (#115, #123, #124)', () => {
  it('separates and labels two adjacent zero-gap pub-ids (#115)', () => {
    // PMC11391094 ref C37: the literal `doi:` prefix must not be labeled twice, and the
    // PMID must not fuse onto the DOI.
    const text = mixedCitation(
      '<source>Clin Exp Allergy</source> 2020; 50: 1267–1269. doi:' +
        '<pub-id pub-id-type="doi">10.1111/cea.13720</pub-id>' +
        '<pub-id pub-id-type="pmid">32762056</pub-id>\n',
      'C37',
    );
    expect(text).toBe('Clin Exp Allergy 2020; 50: 1267–1269. doi:10.1111/cea.13720 PMID 32762056');
  });

  it('separates and labels three adjacent zero-gap pub-ids (#115)', () => {
    // PMC8371605 ref CR1: DOI, PMCID, and PMID with zero-length gaps between them.
    const text = mixedCitation(
      'Thompson, M. C. Advances in methods. <italic toggle="yes">F1000Res</italic>. ' +
        '<bold>9</bold>, 667 (2020).' +
        '<pub-id pub-id-type="doi">10.12688/f1000research.25097.1</pub-id>' +
        '<pub-id pub-id-type="pmcid">PMC7333361</pub-id>' +
        '<pub-id pub-id-type="pmid">32676184</pub-id>',
      'CR1',
    );
    expect(text).toBe(
      'Thompson, M. C. Advances in methods. F1000Res. 9, 667 (2020). ' +
        'DOI 10.12688/f1000research.25097.1 PMCID PMC7333361 PMID 32676184',
    );
  });

  it('separates an inserted label from the bracket before it (#115)', () => {
    // Cochrane style: the DOI keeps its literal `[DOI: ` prefix; the PMID label this
    // renderer inserts is spaced from the closing `]`.
    const text = mixedCitation(
      '<source>Journal of Pediatrics</source><year>2011</year>:<fpage>119</fpage>. [DOI: ' +
        '<pub-id pub-id-type="doi">10.1016/j.jpeds.2010.07.021</pub-id>]' +
        '<pub-id pub-id-type="pmid">20850761</pub-id>',
    );
    expect(text).toBe(
      'Journal of Pediatrics 2011:119. [DOI: 10.1016/j.jpeds.2010.07.021] PMID 20850761',
    );
  });

  it('collapses a whitespace-only gap between pub-ids to one space (#115)', () => {
    const text = mixedCitation(
      'Ref. <pub-id pub-id-type="pmid">31235882</pub-id>\n' +
        '<pub-id pub-id-type="doi">10.1038/s41592-019-0437-4</pub-id>',
    );
    expect(text).toBe('Ref. PMID 31235882 DOI 10.1038/s41592-019-0437-4');
  });

  it('spaces a zero-gap italic title against a bold volume (#123)', () => {
    // PMC8371605 ref CR7: `<italic>Nat. Methods</italic><bold>16</bold>, …`.
    const text = mixedCitation(
      'Steinegger, M. Protein-level assembly. <italic toggle="yes">Nat. Methods</italic>' +
        '<bold>16</bold>, 603–606 (2019).<pub-id pub-id-type="pmid">31235882</pub-id>',
      'CR7',
    );
    expect(text).toBe(
      'Steinegger, M. Protein-level assembly. Nat. Methods 16, 603–606 (2019). PMID 31235882',
    );
  });
  it('applies the same spacing inside a citation-string wrapper (#123)', () => {
    // Europe PMC wraps the whole citation in `<named-content content-type="citation-string">`.
    const text = mixedCitation(
      '<named-content content-type="citation-string">Das, S. C. <italic>et al</italic>. ' +
        'Poultry production. <italic>Worlds Poult Sci J</italic><bold>64</bold>, 99–118 (2019).' +
        '</named-content><ext-link ext-link-type="google-scholar" xlink:href="x"/>',
      'CR1',
    );
    expect(text).toBe(
      'Das, S. C. et al. Poultry production. Worlds Poult Sci J 64, 99–118 (2019).',
    );
  });

  it('separates a zero-gap surname and given names inside a bare <name> (#124)', () => {
    // PMC7250045 ref R1: all 1,150 <name> authors in that record share the shape.
    const text = mixedCitation(
      '<name name-style="western"><surname>Nybakken</surname><given-names>JW</given-names>' +
        '</name>\n<source>Marine Biology: An Ecological Approach</source>, ' +
        '<edition>4th ed.</edition>; <publisher-name>Addison-Wessley Publishing</publisher-name>' +
        ': <publisher-loc>Boston, MA</publisher-loc>, <year>2001</year>.',
    );
    expect(text).toBe(
      'Nybakken JW Marine Biology: An Ecological Approach, 4th ed.; Addison-Wessley ' +
        'Publishing: Boston, MA, 2001.',
    );
  });

  /**
   * PMC11391094 ref C37's author block. `separator` is the text between `<surname>`
   * and `<given-names>`: a newline in the live record, nothing in the zero-gap variant.
   * Both must render the same citation.
   */
  const personGroupCitation = (separator: string) => {
    const name = (surname: string, given: string) =>
      `<string-name name-style="western"><surname>${surname}</surname>${separator}` +
      `<given-names>${given}</given-names></string-name>`;
    return mixedCitation(
      `<person-group person-group-type="author">${name('Lommatzsch', 'M')}, ` +
        `${name('Marchewski', 'H')}, ${name('Schwefel', 'G')}, <etal>et al.</etal></person-group>\n` +
        '<article-title>Benralizumab strongly reduces blood basophils in severe eosinophilic ' +
        'asthma</article-title>. <source>Clin Exp Allergy</source> 2020; 50: 1267–1269. doi:' +
        '<pub-id pub-id-type="doi">10.1111/cea.13720</pub-id>' +
        '<pub-id pub-id-type="pmid">32762056</pub-id>\n',
      'C37',
    );
  };

  const C37_CITATION =
    'Lommatzsch M, Marchewski H, Schwefel G, et al. Benralizumab strongly reduces blood ' +
    'basophils in severe eosinophilic asthma. Clin Exp Allergy 2020; 50: 1267–1269. ' +
    'doi:10.1111/cea.13720 PMID 32762056';

  it('separates a zero-gap <string-name> nested in a <person-group> (#124)', () => {
    expect(personGroupCitation('')).toBe(C37_CITATION);
  });

  it('leaves a <person-group> whose name parts carry source whitespace unchanged (#124)', () => {
    expect(personGroupCitation('\n')).toBe(C37_CITATION);
  });

  it('leaves out an identifier the citation text already prints', () => {
    expect(
      mixedCitation(
        'Phys. Rev. Lett. 74, 2626 (1995). 10.1103/PhysRevLett.74.2626. ' +
          '<pub-id pub-id-type="doi" assigning-authority="pmc">10.1103/PhysRevLett.74.2626</pub-id>' +
          '<pub-id pub-id-type="pmid">2626</pub-id>',
      ),
    ).toBe('Phys. Rev. Lett. 74, 2626 (1995). 10.1103/PhysRevLett.74.2626. PMID 2626');
  });

  it('leaves punctuated and text-adjacent transitions unchanged (#115)', () => {
    // Elements already separated by punctuation render as the source has them, and a
    // zero-gap text-to-element transition (a footnote-style marker) gains no space.
    const text = mixedCitation(
      '<string-name><surname>Lommatzsch</surname> <given-names>M</given-names></string-name>, ' +
        '<etal>et al.</etal> <article-title>Benralizumab reduces basophils</article-title>. ' +
        '<source>Clin Exp Allergy</source>; <volume>50</volume>: <fpage>1267</fpage>–' +
        '<lpage>1269</lpage>.<sup>a</sup>',
    );
    expect(text).toBe(
      'Lommatzsch M, et al. Benralizumab reduces basophils. Clin Exp Allergy; 50: 1267–1269.a',
    );
  });

  it('prints an identifier whose type is named like an object property without a label', () => {
    for (const type of ['constructor', 'toString', '__proto__']) {
      const id = `<pub-id pub-id-type="${type}">10.1/x</pub-id>`;
      expect(mixedCitation(`Smith. ${id}`)).toBe('Smith. 10.1/x');
      const [element] = referencesOf(
        `<ref-list><ref id="R1"><element-citation><source>Src</source>${id}</element-citation></ref></ref-list>`,
      );
      expect(element?.text).toBe('Src. 10.1/x');
    }
  });
});

describe('mixed-citation names', () => {
  const name = (surname: string, given: string, tag = 'name') =>
    `<${tag} name-style="western"><surname>${surname}</surname><given-names>${given}</given-names></${tag}>`;

  it('keeps surname and given names, names the source separates, and a written et al.', () => {
    expect(
      mixedCitation(
        `<person-group>${name('Okyere', 'S')}, ${name('Oduro', 'FT')} and ${name('Bonyah', 'E')}, ` +
          '<etal>et al.</etal></person-group> Title 1 : 2. <article-title>A .5 mg dose</article-title>.',
      ),
    ).toBe('Okyere S, Oduro FT and Bonyah E, et al. Title 1 : 2. A .5 mg dose.');
    // epmc-pmc11662662: a written <etal> follows the last name with no separator, as printed.
    expect(
      mixedCitation(
        `<person-group>${name('Ye', 'Z.', 'string-name')}, ${name('Ngo', 'Q.-M.', 'string-name')}` +
          '<etal>et al</etal>.</person-group>\n<article-title>Human DNA methylomes</article-title>.',
      ),
    ).toBe('Ye Z., Ngo Q.-M. et al. Human DNA methylomes.');
  });

  it('separates names that touch or sit apart only by markup whitespace', () => {
    expect(
      mixedCitation(
        `<person-group person-group-type="author">${name('Zwierenga', 'F')}${name('van Veggel', 'B')}` +
          '<etal/></person-group>. High dose osimertinib.',
      ),
    ).toBe('Zwierenga F, van Veggel B, et al. High dose osimertinib.');
    // pmc-pmc10579850 ref 4: a newline between names, an empty <etal/>, a newline before </person-group>.
    expect(
      mixedCitation(
        `\n<person-group person-group-type="author">\n${name('Okyere', 'S')}\n${name('Oduro', 'FT')}\n` +
          `${name('Bonyah', 'E')}\n<etal/>\n</person-group>:\n<article-title>Epidemiological model.</article-title>`,
      ),
    ).toBe('Okyere S, Oduro FT, Bonyah E, et al.: Epidemiological model.');
    expect(
      mixedCitation(
        `${name('A', 'B')}${name('C', 'D', 'string-name')}\n<collab>The Group</collab>. Title.`,
      ),
    ).toBe('A B, C D, The Group. Title.');
  });

  it('separates names inside a citation-string wrapper the same way', () => {
    expect(
      mixedCitation(
        '<named-content content-type="citation-string"><person-group>' +
          `${name('Ahrens', 'D')}${name('Lago', 'PK')}</person-group> (2008) Title.</named-content>`,
      ),
    ).toBe('Ahrens D, Lago PK (2008) Title.');
  });

  it('reads an empty <etal/> as et al., with one period after it', () => {
    expect(mixedCitation(`<person-group>${name('A', 'B')}, <etal/></person-group>. T. 2020.`)).toBe(
      'A B, et al. T. 2020.',
    );
    expect(mixedCitation(`<person-group>${name('A', 'B')}<etal/>\n</person-group>\n. T.`)).toBe(
      'A B, et al. T.',
    );
  });

  it('writes one period after a name that ends in an initial, and keeps an ellipsis', () => {
    expect(
      mixedCitation(
        `<person-group>${name('Smith', 'J.')}${name('Ngo', 'Q.-M.')}\n</person-group>. Title...`,
      ),
    ).toBe('Smith J., Ngo Q.-M. Title...');
    expect(
      mixedCitation(`<person-group>${name('Smith', 'J.')}</person-group>. DNA.. et al...`),
    ).toBe('Smith J. DNA.. et al...');
  });

  describe('a name given in two forms (#73)', () => {
    const alternatives = (...forms: string[]) =>
      `<name-alternatives>${forms.join('')}</name-alternatives>`;
    const han = '<string-name name-style="eastern">李</string-name>';
    const hanName =
      '<name name-style="eastern"><surname>李</surname><given-names>晓</given-names></name>';

    it('reads one name, the Latin-script one, spaced like any other', () => {
      const [reference] = referencesOf(
        '<ref-list><ref id="R1"><mixed-citation publication-type="journal">' +
          `<person-group person-group-type="author">${alternatives(name('Li', 'X'), han)}, ` +
          `${name('Wu', 'Y')}${alternatives(hanName, name('Zhao', 'Z'))}</person-group>. ` +
          'A title. J.</mixed-citation></ref></ref-list>',
      );
      expect(reference).toEqual({
        authors: ['Li X', 'Wu Y', 'Zhao Z'],
        id: 'R1',
        text: 'Li X, Wu Y, Zhao Z. A title. J.',
      });
    });

    it('reads the first name when none is in Latin script, nested in a citation string', () => {
      expect(
        mixedCitation(
          '<named-content content-type="citation-string"><person-group>' +
            `${alternatives(han, hanName)}${name('Wu', 'Y')}</person-group> (2020) T.</named-content>`,
        ),
      ).toBe('李, Wu Y (2020) T.');
    });

    it('reads the same name in an element citation and its authors', () => {
      const document = parseArticle({
        back:
          '<ref-list><ref id="R1"><element-citation><person-group person-group-type="author">' +
          `${alternatives(han, name('Li', 'X'))}${name('Wu', 'Y')}</person-group>` +
          '<article-title>A title</article-title><source>J</source></element-citation></ref></ref-list>',
        body: '<p>Body.</p>',
      });
      expect(document.references).toMatchObject([
        { authors: ['Li X', 'Wu Y'], text: 'Li X, Wu Y. A title. J.' },
      ]);
      expect(toMarkdown(document)).toContain('\n- Li X, Wu Y. A title. J.');
      // Outside a person group, the name still leads, once.
      expect(
        referencesOf(
          `<ref-list><ref><element-citation>${alternatives(name('Li', 'X'), han)}` +
            '<article-title>T</article-title></element-citation></ref></ref-list>',
        )[0]?.text,
      ).toBe('Li X. T.');
    });
  });

  it('closes up whitespace before a full stop that ends a word', () => {
    expect(
      mixedCitation(
        '<named-content content-type="citation-string">IASP  . Announces Revised Definition of ' +
          'Pain. Caenorhabditis elegans\n. Nature. 2003. \nBMJ\n.</named-content>',
      ),
    ).toBe(
      'IASP. Announces Revised Definition of Pain. Caenorhabditis elegans. Nature. 2003. BMJ.',
    );
    expect(
      mixedCitation(
        `<person-group>${name('Younossi', 'ZM')}, ${name('Henry', 'L')}\n  </person-group>. The global burden.`,
      ),
    ).toBe('Younossi ZM, Henry L. The global burden.');
  });
});

describe('taxonomic names in a citation', () => {
  const taxon = (genus: string, species: string) =>
    '<italic><named-content content-type="taxon-name">' +
    `<named-content content-type="genus">${genus}</named-content>` +
    `<named-content content-type="species">${species}</named-content></named-content></italic>`;

  it('keeps a citation title written in plain words as it is', () => {
    expect(
      referencesOf(
        '<ref-list><ref><mixed-citation><article-title>A <italic>new</italic> species</article-title>. ' +
          'Z.</mixed-citation></ref></ref-list>',
      )[0],
    ).toEqual({ text: 'A new species. Z.', title: 'A new species' });
  });

  it('keeps the parts of a taxonomic name set with nothing between them separate words', () => {
    // epmc-pmc10768028: Pensoft sets genus and species with nothing between them.
    const document = parseArticle({
      back:
        '<ref-list><ref id="R1"><mixed-citation>Wang CC (2016) <article-title>' +
        `${taxon('Protagonista', 'lugubris')}, new to China</article-title>. ZooKeys 574: 57–73.` +
        '</mixed-citation></ref><ref id="R2"><element-citation><article-title>Revision of the ' +
        `${taxon('Dicranotropis', 'hamata')}<target id="t1"/> group</article-title><source>Z</source>` +
        '</element-citation></ref></ref-list>',
      body: '<p>Body.</p>',
    });
    expect(document.references).toEqual([
      {
        id: 'R1',
        text: 'Wang CC (2016) Protagonista lugubris, new to China. ZooKeys 574: 57–73.',
        title: 'Protagonista lugubris, new to China',
      },
      {
        id: 'R2',
        source: 'Z',
        text: 'Revision of the Dicranotropis hamata group. Z.',
        title: 'Revision of the Dicranotropis hamata group',
      },
    ]);
    expect(toMarkdown(document)).toContain(
      '\n- Wang CC (2016) Protagonista lugubris, new to China.',
    );
  });
});

describe('reference-list placement (#116)', () => {
  it('finds a ref-list nested at any depth in the body', () => {
    // PMC12973387: no <back> at all; the list sits at body/sec[References]/sec/ref-list.
    const document = parseBody(
      '<sec><title>Introduction</title><p>Intro text.</p></sec>' +
        '<sec><title>Methods</title><p>Methods text.</p></sec>' +
        '<sec><title>References</title><sec><ref-list>' +
        '<ref id="bib1"><label>1.</label><element-citation>First reference.</element-citation></ref>' +
        '<ref id="bib2"><label>2.</label><element-citation>Second reference.</element-citation></ref>' +
        '</ref-list></sec></sec>',
    );
    expect(document.references).toEqual([
      { id: 'bib1', label: '1', text: 'First reference.' },
      { id: 'bib2', label: '2', text: 'Second reference.' },
    ]);
    // The References wrapper holds no prose, so it is not an empty section.
    expect(document.body.map((s) => s.title)).toEqual(['Introduction', 'Methods']);
  });

  it('descends through a ref-list into one nested in it', () => {
    const references = referencesOf(
      '<ref-list><title>References</title>' +
        '<ref id="OUT1"><mixed-citation>Outer ref.</mixed-citation></ref>' +
        '<ref-list><title>Further reading</title>' +
        '<ref id="IN1"><mixed-citation>Inner ref.</mixed-citation></ref></ref-list></ref-list>',
    );
    expect(references.map((r) => r.id)).toEqual(['OUT1', 'IN1']);
  });

  it('yields each reference once when the body and back both carry a ref-list', () => {
    // Not observed live, but the JATS DTD permits both containers.
    const ref = (id: string, citation: string) =>
      `<ref id="${id}"><mixed-citation>${citation}</mixed-citation></ref>`;
    const document = parseArticle({
      back: `<ref-list>${ref('R1', 'Alpha 2020.')}${ref('R3', 'Gamma 2022.')}</ref-list>`,
      body:
        '<sec><title>Discussion</title><p>Body text.</p>' +
        `<sec><ref-list>${ref('R1', 'Alpha 2020.')}${ref('R2', 'Beta 2021.')}</ref-list></sec></sec>`,
    });
    expect(document.references.map((r) => r.id)).toEqual(['R1', 'R2', 'R3']);
  });

  it('reads a citation in running text as text in place', () => {
    const document = parseBody(
      '<sec sec-type="data-availability"><title>Data availability</title><p>Data are at ' +
        '<element-citation><source>Zenodo</source><year>2024</year>' +
        '<pub-id pub-id-type="doi">10.5281/zenodo.1</pub-id></element-citation>.</p></sec>',
    );
    expect(paragraphTexts(document)).toEqual(['Data are at Zenodo. 2024. DOI 10.5281/zenodo.1.']);
  });
});

describe('long citations', () => {
  const ids = (n: number, id: (i: number) => string) =>
    Array.from({ length: n }, (_, i) => id(i)).join('');
  const elementCitation = (fields: string) =>
    referencesOf(
      `<ref-list><ref id="R1"><element-citation>${fields}</element-citation></ref></ref-list>`,
    )[0]?.text;

  const labeled = (i: number) => `<pub-id pub-id-type="doi">10.1/${'v'.repeat(40)}${i}</pub-id>`;
  const unlabeled = (i: number) => `<pub-id pub-id-type="other">10.1/v${i}</pub-id>`;

  /** `n` pieces from `piece`, joined by `separator`. */
  const joined = (n: number, piece: (i: number) => string, separator = ' ') =>
    Array.from({ length: n }, (_, i) => piece(i)).join(separator);

  /** Each case: the citation for size `n`, and the text it reads as. */
  it.each([
    [
      'labeled identifiers',
      (n: number) => mixedCitation(ids(n, labeled)),
      (n: number) => joined(n, (i) => `DOI 10.1/${'v'.repeat(40)}${i}`),
    ],
    [
      'identifiers and words',
      (n: number) => mixedCitation(`${'10.1/w '.repeat(n)}${ids(n, unlabeled)}`),
      (n: number) => `${'10.1/w '.repeat(n)}${joined(n, (i) => `10.1/v${i}`)}`,
    ],
    [
      'formulas',
      (n: number) =>
        mixedCitation('<inline-formula><tex-math>x</tex-math></inline-formula> '.repeat(n)),
      (n: number) => joined(n, () => '$x$'),
    ],
    [
      'a field of "://"',
      (n: number) => elementCitation(`<source>${'://'.repeat(n * 8)} x</source>`),
      (n: number) => `${'://'.repeat(n * 8)} x.`,
    ],
    [
      'touching names and empty et al.s',
      (n: number) =>
        mixedCitation(
          `<person-group>${'<name><surname>A</surname><given-names>B</given-names></name>\n<etal/>'.repeat(n)}\n</person-group>: T.`,
        ),
      (n: number) => `${joined(n, () => 'A B, et al.', ', ')}: T.`,
    ],
    [
      'spaced full stops',
      (n: number) => mixedCitation('a \n. et al. . '.repeat(n * 8)),
      (n: number) => joined(n * 8, () => 'a. et al.'),
    ],
  ])('reads a citation in time linear in its %s', async (_, citation, text) => {
    // The largest citation timed is read whole.
    expect(citation(8_000)).toBe(text(8_000));
    await expectLinear((n) => n, citation, { from: 125, to: 8_000 });
  });

  it('checks the first 16 identifiers against the text, and prints the rest', () => {
    const unlabeled = (i: number) => `<pub-id pub-id-type="other">10.1/x${i + 1}</pub-id>`;
    const printed = Array.from({ length: 15 }, (_, i) => `10.1/x${i + 2}`).join(' ');
    expect(mixedCitation(`Cites 10.1/x1 and 10.1/x17. ${ids(17, unlabeled)}`)).toBe(
      `Cites 10.1/x1 and 10.1/x17. ${printed} 10.1/x17`,
    );
  });

  it('closes a field with a full stop unless it ends a sentence or a URL', () => {
    expect(
      elementCitation(
        '<source>See https://x.org/a</source><edition>ftp://</edition><year>2020</year>',
      ),
    ).toBe('See https://x.org/a ftp://. 2020.');
  });
});
