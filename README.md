<div align="center">
  <h1>scholarly-parse</h1>
  <p><b>Parse scholarly papers — JATS, Grobid TEI, arXiv HTML, publisher HTML, PDF — into one document model and Markdown.</b></p>
</div>

<div align="center">

[![Version](https://img.shields.io/badge/Version-0.2.0-blue.svg?style=flat-square)](./CHANGELOG.md) [![License](https://img.shields.io/badge/License-Apache%202.0-orange.svg?style=flat-square)](./LICENSE) [![npm](https://img.shields.io/npm/v/scholarly-parse?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/scholarly-parse) [![TypeScript](https://img.shields.io/badge/TypeScript-^7.0.2-3178C6.svg?style=flat-square)](https://www.typescriptlang.org/) [![Node](https://img.shields.io/badge/Node-%E2%89%A522-339933.svg?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

</div>

---

## What it does

`scholarly-parse` reads a paper in any of five formats — JATS XML from PubMed Central, Europe PMC, and publisher feeds; TEI from Grobid; LaTeXML HTML from arXiv; publisher article pages; and PDF — into one `ScholarlyDocument`, and renders it as Markdown.

## Install

```sh
bun add scholarly-parse
# or
npm install scholarly-parse
```

The JATS and TEI parsers need nothing more. The others load an optional peer on first use, and throw with the install command when it is missing:

| Format | Also install |
|:---|:---|
| `scholarly-parse/latexml`, `scholarly-parse/html` | `linkedom` |
| `scholarly-parse/pdf` | `unpdf` |

Runs on Bun, Node ≥22, and Cloudflare Workers. ESM only.

## Usage

```ts
import { toMarkdown } from 'scholarly-parse';
import { parseJats } from 'scholarly-parse/jats';

const result = parseJats(xml);
if (result.ok) console.log(toMarkdown(result.document));
else console.error(result.error.reason, result.error.message);
```

When the format isn't known, `parse` detects it from the payload and loads that parser. It is async, since the HTML and PDF parsers are:

```ts
import { parse } from 'scholarly-parse';

const result = await parse(bytes, { baseUrl: url });
if (!result.ok && result.error.reason === 'blocked') {
  // a captcha or access-denied page arrived instead of the paper
}
```

`toSections` flattens the document into sections with their heading paths and sizes, for serving a long paper a piece at a time. Figures and tables outside any section, the footnotes, and the references come last, one entry each, and each entry's `id` renders it alone through `toMarkdown(document, { sections: [id] })`:

```ts
import { toSections } from 'scholarly-parse';

for (const { path, chars, markdown } of toSections(document)) {
  console.log(path.join(' › '), chars);
}
```

## API

| Import | Exports |
|:---|:---|
| `scholarly-parse` | `detect`, `parse`, `toMarkdown`, `toText`, `toSections`, and the model types |
| `scholarly-parse/jats` | `parseJats`, `jatsInlineToMarkdown` |
| `scholarly-parse/tei` | `parseTei` |
| `scholarly-parse/latexml` | `parseLatexml` |
| `scholarly-parse/html` | `parseHtml` |
| `scholarly-parse/pdf` | `parsePdf` |

Every parser returns `{ ok: true, document }` or `{ ok: false, error: { reason, message } }`, where `reason` is `malformed`, `wrong-format`, `empty`, `blocked`, or `too-large`. Each takes a `maxInputBytes` budget; `parseLatexml` and `parseHtml` take the page's `baseUrl` to resolve links, and `parsePdf` reading budgets counted across the document: `maxPages` (default 300), `maxTextItems` (500,000), `maxTextChars` (4,000,000), and `maxOperators` (10,000,000). A PDF that reaches one parses as far as it was read, with a `truncated-input` warning. `parseJats` and `parseTei` are synchronous; the rest are async.

`parsePdf` and `parse` also take a `signal`: once it is aborted (`AbortSignal.timeout(ms)`, a request's cancellation), reading stops at the next page boundary and keeps what was read, warned `truncated-input`. pdf.js reads a page without yielding, so for a hard time or memory bound on untrusted PDFs, run `parsePdf` in a worker or process you can terminate.

## Formats

| Subpath | Reads | Quality |
|:---|:---|:---|
| `/jats` | JATS 1.x as PubMed Central, Europe PMC, bioRxiv, and publisher feeds serve it | `structured` |
| `/tei` | Grobid TEI, including the HTML-wrapped form OpenAlex serves | `structured` |
| `/latexml` | arXiv HTML and ar5iv renders | `structured` |
| `/html` | Publisher and preprint-server article pages | `partial` |
| `/pdf` | PDFs with a text layer, structure read from typography | `partial`, or `flat` when no headings are found |

## Document model

A `ScholarlyDocument` holds `metadata` (title, authors, venue, identifiers, license, and related works such as the article a correction corrects or the notice retracting it), `abstracts` by kind, `body` and `back` section trees of typed blocks (paragraph, list, table, figure, formula, code, quote, box, supplement), `floats`, `references`, `footnotes`, and `diagnostics`: the `quality` level, coded warnings, and source elements no handler covered. [`docs/design.md`](./docs/design.md) outlines it and records the decisions behind it; [`src/model/document.ts`](./src/model/document.ts) is the source of truth.

## Project structure

| Path | Purpose |
|:---|:---|
| `src/model/` | The document model and the `ParseResult` type |
| `src/formats/` | One parser per format |
| `src/detect.ts`, `src/parse.ts` | Format detection, and `parse` for any format |
| `src/render/` | Markdown, plain text, section list |
| `src/html/`, `src/xml/` | The shared DOM and XML readers, HTML tables, MathML to TeX |
| `corpus/` | Openly licensed real documents the parsers are tested against |
| `tests/` | Unit tests and the corpus suite |
| `docs/design.md` | Scope, API, model, and decisions |

## Development

```sh
bun install
bun run devcheck
```

Rules for working in the repo are in [`CLAUDE.md`](./CLAUDE.md). Bugs and requests go through [issues](https://github.com/cyanheads/scholarly-parse/issues) — see [CONTRIBUTING](./.github/CONTRIBUTING.md).

## License

[Apache-2.0](./LICENSE). Corpus documents keep their own licenses — see [`corpus/ATTRIBUTION.md`](./corpus/ATTRIBUTION.md).
