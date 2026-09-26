/**
 * @fileoverview PDF → positioned text runs through the optional `unpdf` peer (a
 * serverless pdf.js build), loaded on first use. Only text is read: no page is
 * rendered and no image is decoded into output. Font names come from each page's
 * operator list, which is what makes bold and italic runs recognizable.
 * @module src/formats/pdf/load
 */

import { MissingPeerError } from '../../model/result.js';

/** A run of text in one font at one position, in PDF points with the origin at the page's bottom left. */
export interface Run {
  bold: boolean;
  italic: boolean;
  /** Set in a math font (Computer Modern math, STIX, Cambria Math, Symbol). */
  math: boolean;
  size: number;
  text: string;
  width: number;
  x: number;
  y: number;
}

export interface Page {
  height: number;
  number: number;
  runs: Run[];
  width: number;
}

/** What the PDF says about itself: the Info dictionary and XMP, lowercased keys. */
export interface PdfMetadata {
  info: Record<string, unknown>;
  xmp: Record<string, unknown>;
}

export interface LoadedPdf {
  metadata: PdfMetadata;
  pageCount: number;
  pages: Page[];
}

/** Why pdf.js could not open the file. */
export interface PdfOpenFailure {
  message: string;
  reason: 'blocked' | 'malformed';
}

type UnpdfModule = typeof import('unpdf');
type PdfjsDocument = Awaited<ReturnType<UnpdfModule['getDocumentProxy']>>;
type PdfjsPage = Awaited<ReturnType<PdfjsDocument['getPage']>>;

let unpdf: Promise<UnpdfModule> | undefined;

/** Load `unpdf`. Throws when it is not installed — a setup error, not a property of the input. */
function loadUnpdf(): Promise<UnpdfModule> {
  unpdf ??= import('unpdf').catch((error: unknown) => {
    unpdf = undefined;
    throw new MissingPeerError('Install "unpdf" to parse PDF: bun add unpdf', { cause: error });
  });
  return unpdf;
}

// `.B` / `.I` / `.BI` suffixes are the typesetting-house convention (`AdvOT83f7eb24.B`); `-700` is a numeric weight.
const BOLD_FONT =
  /bold|black|heavy|semibold|demibold|demi\b|-?medi(?:um)?\b|,bd\b|-bd\b|extrabold|ultrabold|\.BI?$|[-_]?[6-9]00\b/i;
const ITALIC_FONT = /italic|oblique|-it\b|ital\b|-ita\b|slanted|\.B?I$/i;
const MATH_FONT =
  /^(?:[A-Z]{6}\+)?(?:CM(?:MI|SY|EX|BSY|MIB)\d*|MSBM|MSAM|STIX(?:Two)?Math|STIX-(?:Italic|Regular)|Cambria.?Math|Symbol|MTSY|MTMI|RMTMI|Euclid|LucidaNewMath|txsy|txmi|pxsy|pxmi|rsfs|eufm|TeX_CM_Maths)/i;

/**
 * Symbol fonts embedded without a Unicode map, whose codes pdf.js reads as Latin-1: the
 * TeX math symbol font as some typesetters embed it sets `(1) = a + b − c` as `ð1Þ ¼ a þ b \0 c`.
 */
const SYMBOL_CODES: [RegExp, Record<string, string>][] = [
  [/TeX_CM_Maths_Symbols/i, { '\u0000': '−', ð: '(', Þ: ')', '¼': '=', þ: '+' }],
];

/** Text without control characters (a symbol font's unmapped codes); a tab becomes a space. */
function printable(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 9) out += ' ';
    else if (code >= 32 && code !== 127) out += char;
  }
  return out;
}

interface FontStyle {
  bold: boolean;
  /** Code-to-character fixes for a symbol font pdf.js cannot map. */
  codes?: Record<string, string>;
  italic: boolean;
  math: boolean;
}

function fontStyle(page: PdfjsPage, fontName: string, cache: Map<string, FontStyle>): FontStyle {
  const cached = cache.get(fontName);
  if (cached) return cached;
  const font = page.commonObjs.has(fontName)
    ? (page.commonObjs.get(fontName) as
        | { name?: string; bold?: boolean; italic?: boolean }
        | undefined)
    : undefined;
  const name = font?.name ?? '';
  const codes = SYMBOL_CODES.find(([pattern]) => pattern.test(name))?.[1];
  const style = {
    bold: font?.bold === true || BOLD_FONT.test(name),
    ...(codes && { codes }),
    italic: font?.italic === true || ITALIC_FONT.test(name),
    math: MATH_FONT.test(name),
  };
  cache.set(fontName, style);
  return style;
}

/** The XMP fields the metadata reader uses. */
const XMP_FIELDS = ['dc:title', 'dc:creator', 'prism:doi'];

/** Open a PDF and read the text runs of its first `maxPages` pages, or say why it could not be opened. */
export async function loadPdf(
  bytes: Uint8Array,
  maxPages: number,
): Promise<LoadedPdf | PdfOpenFailure> {
  const { getDocumentProxy } = await loadUnpdf();
  let document: PdfjsDocument;
  try {
    // pdf.js takes ownership of the buffer it is given; a copy leaves the caller's intact.
    document = await getDocumentProxy(bytes.slice(), { verbosity: 0 });
  } catch (error) {
    const name = (error as { name?: string }).name ?? '';
    const message = error instanceof Error ? error.message : String(error);
    if (name === 'PasswordException')
      return { message: 'The PDF is password-protected', reason: 'blocked' };
    return { message: `The PDF could not be opened: ${message}`, reason: 'malformed' };
  }
  try {
    const pages: Page[] = [];
    const count = Math.min(document.numPages, maxPages);
    for (let number = 1; number <= count; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      await page.getOperatorList();
      const viewport = page.getViewport({ scale: 1 });
      const fonts = new Map<string, FontStyle>();
      const runs: Run[] = [];
      for (const item of content.items) {
        if (!('str' in item) || item.str.trim() === '') continue;
        const [a = 0, b = 0, c = 0, d = 0, x = 0, y = 0] = item.transform;
        // Rotated text (a vertical margin stamp) is page furniture; a skew is synthetic italic.
        if (Math.abs(b) > 0.01 || a <= 0) continue;
        const { codes, ...style } = fontStyle(page, item.fontName, fonts);
        const text = printable(
          codes ? item.str.replace(/./gsu, (char) => codes[char] ?? char) : item.str,
        );
        if (!text.trim()) continue;
        runs.push({
          ...style,
          italic: style.italic || Math.abs(c) > 0.01,
          size: Math.abs(d),
          text,
          width: item.width,
          x,
          y,
        });
      }
      pages.push({ height: viewport.height, number, runs, width: viewport.width });
      page.cleanup();
    }
    const meta = await document.getMetadata().catch(() => ({ info: {}, metadata: null }));
    const info = Object.fromEntries(
      Object.entries((meta.info ?? {}) as Record<string, unknown>).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    );
    const xmp = Object.fromEntries(
      XMP_FIELDS.map((field) => [field, meta.metadata?.get(field) as unknown]).filter(
        ([, value]) => value != null,
      ),
    );
    return {
      metadata: { info, xmp },
      pageCount: document.numPages,
      pages,
    };
  } finally {
    await document.loadingTask.destroy();
  }
}
