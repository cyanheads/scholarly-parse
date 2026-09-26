---
name: maintenance
description: >
  Update scholarly-parse's dependencies and verify the result — `bun update --latest` under the `minimumReleaseAge` guard, a changelog read per updated package cross-referenced against the code, adoption of what the updates require, `bun run devcheck` with the full corpus suite, advisory triage, and every version arrow recorded for the release's changelog. Supports two entry modes: run the whole flow, or review updates already applied. Use when asked to update deps, run maintenance, or clear an audit advisory.
metadata:
  author: cyanheads
  version: "1.0"
  type: workflow
---

## When to use

- After running `bun update --latest` yourself and wanting the impact reviewed (**Mode B** — typical)
- To run the whole flow — survey → update → investigate → adopt → verify (**Mode A**)
- When `bun audit` in `devcheck` reports a high or critical advisory

## Entry modes

| Mode | Starting point | First step |
|:-----|:---------------|:-----------|
| **A — Full flow** | The lockfile is current; time to update | Step 1 |
| **B — Post-update review** | `bun update --latest` already ran | Step 3, with the update output or a `bun.lock` diff |

Both converge at step 3 and end at step 7.

## Policy

**Default to latest, majors included.** Staying current is the default, not a judgment call. Hold a package back only for a supply-chain reason — an abandoned package, a fresh maintainer transfer, an obfuscated payload or new install script, a migration whose cost clearly outweighs the win — and name the reason in the summary. Recency alone is never the reason.

**The `minimumReleaseAge` guard stays.** `bunfig.toml` blocks versions published less than three days ago, so a freshly compromised release never installs. A package that didn't move may simply be inside that window — that is the guard working. Never lower `minimumReleaseAge`, never pass `--minimum-release-age` to bypass it, and never remove the `[install.security]` scanner. A version the scanner blocks is a finding to report, not an obstacle to route around.

## Steps

### 1. Survey what's outdated (Mode A)

```bash
bun outdated
```

`bun update --latest` crosses semver majors; plain `bun update` stays inside the declared ranges. Use `--latest` unless a package is held back under the policy above.

### 2. Apply the update (Mode A)

```bash
bun update --latest
```

Capture the `↑ package old → new` lines — they feed step 3 and become the changelog arrows. A `bun.lock` diff recovers them after the fact.

### 3. Investigate each changelog

For every updated package, read what changed between the old and new versions: find its repository (`npm view <pkg> repository.url`), then its release notes (`gh release list -R <owner>/<repo>`, `gh release view <tag> -R <owner>/<repo>`) or its `CHANGELOG`. Cross-reference each change against the code that actually uses the package:

```bash
rg -n "from '<pkg>" src/ scripts/ tests/
```

Per package, record what changed, the impact here, and any action item. A package whose notes can't be found (no tags, no changelog) goes under Open decisions in step 7; don't stall on it.

Read these closer than the rest:

- **`fast-xml-parser`** — the one required dependency, and it parses untrusted XML. Look for changes to entity handling, option names, and defaults: a renamed option or flipped default can silently remove the entity caps in the shared config under `src/xml/`. After updating, re-run the entity probes from `skills/security-pass/SKILL.md` Axis 1.
- **Optional peers** (`linkedom`, `defuddle`, `unpdf`) — third-party engines on the untrusted-input path. When `package.json` declares them as peers, a major bump of the development copy means deciding whether the `peerDependencies` range moves too; a range change is consumer-facing and gets its own changelog line, and dropping a major a consumer may have installed is `breaking: true`. For `unpdf`, check which pdf.js build it bundles (security-pass Axis 7).
- **Toolchain** — `typescript`, `@biomejs/biome`, `vitest`, `publint`, `@arethetypeswrong/cli`. A Biome bump may need `bunx biome migrate --write`, which also moves the `$schema` version in `biome.json`. A TypeScript bump moves the TypeScript badge in `README.md`, which pins the range. A Bun upgrade moves `packageManager` and `@types/bun` together.

### 4. Adopt the changes

Default to cost/benefit for everything:

