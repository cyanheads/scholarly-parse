---
name: code-simplifier
description: >
  Cleanup pass that edits the working tree — over a session's uncommitted changes, or a named path or the whole of scholarly-parse. Reads `git diff` (or the named target) and simplifies, consolidates, and aligns code with the rest of the codebase — modern TypeScript, less complexity and slop, duplicated logic consolidated, efficiency issues caught — without breaking the rules a parser of untrusted documents depends on: parse only, results not throws, lazy optional peers, bounded input, the model as contract. Not a bug hunt: defects are reported, not fixed. Use after a substantive working session, or when asked to clean up, simplify, reduce slop, consolidate, modernize, tighten up, or de-slop.
metadata:
  author: cyanheads
  version: "1.0"
  type: workflow
---

# Code Simplifier

Cleanup pass over a session's changes or a named target. Reviews the code in scope, understands how it fits the codebase, and makes targeted improvements — modern syntax, less complexity, consolidated duplication, efficiency fixes. Prioritizes cohesion over local perfection.

## Core philosophy

**Every change must earn its keep.** A simplification that doesn't meaningfully improve clarity, correctness, or cohesion is noise. Don't refactor for refactoring's sake. Don't create files, abstractions, or utilities unless they solve a demonstrated problem. If the code works and reads well, leave it alone. The goal is a cohesive codebase, not a pristine one.

## Procedure

### Phase 1: Set the scope

Two scopes; the caller's wording picks one, and the diff is the default.

- **Diff** (nothing named): `git status` for the shape of the tree, then `git diff HEAD` for every uncommitted change, staged and unstaged. Untracked files never appear in the diff — list them with `git ls-files --others --exclude-standard` and read them directly. If the diff is empty and nothing is untracked, review the last commit (`git diff HEAD~1 HEAD`); if that is empty too, say the tree is clean and stop. Don't go hunting for files to improve.
- **Target** (a named path, module, or "the whole codebase"): the named files are the scope, whatever their git state. Work one module at a time — `src/model/`, `src/xml/`, one `src/formats/<format>/`, `src/detect/`, `src/render/` — and re-run the gate after each, so a large scan never becomes one unverifiable diff. Take the target as named; don't narrow it by commit history.

### Phase 2: Understand the surrounding codebase

Before any edit:

1. **Read the full files** containing changes — imports, surrounding logic, module structure — not just the hunks.
2. **Survey adjacent code.** Shared XML configuration and ordered-tree helpers live in `src/xml/`; the model and `ParseResult` in `src/model/`; renderers in `src/render/`. Know what exists before deciding something is missing.
3. **Read the rules that bind.** `CLAUDE.md` § The rules that matter, and the scholarly-parse section below.
4. **Run the gate once before editing** for a baseline: `bun run devcheck` (it runs Biome, typecheck, a clean build, and the full test suite, corpus included). For fast iteration inside the pass, `bun run test` or `bun run test:corpus` — never bare `bun test`, which bypasses the script and runs Bun's own runner instead of Vitest. If the gate is already red, say so in the summary and don't attribute the failure to your changes.

### Phase 3: Review

Evaluate the changes across these dimensions. Skip what doesn't apply.

#### Codebase cohesion

- **Reuse** — Search for existing helpers and patterns that could replace new code: `src/xml/` before a format writes its own tree walker, the model's existing types before a format invents a local shape. If a function already does what the new code does, use it.
- **Consolidation** — Flag copy-paste-with-variation, such as the same block-building logic in two parsers. Unify only when the shared abstraction is genuinely simpler than the duplication.
- **Consistency** — New code follows the codebase's naming, result-returning style, import patterns, and type style. Normalize toward the better variant when the project is inconsistent.
- **Stringly-typed code** — Raw strings where a union already exists: `ParseResult` error reasons (`malformed`, `wrong-format`, `empty`, `blocked`, `too-large`), section and abstract `kind`s, block types, `quality` levels, warning codes. Use the model's types.

#### Code quality

