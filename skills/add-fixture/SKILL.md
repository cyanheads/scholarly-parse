---
name: add-fixture
description: >
  Add one document to scholarly-parse's corpus: pick the smallest openly licensed document that shows the behavior, confirm its license through `scripts/corpus/add.ts` (never by hand), tag its features, snapshot and read the Markdown against the source, and write `expect.json` assertions reconciled against the source's own counts. Use when a paper parses wrong (a bug fix starts as a fixture), when a wild-sampling failure class needs pinning, when a consumer's parsing bug becomes a regression fixture, or when asked to add a paper to the corpus.
metadata:
  author: cyanheads
  version: "1.1"
  type: workflow
---

## Context

The corpus (`corpus/<format>/<fixture-id>/`) is what the parsers are tested against: every fixture runs through its parser on every `bun run test`, checked against the invariants in `tests/corpus/invariants.ts`, its own `expect.json`, and a reviewed `expected.md` snapshot. `corpus/README.md` holds the layout, the `meta.json` shape, and the rules — read it first. The rules that bind here:

- **Openly licensed only**, confirmed from the document's own metadata. `add.ts` does the confirming; a refusal is final.
- **Byte-for-byte.** `source.*` is never edited, reformatted, trimmed, or re-encoded.
- **Snapshots are reviewed, never blessed.** A snapshot is a claim that the Markdown is right.

## When to use

- A document parses wrong: the fix starts here, before any parser change
- A `corpus-sampling` report found a failure class worth keeping
- A consumer repo's parsing bug becomes a named regression fixture
- A feature in `tests/corpus/features.ts` has no fixture for a format

When no openly licensed document shows the behavior, write a unit test with synthetic markup under `tests/formats/<format>/` instead, and stop here.

## Inputs

1. **The document** — its `add.ts` kind and identifier (a PMCID, an arXiv ID with version, a URL with its DOI)
2. **Why** — the bug, sampling class, or feature it pins
3. **Regression reference** — `cyanheads/<repo>#N`, only when an issue records the bug

## Steps

### 1. Choose the document

Prefer the smallest document that shows the behavior: a few hundred kilobytes over several megabytes (the hard cap is 8 MB, enforced by `tests/corpus/meta.test.ts`). Check it is not already in the corpus:

```bash
rg -l '<identifier>' corpus/*/*/meta.json
```

### 2. Confirm the license

```bash
bun run scripts/corpus/add.ts <kind> <identifier> --dry-run
```

| Kind | Reads | Lands in |
|:---|:---|:---|
| `epmc <PMCID\|PPRID>` | Europe PMC `fullTextXML` | `jats/`, flavor `europepmc` |
| `pmc <PMCID>` | NCBI E-utilities `efetch db=pmc` | `jats/`, flavor `pmc` |
| `arxiv <id-with-version>` | `arxiv.org/html/<id>` | `latexml/`, flavor `arxiv` |
| `ar5iv <id>` | `ar5iv.labs.arxiv.org/html/<id>` | `latexml/`, flavor `ar5iv` |
| `pdf <url> --doi <doi>` | a publisher PDF (`--arxiv <id>` for an arXiv PDF) | `pdf/` |
| `html <url> --doi <doi>` | a publisher article page | `html/` |
| `grobid <pdf-fixture-id>` | an existing PDF fixture through a local Grobid | `tei/`, with `derivedFrom` |

The script's header says where each kind's license comes from. An arXiv license covers the paper's current version only: for an older version, check that version's abstract page before adding it. A license outside the allowlist (`OPEN_LICENSES` in `tests/corpus/fixtures.ts`: CC BY, CC BY-SA, CC0, public domain) exits non-zero. Never work around a refusal by writing `meta.json` or copying a source in by hand: pick another document or fall back to a unit test.

### 3. Add it

```bash
bun run scripts/corpus/add.ts <kind> <identifier> --features a,b [--regression cyanheads/<repo>#N] [--notes "…"]
```

- `--features` takes tags from `tests/corpus/features.ts`, naming what the document exercises (not everything it contains). A genuinely new tag goes into that file first.
- `--regression` only for a fixture that reproduces a recorded bug.

The script writes `source.*` and `meta.json`, then regenerates `corpus/ATTRIBUTION.md`. To change the tags afterwards, edit `meta.json` directly; its key order follows `corpus/README.md`.

### 4. Snapshot and read it

```bash
bun run corpus:snapshot
```

This writes the new fixture's `expected.md` and rewrites any other snapshot the current code changes. Read the new snapshot in full beside the source, looking for what the invariants cannot see:

- Section headings: every source section present, nested at the source's depth, none invented
- Figures, tables, and formulas: each where the source places it, captions and labels kept (a bare `**Table.**` or a missing `(a)` panel caption is a loss)
- Inline text: no raw `<tag>` or `&entity;`, links as links, math as `$…$`
- References and footnotes: complete, not duplicated into the body
- Front matter: title, authors, abstract kinds

When the fixture pins a bug, the snapshot shows the bug first. Fix the parser, re-snapshot, and read the diff: it should show the fix and nothing else. Every other rewritten `expected.md` needs the same read (`git diff corpus/`); keep only improvements.

### 5. Write `expect.json`

The schema is `fixtureExpectSchema` in `tests/corpus/expect.ts`. The fields:

| Field | Asserts |
|:---|:---|
| `why` | Not an assertion: why the fixture exists, and every place a count below differs from the source's own count |
| `title`, `quality`, `abstractKinds`, `abstractStartsWith` | Front matter and the parse quality |
| `sectionTitles` | Titles that appear in this order among all sections (abstract parts, then body, then back, depth-first); others may sit between |
| `tables`, `figures`, `formulas`, `references` | Block counts wherever the blocks sit (floats and boxes included), and the reference count |
| `referenceIdentifiers` | How many references carry each of `arxiv`, `doi`, `pmcid`, `pmid` (fields the Markdown does not show) |
| `contains`, `notContains` | Substrings of the rendered Markdown |
| `warnings` | Warning codes that must be reported |

- **Count from the source, not the parse.** Count `<table-wrap>`, `ltx_tabular`, `<figure>`, `<ref>` in the source, then explain each difference from the parsed count in `why` (a rule-only spacer tabular, a float that holds only a table). An unexplained difference is a bug to investigate, not a number to copy.
- **Pin the bug itself** in `contains` or `notContains`, so a regression fails an assertion and not only the snapshot.
- **Layout:** `corpus/` sits outside Biome, so format by hand to match the other fixtures: two-space indent, an array on one line when it fits in 100 columns, non-ASCII invisibles escaped (`­`).

### 6. Verify

```bash
bun run test:corpus
bun run devcheck
```

For a bug fix, confirm the new assertion fails without the fix. The fixture, its snapshot, the parser fix, and the rewritten snapshots it causes ship in one commit.

## Checklist

- [ ] Smallest document that shows the behavior; not already in the corpus
- [ ] License confirmed by `add.ts`; nothing written around a refusal
- [ ] `features` from the vocabulary; `regression` only with a recorded issue
- [ ] New `expected.md` read in full against the source; every other snapshot diff reviewed
- [ ] `expect.json` counts reconciled against the source in `why`; the bug pinned in `contains`/`notContains`
- [ ] `source.*` untouched; `corpus/ATTRIBUTION.md` regenerated
- [ ] `bun run devcheck` green
