# scholarly-parse - Directory Structure

Generated on: 2026-09-26 15:44:50

```text
scholarly-parse/
├── .agents/
│   └── skills
├── .claude/
│   └── skills
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   ├── config.yml
│   │   └── feature_request.yml
│   ├── workflows/
│   │   └── codeql.yml
│   ├── CODE_OF_CONDUCT.md
│   ├── CONTRIBUTING.md
│   ├── FUNDING.yml
│   └── SECURITY.md
├── changelog/
│   ├── 0.1.x/
│   └── template.md
├── corpus/
│   ├── html/
│   ├── jats/
│   ├── latexml/
│   ├── pdf/
│   ├── tei/
│   ├── ATTRIBUTION.md
│   └── README.md
├── docs/
│   └── design.md
├── scripts/
│   ├── corpus/
│   │   ├── add.ts
│   │   └── attribution.ts
│   ├── build-changelog.ts
│   ├── devcheck.ts
│   ├── list-skills.ts
│   ├── release-github.ts
│   └── tree.ts
├── skills/
│   ├── code-simplifier/
│   │   └── SKILL.md
│   ├── git-wrapup/
│   │   └── SKILL.md
│   ├── maintenance/
│   │   └── SKILL.md
│   ├── polish-docs-meta/
│   │   ├── references/
│   │   │   ├── package-meta.md
│   │   │   └── readme.md
│   │   └── SKILL.md
│   ├── release-and-publish/
│   │   └── SKILL.md
│   ├── release-pr-review/
│   │   └── SKILL.md
│   ├── report-issue-local/
│   │   └── SKILL.md
│   └── security-pass/
│       └── SKILL.md
├── src/
│   ├── formats/
│   │   ├── html/
│   │   │   ├── blocks.ts
│   │   │   ├── context.ts
│   │   │   ├── index.ts
│   │   │   ├── inline.ts
│   │   │   ├── metadata.ts
│   │   │   ├── parse.ts
│   │   │   └── references.ts
│   │   ├── jats/
│   │   │   ├── blocks.ts
│   │   │   ├── context.ts
│   │   │   ├── fragment.ts
│   │   │   ├── front.ts
│   │   │   ├── index.ts
│   │   │   ├── inline.ts
│   │   │   ├── parse.ts
│   │   │   ├── references.ts
│   │   │   ├── tables.ts
│   │   │   └── text.ts
│   │   ├── latexml/
│   │   │   ├── blocks.ts
│   │   │   ├── context.ts
│   │   │   ├── index.ts
│   │   │   ├── inline.ts
│   │   │   └── parse.ts
│   │   └── tei/
│   │       ├── index.ts
│   │       ├── inline.ts
│   │       └── parse.ts
│   ├── html/
│   │   ├── dom.ts
│   │   ├── interstitial.ts
│   │   └── tables.ts
│   ├── model/
│   │   ├── diagnostics.ts
│   │   ├── document.ts
│   │   ├── index.ts
│   │   ├── input.ts
│   │   ├── result.ts
│   │   ├── section-ids.ts
│   │   ├── section-kinds.ts
│   │   └── table-grid.ts
│   ├── render/
│   │   ├── escape.ts
│   │   ├── index.ts
│   │   ├── inline.ts
│   │   ├── markdown.ts
│   │   ├── sections.ts
│   │   └── text.ts
│   ├── xml/
│   │   ├── mathml.ts
│   │   ├── ordered.ts
│   │   └── well-formed.ts
│   └── index.ts
├── tests/
│   ├── corpus/
│   │   ├── corpus.test.ts
│   │   ├── expect.ts
│   │   ├── features.ts
│   │   ├── fixtures.ts
│   │   ├── invariants.ts
│   │   ├── meta.test.ts
│   │   └── walk.ts
│   ├── formats/
│   │   ├── html/
│   │   │   └── html.test.ts
│   │   └── jats/
│   │       ├── figures.test.ts
│   │       ├── formulas.test.ts
│   │       ├── fragment.test.ts
│   │       ├── front.test.ts
│   │       ├── helpers.ts
│   │       ├── references.test.ts
│   │       ├── sections.test.ts
│   │       └── tables.test.ts
│   └── xml/
│       └── well-formed.test.ts
├── .env.example
├── .gitattributes
├── .gitignore
├── AGENTS.md
├── biome.json
├── bun.lock
├── bunfig.toml
├── CHANGELOG.md
├── CITATION.cff
├── CLAUDE.md
├── LICENSE
├── package.json
├── README.md
├── tsconfig.build.json
├── tsconfig.json
└── vitest.config.ts
```

_Note: This tree excludes files and directories matched by .gitignore and default patterns._
