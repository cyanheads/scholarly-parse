/**
 * @fileoverview `ScholarlyDocument` → Markdown (CommonMark + GFM tables).
 * @module src/render/markdown
 */
import type {
  Abstract,
  AbstractKind,
  Block,
  BoxBlock,
  Footnote,
  Identifiers,
  ListBlock,
  QuoteBlock,
  Reference,
  ScholarlyDocument,
  Section,
  SectionKind,
  TableBlock,
} from '../model/document.js';
import { largest } from '../model/extremes.js';
import { abstractId, FLOATS_ID, FOOTNOTES_ID, REFERENCES_ID } from '../model/section-ids.js';
import {
  codeFence,
  escapeBlockStart,
  escapeInline,
  escapeTableCell,
  escapeTex,
  foldLineBreaks,
} from './escape.js';
import { FORMULA_IMAGE, link } from './inline.js';

/** What to include when rendering. Everything is included by default. */
export interface MarkdownOptions {
  /** `main` renders only the main abstract, or the first non-graphical one when none is marked main. */
  abstracts?: 'all' | 'main' | 'none';
  /** Back matter: appendices, acknowledgments, declarations, sub-articles. */
  back?: boolean;
  footnotes?: boolean;
  /** Title, authors, venue, identifiers, and license. */
  metadata?: boolean;
  references?: boolean;
  /**
   * Render only these entries, by the IDs `toSections` returns: `abstract-N` for the Nth
   * abstract, a section's ID for that section, `floats` for the figures and tables
   * outside any section, and `footnotes` and `references` for those lists. An abstract,
   * the floats, the footnotes, or the references render as their `toSections` entry; a
   * section renders as its entry followed by its subsections'. An abstract's own sections
   * can be named by their IDs from the model too. Entries come in reading order, metadata
   * is left out, and the other options are ignored.
   */
  sections?: string[];
}

/** Headings for sections the source leaves untitled, by kind. */
const KIND_HEADINGS: Record<SectionKind, string | undefined> = {
  acknowledgments: 'Acknowledgments',
  appendix: 'Appendix',
  body: undefined,
  'data-availability': 'Data availability',
  declarations: 'Declarations',
  notes: 'Notes',
  'sub-article': 'Sub-article',
};

const ABSTRACT_HEADINGS: Record<AbstractKind, string> = {
  graphical: 'Graphical abstract',
  main: 'Abstract',
  other: 'Summary',
  'plain-language': 'Plain-language summary',
  teaser: 'Summary',
  translated: 'Abstract (translated)',
};

/** Render a document as Markdown. */
export function toMarkdown(document: ScholarlyDocument, options: MarkdownOptions = {}): string {
  if (options.sections) return renderSelected(document, options.sections);
  const parts: string[] = [];
  if (options.metadata !== false) parts.push(...renderMetadata(document));

  const abstracts = selectAbstracts(document.abstracts, options.abstracts ?? 'all');
  for (const abstract of abstracts) parts.push(renderAbstract(abstract));

  for (const section of document.body) parts.push(renderSection(section, 2));
  if (options.back !== false) {
    for (const section of document.back) parts.push(renderSection(section, 2));
  }
  if (document.floats.length > 0) parts.push(renderFloats(document.floats));
  if (options.footnotes !== false && document.footnotes.length > 0)
    parts.push(renderFootnotes(document.footnotes));
  if (options.references !== false && document.references.length > 0)
    parts.push(renderReferences(document.references));
  return `${parts.filter(Boolean).join('\n\n')}\n`;
}

function selectAbstracts(abstracts: Abstract[], mode: 'all' | 'main' | 'none'): Abstract[] {
  if (mode === 'none') return [];
  if (mode === 'all') return abstracts;
  const main =
    abstracts.find((a) => a.kind === 'main') ?? abstracts.find((a) => a.kind !== 'graphical');
  return main ? [main] : [];
}

/**
 * The entries `ids` names, in reading order, each rendered as `toSections` renders it: a
 * section at the heading level and under the parent kind it has there, followed by its
 * subsections.
 */
