/**
 * @fileoverview The `expect.json` schema — per-fixture assertions for what a fixture
 * exists to prove — and the check that applies it.
 * @module tests/corpus/expect
 */
import { z } from 'zod';
import type { ScholarlyDocument } from '../../src/model/document.js';
import { allSections, countBlocks } from './walk.js';

export const fixtureExpectSchema = z
  .object({
    /** The main abstract's Markdown starts with this. */
    abstractStartsWith: z.string().optional(),
    /** Abstract kinds, in order. */
    abstractKinds: z.array(z.string()).optional(),
    /** Substrings the Markdown must contain. */
    contains: z.array(z.string()).optional(),
    figures: z.number().int().nonnegative().optional(),
    /** Footnotes in `document.footnotes`. */
    footnotes: z.number().int().nonnegative().optional(),
    formulas: z.number().int().nonnegative().optional(),
    /** Substrings the Markdown must not contain. */
    notContains: z.array(z.string()).optional(),
    quality: z.enum(['structured', 'partial', 'flat']).optional(),
    references: z.number().int().nonnegative().optional(),
    /** Section titles that must appear, in this order (others may sit between them). */
    sectionTitles: z.array(z.string()).optional(),
    tables: z.number().int().nonnegative().optional(),
    title: z.string().optional(),
    /** Warning codes that must be reported. */
    warnings: z.array(z.string()).optional(),
    /** Why a count or check differs from what the source suggests. */
    why: z.string().optional(),
  })
  .strict();

export type FixtureExpect = z.infer<typeof fixtureExpectSchema>;

/** Assertions the document fails; empty when every one holds. */
export function checkExpect(
  expect: FixtureExpect,
  document: ScholarlyDocument,
  markdown: string,
): string[] {
  const problems: string[] = [];
  const equal = (name: string, actual: unknown, wanted: unknown) => {
    if (wanted !== undefined && actual !== wanted)
      problems.push(`${name}: expected ${String(wanted)}, got ${String(actual)}`);
  };
  equal('title', document.metadata.title, expect.title);
  equal('quality', document.diagnostics.quality, expect.quality);
  equal('tables', countBlocks(document, 'table'), expect.tables);
  equal('figures', countBlocks(document, 'figure'), expect.figures);
  equal('formulas', countBlocks(document, 'formula'), expect.formulas);
  equal('footnotes', document.footnotes.length, expect.footnotes);
  equal('references', document.references.length, expect.references);

  if (expect.abstractKinds) {
    const kinds = document.abstracts.map((a) => a.kind).join(',');
    if (kinds !== expect.abstractKinds.join(','))
      problems.push(`abstract kinds: expected ${expect.abstractKinds.join(',')}, got ${kinds}`);
  }
  if (expect.abstractStartsWith) {
    const main = document.abstracts.find((a) => a.kind === 'main');
    const first = main?.sections[0]?.blocks[0];
    const text = first?.type === 'paragraph' ? first.text : '';
    if (!text.startsWith(expect.abstractStartsWith))
      problems.push(`main abstract starts "${text.slice(0, 60)}"`);
  }
  if (expect.sectionTitles) {
    const titles = allSections(document).map((s) => s.title ?? '');
    let at = 0;
    for (const wanted of expect.sectionTitles) {
      const found = titles.indexOf(wanted, at);
      if (found === -1) {
        problems.push(`section "${wanted}" missing or out of order`);
        break;
      }
      at = found + 1;
    }
  }
  for (const needle of expect.contains ?? []) {
    if (!markdown.includes(needle)) problems.push(`Markdown lacks "${needle}"`);
  }
  for (const needle of expect.notContains ?? []) {
    if (markdown.includes(needle)) problems.push(`Markdown contains "${needle}"`);
  }
  const codes = new Set(document.diagnostics.warnings.map((w) => w.code));
  for (const code of expect.warnings ?? []) {
    if (!codes.has(code as never)) problems.push(`warning "${code}" not reported`);
  }
  return problems;
}
