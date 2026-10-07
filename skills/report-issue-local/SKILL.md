---
name: report-issue-local
description: >
  File a bug or feature request against cyanheads/scholarly-parse — a document that parses wrong, a parser that fails on valid input, a detection or rendering defect, a missing format, flavor, model field, or renderer option. Covers the dedup search, triage to the right format or area, the issue forms field for field, titles, labels, word budgets, and security findings in maintainer audits versus private contributor disclosures.
metadata:
  author: cyanheads
  version: "1.1"
  type: workflow
---

## When to use

- A document parses wrong — a dropped table, a leaked source tag, a missing abstract, a garbled formula
- A parser returns `{ ok: false }` or throws on a document it should read
- `detect()` names the wrong format, or misses a challenge page served in place of a paper
- The Markdown or text renderer mangles a correct `ScholarlyDocument`
- A format, flavor, model field, or renderer option is missing

Working in this repo, a doc error you can fix in the tree is a two-minute edit, not an issue — make it.

## Before filing

1. **Search existing issues.** A close match — same symptom in another format, same format with another symptom, a closed issue that may cover the new case — gets a comment instead of a new issue, unless the symptom or scope is distinct enough to track separately:

```bash
gh issue list -R cyanheads/scholarly-parse --search "<element name, error reason, or keyword>" --state all

# Assess a close match before commenting — is it already linked to a fix?
gh issue view <number> -R cyanheads/scholarly-parse --comments
gh api 'repos/cyanheads/scholarly-parse/issues/<number>/timeline' --paginate \
  --jq '.[] | select(.event=="cross-referenced") | .source.issue | "\(.repository.full_name)#\(.number) — \(.title)"'
```

2. **Reproduce on the exact document.** Record the identifier (DOI, PMC ID, arXiv ID, or a public URL to the exact file), the parser and options called, the package version, and the runtime. A parse bug without its input can't be reproduced.

3. **Read the diagnostics.** `document.diagnostics` carries the `quality` level, coded warnings, and unhandled source elements with counts — they often name the cause. On `{ ok: false }`, note the `error.reason`.

4. **Check the license.** The fix starts as a corpus fixture, and only openly licensed documents enter the corpus (`corpus/README.md`). If the document is closed access, say so; a minimal made-up input showing the same structure works too.

## Triage: where the bug lives

The title scope names it:

| Signal | Scope |
|:-------|:------|
| The `ScholarlyDocument` field is already wrong after the parse | the format: `jats`, `tei`, `latexml`, `html`, `pdf` |
| The document is right, the Markdown or text is wrong | `render` |
| Wrong format or flavor reported, or a challenge page not caught | `detect` |
| The model has no place for what the source carries | `model` (usually a feature) |
| A fixture, the corpus runner, invariants, or sampling misbehaves | `corpus` |
| The source document itself is malformed or lacks the markup | not a parser bug — check that the result says so (a warning, `partial` quality) and file only if it doesn't |
| The fault is in a dependency (`fast-xml-parser`, `linkedom`, `unpdf`) | file upstream, then file here only for the workaround, linking the upstream issue |

When genuinely ambiguous, pick the format the failing document is in and say what's uncertain.

## Security reports

A crafted document that causes unbounded memory or CPU, a crash outside the `ParseResult` contract, or active HTML or script in rendered Markdown is a security finding. When the maintainer requests an audit with GitHub issues, file actionable findings in that issue queue with `bug` and `security` labels, including the verified reproduction. Honor an explicit request for private handling. Never create a repository security advisory unless the maintainer explicitly requests one.

Outside contributor disclosures follow `.github/SECURITY.md`. Never publish a contributor's private disclosure without the maintainer's explicit approval.

## Writing well-structured issues

Terse and fact-dense. **Budget: a bug reads in ~150 words, a feature in ~250 — code, verbatim output, and logs excluded.** Every section past the form's required fields earns its place; a section you could delete without changing the fix is noise. One or two sentences per bullet.

- **Cut what dilutes the signal.** Mechanism walkthroughs (link the PR or doc instead), ceremonial framing ("This issue covers…"), conversation references ("as discussed"), restated context, kitchen-sink Additional context blocks.
- **Lead with specifics.** Name the element, field, or symptom: "`parseJats` drops `<disp-formula>` inside `<list-item>`" beats "formulas are broken." The reader knows what's wrong before the first sentence ends.
- **Link a dependency's canonical repo on first mention** when the issue involves one.
- **Use `owner/repo#N` for cross-repo references** — GitHub renders them as links; bare `#N` resolves only within this repo.
- **Add a `Related: #N` line** near the top when the issue grows from prior context, and cite each cross-reference once per body.
- **Prefer Markdown tables** for comparisons — formats, outputs, options.
- **Use `Depends on: #N`** when another issue must land first.
- **Skip collaborator sign-offs** ("Happy to open a PR", "let me know"). End at the last substantive point.

## Redact before posting

Issues are **public**. No secrets, credentials, or tokens — the corpus scripts' `.env` values (`CORPUS_CONTACT_EMAIL`, `OPENALEX_API_KEY`) included. Replace with obvious placeholders (`REDACTED`); partial masking is not redaction.

## Filing a bug

Interactive: `gh issue create -R cyanheads/scholarly-parse --template "Bug Report" --web`.

Non-interactive: the body's headings are the Bug Report form's fields, in order. All but Additional context are required. **Source format** takes one of the form's options, which map to title scopes:

