/**
 * @fileoverview LaTeXML HTML → typed blocks and sections. LaTeXML marks every construct
 * with an `ltx_*` class — `ltx_para`, `ltx_equation`, `ltx_theorem`, `ltx_tabular` —
 * and those classes, not the HTML tags, decide what a node is.
 * @module src/formats/latexml/blocks
 */

import {
  childElements,
  childNodes,
  childWhere,
  hasClass,
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
  BoxBlock,
  FormulaBlock,
  ListBlock,
  Section,
  SectionKind,
  TableBlock,
} from '../../model/document.js';
import { append } from '../../model/extremes.js';
import { issueId } from '../../model/section-ids.js';
import { splitSectionNumber } from '../../model/section-kinds.js';
import { truncatedGridMessage } from '../../model/table-grid.js';
import { trimTrailing } from '../../model/trailing.js';
import { escapeInline } from '../../render/escape.js';
import { collapseInline, emphasis, joinInlineSeams } from '../../render/inline.js';
import { type LatexmlContext, SKIP_TAGS } from './context.js';
import { inlineMarkdown, inlineRun, inlineText } from './inline.js';

const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'article',
  'blockquote',
  'div',
  'dl',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
]);

/**
 * Float classes. LaTeXML writes a float met in inline context as a `<span>` rather than
 * a `<figure>` (`<span class="ltx_table">` with a `<span class="ltx_caption">`); the
 * class, not the tag, makes it one.
 */
const FLOAT_CLASSES = ['ltx_figure', 'ltx_table', 'ltx_float'];

function isFloat(element: Element): boolean {
  return tagOf(element) === 'figure' || FLOAT_CLASSES.some((name) => hasClass(element, name));
}

/** True for anything that must not be flattened into a sentence. */
function isBlock(element: Element): boolean {
  return (
    BLOCK_TAGS.has(tagOf(element)) ||
    isFloat(element) ||
    hasClass(element, 'ltx_tabular') ||
    hasClass(element, 'ltx_equation') ||
    hasClass(element, 'ltx_equationgroup')
  );
}

/**
 * True when a block sits anywhere below the element. Each element's answer is kept, so
 * a chain of inline wrappers around a block is read once, not once per wrapper above it.
 */
function holdsBlock(element: Element, ctx: LatexmlContext): boolean {
  const known = ctx.blockHolders.get(element);
  if (known !== undefined) return known;
  const holds = childElements(element).some((child) => isBlock(child) || holdsBlock(child, ctx));
  ctx.blockHolders.set(element, holds);
  return holds;
}

/** Notes are inline even when they contain blocks: their content becomes a footnote. */
function isNote(element: Element): boolean {
  return hasClass(element, 'ltx_note');
}

interface Flow {
  blocks: Block[];
  run: string;
  /** Whether the run holds anything but whitespace, kept as it grows rather than read back. */
  runHasText: boolean;
}

/** Add inline Markdown to the run. */
function addToRun(flow: Flow, markdown: string): void {
  flow.run += markdown;
  if (!flow.runHasText) flow.runHasText = /\S/.test(markdown);
}

function flushRun(flow: Flow): void {
  const text = collapseInline(flow.run);
  if (text) flow.blocks.push({ text, type: 'paragraph' });
  flow.run = '';
  flow.runHasText = false;
}

function walk(nodes: Node[], flow: Flow, ctx: LatexmlContext): void {
  for (const node of nodes) {
    if (node.nodeType === TEXT_NODE) {
      addToRun(flow, escapeInline(node.textContent ?? ''));
      continue;
    }
    if (!isElement(node) || SKIP_TAGS.has(tagOf(node))) continue;
    if (isNote(node) && !flow.runHasText) {
      // A note outside any paragraph (author notes set between the front matter and §1)
      // has no text for its mark to follow: its content is still collected.
      inlineMarkdown([node], ctx);
    } else if (!isNote(node) && isBlock(node)) {
      flushRun(flow);
      append(flow.blocks, renderBlock(node, ctx));
    } else if (!isNote(node) && tagOf(node) !== 'math' && holdsBlock(node, ctx)) {
      walk(childNodes(node), flow, ctx);
    } else {
      addToRun(flow, inlineMarkdown([node], ctx));
    }
  }
}

