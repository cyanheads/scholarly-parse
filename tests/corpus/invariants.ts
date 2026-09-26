/**
 * @fileoverview Properties every parsed document must have, whatever its format. Each
 * check returns the problems it found, so one run reports every broken invariant.
 * @module tests/corpus/invariants
 */
import type { ScholarlyDocument } from '../../src/model/document.js';
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

function count(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

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
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) problems.push(`duplicate section id "${duplicate}"`);

  if (format === 'jats' && source) {
    const tables = sourceTables(source);
    const modelTables = countBlocks(document, 'table');
    if (modelTables !== tables)
      problems.push(
        `${tables} <table-wrap> or <array> in the source, ${modelTables} tables parsed`,
      );
    const figures = sourceFigures(source);
    const modelFigures = countBlocks(document, 'figure');
    if (modelFigures < figures)
      problems.push(`${figures} <fig> in the source, ${modelFigures} figures parsed`);
    const refs = count(source, /<ref[\s>]/g);
    if (document.references.length < Math.floor(refs * 0.95)) {
      problems.push(`${refs} <ref> in the source, ${document.references.length} references parsed`);
    }
  }
  return problems;
}
