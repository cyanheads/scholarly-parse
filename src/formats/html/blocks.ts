/**
 * @fileoverview Publisher HTML → typed blocks. Figures and tables are recognized by
 * their container (`<figure>`, or an element whose class names a figure or table) and
 * read whole: image or grid, label, and caption, with the container's download and
 * "full size" links left out. Display math is read from equation containers and
 * MathJax display scripts.
 * @module src/formats/html/blocks
 */

import {
  childElements,
  childNodes,
  isElement,
  resolveUrl,
  TEXT_NODE,
  tagOf,
  textOfElement,
} from '../../html/dom.js';
import { domMathTex } from '../../html/math.js';
import { readHtmlTable } from '../../html/tables.js';
import type {
  Block,
  FigureBlock,
  FormulaBlock,
  SupplementBlock,
  TableBlock,
} from '../../model/document.js';
import { append } from '../../model/extremes.js';
import { tableName, truncatedGridMessage } from '../../model/table-grid.js';
import { escapeInline } from '../../render/escape.js';
import { collapseInline, emphasis } from '../../render/inline.js';
import { type HtmlContext, isFurniture, nameTokens } from './context.js';
import { inlineMarkdown, inlineText, isMathScript, scriptTex, warnImageFormula } from './inline.js';
import {
  BELOW,
  type Below,
  BLOCK_TAGS,
  below,
  ownText,
  plainText,
  shortText,
  textFacts,
  textLead,
  textLength,
} from './subtree.js';

/** What a container holds, when it is a figure, table, or supplementary file read as one block. */
export type FloatKind = 'figure' | 'table' | 'supplement';

/** Tags a figure, table, or supplement container can have; class names on anything else don't make one. */
const CONTAINER_TAGS: ReadonlySet<string> = new Set(['div', 'figure', 'section', 'li', 'details']);

const SUPPLEMENT_TOKENS: ReadonlySet<string> = new Set([
  'supplementary',
  'supplement',
  'suppl',
  'supp',
]);

/**
 * A figure, table, or supplementary-file container, or undefined. `<table>` and
 * `<figure>` qualify by tag; other elements by a class token (`figure`, `fig`, `table`,
 * `tw`, `supplementary`) together with the image, table, or file link they wrap, so a
 * class alone never swallows a section.
 */
export function floatKind(element: Element, ctx: HtmlContext): FloatKind | undefined {
  const tag = tagOf(element);
  if (tag === 'table') return 'table';
  // An inline element with a figure or table class is a cross-reference (`<a class="xref table">`), not a float.
  if (!CONTAINER_TAGS.has(tag)) return;
  const tokens = nameTokens(element.getAttribute('class'));
  const figureLike = tag === 'figure' || tokens.includes('figure') || tokens.includes('fig');
  const tableLike = tokens.includes('table') || tokens.includes('tw');
  const supplementLike = tokens.some((t) => SUPPLEMENT_TOKENS.has(t));
  if (!figureLike && !tableLike && !supplementLike) return;
  const inside = below(element, ctx);
  // A class names a wrapper; one that holds sections is a layout region, not a float.
  if (tag !== 'figure' && inside.kinds & BELOW.sectioning) return;
  if (supplementLike)
    return inside.kinds & BELOW.link && inside.tables === 0 ? 'supplement' : undefined;
  if (inside.tables > 1) return;
  if (inside.tables === 1) return 'table';
  const hasImage = (inside.kinds & BELOW.image) !== 0;
  if (!hasImage && !tableLike) return;
  if (!hasImage && !/^\s*Table\b/i.test(textLead(element, ctx, 40))) return;
  // The first caption-like text tells a table rendered as an image from a figure.
  const caption = textLead(inside.firstCaption ?? element, ctx, 40);
  return /^\s*(?:Supplementary\s+)?Table\b/i.test(caption) || !hasImage ? 'table' : 'figure';
}

/** True when `element` or an ancestor below `container` is furniture. */
function insideFurniture(element: Element, container: Element): boolean {
  for (let el: Element | null = element; el && el !== container; el = el.parentElement) {
    if (isFurniture(el)) return true;
  }
  return false;
}

interface Flow {
  blocks: Block[];
  run: string;
}