function renderSelected(document: ScholarlyDocument, ids: string[]): string {
  const wanted = new Set(ids);
  const found: string[] = [];
  const visit = (sections: Section[], level: number, parentKind?: SectionKind) => {
    for (const section of sections) {
      if (wanted.has(section.id)) found.push(renderSection(section, level, parentKind));
      else visit(section.sections, level + 1, section.kind);
    }
  };
  document.abstracts.forEach((abstract, index) => {
    if (wanted.has(abstractId(index))) found.push(abstractMarkdown(abstract));
    else visit(abstract.sections, 3);
  });
  visit(document.body, 2);
  visit(document.back, 2);
  if (wanted.has(FLOATS_ID) && document.floats.length > 0)
    found.push(renderFloats(document.floats).trim());
  if (wanted.has(FOOTNOTES_ID) && document.footnotes.length > 0)
    found.push(renderFootnotes(document.footnotes).trim());
  if (wanted.has(REFERENCES_ID) && document.references.length > 0)
    found.push(renderReferences(document.references).trim());
  const rendered = found.filter(Boolean);
  return rendered.length > 0 ? `${rendered.join('\n\n')}\n` : '';
}

function renderMetadata(document: ScholarlyDocument): string[] {
  const { metadata } = document;
  const lines: string[] = [];
  if (metadata.title) {
    lines.push(`# ${metadata.title}${metadata.subtitle ? `: ${metadata.subtitle}` : ''}`);
  }
  const details: string[] = [];
  if (metadata.authors?.length)
    details.push(metadata.authors.map((a) => escapeInline(a.name)).join(', '));
  const pages = metadata.venue?.pages ?? metadata.venue?.elocationId;
  const venue = [
    metadata.venue?.title && `*${escapeInline(metadata.venue.title)}*`,
    metadata.published?.year,
    metadata.venue?.volume &&
      `${escapeInline(metadata.venue.volume)}${metadata.venue.issue ? `(${escapeInline(metadata.venue.issue)})` : ''}`,
    pages && escapeInline(pages),
  ].filter(Boolean);
  if (venue.length > 0) details.push(venue.join(', '));
  const idParts = identifierParts(metadata.identifiers ?? {});
  if (idParts.length > 0) details.push(idParts.join(' · '));
  if (metadata.license?.url) details.push(`License: ${link('', metadata.license.url)}`);
  else if (metadata.license?.text)
    details.push(`License: ${escapeInline(truncate(metadata.license.text, 240))}`);
  for (const work of metadata.related ?? []) {
    const parts = [work.text, ...identifierParts(work), work.url && link('', work.url)];
    details.push(`Related (${escapeInline(work.relation)}): ${parts.filter(Boolean).join(' · ')}`);
  }
  if (details.length > 0) lines.push(details.join('  \n'));
  return lines;
}

/** A work's identifiers as `DOI: …`, `PMID: …`, `PMCID: …`, `arXiv: …`. */
function identifierParts(ids: Pick<Identifiers, 'arxiv' | 'doi' | 'pmcid' | 'pmid'>): string[] {
  return [
    ids.doi && `DOI: ${escapeInline(ids.doi)}`,
    ids.pmid && `PMID: ${escapeInline(ids.pmid)}`,
    ids.pmcid && `PMCID: ${escapeInline(ids.pmcid)}`,
    ids.arxiv && `arXiv: ${escapeInline(ids.arxiv)}`,
  ].filter((part): part is string => Boolean(part));
}

/** Text cut at a word boundary to at most `max` characters, with an ellipsis when cut. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max / 2))}…`;
}

/** An abstract's heading: its own title, else its kind's. */
export function abstractHeading(abstract: Abstract): string {
  return abstract.title ?? ABSTRACT_HEADINGS[abstract.kind];
}

/** An abstract under its heading; nothing when nothing is under the heading. */
function renderAbstract(abstract: Abstract): string {
  const body = abstract.sections.map((section) => renderSection(section, 3)).filter(Boolean);
  if (body.length === 0) return '';
  return [`## ${abstractHeading(abstract)}`, ...body].join('\n\n');
}

/** An abstract as `toSections` lists it: under its heading, which stands even with nothing under it. */
export function abstractMarkdown(abstract: Abstract): string {
  return renderAbstract(abstract) || `## ${abstractHeading(abstract)}`;
}

/**
 * A section heading's text: label, then title, else the kind's default where the
 * section opens that kind (an untitled part of a titled appendix is not a new one).
 */
