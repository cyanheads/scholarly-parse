/**
 * @fileoverview Section IDs unique within one document: the source's own ID when it is
 * unused, else a fallback made unique with a numeric suffix.
 * @module src/model/section-ids
 */

/**
 * The next suffix to try for each base, per set of issued IDs, so a document that
 * repeats one ID throughout costs one step per section rather than a search from `-2`
 * each time. A suffix freed by a deleted ID is not reissued; IDs stay unique.
 */
const nextSuffix = new WeakMap<Set<string>, Map<string, number>>();

/** Issue an ID into `issued`: `sourceId` when unused, else `fallback` made unique. */
export function issueId(
  issued: Set<string>,
  sourceId: string | undefined,
  fallback: string,
): string {
  const base = sourceId || fallback;
  let id = base;
  if (issued.has(id)) {
    const suffixes = nextSuffix.get(issued) ?? new Map<string, number>();
    nextSuffix.set(issued, suffixes);
    let n = suffixes.get(base) ?? 2;
    while (issued.has(`${base}-${n}`)) n++;
    id = `${base}-${n}`;
    suffixes.set(base, n + 1);
  }
  issued.add(id);
  return id;
}
