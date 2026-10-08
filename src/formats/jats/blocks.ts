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
import { append } from '../../model/extremes.js';
import { issueId } from '../../model/section-ids.js';
import { splitSectionNumber } from '../../model/section-kinds.js';
import { tableName } from '../../model/table-grid.js';
import { escapeInline, foldLineBreaks } from '../../render/escape.js';
import {
  collapseInline,
  emphasis,
  FORMULA_IMAGE,
  inlineCode,
  inlineMath,
  link,
} from '../../render/inline.js';
import {
  attrOf,
  childrenOf,
  findAll,
  findOne,
  isTextNode,
  tagNameOf,
  textOf,
  type XmlNode,
  type XmlNodeList,
} from '../../xml/ordered.js';
import type { JatsContext } from './context.js';
import { formulaParts, inlineMarkdown, inlineText } from './inline.js';
import { parseBareTable, parseTableWrap } from './tables.js';
import { LINK_TAGS, rawText, selectAlternative, text } from './text.js';

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
  // HTML headings, which Crossref and Europe PMC abstracts carry: blocks as `title` is.
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'list',
  'media',
  'p',
  'preformat',
  'ref-list',
  'related-article',
  'related-object',
  'sec',
  'sec-meta',
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
  const text = collapseInline(flow.run);
  if (text) flow.blocks.push({ text, type: 'paragraph' });
  flow.run = '';
}

/**
 * Walk mixed content into `flow`. Consecutive inline siblings are read together, so the
 * rules between touching siblings (`inlineMarkdown`) see them as siblings.
 */
function walk(nodes: XmlNodeList, flow: Flow, ctx: JatsContext): void {
  let inline: XmlNodeList = [];
  const readInline = () => {
    if (inline.length === 0) return;
    flow.run += inlineMarkdown(inline, ctx);
    inline = [];
  };
  const block = (node: XmlNode) => {
    readInline();
    flushRun(flow);
    append(flow.blocks, renderBlock(node, ctx));
  };
  for (const node of nodes) {
    const tag = tagNameOf(node) ?? '';
    if (tag === 'alternatives') {
      const chosen = selectAlternative(node);
      if (chosen && BLOCK_TAGS.has(tagNameOf(chosen) ?? '')) block(chosen);
      else inline.push(node);
    } else if (BLOCK_TAGS.has(tag)) {
      block(node);
    } else if (tag !== 'fn' && !isTextNode(node) && containsBlock(node)) {
      readInline();
      walk(childrenOf(node), flow, ctx);
      // A link whose content holds no text writes its target, as `link` does.
      if (LINK_TAGS.has(tag) && text(node) === '') flow.run += link('', attrOf(node, 'xlink:href'));
    } else {
      inline.push(node);
    }
  }
  readInline();
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
    case 'title':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const title = inlineText(node, ctx);
      return title ? [{ text: emphasis(title, '**'), type: 'paragraph' }] : [];
    }
    case 'sec-meta':
      // A section's own metadata: each keyword group reads as a labeled line (Pensoft's
      // taxon classification). Section contributors and permissions are left out.
      return findAll(node, 'kwd-group').flatMap((group): Block[] => {
        const label = inlineText(findOne(group, 'label') ?? findOne(group, 'title'), ctx);
        const words = findAll(group, 'kwd')
          .map((kwd) => inlineText(kwd, ctx))
          .filter(Boolean);
        if (words.length === 0) return [];
        const head = label ? `${emphasis(`${label}:`, '**')} ` : '';
        return [{ text: `${head}${words.join(', ')}`, type: 'paragraph' }];
      });
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
      const code = rawText(node)
        .replace(/^\s*\n/, '')
        .trimEnd();
      const language = tagNameOf(node) === 'code' ? attrOf(node, 'language') : undefined;
      return code ? [{ text: code, type: 'code', ...(language && { language }) }] : [];
    }
    case 'disp-formula': {
      const formula = displayFormula(node, ctx);
      return formula ? [formula] : [];
    }
    case 'array': {
      // An array holds a `<table>`, or its rows straight in a `<tbody>` (MDPI's abbreviation lists).
      const table = findOne(node, 'table') ?? (findOne(node, 'tbody') && node);
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
  const line = labelLine(
    text(findOne(group, 'label')),
    captionText(findOne(group, 'caption'), ctx),
  );
  return line ? [{ text: line, type: 'paragraph' }] : [];
}

