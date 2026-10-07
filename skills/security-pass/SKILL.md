---
name: security-pass
description: >
  Review scholarly-parse's parsers against hostile documents: XML entity expansion and external entities, recursion depth on deeply nested input, input size and amplification budgets, regex backtracking on attacker-controlled text, prototype pollution through element or attribute names used as object keys, raw HTML or `javascript:` links surviving into rendered Markdown, PDF resource exhaustion, and lazy loading of optional peers. Builds a map and a set of hostile probe inputs, walks eight axes, reports grouped findings with a numbered options list, then fixes what's picked and files the rest. Use before a release, after adding or changing a format, or when asked for a security review, audit, hardening pass, or to fuzz the parsers.
metadata:
  author: cyanheads
  version: "1.2"
  type: audit
---

## Context

`scholarly-parse` reads untrusted documents — papers a consumer fetched from publishers, preprint servers, and the open web, including pages that are hostile or merely broken. The package never fetches, so the attack surface is the parse itself: what a crafted document can make a parser do beyond producing a wrong parse. `.github/SECURITY.md` names the scope — unbounded memory or CPU, a crash that escapes the `ParseResult` contract, content that survives into rendered Markdown as live HTML or script.

**The contract every probe checks.** Whatever the input, a parser returns a `ParseResult` — `{ ok: true, document }` or `{ ok: false, error: { reason, message } }` — in bounded time and memory. A throw (other than the missing-optional-peer error), a hang, a stack overflow, or runaway memory is a finding on whichever axis the input exercised.

**Read the code. Don't trust patterns from memory.**

## When to use

- Before a release
- After adding a format or changing a parser, the shared XML config, or a renderer
- After bumping `fast-xml-parser` or an optional peer
- The caller asks for a security review, audit, hardening pass, or to fuzz the parsers

## Inputs

Gather before starting; ask if unclear:

1. **Scope** — every format, one format, or a recent diff?
2. **Known concerns** — anything already suspected?
3. **Severity floor** — report everything, or skip medium and low?

## Steps

### 1. Build the map

```bash
ls src/formats/                                          # formats that exist
rg -n "XMLParser" src/                                   # every XML engine construction
rg -n "await import\(" src/                              # lazy peer loads
rg -n "from '(linkedom|unpdf)'" src/            # static peer imports — should print nothing
rg -n "maxInputBytes" src/                               # size checks
rg -n "new RegExp\(|\.(match|matchAll|replace|replaceAll|split|test|exec|search)\(" src/   # regex sites
```

Note: which formats exist and which are async, the entity options in the shared XML config under `src/xml/`, every recursive walker over source trees and its depth limit, every lookup table keyed by element names, attribute names, or IDs, every regex that runs over document text, and which peer each format loads.

Track one task per axis and mark each done as you go.

**Build the probe set now, so results are ready when you reach the axes.** In a scratch directory outside the repository, write a script that generates hostile inputs (the table below) and runs each through every parser that exists, importing from `src/` or the built `dist/`. For each probe, record whether a `ParseResult` came back or something threw, the wall time under a hard timeout, the heap growth (`process.memoryUsage().heapUsed` before and after), and whether `Object.prototype` gained keys. Probes are synthetic, so they never enter `corpus/` — a fixed finding lands as a unit test (step 5).

