/**
 * @fileoverview Section IDs unique within one document: the source's own ID when it is
 * unused, else a fallback made unique with a numeric suffix.
 * @module src/model/section-ids
 */

/** Issue an ID into `issued`: `sourceId` when unused, else `fallback` made unique. */
export function issueId(
  issued: Set<string>,
  sourceId: string | undefined,
  fallback: string,
): string {
  const base = sourceId || fallback;
  let id = base;
  for (let n = 2; issued.has(id); n++) id = `${base}-${n}`;
  issued.add(id);
  return id;
}
