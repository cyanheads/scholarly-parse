/**
 * @fileoverview `parsePdf`'s document-wide reading budgets — text items, characters, and
 * operators — and the per-page catch: each stop keeps what was read and reports one
 * `truncated-input` warning naming the budget or error and the page, and a text budget
 * reached mid-page leaves pdf.js idle.
 * @module tests/formats/pdf/budgets.test
 */
import { getDocumentProxy } from 'unpdf';
import { describe, expect, it, vi } from 'vitest';
import { type PdfOptions, parsePdf } from '../../../src/formats/pdf/index.js';
import { DEFAULT_BUDGETS } from '../../../src/formats/pdf/parse.js';
import type { ParseWarning, ScholarlyDocument } from '../../../src/model/document.js';
import { parse as parseAny } from '../../../src/parse.js';
import { toMarkdown } from '../../../src/render/markdown.js';
import { buildPdf, paragraph, type TextSpec } from './build-pdf.js';

// Unchanged, but recorded: a test reaches the document `parsePdf` opened.
vi.mock('unpdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('unpdf')>();
  return { ...actual, getDocumentProxy: vi.fn(actual.getDocumentProxy) };
});

/** `count` lines of running text, each one text item carrying a unique token (`b03`). */
function lines(label: string, count = 12): TextSpec[] {
  return paragraph(
    Array.from(
      { length: count },
      (_, i) => `${label}${String(i).padStart(2, '0')} is a line of running text on the page`,
    ),
    { y: 700 },
  );
}

/** A first page whose lines read as body text: structure keeps nothing before the first heading. */
function opening(label: string): TextSpec[] {
  return [{ font: 'bold', size: 12, text: '1 Introduction', x: 72, y: 720 }, ...lines(label)];
}

async function parse(bytes: Uint8Array, options: PdfOptions = {}): Promise<ScholarlyDocument> {
  const result = await parsePdf(bytes, options);
  if (!result.ok) throw new Error(`${result.error.reason}: ${result.error.message}`);
  return result.document;
}

function truncations(document: ScholarlyDocument): ParseWarning[] {
  return document.diagnostics.warnings.filter((warning) => warning.code === 'truncated-input');
}

/** What pdf.js itself reports per page: the text items' strings and the operator-list length. */
async function pdfjsCounts(bytes: Uint8Array): Promise<{ items: string[]; operators: number }[]> {
  const document = await getDocumentProxy(bytes.slice(), { verbosity: 0 });
  try {
    const pages: { items: string[]; operators: number }[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const { items } = await page.getTextContent();
      const { fnArray } = await page.getOperatorList();
      pages.push({
        items: items.map((item) => ('str' in item ? item.str : '')),
        operators: fnArray.length,
      });
    }
    return pages;
  } finally {
    await document.loadingTask.destroy();
  }
}

/** Point the page tree's `from` kids at `to`: a kid that is the tree's own root is a cycle pdf.js cannot load. */
function rewire(bytes: Uint8Array, from: string, to: string): Uint8Array {
  const text = new TextDecoder('latin1').decode(bytes);
  if (!text.includes(from)) throw new Error(`No "${from}" in the PDF`);
  return Uint8Array.from(text.replace(from, to), (char) => char.charCodeAt(0));
}

function cpuMs(): number {
  const { system, user } = process.cpuUsage();
  return (system + user) / 1000;
}

