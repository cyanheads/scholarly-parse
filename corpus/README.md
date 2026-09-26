# Corpus

Real documents the parsers are tested against. Every file here is third-party content under an open license, stored exactly as its source served it.

## Layout

```
corpus/<format>/<fixture-id>/
  source.xml | source.html | source.pdf   the document, byte-for-byte
  meta.json                               provenance, license, what it exercises
  expect.json                             assertions (added once the parser exists)
  expected.md                             reviewed Markdown snapshot
```

`<format>` is `jats`, `tei`, `latexml`, `html`, or `pdf`. A fixture ID is `<origin>-<identifier>` in lowercase, e.g. `epmc-pmc10635526`, `arxiv-2401.04088v1`, `grobid-pone.0322148`.

## meta.json

```json
{
  "id": "epmc-pmc10635526",
  "format": "jats",
  "flavor": "europepmc",
  "title": "…",
  "identifiers": { "doi": "10.1371/…", "pmcid": "PMC10635526" },
  "url": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10635526/fullTextXML",
  "retrieved": "2026-09-26",
  "license": { "id": "CC-BY-4.0", "url": "https://creativecommons.org/licenses/by/4.0/" },
  "attribution": "Author A, Author B. Title. Journal. 2023;18(11):e0293862. doi:10.1371/…",
  "features": ["tables", "display-math", "structured-abstract"],
  "regression": "cyanheads/pubmed-mcp-server#111"
}
```

`features` names what the fixture exercises, from the vocabulary in `tests/corpus/features.ts`. `regression` is set only for a fixture that reproduces a known bug. `derivedFrom` is set when the source was produced from another fixture (a Grobid TEI generated from a PDF).

## Adding a fixture

`bun run scripts/corpus/add.ts <kind> <identifier> [--features a,b] [--regression cyanheads/<repo>#N] [--id <fixture-id>] [--notes "…"]` fetches one document, confirms its license from its own metadata, writes `source.*` and `meta.json`, and regenerates `ATTRIBUTION.md`. A license outside the allowlist exits non-zero and writes nothing. Kinds are `epmc` and `pmc` (JATS), `arxiv` and `ar5iv` (LaTeXML), `pdf` and `html` with `--doi`, and `grobid`, which runs a PDF fixture through a local Grobid server. `--dry-run` verifies without writing. The script's header documents each kind and where its license comes from.

## Rules

- **Open licenses only.** CC BY, CC BY-SA, CC0, or public domain, confirmed from the document's own license statement or the publisher's metadata — never assumed from the venue. No NC or ND licenses, no "free to read" without a license.
- **Byte-for-byte.** Never reformat, re-encode, or trim a source file. `.gitattributes` disables line-ending normalization under `corpus/`.
- **Attribution travels.** `corpus/ATTRIBUTION.md` is generated from every `meta.json`; regenerate it when a fixture is added or removed.
- **Keep fixtures small enough to review.** Prefer a document that shows the feature at a few hundred kilobytes over one that shows it at ten megabytes.
- **Negative fixtures belong here too.** A captcha page, an HTML page served under a `.pdf` URL, a PDF with no text layer — each proves a parser refuses cleanly.
