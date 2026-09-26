# README.md conventions for scholarly-parse

Structure and content guide for the library README. When the README already exists, audit it against this — don't rewrite sections that are already accurate.

## Concision

A README is read once by someone deciding whether and how to use the library. It is not the changelog, not the design doc, and not proof that a feature works. Apply these on every pass, including re-runs over a README that is already accurate — accuracy is the floor, not the finish.

**Keep, always:** canonical identifiers (subpaths, export names, model fields, `ParseResult` reasons, `quality` levels) exactly as the code spells them; which parsers are sync and which async; which peer each format needs; supported runtimes; anything a caller must know before the first call. Brevity never earns semantic loss — if cutting a clause drops one of these facts, the clause stays.

**Cut:** narration of how a parser works (that's `docs/design.md` or the code); edge-case walkthroughs; release-note accretion (a line that exists because a version added it, not because a reader needs it); marketing adjectives; an intro sentence that repeats the tagline.

**The test, per line:** would a reader lose a fact they need before their first call? If not, cut or merge.

**Validate what stays.** Condensing is where wrong facts creep in. Every identifier, signature, and peer name that survives the pass is checked against the source before the run ends.

## Structure

Section order. Omit a section that doesn't apply yet (no published package → no npm badge).

```text
# scholarly-parse              ← centered HTML block: h1 + bold tagline
Info badges                    ← one centered row
[Status callout]               ← only while the package is unpublished
---
## What it does                ← two or three sentences
## Install                     ← the package, then the peers each format needs
## Usage                       ← two to four short examples
## API                         ← one row per subpath
## Formats                     ← one row per format
## Document model              ← a short outline plus pointers
## Project structure           ← path/purpose table
## Development                 ← gate command, pointer to CLAUDE.md, issues-only contributing
## License                     ← Apache-2.0 plus the corpus-licensing note
```

## Section guide

### Header

Centered HTML. The `<h1>` is `scholarly-parse` — unscoped, always. The `<p>` holds the bold tagline, which is `package.json` `description` verbatim.

```html
<div align="center">
  <h1>scholarly-parse</h1>
  <p><b><package.json description></b></p>
</div>
```

### Badges

One centered row, `style=flat-square`, each tracking a real source:

| Badge | Tracks |
|:------|:-------|
| Version — static `Version-<x.y.z>-`, links `./CHANGELOG.md` | `package.json` `version` (a prerelease escapes `-` as `--`) |
| License — links `./LICENSE` | `package.json` `license` |
| TypeScript | the `typescript` range in `devDependencies` |
| Node | `engines.node` |
| npm — `img.shields.io/npm/v/scholarly-parse`, links the npm page | only once the package is published |

No badges for things the package doesn't have. Add a `---` rule after the header block.

### Status callout

While the package is unpublished, a one-line blockquote says so and points at `docs/design.md`. It must stay accurate as formats land, and it is removed with the first npm publish.

### What it does

Two or three sentences: the formats read, the one model they produce, the Markdown it renders, and that it parses only — fetching, rate limiting, and licensing decisions stay with the caller. Lead with the subject, not with "A library that…".

### Install

```sh
bun add scholarly-parse
# or
npm install scholarly-parse
```

Then a short table of the optional peers each format loads on first use, taken from `package.json` `peerDependenciesMeta` and the format's lazy imports — never from memory:

| Format | Also install |
|:---|:---|
| `scholarly-parse/<format>` | `<peer>` |

Say plainly that a format without a row needs nothing beyond the package, and that a format whose peer is missing throws on first use with the install command. List the supported runtimes: Bun, Node ≥22, Cloudflare Workers.

### Usage

Two to four short examples, each runnable as written, each showing a real branch on `ParseResult`:

```ts
import { toMarkdown } from 'scholarly-parse';
import { parseJats } from 'scholarly-parse/jats';

const result = parseJats(xml);
if (result.ok) {
  console.log(toMarkdown(result.document));
} else {
  console.error(result.error.reason, result.error.message);
}
```

Good candidates: a sync XML parse, an async HTML or PDF parse (`await`), `detect()` choosing a parser, and `toSections()` for chunking. Copy signatures from the code; run every example against the built `dist/` before it ships.

### API

One row per subpath in `package.json` `exports`, with its exports — the same surface as the Public API block in `docs/design.md`:

| Import | Exports |
|:---|:---|
| `scholarly-parse` | `detect`, `toMarkdown`, `toText`, `toSections`, the model types |
| `scholarly-parse/<format>` | `parse<Format>`, … |

Follow with one line on the result contract: every parser returns `{ ok: true, document }` or `{ ok: false, error: { reason, message } }`, with the reasons listed.

### Formats

One row per format that exists: subpath, what it reads, and the `quality` it reports (`structured`, `partial`, `flat`). Omit the design doc's starting-point history — the README describes what ships.

### Document model

Two or three lines naming the model's parts (metadata, abstracts, body and back section trees of typed blocks, floats, references, footnotes, diagnostics), then pointers: `docs/design.md` (linked as `./docs/design.md`) for the outline and decisions, and `src/model/document.ts` as the source of truth.

### Project structure

A path/purpose table covering `src/model/`, `src/formats/`, `src/detect/`, `src/render/`, `src/xml/`, `corpus/`, `tests/`, and `docs/design.md` — only paths that exist.

### Development

```sh
bun install
bun run devcheck
```

Point to `CLAUDE.md` for the rules. Contributions arrive as issues — link `.github/CONTRIBUTING.md`. Never invite pull requests.

### License

Apache-2.0, linking `LICENSE`, followed by the corpus-licensing note: documents under `corpus/` keep their own licenses, listed in `corpus/ATTRIBUTION.md`.

## Principles

- **Accuracy over aspiration.** Document what's exported. Planned formats live in `docs/design.md`.
- **Real names from code.** Subpaths, exports, fields, and reasons match the source exactly — copy, don't paraphrase.
- **Tables over prose** for subpaths, formats, peers, and paths.
- **Short examples that run.** An example that doesn't compile against `dist/` is worse than none.
- **Unscoped everywhere.** `scholarly-parse` in the header, install lines, imports, and badges.
- **Concise on every pass**, and validate everything that survives.