/** Blocks for a node list, in document order. */
export function flowBlocks(nodes: Node[], ctx: LatexmlContext): Block[] {
  const flow: Flow = { blocks: [], run: '', runHasText: false };
  walk(nodes, flow, ctx);
  flushRun(flow);
  return flow.blocks;
}

function renderBlock(element: Element, ctx: LatexmlContext): Block[] {
  const tag = tagOf(element);
  if (hasClass(element, 'ltx_pagination') || tag === 'hr') return [];
  if (hasClass(element, 'ltx_equation') || hasClass(element, 'ltx_equationgroup'))
    return equations(element);
  if (hasClass(element, 'ltx_theorem') || hasClass(element, 'ltx_proof'))
    return [theorem(element, ctx)];
  if (hasClass(element, 'ltx_listing')) return nonEmpty(listing(element));
  if (isFloat(element)) return figure(element, ctx);
  if (tag === 'table' || hasClass(element, 'ltx_tabular')) {
    // A bare tabular holding nothing (a rule set as a spacer) is layout, not a table.
    if (!textOfElement(element) && !element.querySelector('img, math')) return [];
    return [table(element, undefined, undefined, ctx)];
  }
  if (tag === 'ul' || tag === 'ol') return listBlock(element, ctx);
  if (tag === 'dl') return descriptionList(element, ctx);
  if (tag === 'pre') {
    const text = (element.textContent ?? '').replace(/^\n/, '').trimEnd();
    return text ? [{ text, type: 'code' }] : [];
  }
  if (tag === 'blockquote')
    return [{ blocks: flowBlocks(childNodes(element), ctx), type: 'quote' }];
  if (/^h[1-6]$/.test(tag)) {
    const title = inlineText(element, ctx);
    return title ? [{ text: emphasis(title, '**'), type: 'paragraph' }] : [];
  }
  return flowBlocks(childNodes(element), ctx);
}

function nonEmpty(block: Block | undefined): Block[] {
  return block ? [block] : [];
}

/** A caption's printed tag (`Figure 3:`, `Table 1:`) as a label, and the rest as the caption. */
function captionParts(
  caption: Element | undefined,
  ctx: LatexmlContext,
): { caption?: string; label?: string } {
  if (!caption) return {};
  const tagSpan = caption.querySelector('.ltx_tag');
  const label =
    textOfElement(tagSpan)
      .replace(/[:.]\s*$/, '')
      .trim() || undefined;
  const text = inlineRun(
    childNodes(caption).filter((n) => n !== tagSpan),
    ctx,
  );
  return { ...(label && { label }), ...(text && { caption: text }) };
}

/** A float's caption: `<figcaption>`, or the `ltx_caption` span of a float written as a span. */
function isCaption(element: Element): boolean {
  return tagOf(element) === 'figcaption' || hasClass(element, 'ltx_caption');
}

/** A float's graphics: `<img>`, or the `<object>` LaTeXML embeds an SVG with. */
const GRAPHICS = 'img, object.ltx_graphics';

function graphicSource(graphic: Element): string | undefined {
  return graphic.getAttribute('src') ?? graphic.getAttribute('data') ?? undefined;
}

/** Top-level tabulars in a figure: those not nested inside another tabular. */
function topTabulars(figure: Element): Element[] {
  return Array.from(figure.querySelectorAll('.ltx_tabular')).filter(
    (tabular) => !tabular.parentElement?.closest('.ltx_tabular'),
  );
}

/** A float's caption as a paragraph of its own, heading content that is not a figure. */
function captionHead(label: string | undefined, caption: string | undefined): Block[] {
  if (!label && !caption) return [];
  const text = [label && `**${escapeInline(label)}.**`, caption].filter(Boolean).join(' ');
  return [{ text, type: 'paragraph' }];
}

/** The subtable panel a tabular sits in, when that panel has a caption of its own. */
function captionedPanel(tabular: Element, float: Element): Element | undefined {
  const panel = tabular.parentElement?.closest('figure');
  return panel && panel !== float && childWhere(panel, isCaption) ? panel : undefined;
}

