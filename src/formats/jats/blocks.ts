/**
 * @fileoverview The flow walk: JATS content → typed blocks in document order, and the
 * `<sec>` walk built on it. Sections and blocks are mutually recursive (a box holds
 * sections, a section holds boxes), so both live here.
 *
 * Every block-level element interrupts the prose run in progress and contributes at its
 * own position. A `<table-wrap>` or `<fig>` nested inside a `<p>` therefore splits the
 * paragraph around it instead of fusing its cells or caption into the sentence.
 * (pubmed-mcp-server#111, #130)
 * @module src/formats/jats/blocks
 */
import type {
  Block,
  BoxBlock,
  FigureBlock,
  FormulaBlock,
  ListBlock,
  Section,
  SectionKind,
  SupplementBlock,
} from '../../model/document.js';
import { splitSectionNumber } from '../../model/section-kinds.js';
import { escapeInline } from '../../render/escape.js';
import { emphasis } from '../../render/inline.js';
import {
  attrOf,
  childrenOf,
  collapseWhitespace,
  findAll,
  findOne,
  isTextNode,
  tagNameOf,
  textOf,
  type XmlNode,
  type XmlNodeList,
} from '../../xml/ordered.js';
import { issueSectionId, type JatsContext } from './context.js';
import { formulaParts, inlineMarkdown, inlineText } from './inline.js';
import { parseBareTable, parseTableWrap } from './tables.js';
import { rawText, selectAlternative, text } from './text.js';

/**
 * JATS block-level elements. Membership decides placement: each flushes the prose run
 * and contributes at block position. `address`, `related-article`, and
 * `related-object` are both display and inline in the JATS model; they stay here
 * because a wrong split costs a paragraph break, while a wrong fusion fabricates
 * adjacency the source never had. `<alternatives>` is deliberately absent: it is a
 * container of equivalent renderings, placed wherever its holder is. (#130, #135)
 */
const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'address',
  'array',
  'boxed-text',
  'chem-struct-wrap',
  'code',
  'def-list',
  'disp-formula',
  'disp-formula-group',
  'disp-quote',
  'fig',
  'fig-group',
  'fn-group',
  'graphic',
  'list',
  'media',
  'p',
  'preformat',
  'ref-list',
  'related-article',
  'related-object',
  'sec',
  'speech',
  'statement',
  'supplementary-material',
  'table-wrap',
  'table-wrap-group',
  'title',
  'verse-group',
]);

/**
 * True when a block-level element sits anywhere in this subtree. An `<alternatives>` is
 * not looked into: a `<graphic>` among its renderings says nothing about the placement
 * of the inline formula holding it, and descending would split the sentence around a
 * rendering the walk then emits as a figure. (#130, #135)
 */
function containsBlock(node: XmlNode): boolean {
  return childrenOf(node).some((child) => {
    const tag = tagNameOf(child) ?? '';
    return BLOCK_TAGS.has(tag) || (tag !== 'alternatives' && containsBlock(child));
  });
}

interface Flow {
  blocks: Block[];
  run: string;
}

function flushRun(flow: Flow): void {
  const text = collapseWhitespace(flow.run);
  if (text) flow.blocks.push({ text, type: 'paragraph' });
  flow.run = '';
}

function walk(nodes: XmlNodeList, flow: Flow, ctx: JatsContext): void {
  for (const node of nodes) {
    if (isTextNode(node)) {
      flow.run += escapeInline(textOf(node));
      continue;
    }
    const tag = tagNameOf(node) ?? '';
    if (tag === 'alternatives') {
      const chosen = selectAlternative(node);
      if (chosen && BLOCK_TAGS.has(tagNameOf(chosen) ?? '')) {
        flushRun(flow);
        flow.blocks.push(...renderBlock(chosen, ctx));
      } else {
        flow.run += inlineMarkdown([node], ctx);
      }
      continue;
    }
    if (tag === 'fn') {
      flow.run += inlineMarkdown([node], ctx);
      continue;
    }
    if (BLOCK_TAGS.has(tag)) {
      flushRun(flow);
      flow.blocks.push(...renderBlock(node, ctx));
      continue;
    }
    if (containsBlock(node)) walk(childrenOf(node), flow, ctx);
    else flow.run += inlineMarkdown([node], ctx);
  }
}

