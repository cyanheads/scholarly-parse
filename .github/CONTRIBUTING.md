# Contributing

Hi, and thanks for using `scholarly-parse`! If a paper parses wrong or a format isn't handled yet, an issue is the most useful thing you can send.

Issues are the contribution path here: bugs, feature requests, and documentation gaps all land there, and code changes go through my workflows, so a precise issue with a reproduction is the fastest route to a fix.

- [Report a bug](https://github.com/cyanheads/scholarly-parse/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/cyanheads/scholarly-parse/issues/new?template=feature_request.yml)
- [Float an idea or ask a question](https://github.com/cyanheads/scholarly-parse/issues/new) — free-form, no template

## What makes a parsing bug actionable

- **The document.** A DOI, PMC ID, arXiv ID, or a public URL to the exact file you parsed. A parse bug without the input can't be reproduced.
- **What came out, and what should have.** The relevant slice of the Markdown or the `ScholarlyDocument` field, verbatim.
- The package version and runtime (Bun / Node / Workers).

Only openly licensed documents (CC BY, CC0, or similar) can be added to the test corpus. If the paper you hit is closed access, say so — a minimal made-up input that shows the same structure works too.

## For agents

Use one of the two forms and do the triage first. The workflow is in [`skills/report-issue-local/SKILL.md`](../skills/report-issue-local/SKILL.md) — read it before filing on a user's behalf.

## Security

Don't open a public issue for a vulnerability. See [SECURITY.md](./SECURITY.md) for private disclosure.
