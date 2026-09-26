/**
 * @fileoverview `parseTei`: TEI as Grobid writes it for a scholarly PDF → `ScholarlyDocument`.
 * Two shapes arrive: the standard `<TEI>` document with `text/body/div`, and a lowercase
 * `<tei>` wrapped in HTML with `text/div`. Tag names are lowercased on parse, so one
 * reader handles both.
 *
 * Grobid writes sections as a flat run of `<div>`s whose `<head n="2.1">` numbering is
 * the only hierarchy; the tree is rebuilt from those numbers. A `<div>` with no heading
 * continues the section before it. Figures and tables sit after the body text, so they
 * are reported as floats.
 * @module src/formats/tei/parse
 */
import { createDiagnostics } from '../../model/diagnostics.js';
import type {
  Abstract,
  Author,
  Block,
  DocumentMetadata,
  Identifiers,
  PartialDate,
  Reference,
  ScholarlyDocument,
  Section,
  SectionKind,
  TableBlock,
  Venue,
} from '../../model/document.js';
import { decodeText, exceedsBudget } from '../../model/input.js';
import { failed, guard, type ParseOptions, type ParseResult, parsed } from '../../model/result.js';
import { issueId } from '../../model/section-ids.js';
import { kindFromTitle, splitSectionNumber } from '../../model/section-kinds.js';
import { buildGrid, spanValue } from '../../model/table-grid.js';
import { escapeInline } from '../../render/escape.js';
import { emphasis } from '../../render/inline.js';
import {
  attrOf,
  childrenOf,
  collapseWhitespace,
  findAll,
  findAllDescendants,
  findDescendant,
  findOne,
  isTextNode,
  parseOrderedXml,
  tagNameOf,
  textOf,
  type XmlNode,
} from '../../xml/ordered.js';
import { footnote, inlineMarkdown, inlineText, plainText, type TeiContext } from './inline.js';

const DEFAULT_MAX_INPUT_BYTES = 32 * 1024 * 1024;

/** Parse Grobid TEI. */
export function parseTei(input: string | Uint8Array, options: ParseOptions = {}): ParseResult {
  return guard(() => readTei(input, options));
}

function readTei(input: string | Uint8Array, options: ParseOptions): ParseResult {
  const maxBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
  if (exceedsBudget(input, maxBytes))
    return failed('too-large', `Input exceeds the ${maxBytes}-byte budget`);
  const source = decodeText(input);
  const start = source.search(/<tei[\s>]/i);
  let end = -1;
  for (const match of source.matchAll(/<\/tei\s*>/gi)) end = match.index;
  if (start === -1 || end === -1)
    return failed('wrong-format', 'No <TEI> element: not a TEI document');
  const tree = parseOrderedXml(source.slice(start, source.indexOf('>', end) + 1), {
    lowercaseTags: true,
  });
  if ('error' in tree) return failed('malformed', `TEI could not be parsed: ${tree.error}`);
  const tei = findDescendant(tree.nodes, 'tei', 1);
  if (!tei) return failed('wrong-format', 'No <TEI> element: not a TEI document');

  const header = findOne(tei, 'teiheader');
  const text = findOne(tei, 'text');
  const ctx: TeiContext = {
    diag: createDiagnostics(),
    footnoteMarks: footnoteMarks(text),
    footnotes: [],
    sectionIds: new Set(),
  };
  const metadata = extractMetadata(header, text, ctx);
  const abstracts = extractAbstracts(header, ctx);
  const bodyNode = findOne(text, 'body') ?? text;
  const { floats, sections: body } = extractBody(bodyNode, ctx);
  const backNode = findOne(text, 'back');
  const back = extractBack(backNode, ctx);
  const listBibl = findAllDescendants(backNode ?? text, 'listbibl')[0];
  const references = findAll(listBibl, 'biblstruct').flatMap((b) => {
    const ref = parseBiblStruct(b);
    return ref ? [ref] : [];
  });

  if (!metadata.title && abstracts.length === 0 && body.length === 0) {
    return failed('empty', 'The TEI carries no title, abstract, or body');
  }
  if (!metadata.title) ctx.diag.warn('no-title', 'The document has no title');
  if (abstracts.length === 0) ctx.diag.warn('no-abstract', 'The document has no abstract');
  if (body.length === 0) ctx.diag.warn('no-body', 'The document has no body text');

  const document: ScholarlyDocument = {
    abstracts,
    back,
    body,
    diagnostics: ctx.diag.finish('structured'),
    flavor:
      /grobid/i.test(source.slice(0, 5000)) ||
      /grobid/i.test(plainText(findOne(header, 'encodingdesc')))
        ? 'grobid'
        : 'tei',
    floats,
    footnotes: ctx.footnotes,
    format: 'tei',
    metadata,
    references,
  };
  return parsed(document);
}

