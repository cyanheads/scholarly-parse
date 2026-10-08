/**
 * @fileoverview Where GFM links a bare URL (an autolink literal: `https://…`, `http://…`,
 * `www.…`) in Markdown, read as micromark's GFM extension reads it, so the escaping can
 * tell whether a backslash or a marker it writes would land inside one.
 * @module src/render/bare-url
 */

/** Characters a URL gives back to the text around it when only such characters follow, up to a space, `<`, or the end. */
const TRAIL = new Set(['!', '"', "'", ')', '*', ',', '.', ':', ';', '?', '_', '~']);

/** Characters at which a URL's path checks whether the rest is a trail it gives back. */
const PATH_TRAIL = new Set([...TRAIL, '&', '<', ']']);

/** Characters after which `www.` can start a URL. */
const BEFORE_WWW = new Set(['', '(', '*', '_', '[', ']', '~', ' ', '\t', '\n', '\r']);

const PROTOCOL = /https?:\/\//iy;
const WWW = /www\./iy;
const ASCII_ALPHA = /^[A-Za-z]$/;
const SPACE = /^\s$/;
const PUNCTUATION = /^[\p{P}\p{S}]$/u;

/**
 * True when a URL starts at `start` of `text`: `http://` or `https://` not right after an
 * ASCII letter, or `www.` at the start or after a space, `(`, `[`, `]`, or an emphasis
 * marker. Brackets around the start are the caller's to weigh: GFM links no bare URL
 * inside a link's text.
 */
export function bareUrlStarts(text: string, start: number): boolean {
  const before = text.charAt(start - 1);
  if (/[Hh]/.test(text.charAt(start))) {
    PROTOCOL.lastIndex = start;
    return !ASCII_ALPHA.test(before) && PROTOCOL.test(text);
  }
  WWW.lastIndex = start;
  return BEFORE_WWW.has(before) && WWW.test(text) && WWW.lastIndex < text.length;
}

/**
 * The end of the URL GFM links at `start` of `text`, where {@link bareUrlStarts} holds,
 * or -1 when what follows is no domain. The URL runs to a space or `<`, less any trailing
 * punctuation, an unbalanced `)`, or a character reference (`&amp;`) at its end. Reading
 * stops at `limit`: a URL that runs on past it ends at `limit + 1`. Each character is read
 * a bounded number of times.
 */
export function bareUrlEnd(text: string, start: number, limit = text.length): number {
  PROTOCOL.lastIndex = start;
  const protocol = PROTOCOL.test(text);
  const domainStart = protocol ? PROTOCOL.lastIndex : start;
  if (protocol) {
    const first = text.charAt(domainStart);
    if (!first || first < ' ' || first === '\u007f' || SPACE.test(first) || PUNCTUATION.test(first))
      return -1;
  }
  const trail = trailReader(text);
  let at = domainStart;
  let seen = false;
  let underscoreInLast = false;
  let underscoreInLastButOne = false;
  for (let c = text.charAt(at); ; c = text.charAt(at)) {
    if (c === '.' || c === '_') {
      if (trail(at)) break;
      if (c === '_') {
        underscoreInLast = true;
      } else {
        underscoreInLastButOne = underscoreInLast;
        underscoreInLast = false;
      }
    } else if (!c || SPACE.test(c) || (c !== '-' && PUNCTUATION.test(c))) {
      break;
    } else {
      seen = true;
    }
    at++;
  }
  if (!seen || underscoreInLast || underscoreInLastButOne) return -1;
  let opened = 0;
  let closed = 0;
  for (let c = text.charAt(at); c && !SPACE.test(c); c = text.charAt(at)) {
    if (at === limit) return PATH_TRAIL.has(c) && trail(at) ? at : limit + 1;
    if (c === '(') {
      opened++;
    } else if (c === ')' && closed < opened) {
      closed++;
    } else if (PATH_TRAIL.has(c)) {
      if (trail(at)) break;
      if (c === ')') closed++;
    }
    at++;
  }
  return at;
}

