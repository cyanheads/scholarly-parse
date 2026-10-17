# Changelog

All notable changes to this project. Each entry links to its full per-version file in [changelog/](changelog/).

## [0.2.2](changelog/0.2.x/0.2.2.md) — 2026-10-17

arXiv IDs read from reference links, `citation-alternatives`, and arXiv DOIs; a rowspan ends with its row group; HTTP error and arXiv no-paper pages no longer parse as documents; PDF layout and reference-list fixes.

## [0.2.1](changelog/0.2.x/0.2.1.md) — 2026-10-08 · 🛡️ Security

Rendered Markdown never yields a live HTML node outside link text, checked against a GFM parser, with emphasis, JATS citation, XML well-formedness, and identifier fixes.

## [0.2.0](changelog/0.2.x/0.2.0.md) — 2026-10-06 · 🛡️ Security

Escaping that holds across element boundaries and HTML nesting bounded before the DOM is built, plus toSections entries for footnotes and references, PDF footnotes, a PDF abort signal, and parsing fixes in every format.

## [0.1.1](changelog/0.1.x/0.1.1.md) — 2026-09-26 · 🛡️ Security

Hardening against hostile input: PDF reading budgets, one table budget per document, capped Markdown nesting, and linear-time text patterns, plus Grobid TEI outline fixes.

## [0.1.0](changelog/0.1.x/0.1.0.md) — 2026-09-26

First release: JATS, Grobid TEI, arXiv LaTeXML, publisher HTML, and PDF parsed into one document model and rendered as Markdown.
