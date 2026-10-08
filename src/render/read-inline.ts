/**
 * @fileoverview Inline Markdown this package writes, read as GFM reads it: its plain text,
 * and which emphasis, strong, and strikethrough markers pair. The Markdown comes from a
 * small, known set of constructs, so reading it is exact rather than a general Markdown
 * parse. Markers pair by CommonMark's flanking rules and its rule of three, as micromark
 * applies them, emphasis and strikethrough each resolved in the order micromark resolves
 * them; inline math, which GFM does not have, is read as a span.
 * @module src/render/read-inline
 */
import { literalEnd } from './bare-url.js';
import {
  autolinkAt,
  codeSpanAt,
  codeSpanCloser,
  ESCAPABLE,
  pairBrackets,
  unescapedDollar,
} from './scan.js';

/**
 * How CommonMark classes the character beside a delimiter run. Like micromark, it reads
 * one UTF-16 unit, so half of a surrogate pair is neither space nor punctuation, and the
 * text's ends count as space.
 */
export type CharClass = 'other' | 'punctuation' | 'space';

const SPACE = /^\s$/;
const PUNCTUATION = /^[\p{P}\p{S}]$/u;

/** The class of `char`, one UTF-16 unit or empty at the text's ends. */
export function charClass(char: string): CharClass {
  if (!char || SPACE.test(char)) return 'space';
  return PUNCTUATION.test(char) ? 'punctuation' : 'other';
}

/**
 * The side of the run from `start` to `end` that holds a letter, digit, or other
 * non-punctuation character while the other side holds punctuation: the shape that keeps
 * a run to one role. With a word before it (`a*(`) it can only close; with a word after it
 * (`)*b`) it can only open.
 */
export function wordSide(
  markdown: string,
  start: number,
  end: number,
): 'after' | 'before' | undefined {
  const before = charClass(markdown.charAt(start - 1));
  const after = charClass(markdown.charAt(end));
  if (before === 'other' && after === 'punctuation') return 'before';
  return after === 'other' && before === 'punctuation' ? 'after' : undefined;
}

/** A run of `*` or `~` markers, what it paired with, and how many are left once pairs are removed. */
export interface DelimiterRun {
  /** It is right-flanking (for `*`, also when a `~` comes before it), so it can close a pair. */
  canClose: boolean;
  /** It is left-flanking (for `*`, also when a `~` comes after it), so it can open a pair. */
  canOpen: boolean;
  char: '*' | '~';
  /** How many of its markers closed pairs: its first ones. Those that open pairs are its last. */
  closed: number;
  left: number;
  length: number;
  /** Each run it paired with, by where that run starts, and how many markers the two paired. */
  partners: Map<number, number>;
  /** Its index among the output pieces. */
  piece: number;
  /** Where it starts in the Markdown. */
  start: number;
}

/** What reading inline Markdown gives: its plain text, and every delimiter run with what is left of it. */
export interface InlineReading {
  /** Each inline formula's first and last `$`, each mapped to the other. */
  math: Map<number, number>;
  runs: DelimiterRun[];
  text: string;
}

