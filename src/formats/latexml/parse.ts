/**
 * @fileoverview `parseLatexml`: an HTML page produced by LaTeXML — arXiv's
 * `arxiv.org/html/<id>` renders and ar5iv — → `ScholarlyDocument`. Only the
 * `ltx_document` article is read, so the site's header, navigation, and footer never
 * reach the output.
 * @module src/formats/latexml/parse
 */

import {
  childElements,
  childNodes,
  hasClass,
  isElement,
  loadDocument,
  resolveUrl,
  tagOf,
  textOfElement,
} from '../../html/dom.js';
import { createDiagnostics } from '../../model/diagnostics.js';
import type {
  Abstract,
  Author,
  Block,
  DocumentMetadata,
  PartialDate,
  Reference,
  ScholarlyDocument,
  Section,
  SectionKind,
} from '../../model/document.js';
import { decodeText, exceedsBudget } from '../../model/input.js';
import {
  failed,
  guardAsync,
  type ParseOptions,
  type ParseResult,
  parsed,
} from '../../model/result.js';
import { issueId } from '../../model/section-ids.js';
import { kindFromTitle } from '../../model/section-kinds.js';
import { flowBlocks, parseSection } from './blocks.js';
import type { LatexmlContext } from './context.js';
import { inlineMarkdown, inlineText } from './inline.js';

/** Options for {@link parseLatexml}. */
export interface LatexmlOptions extends ParseOptions {
  /** The page's URL, so relative image paths resolve (`x1.png` → `https://arxiv.org/html/…/x1.png`). */
  baseUrl?: string;
}

const DEFAULT_MAX_INPUT_BYTES = 32 * 1024 * 1024;

/** Messages arXiv shows in place of a paper it could not convert. */
const CONVERSION_FAILED =
  /No HTML for|HTML is not available|Conversion to HTML had a Fatal error|conversion failed/i;

/** Parse a LaTeXML HTML page. Requires the optional `linkedom` peer. */
export function parseLatexml(
  input: string | Uint8Array,
  options: LatexmlOptions = {},
): Promise<ParseResult> {
  return guardAsync(() => readLatexml(input, options));
}

async function readLatexml(
  input: string | Uint8Array,
  options: LatexmlOptions,
): Promise<ParseResult> {
  const maxBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
  if (exceedsBudget(input, maxBytes))
    return failed('too-large', `Input exceeds the ${maxBytes}-byte budget`);
  const source = decodeText(input);
  if (!/ltx_document|LaTeXML/.test(source)) {
    return CONVERSION_FAILED.test(source)
      ? failed('empty', 'The page reports that no HTML conversion of the paper is available')
      : failed('wrong-format', 'Not a LaTeXML page: no ltx_document element');
  }

  const document = await loadDocument(source);
  const article = document.querySelector('.ltx_document');
  if (!article) return failed('wrong-format', 'Not a LaTeXML page: no ltx_document element');

  const ctx: LatexmlContext = {
    baseUrl: options.baseUrl,
    diag: createDiagnostics(),
    footnotes: [],
    sectionIds: new Set(),
  };
  const watermark = parseWatermark(document, options.baseUrl);
  const metadata = extractMetadata(article, document, watermark, ctx);
  const marked = extractAbstracts(article, ctx);
  const content = extractContent(article, ctx);
  const { back, references } = content;
  const { abstracts, body } =
    marked.length > 0
      ? { abstracts: marked, body: content.body }
      : abstractFromBody(content.body, ctx);

  if (!metadata.title && abstracts.length === 0 && body.length === 0) {
    return failed('empty', 'The page carries no title, abstract, or body');
  }
  if (!metadata.title) ctx.diag.warn('no-title', 'The paper has no title');
  if (abstracts.length === 0) ctx.diag.warn('no-abstract', 'The paper has no abstract');
  if (body.length === 0) ctx.diag.warn('no-body', 'The paper has no body text');

  const flavor =
    /ar5iv/i.test(options.baseUrl ?? '') ||
    /ar5iv\.labs\.arxiv\.org|<title>\s*\[[\d.]+\]/.test(source)
      ? 'ar5iv'
      : watermark.arxiv || /arxiv\.org/.test(options.baseUrl ?? '')
        ? 'arxiv'
        : undefined;

  const result: ScholarlyDocument = {
    abstracts,
    back,
    body,
    diagnostics: ctx.diag.finish('structured'),
    ...(flavor && { flavor }),
    floats: [],
    footnotes: ctx.footnotes,
    format: 'latexml',
    metadata,
    references,
  };
  return parsed(result);
}

