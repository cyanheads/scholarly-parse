/**
 * @fileoverview Builders for inline Markdown that every format parser shares, so a
 * superscript, a link, or an inline formula reads the same whether it came from JATS,
 * TEI, or HTML.
 * @module src/render/inline
 */
import {
  bareUrlReader,
  codeSpan,
  escapeAutolink,
  escapeInline,
  escapeTex,
  escapeText,
  escapeUrl,
  isSafeUrl,
  oddBackslashesBefore,
} from './escape.js';
import { charClass, type DelimiterRun, readInline, wordSide } from './read-inline.js';
import {
  autolinkAt,
  codeSpanAt,
  codeSpanCloser,
  ESCAPABLE,
  insertBackslashes,
  pairBrackets,
} from './scan.js';

/**
 * Wrap already-rendered Markdown in an emphasis marker (`*`, `**`, `~~`). Whitespace at
 * the edges moves outside the markers, where CommonMark requires it, and empty content
 * renders as itself. The edges are found by trimming, which reads each end once; a
 * backslash the trim leaves at the end is escaped, so it does not escape the closer. A
 * marker between punctuation inside and a word outside cannot open or close;
 * `joinInlineSeams` repairs that once the text beside it is known.
 */
export function emphasis(markdown: string, marker: string): string {
  const core = markdown.trim();
  if (!core) return markdown;
  const lead = markdown.length - markdown.trimStart().length;
  const rest = markdown.slice(lead + core.length);
  return `${markdown.slice(0, lead)}${marker}${closeBackslash(core)}${marker}${rest}`;
}

/** `markdown` with an odd backslash run at its end escaped, so it escapes nothing after it. */
function closeBackslash(markdown: string): string {
  let backslashes = 0;
  while (markdown.charAt(markdown.length - 1 - backslashes) === '\\') backslashes++;
  return backslashes % 2 === 1 ? `${markdown}\\` : markdown;
}

/**
 * Two or more citation numbers joined by commas or dashes (`12,13`, `4–7`). A single
 * number is left alone: `10<sup>5</sup>` is an exponent, not a citation.
 */
const CITATION_RUN = /^\d+(?:\s*[,‒–—-]\s*\d+)+$/;

/**
 * A superscript. Citation numbers become a bracketed marker (`[12,13]`), so they do not
 * fuse with the word before them; anything else uses TeX-style notation (`10^{-5}`,
 * `x^2`) that stays readable as plain text. A marker's text is escaped like any source
 * text, a backslash the trim leaves at the end is escaped, so it escapes nothing after the
 * script, and a bare URL that ends a group is written as a link ({@link scriptGroup}).
 *
 * `isCitation` is the parser's judgment that the superscript holds only citation links;
 * an unlinked run of several citation numbers is recognized from its text.
 */
export function superscript(markdown: string, plain: string, isCitation: boolean): string {
  const text = plain.trim();
  if (!text) return '';
  if (isCitation || CITATION_RUN.test(text)) {
    return `[${escapeInline(text.replace(/^\[|\]$/g, '').replace(/\s+/g, ''))}]`;
  }
  return [...text].length === 1
    ? `^${closeBackslash(markdown.trim())}`
    : `^{${scriptGroup(markdown)}}`;
}

/** A subscript in TeX-style notation: `CO_2`, `IC_{50}`, a group as {@link superscript} writes one. */
export function subscript(markdown: string, plain: string): string {
  const text = plain.trim();
  if (!text) return '';
  return [...text].length === 1
    ? `_${closeBackslash(markdown.trim())}`
    : `_{${scriptGroup(markdown)}}`;
}

/**
 * A sub- or superscript group's content, its bare URL at the end written as a link: GFM
 * would read the group's closing `}` as part of the URL. Read as markup after it, the brace
 * (a backtick standing in for it here) makes `repairSeams` write the URL as a link.
 */
function scriptGroup(markdown: string): string {
  const content = closeBackslash(markdown.trim());
  return BARE_URL_START.test(content) ? repairSeams(`${content}\``).slice(0, -1) : content;
}

/**
 * A link. An unsafe scheme (`javascript:`, `data:`) renders as its text only, or as the
 * target as escaped text when there is none; a link whose text is its own URL, as written
 * or as `escapeInline` writes it, renders as an autolink. A bracket in the text with no
 * partner, or in a pair a `(` follows, is escaped, and so is a backslash the trim leaves at
 * its end, so the link's own brackets enclose the whole text; a link the text holds is
 * written as its text: links do not nest.
 */
export function link(markdown: string, url: string | undefined): string {
  const target = url?.trim();
  if (!target || !isSafeUrl(target)) return markdown || escapeInline(target ?? '');
  const text = markdown.trim();
  if (!text || text === target || text === escapeInline(target))
    return `<${escapeAutolink(target)}>`;
  const label = joinTouchingCode(unlinkText(joinTouchingCode(text)));
  return `[${closeBackslash(escapeUnpaired(label))}](${escapeUrl(target)})`;
}

