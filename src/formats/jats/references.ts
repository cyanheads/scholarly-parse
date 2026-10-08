/**
 * @fileoverview The reference list: every `<ref>` under any `<ref-list>`, its citation
 * rendered as readable text, and the identifiers and fields the markup names.
 * @module src/formats/jats/references
 */
import { normalizeArxiv } from '../../model/arxiv.js';
import type { Reference } from '../../model/document.js';
import { normalizeDoi } from '../../model/doi.js';
import { normalizePmcid, normalizePmid } from '../../model/identifiers.js';
import { trailingLength } from '../../model/trailing.js';
import { escapeInline } from '../../render/escape.js';
import { inlineMath, joinInlineSeams } from '../../render/inline.js';
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
const PUB_ID_LABELS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    arxiv: 'arXiv',
    doi: 'DOI',
    isbn: 'ISBN',
    medline: 'PMID',
    pmcid: 'PMCID',
    pmid: 'PMID',
  }),
);

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
  return joinInlineSeams(restoreFormulas(escapeInline(plain), formulas));
}

/** Formula tags a citation can hold. */
const FORMULA_TAGS: ReadonlySet<string> = new Set(['inline-formula', 'disp-formula']);

/**
 * What brackets a {@link formulaMark}. U+0001 cannot occur in XML 1.0 text, and escaping
 * leaves it alone, so the TeX is restored as math afterwards rather than escaped as text.
 */
const MARK = '\u0001';

/** Where a citation's formula `index` sits in its text until escaping is done. */
function formulaMark(index: number): string {
  return `${MARK}${index}${MARK}`;
}

/**
 * Escaped citation text with each {@link formulaMark} replaced by its formula as inline
 * math, in one pass over the marks. A mark character that brackets no formula's index
 * stays as it is.
 */
function restoreFormulas(markdown: string, formulas: readonly string[]): string {
  let out = '';
  let copied = 0;
  let open = markdown.indexOf(MARK);
  while (open !== -1) {
    const close = markdown.indexOf(MARK, open + 1);
    if (close === -1) break;
    const index = markdown.slice(open + 1, close);
    const tex = /^\d+$/.test(index) ? formulas[Number(index)] : undefined;
    if (tex === undefined) {
      open = close;
      continue;
    }
    out += markdown.slice(copied, open) + inlineMath(tex);
    copied = close + 1;
    open = markdown.indexOf(MARK, copied);
  }
  return out + markdown.slice(copied);
}

/** True when a formula sits anywhere below `node`. */
function holdsFormula(node: XmlNode): boolean {
  return childrenOf(node).some(
    (child) => FORMULA_TAGS.has(tagNameOf(child) ?? '') || holdsFormula(child),
  );
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
  if (!holdsFormula(node)) return rawText(node);
  return childrenOf(node)
    .map((child) => citationText(child, formulas))
    .join('');
}

/**
 * `ext-link-type`s whose target is an identifier rather than a page: Europe PMC adds
 * empty `<ext-link ext-link-type="pmid" xlink:href="26023781"/>`s to a citation.
 */
const ID_LINK_TYPES: ReadonlyMap<string, 'doi' | 'pmcid' | 'pmid'> = new Map(
  Object.entries({ doi: 'doi', pmcid: 'pmcid', pmid: 'pmid', pubmed: 'pmid' } as const),
);

/** `pub-id-type`s naming an identifier a reference holds, and the field each fills. */
const PUB_ID_FIELDS: ReadonlyMap<string, keyof typeof NORMALIZE_ID> = new Map(
  Object.entries({
    arxiv: 'arxiv',
    doi: 'doi',
    pmc: 'pmcid',
    pmcid: 'pmcid',
    pmid: 'pmid',
  } as const),
);

/** Each identifier field's value as the model holds it, or undefined for a value that is not one. */
const NORMALIZE_ID = {
  arxiv: normalizeArxiv,
  doi: (value: string) => normalizeDoi(doiFromUrl(value) ?? value),
  pmcid: normalizePmcid,
  pmid: normalizePmid,
} as const;

/** A link target a reader can open. */
const WEB_URL = /^(?:https?|ftp):\/\//i;

/**
 * Structured fields from a citation element. Each identifier is the first of its type, a
 * typed `<pub-id>` before a typed link, that holds one.
 */
