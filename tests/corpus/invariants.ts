/**
 * @fileoverview Properties every parsed document must have: in every format, its Markdown
 * and plain text read as written; in JATS, TEI, and LaTeXML, the model accounts for what
 * the source holds. Each check returns the problems it found, so one run reports every
 * broken invariant. Wild sampling (`scripts/corpus/sample.ts`) runs the same checks.
 * @module tests/corpus/invariants
 */
import type { ScholarlyDocument } from '../../src/model/document.js';
import { RESERVED_SECTION_ID } from '../../src/model/section-ids.js';
import { readInline } from '../../src/render/read-inline.js';
import { toSections } from '../../src/render/sections.js';
import { toText } from '../../src/render/text.js';
import { parseGfm } from '../gfm.js';
import { allSections, countBlocks } from './walk.js';

export interface InvariantInput {
  document: ScholarlyDocument;
  format: string;
  markdown: string;
  /** The source decoded as text; undefined for binary formats. */
  source: string | undefined;
}

/**
 * Markdown with fenced code, inline code, and math removed: what prose checks inspect.
 * Blockquote markers go first, so math and code inside a quoted box are found too.
 */
function prose(markdown: string): string {
  return markdown
    .replace(/^(?:> ?)+/gm, '')
    .replace(/^(`{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '')
    .replace(/^\$\$\n[\s\S]*?\n\$\$$/gm, '')
    .replace(/(`+)[^`]*?\1/g, '')
    .replace(/(?<!\\)\$[^$\n]+?(?<!\\)\$/g, '');
}

/** An unescaped source tag: `<italic>`, `</sec>`, `<mml:mi`. Autolinks do not match. */
const LEAKED_TAG = /(?<!\\)<\/?[a-z][\w-]*(?::[\w-]+)?(?=[\s>/])/i;
/** An entity reference that was never decoded. */
const LEAKED_ENTITY = /(?<!\\)&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/i;
const TEX_PREAMBLE = /\\documentclass|\\usepackage|\\begin\{document\}/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * Paths of model strings that are one of `tokens` — a missing value turned into text
 * (`"undefined"`, `"null"`, `"NaN"`) — or that contain an object coerced to a string.
 * The word "undefined" inside prose is legitimate and not flagged.
 */
function leakedValues(document: ScholarlyDocument, tokens: string[]): string[] {
  const found: string[] = [];
  const objectToken = tokens.includes('[object Object]');
  const visit = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      if (tokens.includes(value.trim()) || (objectToken && value.includes('[object Object]')))
        found.push(path);
    } else if (Array.isArray(value)) {
      for (const [i, item] of value.entries()) visit(item, `${path}[${i}]`);
    } else if (value !== null && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) visit(item, path ? `${path}.${key}` : key);
    }
  };
  visit(document, '');
  return found;
}

/** The first value that appears twice in `values`. */
function firstDuplicate(values: string[]): string | undefined {
  const seen = new Set<string>();
  return values.find((value) => seen.has(value) || !seen.add(value));
}

function count(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

// ── Plain text and Markdown structure ──────────────────────────────────────

/** Markers GFM reads as markup: strong or emphasis, the middle of a link, strikethrough. */
const MARKUP_MARKERS = ['**', '__', '](', '~~'] as const;

type GfmNode = ReturnType<typeof parseGfm> | ReturnType<typeof parseGfm>['children'][number];

/**
 * The text a reader sees in `markdown`, read by a CommonMark + GFM parser: every text,
 * code, and HTML value and image alt, as written, one per line. A marker in it is one the
 * Markdown escaped or wrote as text, never one the parser read as markup.
 */
function readerText(markdown: string): string {
  const values: string[] = [];
  const walk = (node: GfmNode) => {
    if ('value' in node) values.push(node.value);
    else if (node.type === 'image') values.push(node.alt ?? '');
    if ('children' in node) for (const child of node.children) walk(child);
  };
  walk(parseGfm(markdown));
  return values.join('\n');
}

/** A line's container prefix: blockquote markers and indentation. */
const CONTAINER_PREFIX = /^(?:> ?)*[ \t]*/;

/** One line of Markdown as its blocks read: a code or `$$` fence, a line inside either, or text. */
interface MarkdownLine {
  kind: 'code' | 'fence' | 'math' | 'text';
  line: string;
  /** The line's container prefix. */
  prefix: string;
  /** The line without its container prefix or trailing space. */
  rest: string;
}

/** Each line of `markdown` with its kind, and the fence of a block nothing closes. */
function readLines(markdown: string): { lines: MarkdownLine[]; unclosed?: string } {
  const lines: MarkdownLine[] = [];
  let block: string | undefined;
  for (const line of markdown.split('\n')) {
    const prefix = CONTAINER_PREFIX.exec(line)?.[0] ?? '';
    const rest = line.slice(prefix.length).trimEnd();
    let kind: MarkdownLine['kind'] = block === '$$' ? 'math' : block ? 'code' : 'text';
    if (block === undefined) {
      const fence = /^`{3,}/.exec(rest)?.[0] ?? (rest === '$$' ? rest : undefined);
      if (fence) [block, kind] = [fence, 'fence'];
    } else if (block === '$$' ? rest === '$$' : /^`+$/.test(rest) && rest.length >= block.length) {
      [block, kind] = [undefined, 'fence'];
    }
    lines.push({ kind, line, prefix, rest });
  }
  return { lines, ...(block && { unclosed: block }) };
}

/**
 * `markdown` with the TeX of every formula replaced by `m`, and the TeX it held. GFM has no
 * math, so it can pair the `**` or `__` of two formulas as emphasis (`$A^{**}$ … $B^{**}$`),
 * while `toText` keeps TeX as written; neither is markup left behind. Inline formulas are
 * found as `toText` reads them.
 */
function withoutMath(markdown: string): { markdown: string; tex: string } {
  const tex: string[] = [];
  const lines = readLines(markdown).lines.map(({ kind, line, prefix, rest }) => {
    if (kind === 'math') {
      tex.push(rest);
      return `${prefix}m`;
    }
    if (kind !== 'text') return line;
    let masked = '';
    let copied = 0;
    for (const [open, close] of readInline(line).math) {
      if (close < open) continue;
      tex.push(line.slice(open + 1, close));
      masked += `${line.slice(copied, open + 1)}m`;
      copied = close;
    }
    return masked + line.slice(copied);
  });
  return { markdown: lines.join('\n'), tex: tex.join('\n') };
}

/**
 * Markup `toText` left behind in `plain`: each marker it holds more often than the text a
 * reader sees in the Markdown does, TeX counted as written. A marker the Markdown escaped
 * is text in both, so only one GFM reads as markup and plain text kept is counted.
 */
function markupInText(plain: string, markdown: string): string[] {
  const { markdown: masked, tex } = withoutMath(markdown);
  const read = readerText(masked);
  const occurrences = (text: string, marker: string) => text.split(marker).length - 1;
  return MARKUP_MARKERS.flatMap((marker) => {
    const kept = occurrences(plain, marker);
    const held = occurrences(read, marker) + occurrences(tex, marker);
    return kept > held
      ? [`toText holds ${kept} \`${marker}\` where the Markdown's text holds ${held}`]
      : [];
  });
}

