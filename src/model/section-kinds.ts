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
    /^(competing|conflicts? of) interests?|^declaration|declarations?$|^fund(ing|er)|^author contributions|^ethic|^disclosure|^statements$/i,
    'declarations',
  ],
  [/^(foot|end)notes$|^notes$|^publisher[’']?s note/i, 'notes'],
];

/** The back-matter kind a heading names, or undefined for an ordinary body section. */
export function kindFromTitle(title: string | undefined): SectionKind | undefined {
  if (!title) return;
  const plain = title.replace(/[*_\\]/g, '').trim();
  return TITLE_KINDS.find(([pattern]) => pattern.test(plain))?.[1];
}

/** A printed section number at the start of a heading: `1`, `2.1`, `3.2.1.` — one or two digits a part, so `2019 Novel coronavirus` stays whole. */
const LEADING_NUMBER = /^((?:\d{1,2}\.)*\d{1,2})\.?\s+(?=\S)/;

/**
 * A heading with its printed number moved into the label, for sources that write the
 * number into the heading text (`1 Introduction`, `2.1. Methods`). A label the source
 * gives separately is kept, and a matching number is removed from the title.
 */
export function splitSectionNumber(
  title: string | undefined,
  label: string | undefined,
): { label?: string; title?: string } {
  const match = title === undefined ? null : LEADING_NUMBER.exec(title);
  const number = match?.[1];
  if (!title || !match || !number) return { ...(label && { label }), ...(title && { title }) };
  if (label && label.replace(/\.$/, '') !== number) return { label, title };
  const rest = title.slice(match[0].length);
  return { label: label ?? number, ...(rest && { title: rest }) };
}