| Axis | Probe inputs |
|:---|:---|
| 1 | Nested entity definitions ten levels deep ("billion laughs"); one 100 KB entity referenced 100,000 times; `SYSTEM` entities pointing at `file:///etc/passwd` and an `http://` URL; parameter entities |
| 2 | 100,000 nested `<sec>`, `<list>`, `<div>`, `<table>`-in-cell, and inline `<italic><bold>…` elements, per format |
| 3 | Input at `maxInputBytes + 1` as a string and as bytes; `colspan="1000000" rowspan="1000000"`; a list with `start="999999999999"` |
| 4 | Tens of thousands of spaces, dots, digits, or hyphens followed by one character that forces a match failure, fed through every text-facing path; runs of an opener that never closes (`<`, `<meta`, `<script`, `\(`, `**x `, `[x](`), in raw markup and in text that reaches the renderers |
| 5 | Elements and attributes named `__proto__`, `constructor`, `prototype`, `toString`, `hasOwnProperty`; `id`, `xml:id`, and `rid` values with the same names |
| 6 | `<script>`, `<img src=x onerror=…>`, `<iframe>`, and HTML comments inside text nodes, CDATA, and titles; link targets `javascript:alert(1)`, ` JaVaScRiPt:…`, `&#106;avascript:…`, `vbscript:…`, `data:text/html,…`, `file:///…`; text containing `[x](javascript:y)`, `<javascript:y>`, backticks, and a newline followed by `# Heading` |
| 7 | A small PDF whose compressed stream inflates to gigabytes; a PDF with thousands of pages; a broken cross-reference table; an object cycle; an encrypted PDF; a PDF with no text layer |
| 8 | A scratch project with only `scholarly-parse` installed and no peers |

### 2. Walk the eight axes

#### Axis 1 — XML entity expansion and external entities

A DOCTYPE can declare entities that expand exponentially, or that point at files and URLs.

**Look in:** the shared configuration under `src/xml/`, and every XML entry point (`jats`, `tei`, and any format parsing XHTML).

**Check:**

- DOCTYPE-declared entities are either not expanded or expanded under caps on count, nesting, and expanded size, using the options the installed `fast-xml-parser` provides. Read its documentation for the version in `bun.lock` — option names and defaults move between releases, and a default flip can silently remove a cap.
- External entities (`SYSTEM`, `PUBLIC`) are never resolved — no file or network read under any configuration. Confirm with the probe, not by reading the config alone.
- Every XML parse goes through the shared configuration. A second `XMLParser` with its own options bypasses the caps.
- Numeric character references decode correctly: out-of-range code points and lone surrogates produce a replacement or a warning, never split surrogate pairs (a corpus invariant).
- Past a cap, the parser returns a result — an error reason or a coded warning — never a hang.

**Smell:** entity processing enabled with no limits; `new XMLParser({…})` inside `src/formats/<format>/`.

#### Axis 2 — Recursion depth

Deep nesting overflows the stack of any recursive walker, and a `RangeError` escapes the `ParseResult` contract.

**Look in:** functions that call themselves over source trees — section and division walkers, inline converters, list and table builders, the renderers' walk over `body[]` and `back[]` subsections — and the XML or DOM engine's own handling of nesting.

**Check:**

- Every recursive walk over source input carries a depth counter with a limit. Past it, the subtree is flattened or dropped with a warning, never thrown.
- The engine does not overflow first. If `fast-xml-parser` or `linkedom` recurses on the 100,000-deep probe before your walker's limit runs, bound nesting before the engine sees it, or catch the overflow at the parser boundary and return `malformed`.
- Renderers recurse over the model. Parser depth limits bound what they receive — confirm the deepest section tree a parser can emit renders without overflow.
- The engine is linear in depth, not only free of overflow. htmlparser2 does a `stack.unshift` per open tag and a `stack.indexOf` per unmatched close tag: time the 100,000-deep probe, and `<div>`×n then `</span>`×n, with `expectLinear`.
- A DOM depth bound counts depth the way the engine builds the tree (`boundNesting` in `src/html/dom.ts` mirrors htmlparser2's stack, not the HTML standard's tree builder).
- No walker reads an element's whole subtree at every level — a `querySelector`, `textContent`, or length check per ancestor. Under a depth bound of 256 that still costs up to ~100× flat: compute such facts once per element, and time a 250-deep chain repeated to 1 MiB against the same tags laid flat.

**Smell:** `function walk(node) { for (const child of node.children) walk(child) }` with no depth parameter; `if (el.querySelector(SEL)) walk(el.childNodes)`.

#### Axis 3 — Input size and amplification budgets