- **Redundant state** — State that duplicates existing state; cached values that could be derived.
- **Unnecessary complexity** — Deep nesting that could be guard clauses, premature abstractions, over-engineered solutions to simple problems.
- **Speculative generality** — Options, parameters, generic type parameters, and branches no caller exercises. Remove them and let the first real use add them back. On a published subpath's surface, it is API — note it instead (see Dead code).
- **Pass-through layers** — Apply the deletion test: if deleting a wrapper and inlining its body makes the complexity vanish, it was a pass-through — inline it. If the same logic would reappear across several callers, it earns its keep. An interface with a single implementation and no test double is a hypothetical seam — collapse it until something varies across it.
- **Test-only reach** — A function exported only so a test can reach it is a shape problem: name it in the summary with the module it belongs to. Don't restructure it here.
- **Dead code** — Unreachable branches, unused variables, commented-out code, session debug leftovers (`console.log`, `debugger`). An export nothing imports inside the package may still be public API: anything reachable from `src/index.ts` or a format's `index.ts` stays — note it in the summary.
- **Defensive code for impossible states** — Guards for cases the type system or an upstream check already prevents. Drop them. Bounds on untrusted input are never in this category (see below).
- **Type escapes** — `any`, `as` casts papering over a mismatch, non-null `!`, `@ts-ignore`. Each is a claim the compiler couldn't check: replace with a narrowed type, a type guard, or a parse at the boundary. Keep ones documenting a genuine limitation (third-party types included), and prefer `@ts-expect-error` with a one-line reason over `@ts-ignore`.
- **Swallowed errors** — Empty `catch {}`, `catch { return null }`, `try` blocks that log and continue. Rethrow or let it propagate; when wrapping, keep the chain (`new Error(msg, { cause })`). A parser catching the XML engine's exception on malformed input and returning `{ ok: false, error: { reason: 'malformed', … } }` is the contract, not a swallowed error.
- **Masking defaults** — `?? ''`, `|| []`, `?? 0` standing in for a value that must exist. When the type rules out absence, the default is dead; when the value is optional in the type but required in fact, fail with an error naming what's missing. Keep a default only where absence is expected — optional source markup (a missing subtitle, no keywords) is expected, and the model's optional fields say so.
- **Comment noise** — Strip comments that restate the code or describe removed behavior. Keep file headers, export JSDoc, and every comment carrying a *why* — a schema quirk, a publisher's malformed markup, an upstream bug reference.
- **Outdated patterns** — Verbose or legacy syntax with a modern equivalent. See the table below.

#### Efficiency

- **Redundant work** — Walking the same source tree twice, re-parsing a fragment already parsed, re-rendering to Markdown to find something the model already holds.
- **Quadratic loops over document size** — `array.includes` or `find` inside a loop over every node, string concatenation in a hot loop where an array join fits, repeated `indexOf` scans over the whole text. Documents run to megabytes; a pattern that's fine on a fixture can stall on a thesis.
- **Missed concurrency** — Independent async operations run in sequence that could run in parallel. Most parsing is synchronous CPU work, so this is rare outside `scripts/corpus/`.
- **Unbounded fan-out** — `Promise.all` over a caller-sized array in the corpus scripts; cap it with a batched loop.
- **TOCTOU** — Checking a file exists before reading it (scripts only). Operate and handle the error.
- **Overly broad operations** — Materializing a whole tree when one subtree is needed.

#### scholarly-parse rules

These are contracts, not style. A simplification that breaks one is a regression.

