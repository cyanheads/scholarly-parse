/**
 * @fileoverview The reference list: every `<ref>` under any `<ref-list>`, its citation
 * rendered as readable text, and the identifiers and fields the markup names.
 * @module src/formats/jats/references
 */
import type { Reference } from '../../model/document.js';
import { escapeInline } from '../../render/escape.js';
import { inlineMath, joinAdjacentMath } from '../../render/inline.js';
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
import { formulaTex, rawText, text } from './text.js';

/** `pub-id-type` → the label a rendered citation shows before the identifier. */
const PUB_ID_LABELS: Readonly<Record<string, string>> = {
  arxiv: 'arXiv',
  doi: 'DOI',
  isbn: 'ISBN',
  medline: 'PMID',
  pmcid: 'PMCID',
  pmid: 'PMID',
};

/** Publisher-internal identifiers: nothing a reader can look up, so a rendered element-citation leaves them out. */
const INTERNAL_PUB_IDS: ReadonlySet<string> = new Set(['pii', 'publisher-id']);

/**
 * Europe PMC's generated Associated Data section: a digest of the article's data
 * citations, supplementary files, and data availability statement, each already present
 * where the article puts it.
 */
export function isAssociatedData(node: XmlNode): boolean {
  return tagNameOf(node) === 'sec' && attrOf(node, 'sec-type') === 'associated-data';
}

/** Every `<ref-list>` under `node`, outside an Associated Data digest. */
function refLists(node: XmlNode): XmlNode[] {
  return childrenOf(node).flatMap((child) => {
    if (isAssociatedData(child)) return [];
    const nested = refLists(child);
    return tagNameOf(child) === 'ref-list' ? [child, ...nested] : nested;
  });
}

/**
 * Every reference under `root`, in document order. `<ref-list>` placement varies —
 * roughly 60% of Europe PMC deposits nest it under `body/sec/sec` — so every one is
 * collected, and a `<ref>` ID already seen is skipped. (pubmed-mcp-server#116)
 */
export function extractReferences(root: XmlNode): Reference[] {
  const results: Reference[] = [];
  const seen = new Set<string>();
  for (const refList of refLists(root)) {
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
  const citation = citationMarkdown(mixed ?? element);
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
    text: citation,
    ...fields,
  };
}

/**
 * A citation element — `<mixed-citation>`, `<element-citation>`, `<nlm-citation>` — as
 * inline Markdown: its text escaped, its formulas inline math. Empty when it has no text.
 */
export function citationMarkdown(node: XmlNode | undefined): string {
  if (!node) return '';
  const formulas: string[] = [];
  const plain =
    tagNameOf(node) === 'mixed-citation'
      ? renderMixedCitation(node, formulas)
      : renderElementCitation(node, formulas);
  let markdown = escapeInline(plain);
  for (const [index, tex] of formulas.entries()) {
    markdown = markdown.split(formulaMark(index)).join(inlineMath(tex));
  }
  return joinAdjacentMath(markdown);
}

/** Formula tags a citation can hold. */
const FORMULA_TAGS: ReadonlySet<string> = new Set(['inline-formula', 'disp-formula']);

/**
 * Where a citation's formula `index` sits in its text until escaping is done. U+0001
 * cannot occur in XML 1.0 text, and escaping leaves it alone, so the TeX is restored
 * as math afterwards rather than escaped as text.
 */
function formulaMark(index: number): string {
  return `\u0001${index}\u0001`;
}

/**
 * Text of a node inside a citation, as {@link rawText} reads it, except that each
 * formula with TeX stands as a {@link formulaMark} and its TeX is added to `formulas`.
 */
