/**
 * @fileoverview `ScholarlyDocument` → a flat list of sections in reading order, each
 * rendered on its own with its size. This is what a pager needs to show an outline and
 * serve one section, or one window of the document, at a time.
 * @module src/render/sections
 */
import type { Abstract, ScholarlyDocument, Section, SectionKind } from '../model/document.js';
import { abstractId, FLOATS_ID, FOOTNOTES_ID, REFERENCES_ID } from '../model/section-ids.js';
import {
  abstractHeading,
  abstractMarkdown,
  FLOATS_HEADING,
  FOOTNOTES_HEADING,
  headingText,
  REFERENCES_HEADING,
  renderBlocks,
  renderFloats,
  renderFootnotes,
  renderReferences,
} from './markdown.js';

/** One section, flattened out of the tree. */
export interface FlatSection {
  /** Characters in {@link markdown}. */
  chars: number;
  id: string;
  /**
   * The section's kind; `abstract` for an abstract, `floats` for the figures and tables
   * outside any section, and `footnotes` and `references` for those lists.
   */
  kind: SectionKind | 'abstract' | 'floats' | 'footnotes' | 'references';
  /** Heading depth, 1 for a top-level section. */
  level: number;
  /** The section's own heading and blocks. Subsections are separate entries. */
  markdown: string;
  /** Titles from the top-level section down to this one. */
  path: string[];
  /** The heading `toMarkdown` gives the section: label and title, or its kind's name when untitled. */
  title?: string;
}

/**
 * Every section, abstracts first, then body, then back matter, then one entry each for
 * the figures and tables outside any section (`document.floats`), the footnotes, and the
 * references, when there are any, in `toMarkdown`'s order. Each entry's ID renders it
 * through `toMarkdown`'s `sections` option.
 */
export function toSections(document: ScholarlyDocument): FlatSection[] {
  const out: FlatSection[] = [];
  document.abstracts.forEach((abstract, index) => {
    visitAbstract(abstract, index, out);
  });
  for (const section of [...document.body, ...document.back]) visit(section, 1, [], out);
  if (document.floats.length > 0)
    out.push(trailingEntry(FLOATS_ID, 'floats', FLOATS_HEADING, renderFloats(document.floats)));
  if (document.footnotes.length > 0) {
    const markdown = renderFootnotes(document.footnotes);
    out.push(trailingEntry(FOOTNOTES_ID, 'footnotes', FOOTNOTES_HEADING, markdown));
  }
  if (document.references.length > 0) {
    const markdown = renderReferences(document.references);
    out.push(trailingEntry(REFERENCES_ID, 'references', REFERENCES_HEADING, markdown));
  }
  return out;
}

/** The entry for the floats, the footnotes, or the references, under its heading. */
function trailingEntry(
  id: string,
  kind: 'floats' | 'footnotes' | 'references',
  heading: string,
  rendered: string,
): FlatSection {
  const markdown = rendered.trim();
  return { chars: markdown.length, id, kind, level: 1, markdown, path: [heading], title: heading };
}

function visitAbstract(abstract: Abstract, index: number, out: FlatSection[]): void {
  const title = abstractHeading(abstract);
  const markdown = abstractMarkdown(abstract);
  out.push({
    chars: markdown.length,
    id: abstractId(index),
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