function flushRun(flow: Flow): void {
  const text = collapseInline(flow.run);
  if (text) flow.blocks.push({ text, type: 'paragraph' });
  flow.run = '';
}

function isBlockElement(element: Element, ctx: HtmlContext): boolean {
  return (
    BLOCK_TAGS.has(tagOf(element)) ||
    floatKind(element, ctx) !== undefined ||
    displayFormula(element, ctx) !== undefined
  );
}

function walk(nodes: Node[], flow: Flow, ctx: HtmlContext): void {
  for (const node of nodes) {
    if (node.nodeType === TEXT_NODE) {
      flow.run += inlineMarkdown([node], ctx);
      continue;
    }
    if (!isElement(node)) continue;
    if (isMathScript(node)) {
      if (/mode\s*=\s*display/i.test(node.getAttribute('type') ?? '')) {
        flushRun(flow);
        const tex = scriptTex(node);
        if (tex) flow.blocks.push({ tex, type: 'formula' });
      } else {
        flow.run += inlineMarkdown([node], ctx);
      }
      continue;
    }
    if (isFurniture(node)) continue;
    if (isBlockElement(node, ctx)) {
      flushRun(flow);
      append(flow.blocks, renderBlock(node, ctx));
    } else if (tagOf(node) !== 'math' && below(node, ctx).kinds & BELOW.block) {
      walk(childNodes(node), flow, ctx);
    } else {
      flow.run += inlineMarkdown([node], ctx);
    }
  }
}

/** Blocks for a node list, in document order. */
export function flowBlocks(nodes: Node[], ctx: HtmlContext): Block[] {
  const flow: Flow = { blocks: [], run: '' };
  walk(nodes, flow, ctx);
  flushRun(flow);
  return flow.blocks;
}

function renderBlock(element: Element, ctx: HtmlContext): Block[] {
  const formula = displayFormula(element, ctx);
  if (formula?.href) {
    const href = resolveUrl(formula.href, ctx.baseUrl);
    warnImageFormula(ctx, href, formula.id);
    return [{ ...formula, href }];
  }
  if (formula) return [formula];
  const kind = floatKind(element, ctx);
  if (kind === 'table') return [tableBlock(element, ctx)];
  if (kind === 'figure') return [figureBlock(element, ctx)];
  if (kind === 'supplement') return [supplementBlock(element, ctx)];
  const tag = tagOf(element);
  if (tag === 'hr') return [];
  if (tag === 'ul' || tag === 'ol') return listBlock(element, ctx);
  if (tag === 'dl') return descriptionList(element, ctx);
  if (tag === 'pre') {
    const text = (element.textContent ?? '').replace(/^\n/, '').trimEnd();
    return text ? [{ text, type: 'code' }] : [];
  }
  if (
    tag === 'blockquote' ||
    (CONTAINER_TAGS.has(tag) && nameTokens(element.getAttribute('class')).includes('quote'))
  ) {
    return [{ blocks: flowBlocks(childNodes(element), ctx), type: 'quote' }];
  }
  if (/^h[1-6]$/.test(tag)) {
    const title = inlineText(element, ctx);
    return title ? [{ text: emphasis(title, '**'), type: 'paragraph' }] : [];
  }
  return flowBlocks(childNodes(element), ctx);
}

// ─── Display math ───────────────────────────────────────────────────────────

/** A printed equation number: `(1)`, `(2.3a)`. */
const EQUATION_NUMBER = /^\(?\s*([A-Z]?\d+(?:\.\d+)*[a-z]?)\s*\)?$/;

/**
 * A display equation, or undefined. Equation containers (`c-article-equation`,
 * `disp-formula`) hold one formula — MathML, a MathJax script, or raw `$$…$$` — and
 * often its number in a separate cell. One holding only an image of the formula (PLOS
 * sets each as a `<span class="equation">` around it) yields that image's address.
 */