/** Each footnote's printed mark (`n`) by its `xml:id`, for the `<ref type="foot">`s that point at it. */
function footnoteMarks(text: XmlNode | undefined): Map<string, string> {
  const marks = new Map<string, string>();
  for (const note of findAllDescendants(text, 'note')) {
    const id = attrOf(note, 'xml:id');
    const mark = attrOf(note, 'n');
    if (id && mark) marks.set(id, mark);
  }
  return marks;
}

// ─── Metadata ───────────────────────────────────────────────────────────────

/** An arXiv identifier without the `arXiv:` prefix or the `[cs.CL]` category Grobid keeps. */
function arxivId(value: string): string {
  return value.replace(/^arxiv:\s*/i, '').replace(/\s*\[[^\]]*\]$/, '');
}

function parseDate(when: string | undefined): PartialDate | undefined {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(when ?? '');
  if (!match) return;
  const [, y, m, d] = match;
  return { year: Number(y), ...(m && { month: Number(m) }), ...(m && d && { day: Number(d) }) };
}

/** An author's name from `<persName>`: forenames then surname. */
function personName(
  persName: XmlNode | undefined,
): { family?: string; given?: string; name: string } | undefined {
  if (!persName) return;
  const given = findAll(persName, 'forename').map(plainText).filter(Boolean).join(' ') || undefined;
  const family = plainText(findOne(persName, 'surname')) || undefined;
  const name = [given, family].filter(Boolean).join(' ') || plainText(persName);
  return name ? { name, ...(family && { family }), ...(given && { given }) } : undefined;
}

/** An affiliation as one line: its organization names, then its address parts. */
function affiliationText(aff: XmlNode): string {
  const orgs = findAll(aff, 'orgname').map(plainText).filter(Boolean);
  const address = childrenOf(findOne(aff, 'address'))
    .filter((c) => !isTextNode(c))
    .map(plainText)
    .filter(Boolean);
  return [...orgs, ...address].join(', ') || plainText(aff);
}

