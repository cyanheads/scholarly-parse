/**
 * @fileoverview `parseHtml`: a publisher or preprint-server article page →
 * `ScholarlyDocument`. Front matter comes from the page's `citation_*` and Dublin Core
 * tags; the article container is the smallest page region holding nearly all of its
 * prose; headings inside it become the section tree. Structure is inferred from
 * presentation, so the result is `partial` quality.
 * @module src/formats/html/parse
 */

import {
  CDATA_SECTION_NODE,
  childElements,
  childNodes,
  isElement,
  loadBoundedDocument,
  TEXT_NODE,
  tagOf,
  textOfElement,
  truncatedNestingMessage,
} from '../../html/dom.js';
import { interstitialReason } from '../../html/interstitial.js';
import { createDiagnostics } from '../../model/diagnostics.js';
import type {
  Abstract,
  AbstractKind,
  Block,
  ScholarlyDocument,
  Section,
  SectionKind,
} from '../../model/document.js';
import { largest } from '../../model/extremes.js';
import { decodeText, exceedsBudget } from '../../model/input.js';
import {
  failed,
  guardAsync,
  type ParseOptions,
  type ParseResult,
  parsed,
} from '../../model/result.js';
import { issueId } from '../../model/section-ids.js';
import { kindFromTitle, splitSectionNumber } from '../../model/section-kinds.js';
import { createGridBudget } from '../../model/table-grid.js';
import { escapeInline } from '../../render/escape.js';
import { floatKind, flowBlocks, isLinkList } from './blocks.js';
import { createSubtreeFacts, type HtmlContext, isFurniture, nameTokens } from './context.js';
import { inlineText } from './inline.js';
import {
  extractMetadata,
  metaAbstract,
  metaReferences,
  readMetaTags,
  titleTag,
} from './metadata.js';
import { extractReferences } from './references.js';
import { plainText, textIs, textLength } from './subtree.js';

/** Options for {@link parseHtml}. */
export interface HtmlOptions extends ParseOptions {
  /** The page's URL, so relative image and link targets resolve. */
  baseUrl?: string;
}

const DEFAULT_MAX_INPUT_BYTES = 32 * 1024 * 1024;

/** Parse a publisher article page. Requires the optional `linkedom` peer. */
export function parseHtml(
  input: string | Uint8Array,
  options: HtmlOptions = {},
): Promise<ParseResult> {
  return guardAsync(() => readHtml(input, options));
}

async function readHtml(input: string | Uint8Array, options: HtmlOptions): Promise<ParseResult> {
  const maxBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
  if (exceedsBudget(input, maxBytes))
    return failed('too-large', `Input exceeds the ${maxBytes}-byte budget`);
  const source = decodeText(input);
  if (!/<(?:html|body|head|meta|div|p|article)[\s>]/i.test(source)) {
    return failed('wrong-format', 'Not an HTML page: no html, head, or body markup');
  }
  const blocked = interstitialReason(source);
  if (blocked) return failed('blocked', blocked);

  const { document, droppedTags } = await loadBoundedDocument(source);
  const ctx: HtmlContext = {
    baseUrl: options.baseUrl,
    diag: createDiagnostics(),
    elementIds: new Set(
      Array.from(
        document.querySelectorAll('[id]'),
        (element) => element.getAttribute('id') ?? '',
      ).filter(Boolean),
    ),
    footnotes: [],
    gridBudget: createGridBudget(),
    sectionIds: new Set(),
    subtrees: createSubtreeFacts(),
  };
  if (droppedTags > 0) ctx.diag.warn('truncated-input', truncatedNestingMessage(droppedTags));
  const tags = readMetaTags(document);
  const root = contentRoot(document);
  const titleHeading = root ? findTitleHeading(root, titleTag(tags), ctx) : undefined;
  const metadata = extractMetadata(
    document,
    tags,
    titleHeading ? inlineText(titleHeading, ctx) : undefined,
  );

  const outline = root
    ? buildOutline(root, titleHeading, ctx)
    : { beforeTitle: 0, lead: [], sections: [] };
  const { abstracts, back, body, references } = classify(outline, titleHeading !== undefined, ctx);

  if (abstracts.length === 0) {
    const fallback = metaAbstract(tags);
    if (fallback) {
      abstracts.push({
        kind: 'main',
        sections: [
          {
            blocks: [{ text: escapeInline(fallback), type: 'paragraph' }],
            id: issueId(ctx.sectionIds, undefined, 'abstract-1-1'),
            kind: 'body',
            sections: [],
          },
        ],
      });
    }
  }
  const finalReferences = references.length > 0 ? references : metaReferences(tags);

  if (!metadata.title && abstracts.length === 0 && body.length === 0) {
    return failed('empty', 'The page carries no title, abstract, or article text');
  }
  if (!metadata.title) ctx.diag.warn('no-title', 'The page names no title');
  if (abstracts.length === 0) ctx.diag.warn('no-abstract', 'The page has no abstract');
  if (body.length === 0) {
    ctx.diag.warn(
      'no-body',
      abstracts.length > 0
        ? 'The page has an abstract but no article text: a landing page'
        : 'The page has no article text',
    );
  }
  ctx.diag.warn('structure-inferred', 'Sections were inferred from the page headings');

  const result: ScholarlyDocument = {
    abstracts,
    back,
    body,
    diagnostics: ctx.diag.finish('partial'),
    floats: [],
    footnotes: ctx.footnotes,
    format: 'html',
    metadata,
    references: finalReferences,
  };
  return parsed(result);
}

