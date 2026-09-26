#!/usr/bin/env bun
/**
 * @fileoverview Add one openly licensed document to the corpus: fetch it, confirm its
 * license from its own metadata, and write the bytes exactly as received plus a
 * `meta.json`. A license outside `OPEN_LICENSES` (arXiv's non-exclusive license, any NC
 * or ND license, none stated) exits non-zero and writes nothing.
 *
 * ```sh
 * bun run scripts/corpus/add.ts <kind> <identifier> [options]
 *
 * epmc <PMCID|PPRID>            Europe PMC fullTextXML                    → jats/europepmc
 * pmc <PMCID>                   NCBI E-utilities efetch db=pmc            → jats/pmc
 * arxiv <id-with-version>       https://arxiv.org/html/<id>               → latexml/arxiv
 * ar5iv <id>                    https://ar5iv.labs.arxiv.org/html/<id>    → latexml/ar5iv
 * pdf <url> --doi <doi>         a publisher PDF (or --arxiv <id> for an arXiv PDF)
 * html <url> --doi <doi>        a publisher article page
 * grobid <pdf-fixture-id>       the PDF fixture through a local Grobid    → tei/grobid
 *
 * --features a,b     tags from the tests/corpus/features.ts vocabulary
 * --regression cyanheads/<repo>#N
 * --id <fixture-id>  default: <origin>-<identifier>
 * --notes "…"
 * --dry-run          fetch and verify, print the meta, write nothing
 * ```
 *
 * Licenses are read from the document: JATS `<permissions>`, arXiv OAI-PMH `<license>`,
 * and for PDF and HTML the DOI's Crossref `vor` license, falling back to the same work's
 * JATS on Europe PMC. A JATS statement that names CC BY in prose with no URL takes its
 * version from Crossref. An arXiv license covers the current version only; for an older
 * version, check that version's abstract page before adding it. Requests are sequential
 * and paced per upstream (NCBI ≤3/s, arXiv one per 3 s). `CORPUS_CONTACT_EMAIL` (from
 * `.env`) joins the User-Agent when set; `GROBID_URL` overrides `http://localhost:8070`.
 * @module scripts/corpus/add
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { XMLParser } from 'fast-xml-parser';
import { interstitialReason } from '../../src/html/interstitial.js';
import { FEATURES } from '../../tests/corpus/features.js';
import {
  CORPUS_DIR,
  type CorpusFormat,
  type FixtureMeta,
  fixtureMetaSchema,
  OPEN_LICENSES,
} from '../../tests/corpus/fixtures.js';
import { CONTACT, decode, type HttpResult, request, type Upstream } from './http.js';

type OpenLicenseId = (typeof OPEN_LICENSES)[number];
type Kind = 'epmc' | 'pmc' | 'arxiv' | 'ar5iv' | 'pdf' | 'html' | 'grobid';
type Identifiers = FixtureMeta['identifiers'];

interface License {
  id: OpenLicenseId;
  url: string;
}

/** What a kind resolves to before the CLI options are applied. */
interface Fetched {
  attribution: string;
  bytes: Uint8Array;
  defaultId: string;
  derivedFrom?: FixtureMeta['derivedFrom'];
  flavor?: string;
  format: CorpusFormat;
  identifiers: Identifiers;
  license: License;
  notes?: string;
  title: string;
  url: string;
}

/** Work-level metadata read from Crossref, JATS, or arXiv. */
interface WorkMeta {
  attribution: string;
  identifiers: Identifiers;
  title: string;
}

const KINDS: readonly Kind[] = ['epmc', 'pmc', 'arxiv', 'ar5iv', 'pdf', 'html', 'grobid'];
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const SOURCE_FILE: Record<CorpusFormat, string> = {
  html: 'source.html',
  jats: 'source.xml',
  latexml: 'source.html',
  pdf: 'source.pdf',
  tei: 'source.xml',
};

function fail(message: string): never {
  console.error(`add: ${message}`);
  process.exit(1);
}

// ── HTTP ────────────────────────────────────────────────────────────────────

