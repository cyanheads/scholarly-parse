/**
 * @fileoverview A JATS fragment with no article around it — a Crossref abstract
 * (`<jats:p>…</jats:p>`, namespace prefix included) or a Europe PMC abstract snippet —
 * as Markdown.
 * @module src/formats/jats/fragment
 */
import { createDiagnostics } from '../../model/diagnostics.js';
import { createGridBudget } from '../../model/table-grid.js';
import { escapeBlockStart, escapeInline } from '../../render/escape.js';
import { renderBlocks } from '../../render/markdown.js';
import { childrenOf, collapseWhitespace, parseOrderedXml } from '../../xml/ordered.js';
import { flowBlocks } from './blocks.js';
import type { JatsContext } from './context.js';

/** Fragments larger than this are not abstracts; they are returned as escaped text. */
const MAX_FRAGMENT_CHARS = 1_000_000;

/** JATS 1.3 and MathML element names, which are case-sensitive. */
const KNOWN_TAGS: ReadonlySet<string> = new Set(
  `abbrev abbrev-journal-title abstract access-date ack addr-line address aff aff-alternatives
  alt-text alt-title alternatives annotation anonymous answer answer-set app app-group array
  article article-categories article-id article-meta article-title article-version
  article-version-alternatives attrib author-comment author-notes award-desc award-group award-id
  award-name back bio block-alternatives bold boxed-text break caption chapter-title chem-struct
  chem-struct-wrap citation-alternatives city code col colgroup collab collab-alternatives comment
  compound-kwd compound-kwd-part compound-subject compound-subject-part conf-acronym conf-date
  conf-loc conf-name conf-num conf-sponsor conf-theme conference contrib contrib-group contrib-id
  copyright-holder copyright-statement copyright-year corresp count country counts custom-meta
  custom-meta-group data-title date date-in-citation day def def-head def-item def-list degrees
  disp-formula disp-formula-group disp-quote edition element-citation elocation-id email
  equation-count era etal event event-desc explanation ext-link extended-by fax fig fig-count
  fig-group fixed-case floats-group fn fn-group fpage front front-stub funding-group
  funding-source funding-statement given-names glossary glyph-data glyph-ref gov graphic history
  hr index-term index-term-range-end inline-formula inline-graphic inline-media
  inline-supplementary-material institution institution-id institution-wrap isbn issn issn-l
  issue issue-id issue-part issue-sponsor issue-title issue-title-group italic journal-id
  journal-meta journal-subtitle journal-title journal-title-group kwd kwd-group label license
  license-p list list-item long-desc lpage media meta-name meta-value milestone-end
  milestone-start mixed-citation monospace month name name-alternatives named-content nested-kwd
  nlm-citation note notes object-id on-behalf-of open-access overline overline-end
  overline-start p page-count page-range part-title patent permissions person-group phone
  postal-code prefix preformat price principal-award-recipient principal-investigator
  private-char processing-meta product pub-date pub-date-not-available pub-history pub-id
  publisher publisher-loc publisher-name question question-preamble question-wrap
  question-wrap-group rb ref ref-count ref-list related-article related-object resource-group
  resource-id resource-name resource-wrap response restricted-by role roman rp rt ruby
  sans-serif sc season sec sec-meta self-uri series series-text series-title sig sig-block size
  source speaker speech state statement std std-organization strike string-conf string-date
  string-name styled-content sub sub-article subj-group subject subtitle suffix sup supplement
  supplementary-material support-description support-group support-source surname table
  table-count table-wrap table-wrap-foot table-wrap-group target tbody td term term-head
  tex-math textual-form tfoot th thead title title-group trans-abstract trans-source
  trans-subtitle trans-title trans-title-group tr underline underline-end underline-start
  unstructured-kwd-group uri verse-group verse-line version volume volume-id volume-issue-group
  volume-series word-count wbr x xref year

  math maction maligngroup malignmark menclose merror mfenced mfrac mglyph mi mlabeledtr
  mlongdiv mmultiscripts mn mo mover mpadded mphantom mprescripts mroot mrow ms mscarries
  mscarry msgroup msline mspace msqrt msrow mstack mstyle msub msubsup msup mtable mtd mtext mtr
  munder munderover none semantics annotation-xml`.split(/\s+/),
);

/** HTML element names, matched in any case: legacy abstracts write `<I>` and `<SUP>`. */
const HTML_TAGS: ReadonlySet<string> = new Set(
  `a abbr area article aside audio b base bdi bdo big blockquote body br button canvas center
  cite data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure
  font footer form h1 h2 h3 h4 h5 h6 head header hgroup html i iframe img input ins kbd legend
  li link main map mark menu meta meter nav noscript object ol optgroup option output p param
  picture pre progress q s samp script search section select slot small span strong style sub
  summary sup svg table tbody td template textarea tfoot th thead time tr track tt u ul var
  video`.split(/\s+/),
);

/** True for a known element name, with or without a namespace prefix (`mml:mi`). */
function isKnownTag(name: string): boolean {
  const local = name.slice(name.indexOf(':') + 1);
  return KNOWN_TAGS.has(local) || HTML_TAGS.has(local.toLowerCase());
}

/**
 * The opening of something shaped like a tag: `<` or `</` and a name, as the XML reader
 * reads one (`_` and `:` may start it), that ends at whitespace, `/`, or `>`.
 */
const TAG_OPENING = /<\/?([A-Za-z_:\u00C0-\uFFFF][\w.:\u00B7\u00C0-\uFFFF-]*)(?=[\s/>])/y;

/**
 * The `>` closing a tag shape's rest, a quoted value read whole (`href="a>b"`); -1 when a
 * `<` comes first, inside a quoted value or not, or the text ends. Stopping at the next
 * `<` keeps the fallback linear: no attempt reads past where the next one starts.
 */
