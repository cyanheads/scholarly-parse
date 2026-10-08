/**
 * @fileoverview arXiv IDs as the model holds them, in arXiv's preferred external form: a
 * new-style `YYMM.NNNNN` or an old-style `archive/YYMMNNN` without the subject class an
 * old-style ID may carry (`math.GT/0309136` → `math/0309136`), with any version the
 * source prints kept (`2105.00001v2`). One grammar serves every format: the LaTeXML,
 * HTML, and PDF references read the ID an `arXiv` label, an arxiv.org link, or an
 * old-style form in an entry's text gives, the LaTeXML watermark and page URL read the
 * paper's own ID here, and a field the source types as an arXiv ID (JATS `pub-id-type`
 * `arxiv`, TEI `<idno type="arXiv">`, HTML `citation_arxiv_id`) is read here too.
 * @module src/model/arxiv
 */

/**
 * The archives an old-style ID could name: every archive arXiv used before the April 2007
 * scheme change (`econ`, `eess`, `q-fin`, and `stat` started later), so a path-like
 * `and/1234567` is not read as one.
 */
const OLD_ARCHIVES: ReadonlySet<string> = new Set([
  'acc-phys',
  'adap-org',
  'alg-geom',
  'ao-sci',
  'astro-ph',
  'atom-ph',
  'bayes-an',
  'chao-dyn',
  'chem-ph',
  'cmp-lg',
  'comp-gas',
  'cond-mat',
  'cs',
  'dg-ga',
  'funct-an',
  'gr-qc',
  'hep-ex',
  'hep-lat',
  'hep-ph',
  'hep-th',
  'math',
  'math-ph',
  'mtrl-th',
  'nlin',
  'nucl-ex',
  'nucl-th',
  'patt-sol',
  'physics',
  'plasm-ph',
  'q-alg',
  'q-bio',
  'quant-ph',
  'solv-int',
  'supr-con',
]);

/**
 * An ID's shape before its parts are checked: a new-style `YYMM.NNNN(N)`, or an old-style
 * archive, optional two-letter subject class, `/`, and `YYMMNNN`; then an optional
 * version. A digit right after the number is not part of an ID.
 */
const ID_SHAPE = String.raw`(?:\d{4}\.\d{4,5}|[a-z]+(?:-[a-z]+)?(?:\.[a-z]{2})?\/\d{7})(?!\d)(?:v\d+)?`;

/**
 * An exact ID, its parts captured: new-style YYMM and number, or archive, YYMM, and serial;
 * then the version, which arXiv numbers from 1.
 */
const ID_PARTS =
  /^(?:(\d{4})\.(\d{4,5})|([a-z]+(?:-[a-z]+)?)(?:\.[A-Z]{2})?\/(\d{4})(\d{3}))(?:[vV]([1-9]\d*))?$/;

/**
 * A field typed as an arXiv ID: an optional `arXiv` label, the ID or a link to it, and an
 * optional bracketed subject class (`arXiv:1706.03762 [cs.CL]`, as arXiv prints a
 * citation and Grobid keeps it). Anchored, and the body stops at whitespace or a bracket,
 * so a value is read in one pass.
 */
const FIELD = /^(?:arxiv(?:\s*:\s*|\s+))?([^\s[\]]+)(?:\s*\[[^\]]*\])?$/i;

/**
 * Where an ID starts in running text: after an `arXiv` label (`arXiv:`, `arXiv `,
 * `arXiv :`), even one a PDF's text runs into the word before it (`preprintarXiv:`), after
 * an arxiv.org `/abs/` or `/pdf/` path, or bare, where nothing that continues a word or a
 * path comes before it. A bare ID counts only in the old style (see {@link arxivInText}).
 */
const IN_TEXT = new RegExp(
  String.raw`(?:arxiv(?:\s{0,8}:\s{0,8}|\s{1,8})|(?<![\w-])arxiv\.org\/(?:abs|pdf)\/|(?<![\w./-]))(${ID_SHAPE})`,
  'gi',
);

