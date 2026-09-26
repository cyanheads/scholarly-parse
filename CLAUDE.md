# scholarly-parse

A TypeScript library that parses scholarly papers — JATS XML, Grobid TEI, arXiv LaTeXML HTML, publisher article HTML, and PDF — into one document model (`ScholarlyDocument`) and renders it as Markdown. Published to npm as `scholarly-parse` (unscoped — never add a scope on any surface). Apache-2.0, public repo, runs on Bun, Node ≥22, and Cloudflare Workers.

**Orientation:** this file is the behavioral layer. `docs/design.md` holds the scope, public API, model outline, format table, quality engine, and decisions; `corpus/README.md` holds the fixture rules. Skills live in `skills/` (`.claude/skills` and `.agents/skills` are symlinks to it) — run `bun run list-skills` for the index.

## Stack & gate

TypeScript strict ESM (`tsc` 7), Bun for development, Biome for lint and format, Vitest for tests.

```sh
bun install
bun run devcheck   # the gate — green before declaring any work complete, and before every commit
```

`bun run devcheck` (`scripts/devcheck.ts`) runs Biome with `--write --error-on-warnings`, typecheck, a clean build, the full test suite including the corpus, the changelog check, `publint`, `attw` (ESM-only profile), the skill-symlink check, and `bun audit` at high severity. Warnings are failures. Run it raw: Biome auto-fixes formatting, so filtering its output hides what it changed.

## Running it

| Command | Does |
|:---|:---|
| `bun run test` | Every unit and corpus test |
| `bun run test:corpus` | Only the corpus suite: every fixture through its parser, assertions, invariants, snapshots |
| `bun run corpus:snapshot` | Rewrite `expected.md` snapshots — review every diff before committing |
| `bun run corpus:sample` | Wild sampling: fetch fresh openly licensed documents, run invariants, report failure classes (network; see `.env.example`) |
| `bun run changelog:build` | Regenerate `CHANGELOG.md` from `changelog/` |
| `bun run tree` | Regenerate `docs/tree.md` |
| `bun run list-skills` | Index of `skills/` |

## Architecture

Bytes or text in → a format parser → `ScholarlyDocument` → a renderer. Nothing fetches.

| Path | Role |
|:---|:---|
| `src/model/document.ts` | The model. The single contract between parsers and renderers |
| `src/model/result.ts` | `ParseResult` — every parser's return type |
| `src/formats/<format>/` | One parser per format; each `index.ts` is that subpath's public surface (`scholarly-parse/jats`, …) |
| `src/detect/` | Format detection and challenge-page detection |
| `src/render/` | Markdown, plain text, flat section list |
| `src/xml/` | Shared `fast-xml-parser` configuration and ordered-tree helpers |
| `corpus/<format>/<id>/` | Fixture documents with `meta.json`, `expect.json`, `expected.md` |
| `tests/corpus/` | The corpus runner, invariants, and the `features` vocabulary |
| `scripts/corpus/` | Corpus collection, wild sampling, attribution generation |

## The rules that matter