function citationFields(citation: XmlNode | undefined): Omit<Reference, 'text'> {
  if (!citation) return {};
  const ids: Partial<Record<keyof typeof NORMALIZE_ID, string>> = {};
  const keep = (field: keyof typeof NORMALIZE_ID | undefined, value: string) => {
    const id = field && value ? NORMALIZE_ID[field](value) : undefined;
    if (field && id) ids[field] ??= id;
  };
  for (const pubId of findAllDescendants(citation, 'pub-id'))
    keep(PUB_ID_FIELDS.get(attrOf(pubId, 'pub-id-type')?.toLowerCase() ?? ''), text(pubId));
  const links = [
    ...findAllDescendants(citation, 'ext-link'),
    ...findAllDescendants(citation, 'uri'),
  ].map((link) => ({
    type: ID_LINK_TYPES.get(attrOf(link, 'ext-link-type')?.toLowerCase() ?? ''),
    target: attrOf(link, 'xlink:href') ?? text(link),
  }));
  for (const { type, target } of links) keep(type, target);
  const url = links.find(({ type, target }) => !type && WEB_URL.test(target))?.target;
  const { arxiv, pmcid, pmid } = ids;
  const doi = ids.doi ?? normalizeDoi(doiFromUrl(url));
  const authors = findAllDescendants(citation, 'person-group')
    .filter((group) => (attrOf(group, 'person-group-type') ?? 'author') === 'author')
    .flatMap((group) => childrenOf(group).map(renderName).filter(Boolean));
  const title =
    text(findOne(citation, 'article-title')) || text(findOne(citation, 'chapter-title'));
  const source = text(findOne(citation, 'source'));
  const year = text(findOne(citation, 'year'));
  return {
    ...(authors.length > 0 && { authors }),
    ...(title && { title }),
    ...(source && { source }),
    ...(year && { year }),
    ...(doi && { doi }),
    ...(pmid && { pmid }),
    ...(pmcid && { pmcid }),
    ...(arxiv && { arxiv }),
    ...(url && !doi && { url }),
  };
}

/** What follows `doi.org/` in a link, on any resolver host; {@link normalizeDoi} reads the DOI in it. */
function doiFromUrl(url: string | undefined): string | undefined {
  return url ? /doi\.org\/(10\.\d{4,9}\/\S+)/i.exec(url)?.[1] : undefined;
}