function tagShapeEnd(text: string, from: number): number {
  let quote = '';
  for (let i = from; i < text.length; i++) {
    const char = text[i];
    if (char === '<') return -1;
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return i;
    }
  }
  return -1;
}

/**
 * The fallback's reading of a tag shape: a tag when its name is known and what follows
 * the name is nothing, a `/`, or attributes with values, so `<time to event>` in running
 * text stays text.
 */
function isTag(name: string, rest: string): boolean {
  const attributes = rest.trim();
  return isKnownTag(name) && (attributes === '' || attributes === '/' || attributes.includes('='));
}

/** `source` with each {@link isTag} tag replaced by a space. */
function withoutTags(source: string): string {
  let out = '';
  let copied = 0;
  let at = source.indexOf('<');
  while (at !== -1) {
    TAG_OPENING.lastIndex = at;
    const name = TAG_OPENING.exec(source)?.[1];
    const restStart = TAG_OPENING.lastIndex;
    const end = name === undefined ? -1 : tagShapeEnd(source, restStart);
    if (name === undefined || end === -1) {
      at = source.indexOf('<', at + 1);
      continue;
    }
    if (isTag(name, source.slice(restStart, end))) {
      out += `${source.slice(copied, at)} `;
      copied = end + 1;
    }
    at = source.indexOf('<', end + 1);
  }
  return out + source.slice(copied);
}

/** One attribute, `name="value"` or `name='value'`. */
const ATTRIBUTE = /[A-Za-z_:][\w.:-]*\s*=\s*(?:"[^"]*"|'[^']*')/y;

/**
 * True when `rest`, what follows a start tag's name, is attributes, each after whitespace,
 * then an optional `/`. Read one attribute at a time: a regex repeating a group over them
 * backtracks through every one when the last fails.
 */
function isStartTagRest(rest: string): boolean {
  let at = 0;
  for (;;) {
    const spaceStart = at;
    while (/\s/.test(rest.charAt(at))) at++;
    if (at === rest.length) return true;
    if (rest.charAt(at) === '/') return at === rest.length - 1;
    if (at === spaceStart) return false;
    ATTRIBUTE.lastIndex = at;
    if (!ATTRIBUTE.test(rest)) return false;
    at = ATTRIBUTE.lastIndex;
  }
}

/** Where a comment, CDATA section, or processing instruction ends, by how it opens. */
const SKIPPED: readonly (readonly [string, string])[] = [
  ['<!--', '-->'],
  ['<![CDATA[', ']]>'],
  ['<?', '?>'],
];

/**
 * True when a start tag in `source` (outside comments, CDATA sections, and processing
 * instructions) has more after its name than {@link isStartTagRest} allows:
 * fast-xml-parser reads `<https://example.org/>` as an empty element and drops it.
 */
function hasMalformedStartTag(source: string): boolean {
  let at = source.indexOf('<');
  while (at !== -1) {
    const skipped = SKIPPED.find(([open]) => source.startsWith(open, at));
    if (skipped) {
      const close = source.indexOf(skipped[1], at + skipped[0].length);
      if (close === -1) return false;
      at = source.indexOf('<', close + skipped[1].length);
      continue;
    }
    TAG_OPENING.lastIndex = at;
    const opening = TAG_OPENING.exec(source);
    const end =
      opening && source.charAt(at + 1) !== '/' ? tagShapeEnd(source, TAG_OPENING.lastIndex) : -1;
    if (end !== -1 && !isStartTagRest(source.slice(TAG_OPENING.lastIndex, end))) return true;
    at = source.indexOf('<', Math.max(end, at) + 1);
  }
  return false;
}

/** A known tag's opener behind `<!--`, as Crossref writes `<!--inline-formula>`. */
const COMMENTED_TAG = /<!--([A-Za-z][\w:.-]*)>/g;

/**
 * Markdown for a JATS fragment: paragraphs separated by blank lines, inline markup
 * converted. The `jats:` namespace prefix Crossref uses is accepted, and a known tag's
 * opener written behind `<!--` (Crossref's unclosed `<!--inline-formula>`) is removed
 * before the parse, so it opens no comment. HTML headings read as a `<title>`, and
 * `<br/>` as a `<break/>`. Input that does not parse as XML, or holds a start tag whose
 * attributes are not `name="value"` pairs (`<https://example.org/>`), is returned as
 * escaped text with the known tags removed, HTML ones in any case, so text that only looks
 * like a tag (`<or= 20`, `<Actinopterygii>`) stays; a start that would open a block
 * (`1. `, `# `) is escaped too.
 */
export function jatsInlineToMarkdown(fragment: string): string {
  const source = fragment
    .replace(/<(\/?)jats:/g, '<$1')
    .replace(COMMENTED_TAG, (opener, name: string) => (isKnownTag(name) ? '' : opener));
  const plain = () => escapeBlockStart(escapeInline(collapseWhitespace(withoutTags(source))));
  if (source.length > MAX_FRAGMENT_CHARS || hasMalformedStartTag(source)) return plain();
  const tree = parseOrderedXml(`<fragment>${source}</fragment>`);
  if ('error' in tree) return plain();
  const ctx: JatsContext = {
    diag: createDiagnostics(),
    footnotes: [],
    gridBudget: createGridBudget(),
    noteOwners: new Map(),
    sectionIds: new Set(),
  };
  try {
    return renderBlocks(flowBlocks(childrenOf(tree.nodes[0]), ctx));
  } catch {
    // Whatever in the fragment breaks the reader, its text still reads.
    return plain();
  }
}