/**
 * `markdown` with its touching code spans joined as {@link joinInlineSeams} joins them, so
 * link text reads its code spans, and the links and brackets between them, as the finished
 * text will. A link written as its text can leave two spans touching, so `link` joins again
 * after.
 */
function joinTouchingCode(markdown: string): string {
  if (!markdown.includes('`')) return markdown;
  const out: string[] = [];
  const codeSpanEnd = codeSpanCloser(markdown);
  const touchingCode = touchingCodeReader(markdown);
  const special = /[\\`<]/g;
  let at = 0;
  for (let found = special.exec(markdown); found; found = special.exec(markdown)) {
    const start = found.index;
    let end = start + 1;
    if (found[0] === '\\') {
      if (ESCAPABLE.test(markdown.charAt(end))) end++;
    } else if (found[0] === '<') {
      end = autolinkAt(markdown, start)?.end ?? end;
    } else {
      const touching = touchingCode(start);
      if (touching) {
        out.push(markdown.slice(at, start), codeSpan(touching.text));
        at = end = touching.end;
      } else {
        end = codeSpanAt(markdown, start, codeSpanEnd).end;
      }
    }
    special.lastIndex = end;
  }
  out.push(markdown.slice(at));
  return out.join('');
}

/**
 * Link text with a backslash before each bracket that {@link pairBrackets} leaves unpaired,
 * and before both brackets of a pair a `(` follows: in link text such a pair can only be
 * text that spells a link once the links in it are written as text, and links do not nest.
 * Brackets inside inline math are TeX, so they are left as written.
 */
function escapeUnpaired(markdown: string): string {
  const { pairs, unpaired } = pairBrackets(markdown, { skipMath: true });
  const linkLike = [...pairs].filter(([, close]) => markdown.charAt(close + 1) === '(').flat();
  return insertBackslashes(
    markdown,
    [...unpaired, ...linkLike].sort((a, b) => a - b),
  );
}

/** What can start or end a link inside link text, or a span read past. */
const LINK_IN_TEXT = /[\\`<[\]]/g;

/**
 * Link text with each autolink in it written as its URL as text, and each link `link`
 * writes (`escapeInline`'s links for bare `www.` URLs among them) as its text. A link
 * inside link text keeps the outer one from forming, which leaves the outer destination
 * as text that GFM can link as a bare URL running into what follows; and GFM links no
 * bare URL inside link text, so the explicit links that keep one from taking in an escape
 * elsewhere are not needed there.
 */
function unlinkText(markdown: string): string {
  const codeSpanEnd = codeSpanCloser(markdown);
  const { pairs } = pairBrackets(markdown, { skipMath: true });
  /** The `]` of each link being written as its text, and where its destination ends. */
  const destinations = new Map<number, number>();
  const special = new RegExp(LINK_IN_TEXT);
  let out = '';
  let at = 0;
  for (let found = special.exec(markdown); found; found = special.exec(markdown)) {
    const start = found.index;
    let end = start + 1;
    let text: string | undefined;
    switch (found[0]) {
      case '\\':
        if (ESCAPABLE.test(markdown.charAt(end))) end++;
        break;
      case '`':
        end = codeSpanAt(markdown, start, codeSpanEnd).end;
        break;
      case '<': {
        const autolink = autolinkAt(markdown, start);
        if (autolink) {
          end = autolink.end;
          text = escapeText(autolink.target);
        }
        break;
      }
      case '[': {
        const close = pairs.get(start);
        if (close === undefined || markdown.charAt(close + 1) !== '(') break;
        LINK_DESTINATION.lastIndex = close + 2;
        if (!LINK_DESTINATION.test(markdown)) break;
        destinations.set(close, LINK_DESTINATION.lastIndex);
        text = '';
        break;
      }
      default: {
        const destinationEnd = destinations.get(start);
        if (destinationEnd === undefined) break;
        end = destinationEnd;
        text = '';
      }
    }
    if (text !== undefined) {
      out += markdown.slice(at, start) + text;
      at = end;
    }
    special.lastIndex = end;
  }
  return out + markdown.slice(at);
}

/**
 * Where a formula stands that the source publishes only as an image: its content is not
 * in the text, and the marker keeps the sentence around it from reading as complete.
 */
export const FORMULA_IMAGE = '[formula]';

/** Inline math: `$tex$`. Empty TeX renders nothing. */
export function inlineMath(tex: string): string {
  const expression = tex.replace(/\s+/g, ' ').trim();
  return expression ? `$${escapeTex(expression, { inline: true })}$` : '';
}

/** What can start a seam to repair, a span the seam pass leaves alone, or a bare URL. */
const SEAM = /[\\`<$[\]]|https?:\/\/|www\./gi;

/**
 * A destination `link` writes: a URL with a scheme it allows, as `escapeUrl` writes it, then
 * the closing parenthesis. `escapeUrl` leaves no space, parenthesis, angle bracket, or
 * backtick, writes every `$` as `\$`, and writes a backslash before punctuation only as `\\`
 * or before `&` or `$`; a destination that runs into a code span, an autolink, or a formula
 * another piece wrote is none it writes.
 */
const LINK_DESTINATION =
  /(?:https?|ftp|mailto):(?:[^\s()<>`$\\]|\\[\\&$]|\\(?![!-/:-@[-`{-~]))*\)/iy;

/**
 * Inline Markdown assembled from separately escaped pieces, with the seams between them
 * repaired: the escaping of each piece cannot see what the next one adds.
 *
 * - Touching inline formulas join into one (`$a$$b$` would read as a display-math
 *   delimiter), with a space where the TeX at the joint would open an HTML tag or a link,
 *   as `escapeTex` writes it, or where a control word (`\alpha`) would take in the letters
 *   after it. Source text never yields `$$` (its dollar signs are escaped), so every `$$`
 *   is such a seam.
 * - Touching code spans join into one (`touchingCodeReader`): their fences would meet as
 *   one run that closes neither.
 * - A `](` that `link` did not write, one not followed by a web or mail destination as
 *   `escapeUrl` writes one, is escaped, so no link forms with any other destination, nor
 *   one that runs into a code span, autolink, or formula written after it.
 * - A bare URL that an escape, a marker, or a link after it would join is written as an
 *   explicit link to the URL as the source has it (`bareUrlReader`), unless it stands inside
 *   link text, where GFM links no bare URL.
 * - A `!` before a link is escaped, so the link does not read as an image.
 * - Two emphasis, strong, or strikethrough spans of one kind that touch, whose markers GFM
 *   reads as one run, join into one span ({@link joinTouchingSpans}): `**K****-step**`
 *   becomes `**K-step**`.
 * - An emphasis, strong, or strikethrough pair that cannot form because punctuation at
 *   the emphasized text's edge meets a word outside the marker is repaired
 *   ({@link repairStuckMarkers}): the punctuation moves outside the marker
 *   (`*daf-16-*dependent` becomes `*daf-16*-dependent`), or, where that cannot work, the
 *   markers are dropped and the text kept.
 *
 * Code spans, autolinks, and link destinations are left as written, and a backslash
 * escapes only the one character after it, so an escaped backslash escapes nothing. A
 * joint or a repair can put a character GFM starts a bare URL after before a `www.`
 * (`x*-www.` becomes `x-*www.`), and the backslash before a `](` can meet the bare URL
 * that ends there (`https://a.co/x\](`), so the seams are read again wherever the text
 * changed. The text is read once, plus once more when it holds a `![`, up to four times
 * more when spans touch, up to four times more when a marker stands between punctuation
 * and a word, and once more after any change.
 */
export function joinInlineSeams(markdown: string): string {
  const joined = repairSeams(markdown);
  const imaged = joined.includes('![') ? escapeImageOpeners(joined) : joined;
  const repaired = repairStuckMarkers(joinTouchingSpans(imaged));
  return repaired !== markdown ? repairSeams(repaired) : repaired;
}

/** The seams of `markdown` repaired, as {@link joinInlineSeams} lists them, up to its image openers and stuck markers. */
function repairSeams(markdown: string): string {
  const out: string[] = [];
  const codeSpanEnd = codeSpanCloser(markdown);
  const touchingCode = touchingCodeReader(markdown);
  const bareUrlAt = bareUrlReader(markdown, linkOpeners(markdown));
  const seam = new RegExp(SEAM);
  /** The `[` GFM has read and not yet closed: no bare URL links inside one. */
  let labels = 0;
  let at = 0;
  for (let found = seam.exec(markdown); found; found = seam.exec(markdown)) {
    const start = found.index;
    let end = start + 1;
    switch (found[0]) {
      case '\\':
        if (ESCAPABLE.test(markdown.charAt(end))) end++;
        break;
      case '`': {
        const touching = touchingCode(start);
        if (touching) {
          out.push(markdown.slice(at, start), codeSpan(touching.text));
          at = end = touching.end;
        } else {
          end = codeSpanAt(markdown, start, codeSpanEnd).end;
        }
        break;
      }
      case '<':
        end = autolinkAt(markdown, start)?.end ?? end;
        break;
      case '$':
        if (markdown.charAt(end) === '$') {
          out.push(markdown.slice(at, start), mathJoint(markdown, start));
          at = end = start + 2;
        }
        break;
      case '[':
        labels++;
        break;
      case ']':
        if (markdown.charAt(end) !== '(') {
          labels = Math.max(0, labels - 1);
          break;
        }
        LINK_DESTINATION.lastIndex = start + 2;
        if (!LINK_DESTINATION.test(markdown)) {
          out.push(markdown.slice(at, start), '\\');
          at = start;
        } else if (labels > 0) {
          labels--;
          end = LINK_DESTINATION.lastIndex;
        }
        break;
      default: {
        const url = labels === 0 ? bareUrlAt(start) : undefined;
        if (!url) break;
        if (url.written !== markdown.slice(start, url.end)) {
          out.push(markdown.slice(at, start), url.written);
          at = url.end;
        }
        end = url.end;
      }
    }
    seam.lastIndex = end;
  }
  out.push(markdown.slice(at));
  return out.join('');
}

/**
 * Where each link `link` writes opens: a `[` GFM pairs with a `]` that a web or mail
 * destination follows. Read only when the text holds a bare URL's start and a `[`.
 */
function linkOpeners(markdown: string): Set<number> {
  const openers = new Set<number>();
  if (!markdown.includes('[') || !BARE_URL_START.test(markdown)) return openers;
  for (const [open, close] of pairBrackets(markdown).pairs) {
    if (markdown.charAt(close + 1) !== '(') continue;
    LINK_DESTINATION.lastIndex = close + 2;
    if (LINK_DESTINATION.test(markdown)) openers.add(open);
  }
  return openers;
}

/** Where a bare URL can start. */
const BARE_URL_START = /https?:\/\/|www\./i;

/**
 * A reader of the code spans in `markdown` that touch, read as `inlineCode` writes them:
 * a span's fence is longer than any backtick run inside it, so it closes at the first run
 * at least as long. Where one span's closing fence and the next one's opening fence meet,
 * GFM reads them as one run that closes neither (`` `a``` `b` `` ``). Given where a span
 * opens, the reader returns, when that span touches the next, the text of the touching
 * spans joined, each as GFM reads a span's content, and where the last one ends. A run
 * whose first backtick a backslash escapes opens one backtick later, with one fewer. Each
 * fence is found once, and a span's closer by skipping runs too short to close it.
 */
function touchingCodeReader(
  markdown: string,
): (start: number) => { end: number; text: string } | undefined {
  const starts: number[] = [];
  const lengths: number[] = [];
  const index = new Map<number, number>();
  /** Runs whose first backtick is escaped, by where the rest of the run starts. */
  const escaped = new Map<number, number>();
  for (const { 0: run, index: start } of markdown.matchAll(/`+/g)) {
    index.set(start, starts.length);
    if (run.length > 1 && oddBackslashesBefore(markdown, start))
      escaped.set(start + 1, starts.length);
    starts.push(start);
    lengths.push(run.length);
  }
  /** For each run, the next one at least as long, or the run count. */
  const longer = new Array<number>(starts.length).fill(starts.length);
  const waiting: number[] = [];
  for (let i = 0; i < starts.length; i++) {
    while (waiting.length > 0 && (lengths[waiting.at(-1) ?? 0] ?? 0) <= (lengths[i] ?? 0))
      longer[waiting.pop() ?? 0] = i;
    waiting.push(i);
  }
  /** The first run after `after` at least `length` long. */
  const closer = (after: number, length: number) => {
    let at = after + 1;
    while (at < starts.length && (lengths[at] ?? 0) < length) at = longer[at] ?? starts.length;
    return at;
  };
  return (start) => {
    const unescaped = index.get(start);
    const first = unescaped ?? escaped.get(start);
    if (first === undefined) return;
    let fence = (lengths[first] ?? 0) - (unescaped === undefined ? 1 : 0);
    let run = first;
    let from = start + fence;
    const parts: string[] = [];
    for (;;) {
      const close = closer(run, fence);
      const closeStart = starts[close];
      const closeLength = lengths[close] ?? 0;
      if (closeStart === undefined) return;
      parts.push(unpadCode(markdown.slice(from, closeStart)));
      if (closeLength === fence)
        return run === first ? undefined : { end: closeStart + fence, text: parts.join('') };
      run = close;
      from = closeStart + closeLength;
      fence = closeLength - fence;
    }
  };
}

/** A code span's content as GFM reads it: one space off each end when both have one and it is not all spaces. */
function unpadCode(content: string): string {
  return content.startsWith(' ') && content.endsWith(' ') && content.trim() !== ''
    ? content.slice(1, -1)
    : content;
}

/**
 * Inline Markdown as one finished run: whitespace collapsed and trimmed, then the seams
 * between its separately escaped pieces repaired ({@link joinInlineSeams}).
 */
export function collapseInline(markdown: string): string {
  return joinInlineSeams(markdown.replace(/\s+/g, ' ').trim());
}

/**
 * What replaces the `$$` at `at` that joins two formulas: a space where the TeX on its two
 * sides would meet as `<` and a tag's first character, as `](`, or as a control word and
 * a letter, and nothing elsewhere.
 */
function mathJoint(markdown: string, at: number): string {
  const before = markdown.charAt(at - 1);
  const after = markdown.charAt(at + 2);
  return (before === '<' && /[A-Za-z/!?]/.test(after)) ||
    (before === ']' && after === '(') ||
    (ASCII_LETTER.test(after) && endsInControlWord(markdown, at))
    ? ' '
    : '';
}

const ASCII_LETTER = /^[A-Za-z]$/;

/**
 * True when the text before `end` ends in a TeX control word: ASCII letters after an odd
 * run of backslashes (`\alpha`; in `\\b` the backslashes are a control symbol, and `b` a
 * letter after it). Reads back only over that word, which no other joint reads.
 */
function endsInControlWord(markdown: string, end: number): boolean {
  let at = end;
  while (ASCII_LETTER.test(markdown.charAt(at - 1))) at--;
  if (at === end) return false;
  let backslashes = 0;
  while (markdown.charAt(at - 1 - backslashes) === '\\') backslashes++;
  return backslashes % 2 === 1;
}

/**
 * Markdown with a backslash before each `!` that would make the link after it an image,
 * its brackets paired as a renderer with math support pairs them or as one without does.
 * Every `](` left in it opens a destination `link` writes.
 */
function escapeImageOpeners(markdown: string): string {
  const bangs = new Set<number>();
  for (const skipMath of [false, true]) {
    for (const [open, close] of pairBrackets(markdown, { skipMath }).pairs) {
      if (markdown.charAt(close + 1) === '(' && markdown.charAt(open - 1) === '!') {
        let backslashes = 0;
        while (markdown.charAt(open - 2 - backslashes) === '\\') backslashes++;
        if (backslashes % 2 === 0) bangs.add(open - 1);
      }
    }
  }
  return insertBackslashes(
    markdown,
    [...bangs].sort((a, b) => a - b),
  );
}

/** Where two spans can touch: a `*` run of two or more, or a `~` run of four or more, with no space on either side. */
function mayTouch(markdown: string): boolean {
  for (const { 0: run, index } of markdown.matchAll(/\*+|~+/g)) {
    if (
      run.length >= (run.startsWith('*') ? 2 : 4) &&
      charClass(markdown.charAt(index - 1)) !== 'space' &&
      charClass(markdown.charAt(index + run.length)) !== 'space'
    )
      return true;
  }
  return false;
}

/** A run that closes one span and opens the next, and the outer pair on each side of it. */
interface TouchingSpans {
  closer: number;
  opener: number;
  run: DelimiterRun;
  /** How many of the run's markers the two outer pairs each give up: the smaller of the two. */
  used: number;
}

/**
 * Markdown with each two spans of one kind that touch joined into one. Their markers meet
 * as one run, which GFM cannot read as a closer and an opener: `**K****-step**` pairs `K`
 * and leaves `-step**`, and `*a**b*` emphasizes `a**b`. Read as the pieces meant them
 * (`readInline`'s `intended`), such a run closes the spans before it and opens those after
 * it; the outermost on each side give up as many markers as the smaller of them holds, so
 * `**K-step**`, `*ab*`, and `***a****b*` becomes `***a**b*`. Every character but the
 * dropped markers stays. A run GFM already pairs as meant is left alone, and so is every
 * run when a join would not pair the spans it joins or would leave more markers unpaired.
 */
function joinTouchingSpans(markdown: string): string {
  if (!mayTouch(markdown)) return markdown;
  const { runs } = readInline(markdown);
  const written = new Map(runs.map((run) => [run.start, run]));
  const joins: TouchingSpans[] = [];
  for (const run of readInline(markdown, { intended: true }).runs) {
    let opener = -1;
    let closer = -1;
    for (const other of run.partners.keys()) {
      if (other > run.start) closer = Math.max(closer, other);
      else if (opener === -1 || other < opener) opener = other;
    }
    if (opener === -1 || closer === -1 || samePairs(written.get(run.start), run)) continue;
    const used = Math.min(run.partners.get(opener) ?? 0, run.partners.get(closer) ?? 0);
    joins.push({ closer, opener, run, used });
  }
  if (joins.length === 0) return markdown;
  let out = '';
  let at = 0;
  /** Each joined run's start, and how many markers were dropped up to and in it. */
  const starts: number[] = [];
  const dropped: number[] = [];
  for (const { run, used } of joins) {
    out += markdown.slice(at, run.start) + run.char.repeat(run.length - 2 * used);
    at = run.start + run.length;
    starts.push(run.start);
    dropped.push((dropped.at(-1) ?? 0) + 2 * used);
  }
  out += markdown.slice(at);
  const moved = (position: number) => {
    let low = 0;
    let high = starts.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((starts[middle] ?? 0) < position) low = middle + 1;
      else high = middle;
    }
    return position - (dropped[low - 1] ?? 0);
  };
  const reread = readInline(out).runs;
  const now = new Map(reread.map((run) => [run.start, run]));
  const joined = joins.every(
    ({ closer, opener, used }) =>
      (now.get(moved(opener))?.partners.get(moved(closer)) ?? 0) >= used,
  );
  return joined && unpaired(reread) <= unpaired(runs) ? out : markdown;
}

/** True when `run` pairs with the same runs, by as many markers, in both readings. */
function samePairs(written: DelimiterRun | undefined, run: DelimiterRun): boolean {
  if (written?.partners.size !== run.partners.size) return false;
  for (const [other, used] of run.partners) if (written.partners.get(other) !== used) return false;
  return true;
}

/**
 * A pair of marker runs, or of parts of runs other pairs share, that a word beside one of
 * them keeps from forming, and its repair: how many characters at the emphasized text's
 * start move before the opener (`lead`) and at its end after the closer (`trail`), or
 * `drop` to write the text without the pair's markers.
 */
interface StuckPair {
  closer: DelimiterRun;
  drop: boolean;
  lead: number;
  opener: DelimiterRun;
  trail: number;
  /** How many markers the pair takes from each of its runs. */
  used: number;
}

/**
 * Markdown with each emphasis, strong, or strikethrough pair repaired that a word beside
 * one of its markers keeps from forming. A run with a word on one side and punctuation on
 * the other ({@link wordSide}) can take only one role: with a word before it, it cannot
 * open (`a**(x)**`); with a word after it, it cannot close (`*daf-16-*dependent`). There the
 * punctuation at the emphasized text's edge moves outside the marker, which then stands
 * between it and the text: `a(**x**)b`, `*daf-16*-dependent`. Every character is kept, in
 * the same order. An inline formula at the edge moves whole. Where the edge holds nothing
 * that can move, or nothing but punctuation is emphasized, or the moved markers still do
 * not pair, the pair's markers are dropped.
 *
 * A run can hold the markers of more than one pair (`**a *(b)***c`, where `***` closes
 * both). Punctuation moves across all of a run's closing markers, or all of its opening
 * ones, and a dropped pair takes only its own markers: `**Table 1*.***` becomes
 * `**Table 1.**`.
 *
 * Pairs form as GFM forms them once each run with that shape may take either role, and
 * are taken up starting from the runs that have no whole partner as written (GFM leaves
 * them unpaired, or they share one): each pair one of them is in, then the pairs the
 * written partners of either of its runs are in, and so on. Runs that pair whole with each
 * other as written, and that no such chain reaches, keep their pairs. A repair that would
 * break a pair GFM forms as written between runs no repair touches is not made, nor any
 * other.
 */
function repairStuckMarkers(markdown: string): string {
  const stuck = new Set<number>();
  for (const { 0: run, index } of markdown.matchAll(/\*+|~+/g)) {
    if (wordSide(markdown, index, index + run.length)) stuck.add(index);
  }
  if (stuck.size === 0) return markdown;
  const { math, runs } = readInline(markdown);
  const written = new Map(runs.map((run) => [run.start, run]));
  /** Runs whose pairing as written gives way, each reached once. */
  const reached = runs.filter((run) => !partnerOf(written, run));
  if (reached.length === 0) return markdown;
  const freed = new Map(
    readInline(markdown, { unstick: stuck }).runs.map((run) => [run.start, run]),
  );
  const seen = new Set(reached.map((run) => run.start));
  const pairs: StuckPair[] = [];
  /** For each opener a pair is taken up for, the closers it is taken up with. */
  const taken = new Map<number, Set<number>>();
  /** Runs a repair re-pairs. */
  const repaired = new Set<number>();
  // The loop also visits the runs it adds.
  for (const run of reached) {
    for (const [other, used] of freed.get(run.start)?.partners ?? []) {
      const self = freed.get(run.start);
      const partner = freed.get(other);
      if (!self || !partner || written.get(run.start)?.partners.get(other) === used) continue;
      const [opener, closer] = run.start < other ? [self, partner] : [partner, self];
      const closers = taken.get(opener.start) ?? new Set<number>();
      if (closers.has(closer.start)) continue;
      taken.set(opener.start, closers.add(closer.start));
      const pair = stuckPair(markdown, math, opener, closer, used);
      if (!pair) continue;
      pairs.push(pair);
      for (const member of [opener, closer]) {
        repaired.add(member.start);
        for (const given of written.get(member.start)?.partners.keys() ?? []) {
          const givenRun = written.get(given);
          if (givenRun && !seen.has(given)) {
            seen.add(given);
            reached.push(givenRun);
          }
        }
      }
    }
  }
  if (pairs.length === 0) return markdown;
  const moves = pairs.filter((pair) => !pair.drop);
  let result: { markdown: string; runs: readonly DelimiterRun[] } | undefined;
  if (moves.length > 0) {
    const moved = applyRepairs(markdown, moves);
    const movedRuns = readInline(moved).runs;
    const reread = new Map(movedRuns.map((run) => [run.start, run]));
    const at = markerRuns(movedRuns);
    const edges = runRepairs(moves);
    for (const pair of moves) {
      const { lead } = edges.get(pair.opener.start) ?? { lead: 0 };
      const { trail } = edges.get(pair.closer.start) ?? { trail: 0 };
      // Moves keep the length, so a run's closing markers start where its trail begins.
      const opener = at.get(pair.opener.start + pair.opener.closed + lead);
      const closer = at.get(pair.closer.start - trail);
      if (!opener || !closer || (opener.partners.get(closer.start) ?? 0) < pair.used)
        pair.drop = true;
    }
    // Moves keep the length, so runs no repair touches start where they did.
    for (const run of written.values()) {
      const partner = partnerOf(written, run);
      if (!partner || repaired.has(run.start) || repaired.has(partner.start)) continue;
      if (partnerOf(reread, run)?.start !== partner.start) return markdown;
    }
    if (!pairs.some((pair) => pair.drop)) result = { markdown: moved, runs: movedRuns };
  }
  if (!result) {
    const dropped = applyRepairs(markdown, pairs);
    result = { markdown: dropped, runs: readInline(dropped).runs };
  }
  // Dropping markers can change how the runs beside them flank.
  return unpaired(result.runs) <= unpaired(runs) ? result.markdown : markdown;
}

/** Each marker character's position mapped to the run it is in. */
function markerRuns(runs: readonly DelimiterRun[]): Map<number, DelimiterRun> {
  const at = new Map<number, DelimiterRun>();
  for (const run of runs) for (let i = 0; i < run.length; i++) at.set(run.start + i, run);
  return at;
}

/** How many marker characters `runs` leave without a partner. */
function unpaired(runs: readonly DelimiterRun[]): number {
  return runs.reduce((sum, run) => sum + run.left, 0);
}

/**
 * The run `run` pairs with whole in `runs`, where each run is the other's only partner and
 * both are used up; undefined where it has none, or shares one.
 */
function partnerOf(
  runs: ReadonlyMap<number, DelimiterRun>,
  run: DelimiterRun,
): DelimiterRun | undefined {
  const self = runs.get(run.start);
  if (self?.left !== 0 || self.partners.size !== 1) return;
  const [start] = self.partners.keys();
  const partner = runs.get(start ?? -1);
  return partner?.left === 0 && partner.partners.size === 1 ? partner : undefined;
}

/**
 * The repair of the pair `opener`…`closer`, which takes `used` markers from each: the edge
 * punctuation each blocked marker moves past, or `drop` when a blocked marker has none to
 * move past, when the moves would empty the emphasized text, or when a marker would come
 * to touch another run of its character. Undefined when neither marker is blocked: the
 * pair fails because of another pair.
 */
function stuckPair(
  markdown: string,
  math: ReadonlyMap<number, number>,
  opener: DelimiterRun,
  closer: DelimiterRun,
  used: number,
): StuckPair | undefined {
  const blockedOpener = wordSide(markdown, opener.start, opener.start + opener.length) === 'before';
  const blockedCloser = wordSide(markdown, closer.start, closer.start + closer.length) === 'after';
  if (!blockedOpener && !blockedCloser) return;
  const from = opener.start + opener.length;
  const to = closer.start;
  const lead = blockedOpener ? leadingEdge(markdown, math, from, to) : 0;
  const trail = blockedCloser ? trailingEdge(markdown, math, from + lead, to) : 0;
  const drop =
    (blockedOpener && (lead === 0 || markdown.charAt(from + lead) === opener.char)) ||
    (blockedCloser && (trail === 0 || markdown.charAt(to - trail - 1) === closer.char)) ||
    from + lead >= to - trail;
  return { closer, drop, lead, opener, trail, used };
}

/**
 * Punctuation a marker does not move past: markup this package writes (markers, code,
 * math, autolinks, links, an image's `!`), an entity's `&`, and the `_`, `^`, and braces
 * of sub- and superscripts. A backslash moves only with the character it escapes, and a
 * `$` only with the formula it opens or closes.
 */
const STAYS = new Set(['*', '~', '`', '$', '<', '>', '[', ']', '!', '&', '\\', '_', '^', '{', '}']);

/** True when the character at `at` can move across a marker: whitespace, or punctuation not in {@link STAYS}, nor a `)` that ends a link. */
function movable(markdown: string, at: number): boolean {
  const char = markdown.charAt(at);
  const kind = charClass(char);
  if (kind === 'space') return true;
  return kind === 'punctuation' && !STAYS.has(char) && !(char === ')' && endsLink(markdown, at));
}

const PARENTHESIS_OR_SPACE = /^[()\s]$/;

/**
 * True when the `)` at `at` ends a link's destination: a `](` comes before it with
 * nothing but a destination's characters between. Reads back only over that destination,
 * which holds no parenthesis, so no other `)` reads the same stretch.
 */
function endsLink(markdown: string, at: number): boolean {
  let open = at - 1;
  while (open >= 0 && !PARENTHESIS_OR_SPACE.test(markdown.charAt(open))) open--;
  if (markdown.charAt(open) !== '(' || markdown.charAt(open - 1) !== ']') return false;
  let backslashes = 0;
  while (markdown.charAt(open - 2 - backslashes) === '\\') backslashes++;
  return backslashes % 2 === 0;
}

/**
 * How many characters from `from` on, before `to`, can move before an opener at `from`. A
 * backslash escape moves whole, and so does an inline formula right at the edge (`math`
 * maps each one's first `$` to its last); past moved punctuation, the marker can stand
 * beside a formula's `$`.
 */
function leadingEdge(
  markdown: string,
  math: ReadonlyMap<number, number>,
  from: number,
  to: number,
): number {
  let at = from;
  while (at < to) {
    const char = markdown.charAt(at);
    const formulaEnd = char === '$' ? (math.get(at) ?? at) : at;
    if (char === '\\') {
      if (!ESCAPABLE.test(markdown.charAt(at + 1))) break;
      at += 2;
    } else if (at === from && formulaEnd > at && formulaEnd < to) {
      at = formulaEnd + 1;
    } else if (movable(markdown, at)) {
      at++;
    } else {
      break;
    }
  }
  return at - from;
}

/**
 * How many characters before `to`, after `from`, can move after a closer at `to`. A
 * backslash escape moves whole, with any escaped backslashes before it, and so does an
 * inline formula right at the edge.
 */
function trailingEdge(
  markdown: string,
  math: ReadonlyMap<number, number>,
  from: number,
  to: number,
): number {
  let at = to;
  while (at > from) {
    const char = markdown.charAt(at - 1);
    const formulaStart = char === '$' ? (math.get(at - 1) ?? at) : at;
    let backslashes = 0;
    while (at - 2 - backslashes >= from && markdown.charAt(at - 2 - backslashes) === '\\')
      backslashes++;
    if (char === '\\' || (backslashes % 2 === 1 && ESCAPABLE.test(char))) {
      // Escaped backslashes, or a character a backslash escapes: what comes after a run
      // of backslashes is never escaped by an odd one, or the marker would be.
      at -= backslashes + 1;
    } else if (at === to && formulaStart < at - 1 && formulaStart >= from) {
      at = formulaStart;
    } else if (movable(markdown, at - 1)) {
      at--;
    } else {
      break;
    }
  }
  return to - at;
}

/** What a run's pairs ask of it: punctuation to move across its markers, and markers to drop. */
interface RunRepair {
  /** Markers dropped from those that close pairs. */
  closing: number;
  /** Characters after the run that move before its opening markers. */
  lead: number;
  /** Markers dropped from those that open pairs. */
  opening: number;
  run: DelimiterRun;
  /** Characters before the run that move after its closing markers. */
  trail: number;
}

/** Each run the pairs are in, by where it starts, with what its pairs ask of it. */
function runRepairs(pairs: readonly StuckPair[]): Map<number, RunRepair> {
  const repairs = new Map<number, RunRepair>();
  const of = (run: DelimiterRun) => {
    const repair = repairs.get(run.start) ?? { closing: 0, lead: 0, opening: 0, run, trail: 0 };
    repairs.set(run.start, repair);
    return repair;
  };
  for (const { closer, drop, lead, opener, trail, used } of pairs) {
    if (drop) {
      of(opener).opening += used;
      of(closer).closing += used;
    } else {
      of(opener).lead = Math.max(of(opener).lead, lead);
      of(closer).trail = Math.max(of(closer).trail, trail);
    }
  }
  return repairs;
}

/**
 * `markdown` with each pair's repair written: its edge punctuation moved across its runs'
 * opening or closing markers, or its markers dropped. Moves never overlap: punctuation
 * moves only up to the next run, and a pair whose emphasized text is all such punctuation
 * is dropped, not moved.
 */
function applyRepairs(markdown: string, pairs: readonly StuckPair[]): string {
  const edits = [...runRepairs(pairs).values()].sort((a, b) => a.run.start - b.run.start);
  let out = '';
  let at = 0;
  for (const { closing, lead, opening, run, trail } of edits) {
    const start = run.start - trail;
    const end = run.start + run.length;
    out +=
      markdown.slice(at, start) +
      run.char.repeat(run.closed - closing) +
      markdown.slice(start, run.start) +
      markdown.slice(end, end + lead) +
      run.char.repeat(run.length - run.closed - opening);
    at = end + lead;
  }
  return out + markdown.slice(at);
}

/** Inline code. */
export function inlineCode(text: string): string {
  return text ? codeSpan(text) : '';
}
