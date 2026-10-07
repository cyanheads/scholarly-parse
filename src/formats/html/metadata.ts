/**
 * @fileoverview Front matter from a publisher page's `<meta>` tags: the Highwire Press
 * `citation_*` set (what Google Scholar indexes, so nearly every scholarly page carries
 * it), Dublin Core `dc.*`, and the license a `<link>`, `<a>`, or `<area>` names with
 * `rel="license"`. Reading tags instead of the visible header avoids every publisher's
 * own author-list and affiliation markup.
 * @module src/formats/html/metadata
 */
import type { Author, DocumentMetadata, PartialDate, Reference } from '../../model/document.js';
import { normalizeDoi } from '../../model/doi.js';
import { escapeInline } from '../../render/escape.js';

/** One `<meta>` tag: lowercased `name` (or `property`) and its content. */
interface MetaTag {
  content: string;
  name: string;
}

/** Every named `<meta>` tag with content, in document order. */
export function readMetaTags(document: Document): MetaTag[] {
  return Array.from(document.querySelectorAll('meta')).flatMap((meta) => {
    const name = (meta.getAttribute('name') ?? meta.getAttribute('property') ?? '')
      .trim()
      .toLowerCase();
    const content = meta.getAttribute('content')?.replace(/\s+/g, ' ').trim();
    return name && content ? [{ content, name }] : [];
  });
}

function first(tags: MetaTag[], ...names: string[]): string | undefined {
  for (const name of names) {
    const tag = tags.find((t) => t.name === name);
    if (tag) return tag.content;
  }
  return;
}

function all(tags: MetaTag[], name: string): string[] {
  return tags.filter((t) => t.name === name).map((t) => t.content);
}

/** The title the `citation_title` or `dc.title` tag names, as source text. */
export function titleTag(tags: MetaTag[]): string | undefined {
  return first(tags, 'citation_title', 'dc.title');
}

