/**
 * @fileoverview Corpus discovery and the `meta.json` schema. Every fixture directory
 * under `corpus/<format>/` is loaded through here, so a malformed or unlicensed
 * fixture fails the suite before any parser runs.
 * @module tests/corpus/fixtures
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { FEATURES } from './features.js';

export const CORPUS_DIR = resolve(import.meta.dirname, '../../corpus');

export const FORMATS = ['jats', 'tei', 'latexml', 'html', 'pdf'] as const;
export type CorpusFormat = (typeof FORMATS)[number];

const SOURCE_FILE: Record<CorpusFormat, string> = {
  html: 'source.html',
  jats: 'source.xml',
  latexml: 'source.html',
  pdf: 'source.pdf',
  tei: 'source.xml',
};

/** Licenses a fixture may carry. Anything else stays out of the corpus. */
export const OPEN_LICENSES = [
  'CC-BY-2.0',
  'CC-BY-2.5',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'CC0-1.0',
  'public-domain',
] as const;

export const fixtureMetaSchema = z
  .object({
    attribution: z.string().min(1),
    derivedFrom: z.object({ fixture: z.string(), tool: z.string() }).strict().optional(),
    features: z.array(z.enum(FEATURES)),
    flavor: z.string().optional(),
    format: z.enum(FORMATS),
    id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
    identifiers: z
      .object({
        arxiv: z.string(),
        doi: z.string(),
        pmcid: z.string().regex(/^PMC\d+$/),
        pmid: z.string().regex(/^\d+$/),
      })
      .partial()
      .strict(),
    license: z.object({ id: z.enum(OPEN_LICENSES), url: z.url() }).strict(),
    notes: z.string().optional(),
    regression: z
      .string()
      .regex(/^cyanheads\/[\w.-]+#\d+$/)
      .optional(),
    retrieved: z.iso.date(),
    title: z.string().min(1),
    url: z.url(),
  })
  .strict();

export type FixtureMeta = z.infer<typeof fixtureMetaSchema>;

export interface Fixture {
  dir: string;
  format: CorpusFormat;
  /** Raw `meta.json` content, validated by the corpus suite rather than here. */
  meta: unknown;
  name: string;
  sourcePath: string;
}

/** Every fixture directory, in a stable order. */
export function listFixtures(): Fixture[] {
  return FORMATS.flatMap((format) => {
    const formatDir = join(CORPUS_DIR, format);
    if (!existsSync(formatDir)) return [];
    return readdirSync(formatDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .map((name) => {
        const dir = join(formatDir, name);
        const metaPath = join(dir, 'meta.json');
        return {
          dir,
          format,
          meta: existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : undefined,
          name,
          sourcePath: join(dir, SOURCE_FILE[format]),
        };
      });
  });
}
