/**
 * @fileoverview `jatsInlineToMarkdown`: a JATS fragment with no article around it — a
 * Crossref abstract with its `jats:` prefix, a Europe PMC snippet — as Markdown, and
 * input that is not well-formed XML as escaped text.
 * @module tests/formats/jats/fragment.test
 */
import { describe, expect, it } from 'vitest';
import { jatsInlineToMarkdown } from '../../../src/formats/jats/index.js';
import { texMath } from './helpers.js';

describe('jatsInlineToMarkdown', () => {
  it('reads a Crossref abstract with its jats: prefix, paragraphs apart', () => {
    expect(
      jatsInlineToMarkdown(
        '<jats:title>Abstract</jats:title><jats:p>Candidates include ' +
          '<jats:italic>NF1</jats:italic> and <jats:italic>MED12</jats:italic> &amp; ' +
          'CO<jats:sub>2</jats:sub>.</jats:p><jats:p>Second paragraph.</jats:p>',
      ),
    ).toBe('**Abstract**\n\nCandidates include *NF1* and *MED12* & CO_2.\n\nSecond paragraph.');
  });

  it('keeps the parts of a taxonomic name separate words', () => {
    // Pensoft sets genus and species with nothing between them.
    expect(
      jatsInlineToMarkdown(
        '<p><italic><named-content content-type="taxon-name"><named-content content-type="genus">V.</named-content>' +
          '<named-content content-type="species">punctata</named-content></named-content></italic> sp. nov.</p>',
      ),
    ).toBe('*V. punctata* sp. nov.');
  });

  it('leaves out an institution registry ID beside the name it identifies', () => {
    expect(
      jatsInlineToMarkdown(
        '<p>Funded by <institution-wrap><institution-id institution-id-type="FundRef">' +
          'http://dx.doi.org/10.13039/100000057</institution-id><institution>NIGMS</institution>' +
          '</institution-wrap>.</p>',
      ),
    ).toBe('Funded by NIGMS.');
  });

  it('keeps structured-abstract headings apart from their text', () => {
    expect(
      jatsInlineToMarkdown(
        '<sec><title>Background</title><p>Why.</p></sec><sec><title>Methods</title><p>How.</p></sec>',
      ),
    ).toBe('**Background**\n\nWhy.\n\n**Methods**\n\nHow.');
  });

  it('reads an inline formula without its LaTeX preamble (#135)', () => {
    expect(
      jatsInlineToMarkdown(
        `<p>We bound <inline-formula>${texMath('$$Q$$')}</inline-formula> from below.</p>`,
      ),
    ).toBe('We bound $Q$ from below.');
  });

  it('keeps a list in the fragment as a list', () => {
    expect(
      jatsInlineToMarkdown(
        '<p>Findings:</p><list list-type="bullet"><list-item><p>One.</p></list-item>' +
          '<list-item><p>Two.</p></list-item></list>',
      ),
    ).toBe('Findings:\n\n- One.\n- Two.');
  });

  it('escapes plain text so it cannot read as Markdown it never was', () => {
    expect(jatsInlineToMarkdown('Plain *text*, 1. not a list, &lt;b&gt;')).toBe(
      'Plain \\*text\\*, 1. not a list, \\<b>',
    );
    expect(jatsInlineToMarkdown('<p># Not a heading</p><p>1. Not a list</p>')).toBe(
      '\\# Not a heading\n\n1\\. Not a list',
    );
  });

  it('returns input that is not well-formed as escaped text with the tags removed', () => {
    expect(jatsInlineToMarkdown('<p>Significant at p < 0.05 in <b>all</b> *arms*.</p>')).toBe(
      'Significant at p < 0.05 in all \\*arms\\*.',
    );
  });

  it('reads an identifier whose type is named like an object property', () => {
    for (const type of ['constructor', 'toString', '__proto__'])
      expect(
        jatsInlineToMarkdown(
          `<mixed-citation>A. <pub-id pub-id-type="${type}">10.1/x</pub-id></mixed-citation>`,
        ),
      ).toBe('A. 10.1/x');
  });

  it('returns an empty string for an empty fragment', () => {
    expect(jatsInlineToMarkdown('')).toBe('');
  });
});
