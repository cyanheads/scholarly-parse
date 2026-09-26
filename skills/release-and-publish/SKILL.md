---
name: release-and-publish
description: >
  Ship a reviewed scholarly-parse release. Runs the gate, fast-forwards `main` to the reviewed `release/<version>` branch, creates the annotated tag, pushes `main` and the tag, then stops and asks the maintainer before publishing to npm — `bun publish` runs only on their explicit word — and creates the GitHub Release with `bun run release:github`. Assumes `git-wrapup` and the `release-pr-review` pass are done. Retries transient network failures; halts with a partial-state report otherwise, and resumes cleanly on re-invocation.
metadata:
  author: cyanheads
  version: "1.0"
  type: workflow
---

## Preconditions

This skill runs **after** `git-wrapup` and `release-pr-review`. By the time it's invoked:

- Pre-wrapup work is done (`security-pass`, `polish-docs-meta` as applicable)
- `package.json` `version`, the README badge, `changelog/<major.minor>.x/<version>.md`, `CHANGELOG.md`, and `docs/tree.md` are in sync
- The release commit (`chore(release): <version> — <theme>`) is in the stack on `release/<version>`, with only the review pass's commits above it
- The branch is pushed, the PR is open, and the caller has confirmed the review pass is finished. Without that confirmation, halt — this skill never decides on its own that a review is done.
- No tag `v<version>` exists yet — this skill creates it (step 4)
- The working tree is clean

If any are missing, halt and say what's unfinished. Never redo wrapup work from inside this skill.

**Resuming.** A run that stopped at step 6 (the maintainer deferred the publish) or halted after step 5 is resumed, not restarted. After `git fetch origin --tags`: when `v<version>` exists on origin, `git log v<version> --format=%s` includes `chore(release): <version>`, and `git merge-base --is-ancestor v<version> origin/main` succeeds, steps 1–5 are done — continue at step 6. Destinations that already received the release hit their idempotent-success signal and skip.

## Failure protocol

Steps 5–7 are network-bound. For those, **retry transient failures up to 2 times** with short backoff (~5 s, then ~15 s) before halting. Every other step halts on the first non-zero exit — it is deterministic, and a second attempt won't change the outcome.

### Retry on transient patterns

Match stderr, case-insensitive:

- `integrity check failed` / `IntegrityCheckFailed`
- `ECONNRESET` / `EAI_AGAIN` / `ETIMEDOUT` / `ENOTFOUND`
- `connection reset` / `connection refused`
- `timed out` / `request timeout`
- HTTP `502` / `503` / `504`

### Never retry on idempotent-success signals

These mean the step already succeeded — treat as success and continue:

- npm (`bun publish`): `version already exists`, `You cannot publish over the previously published versions`
- Tag (`git tag -a`): `already exists` with the tag pointing at HEAD. A tag pointing elsewhere is a conflict (step 4)
- GitHub Release: `bun run release:github` handles `release already exists` itself by repairing the title

### Halt fallback

When retries are exhausted or the failure matches no transient pattern, halt and report:

1. Which step failed
2. The exact error output
3. Retries attempted (0 for terminal errors, 2 for exhausted retries)
4. The partial state: `main` pushed? tag pushed? PR merged and branch deleted? npm published? GitHub Release created?

The maintainer fixes it locally and re-invokes; see **Resuming**.

## Steps

### 1. Sanity-check the wrapup outputs

Read `version` from `package.json`, then verify:

- **Working tree is clean**
- **Current branch** is `release/<version>`. Anything else, halt.
- **The release commit is in the stack** — `git log main..HEAD --format=%s` contains `chore(release): <version>`, with only review commits above it. Any other commit above it — new work, a second version — is a halt.
- **The PR matches** — `gh pr view --json number,state,headRefOid` shows `OPEN` with `headRefOid` equal to `git rev-parse HEAD`. A mismatch means the branch and PR disagree — halt and report both SHAs. Keep `number` and `headRefOid`: steps 3 and 4 need them after the checkout moves to `main`.

### 2. Run the gate

```bash
bun run devcheck
```

It builds from clean and runs the full suite, unit and corpus, along with `publint` and `attw`. Any failure → halt with its output.

### 3. Merge the release branch

```bash
git switch main
git merge --ff-only release/<version>
git rev-parse HEAD                      # must equal the PR's headRefOid from step 1
```