/**
 * A LaTeXML float. Its caption's tag and content decide what it is: a table (a tabular
 * and no image), an algorithm (a listing), or a figure. Subfigure panels follow the main
 * figure, each with its image and any caption of its own; a subtable panel's caption
 * labels its table.
 */
function figure(element: Element, ctx: LatexmlContext): Block[] {
  const captionEl = childWhere(element, isCaption);
  const { caption, label } = captionParts(captionEl, ctx);
  const id = element.getAttribute('id') ?? undefined;
  const images = Array.from(element.querySelectorAll(GRAPHICS));
  const tabulars = topTabulars(element);
  const tagClass = captionEl?.querySelector('.ltx_tag')?.className ?? '';

  if (
    hasClass(element, 'ltx_float_algorithm') ||
    (/ltx_tag_float/.test(tagClass) && element.querySelector('.ltx_listing'))
  ) {
    const code = listing(element.querySelector('.ltx_listing') ?? element);
    return [...captionHead(label, caption), ...(code ? [code] : [])];
  }
  if (
    tabulars.length > 0 &&
    (hasClass(element, 'ltx_table') || /ltx_tag_table/.test(tagClass) || images.length === 0)
  ) {
    const panels = tabulars.map((tabular) => captionedPanel(tabular, element));
    if (panels.every((panel) => panel === undefined)) {
      return tabulars.map((tabular, i) =>
        table(
          tabular,
          i === 0 ? label : undefined,
          i === 0 ? caption : undefined,
          ctx,
          i === 0 ? id : undefined,
        ),
      );
    }
    const tables = tabulars.map((tabular, i) => {
      const panel = panels[i];
      if (!panel) return table(tabular, undefined, undefined, ctx);
      const parts = captionParts(childWhere(panel, isCaption), ctx);
      return table(tabular, parts.label, parts.caption, ctx, panel.getAttribute('id') ?? undefined);
    });
    return [...captionHead(label, caption), ...tables];
  }

  const [image] = images;
  const src = image && graphicSource(image);
  const alt = image?.getAttribute('alt')?.trim();
  const blocks: Block[] = [
    {
      type: 'figure',
      ...(id && { id }),
      ...(label && { label }),
      ...(caption && { caption }),
      ...(src && { href: resolveUrl(src, ctx.baseUrl) }),
      ...(alt && { alt }),
    },
  ];
  for (const panel of Array.from(element.querySelectorAll('figure'))) {
    const panelCaption = childWhere(panel, isCaption);
    const panelImage = panel.querySelector(GRAPHICS);
    const panelId = panel.getAttribute('id') ?? undefined;
    if (!panelCaption) {
      // An uncaptioned panel keeps its image; the first image is the figure's own.
      const panelSrc = panelImage && panelImage !== image && graphicSource(panelImage);
      if (panelSrc) {
        blocks.push({
          type: 'figure',
          ...(panelId && { id: panelId }),
          href: resolveUrl(panelSrc, ctx.baseUrl),
        });
      }
      continue;
    }
    const parts = captionParts(panelCaption, ctx);
    const [panelTable] = panelImage ? [] : topTabulars(panel);
    if (panelTable) {
      blocks.push(table(panelTable, parts.label, parts.caption, ctx, panelId));
      continue;
    }
    const panelSrc = panelImage && graphicSource(panelImage);
    blocks.push({
      type: 'figure',
      ...(panelId && { id: panelId }),
      ...parts,
      ...(panelSrc && { href: resolveUrl(panelSrc, ctx.baseUrl) }),
    });
  }
  // A table set beside the images, in no captioned panel, is content the caption covers;
  // a tabular holding no text only lays the images out.
  for (const tabular of tabulars) {
    if (!captionedPanel(tabular, element) && textOfElement(tabular))
      blocks.push(table(tabular, undefined, undefined, ctx));
  }
  return blocks;
}