- **Parse only.** Nothing under `src/` imports `node:` modules, fetches, or touches the filesystem — Biome's `noNodejsModules` enforces the imports. Node globals slip past that rule: never introduce `Buffer`, `process`, or `__dirname` in `src/`; use `Uint8Array`, `TextDecoder`, `TextEncoder`. The package runs on Cloudflare Workers.
- **Results, not throws.** Expected failures return `{ ok: false, error }`. Never turn a result into a throw, or a throw into a silent partial document. The one allowed throw is a missing optional peer, with the install command in the message.
- **Optional peers stay lazy.** `linkedom`, `defuddle`, and `unpdf` are imported with `await import(...)` on first use inside their format. Never hoist one to a static top-level import, and never import a format module from the package root — `sideEffects: false` and one-subpath-per-format exist so a JATS-only consumer installs one dependency.
- **Bounds stay.** `maxInputBytes` checks, recursion depth limits, and the entity-expansion caps in the shared XML config are required (CLAUDE.md § The rules that matter), as is any other cap on the work a document can demand, such as table span expansion. They are not defensive clutter: consolidate them if duplicated, never remove or loosen one.
- **One XML configuration.** XML parsers take their `fast-xml-parser` options from `src/xml/`. A second `new XMLParser(...)` with its own options bypasses the entity caps — fold it into the shared config.
- **The model is the contract.** Types in `src/model/document.ts` and exports from each subpath `index.ts` are public API. Renaming or reshaping one is a breaking change, not a refactor — note it, don't make it.
- **Output is behavior.** A change that alters rendered Markdown shows up as `expected.md` snapshot diffs. In a cleanup pass that is a behavior change — revert it or report it; never re-snapshot to make a cleanup pass green.
- **Regex over document text runs linear-time.** A "simpler" pattern with nested quantifiers or overlapping alternations can backtrack catastrophically on hostile input — see `skills/security-pass/SKILL.md` Axis 4.
- **Lookup tables keyed by element or attribute names are a `Map`** (or `Object.create(null)`), never an object literal — a `<constructor>` element otherwise reads `Object.prototype`.

### Phase 4: Apply transformations

1. **Filter findings ruthlessly.** Skip false positives and changes not worth the churn. Don't argue with yourself about borderline cases.
2. **Stay in scope.** Edit only files inside the Phase 1 scope. Touch a file outside it only when a finding requires it — importing an existing helper, deleting a private export the diff just orphaned — and only on the lines that finding names. Anything broader goes in the summary as a recommendation.
3. **Correctness bugs are not this pass's job.** Name a real defect in the summary with file and line, so it lands as its own change with its own fixture.
4. **Transform incrementally** — one category at a time (modernize syntax, then reduce nesting, then consolidate).
5. **Verify equivalence** — functionality, types, public interfaces, and rendered output unchanged. Re-run `bun run devcheck` after transforming: no snapshot diffs, no new failures. A simplification that breaks the build is worse than the verbosity it removed.
6. **Keep the diff minimal.** Touch only lines with a real reason to change. Formatting belongs to Biome: never hand-adjust whitespace, quotes, or import order. Hunks Biome writes during a gate run stay, even outside scope — mention them in the summary.
7. **Never stage, commit, tag, push, or stash.** The pass ends with a dirty tree and a summary. Compare against the baseline with `git diff`, never by setting work aside.

When done, report:

- **Gate** — `devcheck` before and after, so a failure that predates the pass isn't pinned on it
- **Fixed** — what changed, grouped by category
- **Skipped** — findings deliberately left, each with its reason
- **Defects and recommendations** — correctness bugs, contract changes, and out-of-scope changes, each with `file:line`

When nothing earned a change, say the code was already clean.

## Common transformations (TypeScript, modern ESM)

Check `tsconfig.json` `target` and `lib` before applying a version-gated row — a row marked ES2024 or later needs a `lib` that includes it.

