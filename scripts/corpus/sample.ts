#!/usr/bin/env bun
/**
 * @fileoverview Wild sampling: fetch fresh documents, parse each, check the corpus
 * invariants, and report the failure classes found — parse failures, thrown errors,
 * invariant breaks, unhandled elements, warnings, slow parses — with the publishers
 * they came from and example identifiers. Nothing is written to the corpus: a class
 * worth keeping becomes a fixture through `add.ts`, whose arguments each example is
 * printed as.
 *
 * ```sh
 * bun run scripts/corpus/sample.ts [--source epmc,arxiv,openalex,pdf,html] [--count 20] [--seed N] [--json <file>]
 * ```
 *
 * Sources, `--count` documents from each:
 * - `epmc`: open-access CC BY articles with Europe PMC full text, from random
 *   publication days in the three years before last month → JATS.
 * - `arxiv`: papers from random submission days since arXiv began rendering HTML
 *   (December 2023) → LaTeXML. A paper arXiv could not convert counts as unavailable.
 * - `openalex`: OpenAlex's random sample of CC BY works with cached Grobid output →
 *   TEI. Needs `OPENALEX_API_KEY`; each download draws $0.01 from its daily budget.
 * - `pdf`: OpenAlex's random sample of CC BY articles with an open-access PDF, each
 *   fetched from its publisher → PDF. A link that serves anything but a PDF (a viewer, a
 *   challenge page) counts as unavailable.
 * - `html`: the same draw's landing pages, fetched from the publisher → publisher HTML.
 *   A page that blocks the request counts as unavailable. With one seed, `pdf` and
 *   `html` draw the same works.
 *
 * `--seed` makes a run repeatable; the seed is printed with the report. Requests are
 * paced per upstream (`http.ts`).
 * @module scripts/corpus/sample
 */
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { parseHtml } from '../../src/formats/html/index.js';
import { parseJats } from '../../src/formats/jats/index.js';
import { parseLatexml } from '../../src/formats/latexml/index.js';
import { parsePdf } from '../../src/formats/pdf/index.js';
import { parseTei } from '../../src/formats/tei/index.js';
import type { ParseResult } from '../../src/model/result.js';
import { toMarkdown } from '../../src/render/markdown.js';
import { checkInvariants } from '../../tests/corpus/invariants.js';
import { decode, type HttpResult, request } from './http.js';

type Source = 'epmc' | 'arxiv' | 'openalex' | 'pdf' | 'html';
const SOURCES: readonly Source[] = ['epmc', 'arxiv', 'openalex', 'pdf', 'html'];
const FORMAT: Record<Source, 'jats' | 'latexml' | 'tei' | 'pdf' | 'html'> = {
  arxiv: 'latexml',
  epmc: 'jats',
  html: 'html',
  openalex: 'tei',
  pdf: 'pdf',
};

/** How long a publisher gets to answer: a dead host should not hold a round for minutes. */
const PUBLISHER_TIMEOUT_MS = 45_000;

/** A parse slower than this is reported as its own class. */
const SLOW_MS = 5000;

/** One fetched document, or why none could be fetched. */
interface Draw {
  bytes?: Uint8Array;
  /** How `add.ts` names it (`epmc PMC123`, `pdf <url> --doi <doi>`), or the OpenAlex work ID. */
  id: string;
  publisher: string;
  source: Source;
  unavailable?: string;
  url?: string;
}

/** What one document's parse showed. */
interface Outcome {
  classes: string[];
  id: string;
  ms: number;
  publisher: string;
  quality?: string;
  source: Source;
  unavailable?: string;
}

// ── Randomness ──────────────────────────────────────────────────────────────

