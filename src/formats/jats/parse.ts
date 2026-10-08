/**
 * @fileoverview `parseJats`: a JATS article (bare `<article>`, or wrapped in PMC's
 * `<pmc-articleset>` or an OAI-PMH response) → `ScholarlyDocument`.
 * @module src/formats/jats/parse
 */

import { createDiagnostics } from '../../model/diagnostics.js';
import type { Block, ScholarlyDocument, Section, SectionKind } from '../../model/document.js';
import { append } from '../../model/extremes.js';
import { decodeText, exceedsBudget } from '../../model/input.js';
import { failed, guard, type ParseOptions, type ParseResult, parsed } from '../../model/result.js';
import { issueId } from '../../model/section-ids.js';
import { kindFromTitle, splitSectionNumber } from '../../model/section-kinds.js';
import { createGridBudget } from '../../model/table-grid.js';
import {
  attrOf,
  childrenOf,
  findAll,
  findDescendant,
  findOne,
  parseOrderedXml,
  tagNameOf,
  type XmlNode,
  type XmlNodeList,
} from '../../xml/ordered.js';
import {
  blocksWithoutTitle,
  collectFootnotes,
  flowBlocks,
  noteGroupSection,
  ownBlockTitle,
  parseSection,
} from './blocks.js';
import type { JatsContext } from './context.js';
import { extractAbstracts, extractMetadata, noteOwners, subArticleFront } from './front.js';
import { inlineText } from './inline.js';
import { extractReferences, isAssociatedData } from './references.js';
import { text } from './text.js';

/** Default input budget: the largest real JATS articles run to a few megabytes. */
const DEFAULT_MAX_INPUT_BYTES = 32 * 1024 * 1024;

/** Parse a JATS XML article. */
export function parseJats(input: string | Uint8Array, options: ParseOptions = {}): ParseResult {
  return guard(() => readJats(input, options));
}

function readJats(input: string | Uint8Array, options: ParseOptions): ParseResult {
  const maxBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
  if (exceedsBudget(input, maxBytes)) {
    return failed('too-large', `Input exceeds the ${maxBytes}-byte budget`);
  }
  const source = decodeText(input);
  if (!/<article[\s>]/.test(source)) {
    return failed('wrong-format', 'No <article> element: not a JATS document');
  }
  const tree = parseOrderedXml(source);
  if ('error' in tree) return failed('malformed', `XML could not be parsed: ${tree.error}`);

  const article = findDescendant(tree.nodes, 'article', 6);
  if (!article) return failed('wrong-format', 'No <article> element: not a JATS document');
  const flavor =
    findDescendant(tree.nodes, 'pmc-articleset', 2) || isPmcRecord(tree.nodes) ? 'pmc' : undefined;

  const front = findOne(article, 'front');
  const articleMeta = findOne(front, 'article-meta');
  const ctx: JatsContext = {
    diag: createDiagnostics(),
    footnotes: [],
    gridBudget: createGridBudget(),
    noteOwners: noteOwners(articleMeta),
    sectionIds: new Set(),
  };
  const metadata = extractMetadata(article, articleMeta, findOne(front, 'journal-meta'), ctx);
  const abstracts = extractAbstracts(articleMeta, ctx);
  const authorNotes = findOne(articleMeta, 'author-notes');
  if (authorNotes) collectFootnotes(authorNotes, ctx);
  const bodySections = parseBody(findOne(article, 'body'), ctx, 'body', 's');
  const body = bodySections.filter((section) => section.kind === 'body');
  const back = [
    ...parseBack(childrenOf(front), ctx, 'front'),
    ...bodySections.filter((section) => section.kind !== 'body'),
    ...parseBack(childrenOf(findOne(article, 'back')), ctx, 'back'),
    ...parseSubArticles(article, ctx),
  ];
  const floats = flowBlocks(childrenOf(findOne(article, 'floats-group')), ctx);
  const references = extractReferences(article);

  if (!metadata.title && abstracts.length === 0 && body.length === 0) {
    return failed('empty', 'The article carries no title, abstract, or body');
  }
  if (!metadata.title) ctx.diag.warn('no-title', 'The article has no title');
  if (abstracts.length === 0) ctx.diag.warn('no-abstract', 'The article has no abstract');
  if (body.length === 0)
    ctx.diag.warn('no-body', 'The article has no body text: front matter only');

  const document: ScholarlyDocument = {
    abstracts,
    back,
    body,
    diagnostics: ctx.diag.finish('structured'),
    ...(flavor && { flavor }),
    floats,
    footnotes: ctx.footnotes,
    format: 'jats',
    metadata,
    references,
  };
  return parsed(document);
}