| Before | After | Why |
| --- | --- | --- |
| `const x: Foo = { ... } as Foo` | `const x = { ... } satisfies Foo` | Type-checked without assertion |
| `let r = acquire(); try { ... } finally { release(r) }` | `using r = acquire()` | Explicit resource management — only when the resource implements `Symbol.dispose` (`await using` for `Symbol.asyncDispose`) |
| `if (x !== null && x !== undefined)` | `if (x != null)` | Idiomatic null/undefined check |
| `arr.filter(x => x !== null) as T[]` | `arr.filter(x => x != null)` | TS infers the type predicate — no cast |
| `import { foo } from './index.js'` (a module importing through its own barrel) | `import { foo } from './foo.js'` | Inside a module, import siblings directly; routing through the module's own barrel invites cycles (`noImportCycles` is on). Across modules, the public barrel is right |
| `import { readFile } from 'fs/promises'` | `import { readFile } from 'node:fs/promises'` | `node:` protocol — `scripts/` and `tests/` only; `src/` imports no Node modules |
| `const a = await x(); const b = await y();` (independent) | `const [a, b] = await Promise.all([x(), y()])` | Parallel when truly independent |
| `value \|\| fallback` | `value ?? fallback` | `\|\|` also swallows `0`, `''`, and `false` |
| `obj.x !== undefined ? obj.x : fallback` | `obj.x ?? fallback` | Equivalent only when `null` should take the fallback too |
| `if (a) { if (b) { if (c) { ... } } }` | Guard clauses with early returns | Reduce nesting |
| `catch (e: any) { ... }` | `catch (e) { ... }` | Under `strict` the binding is `unknown`; narrow before use |
| `catch (err) { throw new Error('load failed') }` | `throw new Error('load failed', { cause: err })` | Preserve the cause chain |
| `[...arr].sort(cmp)` / `arr.slice().sort(cmp)` | `arr.toSorted(cmp)` | ES2023 non-mutating methods — also `toReversed`, `toSpliced`, `with` |
| `arr[arr.length - 1]` | `arr.at(-1)` | Typed `T \| undefined`, equivalent under `noUncheckedIndexedAccess` |
| `arr.reduce((acc, x) => { (acc[key(x)] ??= []).push(x); return acc }, {})` | `Object.groupBy(arr, key)` | ES2024 — null-prototype result, values typed `T[] \| undefined`; `Map.groupBy` for non-string keys |
| `let resolve!: …; const p = new Promise<T>((r) => { resolve = r })` | `const { promise, resolve, reject } = Promise.withResolvers<T>()` | ES2024 |
| `new Set([...a].filter((x) => b.has(x)))` | `a.intersection(b)` | ES2025 `Set` methods — also `union`, `difference`, `isSubsetOf`; receiver must be a `Set` |
| `JSON.parse(JSON.stringify(x))` | `structuredClone(x)` | Keeps Date, Map, Set, cycles — but throws on functions and strips class prototypes |
| `enum Kind { A, B }` | `const Kind = { A: 'A', B: 'B' } as const` | `erasableSyntaxOnly` rejects `enum`, `namespace`, and parameter properties — keep serialized values stable |
| `function f(a: string, b: string, c: string)` (internal) | `function f(opts: FnOptions)` | Same-typed positional params can be swapped and still type-check. An exported signature is API — leave it |

## When NOT to simplify

- **It works and reads well.** "I would have written it differently" is not a reason.
- **The change is cosmetic.** Renaming `data` to `result` isn't worth the churn.
- **Hot paths.** Parser inner loops may be written for measured speed — check before simplifying.
- **API compatibility.** Subpath exports, function signatures, model types, `ParseResult` reasons, and `diagnostics` warning codes are what consumers branch on — changing one is an API change, not a cleanup.
- **Tests.** Don't DRY test code aggressively — readability and isolation matter more than deduplication.
- **The abstraction isn't proven.** Two similar blocks don't make a shared utility. Wait for three, and even then only if the abstraction is simpler than the duplication.
- **`return await` inside `try` / `finally`.** Collapsing it to `return` lets the promise settle outside the block — `catch` never fires and `finally` runs early.
- **Awaits that only look independent.** Confirm independence from the code, not from the shape of the calls.
- **Workarounds for real documents.** A branch that looks redundant may exist for one publisher's malformed markup, with a fixture that proves it. Check the corpus before cutting a special case.
- **Generated files and corpus data.** `CHANGELOG.md`, `docs/tree.md`, `corpus/ATTRIBUTION.md`, `bun.lock`, `dist/`, every `corpus/**/source.*` (byte-for-byte, never reformatted), and `expected.md` snapshots are regenerated or reviewed, never edited in a cleanup pass.
