/**
 * @fileoverview `parsePdf`: a PDF with a text layer → `ScholarlyDocument`. Structure is
 * inferred from layout and typography, so the result is `partial` quality when headings
 * are found and `flat` when the text reads as one run. Front matter prefers the page's
 * visible title and the PDF's own Info and XMP metadata.
 * @module src/formats/pdf/parse
 */
import { createDiagnostics } from '../../model/diagnostics.js';
import type {
  Abstract,
  Author,
  DocumentMetadata,
  ScholarlyDocument,
} from '../../model/document.js';
import { exceedsBudget } from '../../model/input.js';
import {
  failed,
  guardAsync,
  type ParseOptions,
  type ParseResult,
  parsed,
} from '../../model/result.js';
import { escapeInline } from '../../render/escape.js';
import { layout } from './layout.js';
import { type LoadedPdf, loadPdf } from './load.js';
import { type PdfContext, structure } from './structure.js';

/** Options for {@link parsePdf}. */
export interface PdfOptions extends ParseOptions {
  /** Read at most this many pages. Defaults to 300. */
  maxPages?: number;
}

const DEFAULT_MAX_INPUT_BYTES = 64 * 1024 * 1024;
const DEFAULT_MAX_PAGES = 300;

/** Fewer characters than this across the pages read means there is no usable text layer. */
const MIN_TEXT_CHARS = 200;

/** Parse a PDF. Requires the optional `unpdf` peer. */
export function parsePdf(input: Uint8Array, options: PdfOptions = {}): Promise<ParseResult> {
  return guardAsync(() => readPdf(input, options));
}

async function readPdf(input: Uint8Array, options: PdfOptions): Promise<ParseResult> {
  const maxBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
  if (exceedsBudget(input, maxBytes))
    return failed('too-large', `Input exceeds the ${maxBytes}-byte budget`);
  if (!/%PDF-/.test(new TextDecoder('latin1').decode(input.subarray(0, 1024)))) {
    return failed('wrong-format', 'Not a PDF: no %PDF- header');
  }
  const loaded = await loadPdf(input, options.maxPages ?? DEFAULT_MAX_PAGES);
  if ('reason' in loaded) return failed(loaded.reason, loaded.message);

  const chars = loaded.pages.reduce(
    (n, page) => n + page.runs.reduce((m, run) => m + run.text.trim().length, 0),
    0,
  );
  if (chars < MIN_TEXT_CHARS)
    return failed('empty', 'The PDF has no text layer: it is scanned images and needs OCR');

  const ctx: PdfContext = { diag: createDiagnostics(), sectionIds: new Set() };
  if (loaded.pages.length < loaded.pageCount) {
    ctx.diag.warn('truncated-input', `Read ${loaded.pages.length} of ${loaded.pageCount} pages`);
  }
  warnUnmappedGlyphs(loaded, ctx);
  const parts = structure(layout(loaded.pages), ctx);
  const metadata = extractMetadata(loaded, parts.title, parts.keywords);
  const abstracts: Abstract[] =
    parts.abstract.length > 0 ? [{ kind: 'main', sections: parts.abstract }] : [];

  const headed = parts.body.length + parts.back.length > 1 || parts.references.length > 0;
  if (!metadata.title) ctx.diag.warn('no-title', 'No title was recognized');
  if (abstracts.length === 0) ctx.diag.warn('no-abstract', 'No abstract was recognized');
  if (parts.body.length === 0) ctx.diag.warn('no-body', 'No body text was recognized');
  ctx.diag.warn('structure-inferred', 'Structure was inferred from layout and typography');

  const document: ScholarlyDocument = {
    abstracts,
    back: parts.back,
    body: parts.body,
    diagnostics: ctx.diag.finish(headed ? 'partial' : 'flat'),
    floats: [],
    footnotes: [],
    format: 'pdf',
    metadata,
    references: parts.references,
  };
  return parsed(document);
}

/**
 * Reports glyphs the PDF's fonts give no Unicode mapping for, which the text layer reads
 * as U+FFFD: math set in a font without a ToUnicode table comes out as `\uFFFD` runs.
 */
function warnUnmappedGlyphs(pdf: LoadedPdf, ctx: PdfContext): void {
  let count = 0;
  const pages: number[] = [];
  pdf.pages.forEach((page, index) => {
    const onPage = page.runs.reduce((n, run) => n + (run.text.match(/\uFFFD/g)?.length ?? 0), 0);
    if (onPage === 0) return;
    count += onPage;
    pages.push(index + 1);
  });
  if (count === 0) return;
  ctx.diag.warn(
    'unmapped-glyphs',
    `${count} glyphs have no Unicode mapping in the PDF and read as U+FFFD`,
    `pages ${pages.join(', ')}`,
  );
}

/** A metadata title that is a file name or a word processor's placeholder, not the paper's title. */
const PLACEHOLDER_TITLE =
  /^(?:microsoft word|untitled|document\d*$)|\.(?:docx?|pdf|tex|dvi|indd)$/i;

function stringOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim() || undefined;
  if (Array.isArray(value)) return value.map(stringOf).filter(Boolean).join('; ') || undefined;
  return;
}

function extractMetadata(
  pdf: LoadedPdf,
  visibleTitle: string | undefined,
  keywords: string[],
): DocumentMetadata {
  const { info, xmp } = pdf.metadata;
  const infoTitle = stringOf(xmp['dc:title']) ?? stringOf(info.title);
  const title =
    visibleTitle ??
    (infoTitle && !PLACEHOLDER_TITLE.test(infoTitle) && infoTitle.split(/\s+/).length >= 3
      ? infoTitle
      : undefined);
  const creators = Array.isArray(xmp['dc:creator'])
    ? (xmp['dc:creator'] as unknown[]).map(stringOf).filter((name): name is string => !!name)
    : (stringOf(info.author)?.split(
        /\s*(?:;|,\s*and\s+|\s+and\s+)\s*|,\s*(?=\p{Lu}[\p{L}.'-]+\s+\p{Lu})/u,
      ) ?? []);
  const authors: Author[] = creators
    .map((name) => name.trim())
    .filter((name) => name.length > 1)
    .map((name) => ({ name }));
  const firstPage = pdf.pages[0]?.runs.map((run) => run.text).join(' ') ?? '';
  const doi = [
    stringOf(xmp['prism:doi']),
    stringOf(info.doi),
    /\b(?:doi\.org\/|doi:\s*)(10\.\d{4,9}\/[^\s"<>]+)/i.exec(firstPage)?.[1],
  ]
    .find((value) => value && /^10\.\d{4,9}\//.test(value))
    ?.replace(/[.,;)\]]+$/, '')
    .toLowerCase();
  const infoKeywords =
    stringOf(info.keywords)
      ?.split(/\s*[;,]\s*/)
      .filter(Boolean) ?? [];
  const allKeywords = keywords.length > 0 ? keywords : infoKeywords;
  return {
    ...(title && { title: escapeInline(title) }),
    ...(authors.length > 0 && { authors }),
    ...(doi && { identifiers: { doi } }),
    ...(allKeywords.length > 0 && { keywords: allKeywords }),
  };
}