/** A label in bold, the way a figure's renders, before a caption: `**Table 1.** Caption`. */
function labelLine(label: string | undefined, caption: string | undefined): string {
  const bare = label?.replace(/[.:]\s*$/, '');
  return [bare && `**${escapeInline(bare)}.**`, caption].filter(Boolean).join(' ');
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

/**
 * A `<supplementary-material>` or `<media>` as a file to open. A `<p>` straight inside a
 * `<supplementary-material>` (JMIR's description of an appendix file) follows its caption.
 */
function supplement(node: XmlNode, ctx: JatsContext): SupplementBlock {
  const { caption: assetCaption, href, id, label } = assetParts(node, ctx);
  const tag = tagNameOf(node);
  const prose =
    tag === 'supplementary-material' ? findAll(node, 'p').map((p) => inlineText(p, ctx)) : [];
  const caption = [assetCaption, ...prose].filter(Boolean).join(' ') || undefined;
  const ownHref = tag === 'media' ? attrOf(node, 'xlink:href') : undefined;
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

/**
 * A `<def-list>`: one item per `<def-item>`, the blocks of its definitions led by the term
 * in bold, the way {@link list} leads an item with its label.
 */
function defList(node: XmlNode, ctx: JatsContext, withTitle: boolean): ListBlock {
  const title = withTitle ? inlineText(findOne(node, 'title'), ctx) : '';
  const items: Block[][] = [];
  for (const item of findAll(node, 'def-item')) {
    const term = inlineText(findOne(item, 'term'), ctx);
    const blocks = findAll(item, 'def').flatMap((def) => flowBlocks(childrenOf(def), ctx));
    if (term) {
      const lead = emphasis(term, '**');
      const [first] = blocks;
      if (first?.type === 'paragraph') first.text = `${lead} — ${first.text}`;
      else blocks.unshift({ text: lead, type: 'paragraph' });
    }
    if (blocks.length > 0) items.push(blocks);
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
  const blocks = flowBlocks(withoutTags(childrenOf(caption), 'title'), ctx);
  const sections: Section[] = [];
  for (const child of childrenOf(node)) {
    const tag = tagNameOf(child);
    if (tag === 'caption' || tag === 'label') continue;
    if (tag === 'sec') {
      const section = parseSection(child, ctx, 'body', `${id ?? 'box'}-s${sections.length + 1}`);
      if (section) sections.push(section);
    } else {
      append(blocks, flowBlocks([child], ctx));
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

/**
 * Collect every `<fn>` under a node into the document's footnotes. A footnote is text in
 * every format, so each block of a note is written into it, in order ({@link noteText}).
 */
export function collectFootnotes(node: XmlNode, ctx: JatsContext): void {
  for (const fn of childrenOf(node)) {
    const tag = tagNameOf(fn);
    if (tag === 'fn') {
      const label = text(findOne(fn, 'label')) || undefined;
      const id = attrOf(fn, 'id');
      const body = noteText(flowBlocks(withoutTags(childrenOf(fn), 'label'), ctx), ctx, id);
      if (body) ctx.footnotes.push({ ...(id && { id }), ...(label && { label }), text: body });
    } else if (tag && tag !== 'title' && tag !== 'label') {
      collectFootnotes(fn, ctx);
    }
  }
}

/**
 * A note's blocks as one line of inline Markdown, in order: a paragraph's text, a list's
 * title and items, a formula as inline math (else its text), code as inline code, the
 * title and blocks of a quote or box, and the label and caption of a figure, table, or
 * supplement. A table's rows do not fit in a line, so leaving them out is warned of, with
 * the note's ID as `where`.
 */
function noteText(blocks: readonly Block[], ctx: JatsContext, where: string | undefined): string {
  return blocks
    .map((block) => blockText(block, ctx, where))
    .filter(Boolean)
    .join(' ');
}

function blockText(block: Block, ctx: JatsContext, where: string | undefined): string {
  switch (block.type) {
    case 'paragraph':
      return block.text;
    case 'list':
      return [block.title && emphasis(block.title, '**'), noteText(block.items.flat(), ctx, where)]
        .filter(Boolean)
        .join(' ');
    case 'formula':
      if (block.tex) return inlineMath(block.tex);
      return block.text === undefined ? FORMULA_IMAGE : escapeInline(block.text);
    case 'code':
      return inlineCode(foldLineBreaks(block.text));
    case 'quote':
      return noteText(block.blocks, ctx, where);
    case 'box':
      return [
        boldHeading(block.label, block.title),
        noteText(block.blocks, ctx, where),
        sectionsText(block.sections, ctx, where),
      ]
        .filter(Boolean)
        .join(' ');
    case 'table':
      ctx.diag.warn(
        'unhandled-element',
        `${tableName(block.label, block.id)} in a footnote keeps its label and caption; its rows are left out`,
        where,
      );
      return labelLine(block.label, block.caption);
    case 'figure':
    case 'supplement':
      return labelLine(block.label, block.caption);
  }
}

/** Sections inside a note's box as text: each heading in bold, then its blocks and subsections. */
function sectionsText(
  sections: readonly Section[],
  ctx: JatsContext,
  where: string | undefined,
): string {
  return sections
    .map((section) =>
      [
        boldHeading(section.label, section.title),
        noteText(section.blocks, ctx, where),
        sectionsText(section.sections, ctx, where),
      ]
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
    .join(' ');
}

/** A label (plain text) and title (Markdown) as one bold heading, as a box's renders. */
function boldHeading(label: string | undefined, title: string | undefined): string {
  const heading = [label && escapeInline(label), title].filter(Boolean).join(' ');
  return heading && emphasis(heading, '**');
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

/** A child that reads as a subsection of its parent, not as its content. */
function isSubsectionTag(node: XmlNode): boolean {
  const tag = tagNameOf(node);
  return tag === 'sec' || (tag === 'notes' && text(findOne(node, 'title')) !== '');
}

/** A child that can follow a section's subsections: a subsection, a heading, or whitespace. */
function isTrailing(node: XmlNode): boolean {
  return isTextNode(node)
    ? textOf(node).trim() === ''
    : isSubsectionTag(node) || ['label', 'title'].includes(tagNameOf(node) ?? '');
}

/**
 * Where a section's trailing run starts: the index of the first child after which, itself
 * included, only {@link isTrailing} children follow. Found once per section, walking back
 * from the end.
 */
function trailingStart(children: XmlNodeList): number {
  let start = children.length;
  while (start > 0 && isTrailing(children[start - 1] as XmlNode)) start--;
  return start;
}

/**
 * True when a titled `<notes>`, child `index` of its section, can be a subsection:
 * nothing but other subsections follows it ({@link trailingStart}). A section's blocks
 * come before its subsections, and unlike `<sec>`, which JATS places after every
 * paragraph, `<notes>` may be followed by more text, which would otherwise move above it.
 */
function isTrailingNotes(notes: XmlNode, index: number, trailing: number): boolean {
  return index >= trailing && isSubsectionTag(notes);
}

/** The one element a `<sec>` holds besides its title and label, if it holds only one. */
function loneContent(sec: XmlNode): XmlNode | undefined {
  const content = childrenOf(sec).filter((child) =>
    isTextNode(child)
      ? textOf(child).trim() !== ''
      : !['title', 'label'].includes(tagNameOf(child) ?? ''),
  );
  const [node] = content;
  return content.length === 1 && node && !isTextNode(node) ? node : undefined;
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
  const node = loneContent(sec);
  const title = node && ownBlockTitle(node, ctx);
  return node && title ? { node, title } : undefined;
}

/** A title that says only that notes follow. */
const NOTES_TITLE = /^(?:foot)?notes?$/i;

/**
 * True when a title names what a group of notes holds (`Competing interests`), which
 * makes the notes that section's content, rather than saying only that notes follow.
 */
function namesNotes(title: string | undefined): title is string {
  return title !== undefined && title !== '' && !NOTES_TITLE.test(title);
}

/**
 * The notes of an `<fn-group>` read as content: each `<fn>`'s blocks, its label dropped.
 * A note authors point at leads with their names, since eLife's contribution and
 * competing-interest notes do not name the author themselves.
 */
function noteBlocks(group: XmlNode, ctx: JatsContext): Block[] {
  return findAll(group, 'fn').flatMap((fn) => {
    const blocks = flowBlocks(withoutTags(childrenOf(fn), 'label'), ctx);
    const owners = ctx.noteOwners.get(attrOf(fn, 'id') ?? '');
    const [first, ...rest] = blocks;
    if (!owners || first?.type !== 'paragraph') return blocks;
    const lead = emphasis(`${escapeInline(owners.join(', '))}:`, '**');
    return [{ ...first, text: `${lead} ${first.text}` }, ...rest];
  });
}

/**
 * An `<fn-group>` whose title names what its notes hold (eLife's `Author contributions`)
 * as a section of those notes. Undefined for a group of footnotes: untitled, or titled
 * only `Footnotes`.
 */
export function noteGroupSection(
  group: XmlNode,
  ctx: JatsContext,
  kind: SectionKind,
  fallbackId: string,
): Section | undefined {
  const title = inlineText(findOne(group, 'title'), ctx);
  if (!namesNotes(title)) return;
  const blocks = noteBlocks(group, ctx);
  if (blocks.length === 0) return;
  const id = issueId(ctx.sectionIds, attrOf(group, 'id'), fallbackId);
  return { blocks, id, kind, sections: [], title };
}

/**
 * One `<sec>`: its first `<title>` and `<label>`, subsections (each `<sec>`, and each
 * titled `<notes>` that {@link isTrailingNotes} allows), and every other child as blocks
 * at its position. A section with no blocks and no subsections — a `<sec>` that
 * only wraps a `<ref-list>` — is dropped, and so is Europe PMC's generated
 * `sec-type="history"` note, whose received and accepted dates the metadata carries.
 * (#116, #130)
 *
 * An `<fn-group>` with a title naming its notes is a subsection of them, and an untitled
 * one that is all a `<sec>` holds is that section's content when the section's title
 * names its notes: Europe PMC wraps each back `<fn-group>` in a `<sec>` carrying the
 * group's title, `Footnotes` when it had none. Any other group holds footnotes.
 */
export function parseSection(
  sec: XmlNode,
  ctx: JatsContext,
  kind: SectionKind,
  fallbackId: string,
): Section | undefined {
  if (attrOf(sec, 'sec-type') === 'history') return;
  const id = issueId(ctx.sectionIds, attrOf(sec, 'id'), fallbackId);
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
  const children = childrenOf(sec);
  const trailing = trailingStart(children);
  const only = loneContent(sec);
  const notesAreContent =
    only !== undefined &&
    tagNameOf(only) === 'fn-group' &&
    namesNotes(inlineText(findOne(sec, 'title'), ctx));
  for (const [index, child] of children.entries()) {
    const tag = tagNameOf(child);
    if (tag === 'title' && title === undefined) {
      title = inlineText(child, ctx) || undefined;
      continue;
    }
    if (tag === 'label' && label === undefined) {
      label = text(child) || undefined;
      continue;
    }
    if (tag === 'sec' || (tag === 'notes' && isTrailingNotes(child, index, trailing))) {
      const section = parseSection(child, ctx, kind, `${id}.${sections.length + 1}`);
      if (section) sections.push(section);
      continue;
    }
    if (tag === 'fn-group') {
      const group = noteGroupSection(child, ctx, kind, `${id}.${sections.length + 1}`);
      if (group) {
        sections.push(group);
        continue;
      }
      if (notesAreContent) {
        append(blocks, noteBlocks(child, ctx));
        continue;
      }
    }
    append(blocks, flowBlocks([child], ctx));
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
