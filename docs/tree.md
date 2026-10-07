# scholarly-parse - Directory Structure

Generated on: 2026-10-07 02:13:41

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
│   ├── 0.2.x/
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
│   │   ├── agreement.ts
│   │   ├── attribution.ts
│   │   ├── http.ts
│   │   └── sample.ts
│   ├── build-changelog.ts
│   ├── devcheck.ts
│   ├── list-skills.ts
│   ├── release-github.ts
│   └── tree.ts
├── skills/
│   ├── add-fixture/
│   │   └── SKILL.md
│   ├── add-format/
│   │   └── SKILL.md
│   ├── code-simplifier/
│   │   └── SKILL.md
│   ├── corpus-sampling/
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
│   │   │   ├── references.ts
│   │   │   └── subtree.ts
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
│   │   ├── pdf/
│   │   │   ├── blocks.ts
│   │   │   ├── context.ts
│   │   │   ├── index.ts
│   │   │   ├── inline.ts
│   │   │   ├── layout.ts
│   │   │   ├── lines.ts
│   │   │   ├── load.ts
│   │   │   ├── parse.ts
│   │   │   ├── references.ts
│   │   │   └── structure.ts
│   │   └── tei/
│   │       ├── index.ts
│   │       ├── inline.ts
│   │       └── parse.ts
│   ├── html/
│   │   ├── dom.ts
│   │   ├── interstitial.ts
│   │   ├── math.ts
│   │   └── tables.ts
│   ├── model/
│   │   ├── diagnostics.ts
│   │   ├── document.ts
│   │   ├── doi.ts
│   │   ├── extremes.ts
│   │   ├── index.ts
│   │   ├── input.ts
│   │   ├── limits.ts
│   │   ├── result.ts
│   │   ├── section-ids.ts
│   │   ├── section-kinds.ts
│   │   ├── table-grid.ts
│   │   └── trailing.ts
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
│   ├── detect.ts
│   ├── index.ts
│   └── parse.ts
├── tests/
│   ├── corpus/
│   │   ├── corpus.test.ts
│   │   ├── expect.ts
│   │   ├── features.ts
│   │   ├── fixtures.ts
│   │   ├── invariants.ts
│   │   ├── meta.test.ts
│   │   ├── parsers.ts
│   │   └── walk.ts
│   ├── formats/
│   │   ├── html/
│   │   │   └── html.test.ts
│   │   ├── jats/
│   │   │   ├── figures.test.ts
│   │   │   ├── formulas.test.ts
│   │   │   ├── fragment.test.ts
│   │   │   ├── front.test.ts
│   │   │   ├── helpers.ts
│   │   │   ├── references.test.ts
│   │   │   ├── sections.test.ts
│   │   │   └── tables.test.ts
│   │   ├── latexml/
│   │   │   ├── latexml.test.ts
│   │   │   └── nesting.test.ts
│   │   ├── pdf/
│   │   │   ├── budgets.test.ts
│   │   │   ├── build-pdf.ts
│   │   │   ├── doi.test.ts
│   │   │   ├── layout.test.ts
│   │   │   ├── pdf.test.ts
│   │   │   ├── references.test.ts
│   │   │   └── tables.test.ts
│   │   └── tei/
│   │       └── tei.test.ts
│   ├── model/
│   │   ├── doi.test.ts
│   │   ├── result.test.ts
│   │   ├── section-ids.test.ts
│   │   └── table-grid.test.ts
│   ├── render/
│   │   ├── escape.test.ts
│   │   ├── inline.test.ts
│   │   └── markdown.test.ts
│   ├── xml/
│   │   ├── mathml.test.ts
│   │   ├── ordered.test.ts
│   │   └── well-formed.test.ts
│   ├── detect.test.ts
│   ├── linear.test.ts
│   ├── linear.ts
│   └── parse.test.ts
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