export function headingText(
  section: Section,
  parentKind: SectionKind | undefined,
): string | undefined {
  const title =
    section.title ?? (section.kind === parentKind ? undefined : KIND_HEADINGS[section.kind]);
  if (!title) return section.label ? escapeInline(section.label) : undefined;
  return section.label && !title.startsWith(section.label)
    ? `${escapeInline(section.label)} ${title}`
    : title;
}

/**
 * Render a section and its subsections, its heading at `level` (capped at 6). `depth`
 * counts the lists, quotes, and boxes around the section (a box can hold sections).
 */
export function renderSection(
  section: Section,
  level: number,
  parentKind?: SectionKind,
  depth = 0,
): string {
  const parts: string[] = [];
  const heading = headingText(section, parentKind);
  if (heading) parts.push(`${'#'.repeat(Math.min(level, 6))} ${heading}`);
  const blocks = renderBlocks(section.blocks, depth);
  if (blocks) parts.push(blocks);
  for (const sub of section.sections) {
    const rendered = renderSection(sub, level + 1, section.kind, depth);
    if (rendered) parts.push(rendered);
  }
  return parts.join('\n\n');
}

/** Heading over the figures and tables the source places outside any section. */
export const FLOATS_HEADING = 'Figures and tables';

/** The figures and tables outside any section, under their own heading. */
export function renderFloats(floats: Block[]): string {
  return `## ${FLOATS_HEADING}\n\n${renderBlocks(floats)}`;
}

/** Heading over the footnotes. */
export const FOOTNOTES_HEADING = 'Footnotes';

/** The footnotes as a list under their own heading, each led by its label. */
export function renderFootnotes(footnotes: Footnote[]): string {
  const lines = footnotes.map(
    (fn) =>
      `- ${fn.label ? `**${escapeInline(fn.label)}** ${fn.text}` : escapeBlockStart(fn.text)}`,
  );
  return `## ${FOOTNOTES_HEADING}\n\n${lines.join('\n')}`;
}

/** Heading over the references. */
export const REFERENCES_HEADING = 'References';

/** The references as a list under their own heading, each led by its bracketed label. */
export function renderReferences(references: Reference[]): string {
  const lines = references.map(
    (ref) =>
      `- ${ref.label ? `[${escapeInline(ref.label)}] ${ref.text}` : escapeBlockStart(ref.text)}`,
  );
  return `## ${REFERENCES_HEADING}\n\n${lines.join('\n')}`;
}

/**
 * Render blocks separated by blank lines. `depth` counts the lists, quotes, and boxes
 * around them.
 */
