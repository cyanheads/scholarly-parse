/**
 * @fileoverview Front matter: `<article-meta>` and `<journal-meta>` → metadata, and every
 * `<abstract>` / `<trans-abstract>` with its kind.
 * @module src/formats/jats/front
 */
import type {
  Abstract,
  AbstractKind,
  Author,
  Block,
  DocumentMetadata,
  Identifiers,
  License,
  PartialDate,
  Section,
  Venue,
} from '../../model/document.js';
import { escapeInline } from '../../render/escape.js';
import {
  attrOf,
  childrenOf,
  findAll,
  findAllDescendants,
  findOne,
  isTextNode,
  tagNameOf,
  type XmlNode,
} from '../../xml/ordered.js';
import { flowBlocks, parseSection } from './blocks.js';
import type { JatsContext } from './context.js';
import { inlineText } from './inline.js';
import { text } from './text.js';

/** Metadata from `<front>`; `article` supplies `@article-type` and `@xml:lang`. */
export function extractMetadata(
  article: XmlNode,
  articleMeta: XmlNode | undefined,
  journalMeta: XmlNode | undefined,
  ctx: JatsContext,
): DocumentMetadata {
  const titleGroup = findOne(articleMeta, 'title-group');
  const title = inlineText(findOne(titleGroup, 'article-title'), ctx);
  const subtitle = inlineText(findOne(titleGroup, 'subtitle'), ctx);
  const { affiliations, authors } = extractContributors(articleMeta);
  const identifiers = extractIdentifiers(articleMeta);
  const venue = extractVenue(journalMeta, articleMeta);
  const published = extractPublished(articleMeta);
  const keywords = findAll(articleMeta, 'kwd-group')
    .flatMap((group) => findAll(group, 'kwd').map((kwd) => text(kwd)))
    .filter(Boolean);
  const license = extractLicense(findOne(articleMeta, 'permissions'));
  const articleType = attrOf(article, 'article-type');
  const language = attrOf(article, 'xml:lang');

  return {
    ...(title && { title }),
    ...(subtitle && { subtitle }),
    ...(authors.length > 0 && { authors }),
    ...(affiliations.length > 0 && { affiliations }),
    ...(Object.keys(identifiers).length > 0 && { identifiers }),
    ...(venue && { venue }),
    ...(published && { published }),
    ...(keywords.length > 0 && { keywords }),
    ...(license && { license }),
    ...(articleType && { articleType }),
    ...(language && { language }),
  };
}

// ─── Contributors ───────────────────────────────────────────────────────────

/**
 * Authors across every `<contrib-group>`, and the affiliations they point to. An `<aff>`
 * may sit in `<article-meta>`, in a `<contrib-group>`, or inside a `<contrib>`; each is
 * listed once, and an author's `<xref ref-type="aff">` resolves to its index.
 */
function extractContributors(articleMeta: XmlNode | undefined): {
  affiliations: string[];
  authors: Author[];
} {
  const affiliations: string[] = [];
  const affIndex = new Map<string, number>();
  const nodeIndex = new Map<XmlNode, number>();
  for (const aff of findAllDescendants(articleMeta, 'aff')) {
    const id = attrOf(aff, 'id');
    const existing = id === undefined ? undefined : affIndex.get(id);
    if (existing !== undefined) {
      nodeIndex.set(aff, existing);
      continue;
    }
    const value = text(childrenOf(aff).filter((c) => tagNameOf(c) !== 'label'));
    if (!value) continue;
    const index = affiliations.push(value) - 1;
    nodeIndex.set(aff, index);
    if (id) affIndex.set(id, index);
  }

  const authors: Author[] = [];
  for (const group of findAll(articleMeta, 'contrib-group')) {
    for (const contrib of findAll(group, 'contrib')) {
      const type = attrOf(contrib, 'contrib-type');
      if (type && type !== 'author') continue;
      const author = parseContributor(contrib, affIndex, nodeIndex);
      if (author) authors.push(author);
    }
  }
  return { affiliations, authors };
}

