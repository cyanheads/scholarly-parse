/**
 * @fileoverview A section's kind from its heading, for sources that do not declare one:
 * the "Acknowledgements" or "Data availability" section a LaTeX paper or a web page
 * writes as an ordinary numbered section.
 * @module src/model/section-kinds
 */
import type { SectionKind } from './document.js';

const TITLE_KINDS: [RegExp, SectionKind][] = [
  [/^acknowledg/i, 'acknowledgments'],
  [/^(data|code|data and code|software) availability|^availability of data/i, 'data-availability'],
  [/^appendix|^appendices|^supplementary (material|information)$/i, 'appendix'],
  [
    /^(competing|conflicts? of) interests?|^declaration|^funding|^author contributions|^ethic|^disclosure/i,
    'declarations',
  ],
];

/** The back-matter kind a heading names, or undefined for an ordinary body section. */
export function kindFromTitle(title: string | undefined): SectionKind | undefined {
  if (!title) return;
  const plain = title.replace(/[*_\\]/g, '').trim();
  return TITLE_KINDS.find(([pattern]) => pattern.test(plain))?.[1];
}
