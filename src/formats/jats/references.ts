/**
 * @fileoverview The reference list: every `<ref>` under any `<ref-list>`, its citation
 * rendered as readable text, and the identifiers and fields the markup names.
 * @module src/formats/jats/references
 */
import type { Reference } from '../../model/document.js';
import { escapeInline } from '../../render/escape.js';
import {
  attrOf,
  childrenOf,
  collapseWhitespace,
  findAll,
  findAllDescendants,
  findOne,
  isTextNode,
  tagNameOf,
  textOf,
  type XmlNode,
} from '../../xml/ordered.js';
import { rawText, text } from './text.js';

/** `pub-id-type` → the label a rendered citation shows before the identifier. */
const PUB_ID_LABELS: Readonly<Record<string, string>> = {
  doi: 'DOI',
  pmcid: 'PMCID',
  pmid: 'PMID',
};

/**
 * Every reference under `root`, in document order. `<ref-list>` placement varies —
 * roughly 60% of Europe PMC deposits nest it under `body/sec/sec` — so every one is
 * collected, and a `<ref>` ID already seen is skipped. (pubmed-mcp-server#116)
 */
export function extractReferences(root: XmlNode): Reference[] {
  const results: Reference[] = [];
  const seen = new Set<string>();
  for (const refList of findAllDescendants(root, 'ref-list')) {
    for (const ref of findAll(refList, 'ref')) {
      const id = attrOf(ref, 'id');
      if (id && seen.has(id)) continue;
      const reference = parseReference(ref);
      if (!reference) continue;
      if (id) seen.add(id);
      results.push(reference);
    }
  }
  return results;
}

/**
 * One `<ref>`. The readable `<mixed-citation>` is preferred for the text, descending into
 * `<citation-alternatives>` when the forms sit there (#66); the structured
 * `<element-citation>` supplies fields when present.
 */
function parseReference(ref: XmlNode): Reference | undefined {
  const container = findOne(ref, 'citation-alternatives') ?? ref;
  const mixed = findOne(container, 'mixed-citation');
  const element = findOne(container, 'element-citation') ?? findOne(container, 'nlm-citation');
  const citation = mixed
    ? renderMixedCitation(mixed)
    : element
      ? renderElementCitation(element)
      : '';
  if (!citation) return;

  const fields = citationFields(element ?? mixed);
  const id = attrOf(ref, 'id');
  // `[12]` and `12.` are both printed forms of the label `12`.
  const label =
    text(findOne(ref, 'label'))
      .replace(/^\[|\]$/g, '')
      .replace(/\.$/, '') || undefined;
  return {
    ...(id && { id }),
    ...(label && { label }),
    text: escapeInline(citation),
    ...fields,
  };
}

/** Readable text of any citation element: `<mixed-citation>`, `<element-citation>`, `<nlm-citation>`. */
export function renderCitation(node: XmlNode): string {
  return tagNameOf(node) === 'mixed-citation'
    ? renderMixedCitation(node)
    : renderElementCitation(node);
}

/** Structured fields from a citation element. */
function citationFields(citation: XmlNode | undefined): Omit<Reference, 'text'> {
  if (!citation) return {};
  const ids: Record<string, string> = {};
  for (const pubId of findAllDescendants(citation, 'pub-id')) {
    const type = attrOf(pubId, 'pub-id-type')?.toLowerCase();
    const value = text(pubId);
    if (type && value && !ids[type]) ids[type] = value;
  }
  const extLink =
    findAllDescendants(citation, 'ext-link')[0] ?? findAllDescendants(citation, 'uri')[0];
  const url = extLink ? (attrOf(extLink, 'xlink:href') ?? text(extLink)) : undefined;
  const doi = ids.doi ?? doiFromUrl(url);
  const authors = findAllDescendants(citation, 'person-group')
    .filter((group) => (attrOf(group, 'person-group-type') ?? 'author') === 'author')
    .flatMap((group) => childrenOf(group).map(renderName).filter(Boolean));
  const title =
    text(findOne(citation, 'article-title')) || text(findOne(citation, 'chapter-title'));
  const source = text(findOne(citation, 'source'));
  const year = text(findOne(citation, 'year'));
  const pmcid = ids.pmcid ?? ids.pmc;
  return {
    ...(authors.length > 0 && { authors }),
    ...(title && { title }),
    ...(source && { source }),
    ...(year && { year }),
    ...(doi && { doi: doi.toLowerCase() }),
    ...(ids.pmid && { pmid: ids.pmid }),
    ...(pmcid && { pmcid: pmcid.startsWith('PMC') ? pmcid : `PMC${pmcid}` }),
    ...(ids.arxiv && { arxiv: ids.arxiv.replace(/^arxiv:/i, '') }),
    ...(url && !doi && { url }),
  };
}

