---
name: git-wrapup
description: >
  Land working-tree changes as a release of scholarly-parse — a stack of logical commits on a `release/<version>` branch, the work grouped by concern and topped by `chore(release): <version> — <theme>` (version bump, changelog entry, regenerated artifacts) — then push the branch and open the release PR. Stops at "PR open": no tag, no merge, no publish. `release-pr-review` reviews the PR next, then `release-and-publish` merges, tags, and ships.
metadata:
  author: cyanheads
  version: "1.0"
  type: workflow
---

## When to use

Working-tree or staged changes are ready to ship as a new version of `scholarly-parse`. This skill lands them as a stack of logical commits on a release branch and opens the release PR. It does NOT tag, merge, push `main`, or publish — `release-and-publish` does all four.

Common triggers:

- A parse fix, a new format, or a dependency update is done, with its fixtures and tests
- A maintenance, polish, or security pass left changes in the working tree
- The caller says "wrap up", "commit this", or "cut a release"

Before the first release ships, CLAUDE.md's commit stance allows plain commits to `main` outside this flow. This skill is the release path.

## Release flow

This repo releases in `gated` mode (CLAUDE.md § Publishing). Each of the three runs is separate, and the PR is checked between them:

| Run | Skill | Ends at |
|:--|:--|:--|
| 1 | `git-wrapup` (this skill) | commit stack on `release/<version>`, branch pushed, PR open |
| 2 | `release-pr-review` (Opus) | review fixes committed and pushed, one summary comment on the PR |
| 3 | `release-and-publish` | `main` fast-forwarded, tag pushed, npm publish on the maintainer's word, GitHub release |

The branch is created at wrapup time, never before — its name carries the version, so it cannot exist until step 2 has settled one. The moment that number is known, the uncommitted tree moves to `release/<version>`, and every commit in the run lands there. **No commit in this flow reaches `main` directly, including the first one:** a stack committed on `main` and then branched is a rewrite to undo, and once it is pushed there is no undo, because force-push is banned.

## Pre-wrapup gate checklist

Every item must be true before starting. Committing means releasing — a commit happens when the work is ready to ship, not when the edits are done.

- [ ] **Changes exist** — uncommitted files, or commits since the last tag
- [ ] **Work is complete** — no half-finished parser, no "I'll add the fixture later", no TODO placeholders. The diff is a shippable unit.
- [ ] **Code simplified** — if the diff spans more than ~50 changed lines or touches 3+ source files, `skills/code-simplifier/SKILL.md` has been run across it
- [ ] **`bun run devcheck` is clean.** It runs Biome with `--error-on-warnings`, typecheck, a clean build, the full test suite (unit and corpus), the changelog and attribution checks, `publint`, `attw`, the skill-link check, and `bun audit` at high severity — so there is no separate build or test gate. A lint warning fails the step; Biome's `info`-level suggestions ("Skipped N suggested fixes") print with the step still passing and are not a block. A high or critical advisory fails the audit step, direct or transitive — triage it with `skills/maintenance/SKILL.md` § Advisory triage. Pre-existing failures in untouched code count: fix them behavior-preserving, or get the maintainer's explicit waiver in their own words. When the correct fix crosses a minor bump, the version yields, not the gate. Never force the gate green — no `overrides` pin in place of triage, no `biome-ignore` or rule change to silence a lint, no skipped test, no blessed snapshot. Read the output raw: Biome auto-fixes formatting as it runs, and filtering hides what it changed.
- [ ] **Bug fixes start as fixtures** — each fix is reproduced in `corpus/` (or a unit test when no openly licensed document shows it), seen failing, then fixed
- [ ] **Snapshots reviewed** — every `expected.md` diff read, and kept only where it is an improvement. `bun run corpus:snapshot` rewrites them; it never blesses them.
- [ ] **Fixtures are clean** — openly licensed per `corpus/README.md`, sources byte-for-byte, `corpus/ATTRIBUTION.md` regenerated
- [ ] **No known regressions**
- [ ] **GH issues updated** — each issue this work addresses has a comment saying what landed and any follow-ups. Concise, backlinked as needed.
- [ ] **Docs updated** — surgical edits: `README.md`, `docs/design.md` when the API, model, or format table changed, `CLAUDE.md` when a rule or path changed