// ─── Content root ───────────────────────────────────────────────────────────

/** Regions whose paragraphs are not article prose. */
const ASIDE_TAGS: ReadonlySet<string> = new Set(['aside', 'nav', 'footer']);
const ASIDE_ROLES: ReadonlySet<string> = new Set(['complementary', 'navigation']);

function isAside(element: Element): boolean {
  const role = element.getAttribute('role');
  return ASIDE_TAGS.has(tagOf(element)) || (role !== null && ASIDE_ROLES.has(role));
}

/** How much a region holds: the text of its paragraphs outside asides, and all its text. */
interface RegionSize {
  prose: number;
  text: number;
}

/**
 * The size of each of `regions`, every one under `body`, from one walk of the body: a
 * region's size adds up its children's, so no subtree is read once per region around it.
 * A `<template>`'s paragraphs are not prose, as a selector query leaves them out.
 */
function regionSizes(body: Element, regions: ReadonlySet<Element>): Map<Element, RegionSize> {
  const sizes = new Map<Element, RegionSize>();
  const measure = (element: Element, inAside: boolean): RegionSize => {
    const size: RegionSize = { prose: 0, text: 0 };
    for (const node of childNodes(element)) {
      if (!isElement(node)) {
        if (node.nodeType === TEXT_NODE || node.nodeType === CDATA_SECTION_NODE)
          size.text += (node.textContent ?? '').length;
        continue;
      }
      const inner = measure(node, inAside || isAside(node) || tagOf(node) === 'template');
      size.prose += inner.prose + (tagOf(node) === 'p' && !inAside ? inner.text : 0);
      size.text += inner.text;
    }
    if (regions.has(element)) sizes.set(element, size);
    return size;
  };
  let inAside = false;
  for (let el: Element | null = body; el && !inAside; el = el.parentElement) inAside = isAside(el);
  measure(body, inAside);
  return sizes;
}

/**
 * The article region: of the page's `<article>` and `<main>` regions and the body, the
 * smallest one holding at least 90% of the prose the richest one holds. A related-article
 * card is an `<article>` too, but holds little prose.
 */
function contentRoot(document: Document): Element | undefined {
  const body = document.body ?? document.documentElement;
  if (!body) return;
  const candidates = [body, ...Array.from(body.querySelectorAll('main, article, [role="main"]'))];
  const sizes = regionSizes(body, new Set(candidates));
  const scored = candidates.map((element) => ({
    element,
    ...(sizes.get(element) ?? { prose: 0, text: 0 }),
  }));
  const best = largest(scored.map((c) => c.prose));
  return scored.filter((c) => c.prose >= best * 0.9).sort((a, b) => a.text - b.text)[0]?.element;
}

const HEADING = /^h([1-6])$/;
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

/**
 * The page's article-title heading: the first outline `<h1>` in the region, else the
 * first outline heading whose text is the title the tags name, whitespace collapsed and
 * case ignored (a landing page can set the title in an `<h3>`).
 */
function findTitleHeading(
  root: Element,
  tagTitle: string | undefined,
  ctx: HtmlContext,
): Element | undefined {
  const h1 = Array.from(root.querySelectorAll('h1')).find((h) => isOutlineHeading(h, root, ctx));
  if (h1 || !tagTitle) return h1;
  const title = tagTitle.replace(/\s+/g, ' ').trim();
  return Array.from(root.querySelectorAll(HEADING_SELECTOR)).find(
    (h) =>
      textLength(h, ctx) === title.length &&
      plainText(h, ctx).toLowerCase() === title.toLowerCase() &&
      isOutlineHeading(h, root, ctx),
  );
}

