# scholarly-parse — design

Parse the formats scholarly papers are published in into one document model, and render that model as Markdown an LLM or a person can read. The model is the contract; every format parser feeds it and every renderer reads it.

## Scope

| In | Out |
|:---|:---|
| Parsing bytes or text the caller already has | Fetching, resolving DOIs, following links, rate limiting |
| JATS XML, Grobid TEI (both shapes), arXiv LaTeXML HTML, publisher article HTML, PDF | Legal and regulatory formats — a future sibling package, `legal-parse`, built around Akoma Ntoso |
| Detecting the format of a payload, and challenge pages served in its place | Getting past a challenge page |
| Markdown, plain text, and a flat section list with sizes | Paging a long document for an MCP tool — `@cyanheads/mcp-ts-core` ([#558](https://github.com/cyanheads/mcp-ts-core/issues/558)) consumes the section list |
| Bun, Node ≥22, Cloudflare Workers | CommonJS, browsers without a bundler |

## Public API

```ts
// Package root: the model, detection, any-format parsing, renderers.
import { detect, parse, toMarkdown, toText, toSections, type ScholarlyDocument } from 'scholarly-parse';

// One subpath per format, so an application loads only what it parses.
import { parseJats, jatsInlineToMarkdown } from 'scholarly-parse/jats';
import { parseTei } from 'scholarly-parse/tei';
import { parseLatexml } from 'scholarly-parse/latexml';
import { parseHtml } from 'scholarly-parse/html';
import { parsePdf } from 'scholarly-parse/pdf';
```

- Every parser returns a `ParseResult`: `{ ok: true, document }` or `{ ok: false, error: { reason, message } }`. Expected failures are values — `malformed`, `wrong-format`, `empty`, `blocked`, `too-large`. A missing optional peer dependency is a setup error and throws with the install command.
- XML parsers are synchronous. HTML and PDF parsers are async because their engines load on first use.
- `detect(input)` names the format from the payload's opening bytes: a PDF header, a JATS or TEI root, LaTeXML's markers, or HTML markup. A captcha or bot check served where a paper was promised is HTML, and the HTML parser reports it as `blocked`.
- `parse(input, { format?, baseUrl?, maxInputBytes?, maxPages? })` detects the format (or takes the caller's) and runs that parser, loading it on first use.
- `jatsInlineToMarkdown(fragment)` converts a JATS fragment (a Crossref or Europe PMC abstract) without a full article around it.

## The model

`src/model/document.ts` is the single source of truth; this is its outline.

| Part | Holds |
|:---|:---|
| `metadata` | Title, subtitle, authors (ORCID, affiliations, corresponding), identifiers (DOI, PMID, PMCID, arXiv), venue, date as precise as the source states it, keywords, article type, language, license passed through verbatim |
| `abstracts[]` | Every abstract with its `kind` (`main`, `graphical`, `plain-language`, `teaser`, `other`); structured abstracts keep their titled sections |
| `body[]`, `back[]` | Section trees. A section has an ID stable within the document, a `kind`, an optional label and title, typed blocks, and subsections |
| Blocks | `paragraph`, `list`, `table` (rectangular rows, spans expanded, or an `unextractable` reason), `figure`, `formula` (TeX when the source has it, else linear text), `code`, `quote`, `box`, `supplement` |
| `floats[]` | Figures and tables the source places outside any section |
| `references[]`, `footnotes[]` | Every reference keeps its full citation as text, plus structured fields when the source marks them up |
| `diagnostics` | `quality` (`structured` / `partial` / `flat`), coded warnings, and unhandled source elements with counts |

Inline text is CommonMark with GFM: emphasis, links, `$…$` math where the source carries TeX, citation markers as printed. Block structure is typed, so a renderer never re-parses Markdown to find a table.

## Formats

| Subpath | Reads | Starting point | Quality |
|:---|:---|:---|:---|
| `/jats` | JATS 1.x in the Archiving and Publishing tag sets, as served by PMC, Europe PMC, bioRxiv, and publisher TDM feeds | The parser hardened in `pubmed-mcp-server` (`src/services/ncbi/parsing/`), moved here unchanged and then reshaped to the model | `structured` |
| `/tei` | Grobid TEI: the standard `<TEI>` document (`text/body/div`) and the lowercase `<tei>` wrapped in HTML (`text/div`) that OpenAlex serves | New | `structured` |
| `/latexml` | arXiv's `arxiv.org/html` and ar5iv renders | The boilerplate stripping in `arxiv-mcp-server`, replaced by a real conversion | `structured` |
| `/html` | Article pages from publishers and preprint servers | A walker over a `linkedom` DOM: `citation_*` and Dublin Core metadata, the article container, headings as the section tree, and page furniture skipped | `partial` |
| `/pdf` | PDF with a text layer | `unpdf` text runs with their fonts, laid out into columns and reading order, then structure from typography: title and abstract from the first page, headings by size, weight, numbering, and name, captions by label, references by numbering or indentation | `partial` or `flat` |

Elsevier full-text XML (its own `xocs`/`ce:` schema, not JATS) is a later format.

**Dependencies.** `fast-xml-parser` is the one required dependency. `linkedom` and `unpdf` are optional peers, loaded on first use.

## Quality engine

The parsers are only as good as the documents they have been run against. Quality comes from five layers, all under `tests/corpus/` and `corpus/`.

1. **Corpus.** Real documents stored byte-for-byte in `corpus/<format>/<fixture-id>/`, each with a `meta.json` recording where it came from, its license, and what it exercises. Only openly licensed documents (CC BY, CC0, and similar) — `corpus/README.md` holds the rules, and `corpus/ATTRIBUTION.md` credits every one.
2. **Per-fixture assertions** in `expect.json`: section titles in order, table shapes, formula TeX, the main abstract's opening, reference counts, and any regression the fixture exists for. Plus `expected.md`, a reviewed Markdown snapshot.
3. **Invariants** checked on every document: no leaked source tags or entities, no TeX preambles, every table, figure, and reference in the source accounted for, no empty headings, no split surrogate pairs, deterministic output.
4. **Cross-format agreement.** A rosetta set of works stored in several formats (JATS, PDF, publisher HTML, Grobid TEI generated from the PDF, and LaTeXML when an arXiv version exists). The JATS parse is the reference: `bun run corpus:agreement` measures the other formats against it on section titles, abstract, reference count, and table and figure counts, which gauges PDF and HTML quality without hand labeling.
5. **Wild sampling.** `bun run corpus:sample` pulls fresh openly licensed documents from Europe PMC, arXiv, and (with a key) OpenAlex, runs the invariants, and groups failures by element and publisher. Each new failure class becomes a fixture.

Every parsing bug fixed in a consumer before this package existed becomes a named regression fixture, with the issue recorded in `meta.json`.

## Plan to 0.1.0

1. Scaffold and gate.
2. Corpus harness and first collection, before any parser code.
3. Model renderers and the JATS parser, first matching the behavior it had in `pubmed-mcp-server`, then reshaped to the model.
4. LaTeXML, then TEI, then HTML with `detect()`, then PDF.
5. Wild-sampling rounds per format until they stop finding new failure classes. The pass-rate bar is set after the first round.
6. 0.1.0: all five formats, the corpus green, a sampling report per format. The first consumer is `openaccess-mcp-server`; `pubmed-mcp-server`, `arxiv-mcp-server`, and `biorxiv-mcp-server` follow in their own releases.

## Decisions

- **Reuse pubmed's JATS parser rather than wrap MyST's.** On ten Europe PMC articles, the pubmed parser kept all 24 tables and every display formula; `jats-to-myst` → `myst-to-md` rendered no tables, dropped display math, wrote MyST dialect, and pulled 199 packages.
- **Parse only; never fetch.** Fetching carries policy (rate limits, licenses, challenge handling) that belongs to the consumer, and a pure parser runs anywhere.
- **Results, not exceptions, for bad input.** Malformed and blocked documents are normal in the wild; a caller branches on `ok` instead of wrapping every call in `try`.
- **Inline Markdown, typed blocks.** Consumers render Markdown almost always; typing the blocks keeps tables, formulas, and figures addressable without a second parser.
- **Optional peers for HTML and PDF engines.** A consumer that parses only JATS installs one dependency.
- **Publisher HTML walked directly, not through a readability extractor.** Defuddle, run on a PLOS article, turned the reference list into footnotes holding only "View Article" links, dropped every figure caption, and stripped the class attributes publisher pages mark abstracts, figures, and references with.
- **A well-formedness check before every XML parse.** fast-xml-parser accepts markup that is not well-formed and silently drops what follows the fault (an unescaped `<` in `p < 0.05` loses the rest of the section), and its own validator is deprecated in favor of a package that brings a second XML parser. A single-pass scan in `src/xml/well-formed.ts` turns that silent loss into a `malformed` result.
- **Unscoped on npm.** The package is meant for any TypeScript project that reads papers; the cyanheads name travels with the repository, the npm maintainer, and the README.
- **Detection reads the payload, not the transport.** A `Content-Type` or URL says what a server meant to send; the bytes say what arrived, and a challenge page served for a PDF URL is the case that matters. Detection sniffs the opening bytes only, and challenge pages are left to the HTML parser, which reports them as `blocked`.
- **PDF structure from typography, without a model.** A PDF records where text is drawn, not what it is. The parser reads text runs with their fonts from pdf.js (through `unpdf`), finds each page's column gutter, and infers structure from size, weight, numbering, and the names sections usually carry. It runs anywhere with no service to call; Grobid remains the better reader, and its TEI is a format of its own.
- **Legal formats in a sibling package.** Akoma Ntoso is the legal counterpart of JATS, with its own model (acts, divisions, provisions), so a shared package would only blur both.
- **Element citations laid out as PMC prints them.** A JATS `<element-citation>` holds its fields with no punctuation, in whatever order the publisher lists them, so reading them in source order gave `Nat. Rev. Genet. 21 2020 207–226`. The parser writes `Source. 2020;21:207–226.` whatever the order, matching the `<mixed-citation>` text most PMC deposits carry, so a reference list reads the same whichever form a deposit uses.
- **Europe PMC's Associated Data digest is dropped.** The generated `sec-type="associated-data"` section repeats the article's own supplementary files, data availability statement, and data citations, which the parser already reads where the article places them.
- **A note group titled for its contents is a section.** JATS `<fn-group>` is a footnote container, but eLife and PeerJ put competing interests, author contributions, and data availability in titled groups. Such a group, or a Europe PMC `sec-type="fn-group"` wrapper titled other than `Footnotes`, reads as a section under its title, each note led by the authors whose `<xref ref-type="fn">` points at it; any other group stays footnotes.