If any gate is red, fix it before starting. Step 7 re-runs the gate, but the work is committed by then — wrapping up a broken tree wastes the version number and turns the fix into an extra commit.

## Steps

### 1. Review the diff

```bash
git status
git describe --tags --abbrev=0             # latest tag; errors when none exists yet
git log v<latest-tag>..HEAD --oneline      # commits since it (no tag yet: git log --oneline)
git diff HEAD --stat                       # every uncommitted change, staged or not
git diff HEAD                              # the content
git ls-files --others --exclude-standard   # new files, which never appear in a diff
```

Diff against `HEAD`, not the index: plain `git diff` omits staged changes, so a group staged before wrapup began shows up only as a line in `git status`. Whatever is staged ships, and gets grouped in step 3 like everything else.

If the tree is clean and there are no commits since the last tag, halt — nothing to wrap up.

### 2. Settle the version, then create its branch

Read `version` from `package.json`. When the caller's brief pins a version, use it. Otherwise:

- **Unreleased current version.** No `v<version>` tag exists and `npm view scholarly-parse@<version> version` finds nothing → the current version has not shipped. Release at it, without a bump; its changelog entry already exists and is rewritten in step 5 to cover what ships.
- **Otherwise bump:**

| Bump | When |
|:-----|:-----|
| **patch** | Parse fixes, new fixtures, dependency updates, docs, metadata |
| **minor** | A new format or subpath, a new export or option, a new model field, a new warning code or error reason, output changes a consumer would notice |
| **major** | Removed or renamed exports or model fields, changed signatures or result shapes |

Default to **patch** unless the diff clearly warrants more. Before 1.0.0, a breaking change takes a minor bump with `breaking: true` in the changelog — 1.0.0 is the maintainer's call.

Create the branch now, before step 3 — step 3 opens by committing:

```bash
git branch --show-current                 # must print main
git switch -c release/<version>           # uncommitted work rides along
```

If `git branch --no-merged main --list 'release/*'` prints a branch, a prior release PR never merged — halt and report it rather than stacking a second release on top. A `release/*` branch already merged into `main` is a leftover: delete it with `git branch -d` and continue.

### 3. Commit the work — one commit per concern

**`git branch --show-current` must print `release/<version>` before the first `git commit`.** If it prints `main`, step 2's branch was skipped — go back. The uncommitted tree moves with you, so branching late loses nothing, but a commit already on `main` has to be unwound.

**The work is committed before the version is bumped.** A work concern can share a file with the version — a dependency refresh edits `package.json` — and the file is the atomic boundary, so whichever commit comes first takes it whole. Committing the work first leaves the version hunk (step 4) as the only thing those files carry into the release commit.

Do NOT `git add -A` into one commit. Group the tree into a handful of logical commits:

- A parse fix ships with its fixture or unit test, the regenerated `expected.md` snapshots it changed, and `corpus/ATTRIBUTION.md` when fixtures moved — the corpus suite asserts all of them, so they cannot split.
- A new format ships its parser, its fixtures, and any model additions it needs together; docs and skills are their own commit.
- A dependency refresh is its own `chore(deps)` commit carrying `package.json`, `bun.lock`, and any source change the upgrade forces.
- Unrelated changes (two separate fixes, an incidental doc edit) are separate commits. Work commits never carry the version.

Stage each group explicitly and commit it by pathspec:

```bash
git add <paths-for-this-concern>
git commit --only <paths-for-this-concern> -m "<subject>" -m "<body>"
# repeat per concern
```

**Commit by pathspec, never the bare index.** A bare `git commit` takes everything staged, so a group staged before wrapup began rides into the first concern's commit. `--only` commits the named paths and disregards the rest of the index; a pre-staged group stays staged, to be committed as its own concern or reported. Anything still staged when the release commit lands fails step 10's clean-tree check.