/** Where inline markup can start, or a link's text end. */
const SPECIAL = /[\\`$<![\]*~]/g;

/** How {@link readInline} pairs markers. */
export interface ReadOptions {
  /**
   * Pair runs as the pieces this package joins meant them, not as GFM reads them: a run
   * opens where no space follows it and closes where none comes before it, the rule of
   * three does not apply, and a run of an even number of tildes pairs two at a time with
   * any other. Only the runs' pairs mean anything then, not the text.
   */
  intended?: boolean;
  /**
   * Runs, by where they start, to read as able to open and close, as a run with a word on
   * one side and punctuation on the other ({@link wordSide}) can once the punctuation
   * stands on the other side of it.
   */
  unstick?: ReadonlySet<number>;
}

/**
 * Inline Markdown this package emits, read left to right in one pass. In the text, code
 * span content comes out as written, and inline math with its dollars; a link and an
 * autolink leave their text; a backslash escape leaves its character; emphasis, strong,
 * and strikethrough markers are removed in pairs, and one with no partner stays.
 *
 * A link's text is read in place, its brackets paired beforehand by `pairBrackets` with
 * inline math read as a span, as here and as `link` balances them, and its emphasis pairs
 * only within it. Nothing read inside a link's text reaches past the text's end, so links
 * nested any depth cost no more than their length. Each run's `partners` say which runs it
 * pairs with ({@link ReadOptions} changes how).
 */
export function readInline(
  markdown: string,
  { intended = false, unstick }: ReadOptions = {},
): InlineReading {
  const out: string[] = [];
  /** Every delimiter run, to write back once paired. */
  const runs: DelimiterRun[] = [];
  const math = new Map<number, number>();
  /** The runs of the text around the read position, the innermost link's last. */
  const scopes: DelimiterRun[][] = [[]];
  /** The links whose text is being read, innermost last. */
  const links: LinkAt[] = [];
  const codeSpanEnd = codeSpanCloser(markdown);
  const { pairs } = pairBrackets(markdown, { skipMath: true });
  let mathCloses = true;
  /**
   * Which kind GFM resolves first across the text: emphasis (`*`, `_`) or strikethrough
   * (`~`), whichever run it reads first, and where the last autolink literal read for an
   * underscore ends.
   */
  let first: '*' | '~' | undefined;
  let literalFrom = 0;
  /** The next underscore at or after where the text was last read for one, found once. */
  let underscore = -1;
  /** Read the text from `from` to `to` for an underscore GFM reads as an emphasis run. */
  const readUnderscores = (from: number, to: number) => {
    while (!first) {
      if (underscore < from) underscore = markdown.indexOf('_', Math.max(from, literalFrom));
      if (underscore === -1) underscore = markdown.length;
      if (underscore >= to) return;
      if (links.length > 0) {
        first = '*';
      } else if (underscore < literalFrom) {
        underscore = markdown.indexOf('_', literalFrom);
      } else {
        const end = literalEnd(markdown, underscore, literalFrom);
        if (end === -1) first = '*';
        else literalFrom = end;
      }
    }
  };
  let at = 0;
  const special = new RegExp(SPECIAL);
  for (let found = special.exec(markdown); found; found = special.exec(markdown)) {
    const start = found.index;
    if (start > at) {
      out.push(markdown.slice(at, start));
      if (!first) readUnderscores(at, start);
    }
    const limit = links.at(-1)?.close ?? markdown.length;
    const char = found[0];
    let end = start + 1;
    if (char === '\\') {
      const escaped = markdown.charAt(start + 1);
      if (ESCAPABLE.test(escaped)) end = start + 2;
      out.push(end > start + 1 ? escaped : char);
    } else if (char === '`') {
      const span = codeSpanAt(markdown, start, codeSpanEnd);
      if (span.content === undefined || span.end > limit) {
        while (markdown.charAt(end) === '`') end++;
        out.push(markdown.slice(start, end));
      } else {
        out.push(unpad(span.content));
        end = span.end;
      }
    } else if (char === '$') {
      const close = mathCloses ? unescapedDollar(markdown, start + 1) : -1;
      if (close === -1) mathCloses = false;
      if (close > start + 1 && close < limit) {
        end = close + 1;
        math.set(start, close).set(close, start);
        first ??= firstRunInMath(markdown, start + 1, close);
      }
      out.push(markdown.slice(start, end));
    } else if (char === '<') {
      const autolink = autolinkAt(markdown, start);
      if (autolink && autolink.end <= limit) {
        end = autolink.end;
        out.push(autolink.target);
      } else {
        out.push(char);
      }
    } else if (char === '*' || char === '~') {
      while (markdown.charAt(end) === char) end++;
      // GFM reads a run of three or more tildes as text.
      if (char === '*' || end - start <= 2 || (intended && (end - start) % 2 === 0)) {
        if (char === '*' || end - start <= 2) first ??= char;
        const run = delimiterRun(markdown, start, end, out.length, intended);
        if (unstick?.has(start)) run.canOpen = run.canClose = true;
        runs.push(run);
        scopes.at(-1)?.push(run);
      }
      out.push(markdown.slice(start, end));
    } else if (char === ']') {
      const link = links.at(-1);
      if (link?.close === start) {
        // The link's text ends: its emphasis is paired, strikethrough first, and its destination dropped.
        links.pop();
        pairScope(scopes.pop() ?? [], intended, '~');
        end = link.end;
      } else {
        out.push(char);
      }
    } else {
      // `[` opens a link, and `!` before one is dropped with it.
      const open = char === '!' ? start + 1 : start;
      const link = linkAt(markdown, open, pairs, limit);
      if (link) {
        links.push(link);
        scopes.push([]);
        end = open + 1;
      } else {
        out.push(char);
      }
    }
    at = end;
    special.lastIndex = end;
  }
  out.push(markdown.slice(at));
  for (const scope of scopes) pairScope(scope, intended, first ?? '*');
  for (const run of runs) out[run.piece] = run.char.repeat(run.left);
  return { math, runs, text: out.join('') };
}

