/**
 * @fileoverview Readers of the spans inline Markdown this package writes is made of — code
 * spans, autolinks, inline math, bracket pairs — that the seam pass, link text, and the
 * plain-text renderer share. Each reads the text once.
 * @module src/render/scan
 */

/** ASCII punctuation, which a backslash escapes. */
export const ESCAPABLE = /^[!-/:-@[-`{-~]$/;

/**
 * Each `[` paired with its `]` as CommonMark pairs them, in one pass: a bracket a
 * backslash escapes, or one inside a code span or an autolink, does not count, and nested
 * pairs balance on a stack. Inline math gets no special treatment, as in CommonMark,
 * unless `skipMath` asks for `$…$` to be read as a span too, as `stripInline` reads it.
 * `pairs` maps each paired `[` to its `]`; `unpaired` holds the rest, in ascending order.
 */
export function pairBrackets(
  markdown: string,
  { skipMath = false }: { skipMath?: boolean } = {},
): { pairs: Map<number, number>; unpaired: number[] } {
  const pairs = new Map<number, number>();
  const unpaired: number[] = [];
  const open: number[] = [];
  const codeSpanEnd = codeSpanCloser(markdown);
  const special = skipMath ? /[\\`<[\]$]/g : /[\\`<[\]]/g;
  let mathCloses = true;
  for (let found = special.exec(markdown); found; found = special.exec(markdown)) {
    const start = found.index;
    let end = start + 1;
    switch (found[0]) {
      case '\\':
        if (ESCAPABLE.test(markdown.charAt(end))) end++;
        break;
      case '`':
        end = codeSpanAt(markdown, start, codeSpanEnd).end;
        break;
      case '<':
        end = autolinkAt(markdown, start)?.end ?? end;
        break;
      case '$': {
        const close = mathCloses ? unescapedDollar(markdown, end) : -1;
        if (close === -1) mathCloses = false;
        if (close > end) end = close + 1;
        break;
      }
      case '[':
        open.push(start);
        break;
      default: {
        const opener = open.pop();
        if (opener === undefined) unpaired.push(start);
        else pairs.set(opener, start);
      }
    }
    special.lastIndex = end;
  }
  return { pairs, unpaired: [...unpaired, ...open].sort((a, b) => a - b) };
}

/** `markdown` with a backslash inserted before the character at each of `positions`, in ascending order. */
export function insertBackslashes(markdown: string, positions: readonly number[]): string {
  if (positions.length === 0) return markdown;
  let out = '';
  let at = 0;
  for (const position of positions) {
    out += `${markdown.slice(at, position)}\\`;
    at = position;
  }
  return out + markdown.slice(at);
}

/**
 * The backtick run at `start`, and the code span it opens: `content` is undefined, and
 * `end` the end of the run, when no run of its length closes it.
 */
export function codeSpanAt(
  markdown: string,
  start: number,
  codeSpanEnd: (length: number, from: number) => number | undefined,
): { content?: string; end: number } {
  let open = start + 1;
  while (markdown.charAt(open) === '`') open++;
  const close = codeSpanEnd(open - start, open);
  if (close === undefined) return { end: open };
  return { content: markdown.slice(open, close), end: close + open - start };
}

/**
 * A finder of code-span closers for `markdown`: the start of the first run of exactly
 * `length` backticks at or after `from`, which a run of that length opening before
 * `from` closes. Runs are found once, and the search for each length only moves forward,
 * as the text is read.
 */
export function codeSpanCloser(
  markdown: string,
): (length: number, from: number) => number | undefined {
  const starts = new Map<number, number[]>();
  for (const run of markdown.matchAll(/`+/g)) {
    const list = starts.get(run[0].length);
    if (list) list.push(run.index);
    else starts.set(run[0].length, [run.index]);
  }
  const next = new Map<number, number>();
  return (length, from) => {
    const list = starts.get(length) ?? [];
    let i = next.get(length) ?? 0;
    while (i < list.length && (list[i] ?? from) < from) i++;
    next.set(length, i);
    return list[i];
  };
}

/**
 * The first `$` at or after `from` that no odd run of backslashes escapes, counting none
 * before `from`, or -1. When there is none, there is none after a later `$` either.
 */
export function unescapedDollar(markdown: string, from: number): number {
  for (let at = markdown.indexOf('$', from); at !== -1; at = markdown.indexOf('$', at + 1)) {
    let backslashes = 0;
    for (let i = at - 1; i >= from && markdown.charAt(i) === '\\'; i--) backslashes++;
    if (backslashes % 2 === 0) return at;
  }
  return -1;
}

/** An autolink's target: a URL with a scheme `link` writes as one. */
const AUTOLINK_TARGET = /^(?:https?|ftp|mailto):[\s\S]/i;

/**
 * An autolink at `start`: its target up to the next `>`, which no `<` comes before (a
 * written URL has its angle brackets percent-encoded).
 */
export function autolinkAt(
  markdown: string,
  start: number,
): { end: number; target: string } | undefined {
  const angle = /[<>]/g;
  angle.lastIndex = start + 1;
  const close = angle.exec(markdown);
  if (close?.[0] !== '>') return;
  const target = markdown.slice(start + 1, close.index);
  return AUTOLINK_TARGET.test(target) ? { end: close.index + 1, target } : undefined;
}
