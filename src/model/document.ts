/**
 * @fileoverview The document model every format parser produces. One shape for a
 * scholarly article regardless of source: front matter, a section tree of typed
 * blocks, references, and diagnostics describing how much structure was recovered.
 *
 * Inline text (paragraph bodies, titles, captions, list items, reference text) is
 * CommonMark with GFM extensions: emphasis, `$…$` inline math where the source
 * carries TeX, links, and citation markers as printed in the source. Block-level
 * structure is typed, so renderers never re-parse Markdown to find a table.
 * @module src/model/document
 */

/** The source format a document was parsed from. */
export type SourceFormat = 'jats' | 'tei' | 'latexml' | 'html' | 'pdf';

/**
 * How much structure the parser recovered.
 * - `structured` — sections and blocks read from semantic markup (JATS, TEI, LaTeXML).
 * - `partial` — structure inferred from presentation (headings in HTML, font sizes in PDF).
 * - `flat` — text only; no reliable section boundaries.
 */
export type ParseQuality = 'structured' | 'partial' | 'flat';

/** A date as precise as the source states it. */
export interface PartialDate {
  day?: number;
  month?: number;
  year: number;
}

/** A contributor to the work. */
export interface Author {
  /** Indices into {@link DocumentMetadata.affiliations}. */
  affiliations?: number[];
  /** Set for a group author (a consortium or working group) instead of a person. */
  collective?: string;
  corresponding?: boolean;
  email?: string;
  family?: string;
  given?: string;
  /** Display name as the source prints it, or `given family` when only parts are given. */
  name: string;
  /** Bare ORCID iD, e.g. `0000-0002-1825-0097`. */
  orcid?: string;
}

/** Identifiers the source carries for the work itself. */
export interface Identifiers {
  /** arXiv ID without the `arXiv:` prefix, version suffix kept when present. */
  arxiv?: string;
  /** Lowercased DOI without a resolver prefix. */
  doi?: string;
  /** Publisher-assigned identifiers keyed by the source's own type label. */
  other?: Record<string, string>;
  /** PMC ID with the `PMC` prefix. */
  pmcid?: string;
  pmid?: string;
}

/** Journal or venue details. */
export interface Venue {
  /** Electronic article locator (JATS `<elocation-id>`). */
  elocationId?: string;
  issn?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  title?: string;
  volume?: string;
}

/** The license the source declares for the work, passed through verbatim. */
export interface License {
  /** License statement text as printed. */
  text?: string;
  /** License URL, e.g. `https://creativecommons.org/licenses/by/4.0/`. */
  url?: string;
}

/** Bibliographic front matter. Every field is optional because sources vary. */
export interface DocumentMetadata {
  affiliations?: string[];
  /** Article type as the source labels it (JATS `@article-type`, e.g. `research-article`). */
  articleType?: string;
  authors?: Author[];
  identifiers?: Identifiers;
  keywords?: string[];
  /** BCP 47 language tag when the source declares one. */
  language?: string;
  license?: License;
  published?: PartialDate;
  subtitle?: string;
  title?: string;
  venue?: Venue;
}

/**
 * What an abstract is for. A graphical or plain-language abstract never stands in
 * for the main one; renderers pick `main` first.
 */
export type AbstractKind =
  | 'main'
  | 'graphical'
  | 'plain-language'
  | 'teaser'
  | 'translated'
  | 'other';

/** One abstract. Structured abstracts (Background / Methods / …) carry titled sections. */
export interface Abstract {
  kind: AbstractKind;
  /** BCP 47 language tag when the abstract declares one (usual for `translated`). */
  language?: string;
  sections: Section[];
  /** Heading the source gives the abstract, when it differs from "Abstract". */
  title?: string;
}

/** Where a section sits in the article. */
export type SectionKind =
  | 'body'
  | 'appendix'
  | 'acknowledgments'
  | 'declarations'
  | 'data-availability'
  | 'notes'
  /** A document embedded in the article, such as a peer-review report or author response. */
  | 'sub-article';

/** A section and its subsections, in reading order. */
export interface Section {
  blocks: Block[];
  /** Stable within the document: the source's own ID when present, else derived from the path. */
  id: string;
  kind: SectionKind;
  /** Printed number or letter, e.g. `2.1` or `A`. */
  label?: string;
  sections: Section[];
  title?: string;
}

/** A paragraph of inline Markdown. */
export interface ParagraphBlock {
  text: string;
  type: 'paragraph';
}