function citationText(node: XmlNode, formulas: string[]): string {
  const tag = tagNameOf(node) ?? '';
  if (FORMULA_TAGS.has(tag)) {
    const tex = formulaTex(childrenOf(node).filter((child) => tagNameOf(child) !== 'label'));
    if (!tex) return rawText(node);
    formulas.push(tex);
    return formulaMark(formulas.length - 1);
  }
  const holdsFormula = [...FORMULA_TAGS].some(
    (formula) => findAllDescendants(node, formula).length > 0,
  );
  if (!holdsFormula) return rawText(node);
  return childrenOf(node)
    .map((child) => citationText(child, formulas))
    .join('');
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

/** Element-citation fields placed by `renderElementCitation`; any other field follows them in source order. */
const PLACED_FIELDS: ReadonlySet<string> = new Set([
  'person-group',
  'name',
  'string-name',
  'collab',
  'etal',
  'article-title',
  'chapter-title',
  'part-title',
  'data-title',
  'source',
  'edition',
  'publisher-loc',
  'publisher-name',
  'year',
  'month',
  'day',
  'volume',
  'issue',
  'fpage',
  'lpage',
  'page-range',
  'elocation-id',
  'pub-id',
]);

/** `text` closed with a full stop unless it already ends a sentence or is a URL. */
function sentence(text: string): string {
  return /[.?!]$|:\/\/\S+$/.test(text) ? text : `${text}.`;
}

/**
 * An `<element-citation>` as text. Its children carry no punctuation, and a flat read
 * runs every field together (`DomanJ.L.…Cell18618…`), so the fields are laid out in the
 * order and punctuation PMC prints citations with, whatever order the source lists them
 * in: `Authors. Title. In: Editors, editors. Source. Edition. Place: Publisher; 2023;186(18):3983–4002.`
 * Other fields follow as written, then the identifiers, labeled and each shown once.
 * A citation with text of its own between the fields is read as written. (#69)
 */
function renderElementCitation(node: XmlNode, formulas: string[]): string {
  const children = childrenOf(node);
  if (children.some((child) => isTextNode(child) && textOf(child).trim()))
    return renderMixedCitation(node, formulas);
  const fields = children.filter((child) => !isTextNode(child));
  const fieldText = (child: XmlNode) => collapseWhitespace(citationText(child, formulas));
  const field = (tag: string) => {
    const found = fields.find((child) => tagNameOf(child) === tag);
    return found ? fieldText(found) : '';
  };
  const isEditors = (group: XmlNode) => attrOf(group, 'person-group-type') === 'editor';
  // Every name outside an editor group — authors, and translators or compilers — leads.
  const names = (editors: boolean) =>
    fields
      .flatMap((child) =>
        tagNameOf(child) === 'person-group'
          ? isEditors(child) === editors
            ? childrenOf(child)
            : []
          : editors
            ? []
            : [child],
      )
      .map(renderName)
      .filter(Boolean)
      .join(', ');

  const editors = names(true);
  const place = field('publisher-loc');
  const publisher = field('publisher-name');
  const date = [field('year'), field('month'), field('day')].filter(Boolean).join(' ');
  const volume = [field('volume'), field('issue') && `(${field('issue')})`].join('');
  const fpage = field('fpage');
  const lpage = field('lpage');
  const pages =
    (fpage && lpage ? `${fpage}–${lpage}` : fpage) || field('page-range') || field('elocation-id');
  let locator = date;
  if (volume) locator = locator ? `${locator};${volume}` : volume;
  if (pages) locator = locator ? `${locator}${volume ? ':' : ', '}${pages}` : pages;

  const parts = [
    names(false),
    field('article-title') || field('chapter-title') || field('part-title') || field('data-title'),
    editors && `In: ${editors}, editors`,
    field('source'),
    field('edition'),
    [publisher && (place ? `${place}: ${publisher}` : publisher), locator]
      .filter(Boolean)
      .join('; '),
    ...fields.filter((child) => !PLACED_FIELDS.has(tagNameOf(child) ?? '')).map(fieldText),
  ]
    .filter(Boolean)
    .map(sentence);

  const shown = new Set<string>();
  for (const pubId of fields.filter((child) => tagNameOf(child) === 'pub-id')) {
    const id = text(pubId);
    const type = attrOf(pubId, 'pub-id-type') ?? '';
    if (!id || shown.has(id) || INTERNAL_PUB_IDS.has(type)) continue;
    shown.add(id);
    const label = PUB_ID_LABELS[type];
    parts.push(label ? `${label} ${id}` : id);
  }
  return parts.join(' ');
}

/** Wrappers publishers put around a whole citation (Europe PMC's `citation-string`), read with the same spacing rules. */
const CITATION_WRAPPER_TAGS: ReadonlySet<string> = new Set(['named-content', 'styled-content']);

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
function renderMixedCitation(node: XmlNode, formulas: string[]): string {
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
      if (label && !hasLiteralIdPrefix(rendered, type) && !hasLiteralIdPrefix(rendered, label)) {
        labeled = true;
        part = `${label} ${value}`;
      } else {
        part = value;
      }
    } else if (NAME_WRAPPER_TAGS.has(tag)) {
      part = renderNameWrapper(child);
    } else if (CITATION_WRAPPER_TAGS.has(tag)) {
      part = renderMixedCitation(child, formulas);
    } else {
      part = citationText(child, formulas);
    }
    if (prevWasElement || labeled) rendered += ' ';
    rendered += part;
    prevWasElement = true;
  }
  // A name part that renders empty (a given name holding only a soft hyphen) or markup
  // whitespace before a comma leaves "Colaneri A. , Staffa N."; the comma closes up.
  return collapseWhitespace(rendered).replace(/\s+(?=[,;])/g, '');
}
