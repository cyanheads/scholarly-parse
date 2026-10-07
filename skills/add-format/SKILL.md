---
name: add-format
description: >
  Add a source format to scholarly-parse end to end: corpus fixtures first, then a parser under `src/formats/<format>/` built on the shared XML, HTML, and model helpers, wired into `SourceFormat`, `detect`, `parse`, the package `exports`, the corpus harness, and `add.ts`, with bounds on untrusted input, an optional peer for any new engine, unit tests, docs, and a security pass. Use when asked to add or support a format no existing parser reads (Elsevier full-text XML, with its own `ce:` schema), or to split a format out of an existing parser.
metadata:
  author: cyanheads
  version: "1.1"
  type: workflow
---

## Context

Every format is a parser from bytes or text to `ScholarlyDocument` (`src/model/document.ts`), published as its own subpath (`scholarly-parse/<format>`) so an application loads only what it parses. The model is the contract: renderers never see the source format. Read `docs/design.md` (scope, public API, formats table, decisions) and `CLAUDE.md` § The rules that matter before starting. The rules that shape a parser:

- **Parse only.** No network, filesystem, or `node:` imports under `src/`; it must run on Workers.
- **Results, not throws.** Bad input returns `failed(reason, message)`. The only throw is a missing optional peer, with the install command in the message.
- **Bounded.** A size budget, depth-limited recursion, and capped entity expansion: a crafted document produces a result, not a hang.
- **Optional peers load lazily.** A new engine is an optional peer imported on first use inside its format, never at module top level.

A variant of an existing format (another JATS producer, another LaTeXML host) is not a new format: handle it in that parser, pinned by fixtures (`skills/add-fixture/SKILL.md`).

## When to use

- Asked to add or support a format this package does not read
- A consumer needs documents whose markup no existing parser models

## Inputs

1. **The format** — its name (the `SourceFormat` value and subpath, lowercase), its specification or schema, and who serves it
2. **Openly licensed documents in it** — at least three, from different producers where possible
3. **The quality it can reach** — `structured`, `partial`, or `flat` (`docs/design.md` § Formats)
4. **The engine** — the shared XML reader, the shared DOM, or a new dependency

## Steps

### 1. Collect fixtures first

The corpus comes before parser code. Register the format so fixtures load: add it to `FORMATS` and `SOURCE_FILE` in `tests/corpus/fixtures.ts`, `SOURCE_FILE` in `scripts/corpus/add.ts`, and the format list in `corpus/README.md`. Give `add.ts` a kind that fetches the format and confirms each document's license from its own metadata; the script's header documents each kind and its license source. Then add fixtures through `add.ts`. Until the format has a parser, its fixtures run as `it.todo` in `tests/corpus/corpus.test.ts`.

Choose fixtures that cover the format's range: sections nested and flat, tables with spans, figures, math, references in each citation style the format allows, and one hostile or broken document (a truncated file, a wrong-format payload).

### 2. Write the think-through

Before code, write a short overview: how the format's elements map to the model (sections, block types, abstracts, references, front matter), which quality it reaches, which shared helpers it reuses, what it cannot represent, and whether the model lacks anything the format carries. A field added to `src/model/document.ts` is public API: prefer mapping into existing fields, and treat any addition as its own reviewed change with a changelog line.

### 3. Build the parser

`src/formats/<format>/`:

| File | Holds |
|:---|:---|
| `index.ts` | The subpath's public surface: `export { parse<Format> } from './parse.js'`, plus any options type |
| `parse.ts` | The entry point |
| `context.ts` | The per-parse context: the diagnostics collector, issued section IDs, collected footnotes |
| `inline.ts`, `blocks.ts`, others | Inline Markdown, block and section extraction, references, split as the format needs |

The entry point follows the existing parsers (`src/formats/tei/parse.ts` is a compact model):

1. Check the budget: `exceedsBudget(input, maxBytes)` from `src/model/input.ts`, with a format default for `maxInputBytes`, returning `failed('too-large', …)`.
2. Decode with `decodeText` (byte-order mark, then the declared encoding, then UTF-8). A binary format keeps its bytes.
3. Confirm the format and return `wrong-format` when it is something else; `malformed` for unparseable input; `empty` when nothing of a paper is left.
4. Build the document with `createDiagnostics()` from `src/model/diagnostics.ts`: `warn` with a `ParseWarningCode`, `unhandled` only for source elements no handler covers (a construct dropped on purpose is handled, not reported), `finish(quality)` at the end.
5. Return `parsed(document)`.