A size check bounds the input; amplification is a small input that demands huge work or output.

**Look in:** each parser's entry point, table span expansion, list numbering, and every loop whose count comes from the document.

**Check:**

- `maxInputBytes` is checked first — before decoding, entity processing, or loading a peer — in every parser, for both string and byte input. Past it: `{ ok: false, error: { reason: 'too-large' } }`.
- Numbers read from the document drive no unbounded work. Tables are expanded into rectangular rows with spans filled, so `colspan` and `rowspan` need caps on each value and on the total cell count; the same goes for list `start` values or any repeat count. Cap, and warn.
- Output stays proportional to input — no small document produces a huge `ScholarlyDocument` or Markdown string.
- `detect()` either scans a bounded prefix or holds every pattern it runs to Axis 4 at full input size.

**Smell:** `Array.from({ length: Number(cell.colspan) })`.

#### Axis 4 — Regex backtracking on attacker-controlled text

Every regex over document text sees attacker-length strings.

**Look in:** the regex sites from the map — PDF heuristics (headings, references, hyphenation), HTML page-furniture cleanup, LaTeXML cleanup, challenge-page detection, whitespace and citation-marker normalization.

**Check:**

- Each pattern is linear-time on hostile input. Nested quantifiers (`(a+)+`), overlapping alternations, and optional separators around a repeated group are the usual culprits.
- No pattern restarts a scan to the end of the text from every start of an unclosed run: `<[^>]*>` over `<<<…`, a lazy `[\s\S]*?` with no terminator, a `\s+$` or `[.,;]+$` trim that stops short of the end. Each looks linear and is quadratic on a run of its opener. Read a tag to its `>` or the next `<`, find a terminator with `indexOf`, and trim an end by walking back from it.
- Prove linearity by growth, not by one timing: quadrupling a run about quadruples the time, where a quadratic path takes sixteen times as long. Measure under Bun (JavaScriptCore) and Node (V8), since one engine can hide what the other shows. A fixed pattern's regression test calls `expectLinear` from `tests/linear.ts`, which times the thread's CPU so it holds under a loaded suite; start its range where the old path already fails the first step.
- No `new RegExp(...)` is built from document text; where one must be, the text is escaped.
- Patterns run on bounded slices — a line, a heading candidate — rather than the whole document, where the logic allows.

**Smell:** `/^(\s*\d+\.?\s*)+$/` applied to every line of a PDF.

#### Axis 5 — Prototype pollution through names used as keys

Element names, attribute names, and ID values become object keys all over a parser.

**Look in:** the XML engine's output objects, attribute maps, ID → node tables for cross-references (`rid`, `id`, `xml:id`, `href="#…"`), handler tables keyed by tag names, and reference and footnote registries.

**Check:**

- Lookup tables keyed by input-derived text are a `Map` or `Object.create(null)`, or are read with `Object.hasOwn`. `TABLE[name] ?? fallback` walks the prototype chain: an element named `constructor` returns a function the `??` doesn't catch, and string coercion emits `function Object() { [native code] }` into the output. Lowercasing the key doesn't help — `constructor` is already lowercase.
- Writes keyed by input never land on `__proto__`, `constructor`, or `prototype` of a plain object — an attribute named `__proto__` assigned into `{}` replaces that object's prototype.
- After the Axis 5 probes, `Object.prototype` has no new keys, and the names survive as data in the tree.
- IDs named `constructor`, `__proto__`, or `toString` resolve as missing targets, not as functions.

**Smell:** `const handlers = { sec: …, p: … }; handlers[node.name]?.(node)`.

#### Axis 6 — Live HTML and dangerous links in rendered Markdown

Consumers hand the Markdown to renderers that execute HTML and follow links.

**Look in:** inline-text conversion in every format, `jatsInlineToMarkdown`, link and image emission, and `src/render/`.

**Check:**