interface Watermark {
  arxiv?: string;
  published?: PartialDate;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * arXiv stamps each render with `arXiv:2401.04088v1 [cs.LG] 08 Jan 2024`; that line
 * gives the identifier and version date. The page URL is the fallback for the identifier.
 */
function parseWatermark(document: Document, baseUrl: string | undefined): Watermark {
  const text =
    textOfElement(document.querySelector('#watermark-tr')) ||
    textOfElement(document.querySelector('.ltx_page_main')).slice(0, 400);
  const match =
    /arXiv:(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)\s*\[[^\]]+\]\s*(\d{1,2}) (\w{3}) (\d{4})/.exec(
      text,
    );
  const fromUrl = /\/(?:html|abs)\/(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+\/\d{7}(?:v\d+)?)/.exec(
    baseUrl ?? '',
  )?.[1];
  const arxiv = match?.[1] ?? fromUrl;
  const month = match ? MONTHS.indexOf((match[3] ?? '').toLowerCase()) + 1 : 0;
  const published =
    match && month > 0 ? { day: Number(match[2]), month, year: Number(match[4]) } : undefined;
  return { ...(arxiv && { arxiv }), ...(published && { published }) };
}

function extractMetadata(
  article: Element,
  document: Document,
  watermark: Watermark,
  ctx: LatexmlContext,
): DocumentMetadata {
  const title = inlineText(article.querySelector('.ltx_title_document'), ctx);
  const subtitle = inlineText(article.querySelector('.ltx_subtitle'), ctx);
  const { affiliations, authors } = extractAuthors(article);
  const keywordsEl = article.querySelector('.ltx_keywords');
  const keywords = keywordsEl
    ? textOfElement(keywordsEl)
        .replace(/^keywords?\s*[:.]?\s*/i, '')
        .split(/\s*[,;·]\s*/)
        .filter(Boolean)
    : [];
  const language = document.documentElement?.getAttribute('lang') ?? undefined;
  return {
    ...(title && { title }),
    ...(subtitle && { subtitle }),
    ...(authors.length > 0 && { authors }),
    ...(affiliations.length > 0 && { affiliations }),
    ...(watermark.arxiv && { identifiers: { arxiv: watermark.arxiv } }),
    ...(watermark.published && { published: watermark.published }),
    ...(keywords.length > 0 && { keywords }),
    ...(language && { language }),
  };
}

/** Text of a node list with notes left out, whitespace collapsed. */
function plainWithoutNotes(nodes: Node[]): string {
  return nodes
    .map((node) => {
      if (!isElement(node)) return node.textContent ?? '';
      if (
        hasClass(node, 'ltx_note') ||
        hasClass(node, 'ltx_note_mark') ||
        hasClass(node, 'ltx_author_notes')
      )
        return '';
      if (tagOf(node) === 'br') return '\n';
      return plainWithoutNotes(childNodes(node));
    })
    .join('');
}