- **Parse only.** No network, no filesystem, no `node:` imports under `src/` (Biome's `noNodejsModules` enforces it). The package must run on Workers.
- **The model is the contract.** A field added to `src/model/document.ts` is public API. Rename or remove one only as a breaking change, recorded in the changelog with `breaking: true`.
- **Expected failures are results.** A parser never throws on bad input; it returns `{ ok: false, error }`. It throws only for a missing optional peer dependency, with the install command in the message.
- **Optional peers load lazily.** `linkedom`, `defuddle`, and `unpdf` are imported on first use inside their format; nothing at module top level pulls them in.
- **Untrusted input has bounds.** Every parser checks `maxInputBytes`, entity expansion stays capped in the shared XML config, and recursion over source trees is depth-limited. A crafted document must produce a result, not a hang or a stack overflow.
- **Corpus sources are byte-for-byte and openly licensed.** Never reformat a `source.*` file. Never add a document without confirming its license from its own metadata (`corpus/README.md`), and regenerate `corpus/ATTRIBUTION.md` when fixtures change.
- **A bug fix starts as a fixture.** Reproduce it in `corpus/` (or a unit test when no openly licensed document shows it), watch it fail, then fix it.
- **Snapshots are reviewed, never blessed.** `corpus:snapshot` rewrites `expected.md`; read every diff and keep only changes that are improvements.
- **Generated files:** `CHANGELOG.md` (from `changelog/`), `docs/tree.md`, `corpus/ATTRIBUTION.md`. Regenerate with their scripts; never hand-edit.

## Where things live

- `docs/design.md` — scope, API, model outline, formats, quality engine, decisions on record
- `changelog/<major.minor>.x/<version>.md` — one file per release; `changelog/template.md` is the format reference
- `.env` — gitignored, used only by `scripts/corpus/`; `.env.example` lists the variables
- `skills/` — workflows, listed below

## Triggers

| When the ask is | Do this |
|:---|:---|
| "this paper parses wrong", "fix the JATS/PDF/… output" | Add the document as a fixture (or a unit test when it can't be redistributed), reproduce, fix, re-snapshot and review |
| "add a fixture", "add this paper to the corpus" | `skills/add-fixture/SKILL.md` |
| "sample", "run the wild sampling", "find new failures" | `skills/corpus-sampling/SKILL.md` |
| "add a format", "support Elsevier XML" | `skills/add-format/SKILL.md` |
| "wrap up", "commit this", "release", "ship it" | `skills/git-wrapup/SKILL.md`, then `skills/release-pr-review/SKILL.md` and `skills/release-and-publish/SKILL.md` |
| "file an issue" | `skills/report-issue-local/SKILL.md` |
| "clean it up", "simplify" | `skills/code-simplifier/SKILL.md` |
| "polish the docs", "prep the README" | `skills/polish-docs-meta/SKILL.md` |
| "security pass", "fuzz it" | `skills/security-pass/SKILL.md` |
| "update deps", "maintenance" | `skills/maintenance/SKILL.md` |

## Skills

| Skill | Use |
|:---|:---|
| `git-wrapup` | Commit a working tree as a stack of logical commits on a `release/<version>` branch, with the version, changelog, and tree in sync |
| `release-pr-review` | The review pass on a release PR before it merges |
| `release-and-publish` | Tag, merge, publish to npm, create the GitHub release |
| `report-issue-local` | File a bug or feature request against this repo |
| `code-simplifier` | Cleanup pass over a session's changes |
| `polish-docs-meta` | Bring README, CLAUDE.md, docs, and package metadata in line with the code |
| `security-pass` | Review the parsers against hostile input |
| `maintenance` | Dependency updates and the checks that follow them |
| `add-fixture` | Add a document to the corpus with its license, meta, and assertions |
| `add-format` | Add a format parser end to end |
| `corpus-sampling` | Run wild sampling and turn failure classes into fixtures |

## Related repos

- `cyanheads/openaccess-mcp-server` — first consumer (resolve a paper reference, fetch its open copy, parse it here)
- `cyanheads/pubmed-mcp-server`, `cyanheads/arxiv-mcp-server`, `cyanheads/biorxiv-mcp-server` — later consumers; their closed parsing issues seed the regression fixtures
- `cyanheads/mcp-ts-core` — [#558](https://github.com/cyanheads/mcp-ts-core/issues/558) pages a long document for an MCP tool from this package's `toSections()` output

## Publishing

Release mode: `gated`. `git-wrapup` on a `release/<version>` branch, then the `release-pr-review` pass (Opus), then `release-and-publish`. The npm publish runs only on the maintainer's word.

## Commit stance

Until 0.1.0 ships, commit and push to `main` freely once `bun run devcheck` is green — terse Conventional Commits, one logical concern per commit, no attribution trailers. From 0.1.0 on, work lands through the release flow above. Never force-push, never `git stash`, never use worktrees.