/** `2024/05/12`, `2024-05-12`, `2024-05`, `2024`, `May 12, 2024` → a partial date. */
export function parseDate(value: string | undefined): PartialDate | undefined {
  if (!value) return;
  const numeric = /^(\d{4})(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?)?/.exec(value.trim());
  if (numeric) {
    const [, year, month, day] = numeric;
    return {
      year: Number(year),
      ...(month && Number(month) >= 1 && Number(month) <= 12 && { month: Number(month) }),
      ...(month && day && Number(day) >= 1 && Number(day) <= 31 && { day: Number(day) }),
    };
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return;
  const date = new Date(parsed);
  return { day: date.getUTCDate(), month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
}

/** An author from a `citation_author` value: `Family, Given` or `Given Family`. */
function authorFrom(value: string): Author {
  const comma = value.indexOf(',');
  if (comma === -1) return { name: value };
  const family = value.slice(0, comma).trim();
  const given = value.slice(comma + 1).trim();
  return { family, ...(given && { given }), name: given ? `${given} ${family}` : family };
}

/**
 * Front matter from the page's tags. `fallbackTitle` is the visible title heading as
 * inline Markdown, used as given when no `citation_title` or `dc.title` tag names one;
 * tag values are source text and are escaped.
 */
export function extractMetadata(
  document: Document,
  tags: MetaTag[],
  fallbackTitle: string | undefined,
): DocumentMetadata {
  // Each affiliation's index, and each author's indices in the order the tags give them.
  const affiliationIndex = new Map<string, number>();
  const authorAffiliations = new Map<Author, Set<number>>();
  const authors: Author[] = [];
  for (const tag of tags) {
    const current = authors.at(-1);
    if (tag.name === 'citation_author') {
      authors.push(authorFrom(tag.content));
    } else if (current && tag.name === 'citation_author_institution') {
      let index = affiliationIndex.get(tag.content);
      if (index === undefined) {
        index = affiliationIndex.size;
        affiliationIndex.set(tag.content, index);
      }
      const indices = authorAffiliations.get(current) ?? new Set();
      authorAffiliations.set(current, indices.add(index));
    } else if (current && tag.name === 'citation_author_orcid') {
      const orcid = /\d{4}-\d{4}-\d{4}-\d{3}[\dX]/.exec(tag.content)?.[0];
      if (orcid) current.orcid = orcid;
    } else if (current && tag.name === 'citation_author_email') {
      current.email = tag.content;
    }
  }
  for (const [author, indices] of authorAffiliations) author.affiliations = [...indices];
  const affiliations = [...affiliationIndex.keys()];
  if (authors.length === 0)
    for (const creator of all(tags, 'dc.creator')) authors.push(authorFrom(creator));

  // Tag values are source text; the fallback is already inline Markdown.
  const tagTitle = titleTag(tags);
  const ogTitle = first(tags, 'og:title');
  const title =
    tagTitle !== undefined
      ? escapeInline(tagTitle)
      : fallbackTitle || (ogTitle !== undefined ? escapeInline(ogTitle) : undefined);
  const doi = normalizeDoi(
    first(tags, 'citation_doi', 'prism.doi') ??
      all(tags, 'dc.identifier').find((value) => /10\.\d{4,9}\//.test(value)),
  );
  const pmid = first(tags, 'citation_pmid')?.replace(/\D/g, '');
  const pmcid = /PMC\d+/i.exec(first(tags, 'citation_pmcid') ?? '')?.[0]?.toUpperCase();
  const arxiv = first(tags, 'citation_arxiv_id')?.replace(/^arxiv:/i, '');
  const identifiers = {
    ...(doi && { doi }),
    ...(pmid && { pmid }),
    ...(pmcid && { pmcid }),
    ...(arxiv && { arxiv }),
  };

  const firstPage = first(tags, 'citation_firstpage');
  const lastPage = first(tags, 'citation_lastpage');
  const venue = {
    ...optional(
      'title',
      first(
        tags,
        'citation_journal_title',
        'citation_conference_title',
        'citation_inbook_title',
        'prism.publicationname',
      ),
    ),
    ...optional('volume', first(tags, 'citation_volume', 'prism.volume')),
    ...optional('issue', first(tags, 'citation_issue', 'prism.number')),
    ...optional(
      'pages',
      firstPage && lastPage && firstPage !== lastPage ? `${firstPage}–${lastPage}` : firstPage,
    ),
    ...optional('publisher', first(tags, 'citation_publisher', 'dc.publisher')),
    ...optional('issn', first(tags, 'citation_issn', 'prism.issn', 'prism.eissn')),
  };

  const keywords = all(tags, 'citation_keywords')
    .flatMap((value) => value.split(/\s*[;,]\s*/))
    .filter(Boolean);
  // Statements in the head come before links in the body: a footer can link a site-wide license.
  const licenseUrl =
    licenseLinks(document, 'link[rel]')[0] ??
    [first(tags, 'dc.rights'), first(tags, 'citation_license')].find((value) =>
      /^https?:\/\//.test(value ?? ''),
    ) ??
    licenseLinks(document, 'a[rel], area[rel]').find((href) => /^https?:\/\//i.test(href));
  // `dc.rights` often holds only a copyright line; it counts as a license when it names one.
  const licenseText = [first(tags, 'dc.rights'), first(tags, 'citation_license')].find(
    (value) =>
      value &&
      !/^https?:\/\//.test(value) &&
      /licen[cs]|creative\s*commons|\bcc[\s-]?by\b|\bcc0\b|public domain/i.test(value),
  );
  const language =
    first(tags, 'citation_language', 'dc.language') ??
    document.documentElement?.getAttribute('lang') ??
    undefined;
  const published = parseDate(
    first(
      tags,
      'citation_publication_date',
      'citation_date',
      'citation_online_date',
      'dc.date',
      'article:published_time',
    ),
  );
  const articleType = first(tags, 'citation_article_type', 'dc.type');

  return {
    ...(title && { title }),
    ...(authors.length > 0 && { authors }),
    ...(affiliations.length > 0 && { affiliations }),
    ...(Object.keys(identifiers).length > 0 && { identifiers }),
    ...(Object.keys(venue).length > 0 && { venue }),
    ...(published && { published }),
    ...(keywords.length > 0 && { keywords }),
    ...((licenseUrl || licenseText) && {
      license: { ...optional('url', licenseUrl), ...optional('text', licenseText) },
    }),
    ...(language && { language }),
    ...(articleType && { articleType }),
  };
}

/** The `href` of each element matching `selector` whose `rel` tokens include `license`, in document order. */
function licenseLinks(document: Document, selector: string): string[] {
  return Array.from(document.querySelectorAll(selector)).flatMap((element) => {
    const rel = element.getAttribute('rel')?.toLowerCase().split(/\s+/) ?? [];
    const href = element.getAttribute('href');
    return rel.includes('license') && href ? [href] : [];
  });
}

function optional<K extends string>(
  key: K,
  value: string | null | undefined,
): { [P in K]?: string } {
  return (value ? { [key]: value } : {}) as { [P in K]?: string };
}

/** The abstract the tags carry, for a page whose body has no abstract section. */
export function metaAbstract(tags: MetaTag[]): string | undefined {
  return first(tags, 'citation_abstract', 'dc.description', 'dcterms.abstract');
}

/**
 * References from `citation_reference` tags, for a page whose reference list could not
 * be read. Each tag packs fields as `citation_title=…; citation_author=…; …`.
 */
export function metaReferences(tags: MetaTag[]): Reference[] {
  return all(tags, 'citation_reference').flatMap((value, index) => {
    // Some publishers put the printed citation in the tag instead of fields.
    if (!/(?:^|;)\s*citation_\w+=/.test(value)) {
      const doi = normalizeDoi(/\b10\.\d{4,9}\/[^\s;]+/.exec(value)?.[0]);
      return [{ label: String(index + 1), text: escapeInline(value), ...(doi && { doi }) }];
    }
    const fields = new Map<string, string[]>();
    for (const part of value.split(/;\s*(?=citation_\w+=)/)) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const key = part.slice(0, eq).trim().toLowerCase();
      const field = part
        .slice(eq + 1)
        .trim()
        .replace(/;$/, '');
      if (!field) continue;
      const values = fields.get(key);
      if (values) values.push(field);
      else fields.set(key, [field]);
    }
    const get = (key: string) => fields.get(key)?.[0];
    const authors = fields.get('citation_author') ?? [];
    const title = get('citation_title');
    const source =
      get('citation_journal_title') ??
      get('citation_inbook_title') ??
      get('citation_conference_title') ??
      get('citation_publisher');
    const year = /\d{4}/.exec(
      get('citation_year') ?? get('citation_publication_date') ?? get('citation_date') ?? '',
    )?.[0];
    const doi = normalizeDoi(get('citation_doi'));
    const pmid = get('citation_pmid')?.replace(/\D/g, '');
    const volume = get('citation_volume');
    const pages = get('citation_pages') ?? get('citation_firstpage');
    const text = [
      authors.length > 0 && `${escapeInline(authors.join(', '))}.`,
      title && `${escapeInline(title.replace(/\.$/, ''))}.`,
      source && `*${escapeInline(source)}*.`,
      [year, volume && `${escapeInline(volume)}${pages ? `:${escapeInline(pages)}` : ''}`]
        .filter(Boolean)
        .join(';'),
      doi && `doi:${escapeInline(doi)}`,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!text) return [];
    return [
      {
        label: String(index + 1),
        text,
        ...(authors.length > 0 && { authors }),
        ...(title && { title }),
        ...(source && { source }),
        ...(year && { year }),
        ...(doi && { doi }),
        ...(pmid && { pmid }),
      },
    ];
  });
}
