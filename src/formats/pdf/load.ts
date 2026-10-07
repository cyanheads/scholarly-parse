/**
 * @fileoverview PDF → positioned text runs through the optional `unpdf` peer (a
 * serverless pdf.js build), loaded on first use. Only text is read: no page is
 * rendered and no image is decoded into output. Font names come from each page's
 * operator list, which is what makes bold and italic runs recognizable. Reading stops
 * at document-wide budgets on text items, characters, and operators, at a page pdf.js
 * cannot read, or at the page boundary after a caller's signal is aborted, and keeps what
 * was read before it.
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

/** Document-wide limits on what is read. */
export interface ReadBudgets {
  /** Read no further page once the operator lists read pass this many entries in all. */
  maxOperators: number;
  maxPages: number;
  /** Characters across the text items read; the item that reaches it is cut. */
  maxTextChars: number;
  /** Text items read, blank and skipped ones included. */
  maxTextItems: number;
}

type TextBudget = 'maxTextChars' | 'maxTextItems';

/** Why reading ended before the last page it would have read. */
export type ReadStop =
  | { budget: 'maxOperators' | TextBudget; page: number }
  | { error: string; page: number }
  /** The signal was aborted before `page` was read. */
  | { aborted: true; page: number };

export interface LoadedPdf {
  metadata: PdfMetadata;
  pageCount: number;
  /** The pages read; a text budget's page is kept up to the item where reading stopped. */
  pages: Page[];
  stop?: ReadStop;
}

/** Why pdf.js could not open the file. */
export interface PdfOpenFailure {
  message: string;
  reason: 'blocked' | 'malformed';
}

type UnpdfModule = typeof import('unpdf');
type PdfjsDocument = Awaited<ReturnType<UnpdfModule['getDocumentProxy']>>;
type PdfjsPage = Awaited<ReturnType<PdfjsDocument['getPage']>>;
type TextContent = Awaited<ReturnType<PdfjsPage['getTextContent']>>;
type TextItem = Extract<TextContent['items'][number], { str: string }>;

/** What the pages read so far add up to, counted against the {@link ReadBudgets}. */
interface Tally {
  chars: number;
  items: number;
  operators: number;
}

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

/**
 * Open a PDF and read the text runs of its pages until a budget, a page pdf.js cannot
 * read, or an aborted `signal` stops it, or say why it could not be opened.
 *
 * pdf.js interprets a page without giving control back, so no timer fires while a page is
 * read. With a `signal`, each page waits one turn of the event loop first, in which a due
 * timer (an `AbortSignal.timeout`) can abort it; without one, no turn is taken.
 */
export async function loadPdf(
  bytes: Uint8Array,
  budgets: ReadBudgets,
  signal?: AbortSignal,
): Promise<LoadedPdf | PdfOpenFailure> {
  const { getDocumentProxy } = await loadUnpdf();
  let document: PdfjsDocument;
  try {
    // pdf.js takes ownership of the buffer it is given; a copy leaves the caller's intact.
    document = await getDocumentProxy(bytes.slice(), { verbosity: 0 });
  } catch (error) {
    const name = (error as { name?: string }).name ?? '';
    if (name === 'PasswordException')
      return { message: 'The PDF is password-protected', reason: 'blocked' };
    return { message: `The PDF could not be opened: ${messageOf(error)}`, reason: 'malformed' };
  }
  try {
    // Before any page: once a text budget stops a page mid-stream, only `destroy()` follows.
    const metadata = await readMetadata(document);
    const tally: Tally = { chars: 0, items: 0, operators: 0 };
    const pages: Page[] = [];
    const count = Math.min(document.numPages, budgets.maxPages);
    let stop: ReadStop | undefined;
    for (let number = 1; number <= count && !stop; number++) {
      if (signal) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (signal.aborted) {
          stop = { aborted: true, page: number };
          break;
        }
      }
      let read: PageRead;
      try {
        read = await readPage(document, number, tally, budgets);
      } catch (error) {
        stop = { error: messageOf(error), page: number };
        break;
      }
      pages.push({ ...read.size, number, runs: runsOf(read.page, read.items) });
      read.page.cleanup();
      if (read.stop) stop = { budget: read.stop, page: number };
      else if (tally.operators > budgets.maxOperators && number < count)
        stop = { budget: 'maxOperators', page: number };
    }
    return { metadata, pageCount: document.numPages, pages, ...(stop && { stop }) };
  } finally {
    await document.loadingTask.destroy();
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The Info dictionary and the XMP fields the metadata reader uses. */
async function readMetadata(document: PdfjsDocument): Promise<PdfMetadata> {
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
  return { info, xmp };
}

interface PageRead {
  items: TextItem[];
  page: PdfjsPage;
  size: { height: number; width: number };
  stop?: TextBudget;
}

/** One page's pdf.js work: its text items, counted as they stream, then its operator list. */
async function readPage(
  document: PdfjsDocument,
  number: number,
  tally: Tally,
  budgets: ReadBudgets,
): Promise<PageRead> {
  const page = await document.getPage(number);
  const { height, width } = page.getViewport({ scale: 1 });
  const { items, stop } = await readText(page, tally, budgets);
  // The operator list loads the page's fonts, whose names mark bold, italic, and math runs.
  // Where a text budget stopped reading, the rest of the page is left unread.
  if (!stop) tally.operators += (await page.getOperatorList()).fnArray.length;
  return { items, page, size: { height, width }, ...(stop && { stop }) };
}

/** Stream a page's text items, each counted toward the text budgets as it arrives. */
async function readText(
  page: PdfjsPage,
  tally: Tally,
  budgets: ReadBudgets,
): Promise<{ items: TextItem[]; stop?: TextBudget }> {
  const reader = (
    page.streamTextContent() as ReadableStream<Pick<TextContent, 'items'>>
  ).getReader();
  const items: TextItem[] = [];
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) return { items };
    const stop = take(chunk.value.items, items, tally, budgets);
    if (stop) {
      // Cancel before the loading task is destroyed: pdf.js waiting for an unread stream to
      // drain never finishes `destroy()`. pdf.js asserts the reason is an Error; without one
      // the stream stays open on its side and its next chunk throws unhandled.
      reader.cancel(new Error(`The ${stop} budget was reached`)).catch(() => {});
      return { items, stop };
    }
  }
}

/** Keep items while they fit the text budgets; the first that does not fit stops reading. */
function take(
  incoming: TextContent['items'],
  kept: TextItem[],
  tally: Tally,
  budgets: ReadBudgets,
): TextBudget | undefined {
  for (const item of incoming) {
    if (tally.items >= budgets.maxTextItems) return 'maxTextItems';
    tally.items++;
    const text = 'str' in item ? item.str : '';
    const room = budgets.maxTextChars - tally.chars;
    if (text.length > room) {
      // The item that reaches the budget keeps what fits, without splitting a surrogate pair.
      const cut = text.slice(0, Math.max(0, room)).replace(/[\uD800-\uDBFF]$/, '');
      if ('str' in item && cut)
        kept.push({ ...item, str: cut, width: (item.width * cut.length) / text.length });
      tally.chars += cut.length;
      return 'maxTextChars';
    }
    tally.chars += text.length;
    if ('str' in item) kept.push(item);
  }
  return;
}

/** A page's text items as runs, the page's fonts naming their styles. */
function runsOf(page: PdfjsPage, items: TextItem[]): Run[] {
  const fonts = new Map<string, FontStyle>();
  const runs: Run[] = [];
  for (const item of items) {
    if (item.str.trim() === '') continue;
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
  return runs;
}