**Fast-forward only, locally — then tag (step 4) and push (step 5).** The stack lands on `main` byte-identical: same SHAs, same signatures, release commit (or its review commits) at the tip. GitHub marks the PR merged once its head commit is reachable from `main`. Never merge through the GitHub UI or `gh pr merge`: squash destroys the stack, rebase-and-merge rewrites every SHA, a merge commit breaks linear history.

If `--ff-only` refuses, `main` moved underneath the release branch. Halt and report — nothing has been created yet, and rebasing would change the SHAs the review approved, so that call belongs to the maintainer. A `rev-parse` that disagrees with `headRefOid` is the same halt.

### 4. Create the annotated tag

The tag goes on HEAD — `main`'s tip after step 3, the commit the PR's `headRefOid` names.

```bash
cat > <scratch>/tag-v<version>.md <<'TAG'
<tag message>
TAG
git tag -a v<version> --cleanup=whitespace -F <scratch>/tag-v<version>.md
```

If `v<version>` exists and points at HEAD, a prior run created it — continue. If it points anywhere else, **halt and report** the version, the tag's SHA, and HEAD. Never delete or move a tag without explicit authorization.

Write the message through a quoted-delimiter heredoc and pass it with `-F`, never `-m`: the body carries backticks, which a double-quoted string runs as command substitution, and apostrophes, which end a single-quoted one. The message renders as the GitHub Release body via `--notes-from-tag`.

**The body is the PR body's `## Changes` bullets plus its final changelog link, verbatim** — `gh pr view <N> --json body -q .body` (`<N>` from step 1; on `main` there is no branch for `gh` to infer it from). Take the bullets under `## Changes` and the last line; drop the theme line, `## Gates`, and the headers. That digest was reviewed on the PR, and re-authoring it would publish unreviewed words. Append ` · release PR #<N>` to the final line so the Release links its audit trail.

`--cleanup=whitespace` is load-bearing: the default `strip` deletes `#`-leading lines as comments, and `verbatim` skips end-of-message normalization, so under tag signing the signature lands flush against the last line, fails to parse, and publishes into the Release body.

Format — a **headline digest**, never a changelog mirror:

```
<subject — one short theme written for this tag, ~60 chars, no version>

- <notable user-facing change> (#N)
- <notable user-facing change> (#N)
- <ONE compact grouped line for minor/internal changes — corpus additions, build config, metadata>
- deps: `fast-xml-parser` ^<old> → ^<new> (+ dev-dep bumps)

[CHANGELOG v<version>](https://github.com/cyanheads/scholarly-parse/blob/main/changelog/<major.minor>.x/<version>.md) · release PR #<N>
```

**Rules:**

- **Subject is ONE short theme, at most ~60 characters, no semicolons, no clauses** — it becomes the Release title after `v<version>: `. The digest lives in the bullets; a subject that summarizes each change is wrong even when accurate. **Written for this tag, never lifted** — not from the changelog `summary:` (a 350-character budget for another surface) and not from the PR's theme line. The release commit's subject after the version and dash is usually the theme already.
- **No version in the subject** — `release:github` titles the Release `v<version>: <subject>`
- **Flat bullets only** — no `Added:`/`Fixed:` headers; those belong in the changelog file
- **Complete at headline granularity** — notable changes get their own bullet; minor/internal items share ONE grouped bullet. Nothing silently dropped, nothing expanded.
- **Deps: one line max**, naming only what earns it (`fast-xml-parser`, a major); per-package arrows live in the changelog
- **No gates line**, no narrative preamble, no marketing adjectives
- **Issue backlinks** as `(#N)` in the relevant bullets
- **Changelog link is the final line**, with a blank line above it

Verify:

```bash
git show v<version> --stat | head -20   # tag points at HEAD
git tag -l v<version> --format='%(if)%(contents:signature)%(then)signed%(else)unsigned%(end)'   # "signed" when tag signing is on
```

`unsigned` under enabled tag signing means the signature didn't parse — delete and recreate the tag now, before it leaks into the Release body. This is the one tag deletion that needs no authorization: the tag is local, seconds old, and yours.

### 5. Push to origin

```bash
git push origin main
git push origin v<version>
```

`main` first, then the tag. If the remote rejects either, halt.