function displayFormula(element: Element, ctx: HtmlContext): FormulaBlock | undefined {
  const tag = tagOf(element);
  if (tag === 'math' && element.getAttribute('display') === 'block')
    return formulaFrom(element, undefined, false, ctx);
  const tokens = nameTokens(element.getAttribute('class'));
  if (tokens.includes('inline') || !tokens.some((t) => t === 'equation' || t === 'formula')) return;
  const inside = below(element, ctx);
  const number = inside.firstNumbered && shortText(inside.firstNumbered, ctx);
  const label = EQUATION_NUMBER.exec(number ?? '')?.[1];
  const image = equationImage(element, inside, ctx);
  if (image) {
    const id = element.getAttribute('id') ?? undefined;
    return { type: 'formula', href: image, ...(id && { id }), ...(label && { label }) };
  }
  if (!CONTAINER_TAGS.has(tag)) return;
  if (inside.kinds & (BELOW.table | BELOW.plainImage | BELOW.figure)) return;
  return formulaFrom(element, label, true, ctx);
}

/** The one image an equation container holds when it has no math, source, or text besides its number. */
function equationImage(element: Element, inside: Below, ctx: HtmlContext): string | undefined {
  if (inside.kinds & (BELOW.math | BELOW.script | BELOW.table | BELOW.figure)) return;
  if (inside.images !== 1 || ownText(element, ctx).besidesNumber.visible > 0) return;
  return inside.firstImage?.getAttribute('src') ?? undefined;
}

/** Delimiters that wrap a display formula's TeX written as text: `$$…$$`, `\[…\]`, `\(…\)`. */
const TEX_DELIMITERS: ReadonlyMap<string, string> = new Map([
  ['$$', '$$'],
  ['\\[', '\\]'],
  ['\\(', '\\)'],
]);

/**
 * A formula from an equation container (or a display `<math>`): TeX from its MathML, else
 * its math source script, else its own text when delimiters wrap it whole; else its text.
 * `besidesNumber` leaves the container's equation number out of its own text. The
 * subtree is read in full only for a formula it returns.
 */
function formulaFrom(
  element: Element,
  label: string | undefined,
  besidesNumber: boolean,
  ctx: HtmlContext,
): FormulaBlock | undefined {
  const id = element.getAttribute('id') ?? undefined;
  const inside = below(element, ctx);
  const math = tagOf(element) === 'math' ? element : inside.firstMath;
  const script = inside.firstMathScript;
  let tex = math ? cachedTex(math, domMathTex, ctx) : '';
  if (!tex && script) tex = cachedTex(script, scriptTex, ctx);
  if (!tex) {
    const own = ownText(element, ctx);
    const { head, tail, visible } = besidesNumber ? own.besidesNumber : own.all;
    // Delimiters around at least one character other than whitespace: the TeX between them.
    if (visible === 5 && TEX_DELIMITERS.get(head) === tail) {
      const exclude = besidesNumber ? inside.firstNumbered : undefined;
      tex = sourceText(element, exclude).trim().slice(2, -2).trim();
    }
  }
  const source = math ?? element;
  const text =
    tex || textLength(source, ctx) === 0
      ? ''
      : plainText(source, ctx).replace(EQUATION_NUMBER, '').trim();
  if (!tex && !text) return;
  return {
    type: 'formula',
    ...(id && { id }),
    ...(label && { label }),
    ...(tex ? { tex } : { text }),
  };
}

/** The TeX `read` gives for a `<math>` or math script, read once per element. */
function cachedTex(element: Element, read: (element: Element) => string, ctx: HtmlContext): string {
  let tex = ctx.subtrees.tex.get(element);
  if (tex === undefined) {
    tex = read(element);
    ctx.subtrees.tex.set(element, tex);
  }
  return tex;
}

/** Text of an element without furniture and without one descendant (the equation number). */
function sourceText(element: Element, exclude: Element | undefined): string {
  return Array.from(element.childNodes)
    .map((node) => {
      if (!isElement(node)) return node.textContent ?? '';
      return node === exclude || isFurniture(node) ? '' : sourceText(node, exclude);
    })
    .join('');
}

// ─── Figures and tables ─────────────────────────────────────────────────────

/** A caption's leading label: `Fig. 1:`, `Figure S2.`, `Table 3 |`, `Extended Data Fig. 4`. */
const CAPTION_LABEL =
  /^((?:(?:Supplementary|Extended\s+Data|Appendix)\s+)?(?:Fig(?:ure)?s?|Table|Tab|Scheme|Chart|Plate|Box|Algorithm|Video|Movie|Map)\.?\s*(?:[A-Z]?\d+[A-Za-z]?(?:[.-]\d+)*|[IVX]+)|S\d+\s+(?:Fig(?:ure)?|Table|File|Data(?:set)?|Text|Appendix|Video|Movie|Checklist|Protocol|Code)|Additional\s+file\s+\d+|Supplementary\s+(?:Data|Materials?|Information|Note|File|Dataset|Methods|Software|Video|Movie)(?:\s+\d+)?)\s*[.:|—–-]?\s*/i;

