/**
 * @fileoverview `parseHtml`: a publisher or preprint-server article page →
 * `ScholarlyDocument`. Front matter comes from the page's `citation_*` and Dublin Core
 * tags; the article container is the smallest page region holding nearly all of its
 * prose; headings inside it become the section tree. Structure is inferred from
 * presentation, so the result is `partial` quality.
 * @module src/formats/html/parse
 */

import { childNodes, isElement, loadDocument, tagOf, textOfElement } from '../../html/dom.js';
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
import { decodeText, exceedsBudget } from '../../model/input.js';
import { failed, type ParseOptions, type ParseResult, parsed } from '../../model/result.js';
import { issueId } from '../../model/section-ids.js';
import { kindFromTitle, splitSectionNumber } from '../../model/section-kinds.js';
import { escapeInline } from '../../render/escape.js';
import { floatKind, flowBlocks, isLinkList } from './blocks.js';
import { type HtmlContext, isFurniture } from './context.js';
import { inlineText } from './inline.js';
import { extractMetadata, metaAbstract, metaReferences, readMetaTags } from './metadata.js';
import { extractReferences } from './references.js';

/** Options for {@link parseHtml}. */
export interface HtmlOptions extends ParseOptions {
  /** The page's URL, so relative image and link targets resolve. */
  baseUrl?: string;
}

const DEFAULT_MAX_INPUT_BYTES = 32 * 1024 * 1024;

