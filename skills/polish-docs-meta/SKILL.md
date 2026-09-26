---
name: polish-docs-meta
description: >
  Bring scholarly-parse's documentation and package metadata in line with the code — the library README (API by subpath, formats table, install, short usage examples, the corpus-licensing note), CLAUDE.md, docs/design.md, package.json metadata, CITATION.cff, the corpus docs, the issue forms, and the one description string shared by package.json, the README tagline, CITATION.cff, and the GitHub repo. Use before a release, after adding or changing a format, export, or model field, or when asked to polish the docs or prep the README. Safe at any stage — each step checks current state and only acts on what still needs work.
metadata:
  author: cyanheads
  version: "1.0"
  type: workflow
---

## When to use

- A format, subpath, export, model field, or renderer landed or changed
- Preparing a release, or the first publish to npm
- The caller says "polish the docs", "prep the README", "make it ship-ready", or similar

Safe to re-run at any point — every step is idempotent.

**Companion:** pair with `skills/security-pass/SKILL.md` for a full pre-release review. This skill covers docs and metadata; `security-pass` covers the parsers against hostile input.

## Prerequisites

- [ ] The code being documented is in place
- [ ] `bun run devcheck` passes

If not, address those first — documenting a surface that doesn't build documents fiction.

## Steps

### 1. Audit the surface

Build the inventory every document below is checked against. Read:

- `package.json` — `exports` (the subpaths), `dependencies`, `peerDependencies` and `peerDependenciesMeta`, `engines`, `files`, `scripts`, `description`, `keywords`
- `src/index.ts` — what the package root exports
- each `src/formats/<format>/index.ts` — that subpath's public surface
- `src/model/document.ts` and `src/model/result.ts` — the model, `ParseResult`, error reasons, `quality` levels, warning codes
- `src/detect/` and `src/render/` — detection and the renderers
- `corpus/` — which formats have fixtures, and how many

Capture: the subpaths that exist, each one's exports, which parsers are sync and which async, each format's optional peers (from its lazy imports), the required dependency, supported runtimes, and the scripts.

### 2. README.md

Read `references/readme.md` for the library README structure and conventions, then diff the current README against the audit. Update what's stale; add what's missing; don't restructure sections that are already accurate and already in the reference shape.

**Every run is also a concision pass.** A README accretes — each release adds a line and nobody removes one. Tighten what's there (`references/readme.md` § Concision). Every retained claim is checked against the code it describes.

**Only document what exists.** A subpath absent from `package.json` `exports` is not documented as usable. Planned formats belong in `docs/design.md`, not in the install or usage sections.

### 3. The description string

`package.json` `description` is the canonical source. Four surfaces carry it verbatim:

- `package.json` `description`
- the README tagline — the `<b>` text in the header's `<p>`
- `CITATION.cff` `abstract`
- the GitHub repo description

```bash
jq -r .description package.json
gh repo view cyanheads/scholarly-parse --json description -q .description
```

When it changes, write it in `package.json` first, then propagate: edit the README and `CITATION.cff`, and run `gh repo edit cyanheads/scholarly-parse --description "<description>"`.

### 4. CLAUDE.md

`AGENTS.md` is a symlink to `CLAUDE.md` — edit `CLAUDE.md` only. Check each section against the tree:

- **Architecture table** — every path exists; every `src/` directory that exists is listed with its role
- **Running it table** — matches `package.json` `scripts`: added scripts present, renamed or removed ones gone
- **Stack & gate** — the devcheck description matches the steps in `scripts/devcheck.ts`
- **Skills and Triggers tables** — match `bun run list-skills`: every listed skill exists, every skill in `skills/` is listed, each row's wording matches what the skill does now
- **The rules that matter** — each rule is still true of the code (the peers named are the peers loaded, the bounds named are the bounds checked)
- **Where things live** and **Generated files** — paths and generator scripts current

The file is behavioral: update it when the repo's shape changes, not on every commit. Keep its orientation pointer to `docs/design.md`.

### 5. docs/design.md

- **Public API block** — the imports match the real exports of each subpath
- **The model outline** — matches `src/model/document.ts`
- **Formats table** — one row per format that exists or is planned; the Quality column matches the `quality` each parser reports
- **Dependencies** — the required dependency and optional peers match `package.json`
- **Decisions** — a shipped change that settled a design question gets an entry: the decision plus a one- or two-sentence why. Never delete a decision; add one that supersedes it.
- **The plan** — its steps reflect what has landed. Once the release it plans has shipped, the section is history: surface whether to cut it rather than deleting it on your own.