/** True when nothing between `heading` and `root` is furniture or a figure or table. */
function isOutlineHeading(heading: Element, root: Element, ctx: HtmlContext): boolean {
  for (let el: Element | null = heading; el && el !== root; el = el.parentElement) {
    if (isFurniture(el) || (el !== heading && floatKind(el, ctx))) return false;
  }
  return true;
}

// ─── Outline ────────────────────────────────────────────────────────────────

interface RawSection {
  heading: Element;
  level: number;
  nodes: Node[];
  sections: RawSection[];
}

interface Outline {
  /** How many top-level sections precede the title heading: page-level, not article. */
  beforeTitle: number;
  /** Content before the first section heading, after the title heading when there is one. */
  lead: Node[];
  sections: RawSection[];
}

/**
 * The elements under `root` that hold a split point — a heading `isSplit` accepts, with
 * no furniture, figure, or table between them — found in one walk, so no subtree is
 * searched once per element around it.
 */
function splitHolders(
  root: Element,
  isSplit: (heading: Element) => boolean,
  ctx: HtmlContext,
): Set<Element> {
  const holders = new Set<Element>();
  const holds = (element: Element): boolean => {
    let found = false;
    for (const child of childElements(element)) {
      if (isFurniture(child)) continue;
      if (HEADING.test(tagOf(child)) && isSplit(child)) found = true;
      if (holds(child) && !floatKind(child, ctx)) found = true;
    }
    if (found) holders.add(element);
    return found;
  };
  holds(root);
  return holders;
}

/**
 * The region as a heading tree. Each element is either split around the section
 * headings and the title heading inside it or, when it holds none, kept whole as
 * section content. The lead starts over at the title heading: what comes before it is
 * the page's header.
 */
function buildOutline(root: Element, titleHeading: Element | undefined, ctx: HtmlContext): Outline {
  const outline: Outline = { beforeTitle: 0, lead: [], sections: [] };
  const stack: RawSection[] = [];
  const append = (node: Node) => (stack.at(-1)?.nodes ?? outline.lead).push(node);

  const titleText = textOfElement(titleHeading);
  // Pages repeat the title in a sticky header; every heading reading as the title is the title.
  const isTitle = (el: Element) =>
    el === titleHeading ||
    (titleText !== '' && HEADING.test(tagOf(el)) && textIs(el, ctx, titleText));
  const holders = splitHolders(root, (h) => h === titleHeading || !isTitle(h), ctx);
  const visit = (parent: Element) => {
    for (const node of childNodes(parent)) {
      if (!isElement(node)) {
        append(node);
        continue;
      }
      if (isTitle(node)) {
        if (node !== titleHeading) continue;
        outline.beforeTitle = outline.sections.length;
        outline.lead = [];
        stack.length = 0;
        continue;
      }
      if (isFurniture(node)) continue;
      // An empty heading (a label left to the stylesheet) marks no boundary.
      const level = HEADING.exec(tagOf(node))?.[1];
      if (level && textLength(node, ctx) > 0) {
        const section: RawSection = {
          heading: node,
          level: Number(level),
          nodes: [],
          sections: [],
        };
        while ((stack.at(-1)?.level ?? 0) >= section.level) stack.pop();
        (stack.at(-1)?.sections ?? outline.sections).push(section);
        stack.push(section);
      } else if (holders.has(node) && !floatKind(node, ctx)) {
        visit(node);
      } else {
        append(node);
      }
    }
  };
  visit(root);
  return outline;
}

// ─── Classification ─────────────────────────────────────────────────────────

const REFERENCES_TITLE =
  /^(?:references?(?: and notes| cited)?|bibliography|literature cited|works cited|reference list|cited literature|notes and references)$/i;

/** Page furniture that arrives with a heading of its own. */
const FURNITURE_TITLE =
  /^(?:ask a research question|information|article details|figures?|tables?|figures and tables|similar (?:content|articles).*|related (?:articles|content|research)|recommended(?: articles)?|comments?|explore related subjects|about this article|rights and permissions|cite this article|article metrics|metrics|share(?: this article)?|author information|authors? and affiliations|associated data|download references|outline|keywords?|subjects?|article (?:information|info)|citations?|cited by|further reading|you may also (?:like|be interested in)|metadata|bibtex)$/i;