- **Breaking changes** — fix the call sites. Not optional.
- **Deprecations** — migrate now, while the context is fresh.
- **New lint rules** — when a Biome update flags existing code, fix the code; don't silence the rule.
- **Clear wins** — performance, correctness, a removed deprecation warning, a smaller surface: adopt.
- **Marginal changes** — a new convenience API isn't a reason to touch working code. Note it; don't refactor speculatively.

The package rules still bind: nothing an update suggests may add a `node:` import, a fetch, or a static peer import under `src/` (CLAUDE.md § The rules that matter).

### 5. Verify

```bash
bun run devcheck
```

It rebuilds from clean, runs the full test suite with every corpus fixture, and audits at high severity — so no separate build, test, or audit step is needed. For quick iteration on a parse change, `bun run test:corpus` runs the corpus suite alone.

**Corpus diffs are behavior changes.** An engine update (`fast-xml-parser`, a peer) can change parse output, which surfaces as failing assertions or `expected.md` snapshot diffs. Read each one:

- An improvement → `bun run corpus:snapshot`, then review every rewritten `expected.md` before keeping it
- A regression → fix the adoption, or hold the package back and name the reason in the summary

Never re-snapshot to get green.

In Mode B, run the gate again even if it passed before — step 4 changed code.

### 6. Advisory triage

When `bun audit` reports a high or critical advisory, fix it in place, most surgical option first:

1. `bun audit fix` — upgrades the vulnerable package to the lowest safe version every dependent's range allows; `package.json` changes only when an exact pin must move. `bun audit fix --dry-run` previews. `--latest` also applies fixes the declared ranges exclude and rewrites `package.json` — the escalation, not the default.
2. `bun update <name>` — bumps that one package wherever it appears in the lockfile, transitive copies included.
3. `bun dedupe` — collapses duplicate versions in the lockfile without touching `package.json` (`bun dedupe --check` lists them); the fix when the advisory sits on a stale extra copy.
4. Delete `bun.lock` and `bun install` — last resort only: every range re-resolves to its latest allowed version, so an advisory fix becomes an unreviewed bump of everything.

If the advisory survives all four, it is real: pin the patched version in `package.json` `overrides` and record why, or wait on upstream. Never silence it with `--ignore` or a lowered audit level. A dependency advisory is not a source-code security fix — it goes under `## Dependencies` with the advisory ID, and the changelog's `security` flag stays `false`.

### 7. Summary

A concise numbered summary:

1. **Updated packages** — one row per package with its arrow, `` `pkg` ^old → ^new ``, grouped only when truly identical, any rationale as a parenthetical on the row (`` `fast-xml-parser` ^5.a.b → ^5.c.d (entity caps re-verified) ``)
2. **Held back** — each package not moved and why: inside the `minimumReleaseAge` window, blocked by the scanner, or a named supply-chain reason
3. **Breaking changes handled** — call sites fixed
4. **Adopted** — changes taken up in the code, config, or docs
5. **Corpus changes** — snapshot diffs kept as improvements, regressions fixed
6. **Open decisions** — genuinely ambiguous items only: a breaking change with several migration paths, a peer-range change that needs the maintainer's call, a close cost/benefit
7. **Status** — `bun run devcheck` result

**Every arrow reaches the changelog.** The release's entry at `changelog/<major.minor>.x/<version>.md` lists each one under `## Dependencies` — `git-wrapup` authors the entry, so hand it the list from item 1 unchanged. Leave the changes uncommitted; `git-wrapup` lands them as a `chore(deps)` commit.

## Checklist

- [ ] Update applied with `bun update --latest` (Mode A) or already applied (Mode B); `minimumReleaseAge` and the scanner untouched
- [ ] Every updated package's changes read and cross-referenced against `src/`, `scripts/`, `tests/`
- [ ] `fast-xml-parser` changes checked against the entity caps; peers' ranges and bundled engines reviewed; toolchain follow-ups done (Biome migrate, README TypeScript badge, Bun pin)
- [ ] Breaking changes and deprecations handled; third-party adoption decisions recorded
- [ ] `bun run devcheck` passes — corpus included, snapshot diffs reviewed, none blessed
- [ ] Advisories triaged surgically; none ignored
- [ ] Numbered summary presented; every arrow ready for the changelog's `## Dependencies`
