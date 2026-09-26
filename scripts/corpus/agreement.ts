#!/usr/bin/env bun
/**
 * @fileoverview Cross-format agreement over the rosetta set: works the corpus stores in
 * several formats (fixtures tagged `rosetta`, grouped by DOI). Each work's JATS parse is
 * the reference, and every other format's parse is measured against it:
 *
 * - titles: share of the reference's section titles the format also has (recall), and
 *   share of the format's titles the reference has (precision); titles compare with
 *   numbering, case, and punctuation removed
 * - abstract: word overlap of the main abstracts (shared distinct words over all
 *   distinct words in either)
 * - references, tables, figures: the format's count, then the reference's
 *
 * Read-only; prints a Markdown report. Measures, not a gate: the bar a format must meet
 * is set from what these numbers show.
 *
 * ```sh
 * bun run corpus:agreement
 * ```
 * @module scripts/corpus/agreement
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import type { Block, ScholarlyDocument, Section } from '../../src/model/document.js';
import { splitSectionNumber } from '../../src/model/section-kinds.js';
import { stripInline } from '../../src/render/text.js';
import { type CorpusFormat, fixtureMetaSchema, listFixtures } from '../../tests/corpus/fixtures.js';
import { PARSERS } from '../../tests/corpus/parsers.js';
import { countBlocks } from '../../tests/corpus/walk.js';

/** Formats in report order; JATS first, as the reference. */
const ORDER: CorpusFormat[] = ['jats', 'latexml', 'tei', 'html', 'pdf'];

interface Parsed {
  document: ScholarlyDocument;
  fixture: string;
  format: CorpusFormat;
}

/** A title reduced for comparison: no numbering, case, punctuation, or extra spaces. */
function normalizeTitle(title: string): string {
  return stripInline(splitSectionNumber(title, undefined).title ?? title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function titles(document: ScholarlyDocument): Set<string> {
  const out = new Set<string>();
  const visit = (sections: Section[]) => {
    for (const section of sections) {
      const title = section.title && normalizeTitle(section.title);
      if (title) out.add(title);
      visit(section.sections);
    }
  };
  visit([...document.body, ...document.back]);
  return out;
}

/** Distinct words of the main abstract, or of the first one when none is marked main. */
function abstractWords(document: ScholarlyDocument): Set<string> {
  const abstract = document.abstracts.find((a) => a.kind === 'main') ?? document.abstracts[0];
  const text: string[] = [];
  const visitBlocks = (blocks: Block[]) => {
    for (const block of blocks) if (block.type === 'paragraph') text.push(block.text);
  };
  const visit = (sections: Section[]) => {
    for (const section of sections) {
      visitBlocks(section.blocks);
      visit(section.sections);
    }
  };
  visit(abstract?.sections ?? []);
  return new Set(
    stripInline(text.join(' '))
      .toLowerCase()
      .match(/\p{L}[\p{L}\p{N}'-]*/gu) ?? [],
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((word) => b.has(word)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : shared / union;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

async function parseFixture(fixture: ReturnType<typeof listFixtures>[number]): Promise<Parsed> {
  const parse = PARSERS[fixture.format];
  if (!parse) throw new Error(`no parser for ${fixture.format} (${fixture.name})`);
  const { url } = fixtureMetaSchema.parse(fixture.meta);
  const result = await parse(new Uint8Array(readFileSync(fixture.sourcePath)), url);
  if (!result.ok)
    throw new Error(`${fixture.name}: ${result.error.reason}: ${result.error.message}`);
  return { document: result.document, fixture: fixture.name, format: fixture.format };
}

const works = new Map<string, Parsed[]>();
for (const fixture of listFixtures()) {
  const meta = fixtureMetaSchema.parse(fixture.meta);
  const doi = meta.identifiers.doi?.toLowerCase();
  if (!doi || !meta.features.includes('rosetta')) continue;
  works.set(doi, [...(works.get(doi) ?? []), await parseFixture(fixture)]);
}

const lines = [
  '# Cross-format agreement',
  '',
  'Each format measured against the same work parsed from JATS. Titles: recall / precision of section titles. Abstract: word overlap. References, tables, figures: this format / JATS.',
];
const byFormat = new Map<
  CorpusFormat,
  { abstract: number[]; precision: number[]; recall: number[] }
>();

for (const [doi, parsed] of [...works].sort(([a], [b]) => a.localeCompare(b))) {
  const reference = parsed.find((p) => p.format === 'jats');
  if (!reference) {
    console.error(`agreement: ${doi} has no JATS fixture to measure against; skipped`);
    continue;
  }
  const refTitles = titles(reference.document);
  const refAbstract = abstractWords(reference.document);
  lines.push(
    '',
    `## ${doi}`,
    '',
    '| Format | Fixture | Titles | Abstract | References | Tables | Figures |',
    '|:---|:---|:---|---:|:---|:---|:---|',
  );
  const others = parsed
    .filter((p) => p !== reference)
    .sort((a, b) => ORDER.indexOf(a.format) - ORDER.indexOf(b.format));
  for (const { document, fixture, format } of others) {
    const found = titles(document);
    const shared = [...refTitles].filter((title) => found.has(title)).length;
    const recall = refTitles.size === 0 ? 1 : shared / refTitles.size;
    const precision = found.size === 0 ? 0 : shared / found.size;
    const abstract = overlap(refAbstract, abstractWords(document));
    const stats = byFormat.get(format) ?? { abstract: [], precision: [], recall: [] };
    stats.abstract.push(abstract);
    stats.precision.push(precision);
    stats.recall.push(recall);
    byFormat.set(format, stats);
    const ratio = (type: Block['type']) =>
      `${countBlocks(document, type)} / ${countBlocks(reference.document, type)}`;
    lines.push(
      `| ${format} | ${fixture} | ${percent(recall)} / ${percent(precision)} | ${percent(abstract)} | ${document.references.length} / ${reference.document.references.length} | ${ratio('table')} | ${ratio('figure')} |`,
    );
  }
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
lines.push(
  '',
  '## By format',
  '',
  'Means over the works above.',
  '',
  '| Format | Works | Title recall | Title precision | Abstract overlap |',
  '|:---|---:|---:|---:|---:|',
);
for (const format of ORDER) {
  const stats = byFormat.get(format);
  if (!stats) continue;
  lines.push(
    `| ${format} | ${stats.recall.length} | ${percent(mean(stats.recall))} | ${percent(mean(stats.precision))} | ${percent(mean(stats.abstract))} |`,
  );
}
process.stdout.write(`${lines.join('\n')}\n`);
