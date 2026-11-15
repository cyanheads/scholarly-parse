# Contributing

Hi, and thanks for using `scholarly-parse`! If a paper parses wrong or a format isn't handled yet, an issue is the most useful thing you can send. Let me know about any rough edge or new ideas.

Issues are the contribution path here: bugs, feature requests, and documentation gaps all land there, and code changes go through my workflows, so a precise issue with a reproduction is the fastest route to a fix.

- [Report a bug](https://github.com/cyanheads/scholarly-parse/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/cyanheads/scholarly-parse/issues/new?template=feature_request.yml)
- [Float an idea or ask a question](https://github.com/cyanheads/scholarly-parse/issues/new) — free-form, no template, no need to be sure it's a bug first

The bug and feature forms are structured, and filling in the fields is what makes those actionable. Anything that fits neither can just be a plain issue — a half-formed idea in your own words is fine.

## Before filing

A few things that save a round-trip:

1. **Confirm it's the parser, not the document.** A source that lacks the markup (a PDF with no text layer, a JATS deposit with no `<body>`) can't parse into more than it holds. If the result says so, with a warning in `diagnostics` or `partial` quality, the parse is behaving.
2. **Check you're on the latest release.** `npm view scholarly-parse version` — fixes land on the current version, older ones aren't patched.
3. **Search existing issues.** `gh issue list -R cyanheads/scholarly-parse --search "<keyword>" --state all`. Add to the matching thread instead of opening a duplicate.
4. **Redact anything sensitive.** Issues are public and permanent — no keys, tokens, internal URLs, or PII in code, logs, or stack traces.

## What makes an issue actionable

- **The document.** A DOI, PMC ID, arXiv ID, or a public URL to the exact file you parsed. A parse bug without the input can't be reproduced.
- **What came out, and what should have.** The relevant slice of the Markdown or the `ScholarlyDocument` field, verbatim.
- The package version, the runtime (Bun / Node / Workers), and for PDF or HTML the installed `unpdf` or `linkedom` version.
- For features: the use case first, then what the parser or renderer should do.

Only openly licensed documents (CC BY, CC0, or similar) can be added to the test corpus. If the paper you hit is closed access, say so — a minimal made-up input that shows the same structure works too.

## For agents

Use one of the two forms and do the triage first. The free-form path is for humans thinking out loud, not for skipping the checklist — an unverified report costs more to read than it saves to file.

The workflow is in [`skills/report-issue-local/SKILL.md`](../skills/report-issue-local/SKILL.md): triage, `gh` invocations with bodies that match the issue forms, title scopes, and label conventions. Read it before filing on a user's behalf.

## Security

Don't open a public issue for a vulnerability. See [SECURITY.md](./SECURITY.md) for private disclosure.