function parseContributor(
  contrib: XmlNode,
  affIndex: Map<string, number>,
  nodeIndex: Map<XmlNode, number>,
): Author | undefined {
  const affiliations = new Set<number>();
  let corresponding = attrOf(contrib, 'corresp') === 'yes';
  for (const xref of findAll(contrib, 'xref')) {
    const refType = attrOf(xref, 'ref-type');
    if (refType === 'corresp') corresponding = true;
    if (refType !== 'aff') continue;
    for (const rid of (attrOf(xref, 'rid') ?? '').split(/\s+/)) {
      const index = affIndex.get(rid);
      if (index !== undefined) affiliations.add(index);
    }
  }
  for (const aff of findAll(contrib, 'aff')) {
    const index = nodeIndex.get(aff);
    if (index !== undefined) affiliations.add(index);
  }

  const orcidNode = findAll(contrib, 'contrib-id').find(
    (id) => attrOf(id, 'contrib-id-type') === 'orcid',
  );
  const orcid = orcidNode ? /(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/.exec(text(orcidNode))?.[1] : undefined;
  const email = text(findOne(contrib, 'email')) || undefined;
  const extras = {
    ...(affiliations.size > 0 && { affiliations: [...affiliations].sort((a, b) => a - b) }),
    ...(corresponding && { corresponding: true }),
    ...(email && { email }),
    ...(orcid && { orcid }),
  };

  const named = contributorName(contrib);
  if (!named) return;
  return { ...named, ...extras };
}

/** A contributor's name: a collective's, else its personal name and parts. */
function contributorName(
  contrib: XmlNode,
): Pick<Author, 'collective' | 'family' | 'given' | 'name'> | undefined {
  const collab = findOne(contrib, 'collab');
  if (collab) {
    const name = text(childrenOf(collab).filter((c) => tagNameOf(c) !== 'contrib-group'));
    return name ? { collective: name, name } : undefined;
  }
  const nameNode =
    findOne(contrib, 'name') ??
    findOne(findOne(contrib, 'name-alternatives'), 'name') ??
    findOne(contrib, 'string-name');
  if (!nameNode) return;
  const family = text(findOne(nameNode, 'surname')) || undefined;
  const given = text(findOne(nameNode, 'given-names')) || undefined;
  const name = [given, family].filter(Boolean).join(' ') || text(nameNode);
  if (!name) return;
  return { name, ...(family && { family }), ...(given && { given }) };
}

/**
 * What a `<sub-article>` shows above its body: who wrote it, each with their role
 * (`Werner Kühlbrandt (Reviewer)`), then its author notes, such as a reviewer's
 * competing-interests statement.
 */
export function subArticleFront(meta: XmlNode | undefined, ctx: JatsContext): Block[] {
  const people = findAll(meta, 'contrib-group')
    .flatMap((group) => findAll(group, 'contrib'))
    .flatMap((contrib) => {
      const name = contributorName(contrib)?.name;
      const role = text(findOne(contrib, 'role'));
      return name ? [escapeInline(role ? `${name} (${role})` : name)] : [];
    });
  const notes = findAll(findOne(meta, 'author-notes'), 'fn').flatMap((fn) =>
    flowBlocks(
      childrenOf(fn).filter((child) => tagNameOf(child) !== 'label'),
      ctx,
    ),
  );
  return [
    ...(people.length > 0 ? [{ text: people.join(', '), type: 'paragraph' as const }] : []),
    ...notes,
  ];
}

/**
 * Note ID → names of the authors who point at the note with `<xref ref-type="fn">`:
 * eLife lists each author's contribution and competing interests as notes that do not
 * name the author themselves.
 */
export function noteOwners(articleMeta: XmlNode | undefined): Map<string, string[]> {
  const owners = new Map<string, string[]>();
  for (const group of findAll(articleMeta, 'contrib-group')) {
    for (const contrib of findAll(group, 'contrib')) {
      const type = attrOf(contrib, 'contrib-type');
      const name = (!type || type === 'author') && contributorName(contrib)?.name;
      if (!name) continue;
      for (const xref of findAll(contrib, 'xref')) {
        if (attrOf(xref, 'ref-type') !== 'fn') continue;
        for (const rid of (attrOf(xref, 'rid') ?? '').split(/\s+/).filter(Boolean)) {
          owners.set(rid, [...(owners.get(rid) ?? []), name]);
        }
      }
    }
  }
  return owners;
}

// ─── Identifiers, venue, date, license ──────────────────────────────────────

function extractIdentifiers(articleMeta: XmlNode | undefined): Identifiers {
  const ids: Identifiers = {};
  const other: Record<string, string> = {};
  for (const node of findAll(articleMeta, 'article-id')) {
    const type = attrOf(node, 'pub-id-type') ?? '';
    const value = text(node);
    if (!value) continue;
    if (type === 'doi') ids.doi ??= value.toLowerCase();
    else if (type === 'pmid') ids.pmid ??= value;
    else if (type === 'pmcid' || type === 'pmc' || type === 'pmc-uid' || type === 'pmcaid') {
      if (/^(PMC)?\d+$/.test(value)) ids.pmcid ??= value.startsWith('PMC') ? value : `PMC${value}`;
    } else if (type === 'arxiv') ids.arxiv ??= value.replace(/^arxiv:/i, '');
    else if (type) other[type] ??= value;
  }
  return { ...ids, ...(Object.keys(other).length > 0 && { other }) };
}

function extractVenue(
  journalMeta: XmlNode | undefined,
  articleMeta: XmlNode | undefined,
): Venue | undefined {
  const title =
    text(findOne(findOne(journalMeta, 'journal-title-group'), 'journal-title')) ||
    text(findOne(journalMeta, 'journal-title'));
  const issns = findAll(journalMeta, 'issn');
  const issnNode =
    issns.find((n) =>
      ['epub', 'electronic'].includes(
        attrOf(n, 'pub-type') ?? attrOf(n, 'publication-format') ?? '',
      ),
    ) ?? issns[0];
  const issn = text(issnNode);
  const publisher = text(findOne(findOne(journalMeta, 'publisher'), 'publisher-name'));
  const volume = text(findOne(articleMeta, 'volume'));
  const issue = text(findOne(articleMeta, 'issue'));
  const fpage = text(findOne(articleMeta, 'fpage'));
  const lpage = text(findOne(articleMeta, 'lpage'));
  const pages = fpage && lpage ? `${fpage}-${lpage}` : fpage;
  const elocationId = text(findOne(articleMeta, 'elocation-id'));
  const venue: Venue = {
    ...(title && { title }),
    ...(issn && { issn }),
    ...(publisher && { publisher }),
    ...(volume && { volume }),
    ...(issue && { issue }),
    ...(pages && { pages }),
    ...(elocationId && { elocationId }),
  };
  return Object.keys(venue).length > 0 ? venue : undefined;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function monthOf(value: string): number | undefined {
  const numeric = Number.parseInt(value, 10);
  if (numeric >= 1 && numeric <= 12) return numeric;
  const index = MONTHS.indexOf(value.slice(0, 3).toLowerCase());
  return index === -1 ? undefined : index + 1;
}

/** The publication date: electronic first, then print, then the first one given. */
function extractPublished(articleMeta: XmlNode | undefined): PartialDate | undefined {
  const dates = findAll(articleMeta, 'pub-date');
  const kindOf = (d: XmlNode) => attrOf(d, 'pub-type') ?? attrOf(d, 'date-type') ?? '';
  const preferred =
    dates.find((d) => kindOf(d) === 'epub') ??
    dates.find((d) => kindOf(d) === 'ppub') ??
    dates.find((d) => kindOf(d) === 'pub') ??
    dates[0];
  const year = Number.parseInt(text(findOne(preferred, 'year')), 10);
  if (!Number.isFinite(year)) return;
  const month = monthOf(text(findOne(preferred, 'month')));
  const day = Number.parseInt(text(findOne(preferred, 'day')), 10);
  return { year, ...(month && { month }), ...(month && day >= 1 && day <= 31 && { day }) };
}

/** The license a `<permissions>` declares: URL from `@xlink:href` or `<ali:license_ref>`, statement text verbatim. */
function extractLicense(permissions: XmlNode | undefined): License | undefined {
  const licenseNode = findOne(permissions, 'license');
  const ref = findAllDescendants(permissions, 'ali:license_ref')[0];
  const url = attrOf(licenseNode, 'xlink:href') || text(ref) || undefined;
  const statement = text(findAll(licenseNode, 'license-p')) || undefined;
  if (!url && !statement) return;
  return { ...(url && { url: url.trim() }), ...(statement && { text: statement }) };
}

// ─── Abstracts ──────────────────────────────────────────────────────────────

/**
 * `@abstract-type` values and the kind each is reported as. Anything untyped is the
 * article's own abstract. Publishers routinely deposit a graphical abstract or
 * highlights before it — 21 of 68 records in one draw carried more than one — so the
 * kind decides, never the order. (pubmed-mcp-server#134)
 */
const ABSTRACT_KINDS: Readonly<Record<string, AbstractKind>> = {
  'author-summary': 'plain-language',
  'executive-summary': 'plain-language',
  graphical: 'graphical',
  'key-points': 'other',
  'lay-summary': 'plain-language',
  'plain-language-summary': 'plain-language',
  short: 'teaser',
  summary: 'plain-language',
  // PLOS's early lay summaries, before it named them author summaries.
  synopsis: 'plain-language',
  teaser: 'teaser',
  toc: 'teaser',
};

/** Every abstract under `<article-meta>`, main first. */
export function extractAbstracts(articleMeta: XmlNode | undefined, ctx: JatsContext): Abstract[] {
  const abstracts: Abstract[] = [];
  for (const node of childrenOf(articleMeta)) {
    const tag = tagNameOf(node);
    if (tag !== 'abstract' && tag !== 'trans-abstract') continue;
    const type = attrOf(node, 'abstract-type')?.toLowerCase();
    const kind: AbstractKind =
      tag === 'trans-abstract' ? 'translated' : type ? (ABSTRACT_KINDS[type] ?? 'other') : 'main';
    const parsed = parseAbstract(node, kind, abstracts.length, ctx);
    if (parsed) abstracts.push(parsed);
  }
  return abstracts.sort((a, b) => Number(b.kind === 'main') - Number(a.kind === 'main'));
}

function parseAbstract(
  node: XmlNode,
  kind: AbstractKind,
  index: number,
  ctx: JatsContext,
): Abstract | undefined {
  const title = inlineText(findOne(node, 'title'), ctx);
  const language = attrOf(node, 'xml:lang');
  const sections: Section[] = [];
  const loose: XmlNode[] = [];
  const idBase = `abstract-${index + 1}`;
  const flushLoose = () => {
    const blocks = flowBlocks(loose.splice(0), ctx);
    if (blocks.length > 0)
      sections.push({ blocks, id: `${idBase}-${sections.length + 1}`, kind: 'body', sections: [] });
  };
  for (const child of childrenOf(node)) {
    const tag = tagNameOf(child);
    if (tag === 'title' || tag === 'label') continue;
    if (tag === 'sec') {
      flushLoose();
      const section = parseSection(child, ctx, 'body', `${idBase}-${sections.length + 1}`);
      if (section) sections.push(section);
    } else if (!isTextNode(child) || text(child)) {
      loose.push(child);
    }
  }
  flushLoose();
  if (sections.length === 0) return;
  const showTitle = title && !/^abstract$/i.test(title);
  return { kind, ...(language && { language }), sections, ...(showTitle && { title }) };
}
