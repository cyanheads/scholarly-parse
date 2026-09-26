# package.json metadata

What each field should hold for `scholarly-parse`. Check each one; fix what's missing or wrong, skip what's already right.

## Identity and discovery

| Field | Should be |
|:------|:----------|
| `name` | `scholarly-parse` — unscoped, on every surface, permanently. Never add a scope. |
| `version` | Set by `git-wrapup` at release time. Never bumped as polish. |
| `description` | One sentence naming the formats in and the model and Markdown out. The canonical source for the README tagline, `CITATION.cff` `abstract`, and the GitHub repo description. |
| `keywords` | The formats (`jats`, `tei`, `grobid`, `latexml`, `pdf`), the sources (`arxiv`, `pubmed-central`, `europe-pmc`), the output (`markdown`, `pdf-to-markdown`, `html-to-markdown`), the use (`llm`, `rag`), and `typescript`. In sync with the GitHub topics. |
| `license` | `Apache-2.0` — matches `LICENSE` and `CITATION.cff`. |
| `author` | `Name <email> (url)` — the URL is the author's site, not the repo. Matches the `LICENSE` copyright holder. |
| `repository` | `{ "type": "git", "url": "git+https://github.com/cyanheads/scholarly-parse.git" }` |
| `homepage` | `https://github.com/cyanheads/scholarly-parse#readme` |
| `bugs` | `{ "url": "https://github.com/cyanheads/scholarly-parse/issues" }` |
| `funding` | Matches `.github/FUNDING.yml` (GitHub Sponsors, Buy Me a Coffee). |

## Module shape

| Field | Should be | Why |
|:------|:----------|:----|
| `type` | `"module"` | ESM only |
| `exports` | `"."` plus one entry per format subpath that exists (`"./jats"`, `"./tei"`, `"./latexml"`, `"./html"`, `"./pdf"`), each with `types`, `import`, and `default` pointing into `dist/`, plus `"./package.json"` | One subpath per format, so an application loads only what it parses. `publint --strict` and `attw --profile esm-only` in devcheck verify the map resolves. |
| `main`, `types`, `module` | absent | `exports` is the entry point; ESM-only needs no fallbacks |
| `sideEffects` | `false` | Lets bundlers drop unused formats |
| `files` | `["dist/", "changelog/", "CHANGELOG.md"]` | Never `corpus/`, `tests/`, `scripts/`, or `.env` — third-party documents stay in the repository, not the tarball. `README.md`, `LICENSE`, and `package.json` ship regardless. |
| `engines` | `{ "node": ">=22.0.0" }` | Matches the README Node badge and the runtimes in `docs/design.md` |
| `packageManager` | the development Bun pin | Moves only when the Bun version does, together with `@types/bun` |

## Dependencies

| Field | Should be |
|:------|:----------|
| `dependencies` | `fast-xml-parser` only — the one required dependency |
| `peerDependencies` | Each optional engine a format loads on first use (`linkedom`, `unpdf`), declared once the format that imports it exists |
| `peerDependenciesMeta` | Every peer marked `{ "optional": true }` — a consumer that parses only XML installs none of them |
| `devDependencies` | Tooling, plus a copy of each peer so the tests can load it |

A peer's range is a consumer-facing contract: widening or narrowing it is a changelog entry, and dropping support for a major a consumer may have installed is `breaking: true`.

## Scripts

`prepublishOnly` runs `bun run devcheck`, so a publish cannot skip the gate. The rest of `scripts` is documented in `CLAUDE.md`'s Running it table — keep the two in step.

## Before the first publish

- `npm view scholarly-parse` — the name is unclaimed, or already owned by the maintainer's npm account
- `bun publish --dry-run` — the tarball holds `dist/` with every subpath's `.js` and `.d.ts`, `changelog/`, `CHANGELOG.md`, `README.md`, `LICENSE`, and nothing else
- No `publishConfig` needed — an unscoped package publishes public by default