/** mulberry32: a small seeded generator, so a seed repeats a run's draws. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** A random day between `from` and `to`, as `YYYY-MM-DD`. */
function randomDay(from: Date, to: Date, random: () => number): string {
  const time = from.getTime() + random() * (to.getTime() - from.getTime());
  return new Date(time).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

// ── Sources ─────────────────────────────────────────────────────────────────

const EPMC_REST = 'https://www.ebi.ac.uk/europepmc/webservices/rest';

/** Europe PMC: a few articles from each of several random publication days, spreading the draw across journals. */
async function drawEpmc(count: number, random: () => number): Promise<Draw[]> {
  const perDay = 5;
  const now = Date.now();
  const from = new Date(now - 3 * 365 * DAY_MS);
  const to = new Date(now - 30 * DAY_MS);
  const draws: Draw[] = [];
  for (let attempt = 0; draws.length < count && attempt < count; attempt++) {
    const day = randomDay(from, to, random);
    const query = `OPEN_ACCESS:y AND IN_EPMC:y AND LICENSE:"cc by" AND FIRST_PDATE:${day}`;
    const params = new URLSearchParams({
      format: 'json',
      pageSize: '100',
      query,
      resultType: 'lite',
    });
    const search = await request(`${EPMC_REST}/search?${params}`, 'epmc', 'application/json');
    if (search.status !== 200) continue;
    const hits = (
      JSON.parse(decode(search.bytes)) as {
        resultList?: { result?: { journalTitle?: string; pmcid?: string }[] };
      }
    ).resultList?.result?.filter((hit) => hit.pmcid);
    const take = Math.min(perDay, count - draws.length);
    for (const hit of shuffled(hits ?? [], random).slice(0, take)) {
      const pmcid = hit.pmcid as string;
      const url = `${EPMC_REST}/${pmcid}/fullTextXML`;
      const result = await request(url, 'epmc', 'application/xml');
      draws.push({
        id: `epmc ${pmcid}`,
        publisher: hit.journalTitle ?? 'unknown journal',
        source: 'epmc',
        ...(result.status === 200
          ? { bytes: result.bytes, url }
          : { unavailable: `fullTextXML answered HTTP ${result.status}` }),
      });
    }
  }
  return draws;
}

/** arXiv: papers from random submission days, each fetched as its versioned HTML render. */
async function drawArxiv(count: number, random: () => number): Promise<Draw[]> {
  const perDay = 5;
  const from = new Date('2023-12-01T00:00:00Z');
  const to = new Date(Date.now() - 7 * DAY_MS);
  const draws: Draw[] = [];
  for (let attempt = 0; draws.length < count && attempt < count; attempt++) {
    const day = randomDay(from, to, random).replaceAll('-', '');
    const params = new URLSearchParams({
      max_results: '100',
      search_query: `submittedDate:[${day}0000 TO ${day}2359]`,
    });
    const feed = await request(
      `https://export.arxiv.org/api/query?${params}`,
      'arxiv',
      'application/atom+xml',
    );
    if (feed.status !== 200) continue;
    const entries = decode(feed.bytes)
      .split('<entry>')
      .slice(1)
      .flatMap((entry) => {
        const id = /<id>https?:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/.exec(entry)?.[1];
        const category = /<arxiv:primary_category[^>]*term="([^"]+)"/.exec(entry)?.[1];
        return id ? [{ category: category ?? 'unknown', id }] : [];
      });
    const take = Math.min(perDay, count - draws.length);
    for (const entry of shuffled(entries, random).slice(0, take)) {
      const url = `https://arxiv.org/html/${entry.id}`;
      const result = await request(url, 'arxiv', 'text/html');
      draws.push({
        id: `arxiv ${entry.id}`,
        publisher: `arXiv ${entry.category}`,
        source: 'arxiv',
        ...(result.status === 200
          ? { bytes: result.bytes, url }
          : { unavailable: `no HTML render (HTTP ${result.status})` }),
      });
    }
  }
  return draws;
}