function extractMetadata(
  header: XmlNode | undefined,
  text: XmlNode | undefined,
  ctx: TeiContext,
): DocumentMetadata {
  const fileDesc = findOne(header, 'filedesc');
  const titles = findAll(findOne(fileDesc, 'titlestmt'), 'title');
  const title = inlineText(titles.find((t) => attrOf(t, 'type') === 'main') ?? titles[0], ctx);
  const biblStruct = findOne(findOne(fileDesc, 'sourcedesc'), 'biblstruct');
  const analytic = findOne(biblStruct, 'analytic');
  const monogr = findOne(biblStruct, 'monogr');

  const affiliations: string[] = [];
  const affIndex = (value: string) => {
    const existing = affiliations.indexOf(value);
    return existing === -1 ? affiliations.push(value) - 1 : existing;
  };
  const authors: Author[] = findAll(analytic, 'author').flatMap((author) => {
    const person = personName(findOne(author, 'persname'));
    if (!person) return [];
    const indices = [
      ...new Set(findAll(author, 'affiliation').map(affiliationText).filter(Boolean).map(affIndex)),
    ];
    const email = plainText(findOne(author, 'email')) || undefined;
    const orcid = findAll(author, 'idno').find((i) => /orcid/i.test(attrOf(i, 'type') ?? ''));
    const orcidValue = orcid
      ? /(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/.exec(plainText(orcid))?.[1]
      : undefined;
    return [
      {
        ...person,
        ...(indices.length > 0 && { affiliations: indices }),
        ...(email && { email }),
        ...(orcidValue && { orcid: orcidValue }),
        ...(attrOf(author, 'role') === 'corresp' && { corresponding: true }),
      },
    ];
  });

  const identifiers: Identifiers = {};
  for (const idno of [
    ...findAll(biblStruct, 'idno'),
    ...findAll(analytic, 'idno'),
    ...findAll(monogr, 'idno'),
  ]) {
    const type = (attrOf(idno, 'type') ?? '').toLowerCase();
    const value = plainText(idno);
    if (!value) continue;
    if (type === 'doi') identifiers.doi ??= value.toLowerCase();
    else if (type === 'arxiv') identifiers.arxiv ??= arxivId(value);
    else if (type === 'pmid') identifiers.pmid ??= value;
    else if (type === 'pmcid')
      identifiers.pmcid ??= value.startsWith('PMC') ? value : `PMC${value}`;
  }

  const imprint = findOne(monogr, 'imprint');
  const scope = (unit: string) =>
    findAll(imprint, 'biblscope').find((s) => attrOf(s, 'unit') === unit);
  const page = scope('page');
  const pages = page
    ? plainText(page) || [attrOf(page, 'from'), attrOf(page, 'to')].filter(Boolean).join('-')
    : '';
  const journal = plainText(
    findAll(monogr, 'title').find((t) => attrOf(t, 'level') === 'j') ?? findOne(monogr, 'title'),
  );
  const publicationStmt = findOne(fileDesc, 'publicationstmt');
  const publisher = plainText(findOne(publicationStmt, 'publisher'));
  const venue: Venue = {
    ...(journal && { title: journal }),
    ...(publisher && { publisher }),
    ...(plainText(scope('volume')) && { volume: plainText(scope('volume')) }),
    ...(plainText(scope('issue')) && { issue: plainText(scope('issue')) }),
    ...(pages && { pages }),
  };
  const dateNode =
    findAll(publicationStmt, 'date').find((d) => attrOf(d, 'type') === 'published') ??
    findOne(imprint, 'date');
  const published = parseDate(attrOf(dateNode, 'when') ?? plainText(dateNode));
  const keywords = findAllDescendants(findOne(findOne(header, 'profiledesc'), 'textclass'), 'term')
    .map(plainText)
    .filter(Boolean);
  const licence = findAllDescendants(findOne(publicationStmt, 'availability'), 'licence')[0];
  const licenseUrl = attrOf(licence, 'target');
  const licenseText = plainText(licence);
  const language = attrOf(header, 'xml:lang') ?? attrOf(text, 'xml:lang');

  return {
    ...(title && { title }),
    ...(authors.length > 0 && { authors }),
    ...(affiliations.length > 0 && { affiliations }),
    ...(Object.keys(identifiers).length > 0 && { identifiers }),
    ...(Object.keys(venue).length > 0 && { venue }),
    ...(published && { published }),
    ...(keywords.length > 0 && { keywords }),
    ...((licenseUrl || licenseText) && {
      license: {
        ...(licenseUrl && { url: licenseUrl }),
        ...(licenseText && { text: licenseText }),
      },
    }),
    ...(language && { language }),
  };
}

function extractAbstracts(header: XmlNode | undefined, ctx: TeiContext): Abstract[] {
  const abstract = findOne(findOne(header, 'profiledesc'), 'abstract');
  if (!abstract) return [];
  const divs = findAll(abstract, 'div');
  const sections = (divs.length > 0 ? divs : [abstract]).flatMap((div, i) => {
    const section = divSection(div, ctx, 'body', `abstract-${i + 1}`);
    return section ? [section] : [];
  });
  return sections.length > 0 ? [{ kind: 'main', sections }] : [];
}

// ─── Body ───────────────────────────────────────────────────────────────────

/** Blocks of one `<div>`, and its heading. */
function divContent(
  div: XmlNode,
  ctx: TeiContext,
): { blocks: Block[]; head?: XmlNode; nested: XmlNode[] } {
  const head = findOne(div, 'head');
  const blocks: Block[] = [];
  const nested: XmlNode[] = [];
  let run = '';
  const flush = () => {
    const text = collapseWhitespace(run);
    if (text) blocks.push({ text, type: 'paragraph' });
    run = '';
  };
  for (const child of childrenOf(div)) {
    if (child === head) continue;
    if (isTextNode(child)) {
      run += escapeInline(textOf(child));
      continue;
    }
    const tag = tagNameOf(child);
    if (tag === 'div') {
      flush();
      nested.push(child);
    } else if (tag === 'p' || tag === 'ab') {
      flush();
      const text = inlineText(child, ctx);
      if (text) blocks.push({ text, type: 'paragraph' });
    } else if (tag === 'formula') {
      flush();
      const text = plainText(childrenOf(child).filter((c) => tagNameOf(c) !== 'label'));
      const label = plainText(findOne(child, 'label')) || undefined;
      const id = attrOf(child, 'xml:id');
      if (text) blocks.push({ type: 'formula', ...(id && { id }), ...(label && { label }), text });
    } else if (tag === 'list') {
      flush();
      const items = findAll(child, 'item')
        .map((item) => inlineText(item, ctx))
        .filter(Boolean);
      if (items.length > 0)
        blocks.push({
          type: 'list',
          ordered: false,
          items: items.map((text) => [{ text, type: 'paragraph' }]),
        });
    } else if (tag === 'figure') {
      flush();
      blocks.push(...figureBlocks(child, ctx));
    } else if (tag === 'note') {
      run += footnote(child, ctx);
    } else {
      run += inlineMarkdown([child], ctx);
    }
  }
  flush();
  return { blocks, ...(head && { head }), nested };
}

/**
 * A `<div>` as a section: heading, `n` as label, blocks, nested divs as subsections.
 * With `keepHeading`, a titled div holding nothing is kept, for the divs after it to
 * nest under.
 */
function divSection(
  div: XmlNode,
  ctx: TeiContext,
  kind: SectionKind,
  fallbackId: string,
  keepHeading = false,
): Section | undefined {
  const { blocks, head, nested } = divContent(div, ctx);
  const id = issueId(ctx.sectionIds, attrOf(div, 'xml:id'), fallbackId);
  // Grobid leaves the punctuation of a number it moved into `@n` (`. Soil chemistry`).
  const { label, title } = splitSectionNumber(
    head ? inlineText(head, ctx).replace(/^[\s.,;:]+/, '') || undefined : undefined,
    attrOf(head, 'n'),
  );
  const sections = nested.flatMap((sub, i) => {
    const section = divSection(sub, ctx, kind, `${id}.${i + 1}`);
    return section ? [section] : [];
  });
  if (blocks.length === 0 && sections.length === 0 && !(keepHeading && title)) {
    ctx.sectionIds.delete(id);
    return;
  }
  return { blocks, id, kind, ...(label && { label }), sections, ...(title && { title }) };
}

/** Sections holding nothing, at any depth, removed. */
function withoutEmpty(sections: Section[], ctx: TeiContext): Section[] {
  return sections.flatMap((section) => {
    const kept = { ...section, sections: withoutEmpty(section.sections, ctx) };
    if (kept.blocks.length > 0 || kept.sections.length > 0) return [kept];
    ctx.sectionIds.delete(section.id);
    return [];
  });
}

/** True when `child` numbers a subsection of `parent`: `2.1` under `2`, `A.1` under `A`. */
function isNumberedChild(parent: string | undefined, child: string | undefined): boolean {
  if (!parent || !child) return false;
  const p = parent.replace(/\.$/, '');
  return child.replace(/\.$/, '').startsWith(`${p}.`);
}

function extractBody(
  body: XmlNode | undefined,
  ctx: TeiContext,
): { floats: Block[]; sections: Section[] } {
  const sections: Section[] = [];
  const floats: Block[] = [];
  const stack: Section[] = [];
  /**
   * The outline comes from heading numbers: `3.2` nests under `3`. An unnumbered heading
   * is never a numbered section's parent; inside a numbered subsection (`3.1`) it is a
   * paragraph heading and nests there, and anywhere else it stands at the top.
   */
  const place = (section: Section) => {
    while (stack.length > 0 && !stack.at(-1)?.label) stack.pop();
    if (section.label) {
      while (stack.length > 0 && !isNumberedChild(stack.at(-1)?.label, section.label)) stack.pop();
    } else if (!stack.at(-1)?.label?.includes('.')) {
      stack.length = 0;
    }
    const parent = stack.at(-1);
    if (parent) parent.sections.push(section);
    else sections.push(section);
    stack.push(section);
  };

  for (const child of childrenOf(body)) {
    const tag = tagNameOf(child);
    if (tag === 'figure') {
      floats.push(...figureBlocks(child, ctx));
    } else if (tag === 'note') {
      footnote(child, ctx);
    } else if (tag === 'div') {
      const section = divSection(
        child,
        ctx,
        'body',
        `s${sections.length + stack.length + 1}`,
        true,
      );
      if (!section) continue;
      const kind = kindFromTitle(section.title);
      const current = stack.at(-1);
      if (!section.title && current) {
        // A heading-less div continues the section before it.
        current.blocks.push(...section.blocks);
        current.sections.push(...section.sections);
        ctx.sectionIds.delete(section.id);
      } else if (!section.title) {
        place(section);
      } else if (kind) {
        stack.length = 0;
        sections.push({ ...section, kind });
      } else {
        place(section);
      }
    } else if (tag === 'p') {
      const text = inlineText(child, ctx);
      if (text) floats.push({ text, type: 'paragraph' });
    }
  }
  return { floats, sections: withoutEmpty(sections, ctx) };
}

/** A `<figure>`: a table when `@type="table"`, else a figure with its graphic. */
function figureBlocks(figure: XmlNode, ctx: TeiContext): Block[] {
  const head = inlineText(findOne(figure, 'head'), ctx);
  const labelNumber = plainText(findOne(figure, 'label'));
  const label = head || labelNumber || undefined;
  const caption = inlineText(findOne(figure, 'figdesc'), ctx) || undefined;
  const id = attrOf(figure, 'xml:id');
  if (attrOf(figure, 'type') === 'table') {
    const table = findOne(figure, 'table');
    const { headerRows, rows } = table ? readTeiTable(table, ctx) : { headerRows: 0, rows: [] };
    const note = inlineText(findOne(figure, 'note'), ctx);
    const block: TableBlock = {
      type: 'table',
      ...(id && { id }),
      ...(label && { label }),
      ...(caption && { caption }),
      headerRows,
      rows,
      ...(note && { footnotes: [note] }),
      ...(rows.length === 0 && { unextractable: 'no-rows' as const }),
    };
    if (rows.length === 0)
      ctx.diag.warn('table-unextractable', `Table ${label ?? id ?? ''} has no rows`.trim(), id);
    return [block];
  }
  const href = attrOf(findOne(figure, 'graphic'), 'url');
  return [
    {
      type: 'figure',
      ...(id && { id }),
      ...(label && { label }),
      ...(caption && { caption }),
      ...(href && { href }),
    },
  ];
}

/** A TEI `<table>`: `<row>`s of `<cell>`s, spans from `@cols` and `@rows`, headers from `@role="label"`. */
function readTeiTable(table: XmlNode, ctx: TeiContext): { headerRows: number; rows: string[][] } {
  return buildGrid(
    findAll(table, 'row').map((row) => ({
      cells: findAll(row, 'cell').map((cell) => ({
        colspan: spanValue(attrOf(cell, 'cols')),
        header: attrOf(cell, 'role') === 'label',
        rowspan: spanValue(attrOf(cell, 'rows')),
        text: inlineText(cell, ctx),
      })),
      inHead: attrOf(row, 'role') === 'label',
    })),
  );
}

// ─── Back matter and references ─────────────────────────────────────────────

/** `@type` values Grobid uses on back-matter divs, and the kind each is. */
const BACK_TYPES: ReadonlyMap<string, SectionKind> = new Map(
  Object.entries<SectionKind>({
    acknowledgement: 'acknowledgments',
    acknowledgements: 'acknowledgments',
    annex: 'appendix',
    availability: 'data-availability',
    conflict: 'declarations',
    contribution: 'declarations',
    funding: 'declarations',
  }),
);

/**
 * Back matter by Grobid's typed divs. An untitled part joins the untitled section of the
 * same kind before it (Grobid writes each author-contribution paragraph as a div of its
 * own), so one heading covers them.
 */
function extractBack(back: XmlNode | undefined, ctx: TeiContext): Section[] {
  const sections: Section[] = [];
  for (const div of findAll(back, 'div')) {
    const type = (attrOf(div, 'type') ?? '').toLowerCase();
    if (type === 'references') continue;
    const inner = findAll(div, 'div');
    const targets = inner.length > 0 && !findOne(div, 'head') ? inner : [div];
    for (const target of targets) {
      const section = divSection(target, ctx, 'notes', `back${sections.length + 1}`);
      if (!section) continue;
      const part = {
        ...section,
        kind: BACK_TYPES.get(type) ?? kindFromTitle(section.title) ?? 'notes',
      };
      const previous = sections.at(-1);
      if (!part.title && previous && !previous.title && previous.kind === part.kind) {
        previous.blocks.push(...part.blocks);
        previous.sections.push(...part.sections);
        ctx.sectionIds.delete(part.id);
      } else {
        sections.push(part);
      }
    }
  }
  return sections;
}

/** One `<biblStruct>`: Grobid's raw citation when present, else a citation built from its fields. */
function parseBiblStruct(bibl: XmlNode): Reference | undefined {
  const analytic = findOne(bibl, 'analytic');
  const monogr = findOne(bibl, 'monogr');
  const authors = findAll(analytic ?? monogr, 'author')
    .map((author) => personName(findOne(author, 'persname'))?.name)
    .filter((name): name is string => Boolean(name));
  const title =
    plainText(findOne(analytic, 'title')) ||
    plainText(findAll(monogr, 'title').find((t) => attrOf(t, 'level') === 'm'));
  const sourceTitle = plainText(findOne(monogr, 'title'));
  const source = sourceTitle !== title ? sourceTitle : '';
  const imprint = findOne(monogr, 'imprint');
  const year = /\d{4}/.exec(
    attrOf(findOne(imprint, 'date'), 'when') ?? plainText(findOne(imprint, 'date')),
  )?.[0];
  const scope = (unit: string) => {
    const node = findAll(imprint, 'biblscope').find((s) => attrOf(s, 'unit') === unit);
    return node
      ? plainText(node) || [attrOf(node, 'from'), attrOf(node, 'to')].filter(Boolean).join('–')
      : '';
  };
  const ids = new Map<string, string>();
  for (const idno of findAllDescendants(bibl, 'idno')) {
    const type = (attrOf(idno, 'type') ?? '').toLowerCase();
    if (type && !ids.has(type)) ids.set(type, plainText(idno));
  }
  const doi = ids.get('doi')?.toLowerCase();
  const url = attrOf(findAllDescendants(bibl, 'ptr')[0], 'target');
  const raw = plainText(findAll(bibl, 'note').find((n) => attrOf(n, 'type') === 'raw_reference'));

  const volume = escapeInline(scope('volume'));
  const issue = escapeInline(scope('issue'));
  const pages = escapeInline(scope('page'));
  const built = [
    authors.length > 0 && `${escapeInline(authors.join(', '))}.`,
    year && `(${year}).`,
    title && `${escapeInline(title)}.`,
    source &&
      `${emphasis(escapeInline(source), '*')}${volume ? ` ${volume}${issue ? `(${issue})` : ''}` : ''}${pages ? `:${pages}` : ''}.`,
    doi && `DOI ${escapeInline(doi)}`,
  ]
    .filter(Boolean)
    .join(' ');
  const text = raw ? escapeInline(raw) : built;
  if (!text) return;
  const id = attrOf(bibl, 'xml:id');
  const arxivValue = ids.get('arxiv');
  const arxiv = arxivValue && arxivId(arxivValue);
  const pmid = ids.get('pmid');
  return {
    ...(id && { id }),
    text,
    ...(authors.length > 0 && { authors }),
    ...(title && { title }),
    ...(source && { source }),
    ...(year && { year }),
    ...(doi && { doi }),
    ...(arxiv && { arxiv }),
    ...(pmid && { pmid }),
    ...(url && !doi && { url }),
  };
}
