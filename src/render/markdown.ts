/**
 * @fileoverview `ScholarlyDocument` → Markdown (CommonMark + GFM tables).
 * @module src/render/markdown
 */
import type {
  Abstract,
  AbstractKind,
  Block,
  Identifiers,
  ScholarlyDocument,
  Section,
  SectionKind,
  TableBlock,
} from '../model/document.js';
import { codeFence, escapeBlockStart, escapeInline, escapeTableCell } from './escape.js';
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
   * Render only these sections (by ID, from `toSections` or the model), each with its
   * subsections. Abstracts, metadata, footnotes, and references are left out.
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
  if (document.floats.length > 0)
    parts.push(`## Figures and tables\n\n${renderBlocks(document.floats)}`);
  if (options.footnotes !== false && document.footnotes.length > 0) {
    const lines = document.footnotes.map(
      (fn) => `- ${fn.label ? `**${escapeInline(fn.label)}** ` : ''}${fn.text}`,
    );
    parts.push(`## Footnotes\n\n${lines.join('\n')}`);
  }
  if (options.references !== false && document.references.length > 0) {
    const lines = document.references.map(
      (ref) => `- ${ref.label ? `[${escapeInline(ref.label)}] ` : ''}${ref.text}`,
    );
    parts.push(`## References\n\n${lines.join('\n')}`);
  }
  return `${parts.filter(Boolean).join('\n\n')}\n`;
}

function selectAbstracts(abstracts: Abstract[], mode: 'all' | 'main' | 'none'): Abstract[] {
  if (mode === 'none') return [];
  if (mode === 'all') return abstracts;
  const main =
    abstracts.find((a) => a.kind === 'main') ?? abstracts.find((a) => a.kind !== 'graphical');
  return main ? [main] : [];
}

function renderSelected(document: ScholarlyDocument, ids: string[]): string {
  const wanted = new Set(ids);
  const found: string[] = [];
  const visit = (sections: Section[], level: number) => {
    for (const section of sections) {
      if (wanted.has(section.id)) found.push(renderSection(section, level));
      else visit(section.sections, level + 1);
    }
  };
  visit(document.body, 2);
  visit(document.back, 2);
  for (const abstract of document.abstracts) visit(abstract.sections, 3);
  return found.length > 0 ? `${found.join('\n\n')}\n` : '';
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
  const venue = [
    metadata.venue?.title && `*${escapeInline(metadata.venue.title)}*`,
    metadata.published?.year,
    metadata.venue?.volume &&
      `${escapeInline(metadata.venue.volume)}${metadata.venue.issue ? `(${escapeInline(metadata.venue.issue)})` : ''}`,
    (metadata.venue?.pages ?? metadata.venue?.elocationId) &&
      escapeInline(metadata.venue?.pages ?? metadata.venue?.elocationId ?? ''),
  ].filter(Boolean);
  if (venue.length > 0) details.push(venue.join(', '));
  const idParts = identifierParts(metadata.identifiers ?? {});
  if (idParts.length > 0) details.push(idParts.join(' · '));
  if (metadata.license?.url) details.push(`License: <${metadata.license.url}>`);
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
    ids.pmid && `PMID: ${ids.pmid}`,
    ids.pmcid && `PMCID: ${ids.pmcid}`,
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

function renderAbstract(abstract: Abstract): string {
  const body = abstract.sections.map((section) => renderSection(section, 3)).filter(Boolean);
  if (body.length === 0) return '';
  return [`## ${abstractHeading(abstract)}`, ...body].join('\n\n');
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

/** Render a section and its subsections, its heading at `level` (capped at 6). */
export function renderSection(section: Section, level: number, parentKind?: SectionKind): string {
  const parts: string[] = [];
  const heading = headingText(section, parentKind);
  if (heading) parts.push(`${'#'.repeat(Math.min(level, 6))} ${heading}`);
  const blocks = renderBlocks(section.blocks);
  if (blocks) parts.push(blocks);
  for (const sub of section.sections) {
    const rendered = renderSection(sub, level + 1, section.kind);
    if (rendered) parts.push(rendered);
  }
  return parts.join('\n\n');
}

/** Render blocks separated by blank lines. */
export function renderBlocks(blocks: Block[]): string {
  return blocks.map(renderBlock).filter(Boolean).join('\n\n');
}

function labeled(label: string | undefined, caption: string | undefined): string {
  const head = label ? `**${escapeInline(label.replace(/[.:]\s*$/, ''))}.**` : '';
  return [head, caption].filter(Boolean).join(' ');
}

function renderBlock(block: Block): string {
  switch (block.type) {
    case 'paragraph':
      return escapeBlockStart(block.text);
    case 'list':
      return renderList(block.items, block.ordered, block.title);
    case 'table':
      return renderTable(block);
    case 'figure':
      return block.label || block.caption || block.alt
        ? labeled(block.label ?? 'Figure', block.caption ?? block.alt)
        : '';
    case 'supplement': {
      const text = labeled(block.label ?? 'Supplementary material', block.caption);
      return block.href ? `${text} (file: ${escapeInline(block.href)})` : text;
    }
    case 'formula': {
      const label = block.label?.replace(/^\((.*)\)$/, '$1').trim();
      if (block.tex) return `$$\n${block.tex}${label ? ` \\tag{${label}}` : ''}\n$$`;
      const body = block.text === undefined ? FORMULA_IMAGE : escapeInline(block.text);
      return `${escapeBlockStart(body)}${label ? ` (${escapeInline(label)})` : ''}`;
    }
    case 'code': {
      const fence = codeFence(block.text);
      return `${fence}${block.language ?? ''}\n${block.text}\n${fence}`;
    }
    case 'quote':
      return quoteLines(renderBlocks(block.blocks));
    case 'box': {
      const title = [block.label && escapeInline(block.label), block.title]
        .filter(Boolean)
        .join(' ');
      const inner = [
        title ? `**${title}**` : '',
        renderBlocks(block.blocks),
        ...block.sections.map((s) => renderSection(s, 4)),
      ].filter(Boolean);
      return inner.length > 0 ? quoteLines(inner.join('\n\n')) : '';
    }
  }
}

function quoteLines(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');
}

function renderList(items: Block[][], ordered: boolean, title: string | undefined): string {
  const lines: string[] = [];
  if (title) lines.push(`**${title}**`, '');
  items.forEach((item, index) => {
    const marker = ordered ? `${index + 1}. ` : '- ';
    const indent = ' '.repeat(marker.length);
    const body = renderBlocks(item)
      .split('\n')
      .map((line, i) => (i === 0 ? `${marker}${line}` : line ? `${indent}${line}` : ''))
      .join('\n');
    lines.push(body);
  });
  return lines.join('\n');
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
    const width = Math.max(...table.rows.map((row) => row.length));
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
  if (table.footnotes?.length) parts.push(table.footnotes.join('  \n'));
  return parts.join('\n\n');
}
