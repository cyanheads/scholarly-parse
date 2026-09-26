---
name: corpus-sampling
description: >
  Run a wild-sampling round for scholarly-parse with `scripts/corpus/sample.ts`: draw fresh openly licensed documents from Europe PMC (JATS), arXiv (LaTeXML), and OpenAlex (Grobid TEI), parse each, check the corpus invariants, and read the report of failure classes. Then triage every class against the source, turn each real one into a fixture and a fix through the add-fixture skill, and repeat with new seeds until a round finds no new class. Use when asked to sample, run the wild sampling, find new failures, or measure how a format holds up on documents outside the corpus.
metadata:
  author: cyanheads
  version: "1.0"
  type: workflow
---

## Context

The corpus only proves the parsers on documents already in it. Wild sampling (`docs/design.md` § Quality engine, layer 5) runs them on documents nobody picked: each round draws at random, and every failure class it finds becomes a fixture. Rounds for a format continue until one finds no new class.

`sample.ts` writes nothing to the corpus. It prints a Markdown report to stdout and progress to stderr, and `--json <file>` also saves every outcome.

| Source | Draws | Format | Needs |
|:---|:---|:---|:---|
| `epmc` | CC BY open-access articles from random publication days in the three years before last month, a few per day | JATS | nothing |
| `arxiv` | Papers from random submission days since arXiv began rendering HTML (December 2023), a few per day | LaTeXML | nothing; one request per 3 s, so 30 papers take about four minutes |
| `openalex` | OpenAlex's own random sample of CC BY works with cached Grobid output | TEI | `OPENALEX_API_KEY` in `.env`; each TEI download costs $0.01 of the key's daily budget |

Publisher HTML and PDF have no source in `sample.ts`.

## When to use

- Asked to sample, run the wild sampling, or find new failures
- After a parser change large enough that the corpus alone is not convincing
- Before a release, to show each sampled format holding up on unseen documents

## Inputs

1. **Sources** — `epmc`, `arxiv`, `openalex`, or a mix. Without a key, leave `openalex` out; the script skips it with a note otherwise.
2. **Count** — documents per source (default 20). 25–30 per source is a useful round.
3. **Seed** — a fresh one for a new round; a previous round's seed to repeat its draws.

## Steps

### 1. Run a round

```bash
bun run corpus:sample --source epmc,arxiv --count 30 --seed <N> --json <scratch>/sample-<N>.json > <scratch>/sample-<N>.md
```

Run it in the background: it paces every request (`scripts/corpus/http.ts`) and a round takes minutes. The report and JSON belong in the session scratchpad, not the repo. The seed repeats the random choices, but upstream search results can shift over time, so a repeat is close to the original draw, not guaranteed identical.

### 2. Read the report

The table at the top gives, per source: drawn, parsed, unavailable (arXiv could not render the paper, or the full text was missing), and the `structured / partial / flat` split. Below it, the failure classes, most severe first, each with its document count, publishers, and up to three examples. Examples from `epmc` and `arxiv` print as `add.ts` arguments; OpenAlex examples are work IDs.

| Class | Means | Usually |
|:---|:---|:---|
| `threw:` | The parser threw instead of returning a `ParseResult` | Always a bug: the contract is broken |
| `failed:` | A failed result (`malformed`, `wrong-format`, `empty`, …) | A bug unless the source really is broken; check it |
| `invariant:` | A `tests/corpus/invariants.ts` check broke: a leaked tag or entity, a count below the source's, an empty heading | A bug, or a false positive in the invariant itself |
| `slow:` | A parse took over 5 s | A performance bug, or an input near the size budget |
| `unhandled:` | An element reached `diagnostics.unhandled`: no handler covers it | Needs handling, or a deliberate drop that stops reporting it |
| `warning:` | A coded warning (`table-unextractable`, `no-abstract`, `math-without-tex`, …) | Often correct; confirm against the source |

### 3. Triage every class

For each class, take one example and find the cause in the parser, not in the report:

1. Fetch the example's source into the session scratchpad (the Europe PMC `fullTextXML` URL, `https://arxiv.org/html/<id>`).
2. Parse it with a throwaway script in the repo root (`.x.tmp.ts`, deleted afterwards) and locate the block, section, or text that breaks.
3. Read the source markup there. Decide:
   - **Parser bug** → step 4.
   - **Invariant false positive** (the check misreads valid output) → fix the check in `tests/corpus/invariants.ts`, then make sure the corpus still passes.
   - **Correct behavior** (a graphic-only table warned as `table-unextractable`, a conversion error in the source itself) → nothing to change; record why in step 5.

One cause often explains several classes, and one class can hide several causes. Read the new fixture's whole snapshot too (add-fixture step 4): sampling finds the first symptom, and the rest of the document often shows others.

### 4. Pin and fix

Each parser bug becomes a fixture through `skills/add-fixture/SKILL.md`, using the example's `add.ts` arguments. When `add.ts` refuses the example's license, or the example is an OpenAlex work (`add.ts` has no OpenAlex kind), pin the class with another example from the report, or with a unit test under `tests/formats/<format>/`. Then fix the parser, re-snapshot, review every snapshot diff, and run `bun run devcheck`.

### 5. Record the round and repeat

Report the round in the session summary: sources and counts, the seed, the quality split, and each class with what became of it (the fixture and fix, the invariant change, or why it is expected). Then run a new round with a new seed. A format is done when a round of 25 or more documents from its source finds no class that isn't already explained.

## Checklist

- [ ] Round run with a recorded seed; report and JSON kept outside the repo
- [ ] Every class triaged against the source: parser bug, invariant false positive, or expected
- [ ] Each parser bug pinned by a fixture (or a unit test when no example can be added) and fixed
- [ ] Every snapshot diff reviewed; `bun run devcheck` green
- [ ] Round reported with each class's outcome; next round run with a new seed until one finds nothing new