/** Blocks for mixed content, in document order. */
export function flowBlocks(nodes: XmlNodeList, ctx: JatsContext): Block[] {
  const flow: Flow = { blocks: [], run: '' };
  walk(nodes, flow, ctx);
  flushRun(flow);
  return flow.blocks;
}

/** Render one block-level element. */
function renderBlock(node: XmlNode, ctx: JatsContext): Block[] {
  const children = childrenOf(node);
  switch (tagNameOf(node)) {
    case 'p':
      return flowBlocks(children, ctx);
    case 'title': {
      const title = inlineText(node, ctx);
      return title ? [{ text: emphasis(title, '**'), type: 'paragraph' }] : [];
    }
    case 'table-wrap':
      return [parseTableWrap(node, captionText(findOne(node, 'caption'), ctx), ctx)];
    case 'table-wrap-group':
    case 'fig-group':
    case 'disp-formula-group':
      return [
        ...groupCaption(node, ctx),
        ...flowBlocks(withoutTags(children, 'caption', 'label'), ctx),
      ];
    case 'fig': {
      // A figure with no label, caption, or alt text whose file is a `<media>` (a review
      // report's PDF) has nothing to show: it is a file to open.
      const shown = figure(node, ctx);
      const pointer = assetPointer(node);
      const opaque = !shown.label && !shown.caption && !shown.alt;
      const asset =
        opaque && pointer && tagNameOf(pointer) === 'media' ? supplement(node, ctx) : shown;
      // Figure supplements nest inside their parent figure, often wrapped in a
      // `<p content-type="supplemental-figure">`; they follow it as figures of their own.
      return [asset, ...flowBlocks(withoutTags(children, ...FIGURE_PARTS), ctx)];
    }
    case 'graphic': {
      const href = attrOf(node, 'xlink:href');
      const alt = text(findOne(node, 'alt-text')) || undefined;
      return href ? [{ type: 'figure', href, ...(alt && { alt }) }] : [];
    }
    case 'supplementary-material':
    case 'media':
      return [supplement(node, ctx)];
    case 'list':
      return nonEmpty(list(node, ctx, true));
    case 'def-list':
      return nonEmpty(defList(node, ctx, true));
    case 'disp-quote':
      return [quote(node, ctx)];
    case 'boxed-text':
      return [box(node, ctx, true)];
    case 'statement':
      return [statement(node, ctx)];
    case 'preformat':
    case 'code': {
      const code = rawText(node).replace(/^\s*\n|\s+$/g, '');
      const language = tagNameOf(node) === 'code' ? attrOf(node, 'language') : undefined;
      return code ? [{ text: code, type: 'code', ...(language && { language }) }] : [];
    }
    case 'disp-formula': {
      const formula = displayFormula(node, ctx);
      return formula ? [formula] : [];
    }
    case 'array': {
      const table = findOne(node, 'table');
      return table ? [parseBareTable(table, ctx)] : flowBlocks(children, ctx);
    }
    case 'ref-list':
      return [];
    case 'fn-group':
      collectFootnotes(node, ctx);
      return [];
    case 'sec': {
      // A section with nowhere of its own to live (inside a list item): its heading
      // leads its content.
      const title = inlineText(findOne(node, 'title'), ctx);
      const heading: Block[] = title ? [{ text: emphasis(title, '**'), type: 'paragraph' }] : [];
      return [...heading, ...flowBlocks(withoutTags(children, 'title', 'label'), ctx)];
    }
    default:
      return flowBlocks(children, ctx);
  }
}

function nonEmpty(block: ListBlock): Block[] {
  return block.items.length > 0 ? [block] : [];
}

function withoutTags(nodes: XmlNodeList, ...tags: string[]): XmlNodeList {
  return nodes.filter((node) => !tags.includes(tagNameOf(node) ?? ''));
}

/**
 * A `<caption>` as one line: its title in bold, then its paragraphs. The title and
 * paragraphs are separate statements; reading them as one run glued the title onto the
 * first sentence. (#111, #134)
 */
export function captionText(caption: XmlNode | undefined, ctx: JatsContext): string | undefined {
  if (!caption) return;
  const parts: string[] = [];
  for (const child of childrenOf(caption)) {
    if (isTextNode(child)) continue;
    const piece = inlineText(child, ctx);
    if (!piece) continue;
    parts.push(tagNameOf(child) === 'title' ? emphasis(piece, '**') : piece);
  }
  return parts.join(' ') || undefined;
}