/**
 * The kind of the first emphasis or strikethrough run in the inline math from `from` to
 * `to`, which GFM, having no math, reads as text: an unescaped `*` or `_`, or a run of one
 * or two `~`.
 */
function firstRunInMath(markdown: string, from: number, to: number): '*' | '~' | undefined {
  for (let at = from; at < to; at++) {
    const char = markdown.charAt(at);
    if (char === '\\' && ESCAPABLE.test(markdown.charAt(at + 1))) at++;
    else if (char === '*' || char === '_') return '*';
    else if (char === '~') {
      let end = at + 1;
      while (markdown.charAt(end) === '~') end++;
      if (end - at <= 2) return '~';
      at = end - 1;
    }
  }
  return undefined;
}

/**
 * The run of `*` or `~` from `start` to `end`, flanked as micromark flanks it: it can open
 * when no space follows it and, if punctuation does, space or punctuation comes before it;
 * it can close in the mirror case. Read as `intended`, only the space counts.
 */
function delimiterRun(
  markdown: string,
  start: number,
  end: number,
  piece: number,
  intended: boolean,
): DelimiterRun {
  const char = markdown.charAt(start) === '*' ? '*' : '~';
  const beforeChar = markdown.charAt(start - 1);
  const afterChar = markdown.charAt(end);
  const before = charClass(beforeChar);
  const after = charClass(afterChar);
  const canOpen = intended
    ? after !== 'space'
    : after === 'other' || (after === 'punctuation' && before !== 'other');
  const canClose = intended
    ? before !== 'space'
    : before === 'other' || (before === 'punctuation' && after !== 'other');
  return {
    canClose: canClose || (char === '*' && beforeChar === '~'),
    canOpen: canOpen || (char === '*' && afterChar === '~'),
    char,
    closed: 0,
    left: end - start,
    length: end - start,
    partners: new Map(),
    piece,
    start,
  };
}

/**
 * Pair the runs of one span's text as micromark resolves them: every run of the `first`
 * kind across the text, then the other kind's runs, each only with runs that the same
 * innermost pair of the `first` kind encloses (or that none does). Read as `intended`
 * ({@link ReadOptions}), both kinds pair together, as the pieces nest.
 */
function pairScope(runs: readonly DelimiterRun[], intended: boolean, first: '*' | '~'): void {
  if (intended) {
    pairRuns(runs, true);
    return;
  }
  pairRuns(
    runs.filter((run) => run.char === first),
    false,
  );
  for (const group of enclosedGroups(runs, first)) pairRuns(group, false);
}

/**
 * The runs not of the `first` kind, grouped by the innermost pair of that kind enclosing
 * them, those no pair encloses as one group. Pairs nest, so a run of the `first` kind
 * closes the innermost open pairs, one per partner before it (its `partners` list those
 * first), and opens one pair per partner after it.
 */
function enclosedGroups(runs: readonly DelimiterRun[], first: '*' | '~'): DelimiterRun[][] {
  const unenclosed: DelimiterRun[] = [];
  const groups = [unenclosed];
  /** The groups of the pairs open at the read position, innermost last. */
  const open: DelimiterRun[][] = [];
  for (const run of runs) {
    if (run.char !== first) {
      (open.at(-1) ?? unenclosed).push(run);
      continue;
    }
    for (const partner of run.partners.keys()) {
      if (partner < run.start) {
        open.pop();
        continue;
      }
      const group: DelimiterRun[] = [];
      groups.push(group);
      open.push(group);
    }
  }
  return groups;
}