/** A pipe that is not escaped: one after an even number of backslashes, or none. */
const CELL_PIPE = /(?<!\\)(?:\\\\)*\|/g;

/**
 * Markdown a GFM reader would misread: a pipe-table row with a cell count other than its
 * header's (GFM pads or cuts the row to fit, shifting what the reader sees), and a code
 * fence or `$$` block that nothing closes. Lines inside code and display math are content.
 */
function malformedMarkdown(markdown: string): string[] {
  const problems: string[] = [];
  const { lines, unclosed } = readLines(markdown);
  let header: number | undefined;
  for (const { kind, rest } of lines) {
    if (kind !== 'text' || !/^\|.*\|$/.test(rest)) {
      header = undefined;
      continue;
    }
    const cells = count(rest, CELL_PIPE) - 1;
    header ??= cells;
    if (cells !== header)
      problems.push(`a table row of ${cells} cells under a header of ${header}`);
  }
  if (unclosed)
    problems.push(unclosed === '$$' ? 'an unclosed $$ block' : 'an unclosed code fence');
  return problems;
}

// ── JATS source counts ─────────────────────────────────────────────────────

/**
 * `<fig>` elements the model must hold as figures. One with no label or caption whose
 * only file is a `<media>` (a review report's PDF) is parsed as a supplement. Each is
 * read up to the first `</fig>` after it, so a figure holding its own supplement figures
 * still counts once per `<fig>`.
 */
function sourceFigures(source: string): number {
  return [...source.matchAll(/<fig[\s>]/g)].filter((match) => {
    const element = source.slice(match.index, source.indexOf('</fig>', match.index));
    return /<(graphic|label|caption|alt-text)[\s>]/.test(element) || !element.includes('<media');
  }).length;
}

/**
 * Tables the model must hold: every `<table-wrap>`, and every `<array>` holding rows (a
 * `<table>`, or a `<tbody>` with no table around it).
 */