/** OpenAlex: its random sample of CC BY works with cached Grobid TEI. */
async function drawOpenalex(count: number, seed: number): Promise<Draw[]> {
  const key = process.env.OPENALEX_API_KEY?.trim();
  if (!key) {
    console.error('sample: OPENALEX_API_KEY is not set in .env; skipping OpenAlex');
    return [];
  }
  const works = await openalexSample<{
    id: string;
    primary_location?: { source?: { display_name?: string; host_organization_name?: string } };
  }>(
    'has_content.grobid_xml:true,best_oa_location.license:cc-by',
    'id,primary_location',
    count,
    seed,
  );
  const draws: Draw[] = [];
  for (const work of works) {
    const workId = work.id.replace(/^https:\/\/openalex\.org\//, '');
    const source = work.primary_location?.source;
    const url = `https://content.openalex.org/works/${workId}.grobid-xml`;
    const result = await request(url, 'openalex', 'application/xml', {
      Authorization: `Bearer ${key}`,
    });
    draws.push({
      id: workId,
      publisher: source?.host_organization_name ?? source?.display_name ?? 'unknown source',
      source: 'openalex',
      ...(result.status === 200
        ? { bytes: result.bytes, url }
        : { unavailable: `Grobid TEI answered HTTP ${result.status}` }),
    });
  }
  return draws;
}

/** OpenAlex's work list: its seeded random sample under `filter`. Needs no key. */
async function openalexSample<T>(filter: string, select: string, count: number, seed: number) {
  const params = new URLSearchParams({
    filter,
    per_page: String(count),
    sample: String(count),
    seed: String(seed),
    select,
  });
  const list = await request(
    `https://api.openalex.org/works?${params}`,
    'openalex',
    'application/json',
  );
  if (list.status !== 200) throw new Error(`OpenAlex works list answered HTTP ${list.status}`);
  return (JSON.parse(decode(list.bytes)) as { results: T[] }).results;
}

interface OpenAccessWork {
  best_oa_location?: {
    landing_page_url?: string;
    pdf_url?: string;
    source?: { display_name?: string; host_organization_name?: string };
  };
  doi?: string;
  id: string;
}

/** True when the bytes open as a PDF; a PDF link can serve a viewer or challenge page instead. */
const isPdf = (bytes: Uint8Array) =>
  new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-');

/**
 * OpenAlex's random sample of CC BY articles, each fetched from its publisher: the
 * open-access PDF, or the landing page. Each example is `add.ts` arguments.
 */
async function drawOpenAccess(
  source: 'pdf' | 'html',
  count: number,
  seed: number,
): Promise<Draw[]> {
  const works = await openalexSample<OpenAccessWork>(
    'best_oa_location.license:cc-by,type:article,has_pdf_url:true',
    'id,doi,best_oa_location',
    count,
    seed,
  );
  const draws: Draw[] = [];
  for (const work of works) {
    const location = work.best_oa_location;
    const link = source === 'pdf' ? location?.pdf_url : location?.landing_page_url;
    const doi = work.doi?.replace(/^https:\/\/doi\.org\//, '');
    const base = {
      id: link && doi ? `${source} ${link} --doi ${doi}` : work.id,
      publisher:
        location?.source?.host_organization_name ??
        location?.source?.display_name ??
        'unknown source',
      source,
    };
    if (!link) {
      draws.push({ ...base, unavailable: 'no open-access link' });
      continue;
    }
    console.error(`sample: fetching ${draws.length + 1}/${works.length} ${link}`);
    let result: HttpResult;
    try {
      const accept = source === 'pdf' ? 'application/pdf' : 'text/html';
      result = await request(link, 'publisher', accept, {}, PUBLISHER_TIMEOUT_MS);
    } catch (error) {
      // A publisher host that refuses or times out says nothing about the parser.
      const message = error instanceof Error ? error.message : String(error);
      draws.push({ ...base, unavailable: `request failed: ${message}` });
      continue;
    }
    const unavailable =
      result.status !== 200
        ? `HTTP ${result.status}`
        : source === 'pdf' && !isPdf(result.bytes)
          ? `served ${result.contentType || 'no content type'}, not a PDF`
          : source === 'html' && isPdf(result.bytes)
            ? 'the landing page link serves a PDF'
            : undefined;
    draws.push(
      unavailable ? { ...base, unavailable } : { ...base, bytes: result.bytes, url: result.url },
    );
  }
  return draws;
}

// ── Analysis ────────────────────────────────────────────────────────────────

/**
 * An invariant problem as a class: counts and quoted excerpts vary per document, the
 * kind of break does not. A leaked tag keeps its tag name.
 */
function problemClass(problem: string): string {
  const tag = /^leaked source tag "[^<]*<\/?([\w:-]+)/.exec(problem)?.[1];
  if (tag) return `invariant: leaked source tag <${tag}>`;
  return `invariant: ${problem.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, 'N')}`;
}

function parse(draw: Draw & { bytes: Uint8Array }): ParseResult | Promise<ParseResult> {
  switch (draw.source) {
    case 'epmc':
      return parseJats(draw.bytes);
    case 'arxiv':
      return parseLatexml(draw.bytes, draw.url ? { baseUrl: draw.url } : {});
    case 'openalex':
      return parseTei(draw.bytes);
    case 'pdf':
      return parsePdf(draw.bytes);
    case 'html':
      return parseHtml(draw.bytes, draw.url ? { baseUrl: draw.url } : {});
  }
}

async function analyze(draw: Draw): Promise<Outcome> {
  const base = { id: draw.id, publisher: draw.publisher, source: draw.source };
  if (!draw.bytes) return { ...base, classes: [], ms: 0, unavailable: draw.unavailable ?? '' };
  const started = performance.now();
  let result: ParseResult;
  try {
    result = await parse({ ...draw, bytes: draw.bytes });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...base, classes: [`threw: ${message.slice(0, 120)}`], ms: 0 };
  }
  const ms = Math.round(performance.now() - started);
  const classes: string[] = ms > SLOW_MS ? [`slow: parse over ${SLOW_MS / 1000} s`] : [];
  if (!result.ok) {
    // arXiv serves a notice page for a paper it could not convert, and a publisher may
    // answer with a challenge page: nothing to parse either way.
    if (
      (draw.source === 'arxiv' && result.error.reason === 'empty') ||
      (draw.source === 'html' && result.error.reason === 'blocked')
    )
      return { ...base, classes, ms, unavailable: result.error.message };
    return { ...base, classes: [...classes, `failed: ${result.error.reason}`], ms };
  }
  const { document } = result;
  const markdown = toMarkdown(document);
  const problems = checkInvariants({
    document,
    format: FORMAT[draw.source],
    markdown,
    source: draw.source === 'pdf' ? undefined : decode(draw.bytes),
  });
  classes.push(
    ...problems.map(problemClass),
    ...document.diagnostics.unhandled.map((u) => `unhandled: ${u.element}`),
    ...document.diagnostics.warnings.map((w) => `warning: ${w.code}`),
  );
  return { ...base, classes: [...new Set(classes)], ms, quality: document.diagnostics.quality };
}

// ── Report ──────────────────────────────────────────────────────────────────

const SOURCE_NAMES: Record<Source, string> = {
  arxiv: 'arXiv LaTeXML',
  epmc: 'Europe PMC JATS',
  html: 'OpenAlex OA publisher HTML',
  openalex: 'OpenAlex Grobid TEI',
  pdf: 'OpenAlex OA PDF',
};

/** A class's rank in the report: breakage first, then gaps, then warnings. */
function severity(name: string): number {
  return ['threw', 'failed', 'invariant', 'slow', 'unhandled', 'warning'].indexOf(
    name.split(':')[0] ?? '',
  );
}

const cell = (value: string) => value.replace(/\|/g, '\\|');

function report(outcomes: Outcome[], seed: number, sources: Source[]): string {
  const lines = [
    `# Wild sample — seed ${seed}, ${new Date().toISOString().slice(0, 10)}`,
    '',
    '| Source | Drawn | Parsed | Unavailable | structured / partial / flat |',
    '|:---|---:|---:|---:|:---|',
  ];
  for (const source of sources) {
    const mine = outcomes.filter((o) => o.source === source);
    const parsed = mine.filter((o) => o.quality);
    const quality = ['structured', 'partial', 'flat']
      .map((q) => parsed.filter((o) => o.quality === q).length)
      .join(' / ');
    const unavailable = mine.filter((o) => o.unavailable !== undefined).length;
    lines.push(
      `| ${SOURCE_NAMES[source]} | ${mine.length} | ${parsed.length} | ${unavailable} | ${quality} |`,
    );
  }

  const byClass = new Map<string, Outcome[]>();
  for (const outcome of outcomes) {
    for (const name of outcome.classes) byClass.set(name, [...(byClass.get(name) ?? []), outcome]);
  }
  const classes = [...byClass].sort(
    ([a, x], [b, y]) => severity(a) - severity(b) || y.length - x.length || a.localeCompare(b),
  );
  lines.push('', '## Failure classes', '');
  if (classes.length === 0) {
    lines.push('None: every parsed document held every invariant with no warnings.');
  } else {
    lines.push('| Class | Documents | Publishers | Examples |', '|:---|---:|:---|:---|');
    for (const [name, hits] of classes) {
      const publishers = [...new Set(hits.map((h) => h.publisher))];
      const shown = publishers.slice(0, 3).join('; ');
      const more = publishers.length > 3 ? `; +${publishers.length - 3} more` : '';
      const examples = hits
        .slice(0, 3)
        .map((h) => `\`${h.id}\``)
        .join(', ');
      lines.push(`| ${cell(name)} | ${hits.length} | ${cell(shown + more)} | ${examples} |`);
    }
  }

  const unavailable = outcomes.filter((o) => o.unavailable !== undefined);
  if (unavailable.length > 0) {
    lines.push('', '## Unavailable', '');
    for (const o of unavailable) lines.push(`- \`${o.id}\`: ${o.unavailable}`);
  }
  lines.push(
    '',
    'Turn a class into a fixture with `bun run scripts/corpus/add.ts <example>`; every example but an OpenAlex work ID is add.ts arguments.',
  );
  return `${lines.join('\n')}\n`;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    count: { default: '20', type: 'string' },
    json: { type: 'string' },
    seed: { type: 'string' },
    source: { default: SOURCES.join(','), type: 'string' },
  },
});

