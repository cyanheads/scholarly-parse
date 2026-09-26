/**
 * @fileoverview `ScholarlyDocument` → a flat list of sections in reading order, each
 * rendered on its own with its size. This is what a pager needs to show an outline and
 * serve one section, or one window of the document, at a time.
 * @module src/render/sections
 */
import type { Abstract, ScholarlyDocument, Section, SectionKind } from '../model/document.js';
import { abstractHeading, headingText, renderBlocks, renderSection } from './markdown.js';

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
  /** The heading `toMarkdown` gives the section: label and title, or its kind's name when untitled. */
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
  const title = abstractHeading(abstract);
  const markdown = [`## ${title}`, ...abstract.sections.map((s) => renderSection(s, 3))]
    .filter(Boolean)
    .join('\n\n');
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

/** A section's entry, then its subsections'. Headings follow `toMarkdown`'s. */
function visit(
  section: Section,
  level: number,
  parents: string[],
  out: FlatSection[],
  parentKind?: SectionKind,
): void {
  const title = headingText(section, parentKind);
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
  for (const sub of section.sections) visit(sub, level + 1, path, out, section.kind);
}