function table(
  tabular: Element,
  label: string | undefined,
  caption: string | undefined,
  ctx: LatexmlContext,
  id?: string,
): TableBlock {
  const { headerRows, rows, truncated } = readHtmlTable(
    tabular,
    (cell) => inlineText(cell, ctx),
    ctx.gridBudget,
    { boldHeaders: true },
  );
  const name = `Table ${label ?? ''}`.trim();
  if (truncated) ctx.diag.warn('truncated-input', truncatedGridMessage(name), id);
  if (rows.length === 0) ctx.diag.warn('table-unextractable', `${name} has no rows`, id);
  return {
    type: 'table',
    ...(id && { id }),
    ...(label && { label }),
    ...(caption && { caption }),
    headerRows,
    rows,
    ...(rows.length === 0 && { unextractable: 'no-rows' as const }),
  };
}

/**
 * Display equations: one formula per equation row. Aligned rows split an equation
 * across cells (`a` | `= b`); their TeX joins in order. The row's number cell is its label.
 */
function equations(element: Element): Block[] {
  const rows = Array.from(element.querySelectorAll('tr'));
  const formulas: FormulaBlock[] = [];
  for (const row of rows.length > 0 ? rows : [element]) {
    const cells = childElements(row).filter((cell) => !hasClass(cell, 'ltx_eqn_eqno'));
    const tex = cells
      .flatMap((cell) => Array.from(cell.querySelectorAll('math')))
      .map(domMathTex)
      .filter(Boolean)
      .join(' ');
    const text = tex ? '' : cells.map(textOfElement).filter(Boolean).join(' ');
    if (!tex && !text) continue;
    const label = textOfElement(row.querySelector('.ltx_eqn_eqno')) || undefined;
    const id = row.getAttribute('id') ?? undefined;
    formulas.push({
      type: 'formula',
      ...(id && { id }),
      ...(label && { label }),
      ...(tex ? { tex } : { text }),
    });
  }
  const [first] = formulas;
  const tableId = element.getAttribute('id');
  if (formulas.length === 1 && first && !first.id && tableId) first.id = tableId;
  return formulas;
}

/**
 * A theorem-like environment or proof: its run-in heading becomes the label and title.
 * The rendered heading is bold as a whole, so the source's own bold is dropped, and so
 * is the closing `.` it sets in a span of its own (bold for a theorem, italic for a
 * remark).
 */
function theorem(element: Element, ctx: LatexmlContext): BoxBlock {
  const heading = childWhere(element, (c) => /^h[1-6]$/.test(tagOf(c)));
  const tagSpan = heading?.querySelector('.ltx_tag');
  const label = textOfElement(tagSpan).replace(/[.:]\s*$/, '') || undefined;
  const parts = heading ? childNodes(heading).filter((n) => n !== tagSpan) : [];
  const punctuation = (node: Node | undefined) => /^[\s.:]*$/.test(node?.textContent ?? '');
  while (parts.length > 0 && punctuation(parts[0])) parts.shift();
  while (parts.length > 0 && punctuation(parts.at(-1))) parts.pop();
  const title = joinInlineSeams(
    trimTrailing(
      inlineMarkdown(parts, ctx)
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^[\s.:]+/, ''),
      /[\s.:]/,
    ),
  );
  const id = element.getAttribute('id') ?? undefined;
  return {
    type: 'box',
    ...(id && { id }),
    ...(label && { label }),
    ...(title && { title }),
    blocks: flowBlocks(
      childNodes(element).filter((n) => n !== heading),
      ctx,
    ),
    sections: [],
  };
}

/**
 * A listing line's text: math as its TeX (none when it has none), the printed line
 * number and the page's own layout whitespace (a run holding a line break) dropped.
 * Spaces the listing prints arrive as no-break spaces. Each whitespace run is read once,
 * whether or not it breaks a line.
 */
function listingText(node: Node): string {
  if (node.nodeType === TEXT_NODE)
    return (node.textContent ?? '').replace(/[ \t\r\n]+/g, (run) =>
      run.includes('\n') ? '' : run,
    );
  if (!isElement(node) || hasClass(node, 'ltx_tag_listingline')) return '';
  if (tagOf(node) === 'math') {
    const tex = domMathTex(node);
    return tex && `$${tex}$`;
  }
  return childNodes(node).map(listingText).join('');
}