const ABSTRACT_TITLES: [RegExp, AbstractKind][] = [
  [/^(?:abstract|summary|structured abstract)$/i, 'main'],
  [
    /^(?:author summary|lay summary|plain[- ]language summary|significance(?: statement)?|executive summary|non-technical summary|in brief|editor'?s summary)$/i,
    'plain-language',
  ],
  [/^graphical abstract$/i, 'graphical'],
  [/^(?:highlights|research highlights|key points|key findings)$/i, 'other'],
];

function abstractKind(title: string): AbstractKind | undefined {
  return ABSTRACT_TITLES.find(([pattern]) => pattern.test(title))?.[1];
}

interface Classified {
  abstracts: Abstract[];
  back: Section[];
  body: Section[];
  references: ReturnType<typeof extractReferences>;
}

/**
 * Sort the outline's top-level sections: abstracts ahead of the body, the reference
 * list, back matter by title, and furniture dropped. After the reference list only back
 * matter is kept; publishers put recommendations, comments, and licensing boxes there.
 */
function classify(outline: Outline, hasTitleHeading: boolean, ctx: HtmlContext): Classified {
  const result: Classified = { abstracts: [], back: [], body: [], references: [] };
  const plainTitle = (raw: RawSection) => textOfElement(raw.heading).replace(/[:.]\s*$/, '');
  const hasAbstractHeading = outline.sections.some(
    (s) => abstractKind(plainTitle(s)) !== undefined,
  );

  // Content ahead of the first heading is the article's byline and dates when the page has a title heading or an abstract.
  if (!hasTitleHeading && !hasAbstractHeading) {
    const blocks = flowBlocks(outline.lead, ctx);
    if (blocks.length > 0)
      result.body.push({
        blocks,
        id: issueId(ctx.sectionIds, undefined, 's0'),
        kind: 'body',
        sections: [],
      });
  } else if (!hasAbstractHeading && !namesAbstract(outline.lead)) {
    // With a title and no abstract, the run after the byline can open the article: kept from its first prose paragraph.
    const kept = outline.lead.filter((node) => !(isElement(node) && isLinkList(node, ctx)));
    const blocks = flowBlocks(kept, ctx);
    const start = blocks.findIndex(
      (block) => block.type === 'paragraph' && readsAsProse(block.text),
    );
    if (start !== -1)
      result.body.push({
        blocks: blocks.slice(start),
        id: issueId(ctx.sectionIds, undefined, 's0'),
        kind: 'body',
        sections: [],
      });
  }

  let seenAbstract = false;
  let seenBody = false;
  let afterReferences = false;
  for (const raw of outline.sections.slice(outline.beforeTitle)) {
    const title = plainTitle(raw);
    // With an abstract heading on the page, headings ahead of it belong to the byline (author names, article type).
    if (hasAbstractHeading && !seenAbstract && !abstractKind(title)) continue;
    if (REFERENCES_TITLE.test(title)) {
      if (result.references.length === 0) result.references = extractReferences(allNodes(raw), ctx);
      afterReferences = true;
      continue;
    }
    const kind = kindFromTitle(title);
    if (FURNITURE_TITLE.test(title) || (afterReferences && !kind)) {
      // Furniture with a box of its own: what follows the box, before the next heading, is article text.
      const container = openedContainer(raw.heading);
      if (container && !afterReferences) {
        const outside = (node: Node) =>
          !container.contains(node) && !(isElement(node) && isLinkList(node, ctx));
        const blocks = flowBlocks(raw.nodes.filter(outside), ctx);
        const sections = raw.sections
          .filter((sub) => !container.contains(sub.heading))
          .map((sub) => convert(sub, 'body', ctx))
          .filter((sub) => sub !== undefined);
        if (blocks.length > 0 || sections.length > 0) {
          result.body.push({
            blocks,
            id: issueId(ctx.sectionIds, undefined, `s${ctx.sectionIds.size + 1}`),
            kind: 'body',
            sections,
          });
          seenBody = true;
        }
      }
      continue;
    }
    const abstract = seenBody ? undefined : abstractKind(title);
    if (abstract) {
      seenAbstract = true;
      const main =
        abstract === 'main' && result.abstracts.some((a) => a.kind === 'main') ? 'other' : abstract;
      const sections = abstractSections(abstractScope(raw), result.abstracts.length + 1, ctx);
      if (sections.length > 0) {
        result.abstracts.push({
          kind: main,
          sections,
          ...(!/^abstract$/i.test(title) && { title: inlineText(raw.heading, ctx) || title }),
        });
      }
      continue;
    }
    const section = convert(raw, kind ?? 'body', ctx);
    if (!section) continue;
    if (kind) {
      result.back.push(section);
    } else {
      result.body.push(section);
      seenBody = true;
    }
  }
  result.abstracts.sort((a, b) => Number(b.kind === 'main') - Number(a.kind === 'main'));
  return result;
}

/** True when an element among `nodes`, or one inside them, has `abstract` as a class or ID token. One pass. */
function namesAbstract(nodes: Node[]): boolean {
  const named = (element: Element) =>
    nameTokens(element.getAttribute('class')).includes('abstract') ||
    nameTokens(element.getAttribute('id')).includes('abstract');
  return nodes.some(
    (node) =>
      isElement(node) &&
      (named(node) || Array.from(node.querySelectorAll('[class], [id]')).some(named)),
  );
}

/** Labels that open a front-matter statement, not article prose. */
const FRONT_MATTER_LABEL =
  /^(?:©|(?:copyright|citation|received|accepted|published|editor|funding|competing interests|licen[cs]e|keywords|correspondence)(?!\p{L}))/iu;

/**
 * True for a paragraph's inline Markdown that reads as article prose, not a byline, an
 * affiliation, or a front-matter statement: 20 or more words, fewer than half of them
 * capitalized; a sentence's stop at the end, citation markers, brackets, and quotes
 * after it set aside; and no front-matter label opening it.
 */
function readsAsProse(markdown: string): boolean {
  const words = markdown.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (words.length < 20) return false;
  const capitalized = words.filter((word) => /^[^\p{L}\p{N}]*\p{Lu}/u.test(word)).length;
  if (capitalized * 2 >= words.length) return false;
  if (FRONT_MATTER_LABEL.test(markdown.replace(/^[\s*_\\[(]+/, ''))) return false;
  return /[.?!:]/.test(markdown.charAt(sentenceEnd(markdown) - 1));
}

/** Closing marks that can follow a sentence's stop: brackets, quotes, emphasis, and spaces. */
const AFTER_STOP = /[\s)\]"'”’»*_]/;

/** Longest citation marker set aside at a paragraph's end: `[12,13]`, `^{a}`. */
const MAX_MARKER = 32;

/**
 * Where a paragraph's sentence ends: before the citation markers (`[12]`, `^{3}`, `^a`)
 * and closing marks after its stop. Each step looks back a bounded distance, so the
 * scan is linear in what it sets aside.
 */
function sentenceEnd(text: string): number {
  let end = text.length;
  while (end > 0) {
    const char = text.charAt(end - 1);
    const open = char === ']' ? '[' : char === '}' ? '^{' : undefined;
    const window = Math.max(0, end - MAX_MARKER);
    const at = open ? text.slice(window, end - 1).lastIndexOf(open) : -1;
    if (open && at !== -1) end = window + at;
    else if (text.charAt(end - 2) === '^' && /[\p{L}\p{N}*]/u.test(char)) end -= 2;
    else if (AFTER_STOP.test(char)) end--;
    else break;
  }
  return end;
}

/** Every node of a raw section, its subsections' headings and content included. */
function allNodes(raw: RawSection): Node[] {
  return [...raw.nodes, ...raw.sections.flatMap((sub) => [sub.heading, ...allNodes(sub)])];
}

/**
 * An abstract ends with its own container when the heading opens one (`<div class=
 * "abstract"><h2>Abstract</h2>…</div>`): the article information a page sets after
 * that container, before the next heading, is not part of the abstract.
 */
function abstractScope(raw: RawSection): RawSection {
  const container = openedContainer(raw.heading);
  if (!container) return raw;
  return { ...raw, nodes: raw.nodes.filter((node) => container.contains(node)) };
}

/**
 * The sections of the page's `number`th abstract, its parts at the top level as a JATS
 * abstract's `<sec>`s are: content ahead of the first part is an untitled part of its
 * own. A page that sets the parts without headings — sibling blocks each led by a bold
 * label, as Cambridge's `<div class="sec"><span class="bold">Background</span><p>…` — has
 * them read as parts. A part the page gives no ID is `abstract-<number>-<m>`, as in JATS.
 */
function abstractSections(raw: RawSection, number: number, ctx: HtmlContext): Section[] {
  const partId = (m: number) => `abstract-${number}-${m}`;
  const labelled = raw.sections.length === 0 ? labelledParts(raw.nodes, partId, ctx) : undefined;
  if (labelled) return labelled;
  const parts: Section[] = [];
  const blocks = flowBlocks(raw.nodes, ctx);
  if (blocks.length > 0) {
    const id = issueId(ctx.sectionIds, headingSourceId(raw.heading), partId(1));
    parts.push({ blocks, id, kind: 'body', sections: [] });
  }
  for (const sub of raw.sections) {
    const part = convert(sub, 'body', ctx, partId(parts.length + 1));
    if (part) parts.push(part);
  }
  return parts;
}

/** Nodes that carry content: elements other than furniture, and text that is not only whitespace. */
function significant(nodes: Node[]): Node[] {
  return nodes.filter((node) =>
    isElement(node)
      ? !isFurniture(node)
      : node.nodeType === TEXT_NODE && (node.textContent ?? '').trim() !== '',
  );
}

/** A part's label: a short bold element opening `element`, with a paragraph after it. */
function partLabel(element: Element): Element | undefined {
  const [first, ...rest] = significant(childNodes(element));
  if (!first || !isElement(first)) return;
  const bold =
    tagOf(first) === 'b' ||
    tagOf(first) === 'strong' ||
    nameTokens(first.getAttribute('class')).includes('bold');
  const label = textOfElement(first);
  if (!bold || !label || label.length > 60) return;
  return rest.some((node) => isElement(node) && tagOf(node) === 'p') ? first : undefined;
}

/** The nodes the parts sit among, single wrappers (`div.abstract-content > div.abstract`) looked through. */
function partSiblings(nodes: Node[]): Node[] {
  const children = significant(nodes);
  const [only] = children;
  return children.length === 1 && only && isElement(only) && !partLabel(only)
    ? partSiblings(childNodes(only))
    : children;
}

/**
 * Sibling blocks each led by a bold label, as titled sections, the `m`th one's ID
 * `partId(m)` unless it has its own; undefined unless there are two or more and nothing
 * else.
 */
function labelledParts(
  nodes: Node[],
  partId: (m: number) => string,
  ctx: HtmlContext,
): Section[] | undefined {
  const parts = partSiblings(nodes).map((node) => {
    const label = isElement(node) ? partLabel(node) : undefined;
    return label && isElement(node) ? { element: node, label } : undefined;
  });
  if (parts.length < 2) return;
  const sections: Section[] = [];
  for (const part of parts) {
    if (!part) return;
    const content = childNodes(part.element).filter((node) => node !== part.label);
    const title = inlineText(part.label, ctx).replace(/[:.]\s*$/, '');
    const sourceId = part.element.getAttribute('id') ?? undefined;
    sections.push({
      blocks: flowBlocks(content, ctx),
      id: issueId(ctx.sectionIds, sourceId, partId(sections.length + 1)),
      kind: 'body',
      sections: [],
      ...(title && { title }),
    });
  }
  return sections;
}

/** The element a heading opens: its parent, when nothing with text comes before the heading in it. */
function openedContainer(heading: Element): Element | undefined {
  const parent = heading.parentElement;
  if (!parent) return;
  for (let el = heading.previousElementSibling; el; el = el.previousElementSibling) {
    if (textOfElement(el)) return;
  }
  return parent;
}

/** A section's ID in the page: its heading's, else that of the element the heading opens. */
function headingSourceId(heading: Element): string | undefined {
  return heading.getAttribute('id') ?? openedContainer(heading)?.getAttribute('id') ?? undefined;
}

/** A raw section and its subsections as model sections; `fallback` is its ID when the page gives none. */
function convert(
  raw: RawSection,
  kind: SectionKind,
  ctx: HtmlContext,
  fallback = `s${ctx.sectionIds.size + 1}`,
): Section | undefined {
  const { label, title } = splitSectionNumber(inlineText(raw.heading, ctx) || undefined, undefined);
  const id = issueId(ctx.sectionIds, headingSourceId(raw.heading), fallback);
  const blocks: Block[] = flowBlocks(raw.nodes, ctx);
  const sections = raw.sections
    .map((sub) => convert(sub, kind, ctx))
    .filter((s) => s !== undefined);
  if (blocks.length === 0 && sections.length === 0) {
    ctx.sectionIds.delete(id);
    return;
  }
  return { blocks, id, kind, ...(label && { label }), sections, ...(title && { title }) };
}