/** Two to five capitalized words: what a person's name looks like when splitting a list of them. */
const NAME_LIKE = /^(?:[\p{Lu}][\p{L}'.-]*\s+){1,4}[\p{Lu}][\p{L}'.-]*$/u;

/**
 * Authors from `ltx_creator ltx_role_author`. A name line followed by more lines inside
 * one `ltx_personname` is `\author{Name \\ Affiliation}`: the extra lines are
 * affiliations. One person-name holding a comma- or "and"-separated run of names is
 * split only when every piece looks like a name.
 */
function extractAuthors(article: Element): { affiliations: string[]; authors: Author[] } {
  const affiliations: string[] = [];
  const affIndex = (value: string) => {
    const existing = affiliations.indexOf(value);
    return existing === -1 ? affiliations.push(value) - 1 : existing;
  };
  const authors: Author[] = [];
  for (const creator of Array.from(
    article.querySelectorAll('.ltx_authors .ltx_creator.ltx_role_author'),
  )) {
    const person = creator.querySelector('.ltx_personname');
    const lines = plainWithoutNotes(person ? childNodes(person) : [])
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const [nameLine, ...rest] = lines;
    if (!nameLine) continue;
    const emails = rest.filter((line) => /@/.test(line));
    const affLines = rest.filter((line) => !/@/.test(line));
    for (const contact of Array.from(creator.querySelectorAll('.ltx_contact'))) {
      const value = textOfElement(contact).replace(/^(affiliation|address|email)\s*:\s*/i, '');
      if (!value) continue;
      if (hasClass(contact, 'ltx_role_email')) emails.push(value);
      else if (hasClass(contact, 'ltx_role_affiliation') || hasClass(contact, 'ltx_role_address'))
        affLines.push(value);
    }
    const indices = [...new Set(affLines.map(affIndex))];
    const pieces = nameLine.split(/\s*,\s*|\s+and\s+/).filter(Boolean);
    const names = pieces.length > 1 && pieces.every((p) => NAME_LIKE.test(p)) ? pieces : [nameLine];
    for (const name of names) {
      authors.push({
        name,
        ...(indices.length > 0 && { affiliations: indices }),
        ...(names.length === 1 && emails[0] && { email: emails[0] }),
      });
    }
  }
  return { affiliations, authors };
}

/** A heading that only names the abstract, as templates print it (`Abstract`, `Abstract.`). */
const ABSTRACT_HEADING = /^abstract[.:]?$/i;

function extractAbstracts(article: Element, ctx: LatexmlContext): Abstract[] {
  return Array.from(article.querySelectorAll('.ltx_abstract')).flatMap((abstract, index) => {
    const heading = childElements(abstract).find((c) => /^h[1-6]$/.test(tagOf(c)));
    const blocks = flowBlocks(
      childNodes(abstract).filter((n) => n !== heading),
      ctx,
    );
    if (blocks.length === 0) return [];
    const title = textOfElement(heading);
    return [
      {
        kind: 'main' as const,
        sections: [
          {
            blocks,
            id: issueId(ctx.sectionIds, undefined, `abstract-${index + 1}`),
            kind: 'body' as const,
            sections: [],
          },
        ],
        ...(title && !ABSTRACT_HEADING.test(title) && { title }),
      },
    ];
  });
}

/** A paragraph opening with "Abstract" set as a bold run-in heading (`**Abstract.** We…`). */
const RUN_IN_ABSTRACT = /^\*\*Abstract[.:]?\*\*[.:]?\s*/i;

/**
 * A paper that sets its abstract by hand rather than with the abstract environment: its
 * first titled body section when that section is an unnumbered "Abstract"
 * (`\section*{Abstract}`), else a paragraph before that section with a bold "Abstract"
 * run-in heading.
 */
function abstractFromBody(
  body: Section[],
  ctx: LatexmlContext,
): { abstracts: Abstract[]; body: Section[] } {
  const index = body.findIndex((section) => section.title);
  const section = body[index];
  if (section && !section.label && ABSTRACT_HEADING.test(section.title ?? '')) {
    const part: Section = {
      blocks: section.blocks,
      id: section.id,
      kind: 'body',
      sections: section.sections,
    };
    return { abstracts: [{ kind: 'main', sections: [part] }], body: body.toSpliced(index, 1) };
  }
  // Front matter set by hand sits in the untitled sections before the first titled one.
  const leading = index === -1 ? body : body.slice(0, index);
  for (const [at, untitled] of leading.entries()) {
    const found = untitled.blocks.findIndex(
      (block) => block.type === 'paragraph' && RUN_IN_ABSTRACT.test(block.text),
    );
    const paragraph = untitled.blocks[found];
    if (paragraph?.type !== 'paragraph') continue;
    const part: Section = {
      blocks: [{ text: paragraph.text.replace(RUN_IN_ABSTRACT, ''), type: 'paragraph' }],
      id: issueId(ctx.sectionIds, undefined, 'abstract-1'),
      kind: 'body',
      sections: [],
    };
    const blocks = untitled.blocks.toSpliced(found, 1);
    const rest =
      blocks.length > 0 || untitled.sections.length > 0
        ? body.toSpliced(at, 1, { ...untitled, blocks })
        : body.toSpliced(at, 1);
    return { abstracts: [{ kind: 'main', sections: [part] }], body: rest };
  }
  return { abstracts: [], body };
}

/** Direct children of the article that are front matter, not content. */
const FRONT_CLASSES = [
  'ltx_title_document',
  'ltx_subtitle',
  'ltx_authors',
  'ltx_abstract',
  'ltx_keywords',
  'ltx_classification',
  'ltx_dates',
  'ltx_date',
  'ltx_pubnotes',
  'ltx_role_thanks',
];

/** LaTeXML's sectioning classes and the level each opens. */
const SECTION_LEVELS: [string, number][] = [
  ['ltx_chapter', 0],
  ['ltx_section', 1],
  ['ltx_appendix', 1],
  ['ltx_bibliography', 1],
  ['ltx_acknowledgement', 1],
  ['ltx_acknowledgements', 1],
  ['ltx_subsection', 2],
  ['ltx_subsubsection', 3],
  ['ltx_paragraph', 4],
  ['ltx_subparagraph', 5],
];

function sectionLevel(element: Element): number | undefined {
  return SECTION_LEVELS.find(([name]) => hasClass(element, name))?.[1];
}

/** True when a section sits inside an ancestor section of the same or a deeper level. */
function misplaced(section: Element, level: number, article: Element): boolean {
  for (let el = section.parentElement; el && el !== article; el = el.parentElement) {
    const above = sectionLevel(el);
    if (above !== undefined && above >= level) return true;
  }
  return false;
}

/**
 * Rebuild the section tree when the markup got it wrong. An inline element LaTeXML
 * leaves unclosed (a `<span>` around a macro it could not expand) swallows every section
 * after it, so §4 parses inside a paragraph of §3. Sectioning classes carry their level,
 * so the tree is rebuilt the way a heading outline is: in document order, each section
 * under the nearest section before it of a shallower level, else at the top.
 */
function repairSectionNesting(article: Element): void {
  const sections = Array.from(article.querySelectorAll('section')).flatMap((element) => {
    const level = sectionLevel(element);
    return level === undefined ? [] : [{ element, level }];
  });
  if (!sections.some(({ element, level }) => misplaced(element, level, article))) return;
  const open: { element: Element; level: number }[] = [];
  for (const section of sections) {
    while ((open.at(-1)?.level ?? -1) >= section.level) open.pop();
    (open.at(-1)?.element ?? article).append(section.element);
    open.push(section);
  }
}

function extractContent(
  article: Element,
  ctx: LatexmlContext,
): { back: Section[]; body: Section[]; references: Reference[] } {
  repairSectionNesting(article);
  const body: Section[] = [];
  const back: Section[] = [];
  // A bibliography placed inside the last section is still the paper's reference list, not section content.
  const bibliography = article.querySelector('.ltx_bibliography');
  const references: Reference[] = bibliography ? extractReferences(bibliography, ctx) : [];
  bibliography?.remove();
  let pending: Block[] = [];
  const flushPending = () => {
    if (pending.length === 0) return;
    body.push({
      blocks: pending,
      id: issueId(ctx.sectionIds, undefined, `s${body.length + 1}`),
      kind: 'body',
      sections: [],
    });
    pending = [];
  };

  for (const child of childNodes(article)) {
    if (!isElement(child)) {
      pending.push(...flowBlocks([child], ctx));
      continue;
    }
    if (FRONT_CLASSES.some((c) => hasClass(child, c))) continue;
    const acknowledgments =
      hasClass(child, 'ltx_acknowledgement') || hasClass(child, 'ltx_acknowledgements');
    const isSection =
      tagOf(child) === 'section' || hasClass(child, 'ltx_appendix') || acknowledgments;
    if (!isSection) {
      pending.push(...flowBlocks([child], ctx));
      continue;
    }
    flushPending();
    if (hasClass(child, 'ltx_appendix')) {
      const section = parseSection(child, ctx, 'appendix', `appendix${back.length + 1}`);
      if (section) back.push(section);
    } else if (acknowledgments) {
      const section = parseSection(child, ctx, 'acknowledgments', 'acknowledgments');
      if (section) back.push(section);
    } else if (!hasClass(child, 'ltx_index')) {
      const section = parseSection(child, ctx, 'body', `s${body.length + 1}`);
      const kind = kindFromTitle(section?.title);
      if (section && kind) back.push(withKind(section, kind));
      else if (section) body.push(section);
    }
  }
  flushPending();
  return { back, body, references };
}

/** A section and its subsections, re-kinded. */
function withKind(section: Section, kind: SectionKind): Section {
  return { ...section, kind, sections: section.sections.map((sub) => withKind(sub, kind)) };
}

const DOI = /\b(10\.\d{4,9}\/[^\s"<>]+?)(?=[.,;)]?(?:\s|$))/i;
const ARXIV = /arXiv[:\s]+(\d{4}\.\d{4,5}(?:v\d+)?)/i;

/** The bibliography: one reference per `ltx_bibitem`, its printed tag as the label. */
function extractReferences(bibliography: Element, ctx: LatexmlContext): Reference[] {
  return Array.from(bibliography.querySelectorAll('.ltx_bibitem')).flatMap((item) => {
    const tagSpan = item.querySelector('.ltx_tag_bibitem');
    const label = textOfElement(tagSpan).replace(/^\[|\]$/g, '') || undefined;
    const blocks = Array.from(item.querySelectorAll('.ltx_bibblock'));
    const text = (
      blocks.length > 0
        ? blocks
            .map((block) => inlineText(block, ctx))
            .filter(Boolean)
            .join(' ')
        : inlineMarkdown(
            childNodes(item).filter((n) => n !== tagSpan),
            ctx,
          )
    )
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return [];
    const plain = textOfElement(item);
    const hrefs = Array.from(item.querySelectorAll('a[href]')).map((a) =>
      resolveUrl(a.getAttribute('href') ?? '', ctx.baseUrl),
    );
    const doi = (
      hrefs.map((h) => /doi\.org\/(10\.\d{4,9}\/\S+)/i.exec(h)?.[1]).find(Boolean) ??
      DOI.exec(plain)?.[1]
    )?.toLowerCase();
    const arxiv = ARXIV.exec(plain)?.[1];
    const url = doi ? undefined : hrefs.find((h) => /^https?:/i.test(h) && !h.includes('#'));
    const id = item.getAttribute('id') ?? undefined;
    return [
      {
        ...(id && { id }),
        ...(label && { label }),
        text,
        ...(doi && { doi }),
        ...(arxiv && { arxiv }),
        ...(url && { url }),
      },
    ];
  });
}