/**
 * A figure, table, or formula group's label and caption as one paragraph, the label in
 * bold the way a figure's renders; the panels inside carry neither.
 */
function groupCaption(group: XmlNode, ctx: JatsContext): Block[] {
  const label = text(findOne(group, 'label')).replace(/[.:]\s*$/, '');
  const line = [label && `**${escapeInline(label)}.**`, captionText(findOne(group, 'caption'), ctx)]
    .filter(Boolean)
    .join(' ');
  return line ? [{ text: line, type: 'paragraph' }] : [];
}

/** A figure's own parts; anything else inside a `<fig>` is content that follows it. */
const FIGURE_PARTS = [
  'alt-text',
  'alternatives',
  'attrib',
  'caption',
  'graphic',
  'label',
  'long-desc',
  'media',
  'object-id',
  'permissions',
];

/** Pointer elements a figure or supplement can carry its file reference on. */
const POINTER_TAGS: ReadonlySet<string> = new Set(['graphic', 'media']);

/**
 * The `<graphic>`/`<media>` an asset hangs its file on: a direct child, else the web
 * rendering its `<alternatives>` offers (JATS4R marks renderings `web` and `print`).
 * (#142)
 */
function assetPointer(node: XmlNode): XmlNode | undefined {
  const direct = findOne(node, 'graphic') ?? findOne(node, 'media');
  if (direct) return direct;
  const pointers = childrenOf(findOne(node, 'alternatives')).filter((child) =>
    POINTER_TAGS.has(tagNameOf(child) ?? ''),
  );
  return (
    pointers.find((pointer) => attrOf(pointer, 'specific-use')?.toLowerCase().includes('web')) ??
    pointers[0]
  );
}

/**
 * Label, caption, and file reference of a `<fig>` or `<supplementary-material>`. A
 * common deposit style hangs the label and caption on the `<graphic>`/`<media>` instead
 * of the asset; the asset's own win where it has them. (#130)
 */
function assetParts(node: XmlNode, ctx: JatsContext) {
  const pointer = assetPointer(node);
  const id = attrOf(node, 'id');
  const label = text(findOne(node, 'label')) || text(findOne(pointer, 'label')) || undefined;
  const ownCaption =
    captionText(findOne(node, 'caption'), ctx) ?? captionText(findOne(pointer, 'caption'), ctx);
  const credit = inlineText(findOne(node, 'attrib'), ctx);
  const caption = [ownCaption, credit].filter(Boolean).join(' ') || undefined;
  const href = pointer ? attrOf(pointer, 'xlink:href') : undefined;
  return { caption, href, id, label, pointer };
}

function figure(node: XmlNode, ctx: JatsContext): FigureBlock {
  const { caption, href, id, label, pointer } = assetParts(node, ctx);
  const alt = text(findOne(node, 'alt-text')) || text(findOne(pointer, 'alt-text')) || undefined;
  return {
    type: 'figure',
    ...(id && { id }),
    ...(label && { label }),
    ...(caption && { caption }),
    ...(href && { href }),
    ...(alt && { alt }),
  };
}

function supplement(node: XmlNode, ctx: JatsContext): SupplementBlock {
  const { caption, href, id, label } = assetParts(node, ctx);
  const ownHref = tagNameOf(node) === 'media' ? attrOf(node, 'xlink:href') : undefined;
  const target = href ?? ownHref;
  return {
    type: 'supplement',
    ...(id && { id }),
    ...(label && { label }),
    ...(caption && { caption }),
    ...(target && { href: target }),
  };
}

/** List types JATS numbers or letters. */
const ORDERED_LIST_TYPE = /^(order|alpha-|roman-)/;

/** An item label that is only a bullet glyph, which the list marker already draws. */
const BULLET_LABEL = /^[•◦▪▫●○■□▸►‣⁃∙·*–-]$/u;

/**
 * A `<list>`. An item's `<label>` ("(a)", "i.") leads its first paragraph, and a list
 * whose items carry labels renders unordered so the printed labels are the only numbering.
 */