/**
 * A list. Each item holds its own blocks, so lists nest. A definition list is an
 * unordered list whose items open with the term in bold.
 */
export interface ListBlock {
  items: Block[][];
  ordered: boolean;
  title?: string;
  type: 'list';
}

/** Why a table has no rows. The table is still reported with its label and caption. */
export type TableUnextractableReason = 'graphic-only' | 'cals-tgroup' | 'no-rows';

/**
 * A table. Rows are cell text by grid column with `colspan`/`rowspan` expanded, so a
 * well-formed table is rectangular.
 */
export interface TableBlock {
  caption?: string;
  footnotes?: string[];
  /** Leading rows of {@link rows} that are header rows. */
  headerRows: number;
  id?: string;
  label?: string;
  rows: string[][];
  type: 'table';
  /** Set only when {@link rows} is empty. */
  unextractable?: TableUnextractableReason;
}

/** A figure. The image itself is referenced, never embedded. */
export interface FigureBlock {
  /** Image description the source provides for accessibility. */
  alt?: string;
  caption?: string;
  /** Image reference exactly as the source gives it; may be relative to the source document. */
  href?: string;
  id?: string;
  label?: string;
  type: 'figure';
}

/** A display formula. */
export interface FormulaBlock {
  id?: string;
  label?: string;
  /**
   * The formula in TeX notation, without math delimiters: the document's own TeX when
   * it carries some, else converted from MathML.
   */
  tex?: string;
  /** Plain text of the formula, set only when no TeX could be produced. */
  text?: string;
  type: 'formula';
}

/** Preformatted text: code, algorithm listings, sequence data. */
export interface CodeBlock {
  language?: string;
  text: string;
  type: 'code';
}

/** A block quotation. */
export interface QuoteBlock {
  blocks: Block[];
  type: 'quote';
}

/**
 * A boxed or sidebar element with its own content (JATS `<boxed-text>`), or a
 * labeled statement such as a theorem or proof. Boxes can hold sections of their own.
 */
export interface BoxBlock {
  blocks: Block[];
  id?: string;
  label?: string;
  sections: Section[];
  title?: string;
  type: 'box';
}

/** A supplementary file referenced from the article. */
export interface SupplementBlock {
  caption?: string;
  href?: string;
  id?: string;
  label?: string;
  type: 'supplement';
}

/** Every block type. Switch on `type`. */
export type Block =
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | FigureBlock
  | FormulaBlock
  | CodeBlock
  | QuoteBlock
  | BoxBlock
  | SupplementBlock;

/** One entry in the reference list. */
export interface Reference {
  arxiv?: string;
  /** Author names as printed. */
  authors?: string[];
  doi?: string;
  id?: string;
  /** Printed label, e.g. `12`. */
  label?: string;
  pmcid?: string;
  pmid?: string;
  /** Journal, book, or proceedings title. */
  source?: string;
  /** The full citation as inline Markdown. Always present. */
  text: string;
  title?: string;
  url?: string;
  year?: string;
}

/** A footnote. */
export interface Footnote {
  id?: string;
  label?: string;
  text: string;
}

/** A condition worth reporting that did not stop the parse. */
export interface ParseWarning {
  code: ParseWarningCode;
  message: string;
  /** Where in the source it occurred: an element path, section ID, or page number. */
  where?: string;
}

/** Machine-readable warning codes. */
export type ParseWarningCode =
  | 'no-body'
  | 'no-title'
  | 'no-abstract'
  | 'unhandled-element'
  | 'table-unextractable'
  | 'math-without-tex'
  | 'structure-inferred'
  | 'text-layer-missing'
  | 'truncated-input';

/** How the parse went. */
export interface Diagnostics {
  quality: ParseQuality;
  /** Source elements with no handler, and how often each occurred. */
  unhandled: { count: number; element: string }[];
  warnings: ParseWarning[];
}

/** A parsed scholarly document. */
export interface ScholarlyDocument {
  abstracts: Abstract[];
  /** Back-matter sections: appendices, acknowledgments, declarations, notes. */
  back: Section[];
  body: Section[];
  diagnostics: Diagnostics;
  /** Source-specific origin, e.g. `pmc`, `europepmc`, `grobid`, `arxiv`, `ar5iv`. */
  flavor?: string;
  /** Figures and tables the source places outside any section (JATS `<floats-group>`). */
  floats: Block[];
  footnotes: Footnote[];
  format: SourceFormat;
  metadata: DocumentMetadata;
  references: Reference[];
}