/** A web link: its host, its path's first segment, and the rest of the path. */
const WEB_URL = /^(?:https?:)?\/\/([^/?#]*)\/(\w+)\/([^?#]*)/i;

/** arxiv.org or ar5iv.org, or a subdomain of either, with an optional port. */
const ARXIV_HOST = /(?:^|\.)(?:arxiv|ar5iv)\.org(?::\d+)?$/i;

/**
 * `value` as an arXiv ID in the model's form, when the whole of it is one: a new-style ID
 * whose month exists and whose number has the four digits of 0704–1412 or the five from
 * 1501, or an old-style ID whose archive arXiv used before April 2007 and whose YYMM falls
 * in 9107–0703, its subject class dropped. A version is kept, and must be `v1` or later.
 * Undefined otherwise.
 */
export function arxivId(value: string): string | undefined {
  const parts = ID_PARTS.exec(value);
  if (!parts) return;
  const [, newYymm, number, archive, oldYymm, serial, versionNumber] = parts;
  const version = versionNumber === undefined ? '' : `v${versionNumber}`;
  if (newYymm !== undefined && number !== undefined) {
    const yymm = Number(newYymm);
    const month = yymm % 100;
    const digits = yymm >= 704 && yymm <= 1412 ? 4 : yymm >= 1501 ? 5 : 0;
    return month >= 1 && month <= 12 && number.length === digits
      ? `${newYymm}.${number}${version}`
      : undefined;
  }
  if (!archive || !oldYymm || !serial || !OLD_ARCHIVES.has(archive)) return;
  const month = Number(oldYymm.slice(2));
  const year = Number(oldYymm.slice(0, 2));
  const inRange = year >= 91 ? Number(oldYymm) >= 9107 : Number(oldYymm) <= 703;
  return month >= 1 && month <= 12 && inRange
    ? `${archive}/${oldYymm}${serial}${version}`
    : undefined;
}

/**
 * The arXiv ID a link to a paper names in its `/abs/` or `/pdf/` path on arxiv.org,
 * ar5iv.org, or a subdomain of either (`https://arxiv.org/pdf/2105.00001v1.pdf` →
 * `2105.00001v1`, `https://export.arxiv.org/abs/hep-th/9711200`), read as
 * {@link arxivId} reads one. A link to any other host or path, or whose path holds more
 * than the ID, names none.
 */
export function arxivFromUrl(url: string | undefined): string | undefined {
  return idInPath(url, /^(?:abs|pdf)$/i);
}

/**
 * A field the source types as an arXiv ID, as the model holds it: the ID read as
 * {@link arxivId} reads one, or the one an arxiv.org link names, without an `arXiv`
 * label or a bracketed subject class after it (`arXiv:math.GT/0309136v1 [math.GT]` →
 * `math/0309136v1`, `https://arxiv.org/abs/2105.00001v3` → `2105.00001v3`). Undefined
 * for anything else (`pending`, `n/a`, `hep-th/0805123`), so every format reads the same
 * value from the same field.
 */
export function normalizeArxiv(value: string | undefined): string | undefined {
  const [, body = ''] = FIELD.exec(value?.trim() ?? '') ?? [];
  return arxivId(body) ?? arxivFromUrl(body);
}

/**
 * The arXiv ID of the page a LaTeXML render was served at: an arxiv.org or ar5iv
 * `/html/` or `/abs/` URL (`https://ar5iv.labs.arxiv.org/html/math.GT/0309136` →
 * `math/0309136`), read as {@link arxivId} reads one.
 */
export function arxivFromPageUrl(url: string | undefined): string | undefined {
  return idInPath(url, /^(?:abs|html)$/i);
}

/** The ID an arxiv.org or ar5iv.org URL names after a first path segment `kind` matches. */
function idInPath(url: string | undefined, kind: RegExp): string | undefined {
  const [, host = '', segment = '', path = ''] = WEB_URL.exec(url?.trim() ?? '') ?? [];
  return ARXIV_HOST.test(host) && kind.test(segment)
    ? arxivId(path.replace(/\/$/, '').replace(/\.pdf$/i, ''))
    : undefined;
}

/**
 * The first arXiv ID in `text`, read as {@link arxivId} reads one: after an `arXiv`
 * label in any case (`arXiv:hep-th/9711200`, `arXiv 1706.03762`), in an arxiv.org link
 * (`https://arxiv.org/abs/2105.00001v3`), or bare in the old style (`…, hep-th/9711200.`).
 * A bare new-style number (`1999.12345`) could be anything, so it needs the label or
 * link. Each candidate is read once, so the text is read in one pass.
 */
export function arxivInText(text: string): string | undefined {
  for (const { 0: whole, 1: candidate = '' } of text.matchAll(IN_TEXT)) {
    const bare = whole.length === candidate.length;
    if (bare && !candidate.includes('/')) continue;
    const id = arxivId(candidate);
    if (id) return id;
  }
  return;
}