function list(node: XmlNode, ctx: JatsContext, withTitle: boolean): ListBlock {
  const title = withTitle ? inlineText(findOne(node, 'title'), ctx) : '';
  let labeled = false;
  const items: Block[][] = [];
  for (const item of findAll(node, 'list-item')) {
    const label = text(findOne(item, 'label')).replace(BULLET_LABEL, '');
    const blocks = flowBlocks(withoutTags(childrenOf(item), 'label'), ctx);
    if (label) {
      labeled = true;
      const [first] = blocks;
      if (first?.type === 'paragraph') first.text = `${escapeInline(label)} ${first.text}`;
      else blocks.unshift({ text: escapeInline(label), type: 'paragraph' });
    }
    if (blocks.length > 0) items.push(blocks);
  }
  const ordered = !labeled && ORDERED_LIST_TYPE.test(attrOf(node, 'list-type') ?? '');
  return { type: 'list', ordered, items, ...(title && { title }) };
}

/** A `<def-list>`: one item per `<def-item>`, the term in bold before its definition. */
function defList(node: XmlNode, ctx: JatsContext, withTitle: boolean): ListBlock {
  const title = withTitle ? inlineText(findOne(node, 'title'), ctx) : '';
  const items: Block[][] = [];
  for (const item of findAll(node, 'def-item')) {
    const term = inlineText(findOne(item, 'term'), ctx);
    const definition = inlineText(findOne(item, 'def'), ctx);
    const entry = [term && emphasis(term, '**'), definition].filter(Boolean).join(' — ');
    if (entry) items.push([{ text: entry, type: 'paragraph' }]);
  }
  return { type: 'list', ordered: false, items, ...(title && { title }) };
}

/** A `<disp-quote>`, its `<attrib>` as a trailing attribution line. */
function quote(node: XmlNode, ctx: JatsContext): Block {
  const blocks = flowBlocks(withoutTags(childrenOf(node), 'attrib'), ctx);
  const attrib = inlineText(findOne(node, 'attrib'), ctx);
  if (attrib) blocks.push({ text: `— ${attrib}`, type: 'paragraph' });
  return { blocks, type: 'quote' };
}

/**
 * A `<boxed-text>`. Most are section containers rather than captioned boxes — 13 of 14
 * in a 68-record draw held only `<sec>` children — so nested sections are kept as
 * sections. The caption's title is the box title. (#130, #169)
 */
function box(node: XmlNode, ctx: JatsContext, withTitle: boolean): BoxBlock {
  const caption = findOne(node, 'caption');
  const title = withTitle ? inlineText(findOne(caption, 'title'), ctx) : '';
  const label = text(findOne(node, 'label')) || undefined;
  const id = attrOf(node, 'id');
  const captionBlocks = flowBlocks(withoutTags(childrenOf(caption), 'title'), ctx);
  const blocks: Block[] = [...captionBlocks];
  const sections: Section[] = [];
  for (const child of childrenOf(node)) {
    const tag = tagNameOf(child);
    if (tag === 'caption' || tag === 'label') continue;
    if (tag === 'sec') {
      const section = parseSection(child, ctx, 'body', `${id ?? 'box'}-s${sections.length + 1}`);
      if (section) sections.push(section);
    } else {
      blocks.push(...flowBlocks([child], ctx));
    }
  }
  return {
    type: 'box',
    ...(id && { id }),
    ...(label && { label }),
    ...(title && { title }),
    blocks,
    sections,
  };
}

/** A `<statement>` (theorem, lemma, proof): a box with its label and title. */
function statement(node: XmlNode, ctx: JatsContext): BoxBlock {
  const id = attrOf(node, 'id');
  const label = text(findOne(node, 'label')) || undefined;
  const title = inlineText(findOne(node, 'title'), ctx);
  return {
    type: 'box',
    ...(id && { id }),
    ...(label && { label }),
    ...(title && { title }),
    blocks: flowBlocks(withoutTags(childrenOf(node), 'label', 'title'), ctx),
    sections: [],
  };
}

/**
 * A `<disp-formula>`: TeX from `<tex-math>` or converted MathML, else text, else the
 * image it is published as. (#130, #135)
 */
function displayFormula(node: XmlNode, ctx: JatsContext): FormulaBlock | undefined {
  const parts = formulaParts(node, ctx);
  if (!parts) return;
  const id = attrOf(node, 'id');
  const label = text(findOne(node, 'label')) || undefined;
  return { type: 'formula', ...(id && { id }), ...(label && { label }), ...parts };
}

