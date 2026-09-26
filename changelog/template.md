---
# FORMAT REFERENCE — do not edit. Copy this file to
# `changelog/<major.minor>.x/<version>.md` (e.g. `changelog/0.8.x/0.8.6.md`)
# to author a new release. Set that file's H1 to `# <version> — YYYY-MM-DD`
# with a concrete date.

# Required. One-line GitHub Release-style headline. 350 character cap — a
# ceiling, not a target. Default short and scannable. Don't pad, don't stitch
# unrelated changes with commas/semicolons into an inventory — pick the one
# headline the release is about. Quotes required: unquoted YAML treats
# `: ` inside the value as a key separator and fails GitHub's strict parser.
summary: ""

# Set `true` when consumers must change code to upgrade: API removals,
# signature changes, config renames, behavior changes that break existing
# usage. Flagged as `Breaking` in the rollup.
breaking: false

# Set `true` ONLY for a security fix in THIS project's own source code — a
# vulnerability or hardening in code you ship. A dependency or transitive CVE
# bump is routine maintenance, NOT a security release: record it under
# `## Dependencies` (with the advisory ID) and leave this `false`. When true,
# pairs with the `## Security` section below and flags `Security` in the rollup.
security: false

# Optional free-form notes for agents upgrading a project that depends on
# scholarly-parse. Not rendered in CHANGELOG. ADOPTION STEPS ONLY — renamed
# fields to follow, call sites to change, one-time migration steps. Never a
# second rendering of the body: if a body bullet already says it, name the
# bullet's symbol instead of re-explaining. Omit the field entirely when
# there's nothing to say.
# agent-notes: |
#   <instructions for agents upgrading a consumer>
---

# <version> — YYYY-MM-DD

<!--
  AUTHORING GUIDE — applies to the new per-version file you create from this
  template.

  Audience: someone scanning release notes to decide what affects them. Lead
  each bullet with the symbol or concept name in **bold** so they can skip
  what's irrelevant and zoom in on what's not.

  Tone: terse, fact-dense, not verbose. Bullet shape: **symbol** + what
  changed + at most one consumer-facing caveat. One sentence by default, two
  when the second carries weight — a bullet past ~40 words or three sentences
  is wrong. The depth lives one hop away: the linked issue carries the why,
  the commit diff carries the how. The changelog names what changed and what
  a consumer does about it; a reader who wants mechanism opens the link.

  Model length on THIS guide, never on the previous entry — entries modeled
  on entries compound.

  Cut (each has shipped as a wall of text; these are the cruft):
  - History/justification narration — how the bug worked, why the old
    behavior was wrong. One short clause at most; the issue carries the story.
  - Design-rationale defense — "chosen over Y because…", "guarding the
    getter is not enough…". That is the author arguing with a reviewer;
    reviewers read the PR, not the changelog.
  - Defensive unchanged-clauses — "X is unchanged", "byte-identical to
    <prev>". Keep one only where its absence would cause a real misread,
    as a short parenthetical.
  - Edge-case inventories — marker lists, not-flagged lists, escape tables.
    Tests and the issue carry those.
  - Mechanism walkthroughs (JSDoc, CLAUDE.md/AGENTS.md, or the relevant
    skill own those), ceremonial framings ("This release introduces…"),
    backwards-compat paragraphs, file-by-file test enumerations. Prefer
    code/symbol names over English re-explanations.

  Verified ≠ included: the every-claim-verified-from-the-diff rule bounds
  the TRUTH of what you write, never the AMOUNT.

  Example — same fact, right size:

    TOO LONG: **`parseJats` keeps the real abstract** (#12). JATS allows
    several `<abstract>` elements and the parser took the first, so an
    article whose graphical abstract precedes the main one returned the
    graphical text as its abstract. Abstracts are now classified by
    `@abstract-type` and `@specific-use`, the main one is chosen first,
    and the rest are kept under their own kinds; …
    [+90 more words of mechanism and edge cases]

    RIGHT: **`parseJats` no longer lets a graphical abstract replace the
    main one** (#12). Every abstract is kept in `abstracts[]` with its
    `kind`; renderers pick `main` first.

  Narrative intro: skip by default. Add one short sentence only when the
  release theme genuinely needs framing the bullets can't carry. When many
  bullets share one upgrade consequence, state it ONCE — intro line or
  agent-notes — never per bullet.

  Sections: Keep a Changelog order — Added, Changed, Deprecated, Removed,
  Fixed, Security. Include only sections with entries; delete the rest
  (including the commented-out scaffolding below). Don't ship empty headers.

  Include: every distinct fact a reader needs to adopt or audit the release —
  new exports, signatures, model fields, warning codes, breaking changes,
  corpus coverage that changes what a consumer can rely on. Nothing more.

  Links: link issues, PRs, docs, or skills where they help a reader jump to
  context. Once per item per entry — don't re-link the same issue in summary,
  narrative, and bullet. Skip links for inline symbol names; code spans speak
  for themselves.

  Issue/PR URLs: use full URLs. GitHub's bare `#NN` auto-link only resolves
  inside its own UI, not in npm reads or local editors.

      [#38](https://github.com/cyanheads/scholarly-parse/issues/38)   ← issue
      [#42](https://github.com/cyanheads/scholarly-parse/pull/42)     ← PR

  Verify numbers exist before linking (`gh issue view NN`, `gh pr view NN`).
  Never speculate on a future number — `#42` for an upcoming PR silently
  resolves to whatever real item already owns 42, and timeline previews pull
  in that unrelated item's metadata.

  TAG ANNOTATIONS — the annotated tag body renders as the GitHub Release body
  via `gh release create --notes-from-tag`. It is a condensed digest of this
  entry, never a copy, and its format is owned by the `release-and-publish`
  skill (step 4, "Create the annotated tag"): a short subject line without the
  version, flat headline bullets — no Keep-a-Changelog section headers, no
  gates line — at most one deps line, issue backlinks, and the changelog link
  last. In release-PR mode the `git-wrapup` skill authors those bullets as the
  PR body's `## Changes` and the tag copies them.
-->

## Added

-

## Changed

-

<!-- ## Deprecated

- -->

<!-- ## Removed

- -->

## Fixed

-

<!-- ## Security

- -->