/**
 * Pair the runs as micromark pairs them. A run that can close takes from the nearest open
 * run of its character that it may pair with — for `*`, two at a time at most, unless the
 * rule of three bars the pair; for `~`, one of the same length, whole — and the runs
 * between them can no longer pair outside. Whatever is left of a run that can open waits
 * for a closer. A closer that finds no partner marks how far down its kind of search
 * need not look again, so each run is looked at a bounded number of times. Read as
 * `intended` ({@link ReadOptions}), no rule of three bars a pair, and even tilde runs pair
 * two at a time.
 */
function pairRuns(runs: readonly DelimiterRun[], intended: boolean): void {
  const open: DelimiterRun[] = [];
  /** For each kind of closer ({@link closerKind}), the depth below which no opener pairs with it. */
  const floors = new Array<number>(8).fill(0);
  for (const run of runs) {
    while (run.canClose && run.left > 0) {
      const kind = closerKind(run, intended);
      const floor = floors[kind] ?? 0;
      let at = open.length - 1;
      while (at >= floor && !pairsWith(open[at], run, intended)) at--;
      const opener = open[at];
      if (at < floor || !opener) {
        floors[kind] = open.length;
        break;
      }
      const used =
        run.char === '~'
          ? evenTildes(opener, run, intended)
            ? 2
            : run.left
          : opener.left > 1 && run.left > 1
            ? 2
            : 1;
      opener.left -= used;
      run.left -= used;
      run.closed += used;
      opener.partners.set(run.start, (opener.partners.get(run.start) ?? 0) + used);
      run.partners.set(opener.start, (run.partners.get(opener.start) ?? 0) + used);
      open.length = opener.left > 0 ? at + 1 : at;
      // An opener left with fewer markers may pair where the rule of three barred it before.
      for (let i = 0; i < floors.length; i++) floors[i] = Math.min(floors[i] ?? 0, at);
    }
    if (run.left > 0 && run.canOpen) open.push(run);
  }
}

/** True when, read as `intended`, both tilde runs have an even number left: they pair two at a time. */
function evenTildes(opener: DelimiterRun, closer: DelimiterRun, intended: boolean): boolean {
  return intended && opener.left % 2 === 0 && closer.left % 2 === 0;
}

/**
 * Which closers find the same openers barred: for `*`, by whether it can open and its
 * length left modulo three, which the rule of three weighs; for `~`, by its length, or
 * read as `intended`, by whether that length is even.
 */
function closerKind(run: DelimiterRun, intended: boolean): number {
  if (run.char === '~') return 5 + (intended && run.left % 2 === 0 ? 2 : run.left);
  return (run.canOpen ? 3 : 0) + (run.left % 3);
}

/** True when `closer` may take from `opener`. */
function pairsWith(
  opener: DelimiterRun | undefined,
  closer: DelimiterRun,
  intended: boolean,
): boolean {
  if (opener?.char !== closer.char) return false;
  if (closer.char === '~')
    return opener.left === closer.left || evenTildes(opener, closer, intended);
  return (
    intended ||
    !(
      (opener.canClose || closer.canOpen) &&
      closer.left % 3 !== 0 &&
      (opener.left + closer.left) % 3 === 0
    )
  );
}

/** A code span's content without the space padding both of its sides. */
function unpad(content: string): string {
  return content.startsWith(' ') && content.endsWith(' ') && content.trim() !== ''
    ? content.slice(1, -1)
    : content;
}

/** A link being read: where its text ends, at its `]`, and where its destination does. */
interface LinkAt {
  close: number;
  end: number;
}

/**
 * A link `[text](destination)` whose `[` is at `start` and which ends by `limit`: its
 * text runs to the `]` `pairs` pairs with that `[`, and its destination, which holds no
 * parentheses (a written URL has them percent-encoded), to the next parenthesis.
 */
function linkAt(
  markdown: string,
  start: number,
  pairs: ReadonlyMap<number, number>,
  limit: number,
): LinkAt | undefined {
  const close = pairs.get(start);
  if (close === undefined || markdown.charAt(close + 1) !== '(') return;
  const parenthesis = /[()]/g;
  parenthesis.lastIndex = close + 2;
  const end = parenthesis.exec(markdown);
  if (end?.[0] !== ')' || end.index >= limit) return;
  return { close, end: end.index + 1 };
}