- Source text is escaped: a `<script>`, `<img onerror>`, `<iframe>`, or HTML comment in a text node, CDATA section, title, or attribute comes out as literal text, never raw HTML.
- Link and image targets pass a scheme allowlist — `http:`, `https:`, `mailto:`, relative paths, `#fragment`. `javascript:`, `vbscript:`, `data:`, and `file:` are dropped and the link text kept. Normalize before checking: case, leading whitespace and control characters, entity-encoded and percent-encoded forms.
- Text can't forge structure: brackets, parentheses, backticks, `<`, and a leading `#`, `>`, or `-` are escaped where they would open a link, autolink, code span, or block. A newline in a title can't start a new heading.
- TeX passes through verbatim inside `$…$`. `\href` or `\url` inside math is governed by the consumer's math renderer — document it, don't strip it.
- A construct split across adjacent inline elements is escaped too: JATS `named-content`, TEI `seg`, HTML and LaTeXML `span`, PDF runs in different faces, each holding one piece of `<` | `img …>`, `[x]` | `(javascript:y)`, `\` | `<img …>`, `<` | `javascript:y>`, `![x]` | `(https://…)`, or `<` | `!-- …`. `escapeInline` closes each fragment's end, and every reader runs `joinInlineSeams` over finished inline Markdown.

**Smell:** `` `[${text}](${href})` `` with neither escaped.

#### Axis 7 — PDF resource exhaustion

`maxInputBytes` bounds the compressed file; everything inside it can amplify.

**Look in:** `src/formats/pdf/` and the way it drives `unpdf`.

**Check:**

- A compressed stream can inflate by orders of magnitude. Cap the pages processed, the text items read, and the total characters extracted; stop early with a warning when a cap is hit.
- Only text is extracted — no page rendering, no image decoding.
- The pdf.js build `unpdf` bundles is past the fix for CVE-2024-4367 (arbitrary JavaScript through a crafted font). pdf.js 5 and later removed the eval-based glyph compiler and its `isEvalSupported` option, so `rg -c 'new Function|isEvalSupported' node_modules/unpdf/dist/pdfjs.mjs` prints nothing.
- Broken cross-reference tables and object cycles end in `{ ok: false, error: { reason: 'malformed' } }` in bounded time — pdf.js reconstructs broken files, which can be slow on crafted input.
- An encrypted PDF returns a result, never a password prompt or a hang. A PDF with no text layer returns cleanly, as `empty` or with `flat` quality.

**Smell:** `for (let i = 1; i <= pdf.numPages; i++)` with no cap.

#### Axis 8 — Lazy loading of optional peers

Peers are third-party engines running on untrusted input; loading them eagerly widens every consumer's attack surface and breaks consumers who don't install them.

**Look in:** every import of `linkedom` and `unpdf`; `src/index.ts`; each subpath `index.ts`; the built `dist/`.

**Check:**

- Peers are imported only with `await import('<literal>')` inside their format, on first use. `rg -n "from '(linkedom|unpdf)'" src/ dist/` prints nothing, and neither the root nor another format's subpath reaches a peer's import.
- The import specifier is a string literal — never built from input or options.
- A missing peer throws once, with the install command, and the message carries nothing from the input.
- In the Axis 8 scratch project, `import 'scholarly-parse'` and each XML subpath load with no peer installed.

**Smell:** `import { parseHTML } from 'linkedom'` at the top of a file under `src/formats/`.

### 3. Quick sanity pass

Fast, sometimes high-leverage. Outside the eight axes.

- `bun audit` — any high or critical? (`devcheck` runs it at high.) Moderate advisories in the XML engine or a peer deserve a read anyway — they sit on the untrusted-input path.
- `bunfig.toml` — `minimumReleaseAge` not lowered, the `[install.security]` scanner still configured
- New dependencies: lifecycle scripts (`postinstall` and friends), npm provenance (`npm view <pkg> --json | jq .dist.attestations`)
- `bun publish --dry-run` — the tarball holds `dist/`, `changelog/`, `CHANGELOG.md`, and the standard files; nothing from `corpus/`, `tests/`, `scripts/`, or `.env`
- `src/` reads no `process.env`, calls no `fetch`, and uses no `Buffer` — network code lives only in `scripts/corpus/`, which never ships
- `.env.example` holds placeholders only
- Collect the probe results from step 1 and triage anything not yet assigned to an axis

### 4. Report

Summary → findings → numbered options.

#### Summary (one paragraph)

Formats reviewed, axes covered, probes run, count by severity, the single most important finding.

#### Findings

Grouped by severity, three to five lines each.

| Severity | Meaning |
|:---------|:--------|
| **critical** | A crafted document reads files or the network, executes code, or puts live script into default Markdown output |
| **high** | A small document causes unbounded CPU or memory (entity expansion, span expansion, backtracking, a decompression bomb), a stack overflow or throw escapes the `ParseResult` contract, or `Object.prototype` is polluted |
| **medium** | A bound exists but is loose or bypassable (checked after decoding, skipped on one path), a dangerous link survives in a rarely used path, a peer loads eagerly |
| **low** | Hardening and polish — a tighter cap, a clearer warning, a narrower allowlist |

```
**<file or format> — Axis <N> — <critical|high|medium|low>**
Issue: <one line: what's wrong>
Impact: <one line: what a crafted document can do>
Fix: <one line: the change>
```

#### Options

Numbered, cherry-pickable:

```
1. Cap entity expansion in the shared XML config and add a billion-laughs unit test (high, #1)
2. Add a depth limit to the section walker in src/formats/tei/ (high, #2)
3. Cap colspan/rowspan and total cells in table expansion (high, #4)
4. Replace the element-name handler object with a Map in src/formats/jats/ (medium, #6)
5. Normalize and allowlist link schemes in the Markdown renderer (medium, #7)
6. Cap pages and extracted characters in the PDF parser (medium, #9)
```

End with:

> Pick by number (e.g. "do 1, 3, 5" or "expand on 2").

### 5. Fix or file

- **Picked options are fixed.** Each fix lands with a unit test that feeds the crafted input and asserts a bounded `ParseResult` — seen failing first — then `bun run devcheck`. A source-code security fix sets `security: true` in the release's changelog entry.
- **Real findings not picked are filed** via `skills/report-issue-local/SKILL.md` unless the caller says otherwise. Follow its Security reports section: a maintainer-requested GitHub issue audit keeps findings in the issue queue; private contributor disclosures stay protected. A formal security advisory requires an explicit maintainer request.
- Never commit, tag, or push from this pass — leave the fixes in the working tree for `git-wrapup`.

## Checklist

- [ ] Scope confirmed
- [ ] Map built: formats, XML config, walkers, keyed tables, regex sites, peers
- [ ] Probe set built and run; every probe's result, time, and heap recorded
- [ ] Axis 1 — entity caps in the shared config; external entities never resolved; one XML configuration
- [ ] Axis 2 — every recursive walker depth-limited; the engine doesn't overflow first
- [ ] Axis 3 — `maxInputBytes` first in every parser; spans and document-supplied counts capped
- [ ] Axis 4 — every regex over document text timed against hostile input
- [ ] Axis 5 — input-keyed tables are `Map`s; `Object.prototype` untouched after the probes
- [ ] Axis 6 — raw HTML escaped; link schemes normalized and allowlisted; text can't forge structure
- [ ] Axis 7 — PDF page, item, and character caps; pdf.js past CVE-2024-4367 with no eval path; broken files end in bounded time
- [ ] Axis 8 — peers lazy, literal, and absent from the root and XML subpaths
- [ ] Quick sanity pass: audit, bunfig guard, new-dependency scripts and provenance, tarball contents, no env/fetch/Buffer in `src/`
- [ ] Report: summary → grouped findings → numbered options
- [ ] Picked options fixed with failing-first unit tests; the rest filed in the requested queue; private disclosures protected; no unrequested advisory