After both pushes, confirm `gh pr view <N> --json state` reports `MERGED`, then delete the branch — `git push origin --delete release/<version>` and `git branch -d release/<version>`. `CLOSED` or `OPEN` means the pushed `main` doesn't contain the PR's head — stop and report before publishing anything.

### 6. Publish to npm — the maintainer's word only

If `npm view scholarly-parse@<version> version` already prints the version (a resumed run), the publish is done — skip to step 7.

**Stop and ask before publishing.** First show what would ship:

```bash
bun publish --dry-run
```

The tarball must hold `dist/`, `changelog/`, `CHANGELOG.md`, `package.json`, `README.md`, and `LICENSE` — and nothing from `corpus/`, `tests/`, `scripts/`, or `.env`. A wrong file list is a halt: fix it through a patch release, not by hand.

Then report the state and ask: `main` and `v<version>` are pushed, the PR is merged, and `scholarly-parse@<version>` is ready — publish it to npm? Include the dry run's file count and size.

Run the publish only when the maintainer has said, for this version, to publish it. A general "ship it", a pipeline-level release mandate, or a caller's brief that doesn't carry that go-ahead is not it. When the answer is no or later, stop here: nothing needs undoing — the tag and `main` are correct — and the run resumes at this step (see **Resuming**). Step 7 waits for the publish, so the GitHub Release never announces a version npm doesn't serve.

On the word:

```bash
bun publish
```

The package is unscoped, so it publishes public by default — never add a scope or an `--access` override to "fix" anything. `prepublishOnly` re-runs `bun run devcheck` before packing. `bun publish` uses the npm auth in `~/.npmrc`; with 2FA on, it prompts for an OTP or opens a browser, and the maintainer completes it. An npm granular access token with "Bypass 2FA for publish" in `~/.npmrc` removes the prompt.

Halt on any error other than the idempotent-success signals.

### 7. Create the GitHub Release

Pre-flight: with tag signing on, `git tag -l v<version> --format='%(contents:signature)'` must be non-empty. Empty means git reads the signature as message text and would publish it in the Release body — the tag is pushed by now, so halt and report rather than recreating it silently.

```bash
bun run release:github
```

`scripts/release-github.ts` reads the version from `package.json`, takes the tag's subject, and runs `gh release create v<version> --verify-tag --notes-from-tag --title "v<version>: <subject>"`. On a re-run where the Release already exists, it repairs the title with `gh release edit`. `bun run release:github -- --dry-run` prints the commands without running them.

### 8. Report

Print a link for every destination that succeeded:

- npm: `https://www.npmjs.com/package/scholarly-parse/v/<version>`
- GitHub Release: `https://github.com/cyanheads/scholarly-parse/releases/tag/v<version>`
- The merged PR

Name any destination skipped or deferred, and why.

### 9. Verify the artifacts are live

A zero exit code is not proof the artifact is queryable:

- **npm**: `npm view scholarly-parse@<version> version` returns the version string
- **GitHub Release**: `gh release view v<version> -R cyanheads/scholarly-parse --json tagName,name,url` returns the Release with title `v<version>: <subject>`

**Never disable the sandbox to complete a verification.** A sandbox network block is not evidence of a failed publish — when the publish step reported success, report the two facts separately and let the caller verify from its own session.

If a check fails, halt and report which destination is unreachable.

## Checklist

- [ ] Preconditions met: tree clean, on `release/<version>`, release commit in the stack with only review commits above, PR head == local HEAD, review pass confirmed finished
- [ ] `bun run devcheck` passes
- [ ] `git merge --ff-only` onto `main` locally — never the GitHub merge button; HEAD equals the PR's `headRefOid`
- [ ] Annotated tag `v<version>` on HEAD with `--cleanup=whitespace`: a fresh ~60-character subject without the version, the PR's `## Changes` bullets verbatim, changelog link last with ` · release PR #<N>`; signature parses
- [ ] `main` pushed, then the tag; PR reports `MERGED`; remote and local `release/<version>` deleted
- [ ] `bun publish --dry-run` file list checked; the maintainer asked; `bun publish` run only on their word for this version
- [ ] `bun run release:github` succeeds, after the npm publish
- [ ] npm version and GitHub Release verified live
- [ ] Links reported; skipped or deferred destinations named
- [ ] On re-invocation: resumed at the first unfinished step; idempotent-success signals recognized