function sourceTables(source: string): number {
  const arrays = [...source.matchAll(/<array[\s>]/g)].filter((match) => {
    const element = source.slice(match.index, source.indexOf('</array>', match.index));
    return /<(table|tbody)[\s>]/.test(element);
  }).length;
  return count(source, /<table-wrap[\s>]/g) + arrays;
}

/**
 * `source` without Europe PMC's Associated Data digests, `<sec sec-type="associated-data">`,
 * which repeat files and citations the article already lists and the parser leaves out.
 */
function withoutAssociatedData(source: string): string {
  const digest = /<sec\s[^>]*\bsec-type="associated-data"/g;
  const secTag = /<(\/?)sec[\s>]/g;
  let out = '';
  let copied = 0;
  for (let open = digest.exec(source); open; open = digest.exec(source)) {
    out += source.slice(copied, open.index);
    copied = source.length;
    let depth = 0;
    secTag.lastIndex = open.index;
    for (let tag = secTag.exec(source); tag; tag = secTag.exec(source)) {
      depth += tag[1] ? -1 : 1;
      if (depth === 0) {
        copied = source.indexOf('>', tag.index) + 1;
        break;
      }
    }
    digest.lastIndex = copied;
  }
  return out + source.slice(copied);
}

/**
 * Files the model must hold as supplements, outside an Associated Data digest: every
 * `<supplementary-material>`, every `<fig>` whose only file is a `<media>`, and every
 * `<media>` inside neither.
 */
function sourceSupplements(source: string): number {
  const own = withoutAssociatedData(source);
  let open = 0;
  let bareMedia = 0;
  for (const [tag, closing, name] of own.matchAll(
    /<(\/?)(supplementary-material|fig|media)(?=[\s/>])[^>]*>/g,
  )) {
    if (name === 'media') {
      if (!closing && open === 0) bareMedia++;
    } else if (closing) {
      open--;
    } else if (!tag.endsWith('/>')) {
      open++;
    }
  }
  const mediaFigures = count(own, /<fig[\s>]/g) - sourceFigures(own);
  return count(own, /<supplementary-material[\s/>]/g) + mediaFigures + bareMedia;
}

// ── Text fused across a JATS boundary ──────────────────────────────────────

/**
 * Elements whose start or end separates the text on either side of it. Inline markup
 * (`<italic>`, `<sup>`, `<xref>`, MathML) is absent: it never separates.
 */
const SEPARATING: ReadonlySet<string> = new Set([
  'abstract',
  'aff',
  'app',
  'attrib',
  'boxed-text',
  'break',
  'caption',
  'contrib',
  'def',
  'def-item',
  'def-list',
  'disp-formula',
  'disp-quote',
  'element-citation',
  'fig',
  'fn',
  'given-names',
  'hr',
  'institution',
  'institution-id',
  'kwd',
  'label',
  'list',
  'list-item',
  'mixed-citation',
  'p',
  'ref',
  'sec',
  'surname',
  'table-wrap',
  'td',
  'term',
  'th',
  'title',
  'tr',
]);

type Token =
  | { closing: boolean; empty: boolean; kind: 'tag'; name: string }
  | { kind: 'text'; value: string };

const XML_ENTITIES: ReadonlyMap<string, string> = new Map(
  Object.entries({ amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' }),
);

/**
 * XML text with its predefined and numeric character references decoded. A reference to
 * U+0000, a surrogate, or past U+10FFFF reads as U+FFFD, as the parser reads it.
 */
function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (!body.startsWith('#')) return XML_ENTITIES.get(body) ?? whole;
    const point = /^#x/i.test(body)
      ? Number.parseInt(body.slice(2), 16)
      : Number.parseInt(body.slice(1), 10);
    const readable = point > 0 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff);
    return readable ? String.fromCodePoint(point) : '�';
  });
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  for (const match of source.matchAll(/<([^>]*)>|[^<]+/g)) {
    const inner = match[1];
    if (inner === undefined) {
      tokens.push({ kind: 'text', value: decodeEntities(match[0]) });
      continue;
    }
    const name = /^\/?([\w:.-]+)/.exec(inner)?.[1] ?? '';
    tokens.push({ closing: inner.startsWith('/'), empty: inner.endsWith('/'), kind: 'tag', name });
  }
  return tokens;
}

const WORD_END = /[\p{L}\p{N}]$/u;
const WORD_START = /^[\p{L}\p{N}]/u;