const count = Number(values.count);
const seed = values.seed === undefined ? Math.floor(Math.random() * 2 ** 31) : Number(values.seed);
const sources = values.source.split(',').map((s) => s.trim()) as Source[];
const invalid = sources.filter((s) => !SOURCES.includes(s));
if (!Number.isInteger(count) || count < 1 || !Number.isInteger(seed) || invalid.length > 0) {
  console.error(
    `usage: bun run scripts/corpus/sample.ts [--source ${SOURCES.join(',')}] [--count N] [--seed N] [--json <file>]`,
  );
  process.exit(1);
}
const random = generator(seed);

const outcomes: Outcome[] = [];
for (const source of sources) {
  console.error(`sample: drawing ${count} from ${SOURCE_NAMES[source]}…`);
  const draws =
    source === 'epmc'
      ? await drawEpmc(count, random)
      : source === 'arxiv'
        ? await drawArxiv(count, random)
        : source === 'openalex'
          ? await drawOpenalex(count, seed)
          : await drawOpenAccess(source, count, seed);
  for (const [index, draw] of draws.entries()) {
    console.error(`sample: parsing ${index + 1}/${draws.length} ${draw.id}`);
    outcomes.push(await analyze(draw));
  }
}

process.stdout.write(report(outcomes, seed, sources));
if (values.json) {
  writeFileSync(values.json, `${JSON.stringify({ outcomes, seed }, null, 2)}\n`);
  console.error(`sample: wrote ${values.json}`);
}
