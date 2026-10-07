/**
 * @fileoverview The vocabulary a fixture's `meta.json` uses to say what it exercises.
 * Tags drive coverage reporting (which features have fixtures, per format) and let a
 * failing invariant name the kind of document it failed on. Add a tag here before
 * using it in a fixture.
 * @module tests/corpus/features
 */
export const FEATURES = [
  // Structure
  'nested-sections',
  'untitled-sections',
  'body-without-sections',
  'appendix',
  'sub-article',
  'floats-group',
  'boxed-text',
  'lists',
  'nested-lists',
  'definition-list',
  'footnotes',
  'glossary',
  'acknowledgments',
  'declarations',
  // Front matter
  'structured-abstract',
  'multiple-abstracts',
  'graphical-abstract',
  'plain-language-summary',
  'translated-abstract',
  'no-abstract',
  'collab-author',
  'orcid',
  'many-authors',
  'non-english',
  // Tables
  'tables',
  'many-tables',
  'table-spans',
  'table-footnotes',
  'table-graphic-only',
  'table-cals',
  // Math
  'inline-math',
  'display-math',
  'tex-alternatives',
  'mathml-only',
  'equation-numbers',
  // Figures and media
  'figures',
  'supplementary-material',
  'media',
  // References
  'element-citation',
  'mixed-citation',
  'nlm-citation',
  'citation-alternatives',
  'many-references',
  'no-references',
  // Code and formal content
  'code',
  'algorithm',
  'theorem',
  // Article types
  'research-article',
  'review',
  'case-report',
  'correction',
  'editorial',
  'letter',
  'preprint',
  'data-paper',
  // Layout (PDF and HTML)
  'single-column',
  'two-column',
  'running-headers',
  'hyphenation',
  'page-furniture',
  'scanned',
  // Size
  'tiny',
  'large',
  // The same work is present in other formats in the corpus
  'rosetta',
  // Formulas carried only as images (<graphic>/<inline-graphic>), with no TeX or MathML
  'formula-graphic-only',
  // Front matter and an abstract but no body: a JATS record without <body> (a PDF-only
  // deposit), or a publisher's landing page
  'no-body',
] as const;

export type Feature = (typeof FEATURES)[number];