/**
 * The non-whitespace run ending one text node joined to the run starting the next,
 * wherever only tags lie between the two, at least one of them separates text, and a
 * letter or digit meets a letter or digit at the join (`RATIOSIRR`, `2095`,
 * `1Division`). A join at punctuation (`University` + `.`) reads naturally and is not a
 * fusion.
 */
function boundaryFusions(tokens: Token[]): string[] {
  const found: string[] = [];
  let previous: string | undefined;
  let separated = false;
  for (const token of tokens) {
    if (token.kind === 'tag') {
      if (SEPARATING.has(token.name)) separated = true;
      continue;
    }
    if (
      separated &&
      previous !== undefined &&
      WORD_END.test(previous) &&
      WORD_START.test(token.value)
    ) {
      const fused = `${/\S+$/.exec(previous)?.[0] ?? ''}${/^\S+/.exec(token.value)?.[0] ?? ''}`;
      if (fused.length >= 4) found.push(fused);
    }
    previous = token.value;
    separated = false;
  }
  return found;
}

/**
 * Every run of two or more `<xref>`s with no text between them, their texts joined and
 * read with the non-space character just outside each end: `[1234]` for four adjacent
 * citation markers inside brackets. An `<xref>` inside another (`<xref>Figure
 * <xref>1</xref></xref>a`) is part of that one marker.
 */
function xrefRunFusions(tokens: Token[]): string[] {
  const found: string[] = [];
  let run: string[] = [];
  let depth = 0;
  let before = '';
  let previous = '';
  const finish = (after: string) => {
    if (run.filter(Boolean).length >= 2) found.push(`${before}${run.join('')}${after}`);
    run = [];
  };
  for (const token of tokens) {
    if (token.kind === 'text') {
      if (depth > 0) {
        run[run.length - 1] += token.value;
        continue;
      }
      if (run.length > 0) finish(token.value.slice(0, 1).trim());
      previous = token.value;
      continue;
    }
    if (token.name !== 'xref' || token.empty) continue;
    if (token.closing) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth++ > 0) continue;
    if (run.length === 0) before = previous.slice(-1).trim();
    run.push('');
  }
  finish('');
  return found;
}

/**
 * Words `text` holds that the source spells only across a separating boundary (see
 * {@link boundaryFusions} and {@link xrefRunFusions}): each is reported when `text`
 * holds it and no single source text node does.
 */
function fusedAcrossBoundary(source: string, text: string): string[] {
  const tokens = tokenize(source);
  const candidates = new Set([...boundaryFusions(tokens), ...xrefRunFusions(tokens)]);
  const native = source
    .split(/<[^>]*>/)
    .map(decodeEntities)
    .join('\u0000');
  return [...candidates].filter((fused) => text.includes(fused) && !native.includes(fused));
}

// ── Per-format source checks ───────────────────────────────────────────────

/** JATS: tables, figures, supplements, and references against the source, and fused text in `plain`. */
function jatsProblems(document: ScholarlyDocument, source: string, plain: string): string[] {
  const problems: string[] = [];
  const tables = sourceTables(source);
  const modelTables = countBlocks(document, 'table');
  if (modelTables !== tables)
    problems.push(`${tables} <table-wrap> or <array> in the source, ${modelTables} tables parsed`);
  const figures = sourceFigures(source);
  const modelFigures = countBlocks(document, 'figure');
  if (modelFigures < figures)
    problems.push(`${figures} <fig> in the source, ${modelFigures} figures parsed`);
  const supplements = sourceSupplements(source);
  const modelSupplements = countBlocks(document, 'supplement');
  if (modelSupplements !== supplements)
    problems.push(
      `${supplements} supplementary files in the source, ${modelSupplements} supplements parsed`,
    );
  const refs = count(source, /<ref[\s>]/g);
  if (document.references.length < Math.floor(refs * 0.95))
    problems.push(`${refs} <ref> in the source, ${document.references.length} references parsed`);
  for (const fused of fusedAcrossBoundary(source, plain))
    problems.push(`text fused across a JATS boundary: "${fused}"`);
  return problems;
}

/**
 * Grobid TEI: a `<biblStruct>` per reference in `<back>` (the header's `<sourceDesc>`
 * holds one more, for the article itself), and a `<figure>` per figure or, typed
 * `table`, per table. Element names are matched in any case, as the parser reads them.
 */