/** Where a bare URL can start, for a search. */
const URL_START = /https?:\/\/|www\./gi;

/** A character an email literal's local part holds. */
const ATEXT = /^[A-Za-z0-9+\-._]$/;

/** A character an email literal's domain holds, besides its dots. */
const DOMAIN = /^[A-Za-z0-9\-_]$/;

const ALPHANUMERIC = /^[A-Za-z0-9]$/;

/**
 * The end of the autolink literal GFM forms around `at` in `text`, outside link text — a
 * bare URL ({@link bareUrlEnd}) or an email address — or -1 when none holds it. A literal
 * starts no earlier than `from`, where the last one GFM formed ends, and no earlier than
 * the space or `<` before `at`, so only that stretch is read back.
 */
export function literalEnd(text: string, at: number, from = 0): number {
  let wordStart = at;
  while (
    wordStart > from &&
    !SPACE.test(text.charAt(wordStart - 1)) &&
    text.charAt(wordStart - 1) !== '<'
  )
    wordStart--;
  const start = new RegExp(URL_START);
  start.lastIndex = wordStart;
  for (let found = start.exec(text); found && found.index <= at; found = start.exec(text)) {
    if (!bareUrlStarts(text, found.index)) continue;
    const end = bareUrlEnd(text, found.index);
    if (end > at) return end;
    if (end !== -1) start.lastIndex = end;
  }
  return emailEnd(text, at, wordStart);
}

/**
 * The end of the email literal GFM forms around `at`, starting no earlier than `from`, or
 * -1: a local part of {@link ATEXT} characters after anything but such a character or a
 * `/`, an `@`, and a domain of {@link DOMAIN} characters holding a dot that an alphanumeric
 * follows, ending in a letter.
 */
function emailEnd(text: string, at: number, from: number): number {
  let atSign = at;
  while (ATEXT.test(text.charAt(atSign))) atSign++;
  if (text.charAt(atSign) !== '@') {
    let domain = at;
    while (
      domain > from &&
      (DOMAIN.test(text.charAt(domain - 1)) || text.charAt(domain - 1) === '.')
    )
      domain--;
    if (domain === from || text.charAt(domain - 1) !== '@') return -1;
    atSign = domain - 1;
  }
  let local = atSign;
  while (local > from && ATEXT.test(text.charAt(local - 1))) local--;
  const before = text.charAt(local - 1);
  if (local === atSign || before === '/' || ATEXT.test(before)) return -1;
  let end = atSign + 1;
  let dot = false;
  for (;;) {
    const c = text.charAt(end);
    if (c === '.' && ALPHANUMERIC.test(text.charAt(end + 1))) dot = true;
    else if (!DOMAIN.test(c)) break;
    end++;
  }
  return dot && /[A-Za-z]/.test(text.charAt(end - 1)) && end > at ? end : -1;
}

/**
 * A reader of `text` answering whether the characters from a position on are a trail a URL
 * gives back: trailing punctuation and character references up to a space, `<`, or the
 * end, or a `]` before one of those or `(` or `[`. A trail that fails fails from every
 * position up to where it failed, so that stretch is not read again.
 */
function trailReader(text: string): (from: number) => boolean {
  let failedBefore = -1;
  return (from) => {
    if (from < failedBefore) return false;
    let at = from;
    for (;;) {
      const c = text.charAt(at);
      if (TRAIL.has(c)) {
        at++;
      } else if (c === '&') {
        let end = at + 1;
        while (ASCII_ALPHA.test(text.charAt(end))) end++;
        if (end === at + 1 || text.charAt(end) !== ';') break;
        at = end + 1;
      } else if (c === ']') {
        at++;
        const next = text.charAt(at);
        if (!next || next === '(' || next === '[' || SPACE.test(next)) return true;
      } else {
        if (!c || c === '<' || SPACE.test(c)) return true;
        break;
      }
    }
    failedBefore = at;
    return false;
  };
}