/** Alt text that only repeats a label or says nothing (`thumbnail`, `Fig 1`). */
const EMPTY_ALT = /^(?:thumbnail|image|graphic|figure|fig\.?|table|icon)?\s*\d*[a-z]?$/i;

/** Link-list words publishers put in captions and reference entries, not part of the text. */
export const LINK_LABEL =
  /^(?:\[?\s*(?:doi|pubmed(?: abstract| central)?|pmc(?: free article)?|google scholar|cross ?ref|view article|article|full text|publisher full text|free full text|cas|ads|mathscinet|scopus|web of science|isi|medline|europe pmc|semantic scholar|ref list|full size (?:image|table)|open in a new tab|download(?: (?:figure|table|image|slide|ppt|pptx|png|tiff|jpg|high-res image|full-size image))?|view (?:larger|figure|table)|png|tiff|jpe?g|ppt|pptx|larger image|original image)\s*\]?\s*)$/i;

/**
 * True for an element that holds only links and link-list words ("Download: PNG TIFF",
 * "Full size image", "[DOI] [PubMed]"): navigation around a caption, not caption text.
 * Text outside its links that runs past the subtree text cap is not a link list.
 */
export function isLinkList(element: Element, ctx: HtmlContext): boolean {
  const text = shortText(element, ctx);
  if (text === '') return true;
  const { links, outside } = textFacts(element, ctx);
  if (!links) return text !== undefined && LINK_LABEL.test(text);
  return (
    outside !== undefined &&
    /^[\s[\]()|,;:.·•/-]*$/.test(outside.replace(/\b(?:download|view|export)s?\s*:?/gi, ''))
  );
}

/** Class tokens marking a container's caption text, and those marking its notes. */
const CAPTION_TOKENS: ReadonlySet<string> = new Set([
  'caption',
  'figcaption',
  'description',
  'desc',
  'legend',
  'title',
  'label',
]);
const NOTE_TOKENS: ReadonlySet<string> = new Set([
  'foot',
  'footer',
  'footnote',
  'footnotes',
  'fn',
  'notes',
]);

interface CaptionPieces {
  caption: string[];
  notes: string[];
}

type PieceRole = keyof CaptionPieces;

function roleOf(element: Element): PieceRole | undefined {
  const tokens = nameTokens(element.getAttribute('class'));
  if (tokens.some((t) => NOTE_TOKENS.has(t))) return 'notes';
  if (
    tokens.some((t) => CAPTION_TOKENS.has(t)) ||
    /^(figcaption|caption|h[1-6])$/.test(tagOf(element))
  )
    return 'caption';
  return;
}

/**
 * The text around a container's image or table: every text-bearing element that is not
 * the content itself, furniture, or a link list. A piece is caption or notes by its class
 * (`…__description`, `table-foot`), else by position: before the content is caption,
 * after it notes.
 */