### 6. package.json metadata

Read `references/package-meta.md` for each field's expected value, then fill in or correct what's missing — skip fields that are already right. The name stays `scholarly-parse`, unscoped, on every surface.

### 7. GitHub repository metadata

Description: step 3.

**Topics ↔ keywords:** compare `gh repo view cyanheads/scholarly-parse --json repositoryTopics` against `package.json` `keywords`. They should be the union — add what's missing on either side:

- Missing from GitHub → `gh repo edit cyanheads/scholarly-parse --add-topic <topic>`
- Missing from `package.json` → add to `keywords`

### 8. CITATION.cff and LICENSE

- `CITATION.cff` — `title` is `scholarly-parse`, `abstract` is the description (step 3), `repository-code` is `https://github.com/cyanheads/scholarly-parse`, `license` matches `package.json`, `keywords` stay current with the formats
- `LICENSE` — present, and matches `package.json` `license` (Apache-2.0)

### 9. Corpus docs

- `corpus/README.md` — the layout, the `meta.json` example, and the fixture-ID convention match what the fixtures and `tests/corpus/` actually use; the `features` pointer names the real vocabulary file
- `corpus/ATTRIBUTION.md` — regenerated with `bun run corpus:attribution`, never hand-edited

### 10. .github

- `.github/ISSUE_TEMPLATE/bug_report.yml` — the **Source format** dropdown has one option per format that exists, plus detection and rendering; the **Runtime** options match the supported runtimes
- `.github/ISSUE_TEMPLATE/feature_request.yml` — its description names the kinds of requests the repo takes
- `.github/CONTRIBUTING.md` and `.github/SECURITY.md` — links resolve; the security scope still describes what a crafted document can do
- `skills/report-issue-local/SKILL.md` — its form mapping matches the templates; if a template changed, update the skill in the same pass

### 11. bunfig.toml

Present, with `[install] minimumReleaseAge` (never lowered) and the `[install.security]` scanner. Don't add settings here as polish.

### 12. Changelog

Directory-based: per-version files at `changelog/<major.minor>.x/<version>.md`, `CHANGELOG.md` regenerated by `bun run changelog:build`, drift caught by devcheck's changelog step.

- `changelog/template.md` is a pristine format reference — never edited, moved, or renamed
- Every per-version file has `summary`, `breaking`, and `security` frontmatter and an H1 `# <version> — YYYY-MM-DD` with a concrete date — never `[Unreleased]`
- Never hand-edit `CHANGELOG.md`

### 13. docs/tree.md

```bash
bun run tree
```

Review the output for anything unexpected — leftover files, missing directories.

### 14. Final verification

```bash
bun run devcheck
```

Must pass clean. Leave the changes uncommitted for `git-wrapup` unless the caller says otherwise.

## Checklist

- [ ] Surface audited — subpaths, exports, peers, runtimes, scripts
- [ ] `README.md` accurate and in the `references/readme.md` shape — API by subpath, formats table, install with peers, short usage examples, pointer to `docs/design.md`, corpus-licensing note
- [ ] `README.md` concise — every retained claim verified against the code; nothing documented that isn't exported
- [ ] Description identical in `package.json`, the README tagline, `CITATION.cff` `abstract`, and the GitHub repo
- [ ] `CLAUDE.md` accurate — architecture, scripts, gate, skills, triggers, rules
- [ ] `docs/design.md` accurate — API block, model outline, formats table, dependencies; new decisions recorded
- [ ] `package.json` metadata complete per `references/package-meta.md`; name unscoped
- [ ] GitHub topics ↔ `keywords` in sync
- [ ] `CITATION.cff` and `LICENSE` in sync with `package.json`
- [ ] `corpus/README.md` accurate; `corpus/ATTRIBUTION.md` regenerated
- [ ] Issue forms, CONTRIBUTING, SECURITY, and `report-issue-local` consistent
- [ ] `bunfig.toml` guard and scanner intact
- [ ] Changelog structure intact; `CHANGELOG.md` in sync
- [ ] `docs/tree.md` regenerated
- [ ] `bun run devcheck` passes
