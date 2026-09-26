/**
 * @fileoverview Walk every block in a document, wherever it sits: body, back matter,
 * abstracts, floats, and inside lists, quotes, and boxes.
 * @module tests/corpus/walk
 */
import type { Block, ScholarlyDocument, Section } from '../../src/model/document.js';

export function allSections(document: ScholarlyDocument): Section[] {
  const out: Section[] = [];
  const visit = (sections: Section[]) => {
    for (const section of sections) {
      out.push(section);
      visit(section.sections);
    }
  };
  for (const abstract of document.abstracts) visit(abstract.sections);
  visit(document.body);
  visit(document.back);
  return out;
}

export function allBlocks(document: ScholarlyDocument): Block[] {
  const out: Block[] = [];
  const visitBlocks = (blocks: Block[]) => {
    for (const block of blocks) {
      out.push(block);
      if (block.type === 'list') for (const item of block.items) visitBlocks(item);
      if (block.type === 'quote') visitBlocks(block.blocks);
      if (block.type === 'box') {
        visitBlocks(block.blocks);
        for (const section of block.sections) visitSection(section);
      }
    }
  };
  const visitSection = (section: Section) => {
    visitBlocks(section.blocks);
    for (const sub of section.sections) visitSection(sub);
  };
  for (const abstract of document.abstracts) for (const s of abstract.sections) visitSection(s);
  for (const section of [...document.body, ...document.back]) visitSection(section);
  visitBlocks(document.floats);
  return out;
}

export function countBlocks(document: ScholarlyDocument, type: Block['type']): number {
  return allBlocks(document).filter((block) => block.type === type).length;
}
