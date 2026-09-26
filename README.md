<div align="center">
  <h1>scholarly-parse</h1>
  <p><b>Parse scholarly papers — JATS, Grobid TEI, arXiv HTML, publisher HTML, PDF — into one document model and Markdown.</b></p>
</div>

<div align="center">

[![Version](https://img.shields.io/badge/Version-0.1.0-blue.svg?style=flat-square)](./CHANGELOG.md) [![License](https://img.shields.io/badge/License-Apache%202.0-orange.svg?style=flat-square)](./LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-^7.0.2-3178C6.svg?style=flat-square)](https://www.typescriptlang.org/) [![Node](https://img.shields.io/badge/Node-%E2%89%A522-339933.svg?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

</div>

---

> **In development — not yet published to npm.** The document model is in place; the format parsers land ahead of 0.1.0. [`docs/design.md`](./docs/design.md) describes the API and model being built.

## What it does

Papers reach code in five shapes: JATS XML from PubMed Central, Europe PMC, and publisher feeds; TEI from Grobid; LaTeXML HTML from arXiv; article pages from publisher sites; and PDF. `scholarly-parse` reads each into the same `ScholarlyDocument` — metadata, abstracts, a section tree of typed blocks (paragraphs, tables, figures, formulas, lists), references, and diagnostics saying how much structure it recovered — and renders that as Markdown.

It parses only. Fetching, rate limiting, and licensing decisions stay with the caller.

## Project structure

| Path | Purpose |
|:---|:---|
| `src/model/` | The document model and the `ParseResult` type |
| `src/formats/` | One parser per format |
| `src/render/` | Markdown, plain text, section list |
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