function teiProblems(document: ScholarlyDocument, source: string): string[] {
  const problems: string[] = [];
  const back = /<back[\s>]/i.exec(source);
  const refs = back ? count(source.slice(back.index), /<biblStruct[\s/>]/gi) : 0;
  if (document.references.length !== refs)
    problems.push(
      `${refs} <biblStruct> in <back>, ${document.references.length} references parsed`,
    );
  let figures = 0;
  let tables = 0;
  for (const [, attributes = ''] of source.matchAll(/<figure(?=[\s/>])([^>]*)>/gi)) {
    if (/\btype\s*=\s*["']table["']/i.test(attributes)) tables++;
    else figures++;
  }
  const modelFigures = countBlocks(document, 'figure');
  if (modelFigures !== figures)
    problems.push(`${figures} <figure> in the source, ${modelFigures} figures parsed`);
  const modelTables = countBlocks(document, 'table');
  if (modelTables !== tables)
    problems.push(`${tables} <figure> tables in the source, ${modelTables} tables parsed`);
  return problems;
}

/**
 * `<figure>`s not inside another `<figure>` (a subfigure panel is part of its float),
 * leaving out algorithm floats, which the parser writes as a caption and code.
 */
function topLevelFigures(source: string): number {
  let depth = 0;
  let found = 0;
  for (const [, closing, attributes = ''] of source.matchAll(/<(\/?)figure(?=[\s/>])([^>]*)>/g)) {
    if (closing) {
      depth--;
      continue;
    }
    if (depth === 0 && !/\bltx_float_algorithm\b/.test(attributes)) found++;
    if (!attributes.endsWith('/')) depth++;
  }
  return found;
}

/**
 * LaTeXML: an `ltx_bibitem` per reference, and at least one figure or table block per
 * top-level `<figure>` (a float of panels can give several).
 */
function latexmlProblems(document: ScholarlyDocument, source: string): string[] {
  const problems: string[] = [];
  const items = count(source, /class="[^"]*\bltx_bibitem\b/g);
  if (document.references.length !== items)
    problems.push(
      `${items} ltx_bibitem in the source, ${document.references.length} references parsed`,
    );
  const floats = topLevelFigures(source);
  const modelFloats = countBlocks(document, 'figure') + countBlocks(document, 'table');
  if (modelFloats < floats)
    problems.push(
      `${floats} top-level <figure> in the source, ${modelFloats} figures and tables parsed`,
    );
  return problems;
}

/** Problems with a parsed document; empty when every invariant holds. */
export function checkInvariants({ document, format, markdown, source }: InvariantInput): string[] {
  const problems: string[] = [];
  const text = prose(markdown);

  const tag = LEAKED_TAG.exec(text);
  if (tag) problems.push(`leaked source tag "${text.slice(tag.index, tag.index + 40)}"`);
  const entity = LEAKED_ENTITY.exec(text);
  if (entity) problems.push(`undecoded entity "${entity[0]}"`);
  if (TEX_PREAMBLE.test(markdown)) problems.push('a LaTeX document preamble reached the output');
  if (LONE_SURROGATE.test(markdown)) problems.push('a split surrogate pair');
  if (/^#{1,6}\s*$/m.test(markdown)) problems.push('an empty heading');
  // A token the source itself contains (a `NaN` table cell, a bibliography exported with "[object Object]") is content, not a leak.
  const tokens = ['undefined', 'null', 'NaN', '[object Object]'].filter(
    (token) => !source?.includes(token),
  );
  const leaked = leakedValues(document, tokens);
  if (leaked.length > 0)
    problems.push(`a stringified missing value or object at ${leaked.slice(0, 3).join(', ')}`);
  const lines = markdown.split('\n');
  const rendered = tokens.find((token) =>
    lines.some(
      (line) =>
        line.trim() === token ||
        line.includes(`| ${token} |`) ||
        (token === '[object Object]' && line.includes(token)),
    ),
  );
  if (rendered) problems.push(`"${rendered}" rendered as content`);

  const ids = allSections(document).map((section) => section.id);
  const duplicate = firstDuplicate(ids);
  if (duplicate) problems.push(`duplicate section id "${duplicate}"`);
  const reserved = ids.find((id) => RESERVED_SECTION_ID.test(id));
  if (reserved) problems.push(`section id "${reserved}" is one toSections generates`);
  const entry = firstDuplicate(toSections(document).map((e) => e.id));
  if (entry) problems.push(`duplicate toSections id "${entry}"`);

  const plain = toText(document);
  problems.push(...markupInText(plain, markdown), ...malformedMarkdown(markdown));

  if (source && format === 'jats') problems.push(...jatsProblems(document, source, plain));
  if (source && format === 'tei') problems.push(...teiProblems(document, source));
  if (source && format === 'latexml') problems.push(...latexmlProblems(document, source));
  return problems;
}