/** A LaTeXML listing (algorithms, code): one line per `ltx_listingline`. */
function listing(element: Element): Block | undefined {
  const lines = Array.from(element.querySelectorAll('.ltx_listingline')).map((line) =>
    listingText(line).replace(/ /g, ' ').trimEnd(),
  );
  const text = (lines.length > 0 ? lines.join('\n') : (element.textContent ?? ''))
    .replace(/^\n+/, '')
    .trimEnd();
  return text ? { text, type: 'code' } : undefined;
}

/** Bullet characters an unordered item's tag can hold. */
const BULLETS = /^[•∙◦▪‣⁃–—\-∗*·]$/;

/**
 * An itemize or enumerate list. Printed tags that are custom (`(i)`, `(a)`) lead each
 * item's text and the list renders unordered, so they stay the only numbering.
 */
function listBlock(element: Element, ctx: LatexmlContext): Block[] {
  const items: Block[][] = [];
  let custom = false;
  let expected = 1;
  for (const item of childElements(element).filter((c) => tagOf(c) === 'li')) {
    const tagSpan = childWhere(item, (c) => hasClass(c, 'ltx_tag'));
    const tagText = textOfElement(tagSpan);
    const blocks = flowBlocks(
      childNodes(item).filter((n) => n !== tagSpan),
      ctx,
    );
    const sequential = tagText === `${expected}.` || tagText === `${expected})`;
    expected += 1;
    if (tagText && !BULLETS.test(tagText) && !sequential) {
      custom = true;
      const [first] = blocks;
      if (first?.type === 'paragraph') first.text = `${escapeInline(tagText)} ${first.text}`;
      else blocks.unshift({ text: escapeInline(tagText), type: 'paragraph' });
    }
    if (blocks.length > 0) items.push(blocks);
  }
  if (items.length === 0) return [];
  const list: ListBlock = { type: 'list', items, ordered: tagOf(element) === 'ol' && !custom };
  return [list];
}

/** A description list: `**term** — definition` per item. */
function descriptionList(element: Element, ctx: LatexmlContext): Block[] {
  const items: Block[][] = [];
  let term = '';
  for (const child of childElements(element)) {
    if (tagOf(child) === 'dt') term = inlineText(child, ctx);
    else if (tagOf(child) === 'dd') {
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

// ─── Sections ───────────────────────────────────────────────────────────────

/** The section's heading: a direct `ltx_title` heading child. */
function headingOf(section: Element): Element | undefined {
  return childWhere(section, (c) => /^h[1-6]$/.test(tagOf(c)) && hasClass(c, 'ltx_title'));
}

/** Parse a `<section>`: its heading's tag is the label, the rest the title. */
export function parseSection(
  element: Element,
  ctx: LatexmlContext,
  kind: SectionKind,
  fallbackId: string,
): Section | undefined {
  const id = issueId(ctx.sectionIds, element.getAttribute('id') ?? undefined, fallbackId);
  const heading = headingOf(element);
  const tagSpan = heading?.querySelector('.ltx_tag');
  const label = textOfElement(tagSpan).replace(/[.:]\s*$/, '') || undefined;
  const title = heading
    ? inlineRun(
        childNodes(heading).filter((n) => n !== tagSpan),
        ctx,
      ) || undefined
    : undefined;

  const blocks: Block[] = [];
  const sections: Section[] = [];
  for (const child of childNodes(element)) {
    if (child === heading) continue;
    if (isElement(child) && tagOf(child) === 'section') {
      const sub = parseSection(child, ctx, kind, `${id}.${sections.length + 1}`);
      if (sub) sections.push(sub);
      continue;
    }
    append(blocks, flowBlocks([child], ctx));
  }
  if (blocks.length === 0 && sections.length === 0) {
    ctx.sectionIds.delete(id);
    return;
  }
  const printed = splitSectionNumber(title, label);
  return {
    blocks,
    id,
    kind,
    ...(printed.label && { label: printed.label }),
    sections,
    ...(printed.title && { title: printed.title }),
  };
}