/** A `<person-group>` child — `<name>`, `<string-name>`, `<name-alternatives>`, `<collab>`, `<etal>` — as text. */
function renderName(node: XmlNode): string {
  switch (tagNameOf(node)) {
    case 'name-alternatives': {
      const form = nameForm(node);
      return form ? renderName(form) : '';
    }
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
 * The one form of a `<name-alternatives>` a citation shows: the first `<name>` or
 * `<string-name>` written in Latin script, else the first of them. Each form spells the
 * same person, so showing two fuses them (`LiX李`). (#73)
 */
function nameForm(node: XmlNode): XmlNode | undefined {
  const forms = childrenOf(node).filter((child) => {
    const tag = tagNameOf(child);
    return tag === 'name' || tag === 'string-name';
  });
  return forms.find((form) => isLatinScript(rawText(form))) ?? forms[0];
}

/** True when `text` has letters and every one of them is Latin script. */
function isLatinScript(text: string): boolean {
  return /\p{L}/u.test(text) && !/[^\p{Script=Latin}\P{L}]/u.test(text);
}

/** Element-citation fields placed by `renderElementCitation`; any other field follows them in source order. */
const PLACED_FIELDS: ReadonlySet<string> = new Set([
  'person-group',
  'name',
  'string-name',
  'name-alternatives',
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

/** `text` closed with a full stop unless it already ends a sentence or with a URL. */
function sentence(text: string): string {
  return /[.?!]$/.test(text) || endsWithUrl(text) ? text : `${text}.`;
}

/**
 * True when `text` ends with a URL: its last run without whitespace holds `://` and at
 * least one character after it. The run is found by walking back from the end, where
 * `/:\/\/\S+$/` reads from every `://` in it to the end.
 */
function endsWithUrl(text: string): boolean {
  const run = text.slice(text.length - trailingLength(text, /\S/));
  const scheme = run.indexOf('://');
  return scheme !== -1 && scheme + 3 < run.length;
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
    const label = PUB_ID_LABELS.get(type);
    parts.push(label ? `${label} ${id}` : id);
  }
  return parts.join(' ');
}

/** Wrappers publishers put around a whole citation (Europe PMC's `citation-string`), read with the same spacing rules. */
const CITATION_WRAPPER_TAGS: ReadonlySet<string> = new Set(['named-content', 'styled-content']);

/** Name wrappers whose parts often sit adjacent with nothing between them. (#124) */
const NAME_WRAPPER_TAGS: ReadonlySet<string> = new Set(['name', 'string-name', 'person-group']);

/** Elements that are each one name in a list of them. */
const NAME_TAGS: ReadonlySet<string> = new Set([
  'name',
  'string-name',
  'name-alternatives',
  'collab',
  'etal',
]);

/**
 * True for a name in a list of them: a `<name>`, `<string-name>`, `<name-alternatives>`,
 * or `<collab>`, or an `<etal/>` with no text of its own. A written `<etal>et al</etal>`
 * follows the name before it as the source sets it (`Ngo Q.-M. et al`).
 */
function isListedName(node: XmlNode | undefined): boolean {
  const tag = node && tagNameOf(node);
  if (tag === 'etal') return rawText(node).trim() === '';
  return tag !== undefined && NAME_TAGS.has(tag);
}

/**
 * An element's text in a name list: a `<name-alternatives>` reads as its {@link nameForm},
 * and an empty `<etal/>` reads `et al.`, as element citations read them.
 */
function namePart(node: XmlNode, tag: string): string {
  if (tag === 'name-alternatives') {
    const form = nameForm(node);
    return form ? namePart(form, tagNameOf(form) ?? '') : '';
  }
  if (NAME_WRAPPER_TAGS.has(tag)) return renderNameWrapper(node);
  const raw = rawText(node);
  return tag === 'etal' && raw.trim() === '' ? 'et al.' : raw;
}

/**
 * What goes before an element in a name wrapper or a citation, given the whitespace-only
 * text since the element before it: `, ` between two {@link isListedName} names the source
 * separates by nothing or by markup whitespace alone, else that whitespace, else one space
 * between two adjacent elements.
 */
function elementGap(gap: string, previous: XmlNode | undefined, node: XmlNode): string {
  if (isListedName(previous) && isListedName(node)) return ', ';
  return gap || (previous === undefined ? '' : ' ');
}

/**
 * A name wrapper's text: names set apart by {@link elementGap}, one space between two other
 * adjacent elements with nothing between them, source text verbatim otherwise, so existing
 * punctuation is never doubled. Markup whitespace at its end is kept for the caller.
 */
function renderNameWrapper(node: XmlNode): string {
  let rendered = '';
  let gap = '';
  let previous: XmlNode | undefined;
  for (const child of childrenOf(node)) {
    if (isTextNode(child)) {
      const raw = textOf(child);
      if (raw.trim() === '') {
        gap += raw;
      } else {
        rendered += gap + raw;
        gap = '';
        previous = undefined;
      }
      continue;
    }
    const part = namePart(child, tagNameOf(child) ?? '');
    if (!part) continue;
    rendered += elementGap(gap, previous, child) + part;
    gap = '';
    previous = child;
  }
  return rendered + gap;
}

const PUB_ID_TAGS: ReadonlySet<string> = new Set(['pub-id']);

/**
 * True when `text` prints the identifier `value` as a whole token, not as part of a
 * longer one. A value of digits alone never counts: it could as well be a page, a
 * volume, or a year.
 */
function printsIdentifier(text: string, value: string): boolean {
  if (/^\d+$/.test(value)) return false;
  const pattern = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\w.-])${pattern}(?![\\w/-]|\\.\\w)`, 'i').test(text);
}

/**
 * True when the text so far — `parts`, in order — already ends with a prefix naming this
 * ID type (`doi:`). (#115) The parts are read back from the end only as far as the prefix
 * reaches, and never joined: a citation holding many identifiers asks this once for each,
 * and reading the end of one growing string copies the whole of it every time.
 */
function hasLiteralIdPrefix(parts: readonly string[], pubIdType: string): boolean {
  const chars = backwards(parts);
  let char = chars.next();
  const skipWhitespace = () => {
    while (!char.done && /\s/.test(char.value)) char = chars.next();
  };
  skipWhitespace();
  if (!char.done && (char.value === ':' || char.value === '.')) {
    char = chars.next();
    skipWhitespace();
  }
  let tail = '';
  for (; !char.done && tail.length < pubIdType.length; char = chars.next())
    tail = char.value + tail;
  return tail.toLowerCase() === pubIdType.toLowerCase();
}

/** The characters of `parts`, joined, from the last back to the first. */
function* backwards(parts: readonly string[]): Generator<string> {
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i] ?? '';
    for (let j = part.length - 1; j >= 0; j--) yield part.charAt(j);
  }
}

/**
 * How many of a `<mixed-citation>`'s identifiers are checked against its text. Each check
 * reads the whole text, so later identifiers are printed unchecked; real citations carry
 * a handful.
 */
const MAX_CHECKED_IDS = 16;

/**
 * A `<mixed-citation>` as text. Its punctuation lives in the text between elements, so
 * the source reads correctly almost everywhere; three zero-gap adjacencies do not —
 * consecutive `<pub-id>`s (#115), an inline title against the volume after it (#123),
 * and surname against given names (#124). Adjacent elements with nothing between them
 * get one space, and adjacent names a comma ({@link elementGap}). Markup whitespace that
 * closes a name wrapper is dropped before punctuation (`Bonyah E\n</person-group>:`). A
 * typed identifier gets a label unless the text already names it, and is left out when
 * the text already prints it (PMC adds a `<pub-id>` for a DOI the citation spells out).
 */
function renderMixedCitation(node: XmlNode, formulas: string[]): string {
  const printed = rawText(node, PUB_ID_TAGS);
  const rendered: string[] = [];
  let gap = '';
  let previous: XmlNode | undefined;
  let checked = 0;
  for (const child of childrenOf(node)) {
    if (isTextNode(child)) {
      const raw = textOf(child);
      if (raw.trim() === '') {
        gap += raw;
      } else {
        const wrapperEnd = NAME_WRAPPER_TAGS.has((previous && tagNameOf(previous)) ?? '');
        rendered.push(wrapperEnd && /^[.,:;]/.test(raw) ? raw : gap + raw);
        gap = '';
        previous = undefined;
      }
      continue;
    }
    const tag = tagNameOf(child) ?? '';
    let part: string;
    let labeled = false;
    if (tag === 'pub-id') {
      const value = text(child);
      if (!value) continue;
      checked++;
      if (checked <= MAX_CHECKED_IDS && printsIdentifier(printed, value)) continue;
      const type = attrOf(child, 'pub-id-type') ?? '';
      const label = PUB_ID_LABELS.get(type);
      if (label && !hasLiteralIdPrefix(rendered, type) && !hasLiteralIdPrefix(rendered, label)) {
        labeled = true;
        part = `${label} ${value}`;
      } else {
        part = value;
      }
    } else if (NAME_WRAPPER_TAGS.has(tag) || NAME_TAGS.has(tag)) {
      part = namePart(child, tag);
    } else if (CITATION_WRAPPER_TAGS.has(tag)) {
      part = renderMixedCitation(child, formulas);
    } else {
      part = citationText(child, formulas);
    }
    const before = elementGap(gap, previous, child);
    rendered.push(labeled && !before ? ' ' : before);
    const shown = part.trimEnd();
    rendered.push(shown);
    gap = part.slice(shown.length);
    previous = child;
  }
  rendered.push(gap);
  // A name part that renders empty (a given name holding only a soft hyphen) or markup
  // whitespace before a comma leaves "Colaneri A. , Staffa N."; the comma closes up, as
  // does a full stop ending a word (`elegans\n. Nature`). A written full stop after a name
  // that already ends in one — an initial (`Smith J.`) or `et al.`, an `<etal/>` included —
  // is not doubled; an ellipsis is left as written.
  return collapseWhitespace(rendered.join(''))
    .replace(/\s+(?=[,;]|\.(?:\s|$))/g, '')
    .replace(/(?<=(?:^|[^\p{L}])\p{Lu}|\bet al)\.\.(?!\.)/gu, '.');
}