/**
 * True for a record PMC serves over OAI-PMH: the header of the response's first record
 * names it `oai:pubmedcentral.nih.gov:<id>`.
 */
function isPmcRecord(nodes: XmlNodeList): boolean {
  const record = findDescendant(childrenOf(findOne(nodes, 'OAI-PMH')), 'record', 1);
  const identifier = text(findOne(findOne(record, 'header'), 'identifier'));
  return identifier.startsWith('oai:pubmedcentral.nih.gov:');
}

/**
 * Sections of a `<body>` in document order. Consecutive loose children — `<p>` and
 * block elements outside any `<sec>` — form an untitled section, so an article that
 * mixes bare paragraphs with sections keeps its main text, and a legacy deposit whose
 * whole body is one `<preformat>` still yields it. A titled loose block (an
 * abbreviations `<def-list>`, a captioned `<boxed-text>`) forms a section of its own
 * under that title. (pubmed-mcp-server#130, #148)
 *
 * In an article's own body, a top-level `<sec>` that declares or is titled as back
 * matter takes that kind: Europe PMC moves the whole `<back>` into `<body>` as typed and
 * titled sections, and Cell-style articles keep their declarations there. An untitled
 * wrapper with no content of its own (Europe PMC's `sec-type="app"`) gives way to its
 * subsections, and Europe PMC's generated Associated Data digest, which repeats the
 * data citations, supplementary files, and data availability statement, is skipped.
 */
function parseBody(
  body: XmlNode | undefined,
  ctx: JatsContext,
  kind: SectionKind,
  idPrefix: string,
): Section[] {
  if (!body) return [];
  const sections: Section[] = [];
  let pending: Block[] = [];
  const nextId = () => `${idPrefix}${sections.length + 1}`;
  const flushPending = () => {
    if (pending.length === 0) return;
    sections.push({
      blocks: pending,
      id: issueId(ctx.sectionIds, undefined, nextId()),
      kind,
      sections: [],
    });
    pending = [];
  };

  for (const child of childrenOf(body)) {
    if (tagNameOf(child) === 'sec') {
      flushPending();
      if (isAssociatedData(child)) continue;
      const own = (kind === 'body' && backMatterKind(child)) || kind;
      const section = parseSection(child, ctx, own, nextId());
      if (!section) continue;
      if (section.title === undefined && section.blocks.length === 0)
        append(sections, section.sections);
      else sections.push(section);
      continue;
    }
    const title = ownBlockTitle(child, ctx);
    if (title) {
      flushPending();
      const id = issueId(ctx.sectionIds, attrOf(child, 'id'), nextId());
      sections.push({ blocks: blocksWithoutTitle(child, ctx), id, kind, sections: [], title });
      continue;
    }
    append(pending, flowBlocks([child], ctx));
  }
  flushPending();
  return sections;
}

/** `@sec-type` / `@notes-type` values and the section kind each is reported as. */
const TYPED_KINDS: ReadonlyMap<string, SectionKind> = new Map(
  Object.entries<SectionKind>({
    ack: 'acknowledgments',
    app: 'appendix',
    'author-contributions': 'declarations',
    'coi-statement': 'declarations',
    'competing-interests': 'declarations',
    conflict: 'declarations',
    'contrib-info': 'notes',
    'data-availability': 'data-availability',
    data_availability: 'data-availability',
    'ethics-statement': 'declarations',
    'funding-information': 'declarations',
    'funding-statement': 'declarations',
    glossary: 'notes',
    'supplementary-material': 'appendix',
  }),
);

/** The back-matter kind a `<sec>` or `<notes>` declares, else the one its title names. */
function backMatterKind(node: XmlNode): SectionKind | undefined {
  const declared = (attrOf(node, 'sec-type') ?? attrOf(node, 'notes-type'))?.toLowerCase();
  return (
    TYPED_KINDS.get(declared ?? '') ??
    kindFromTitle(splitSectionNumber(text(findOne(node, 'title')), undefined).title)
  );
}