function doiFromUrl(url: string | undefined): string | undefined {
  return url ? /doi\.org\/(10\.\d{4,9}\/\S+)/i.exec(url)?.[1] : undefined;
}

/** A `<person-group>` child — `<name>`, `<string-name>`, `<collab>`, `<etal>` — as text. */
function renderName(node: XmlNode): string {
  switch (tagNameOf(node)) {
    case 'name':
    case 'string-name': {
      const parts = [text(findOne(node, 'surname')), text(findOne(node, 'given-names'))].filter(
        Boolean,
      );
      return parts.join(' ') || text(node);
    }
    case 'collab':
      return text(node);
    case 'etal':
      return 'et al.';
    default:
      return '';
  }
}

/**
 * An `<element-citation>` as delimited text. Its children carry no punctuation between
 * them, so a flat read runs every field together (`DomanJ.L.…Cell18618…`); names join
 * with `, ` and typed identifiers are labeled. (#69)
 */
function renderElementCitation(node: XmlNode): string {
  const parts: string[] = [];
  for (const child of childrenOf(node)) {
    const tag = tagNameOf(child);
    if (tag === 'person-group') {
      const names = childrenOf(child).map(renderName).filter(Boolean);
      if (names.length > 0) parts.push(names.join(', '));
    } else if (tag === 'pub-id') {
      const value = text(child);
      const label = PUB_ID_LABELS[attrOf(child, 'pub-id-type') ?? ''];
      if (value) parts.push(label ? `${label} ${value}` : value);
    } else {
      const value = text(child);
      if (value) parts.push(value);
    }
  }
  return parts.join(' ');
}

/** Name wrappers whose parts often sit adjacent with nothing between them. (#124) */
const NAME_WRAPPER_TAGS: ReadonlySet<string> = new Set(['name', 'string-name', 'person-group']);

/**
 * A name wrapper's text: one space between two adjacent elements with nothing between
 * them, source text verbatim otherwise, so existing punctuation is never doubled.
 */
function renderNameWrapper(node: XmlNode): string {
  let rendered = '';
  let prevWasElement = false;
  for (const child of childrenOf(node)) {
    if (isTextNode(child)) {
      const raw = textOf(child);
      if (raw) {
        rendered += raw;
        prevWasElement = false;
      }
      continue;
    }
    const tag = tagNameOf(child) ?? '';
    const part = NAME_WRAPPER_TAGS.has(tag) ? renderNameWrapper(child) : rawText(child);
    if (!part) continue;
    if (prevWasElement) rendered += ' ';
    rendered += part;
    prevWasElement = true;
  }
  return rendered;
}

/** True when the text so far already ends with a prefix naming this ID type (`doi:`). (#115) */
function hasLiteralIdPrefix(rendered: string, pubIdType: string): boolean {
  const tail = rendered.trimEnd().replace(/[:.]$/, '').trimEnd();
  return tail.toLowerCase().endsWith(pubIdType.toLowerCase());
}

/**
 * A `<mixed-citation>` as text. Its punctuation lives in the text between elements, so
 * the source reads correctly almost everywhere; three zero-gap adjacencies do not —
 * consecutive `<pub-id>`s (#115), an inline title against the volume after it (#123),
 * and surname against given names (#124). Adjacent elements with nothing between them
 * get one space, and typed identifiers get a label unless the text already names it.
 */
function renderMixedCitation(node: XmlNode): string {
  let rendered = '';
  let prevWasElement = false;
  for (const child of childrenOf(node)) {
    if (isTextNode(child)) {
      const raw = textOf(child);
      if (raw) {
        rendered += raw;
        prevWasElement = false;
      }
      continue;
    }
    const tag = tagNameOf(child) ?? '';
    let part: string;
    let labeled = false;
    if (tag === 'pub-id') {
      const value = text(child);
      if (!value) continue;
      const type = attrOf(child, 'pub-id-type') ?? '';
      const label = PUB_ID_LABELS[type];
      if (label && !hasLiteralIdPrefix(rendered, type)) {
        labeled = true;
        part = `${label} ${value}`;
      } else {
        part = value;
      }
    } else if (NAME_WRAPPER_TAGS.has(tag)) {
      part = renderNameWrapper(child);
    } else {
      part = rawText(child);
    }
    if (prevWasElement || labeled) rendered += ' ';
    rendered += part;
    prevWasElement = true;
  }
  return collapseWhitespace(rendered);
}