/** Parse a publisher article page. Requires the optional `linkedom` peer. */
export async function parseHtml(
  input: string | Uint8Array,
  options: HtmlOptions = {},
): Promise<ParseResult> {
  const maxBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
  if (exceedsBudget(input, maxBytes))
    return failed('too-large', `Input exceeds the ${maxBytes}-byte budget`);
  const source = decodeText(input);
  if (!/<(?:html|body|head|meta|div|p|article)[\s>]/i.test(source)) {
    return failed('wrong-format', 'Not an HTML page: no html, head, or body markup');
  }
  const blocked = interstitialReason(source);
  if (blocked) return failed('blocked', blocked);

  const document = await loadDocument(source);
  const ctx: HtmlContext = {
    baseUrl: options.baseUrl,
    diag: createDiagnostics(),
    footnotes: [],
    sectionIds: new Set(),
  };
  const tags = readMetaTags(document);
  const root = contentRoot(document);
  const titleHeading = root ? findTitleHeading(root) : undefined;
  const metadata = extractMetadata(
    document,
    tags,
    titleHeading ? inlineText(titleHeading, ctx) : undefined,
  );

  const outline = root
    ? buildOutline(root, titleHeading)
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
            id: issueId(ctx.sectionIds, undefined, 'abstract'),
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
  if (body.length === 0) ctx.diag.warn('no-body', 'The page has no article text');
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

/** Prose a region holds: the text of its paragraphs, furniture excluded. */
function proseLength(element: Element): number {
  let total = 0;
  for (const p of Array.from(element.querySelectorAll('p'))) {
    if (
      !p.parentElement?.closest('aside, nav, footer, [role="complementary"], [role="navigation"]')
    ) {
      total += (p.textContent ?? '').length;
    }
  }
  return total;
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
  const scored = candidates.map((element) => ({
    element,
    prose: proseLength(element),
    size: (element.textContent ?? '').length,
  }));
  const best = Math.max(...scored.map((c) => c.prose));
  return scored.filter((c) => c.prose >= best * 0.9).sort((a, b) => a.size - b.size)[0]?.element;
}

const HEADING = /^h([1-6])$/;
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

/** The page's article-title heading: the first `<h1>` in the region. */
function findTitleHeading(root: Element): Element | undefined {
  return (
    Array.from(root.querySelectorAll('h1')).find((h) => isOutlineHeading(h, root)) ?? undefined
  );
}

/** True when nothing between `heading` and `root` is furniture or a figure or table. */
function isOutlineHeading(heading: Element, root: Element): boolean {
  for (let el: Element | null = heading; el && el !== root; el = el.parentElement) {
    if (isFurniture(el) || (el !== heading && floatKind(el))) return false;
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
  /** Content before the first section heading. */
  lead: Node[];
  sections: RawSection[];
}

/**
 * The region as a heading tree. Each element is either split around the section
 * headings inside it or, when it holds none, kept whole as section content.
 */
function buildOutline(root: Element, titleHeading: Element | undefined): Outline {
  const outline: Outline = { beforeTitle: 0, lead: [], sections: [] };
  const stack: RawSection[] = [];
  const append = (node: Node) => (stack.at(-1)?.nodes ?? outline.lead).push(node);

  const titleText = textOfElement(titleHeading);
  // Pages repeat the title in a sticky header; every heading reading as the title is the title.
  const isTitle = (el: Element) =>
    el === titleHeading ||
    (titleText !== '' && HEADING.test(tagOf(el)) && textOfElement(el) === titleText);
  const visit = (parent: Element) => {
    for (const node of childNodes(parent)) {
      if (!isElement(node)) {
        append(node);
        continue;
      }
      if (isTitle(node)) {
        if (node !== titleHeading) continue;
        outline.beforeTitle = outline.sections.length;
        stack.length = 0;
        continue;
      }
      if (isFurniture(node)) continue;
      // An empty heading (a label left to the stylesheet) marks no boundary.
      const level = HEADING.exec(tagOf(node))?.[1];
      if (level && textOfElement(node)) {
        const section: RawSection = {
          heading: node,
          level: Number(level),
          nodes: [],
          sections: [],
        };
        while ((stack.at(-1)?.level ?? 0) >= section.level) stack.pop();
        (stack.at(-1)?.sections ?? outline.sections).push(section);
        stack.push(section);
      } else if (
        !floatKind(node) &&
        Array.from(node.querySelectorAll(HEADING_SELECTOR)).some(
          (h) => !isTitle(h) && isOutlineHeading(h, node),
        )
      ) {
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
  /^(?:ask a research question|information|article details|figures?|tables?|figures and tables|similar (?:content|articles).*|related (?:articles|content|research)|recommended(?: articles)?|comments?|explore related subjects|about this article|rights and permissions|cite this article|article metrics|metrics|share(?: this article)?|author information|authors? and affiliations|associated data|download references|outline|keywords?|subjects?|article (?:information|info)|citations?|cited by|further reading|you may also (?:like|be interested in))$/i;

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
          !container.contains(node) && !(isElement(node) && isLinkList(node));
        const blocks = flowBlocks(raw.nodes.filter(outside), ctx);
        const sections = raw.sections
          .filter((sub) => !container.contains(sub.heading))
          .map((sub) => convert(sub, 'body', ctx, false))
          .filter((sub): sub is Section => sub !== undefined);
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
      const section = convert(abstractScope(raw), 'body', ctx, true);
      if (section) {
        result.abstracts.push({
          kind: main,
          sections: [section],
          ...(!/^abstract$/i.test(title) && { title: section.title ?? title }),
        });
        delete section.title;
      }
      continue;
    }
    const section = convert(raw, kind ?? 'body', ctx, false);
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

/** The element a heading opens: its parent, when nothing with text comes before the heading in it. */
function openedContainer(heading: Element): Element | undefined {
  const parent = heading.parentElement;
  if (!parent) return;
  for (let el = heading.previousElementSibling; el; el = el.previousElementSibling) {
    if (textOfElement(el)) return;
  }
  return parent;
}

function convert(
  raw: RawSection,
  kind: SectionKind,
  ctx: HtmlContext,
  untitled: boolean,
): Section | undefined {
  const { label, title } = splitSectionNumber(inlineText(raw.heading, ctx) || undefined, undefined);
  const sourceId =
    raw.heading.getAttribute('id') ?? openedContainer(raw.heading)?.getAttribute('id') ?? undefined;
  const id = issueId(
    ctx.sectionIds,
    sourceId,
    untitled ? 'abstract' : `s${ctx.sectionIds.size + 1}`,
  );
  const blocks: Block[] = flowBlocks(raw.nodes, ctx);
  const sections = raw.sections
    .map((sub) => convert(sub, kind, ctx, false))
    .filter((s): s is Section => s !== undefined);
  if (blocks.length === 0 && sections.length === 0) {
    ctx.sectionIds.delete(id);
    return;
  }
  return { blocks, id, kind, ...(label && { label }), sections, ...(title && { title }) };
}
