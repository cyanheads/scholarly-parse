/**
 * @fileoverview Section IDs unique within one document: the source's own ID when it is
 * unused, else a fallback made unique with a numeric suffix. The IDs `toSections` gives
 * its entries that are not sections are defined here too, and no section is issued one.
 * @module src/model/section-ids
 */

/** The ID `toSections` gives the abstract at `index` in `document.abstracts`. */
export function abstractId(index: number): string {
  return `abstract-${index + 1}`;
}

/** The ID `toSections` gives the figures and tables outside any section. */
export const FLOATS_ID = 'floats';

/** The ID `toSections` gives the footnotes. */
export const FOOTNOTES_ID = 'footnotes';

/** The ID `toSections` gives the references. */
export const REFERENCES_ID = 'references';

/**
 * The IDs `toSections` generates: {@link abstractId}'s `abstract-<digits>`,
 * {@link FLOATS_ID}, {@link FOOTNOTES_ID}, and {@link REFERENCES_ID}. A section never
 * takes one, so each entry's ID names that entry alone.
 */
export const RESERVED_SECTION_ID = /^(?:abstract-\d+|floats|footnotes|references)$/;

/**
 * The next suffix to try for each base, per set of issued IDs, so a document that
 * repeats one ID throughout costs one step per section rather than a search from `-2`
 * each time. A suffix freed by a deleted ID is not reissued; IDs stay unique.
 */
const nextSuffix = new WeakMap<Set<string>, Map<string, number>>();

/**
 * Issue an ID into `issued`: `sourceId` when unused, else `fallback` made unique. An ID
 * in the reserved family counts as used, so it takes a suffix of its own: `abstract-1`
 * becomes `abstract-1-2`, and a second `abstract`, whose `abstract-2` is reserved,
 * becomes `abstract-2-2`. A suffixed ID is reserved only when its base is `abstract`, and
 * suffixing that one again leaves the family, so at most two suffixes are added.
 */
export function issueId(
  issued: Set<string>,
  sourceId: string | undefined,
  fallback: string,
): string {
  let id = sourceId || fallback;
  while (issued.has(id) || RESERVED_SECTION_ID.test(id)) id = suffixed(issued, id);
  issued.add(id);
  return id;
}

/** `base` with the first numeric suffix not yet issued. */
function suffixed(issued: Set<string>, base: string): string {
  const suffixes = nextSuffix.get(issued) ?? new Map<string, number>();
  nextSuffix.set(issued, suffixes);
  let n = suffixes.get(base) ?? 2;
  while (issued.has(`${base}-${n}`)) n++;
  suffixes.set(base, n + 1);
  return `${base}-${n}`;
}