**The file is the atomic boundary:** never split one file's working-tree changes across commits — not with `git add -p`, not with `git apply --cached`, not by editing the file between commits. A file serving two concerns ships whole in the commit of its dominant concern; a later commit touches it again only for changes made after the first commit (the step 4 version bump).

**Every commit builds and passes its tests on its own.** When a concern changes a contract — a model type in `src/model/document.ts`, a shared helper in `src/xml/`, a renderer's output — the files that consume it and their tests ride in the same commit. Check each work commit's tree before pushing: extract it with `git archive <sha> | tar -x -C <scratch>` (never `git stash`), symlink `node_modules` into it, run `bun run test` there, and merge groups whose snapshot fails.

**A dependency bump lands before the commits that use it.** When a later commit uses something the new versions introduce, `chore(deps)` is the first work commit, so every commit above it compiles against the versions it was written for.

**Subject:** Conventional Commits, no version, the scope a format or area — `jats`, `tei`, `latexml`, `html`, `pdf`, `detect`, `render`, `model`, `corpus`, plus `deps` and `skills`:

```
fix(jats): keep display formulas inside list items
feat(tei): read the lowercase <tei> wrapper
test(corpus): add a structured-abstract fixture
docs: document toSections output
chore(deps): refresh dev dependencies
```

**Body: every commit has one, and it is one or two lines.** Uniform across the stack — none subject-only, none a paragraph. One sentence stating the why or the load-bearing constraint; a second only when the first cannot carry it.

```
fix(jats): keep display formulas inside list items

The list walker read only <p> children and dropped <disp-formula>.
```

A body is too long the moment it enumerates files or symbols touched (that is `git show --stat`), walks through the implementation (that is the code), narrates a fix's mechanism across sentences (that is the changelog), or runs to a second paragraph.

**Never put a closing keyword in a commit.** `Fixes #N`, `Closes #N`, `Resolves #N` close the issue when the commit reaches `main`, before the close-out comment lands. Reference issues as bare `(#N)` backlinks.

**Rules:**

- Plain `-m` flags only — no heredoc, no command substitution
- No `Co-authored-by` or `Generated with` trailers
- No marketing adjectives ("comprehensive", "robust", "enhanced", "seamless", "improved")
- Each message stands alone for someone reading `git log` — no chat context, option numbers, or "as discussed"

**Right-size it.** A single-concern change is one work commit with the release commit on top. Only when the version bump is the whole change (a republish, a metadata-only patch) is there no work commit. The failure to prevent is the inverse: a multi-concern change crammed into one commit beside the release artifacts.

When every concern is committed, `git status` is clean — confirm it before step 4, so everything steps 4–6 touch is a release artifact.

### 4. Bump the version

Skip on an unreleased current version (step 2). Otherwise:

- `package.json` — `version`
- `README.md` — the Version badge, `Version-<x.y.z>-` (shields.io escapes a literal `-` as `--`, so a prerelease reads `Version-0.2.0--rc.1-`). `devcheck` does not check the badge.

Nothing else carries the version. Catch stragglers with the old version string:

```bash
grep -rnF "<old-version>" . --exclude-dir={node_modules,.git,dist,changelog,corpus} --exclude={CHANGELOG.md,bun.lock}
```

Resolve hits case by case — milestone references (the plan in `docs/design.md`, the commit stance in `CLAUDE.md`) are correct as they stand.

### 5. Author the changelog

Create `changelog/<major.minor>.x/<version>.md` (on an unreleased current version, rewrite the existing file). Use `changelog/template.md` as the format reference — never edit, rename, or move it.

```yaml
---
summary: "<one-line headline, ≤350 chars, no markdown>"
breaking: false    # true when consumers must change code to upgrade
security: false    # true ONLY for a security fix in this package's own source
---
```

H1 is `# <version> — YYYY-MM-DD`, with a concrete date — never `[Unreleased]`.