Reuse the shared layers rather than re-deriving them:

| Need | Use |
|:---|:---|
| XML | `parseOrderedXml` and the tree helpers in `src/xml/ordered.ts`: well-formedness check, entity caps, depth-limited search |
| HTML | `loadDocument` and the node helpers in `src/html/dom.ts` (lazy `linkedom`), `readHtmlTable` in `src/html/tables.ts`, `interstitialReason` in `src/html/interstitial.ts` for challenge pages |
| Tables | `buildGrid` and `spanValue` in `src/model/table-grid.ts`: spans expanded, width capped |
| Sections | `issueId` (`src/model/section-ids.ts`) for unique IDs; `kindFromTitle` and `splitSectionNumber` (`src/model/section-kinds.ts`) for back matter and numbering |
| Inline Markdown | `escapeInline` (`src/render/escape.ts`) on every source text run, and `emphasis`, `link`, `inlineMath`, `inlineCode` from `src/render/inline.ts` |

A new engine goes into `peerDependencies` with `peerDependenciesMeta.<name>.optional: true`, and into `devDependencies` for the tests. Load it with a dynamic `import()` inside the format on first use, throwing with `bun add <name>` in the message when it is missing (the `loadDocument` pattern). The format's parser is then async.

### 4. Wire it in

| Where | Change |
|:---|:---|
| `src/model/document.ts` | Add the name to `SourceFormat` |
| `src/detect.ts` | A sniff on the opening bytes, placed so formats that wrap others are tested first (TEI inside HTML is why TEI precedes HTML); cases in `tests/detect.test.ts` |
| `src/parse.ts` | A `case` that imports the format on first use and passes the options it reads; a case in `tests/parse.test.ts` |
| `package.json` | An `exports` entry `./<format>` with `types`, `import`, and `default` under `dist/formats/<format>/`; the `description` and `keywords` when the format is a headline one |
| `tests/corpus/parsers.ts` | The format's parser in `PARSERS` |
| `tests/corpus/corpus.test.ts` | The format in `TEXT_FORMATS` when the source is text |
| `tests/corpus/invariants.ts` | Source counts the model must match, when the format marks tables, figures, or references countably (the JATS block is the example) |

### 5. Test

- Unit tests with synthetic markup under `tests/formats/<format>/`, one file per concern as the format grows (sections, tables, formulas, references, front matter). Each pins one behavior with the smallest markup that shows it.
- `bun run corpus:snapshot`, then read every new `expected.md` in full against its source (add-fixture step 4). Write each fixture's `expect.json` (add-fixture step 5).
- When an open source serves the format in bulk, add it to `scripts/corpus/sample.ts` and run a sampling round (`skills/corpus-sampling/SKILL.md`).

### 6. Document

- `docs/design.md`: the Public API import block, the Formats table row, and a Decisions entry for any non-obvious choice (the engine, what the format cannot represent)
- `README.md`: the formats it lists and the subpath imports
- `CLAUDE.md`: the opening description when it names the formats
- The release's changelog entry: the new subpath, any `SourceFormat` or model change, and any new peer dependency
- `bun run tree` for `docs/tree.md`

### 7. Verify and review

```bash
bun run devcheck
```

It builds, runs every test and fixture, and checks the new subpath with `publint` and `attw`. Then run `skills/security-pass/SKILL.md` scoped to the new format: a parser for untrusted input is not done until it has been probed.

## Checklist

- [ ] Fixtures in the corpus before parser code, licenses confirmed by `add.ts`
- [ ] Think-through written: model mapping, quality, reuse, gaps
- [ ] Parser returns results for bad input, checks its budget, recurses with a depth limit, escapes every source text run
- [ ] Any new engine an optional peer, loaded lazily
- [ ] `SourceFormat`, `detect`, `parse`, `exports`, corpus harness, `add.ts` wired, each with tests
- [ ] Every fixture snapshot read and its `expect.json` written
- [ ] Design doc, README, changelog, and tree updated
- [ ] `bun run devcheck` green; security pass run on the format