| Source format (form option) | Title scope |
|:---|:---|
| JATS XML | `jats` |
| Grobid TEI | `tei` |
| arXiv / LaTeXML HTML | `latexml` |
| Publisher HTML | `html` |
| PDF | `pdf` |
| Format detection | `detect` |
| Markdown / text rendering | `render` |

**Runtime** is one of `Bun`, `Node.js`, `Cloudflare Workers`, `Other`. **Description** is two or three sentences. **Actual output** is the relevant slice of the Markdown or the document field, verbatim, in a `markdown` fence (the form renders it as one). Add **Additional context** only when it changes the fix — a workaround, a related issue, the one detail that matters.

````bash
gh issue create -R cyanheads/scholarly-parse \
  --title "bug(jats): concise description" \
  --label "bug" \
  --assignee cyanheads \
  --body "$(cat <<'ISSUE'
### scholarly-parse version

0.x.y

### Source format

JATS XML

### Runtime

Bun

### Document

PMC0000000

### Description

What happened and what you expected instead.

### Actual output

```markdown
The verbatim slice of the output
```

### Expected output

What the output should have been.
ISSUE
)"
````

A bug with no source document — the corpus runner, a script under `scripts/` — has no form option to match: file it without the form fields, as a title, the `bug` label, a two-sentence description, and the exact command that fails.

## Filing a feature request

Interactive: `gh issue create -R cyanheads/scholarly-parse --template "Feature Request" --web`.

Non-interactive: the headings are the Feature Request form's fields, in order — **Use case** and **Proposed behavior** are required, **Alternatives considered** is optional. Nothing else by default: a `Scope`, `Design`, or `Depends on` block is added only when the reader cannot act without it, and stays to a few lines.

````bash
gh issue create -R cyanheads/scholarly-parse \
  --title "feat(render): concise description" \
  --label "enhancement" \
  --assignee cyanheads \
  --body "$(cat <<'ISSUE'
### Use case

One or two sentences: what you're parsing and what's missing.

### Proposed behavior

What the parser or renderer should do. Link an example document (DOI, arXiv ID, or URL) when there is one. For API or model changes, show the new shape:

```ts
// the new option, export, or model field
```

### Alternatives considered

What you tried or evaluated instead, and why it didn't fit.
ISSUE
)"
````

## Title conventions

Format: `type(scope): description`

- **type:** `bug`, `feat`, `docs`, `chore`
- **scope:** `jats`, `tei`, `latexml`, `html`, `pdf`, `detect`, `render`, `model`, `corpus`

Examples:

- `bug(pdf): two-column references merge into one entry`
- `feat(model): keep the funding statement from the front matter`
- `docs(corpus): meta.json example omits derivedFrom`

## Labels

Every issue gets exactly one primary label and the `cyanheads` assignee — the forms apply both, and the CLI must pass `--label` and `--assignee cyanheads` itself.

**Primary (one):**

| Label | When |
|:------|:-----|
| `bug` | Something broken |
| `enhancement` | A new format, flavor, model field, option, or improvement |
| `documentation` | Documentation wrong, missing, or misleading, and not fixed on the spot |

**Secondary (stack on top when they apply)** — the forms list these:

| Label | When |
|:------|:-----|
| `regression` | Worked before, broken after an update |
| `performance` | Memory, CPU, or latency |
| `security` | A security defect or hardening against crafted input; disclosure routing follows § Security reports |
| `breaking-change` | The fix or feature changes the public API or model |
| `surplus-token-idea` | Worth exploring when time allows |

Combine with repeated flags: `--label "bug" --label "regression"`. If a secondary label doesn't exist yet (`label not found`), create it once:

```bash
gh label create regression --color e99695 --description "Worked before, broken after an update" -R cyanheads/scholarly-parse
gh label create performance --color 5319e7 --description "Memory, CPU, or latency" -R cyanheads/scholarly-parse
gh label create security --color b60205 --description "Hardening against crafted input" -R cyanheads/scholarly-parse
gh label create breaking-change --color d93f0b --description "Changes the public API or model" -R cyanheads/scholarly-parse
gh label create surplus-token-idea --color FF10F0 --description "Worth exploring when time allows" -R cyanheads/scholarly-parse
```

## Attaching large output

`--body-file` replaces the entire body — it does not add to `--body`. File the structured issue first, then attach the full output as a comment:

```bash
gh issue comment <number> -R cyanheads/scholarly-parse --body-file <scratch>/full-output.md
```

## Following up

```bash
gh issue view <number> -R cyanheads/scholarly-parse --comments
gh issue comment <number> -R cyanheads/scholarly-parse --body-file <scratch>/findings.md
gh issue list -R cyanheads/scholarly-parse --author @me
```

Closing is a deliberate step after the fix ships, with a comment naming the release: `gh issue close <number> --reason completed --comment "Fixed in <version>"`.

## Checklist

- [ ] Searched existing issues — no duplicate; close matches commented instead
- [ ] Reproduced on the exact document; version, runtime, parser, and `diagnostics` noted
- [ ] Triaged to a format or area; dependency faults filed upstream
- [ ] Security findings filed in the maintainer's requested queue; private contributor disclosures protected; no unrequested advisory
- [ ] Secrets redacted
- [ ] Title is `type(scope): description` with a scope from the list
- [ ] One primary label, `--assignee cyanheads`
- [ ] Bug: every required Bug Report field present, in form order — version, source format, runtime, document, description, actual output, expected output
- [ ] Feature: `Use case` and `Proposed behavior` present, `Alternatives considered` third when used
- [ ] Inside the budget — ~150 words for a bug, ~250 for a feature, code and verbatim output excluded