**Write `summary:` last, derived from the body — never independently.** `changelog:build` copies it into the `CHANGELOG.md` rollup that ships in the npm tarball, and it opens the PR body. Written from recollection, it names a mechanism that was never built while the body beside it stays correct. Re-read the body and confirm every claim in the summary appears there. It is one headline — comma-stitching every change into an inventory near the cap is the failure mode.

**`breaking: true`** when a consumer must change code: a model field renamed or removed (CLAUDE.md: the model is the contract), an export removed or renamed, a signature or result shape changed.

**`security: true`** only when this release fixes a vulnerability or adds hardening in code this package ships. A dependency or transitive CVE bump is routine maintenance: record it under `## Dependencies` with the advisory ID and leave the flag `false`.

**Body:** Keep a Changelog order — Added, Changed, Deprecated, Removed, Fixed, Security — then `## Dependencies` last. Include only sections with entries. `## Dependencies` carries every arrow the release moved, one row per package, `` `pkg` ^a → ^b ``, grouped only when truly identical, with any rationale as a parenthetical on its row (`skills/maintenance/SKILL.md` produces the list).

**Tone:** terse, fact-dense. A bullet is **symbol** + what changed + at most one consumer-facing caveat; one sentence by default, two max — past ~40 words it is wrong. The linked issue carries the why and the diff the how. Cut history narration, design-rationale defense, "X unchanged" clauses, and edge-case inventories. **Verified ≠ included** — the diff-is-truth rule bounds what you may claim, never how much you write. Model length on the authoring guide in `changelog/template.md`, never on the previous entry. `agent-notes` carries adoption steps only.

**Re-read the entry after writing it, then sweep for harness markup:** `grep -rlF -e '</invoke>' -e '</content>' changelog/` must print nothing. A hit in an older entry is deleted in this release's commit — `changelog/` is in `package.json` `files`, so every entry ships in every tarball, and `changelog:check` cannot catch a stray trailing tag.

### 6. Regenerate derived artifacts

```bash
bun run changelog:build      # CHANGELOG.md rollup from the per-version files
bun run tree                 # docs/tree.md — changes when files were added, removed, or moved
bun run corpus:attribution   # corpus/ATTRIBUTION.md — a fixture commit already carries it, so this should be a no-op
```

All three are idempotent. Never hand-edit their outputs.

### 7. Run the gate

```bash
bun run devcheck
```

**If it fails, halt.** The work is already committed, so the fix is a new commit on top under step 3's conventions — never `git commit --amend`, rebase, reset, or any other rewrite. Land it, then re-run. The same holds when the gate passes but leaves the tree dirty: Biome's auto-fix to a file committed in step 3 is a follow-up commit of its own, not something to fold into the release commit.

Only the version bump, the changelog entry, and the regenerated artifacts may be uncommitted when this step goes green.

### 8. Commit the release artifacts

One commit on top of the work stack, carrying only what steps 4–6 produced: `package.json`, `README.md`, the changelog entry, `CHANGELOG.md`, `docs/tree.md`, and `corpus/ATTRIBUTION.md` if step 6 changed it.

```bash
git add <release-artifact-paths>
git commit --only <release-artifact-paths> -m "chore(release): <version> — <theme>" -m "<body>"
```

**The subject leads with the version:** `chore(release): 0.2.1 — structured abstracts`. Step 3's conventions carry over: pathspec staging, a one- or two-line body, no closing keywords, no trailers.

Anything else still uncommitted was made after step 3 — commit it on its own first, then the release commit on top.

### 9. Open the release PR

```bash
git push -u origin release/<version>
gh pr create --base main --head release/<version> --title "<release commit subject>" --assignee @me --body-file <scratch>/pr-body.md
```

**Title:** the release commit's subject, verbatim.

**Assignee:** `--assignee @me`, so the PR lands in the maintainer's queue. No reviewer: GitHub drops a review request aimed at the PR's author, so the review record is the summary comment `release-pr-review` leaves.

**Body — always `--body-file`, never an inline `--body`** (backticks inside a double-quoted argument are command substitution and vanish). Write the file outside the repo.