/** `<app-group>` children read other than as the group's display content. */
const APP_GROUP_PARTS: ReadonlySet<string> = new Set(['label', 'ref-list', 'title']);

/**
 * Back matter — acknowledgments, appendices, declarations, notes — from the children of
 * `<back>`, or of `<front>`, which may hold the same elements after its metadata (F1000's
 * version-change `<notes>`). Footnotes are collected. An untitled wrapper with no content
 * of its own gives way to its sections.
 *
 * An `<app-group>` gives a section per `<app>` or `<sec>`, and its other content — a
 * paragraph, a figure, a `<supplementary-material>` (JMIR's multimedia appendices) — reads
 * in document order as the blocks of appendix sections between them, under the group's
 * label and title.
 */
function parseBack(nodes: XmlNodeList, ctx: JatsContext, where: 'back' | 'front'): Section[] {
  const sections: Section[] = [];
  const nextId = () => `${where}${sections.length + 1}`;
  const add = (node: XmlNode, kind: SectionKind) => {
    const section = parseSection(node, ctx, kind, nextId());
    if (!section) return;
    if (section.title === undefined && section.blocks.length === 0)
      append(sections, section.sections);
    else sections.push(section);
  };
  const appGroup = (group: XmlNode) => {
    const heading = splitSectionNumber(
      inlineText(findOne(group, 'title'), ctx) || undefined,
      text(findOne(group, 'label')) || undefined,
    );
    let content: XmlNodeList = [];
    const addContent = () => {
      const blocks = flowBlocks(content, ctx);
      content = [];
      if (blocks.length === 0) return;
      const id = issueId(ctx.sectionIds, undefined, nextId());
      sections.push({ blocks, id, kind: 'appendix', sections: [], ...heading });
    };
    for (const child of childrenOf(group)) {
      const tag = tagNameOf(child) ?? '';
      if (tag === 'app' || tag === 'sec') {
        addContent();
        add(child, 'appendix');
      } else if (!APP_GROUP_PARTS.has(tag)) {
        content.push(child);
      }
    }
    addContent();
  };
  for (const child of nodes) {
    switch (tagNameOf(child)) {
      case 'ack':
        add(child, 'acknowledgments');
        break;
      case 'app-group':
        appGroup(child);
        break;
      case 'app':
        add(child, 'appendix');
        break;
      case 'sec':
      case 'notes':
        add(child, backMatterKind(child) ?? 'notes');
        break;
      case 'glossary':
      case 'bio':
        add(child, 'notes');
        break;
      case 'fn-group': {
        const kind = backMatterKind(child) ?? 'notes';
        const section = noteGroupSection(child, ctx, kind, `${where}${sections.length + 1}`);
        if (section) sections.push(section);
        else collectFootnotes(child, ctx);
        break;
      }
      case 'ref-list':
      case 'label':
      case 'title':
      case 'journal-meta':
      case 'article-meta':
      case undefined:
        break;
      default:
        ctx.diag.unhandled(`jats:${where}/${tagNameOf(child)}`);
        add(child, 'notes');
    }
  }
  return sections;
}

/**
 * `<sub-article>` and `<response>` elements — peer-review reports, author responses,
 * translations — each as a back section holding its own body, led by its contributors
 * and author notes.
 */
function parseSubArticles(article: XmlNode, ctx: JatsContext): Section[] {
  const subs = [...findAll(article, 'sub-article'), ...findAll(article, 'response')];
  return subs.flatMap((sub, index) => {
    const meta = findOne(findOne(sub, 'front'), 'article-meta') ?? findOne(sub, 'front-stub');
    const title = inlineText(findOne(findOne(meta, 'title-group'), 'article-title'), ctx);
    const id = issueId(ctx.sectionIds, attrOf(sub, 'id'), `sub${index + 1}`);
    const sections = parseBody(findOne(sub, 'body'), ctx, 'sub-article', `${id}-s`);
    if (sections.length === 0) return [];
    const blocks = subArticleFront(meta, ctx);
    return [{ blocks, id, kind: 'sub-article' as const, sections, ...(title && { title }) }];
  });
}