export function renderBlocks(blocks: Block[], depth = 0): string {
  return blocks
    .map((block) => renderBlock(block, depth))
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Deepest nesting of lists, quotes, and boxes that indents or marks what it holds. The
 * list, quote, or box at this level renders everything inside it at its own prefix: list
 * items deeper still keep their markers at its items' indentation, and deeper quotes and
 * boxes add no `>`. A line's prefix stays within eight levels, and the renderer's stack
 * stays fixed, however deep a document nests. The corpus nests lists two deep at most,
 * and LaTeX's list environments stop at four.
 */
export const MAX_BLOCK_NESTING = 8;

type ContainerBlock = ListBlock | QuoteBlock | BoxBlock;
type LeafBlock = Exclude<Block, ContainerBlock>;

function renderBlock(block: Block, depth: number): string {
  switch (block.type) {
    case 'list':
    case 'quote':
    case 'box':
      return depth + 1 < MAX_BLOCK_NESTING ? renderNested(block, depth + 1) : renderAtCap(block);
    default:
      return renderLeaf(block);
  }
}

/** A list, quote, or box at `level` of nesting, below the cap; what it holds nests one level deeper. */
function renderNested(block: ContainerBlock, level: number): string {
  switch (block.type) {
    case 'list':
      return renderList(block, level);
    case 'quote':
      return quoteLines(renderBlocks(block.blocks, level));
    case 'box': {
      const inner = [
        boxTitle(block),
        renderBlocks(block.blocks, level),
        ...block.sections.map((s) => renderSection(s, 4, undefined, level)),
      ].filter(Boolean);
      return inner.length > 0 ? quoteLines(inner.join('\n\n')) : '';
    }
  }
}

/** A list, quote, or box at the cap, with everything inside it at its own prefix. */
function renderAtCap(block: ContainerBlock): string {
  const flat = renderFlat(block);
  if (block.type === 'list') return flat;
  if (block.type === 'box' && !flat) return '';
  return quoteLines(flat);
}

function boxTitle(block: BoxBlock): string {
  const title = [block.label && escapeInline(block.label), block.title].filter(Boolean).join(' ');
  return title ? `**${title}**` : '';
}

function labeled(label: string | undefined, caption: string | undefined): string {
  const head = label ? `**${escapeInline(label.replace(/[.:]\s*$/, ''))}.**` : '';
  return [head, caption].filter(Boolean).join(' ');
}

function renderLeaf(block: LeafBlock): string {
  switch (block.type) {
    case 'paragraph':
      return escapeBlockStart(block.text);
    case 'table':
      return renderTable(block);
    case 'figure':
      return block.label || block.caption || block.alt
        ? labeled(block.label ?? 'Figure', block.caption ?? escapeInline(block.alt ?? ''))
        : '';
    case 'supplement': {
      const text = labeled(block.label ?? 'Supplementary material', block.caption);
      return block.href ? `${text} (file: ${escapeInline(block.href)})` : text;
    }
    case 'formula': {
      const label = block.label?.replace(/^\((.*)\)$/, '$1').trim();
      if (block.tex) return displayMath(block.tex, label);
      const body = block.text === undefined ? FORMULA_IMAGE : escapeInline(block.text);
      return `${escapeBlockStart(body)}${label ? ` (${escapeInline(label)})` : ''}`;
    }
    case 'code': {
      const fence = codeFence(block.text);
      const language = block.language && CODE_LANGUAGE.test(block.language) ? block.language : '';
      return `${fence}${language}\n${block.text}\n${fence}`;
    }
  }
}

/** A code block's language as a fence info string: a name, nothing that could end the line. */
const CODE_LANGUAGE = /^[\w+#.-]{1,32}$/;

/** What a `\tag{}` label keeps: text that can neither end the group nor start TeX markup. */
const TAG_UNSAFE = /[^\p{L}\p{N}\s.,:;'’′*+\-–—()[\]]/gu;

/**
 * A display formula on one line between `$$` fences, so no line of the source TeX can
 * close the block early. TeX reads a line break as a space, so the formula is unchanged.
 */
function displayMath(tex: string, label: string | undefined): string {
  const tag = label?.replace(TAG_UNSAFE, '').replace(/\s+/g, ' ').trim();
  const line = `${foldLineBreaks(tex).trim()}${tag ? ` \\tag{${tag}}` : ''}`;
  return `$$\n${escapeTex(line)}\n$$`;
}

function quoteLines(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');
}

function renderList(list: ListBlock, level: number): string {
  const lines: string[] = [];
  if (list.title) lines.push(`**${list.title}**`, '');
  list.items.forEach((item, index) => {
    const marker = list.ordered ? `${index + 1}. ` : '- ';
    const indent = ' '.repeat(marker.length);
    const body = renderBlocks(item, level)
      .split('\n')
      .map((line, i) => (i === 0 ? `${marker}${line}` : line ? `${indent}${line}` : ''))
      .join('\n');
    lines.push(body);
  });
  return lines.join('\n');
}

/** A list item met in a flat walk: its marker until its first line is written, then an indent as wide. */
interface FlatItem {
  indent: string;
  marker: string;
  started: boolean;
}

/** One step of a flat walk. `item` is the list item the output belongs to, if any. */
type FlatStep =
  | { block: Block; item: FlatItem | undefined; type: 'block' }
  | { blocks: Block[]; first: boolean; marker: string; parent: FlatItem | undefined; type: 'item' }
  | { item: FlatItem; type: 'end-item' }
  | {
      heading: number;
      item: FlatItem | undefined;
      parentKind: SectionKind | undefined;
      section: Section;
      type: 'section';
    }
  | { item: FlatItem | undefined; text: string; type: 'text' };

/**
 * A list, quote, or box and everything inside it, walked with a stack instead of
 * recursion and written without the prefix of the nesting below it: every list item keeps
 * its marker at the same indentation, and quotes and boxes inside add nothing. Content
 * without nesting renders as {@link renderNested} writes it, blocks a blank line apart and
 * the items of a list a line break apart.
 */
function renderFlat(root: ContainerBlock): string {
  let out = '';
  let gap = '';
  const write = (text: string, item: FlatItem | undefined) => {
    if (!text) return;
    const indent = item?.indent ?? '';
    const lines = text.split('\n');
    const first = lines[0] ?? '';
    const head =
      item && !item.started ? `${item.marker}${first}` : first ? `${indent}${first}` : '';
    if (item) item.started = true;
    let body = head;
    for (let i = 1; i < lines.length; i++) body += `\n${lines[i] ? `${indent}${lines[i]}` : ''}`;
    out += gap + body;
    gap = '\n\n';
  };

  const steps: FlatStep[] = [{ block: root, item: undefined, type: 'block' }];
  const pushBlocks = (blocks: Block[], item: FlatItem | undefined) => {
    for (let i = blocks.length - 1; i >= 0; i--)
      steps.push({ block: blocks[i] as Block, item, type: 'block' });
  };
  const pushSections = (
    sections: Section[],
    heading: number,
    parentKind: SectionKind | undefined,
    item: FlatItem | undefined,
  ) => {
    for (let i = sections.length - 1; i >= 0; i--)
      steps.push({ heading, item, parentKind, section: sections[i] as Section, type: 'section' });
  };

  for (let step = steps.pop(); step; step = steps.pop()) {
    switch (step.type) {
      case 'text':
        write(step.text, step.item);
        break;
      case 'end-item':
        // An item with nothing written still shows its marker, as an empty item does nested.
        if (!step.item.started) write(step.item.marker, undefined);
        break;
      case 'item': {
        // An item whose parent has written nothing yet opens on the parent's line.
        const lead = step.parent && !step.parent.started ? step.parent.marker : '';
        if (step.parent) step.parent.started = true;
        const item = {
          indent: ' '.repeat(step.marker.length),
          marker: lead + step.marker,
          started: false,
        };
        if (!step.first) gap = '\n';
        steps.push({ item, type: 'end-item' });
        pushBlocks(step.blocks, item);
        break;
      }
      case 'section': {
        const { heading, item, section } = step;
        pushSections(section.sections, heading + 1, section.kind, item);
        pushBlocks(section.blocks, item);
        const title = headingText(section, step.parentKind);
        if (title)
          steps.push({ item, text: `${'#'.repeat(Math.min(heading, 6))} ${title}`, type: 'text' });
        break;
      }
      case 'block': {
        const { block, item } = step;
        if (block.type === 'list') {
          for (let k = block.items.length - 1; k >= 0; k--) {
            const marker = block.ordered ? `${k + 1}. ` : '- ';
            const blocks = block.items[k] as Block[];
            steps.push({ blocks, first: k === 0, marker, parent: item, type: 'item' });
          }
          if (block.title) steps.push({ item, text: `**${block.title}**`, type: 'text' });
        } else if (block.type === 'quote') {
          pushBlocks(block.blocks, item);
        } else if (block.type === 'box') {
          pushSections(block.sections, 4, undefined, item);
          pushBlocks(block.blocks, item);
          steps.push({ item, text: boxTitle(block), type: 'text' });
        } else {
          write(renderLeaf(block), item);
        }
        break;
      }
    }
  }
  return out;
}

/**
 * A GFM table. GFM allows one header row, so several source header rows are merged
 * column by column; a table without header rows gets an empty header so no data row is
 * mislabeled as one.
 */
function renderTable(table: TableBlock): string {
  const parts: string[] = [];
  if (table.label || table.caption) parts.push(labeled(table.label ?? 'Table', table.caption));
  if (table.rows.length === 0) {
    parts.push(`*Table content not available (${table.unextractable ?? 'no-rows'}).*`);
  } else {
    const width = largest(table.rows.map((row) => row.length));
    const cell = (value: string | undefined) => escapeTableCell(value ?? '');
    const headerRows = table.rows.slice(0, table.headerRows);
    const header = Array.from({ length: width }, (_, col) => {
      const values = headerRows.map((row) => row[col] ?? '').filter(Boolean);
      return [...new Set(values)].join(' / ');
    });
    const line = (cells: (string | undefined)[]) =>
      `| ${Array.from({ length: width }, (_, i) => cell(cells[i])).join(' | ')} |`;
    parts.push(
      [
        line(header),
        `|${' --- |'.repeat(width)}`,
        ...table.rows.slice(table.headerRows).map(line),
      ].join('\n'),
    );
  }
  if (table.footnotes?.length) parts.push(table.footnotes.map(escapeBlockStart).join('  \n'));
  return parts.join('\n\n');
}