/** Collect every `<fn>` under a node into the document's footnotes. */
export function collectFootnotes(node: XmlNode, ctx: JatsContext): void {
  for (const fn of childrenOf(node)) {
    const tag = tagNameOf(fn);
    if (tag === 'fn') {
      const label = text(findOne(fn, 'label')) || undefined;
      const body = flowBlocks(withoutTags(childrenOf(fn), 'label'), ctx)
        .map((block) => (block.type === 'paragraph' ? block.text : ''))
        .filter(Boolean)
        .join(' ');
      const id = attrOf(fn, 'id');
      if (body) ctx.footnotes.push({ ...(id && { id }), ...(label && { label }), text: body });
    } else if (tag && tag !== 'title' && tag !== 'label') {
      collectFootnotes(fn, ctx);
    }
  }
}

// ─── Sections ───────────────────────────────────────────────────────────────

/**
 * The title a block carries of its own where the JATS model puts one: a `<list>` or
 * `<def-list>` `<title>`, a `<boxed-text>` caption title. (#148)
 */
export function ownBlockTitle(node: XmlNode, ctx: JatsContext): string | undefined {
  switch (tagNameOf(node)) {
    case 'def-list':
    case 'list':
      return inlineText(findOne(node, 'title'), ctx) || undefined;
    case 'boxed-text':
      return inlineText(findOne(findOne(node, 'caption'), 'title'), ctx) || undefined;
    default:
      return;
  }
}

/** A block whose own title has become its section's title, rendered without it. */
export function blocksWithoutTitle(node: XmlNode, ctx: JatsContext): Block[] {
  switch (tagNameOf(node)) {
    case 'def-list':
      return nonEmpty(defList(node, ctx, false));
    case 'list':
      return nonEmpty(list(node, ctx, false));
    case 'boxed-text':
      return [box(node, ctx, false)];
    default:
      return renderBlock(node, ctx);
  }
}

/**
 * The titled `<list>`, `<def-list>`, or `<boxed-text>` an untitled `<sec>` carries as
 * its only content. A `<sec>` holding nothing but an abbreviations list is that list,
 * and the list's title is the section's. (#148, #169)
 */
function loneTitledBlock(
  sec: XmlNode,
  ctx: JatsContext,
): { node: XmlNode; title: string } | undefined {
  if (text(findOne(sec, 'title'))) return;
  const content = childrenOf(sec).filter((child) =>
    isTextNode(child)
      ? textOf(child).trim() !== ''
      : !['title', 'label'].includes(tagNameOf(child) ?? ''),
  );
  const [node] = content;
  if (content.length !== 1 || !node || isTextNode(node)) return;
  const title = ownBlockTitle(node, ctx);
  return title ? { node, title } : undefined;
}

/**
 * One `<sec>`: its first `<title>` and `<label>`, subsections, and every other child as
 * blocks at its position. A section with no blocks and no subsections — a `<sec>` that
 * only wraps a `<ref-list>` — is dropped. (#116, #130)
 */
export function parseSection(
  sec: XmlNode,
  ctx: JatsContext,
  kind: SectionKind,
  fallbackId: string,
): Section | undefined {
  const id = issueSectionId(ctx, attrOf(sec, 'id'), fallbackId);
  const lone = loneTitledBlock(sec, ctx);
  if (lone) {
    const label = text(findOne(sec, 'label')) || undefined;
    const blocks = blocksWithoutTitle(lone.node, ctx);
    return { blocks, id, kind, ...(label && { label }), sections: [], title: lone.title };
  }

  let title: string | undefined;
  let label: string | undefined;
  const blocks: Block[] = [];
  const sections: Section[] = [];
  for (const child of childrenOf(sec)) {
    const tag = tagNameOf(child);
    if (tag === 'title' && title === undefined) {
      title = inlineText(child, ctx) || undefined;
      continue;
    }
    if (tag === 'label' && label === undefined) {
      label = text(child) || undefined;
      continue;
    }
    if (tag === 'sec') {
      const section = parseSection(child, ctx, kind, `${id}.${sections.length + 1}`);
      if (section) sections.push(section);
      continue;
    }
    blocks.push(...flowBlocks([child], ctx));
  }

  if (blocks.length === 0 && sections.length === 0) {
    ctx.sectionIds.delete(id);
    return;
  }
  const heading = splitSectionNumber(title, label);
  return {
    blocks,
    id,
    kind,
    ...(heading.label && { label: heading.label }),
    sections,
    ...(heading.title && { title: heading.title }),
  };
}
