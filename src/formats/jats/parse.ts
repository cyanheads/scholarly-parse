/**
 * @fileoverview `parseJats`: a JATS article (bare `<article>`, or wrapped in PMC's
 * `<pmc-articleset>` or an OAI-PMH response) → `ScholarlyDocument`.
 * @module src/formats/jats/parse
 */

import { createDiagnostics } from '../../model/diagnostics.js';
import type { Block, ScholarlyDocument, Section, SectionKind } from '../../model/document.js';
import { decodeText, exceedsBudget } from '../../model/input.js';
import { failed, type ParseOptions, type ParseResult, parsed } from '../../model/result.js';
import {
  attrOf,
  childrenOf,
  findAll,
  findDescendant,
  findOne,
  parseOrderedXml,
  tagNameOf,
  type XmlNode,
} from '../../xml/ordered.js';
import {
  blocksWithoutTitle,
  collectFootnotes,
  flowBlocks,
  ownBlockTitle,
  parseSection,
} from './blocks.js';
import { issueSectionId, type JatsContext } from './context.js';
import { extractAbstracts, extractMetadata } from './front.js';
import { inlineText } from './inline.js';
import { extractReferences } from './references.js';
import { text } from './text.js';

/** Default input budget: the largest real JATS articles run to a few megabytes. */
const DEFAULT_MAX_INPUT_BYTES = 32 * 1024 * 1024;

/** Parse a JATS XML article. */
export function parseJats(input: string | Uint8Array, options: ParseOptions = {}): ParseResult {
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
  const flavor = findDescendant(tree.nodes, 'pmc-articleset', 2) ? 'pmc' : undefined;

  const ctx: JatsContext = { diag: createDiagnostics(), footnotes: [], sectionIds: new Set() };
  const front = findOne(article, 'front');
  const articleMeta = findOne(front, 'article-meta');
  const metadata = extractMetadata(article, articleMeta, findOne(front, 'journal-meta'), ctx);
  const abstracts = extractAbstracts(articleMeta, ctx);
  const authorNotes = findOne(articleMeta, 'author-notes');
  if (authorNotes) collectFootnotes(authorNotes, ctx);
  const body = parseBody(findOne(article, 'body'), ctx, 'body', 's');
  const back = [...parseBack(findOne(article, 'back'), ctx), ...parseSubArticles(article, ctx)];
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
 * Sections of a `<body>` in document order. Consecutive loose children — `<p>` and
 * block elements outside any `<sec>` — form an untitled section, so an article that
 * mixes bare paragraphs with sections keeps its main text, and a legacy deposit whose
 * whole body is one `<preformat>` still yields it. A titled loose block (an
 * abbreviations `<def-list>`, a captioned `<boxed-text>`) forms a section of its own
 * under that title. (pubmed-mcp-server#130, #148)
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
      id: issueSectionId(ctx, undefined, nextId()),
      kind,
      sections: [],
    });
    pending = [];
  };

  for (const child of childrenOf(body)) {
    if (tagNameOf(child) === 'sec') {
      flushPending();
      const section = parseSection(child, ctx, kind, nextId());
      if (section) sections.push(section);
      continue;
    }
    const title = ownBlockTitle(child, ctx);
    if (title) {
      flushPending();
      const id = issueSectionId(ctx, attrOf(child, 'id'), nextId());
      sections.push({ blocks: blocksWithoutTitle(child, ctx), id, kind, sections: [], title });
      continue;
    }
    pending.push(...flowBlocks([child], ctx));
  }
  flushPending();
  return sections;
}

/** `@sec-type` / `@notes-type` values and the section kind each is reported as. */
const TYPED_KINDS: Readonly<Record<string, SectionKind>> = {
  'author-contributions': 'declarations',
  'coi-statement': 'declarations',
  'competing-interests': 'declarations',
  conflict: 'declarations',
  'data-availability': 'data-availability',
  data_availability: 'data-availability',
  'ethics-statement': 'declarations',
  'funding-information': 'declarations',
  'funding-statement': 'declarations',
};

/** The kind of a back-matter section, from its declared type, else its title. */
function backKind(node: XmlNode): SectionKind {
  const declared = (attrOf(node, 'sec-type') ?? attrOf(node, 'notes-type'))?.toLowerCase();
  if (declared && TYPED_KINDS[declared]) return TYPED_KINDS[declared];
  const title = text(findOne(node, 'title')).toLowerCase();
  if (/data (and code )?availability|availability of data/.test(title)) return 'data-availability';
  if (/acknowledg/.test(title)) return 'acknowledgments';
  if (/appendix/.test(title)) return 'appendix';
  if (
    /(competing|conflicts? of) interests?|funding|author contributions|ethic|declaration/.test(
      title,
    )
  ) {
    return 'declarations';
  }
  return 'notes';
}

/** Back matter: acknowledgments, appendices, declarations, notes; footnotes collected. */
function parseBack(back: XmlNode | undefined, ctx: JatsContext): Section[] {
  const sections: Section[] = [];
  const add = (node: XmlNode, kind: SectionKind) => {
    const section = parseSection(node, ctx, kind, `back${sections.length + 1}`);
    if (section) sections.push(section);
  };
  for (const child of childrenOf(back)) {
    switch (tagNameOf(child)) {
      case 'ack':
        add(child, 'acknowledgments');
        break;
      case 'app-group':
        for (const app of childrenOf(child)) {
          if (tagNameOf(app) === 'app') add(app, 'appendix');
          else if (['sec', 'p'].includes(tagNameOf(app) ?? '')) add(app, 'appendix');
        }
        break;
      case 'app':
        add(child, 'appendix');
        break;
      case 'sec':
      case 'notes':
        add(child, backKind(child));
        break;
      case 'glossary':
      case 'bio':
        add(child, 'notes');
        break;
      case 'fn-group':
        collectFootnotes(child, ctx);
        break;
      case 'ref-list':
      case 'label':
      case 'title':
      case undefined:
        break;
      default:
        ctx.diag.unhandled(`jats:back/${tagNameOf(child)}`);
        add(child, 'notes');
    }
  }
  return sections;
}

/**
 * `<sub-article>` and `<response>` elements — peer-review reports, author responses,
 * translations — each as a back section holding its own body.
 */
function parseSubArticles(article: XmlNode, ctx: JatsContext): Section[] {
  const subs = [...findAll(article, 'sub-article'), ...findAll(article, 'response')];
  return subs.flatMap((sub, index) => {
    const meta = findOne(findOne(sub, 'front'), 'article-meta') ?? findOne(sub, 'front-stub');
    const title = inlineText(findOne(findOne(meta, 'title-group'), 'article-title'), ctx);
    const id = issueSectionId(ctx, attrOf(sub, 'id'), `sub${index + 1}`);
    const sections = parseBody(findOne(sub, 'body'), ctx, 'sub-article', `${id}-s`);
    if (sections.length === 0) return [];
    return [{ blocks: [], id, kind: 'sub-article' as const, sections, ...(title && { title }) }];
  });
}