function captionPieces(
  container: Element,
  content: Element | undefined,
  ctx: HtmlContext,
): CaptionPieces {
  const pieces: CaptionPieces = { caption: [], notes: [] };
  // The elements between the container and its content, so each is known at a glance.
  const aroundContent = new Set<Element>();
  for (let el = content?.parentElement; el && el !== container; el = el.parentElement)
    aroundContent.add(el);
  let passed = false;
  let run: Node[] = [];
  const push = (text: string, role: PieceRole | undefined) => {
    if (text) pieces[role ?? (passed ? 'notes' : 'caption')].push(text);
  };
  const flushInline = (role: PieceRole | undefined) => {
    push(collapseInline(inlineMarkdown(run, ctx)), role);
    run = [];
  };
  const visit = (element: Element, inherited: PieceRole | undefined) => {
    for (const node of childNodes(element)) {
      if (!isElement(node)) {
        run.push(node);
        continue;
      }
      if (node === content) {
        flushInline(inherited);
        passed = true;
        continue;
      }
      const role = roleOf(node) ?? inherited;
      if (aroundContent.has(node)) {
        flushInline(inherited);
        visit(node, role);
        continue;
      }
      if (isFurniture(node) || tagOf(node) === 'img' || tagOf(node) === 'picture') continue;
      const holdsBlock = (below(node, ctx).kinds & BELOW.block) !== 0;
      if (isBlockElement(node, ctx) || holdsBlock) {
        flushInline(inherited);
        if (isLinkList(node, ctx)) continue;
        if (holdsBlock && !/^(p|figcaption|caption|h[1-6])$/.test(tagOf(node))) {
          visit(node, role);
          continue;
        }
        push(inlineText(node, ctx), role);
        continue;
      }
      if (tagOf(node) === 'a' && LINK_LABEL.test(textOfElement(node))) continue;
      run.push(node);
    }
    flushInline(inherited);
  };
  visit(container, undefined);
  return pieces;
}

/** A label split from the front of a caption, and the caption with the title in bold when a description follows. */
function splitCaption(pieces: string[]): { caption?: string; label?: string } {
  const [first, ...rest] = pieces;
  if (first === undefined) return {};
  // A title set wholly in bold or italic (`**Fig. 1: Title.**`) is unwrapped; the title is re-emphasized below.
  // A label that links to the file or image (`[S1 Table.](…)The amplified…`) reads as its text.
  const unlinked = first.replace(/^\[([^\]]+)\]\([^)]*\)\s*/, '$1 ');
  const lead = /^(\*\*|\*)([^*][\s\S]*?)\1$/.exec(unlinked)?.[2] ?? unlinked;
  // A label emphasized on its own (`**Fig. 1.** Title`).
  const emphasized = /^(\*\*|\*)([^*]+?)\1\s*/.exec(lead);
  const labelOnly = emphasized && CAPTION_LABEL.exec(emphasized[2] ?? '');
  const match =
    labelOnly && labelOnly[0].trim() === emphasized[2]?.trim()
      ? labelOnly
      : CAPTION_LABEL.exec(lead);
  const label = match?.[1]?.replace(/\s+/g, ' ').trim();
  const consumed =
    match === labelOnly && emphasized ? emphasized[0].length : (match?.[0].length ?? 0);
  const title = lead.slice(consumed).trim();
  const parts = rest.length > 0 && title ? [emphasis(title, '**'), ...rest] : [title, ...rest];
  const caption = parts.filter(Boolean).join(' ');
  return { ...(label && { label }), ...(caption && { caption }) };
}

function imageOf(container: Element): Element | undefined {
  return container.querySelector('img') ?? undefined;
}

function imageHref(image: Element | undefined, ctx: HtmlContext): string | undefined {
  if (!image) return;
  const src =
    image.getAttribute('data-src') ??
    image.getAttribute('src') ??
    image.getAttribute('srcset')?.split(/\s+/)[0];
  if (!src || src.startsWith('data:')) return;
  return resolveUrl(src, ctx.baseUrl);
}

function figureBlock(container: Element, ctx: HtmlContext): FigureBlock {
  const image = imageOf(container);
  const pieces = captionPieces(container, image, ctx);
  const { caption, label } = splitCaption([...pieces.caption, ...pieces.notes]);
  const href = imageHref(image, ctx);
  const rawAlt = image?.getAttribute('alt')?.replace(/\s+/g, ' ').trim();
  const alt =
    rawAlt &&
    !EMPTY_ALT.test(rawAlt) &&
    !caption?.includes(escapeInline(rawAlt).slice(0, 40)) &&
    !CAPTION_LABEL.test(rawAlt)
      ? rawAlt
      : undefined;
  const id =
    container.getAttribute('id') ?? image?.closest('[id]')?.getAttribute('id') ?? undefined;
  return {
    type: 'figure',
    ...(id && { id }),
    ...(label && { label }),
    ...(caption && { caption }),
    ...(href && { href }),
    ...(alt && { alt }),
  };
}