describe('parsePdf reading budgets', () => {
  it('defaults to the corpus-sized budgets', () => {
    expect(DEFAULT_BUDGETS).toEqual({
      maxOperators: 10_000_000,
      maxPages: 300,
      maxTextChars: 4_000_000,
      maxTextItems: 500_000,
    });
  });

  it('stops at the text-item budget mid-page and keeps the items before it', async () => {
    const pdf = buildPdf({ pages: [opening('a'), lines('b'), lines('c')] });
    const [first] = await pdfjsCounts(pdf);
    const budget = (first?.items.length ?? 0) + 4;
    const document = await parse(pdf, { maxTextItems: budget });
    const markdown = toMarkdown(document);
    expect(markdown).toContain('a11 is a line');
    expect(markdown).toContain('b03 is a line');
    expect(markdown).not.toContain('b04');
    expect(markdown).not.toContain('c00');
    expect(truncations(document)).toEqual([
      {
        code: 'truncated-input',
        message: `Reading stopped on page 2 of 3 at the ${budget}-item text budget (maxTextItems)`,
        where: 'page 2',
      },
    ]);
  });

  it('cuts the item that reaches the character budget', async () => {
    const pdf = buildPdf({
      pages: [
        opening('a'),
        [{ text: 'Kept words then dropped words', x: 72, y: 720 }, ...lines('b')],
      ],
    });
    const [first] = await pdfjsCounts(pdf);
    const budget = (first?.items.join('').length ?? 0) + 'Kept words'.length;
    const document = await parse(pdf, { maxTextChars: budget });
    const markdown = toMarkdown(document);
    expect(markdown).toMatch(/Kept words\s*$/);
    expect(markdown).not.toContain('dropped');
    expect(truncations(document)).toEqual([
      {
        code: 'truncated-input',
        message: `Reading stopped on page 2 of 2 at the ${budget}-character text budget (maxTextChars)`,
        where: 'page 2',
      },
    ]);
  });

  it('counts every page that shares one content stream toward the operator budget', async () => {
    const pdf = buildPdf({ pages: [lines('a'), 0, 0, 0, 0, 0] });
    const counts = await pdfjsCounts(pdf);
    expect(new Set(counts.map((page) => page.operators)).size).toBe(1);
    const budget = 2 * (counts[0]?.operators ?? 0) + 1;
    const document = await parse(pdf, { maxOperators: budget });
    expect(truncations(document)).toEqual([
      {
        code: 'truncated-input',
        message: `Reading stopped after page 3 of 6: the pages read passed the ${budget}-operator budget (maxOperators)`,
        where: 'page 3',
      },
    ]);
  });

  it('counts every page that shares one content stream toward the text-item budget', async () => {
    const pdf = buildPdf({ pages: [lines('a'), 0, 0, 0] });
    const [first] = await pdfjsCounts(pdf);
    const budget = 2 * (first?.items.length ?? 0) + 3;
    const document = await parse(pdf, { maxTextItems: budget });
    expect(truncations(document)).toMatchObject([
      { message: expect.stringMatching(/^Reading stopped on page 3 of 4 /), where: 'page 3' },
    ]);
  });

  it('warns only when something is left unread', async () => {
    const pdf = buildPdf({ pages: [lines('a'), 0, 0] });
    const counts = await pdfjsCounts(pdf);
    const items = counts.flatMap((page) => page.items);
    const exact = await parse(pdf, {
      maxTextChars: items.join('').length,
      maxTextItems: items.length,
    });
    expect(truncations(exact)).toEqual([]);
    // Passed on the last page: every page was read.
    const lastPage = await parse(pdf, { maxOperators: 2 * (counts[0]?.operators ?? 0) + 1 });
    expect(truncations(lastPage)).toEqual([]);
  });

  it('reports one truncation when a budget stops reading inside the page limit', async () => {
    const pdf = buildPdf({ pages: [opening('a'), lines('b'), lines('c')] });
    const [first] = await pdfjsCounts(pdf);
    const document = await parse(pdf, {
      maxPages: 2,
      maxTextItems: (first?.items.length ?? 0) + 2,
    });
    expect(truncations(document)).toMatchObject([{ where: 'page 2' }]);
  });

  it('keeps the pages before one pdf.js cannot load', async () => {
    const pdf = rewire(
      buildPdf({ pages: [opening('a'), lines('b')] }),
      '/Kids [6 0 R 8 0 R]',
      '/Kids [6 0 R 2 0 R]',
    );
    const document = await parse(pdf);
    expect(toMarkdown(document)).toContain('a11 is a line');
    expect(truncations(document)).toEqual([
      {
        code: 'truncated-input',
        message: expect.stringMatching(
          /^Reading stopped at page 2 of 2, which could not be read: \S/,
        ),
        where: 'page 2',
      },
    ]);
  });

  it('fails as malformed when the page that cannot load leaves no text', async () => {
    const pdf = rewire(buildPdf({ pages: [lines('a')] }), '/Kids [6 0 R]', '/Kids [2 0 R]');
    const result = await parsePdf(pdf);
    expect(result).toMatchObject({
      error: {
        message: expect.stringMatching(/^Reading stopped at page 1 of 1, which could not be read/),
        reason: 'malformed',
      },
      ok: false,
    });
  });

  it('fails as empty, naming the budget, when a budget stops reading before usable text', async () => {
    const result = await parsePdf(buildPdf({ pages: [lines('a')] }), { maxTextItems: 2 });
    expect(result).toMatchObject({
      error: {
        message:
          'Reading stopped on page 1 of 1 at the 2-item text budget (maxTextItems), before 200 characters of text were read',
        reason: 'empty',
      },
      ok: false,
    });
  });

  it('leaves pdf.js idle once a text budget stops reading mid-page', async () => {
    const rows = Array.from({ length: 30_000 }, (_, i) => ({
      size: 1,
      text: `w${i}`,
      x: 100 + (Math.floor(i / 300) % 4) * 100,
      y: 690 - (i % 300) * 2,
    }));
    const pdf = buildPdf({ pages: [[...lines('a'), ...rows]] });
    const opened = vi.mocked(getDocumentProxy);
    opened.mockClear();
    const document = await parse(pdf, { maxTextItems: 100 });
    expect(truncations(document)).toMatchObject([{ where: 'page 1' }]);
    // `parsePdf` awaits the loading task's `destroy()`, which settles only once every pdf.js
    // task has ended.
    expect(opened).toHaveBeenCalledOnce();
    const proxy = await opened.mock.results[0]?.value;
    expect(proxy.loadingTask.destroyed).toBe(true);
    // Work pdf.js kept doing after the stop would show as CPU time while this test only waits.
    const before = cpuMs();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(cpuMs() - before).toBeLessThan(60);
  });

  it('is reachable through parse()', async () => {
    const pdf = buildPdf({ pages: [opening('a'), lines('b')] });
    const [first] = await pdfjsCounts(pdf);
    const stopped = async (options: Parameters<typeof parseAny>[1]) => {
      const result = await parseAny(pdf, options);
      return result.ok ? truncations(result.document).map((warning) => warning.message) : [];
    };
    expect(await stopped({ maxTextItems: (first?.items.length ?? 0) + 1 })).toEqual([
      expect.stringContaining('(maxTextItems)'),
    ]);
    expect(await stopped({ maxTextChars: (first?.items.join('').length ?? 0) + 5 })).toEqual([
      expect.stringContaining('(maxTextChars)'),
    ]);
    expect(await stopped({ maxOperators: 1 })).toEqual([expect.stringContaining('(maxOperators)')]);
  });
});
