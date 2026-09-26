/**
 * @fileoverview `ScholarlyDocument` → a flat list of sections in reading order, each
 * rendered on its own with its size. This is what a pager needs to show an outline and
 * serve one section, or one window of the document, at a time.
 * @module src/render/sections
 */
import type { Abstract, ScholarlyDocument, Section, SectionKind } from '../model/document.js';
import { renderBlocks } from './markdown.js';

/** One section, flattened out of the tree. */
export interface FlatSection {
  /** Characters in {@link markdown}. */
  chars: number;
  id: string;
  kind: SectionKind | 'abstract';
  /** Heading depth, 1 for a top-level section. */
  level: number;
  /** The section's own heading and blocks. Subsections are separate entries. */
  markdown: string;
  /** Titles from the top-level section down to this one. */
  path: string[];
  title?: string;
}

/** Every section, abstracts first, then body, then back matter. */
export function toSections(document: ScholarlyDocument): FlatSection[] {
  const out: FlatSection[] = [];
  document.abstracts.forEach((abstract, index) => {
    visitAbstract(abstract, index, out);
  });
  for (const section of [...document.body, ...document.back]) visit(section, 1, [], out);
  return out;
}

function visitAbstract(abstract: Abstract, index: number, out: FlatSection[]): void {
  const title =
    abstract.title ?? (abstract.kind === 'main' ? 'Abstract' : `Abstract (${abstract.kind})`);
  const markdown =
    `## ${title}\n\n${abstract.sections.map((s) => renderSectionAll(s, 3)).join('\n\n')}`.trim();
  out.push({
    chars: markdown.length,
    id: `abstract-${index + 1}`,
    kind: 'abstract',
    level: 1,
    markdown,
    path: [title],
    title,
  });
}

function renderSectionAll(section: Section, level: number): string {
  const heading = section.title ? `${'#'.repeat(Math.min(level, 6))} ${section.title}\n\n` : '';
  const sub = section.sections.map((s) => renderSectionAll(s, level + 1)).join('\n\n');
  return `${heading}${renderBlocks(section.blocks)}${sub ? `\n\n${sub}` : ''}`.trim();
}

function visit(section: Section, level: number, parents: string[], out: FlatSection[]): void {
  const label =
    section.label && section.title && !section.title.startsWith(section.label)
      ? `${section.label} `
      : '';
  const title = section.title ? `${label}${section.title}` : undefined;
  const heading = title ? `${'#'.repeat(Math.min(level + 1, 6))} ${title}\n\n` : '';
  const markdown = `${heading}${renderBlocks(section.blocks)}`.trim();
  const path = title ? [...parents, title] : parents;
  out.push({
    chars: markdown.length,
    id: section.id,
    kind: section.kind,
    level,
    markdown,
    path,
    ...(title && { title }),
  });
  for (const sub of section.sections) visit(sub, level + 1, path, out);
}