/** A supplementary file: its label and caption, and the file link (the one in its heading when it has one). */
function supplementBlock(container: Element, ctx: HtmlContext): SupplementBlock {
  const { caption, label } = splitCaption(captionPieces(container, undefined, ctx).caption);
  const links = Array.from(container.querySelectorAll('a[href]')).filter(
    (a) => !insideFurniture(a, container),
  );
  const fileLink =
    links.find((a) =>
      a.closest('h1, h2, h3, h4, h5, h6, figcaption, [class*="title"], [class*="label"]'),
    ) ?? links[0];
  const href = fileLink?.getAttribute('href');
  const id = container.getAttribute('id') ?? undefined;
  return {
    type: 'supplement',
    ...(id && { id }),
    ...(label && { label }),
    ...(caption && { caption }),
    ...(href && { href: resolveUrl(href, ctx.baseUrl) }),
  };
}

function tableBlock(container: Element, ctx: HtmlContext): TableBlock {
  const table =
    tagOf(container) === 'table' ? container : (container.querySelector('table') ?? undefined);
  const pieces: CaptionPieces =
    table && table !== container
      ? captionPieces(container, table, ctx)
      : { caption: [], notes: [] };
  const captionEl = table ? childElements(table).find((c) => tagOf(c) === 'caption') : undefined;
  if (captionEl) pieces.caption.unshift(inlineText(captionEl, ctx));
  if (!table) {
    const around = captionPieces(container, imageOf(container), ctx);
    append(pieces.caption, around.caption);
    append(pieces.caption, around.notes);
  }
  const { caption, label } = splitCaption(pieces.caption);
  const id = container.getAttribute('id') ?? table?.getAttribute('id') ?? undefined;
  const grid = table
    ? readHtmlTable(table, (cell) => inlineText(cell, ctx), ctx.gridBudget, { boldHeaders: true })
    : { headerRows: 0, rows: [], truncated: false };
  const unextractable =
    grid.rows.length > 0
      ? undefined
      : imageOf(container)
        ? ('graphic-only' as const)
        : ('no-rows' as const);
  const name = tableName(label);
  if (grid.truncated) ctx.diag.warn('truncated-input', truncatedGridMessage(name), id);
  if (unextractable) ctx.diag.warn('table-unextractable', `${name} has no readable rows`, id);
  const footnotes = pieces.notes;
  return {
    type: 'table',
    ...(id && { id }),
    ...(label && { label }),
    ...(caption && { caption }),
    headerRows: grid.headerRows,
    rows: grid.rows,
    ...(footnotes.length > 0 && { footnotes }),
    ...(unextractable && { unextractable }),
  };
}

// ─── Lists ──────────────────────────────────────────────────────────────────

/**
 * A list: one item per `<li>`. Content between items (a list whose `<li>` tags were
 * left out of markup nested too deep) is an item of its own, so its text is kept.
 */
function listBlock(element: Element, ctx: HtmlContext): Block[] {
  const items: Block[][] = [];
  let loose: Node[] = [];
  const flushLoose = () => {
    if (loose.length > 0) items.push(flowBlocks(loose, ctx));
    loose = [];
  };
  for (const node of childNodes(element)) {
    if (!isElement(node) || tagOf(node) !== 'li') {
      loose.push(node);
    } else if (!isFurniture(node)) {
      flushLoose();
      items.push(flowBlocks(childNodes(node), ctx));
    }
  }
  flushLoose();
  const kept = items.filter((blocks) => blocks.length > 0);
  return kept.length > 0 ? [{ type: 'list', items: kept, ordered: tagOf(element) === 'ol' }] : [];
}

/** A description list: `**term** — definition` per item. */
function descriptionList(element: Element, ctx: HtmlContext): Block[] {
  const items: Block[][] = [];
  let term = '';
  for (const child of childElements(element)) {
    if (tagOf(child) === 'dt') {
      term = inlineText(child, ctx);
    } else if (tagOf(child) === 'dd') {
      const blocks = flowBlocks(childNodes(child), ctx);
      const [first] = blocks;
      if (term && first?.type === 'paragraph')
        first.text = `${emphasis(term, '**')} — ${first.text}`;
      else if (term) blocks.unshift({ text: emphasis(term, '**'), type: 'paragraph' });
      if (blocks.length > 0) items.push(blocks);
      term = '';
    }
  }
  return items.length > 0 ? [{ type: 'list', items, ordered: false }] : [];
}