The body is the release digest: the `## Changes` bullets and changelog link the annotated tag will carry, under a theme line and above a gates record that stay on the PR. It is reviewed here and copied into the tag at release, so it is the one place the release notes are reviewed before they become permanent.

```
<theme — the changelog entry's summary: line, plain prose, one line>

## Changes

- <notable user-facing change> (#N)
- <notable user-facing change> (#N)
- <ONE compact grouped line for minor/internal changes — corpus additions, build config, metadata>
- deps: `fast-xml-parser` ^<old> → ^<new> (+ dev-dep bumps)

## Gates

- `bun run devcheck` — clean, <N> tests passed (unit + corpus)

[CHANGELOG v<version>](https://github.com/cyanheads/scholarly-parse/blob/main/changelog/<major.minor>.x/<version>.md)
```

**Rules:**

- **`## Changes` follows the tag rules exactly** (`release-and-publish` step 4): flat bullets, never Keep-a-Changelog headers; complete at headline granularity — notable changes get their own bullet, minor items share ONE grouped bullet; deps one line, naming only what earns it; no narrative, no marketing adjectives.
- **Every claim traces to the diff and to the changelog entry** — the body derives from the entry written in step 5.
- **`## Gates` is the only release surface that carries gate results.** It never enters the tag.
- **Issue references are bare `(#N)`** — never `Closes #N`; the merge would close the issue before its close-out comment.
- **The changelog link is the last line**, with a blank line above it.
- Length is earned — a theme, two bullets, gates, and the link is a complete body for a small patch.

**Halt here.** Report the PR URL, the branch, and the commit stack. Do not tag, merge, or touch `main` — `release-pr-review` and `release-and-publish` run separately.

### 10. Verify end state

```bash
git log --oneline -8                 # work commits, release commit on top
git status                           # clean
git tag --points-at HEAD             # nothing — tagging is release-and-publish's job
git branch --show-current            # release/<version>
gh pr view --json number,url,state   # OPEN
```

If the tree isn't clean or the release commit isn't at HEAD, investigate before reporting.

## Constraints

- **No push to `main`, no tag, no merge, no publish.** The only remote writes are the release-branch push and the PR
- **Never stash.** Not for quick checks, not for testing, not for any reason
- **Never destructive.** No `git reset --hard`, `git restore .`, `git clean -f`, `git checkout -- .`, no force-push
- **Bash git only**
- If `v<version>` already exists as a tag, **halt and report** the version, the tag's SHA, and HEAD's SHA. Never delete or move a tag without explicit authorization

## Checklist

- [ ] Diff reviewed end to end, untracked files included, before the first commit
- [ ] Version settled (pinned by the caller, unreleased current version, or bumped by the table); `release/<version>` created before the first commit
- [ ] Work committed before the version bump; a version-bearing file a work concern touches ships whole in that concern's commit
- [ ] Parse fixes carry their fixtures, reviewed snapshots, and attribution in the same commit
- [ ] Version bumped where declared — verify by command: `v=$(jq -r .version package.json); grep -c "Version-$v-" README.md` prints `1` (escape `-` as `--` for a prerelease)
- [ ] Changelog authored at `changelog/<major.minor>.x/<version>.md` — `summary:` last and derived from the body, `breaking`/`security` set correctly, `## Dependencies` carries every arrow; harness-markup sweep clean
- [ ] `CHANGELOG.md`, `docs/tree.md`, and `corpus/ATTRIBUTION.md` regenerated by their scripts
- [ ] `bun run devcheck` clean
- [ ] Work grouped into logical commits; release artifacts committed separately on top, subject leading with the version
- [ ] `chore(deps)` first whenever a later commit uses what the new versions introduce
- [ ] A gate failure after the work was committed landed as a new commit — nothing amended or rewritten
- [ ] Every commit carries a one- or two-line body; no closing keywords anywhere
- [ ] Branch pushed, PR open — title = release commit subject; body = theme, `## Changes` in tag rules, `## Gates`, changelog link last (via `--body-file`)
- [ ] Tree clean, no tag at HEAD, `main` untouched