async function get(url: string, upstream: Upstream, accept: string): Promise<HttpResult> {
  try {
    return await request(url, upstream, accept);
  } catch (error) {
    fail(`GET ${url} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getOk(url: string, upstream: Upstream, accept: string): Promise<HttpResult> {
  const result = await get(url, upstream, accept);
  if (result.status !== 200) fail(`GET ${url} returned HTTP ${result.status}`);
  return result;
}

// ── XML ─────────────────────────────────────────────────────────────────────

/** A node in fast-xml-parser's `preserveOrder` output. */
type XNode = Record<string, unknown>;

const xml = new XMLParser({
  attributeNamePrefix: '',
  htmlEntities: true,
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  preserveOrder: true,
  processEntities: true,
  trimValues: false,
});

function parseXml(text: string): XNode[] {
  try {
    return xml.parse(text) as XNode[];
  } catch (error) {
    fail(`not well-formed XML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const tagOf = (node: XNode) => Object.keys(node).find((key) => key !== ':@') ?? '';
const kids = (node: XNode) => {
  const value = node[tagOf(node)];
  return Array.isArray(value) ? (value as XNode[]) : [];
};
const attr = (node: XNode, name: string) =>
  (node[':@'] as Record<string, string> | undefined)?.[name];

/** Every element named `tag` at any depth below `nodes`, in document order. */
function findAll(nodes: XNode[], tag: string): XNode[] {
  return nodes.flatMap((node) => {
    const name = tagOf(node);
    if (name === '#text' || name === '?xml') return [];
    return [...(name === tag ? [node] : []), ...findAll(kids(node), tag)];
  });
}

const findFirst = (nodes: XNode[], tag: string): XNode | undefined => findAll(nodes, tag)[0];
const child = (node: XNode | undefined, tag: string) =>
  node ? kids(node).find((k) => tagOf(k) === tag) : undefined;
const children = (node: XNode | undefined, tag: string) =>
  node ? kids(node).filter((k) => tagOf(k) === tag) : [];

function rawText(node: XNode): string {
  if (tagOf(node) === '#text') return String(node['#text'] ?? '');
  return kids(node).map(rawText).join('');
}

const squash = (value: string) => value.replace(/\s+/g, ' ').trim();
const text = (node: XNode | undefined) => (node ? squash(rawText(node)) : '');

// ── Licenses ────────────────────────────────────────────────────────────────

/** `unstated` marks a source that names no license URL at all, as opposed to a refused one. */
type LicenseVerdict =
  | { ok: true; license: License }
  | { ok: false; reason: string; unstated?: boolean };

/**
 * Map a license URL to an allowlisted ID. Only the unported Creative Commons forms are
 * recognized; a jurisdiction port, an NC or ND variant, or any other URL is not open
 * for this corpus.
 */
function classifyLicenseUrl(raw: string): LicenseVerdict | undefined {
  const url = raw.trim().toLowerCase();
  const cc = url.match(/creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)([^#?]*)/);
  if (cc) {
    const [, type = '', version = '', rest = ''] = cc;
    const port = rest.match(/^\/([a-z]{2,3})(?:\/|$)/)?.[1];
    if (port) return { ok: false, reason: `jurisdiction-ported license ${raw}` };
    const id = `CC-${type.toUpperCase()}-${version}`;
    return (OPEN_LICENSES as readonly string[]).includes(id)
      ? { license: { id: id as OpenLicenseId, url: canonicalCcUrl(type, version) }, ok: true }
      : { ok: false, reason: `${id} is not an open license for this corpus (${raw})` };
  }
  if (/creativecommons\.org\/publicdomain\/zero\/1\.0/.test(url)) {
    return {
      license: { id: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
      ok: true,
    };
  }
  if (/creativecommons\.org\/publicdomain\/mark\/1\.0/.test(url)) {
    return {
      license: { id: 'public-domain', url: 'https://creativecommons.org/publicdomain/mark/1.0/' },
      ok: true,
    };
  }
  if (/arxiv\.org\/licenses\//.test(url)) {
    return { ok: false, reason: `arXiv distribution license ${raw}` };
  }
  return undefined;
}

const canonicalCcUrl = (type: string, version: string) =>
  `https://creativecommons.org/licenses/${type}/${version}/`;

/** Rank of each open license; a source naming several is held to the strictest. */
const STRICTNESS: Record<OpenLicenseId, number> = {
  'CC-BY-2.0': 2,
  'CC-BY-2.5': 2,
  'CC-BY-3.0': 2,
  'CC-BY-4.0': 2,
  'CC-BY-SA-4.0': 3,
  'CC0-1.0': 1,
  'public-domain': 1,
};

/**
 * Settle the license URLs one source states. Any non-open license anywhere refuses the
 * document. Open licenses come from `structured` (an `xlink:href` or `ali:license_ref`)
 * when it names any, else from `prose`. Several open licenses resolve to the strictest,
 * which covers BMC's CC BY article license beside its CC0 waiver for data; two versions
 * of the same license are ambiguous and refuse the document.
 */
function settleLicense(structured: string[], prose: string[], context: string): LicenseVerdict {
  const classify = (urls: string[]) =>
    urls.map((url) => classifyLicenseUrl(url)).filter((v) => v !== undefined);
  const fromStructured = classify(structured);
  const fromProse = classify(prose);
  const refused = [...fromStructured, ...fromProse].find((v) => !v.ok);
  if (refused) return refused;
  const open = (fromStructured.length > 0 ? fromStructured : fromProse).flatMap((v) =>
    v.ok ? [v.license] : [],
  );
  if (open.length === 0) {
    const seen = [...structured, ...prose];
    return {
      ok: false,
      reason: `no recognizable license URL in ${context}${seen.length > 0 ? ` (saw: ${seen.join(', ')})` : ''}`,
      unstated: true,
    };
  }
  const top = Math.max(...open.map((l) => STRICTNESS[l.id]));
  const strictest = [...new Set(open.filter((l) => STRICTNESS[l.id] === top).map((l) => l.id))];
  const license = open.find((l) => l.id === strictest[0]);
  if (strictest.length > 1 || !license) {
    return { ok: false, reason: `conflicting licenses in ${context}: ${strictest.join(', ')}` };
  }
  return { license, ok: true };
}

function requireLicense(verdict: LicenseVerdict): License {
  if (!verdict.ok) fail(`license refused: ${verdict.reason}`);
  return verdict.license;
}

// ── Attribution ─────────────────────────────────────────────────────────────

interface Person {
  collab?: string | undefined;
  family?: string | undefined;
  given?: string | undefined;
}

const initials = (given: string) =>
  given
    .split(/[\s.-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

function formatAuthors(people: Person[]): string {
  const names = people
    .map((p) => p.collab ?? [p.family, p.given ? initials(p.given) : ''].filter(Boolean).join(' '))
    .filter(Boolean);
  if (names.length === 0) return '';
  return names.length > 6 ? `${names.slice(0, 6).join(', ')}, et al.` : `${names.join(', ')}.`;
}

const sentence = (value: string) => (/[.?!]$/.test(value) ? value : `${value}.`);

function formatAttribution(parts: {
  authors: Person[];
  container?: string | undefined;
  doi?: string | undefined;
  issue?: string | undefined;
  pages?: string | undefined;
  title: string;
  trailer?: string | undefined;
  volume?: string | undefined;
  year?: string | undefined;
}): string {
  const venue = [
    parts.container ? `${parts.container}.` : '',
    [
      parts.year,
      parts.volume ? `;${parts.volume}` : '',
      parts.issue ? `(${parts.issue})` : '',
      parts.pages ? `:${parts.pages}` : '',
    ].join(''),
  ]
    .filter(Boolean)
    .join(' ');
  return [
    formatAuthors(parts.authors),
    sentence(parts.title),
    venue && sentence(venue),
    parts.trailer,
    parts.doi ? `doi:${parts.doi}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// ── JATS ────────────────────────────────────────────────────────────────────

interface JatsInfo extends WorkMeta {
  license: LicenseVerdict;
  statement: string;
}

function readJats(source: string, context: string): JatsInfo {
  const tree = parseXml(source);
  const article = findFirst(tree, 'article');
  if (!article) fail(`${context}: no <article> element — not a JATS document`);
  const front = child(article, 'front');
  const meta = child(front, 'article-meta');
  if (!meta) fail(`${context}: no <front>/<article-meta>`);

  const permissions = child(meta, 'permissions');
  if (!permissions) fail(`license refused: ${context} has no <permissions> in <article-meta>`);
  const licenses = findAll([permissions], 'license');
  const structured = [
    ...licenses.map((node) => attr(node, 'xlink:href') ?? ''),
    ...findAll([permissions], 'ali:license_ref').map(text),
  ].filter(Boolean);
  const prose = licenses.flatMap((node) => [
    ...[...findAll([node], 'ext-link'), ...findAll([node], 'uri')].map(
      (link) => attr(link, 'xlink:href') ?? text(link),
    ),
    ...(rawText(node).match(/https?:\/\/[^\s"<>)]+/g) ?? []).map((url) =>
      url.replace(/[.,;:]+$/, ''),
    ),
  ]);
  const license = settleLicense(
    [...new Set(structured)],
    [...new Set(prose.filter(Boolean))],
    `${context} <permissions>`,
  );

  const identifiers: Identifiers = {};
  for (const id of children(meta, 'article-id')) {
    const type = attr(id, 'pub-id-type');
    const value = text(id);
    if (type === 'doi') identifiers.doi = value;
    else if (type === 'pmid' && /^\d+$/.test(value)) identifiers.pmid = value;
    else if (type === 'pmcid' && /^PMC\d+$/.test(value)) identifiers.pmcid = value;
    else if (type === 'pmc' && /^\d+$/.test(value) && !identifiers.pmcid)
      identifiers.pmcid = `PMC${value}`;
  }

  const title = text(child(child(meta, 'title-group'), 'article-title'));
  if (!title) fail(`${context}: no <article-title>`);

  const authors: Person[] = findAll(children(meta, 'contrib-group'), 'contrib')
    .filter((c) => (attr(c, 'contrib-type') ?? 'author') === 'author')
    .map((c) => {
      const collab = child(c, 'collab');
      if (collab) return { collab: text(collab) };
      const name = child(c, 'name') ?? child(c, 'string-name') ?? child(c, 'name-alternatives');
      const nameNode = name && tagOf(name) === 'name-alternatives' ? child(name, 'name') : name;
      return {
        family: text(child(nameNode, 'surname')) || text(nameNode),
        given: text(child(nameNode, 'given-names')),
      };
    });

  const journalMeta = child(front, 'journal-meta');
  const container =
    text(findFirst(journalMeta ? [journalMeta] : [], 'journal-title')) ||
    text(findFirst(journalMeta ? [journalMeta] : [], 'abbrev-journal-title'));
  const dates = children(meta, 'pub-date');
  const dateType = (d: XNode) => attr(d, 'pub-type') ?? attr(d, 'date-type');
  const preferred =
    ['epub', 'pub', 'ppub', 'collection']
      .map((type) => dates.find((d) => dateType(d) === type))
      .find(Boolean) ?? dates[0];
  const fpage = text(child(meta, 'fpage'));
  const lpage = text(child(meta, 'lpage'));
  const pages = fpage
    ? [fpage, lpage].filter(Boolean).join('–')
    : text(child(meta, 'elocation-id'));

  return {
    attribution: formatAttribution({
      authors,
      container,
      doi: identifiers.doi,
      issue: text(child(meta, 'issue')) || undefined,
      pages: pages || undefined,
      title,
      volume: text(child(meta, 'volume')) || undefined,
      year: text(child(preferred, 'year')) || undefined,
    }),
    identifiers,
    license,
    statement: text(permissions),
    title,
  };
}

/**
 * The license a JATS document states. When `<permissions>` names a Creative Commons
 * Attribution license in prose with no URL (older PLOS and F1000Research deposits), the
 * version comes from the publisher's Crossref `vor` license for the same DOI, and must
 * be the license family the prose names.
 */
async function resolveJatsLicense(info: JatsInfo): Promise<License> {
  if (info.license.ok) return info.license.license;
  const refusal = `license refused: ${info.license.reason}; statement reads "${info.statement.slice(0, 300)}"`;
  const namesAttribution = /creative\s+commons\s+attribution/i.test(info.statement);
  const restricted = /non-?commercial|no-?deriv/i.test(info.statement);
  if (!info.license.unstated || !namesAttribution || restricted || !info.identifiers.doi) {
    fail(refusal);
  }
  const doi = info.identifiers.doi;
  const work = await readCrossref(doi);
  const verdict = work ? crossrefLicense(work, doi) : undefined;
  if (!verdict?.ok) fail(`${refusal}; Crossref has no open vor license to supply the version`);
  const shareAlike = /share\s*-?\s*alike/i.test(info.statement);
  if (
    shareAlike !== verdict.license.id.startsWith('CC-BY-SA') ||
    !verdict.license.id.startsWith('CC-BY')
  ) {
    fail(`${refusal}; Crossref's ${verdict.license.id} does not match the license the prose names`);
  }
  console.error(
    `add: version of the prose CC BY statement taken from Crossref: ${verdict.license.id}`,
  );
  return verdict.license;
}

function assertJats(bytes: Uint8Array, url: string): string {
  const source = decode(bytes);
  if (!/<article[\s>]/.test(source)) {
    fail(`${url} returned no <article> (${source.slice(0, 200).replace(/\s+/g, ' ')})`);
  }
  return source;
}

async function fetchEpmc(id: string): Promise<Fetched> {
  const accession = id.toUpperCase();
  if (!/^(PMC|PPR)\d+$/.test(accession)) fail(`epmc takes a PMCID or PPR ID, got "${id}"`);
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/${accession}/fullTextXML`;
  const result = await getOk(url, 'epmc', 'application/xml');
  const info = readJats(assertJats(result.bytes, url), accession);
  return {
    attribution: info.attribution,
    bytes: result.bytes,
    identifiers: info.identifiers,
    license: await resolveJatsLicense(info),
    title: info.title,
    defaultId: `epmc-${accession.toLowerCase()}`,
    flavor: 'europepmc',
    format: 'jats',
    url,
  };
}

async function fetchPmc(id: string): Promise<Fetched> {
  const numeric = id.toUpperCase().replace(/^PMC/, '');
  if (!/^\d+$/.test(numeric)) fail(`pmc takes a PMCID, got "${id}"`);
  const params = new URLSearchParams({ db: 'pmc', id: numeric });
  if (CONTACT) params.set('email', CONTACT);
  params.set('tool', 'scholarly-parse');
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${params}`;
  const result = await getOk(url, 'ncbi', 'application/xml');
  const info = readJats(assertJats(result.bytes, url), `PMC${numeric}`);
  return {
    attribution: info.attribution,
    bytes: result.bytes,
    identifiers: info.identifiers,
    license: await resolveJatsLicense(info),
    title: info.title,
    defaultId: `pmc-pmc${numeric}`,
    flavor: 'pmc',
    format: 'jats',
    url: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${numeric}`,
  };
}

// ── arXiv ───────────────────────────────────────────────────────────────────

const ARXIV_ID = /^((?:\d{4}\.\d{4,5})|(?:[a-z-]+(?:\.[A-Z]{2})?\/\d{7}))(v\d+)?$/;

async function readArxiv(id: string): Promise<WorkMeta & { license: License }> {
  const match = id.match(ARXIV_ID);
  if (!match) fail(`not an arXiv identifier: "${id}"`);
  const base = match[1] ?? id;
  const url = `https://oaipmh.arxiv.org/oai?verb=GetRecord&identifier=oai:arXiv.org:${base}&metadataPrefix=arXiv`;
  const result = await getOk(url, 'arxiv', 'application/xml');
  const tree = parseXml(decode(result.bytes));
  const error = findFirst(tree, 'error');
  if (error) fail(`arXiv OAI-PMH: ${attr(error, 'code') ?? 'error'} — ${text(error)}`);
  const record = findFirst(tree, 'arXiv');
  if (!record) fail(`arXiv OAI-PMH returned no <arXiv> record for ${base}`);

  const licenseUrl = text(child(record, 'license'));
  if (!licenseUrl) {
    fail(`license refused: arXiv:${base} states no license (arXiv's default distribution terms)`);
  }
  const license = requireLicense(settleLicense([licenseUrl], [], `arXiv:${base}`));
  const title = text(child(record, 'title'));
  const authors = children(child(record, 'authors'), 'author').map((a) => ({
    family: text(child(a, 'keyname')),
    given: text(child(a, 'forenames')),
  }));
  const journalDoi = text(child(record, 'doi')).split(/\s+/)[0];
  const identifiers: Identifiers = { arxiv: id, ...(journalDoi ? { doi: journalDoi } : {}) };
  return {
    attribution: formatAttribution({
      authors,
      title,
      trailer: `arXiv:${id}. ${text(child(record, 'created')).slice(0, 4)}.`,
    }),
    identifiers,
    license,
    title,
  };
}

async function fetchLatexml(kind: 'arxiv' | 'ar5iv', id: string): Promise<Fetched> {
  if (kind === 'arxiv' && !/v\d+$/.test(id)) {
    fail('arxiv takes a versioned ID (e.g. 2401.04088v1) so the fixture pins one version');
  }
  const work = await readArxiv(id);
  const url =
    kind === 'arxiv' ? `https://arxiv.org/html/${id}` : `https://ar5iv.labs.arxiv.org/html/${id}`;
  const result = await getOk(url, 'arxiv', 'text/html');
  const html = decode(result.bytes);
  if (!/class="ltx_(?:page_main|document)/.test(html)) {
    fail(`${result.url} is not a LaTeXML render (no ltx_page_main/ltx_document)`);
  }
  return {
    ...work,
    bytes: result.bytes,
    defaultId: `${kind}-${id.toLowerCase().replaceAll('/', '-')}`,
    flavor: kind,
    format: 'latexml',
    url: result.url,
  };
}

// ── Publisher PDF and HTML ──────────────────────────────────────────────────

interface CrossrefWork {
  'article-number'?: string;
  author?: { family?: string; given?: string; name?: string }[];
  'container-title'?: string[];
  /** A posted preprint's server (`medRxiv`), which Crossref gives no container title. */
  institution?: { name?: string }[];
  issue?: string;
  issued?: { 'date-parts'?: number[][] };
  license?: { 'content-version'?: string; start?: { 'date-parts'?: number[][] }; URL: string }[];
  page?: string;
  title?: string[];
  volume?: string;
}

async function readCrossref(doi: string): Promise<CrossrefWork | undefined> {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  const result = await get(url, 'crossref', 'application/json');
  if (result.status === 404) return undefined;
  if (result.status !== 200) fail(`Crossref ${url} returned HTTP ${result.status}`);
  return (JSON.parse(decode(result.bytes)) as { message: CrossrefWork }).message;
}

/**
 * The version-of-record license in a Crossref record. With no `vor` entry, an
 * `unspecified` entry (which applies to every version) stands in; `am` and `tdm`
 * entries never do.
 */
function crossrefLicense(work: CrossrefWork, doi: string): LicenseVerdict | undefined {
  const today = new Date().toISOString().slice(0, 10);
  const entries = work.license ?? [];
  const byVersion = (version: string) => entries.filter((l) => l['content-version'] === version);
  const vor = byVersion('vor').length > 0 ? byVersion('vor') : byVersion('unspecified');
  if (vor.length === 0) return undefined;
  const future = vor.find((l) => {
    const [y, m = 1, d = 1] = l.start?.['date-parts']?.[0] ?? [];
    return (
      y !== undefined && `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` > today
    );
  });
  if (future) return { ok: false, reason: `Crossref vor license for ${doi} starts in the future` };
  return settleLicense(
    vor.map((l) => l.URL),
    [],
    `Crossref vor license for ${doi}`,
  );
}

function crossrefWorkMeta(work: CrossrefWork, doi: string): WorkMeta {
  const title = squash(work.title?.[0] ?? '');
  return {
    attribution: formatAttribution({
      authors: (work.author ?? []).map((a) =>
        a.name ? { collab: a.name } : { family: a.family, given: a.given },
      ),
      container: work['container-title']?.[0] ?? work.institution?.[0]?.name,
      doi,
      issue: work.issue,
      pages: work.page ?? work['article-number'],
      title,
      volume: work.volume,
      year: work.issued?.['date-parts']?.[0]?.[0]?.toString(),
    }),
    identifiers: { doi },
    title,
  };
}

/** The same work's JATS on Europe PMC, found by DOI. */
async function jatsForDoi(doi: string): Promise<JatsInfo | undefined> {
  const query = new URLSearchParams({
    format: 'json',
    pageSize: '1',
    query: `DOI:"${doi}"`,
    resultType: 'lite',
  });
  const search = await getOk(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${query}`,
    'epmc',
    'application/json',
  );
  const hit = (
    JSON.parse(decode(search.bytes)) as { resultList?: { result?: { pmcid?: string }[] } }
  ).resultList?.result?.[0];
  if (!hit?.pmcid) return undefined;
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/${hit.pmcid}/fullTextXML`;
  const result = await get(url, 'epmc', 'application/xml');
  if (result.status !== 200) return undefined;
  return readJats(assertJats(result.bytes, url), `${hit.pmcid} (JATS for ${doi})`);
}

async function publisherWork(doi: string): Promise<WorkMeta & { license: License }> {
  const work = await readCrossref(doi);
  const verdict = work ? crossrefLicense(work, doi) : undefined;
  if (verdict && !verdict.ok) fail(`license refused: ${verdict.reason}`);
  if (verdict?.ok && work) return { ...crossrefWorkMeta(work, doi), license: verdict.license };
  const jats = await jatsForDoi(doi);
  if (!jats) {
    fail(
      `license refused: Crossref has no vor license for ${doi} and Europe PMC has no JATS for it`,
    );
  }
  const license = await resolveJatsLicense(jats);
  return { ...(work ? crossrefWorkMeta(work, doi) : jats), license };
}

/** A bot check or block page served in place of the document ends the run. */
function assertNotChallenge(result: HttpResult): void {
  if ([401, 403, 429, 503].includes(result.status)) {
    fail(`${result.url} answered HTTP ${result.status} — blocked; skip this source`);
  }
  const reason = interstitialReason(decode(result.bytes));
  if (reason) fail(`${result.url}: ${reason} — skip this source`);
}

/**
 * A publisher PDF or article page. The HTML flavor names the host that served the bytes,
 * while `url` stays the address requested: publisher redirects can append session
 * tokens (Springer Nature's `?error=cookies_not_supported&code=…`).
 */
async function fetchPublisher(
  kind: 'pdf' | 'html',
  url: string,
  doi: string | undefined,
  arxiv: string | undefined,
): Promise<Fetched> {
  if (!doi && !(kind === 'pdf' && arxiv)) {
    fail(`${kind} needs --doi <doi>${kind === 'pdf' ? ' (or --arxiv <id> for an arXiv PDF)' : ''}`);
  }
  const work = doi ? await publisherWork(doi) : await readArxiv(arxiv ?? '');
  if (doi && arxiv) work.identifiers.arxiv = arxiv;

  const result = await get(url, 'publisher', kind === 'pdf' ? 'application/pdf' : 'text/html');
  assertNotChallenge(result);
  if (result.status !== 200) fail(`GET ${url} returned HTTP ${result.status}`);
  if (kind === 'pdf') {
    if (decode(result.bytes.slice(0, 5)) !== '%PDF-') {
      fail(`${result.url} is not a PDF (content-type ${result.contentType || 'none'})`);
    }
  } else {
    const html = decode(result.bytes).toLowerCase();
    if (!/<html[\s>]/.test(html)) fail(`${result.url} is not HTML (${result.contentType})`);
    const titleProbe = work.title.toLowerCase().slice(0, 40);
    if (!(doi && html.includes(doi.toLowerCase())) && !html.includes(titleProbe)) {
      fail(`${result.url} mentions neither the DOI nor the title — not the article page`);
    }
  }
  const host = new URL(result.url).hostname.replace(/^www\./, '');
  const stem = (doi ?? arxiv ?? '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  return {
    ...work,
    bytes: result.bytes,
    defaultId: `${host.split('.').at(-2) ?? 'doi'}-${stem}`,
    ...(kind === 'html' ? { flavor: host } : {}),
    format: kind,
    url,
  };
}

// ── Grobid ──────────────────────────────────────────────────────────────────

async function fetchGrobid(pdfFixtureId: string): Promise<Fetched> {
  const dir = join(CORPUS_DIR, 'pdf', pdfFixtureId);
  const metaPath = join(dir, 'meta.json');
  if (!existsSync(metaPath)) fail(`no PDF fixture at corpus/pdf/${pdfFixtureId}`);
  const pdfMeta = fixtureMetaSchema.parse(JSON.parse(readFileSync(metaPath, 'utf8')));
  const base = (process.env.GROBID_URL ?? 'http://localhost:8070').replace(/\/$/, '');

  const versionResult = await get(`${base}/api/version`, 'grobid', 'application/json, text/plain');
  if (versionResult.status !== 200) fail(`Grobid at ${base} is not answering /api/version`);
  // Grobid 0.9 answers with JSON ({"version":"0.9.1",…}); earlier releases with plain text.
  const versionText = decode(versionResult.bytes).trim();
  const version = versionText.startsWith('{')
    ? (JSON.parse(versionText) as { version: string }).version
    : versionText;

  const form = new FormData();
  form.set('input', new Blob([readFileSync(join(dir, 'source.pdf'))], { type: 'application/pdf' }));
  form.set('consolidateHeader', '0');
  form.set('consolidateCitations', '0');
  form.set('consolidateFunders', '0');
  const response = await fetch(`${base}/api/processFulltextDocument`, {
    body: form,
    headers: { Accept: 'application/xml' },
    method: 'POST',
    signal: AbortSignal.timeout(600_000),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (response.status !== 200) {
    fail(`Grobid answered HTTP ${response.status}: ${decode(bytes).slice(0, 300)}`);
  }
  if (!/<TEI[\s>]/.test(decode(bytes.slice(0, 4096)))) fail('Grobid returned no <TEI> document');

  const stem = pdfFixtureId.replace(/^[^-]+-/, '');
  return {
    attribution: pdfMeta.attribution,
    bytes,
    defaultId: `grobid-${stem}`,
    derivedFrom: { fixture: pdfFixtureId, tool: `grobid ${version}` },
    flavor: 'grobid',
    format: 'tei',
    identifiers: pdfMeta.identifiers,
    license: pdfMeta.license,
    notes:
      'processFulltextDocument with consolidateHeader, consolidateCitations, and consolidateFunders off.',
    title: pdfMeta.title,
    url: pdfMeta.url,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    arxiv: { type: 'string' },
    doi: { type: 'string' },
    'dry-run': { type: 'boolean' },
    features: { type: 'string' },
    id: { type: 'string' },
    notes: { type: 'string' },
    regression: { type: 'string' },
  },
});

const [kindArg, identifier] = positionals;
if (!kindArg || !identifier || !KINDS.includes(kindArg as Kind) || positionals.length > 2) {
  fail(
    `usage: bun run scripts/corpus/add.ts <${KINDS.join('|')}> <identifier> [--features a,b] [--regression cyanheads/<repo>#N] [--id <fixture-id>] [--notes "…"] [--doi <doi>] [--arxiv <id>] [--dry-run]`,
  );
}
const kind = kindArg as Kind;

const features = (values.features ?? '')
  .split(',')
  .map((f) => f.trim())
  .filter(Boolean);
const unknown = features.filter((f) => !(FEATURES as readonly string[]).includes(f));
if (unknown.length > 0) {
  fail(
    `unknown feature tag(s): ${unknown.join(', ')} — add them to tests/corpus/features.ts first`,
  );
}

let fetched: Fetched;
switch (kind) {
  case 'epmc':
    fetched = await fetchEpmc(identifier);
    break;
  case 'pmc':
    fetched = await fetchPmc(identifier);
    break;
  case 'arxiv':
  case 'ar5iv':
    fetched = await fetchLatexml(kind, identifier);
    break;
  case 'pdf':
  case 'html':
    fetched = await fetchPublisher(kind, identifier, values.doi, values.arxiv);
    break;
  case 'grobid':
    fetched = await fetchGrobid(identifier);
    break;
}

if (fetched.bytes.byteLength > MAX_SOURCE_BYTES) {
  fail(`${fetched.url} is ${fetched.bytes.byteLength} bytes, over the 8 MB fixture limit`);
}

const id = values.id ?? fetched.defaultId;
const notes = [fetched.notes, values.notes].filter(Boolean).join(' ');
/** Key order follows `corpus/README.md`; the schema check runs on the same object. */
const meta = {
  id,
  format: fetched.format,
  ...(fetched.flavor ? { flavor: fetched.flavor } : {}),
  title: fetched.title,
  identifiers: fetched.identifiers,
  url: fetched.url,
  retrieved: new Date().toISOString().slice(0, 10),
  license: fetched.license,
  attribution: fetched.attribution,
  features,
  ...(values.regression ? { regression: values.regression } : {}),
  ...(notes ? { notes } : {}),
  ...(fetched.derivedFrom ? { derivedFrom: fetched.derivedFrom } : {}),
};
const check = fixtureMetaSchema.safeParse(meta);
if (!check.success) {
  fail(`meta.json would be invalid:\n${JSON.stringify(check.error.issues, null, 2)}`);
}

const dir = join(CORPUS_DIR, fetched.format, id);
const metaJson = `${JSON.stringify(meta, null, 2)}\n`;
if (values['dry-run']) {
  console.log(metaJson);
  console.log(`dry run: ${fetched.bytes.byteLength} bytes would go to ${dir}`);
  process.exit(0);
}
if (existsSync(dir)) fail(`${dir} already exists — remove it first to re-add`);

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, SOURCE_FILE[fetched.format]), fetched.bytes);
writeFileSync(join(dir, 'meta.json'), metaJson);
console.log(
  `added ${fetched.format}/${id} (${fetched.bytes.byteLength} bytes, ${fetched.license.id})`,
);

const attribution = spawnSync('bun', ['run', join(import.meta.dirname, 'attribution.ts')], {
  cwd: join(CORPUS_DIR, '..'),
  stdio: 'inherit',
});
process.exit(attribution.status ?? 1);
