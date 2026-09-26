/**
 * @fileoverview Lines in reading order → the document's parts. A PDF carries no markup,
 * so the parts are read from presentation: the title from size, the front matter and
 * abstract from where the first section heading falls, the section tree from heading
 * size, weight, case, and numbering, and footnotes from small type below a page's text.
 * @module src/formats/pdf/structure
 */
import type { DiagnosticsCollector } from '../../model/diagnostics.js';
import type { Reference, Section, SectionKind } from '../../model/document.js';
import { issueId } from '../../model/section-ids.js';
import { kindFromTitle, splitSectionNumber } from '../../model/section-kinds.js';
import { escapeInline } from '../../render/escape.js';
import { flow } from './blocks.js';
import { joinLines } from './inline.js';
import { byColumn, cellText, type Layout, type Line, linesSize } from './layout.js';
import {
  ABSTRACT_HEADING,
  ABSTRACT_RUN_IN,
  bareTitle,
  CAPTION_START,
  type HeadingStyle,
  headingOf,
  isCaptionStart,
  KEYWORDS_LINE,
  REFERENCES_HEADING,
  styleOf,
  words,
} from './lines.js';
import type { Run } from './load.js';
import { references } from './references.js';

export interface PdfContext {
  diag: DiagnosticsCollector;
  sectionIds: Set<string>;
}

export interface PdfStructure {
  /** The abstract's parts: one untitled section, or a structured abstract's titled ones. */
  abstract: Section[];
  back: Section[];
  body: Section[];
  keywords: string[];
  references: Reference[];
  title?: string;
}

/** Headings of a structured abstract's parts, set as small headings or bold run-in labels. */
const ABSTRACT_PART =
  /^(?:background|context|importance|introduction|aims?|objectives?|purpose|hypothes[ie]s|design|setting|participants|patients|interventions?|methods?|methodology|materials and methods|measurements|main outcome measures?|results?|findings|conclusions?|interpretation|implications|significance|case (?:presentation|report|description)|trial registration|registration|funding|evidence before this study|added value of this study|implications of all the available evidence)$/i;

interface RawSection {
  depth?: number;
  lines: Line[];
  sections: RawSection[];
  style: HeadingStyle;
  title: string;
}

interface AbstractPart {
  lines: Line[];
  title?: string;
}

/** The document's parts as lines, before they become blocks. */
interface Collected {
  abstract: AbstractPart[];
  /** The size the abstract text is set in. */
  abstractSize?: number;
  keywords: string[];
  references?: RawSection;
  roots: RawSection[];
}

/**
 * Split the document into its parts. Everything before the abstract or the first
 * section heading is the byline and publisher front matter, and is not kept.
 */
export function structure(layout: Layout, ctx: PdfContext): PdfStructure {
  const title = titleOf(layout.lines, layout.bodySize);
  const footnotes = footnoteLines(layout.lines, layout.bodySize);
  let parts = collect(layout, title.lines, footnotes, false);
  // No section heading was recognized as one: fall back to taking any heading as the first.
  if (parts.roots.length === 0) parts = collect(layout, title.lines, footnotes, true);
  if (!parts.references) ctx.diag.warn('structure-inferred', 'No reference list heading was found');

  const result: PdfStructure = {
    abstract: [],
    back: [],
    body: [],
    keywords: parts.keywords,
    references: [],
    ...(title.text && { title: title.text }),
  };
  for (const part of parts.abstract) {
    const blocks = flow(part.lines, layout, parts.abstractSize);
    if (blocks.length === 0 && !part.title) continue;
    const id = issueId(ctx.sectionIds, undefined, 'abstract');
    result.abstract.push({
      blocks,
      id,
      kind: 'body',
      sections: [],
      ...(part.title && { title: escapeInline(part.title) }),
    });
  }
  let afterReferences = false;
  for (const raw of parts.roots) {
    if (raw === parts.references) {
      result.references = references(raw.lines, layout);
      afterReferences = true;
      continue;
    }
    const kind: SectionKind | undefined =
      kindFromTitle(bareTitle(raw.title)) ?? (afterReferences ? 'appendix' : undefined);
    const section = convert(raw, kind ?? 'body', layout, ctx);
    if (section) (kind ? result.back : result.body).push(section);
  }
  return result;
}

/** The title: the largest text of several words on the first page, in the runs set at that size. */
function titleOf(lines: Line[], bodySize: number): { lines: Set<Line>; text?: string } {
  const groups: Line[][] = [];
  for (const line of lines.filter((l) => l.page === lines[0]?.page)) {
    const group = groups.at(-1);
    const last = group?.at(-1);
    if (group && last && Math.abs(last.size - line.size) <= 0.5) group.push(line);
    else groups.push([line]);
  }
  const [group] = groups
    .filter(
      (g) =>
        (g[0]?.size ?? 0) >= bodySize * 1.25 && words(g.map((line) => line.text).join(' ')) >= 3,
    )
    .sort((a, b) => (b[0]?.size ?? 0) - (a[0]?.size ?? 0));
  if (!group) return { lines: new Set() };
  const size = group[0]?.size ?? 0;
  // A label set beside the title ("OPEN") or a footnote mark on it is another size.
  // A title is set ragged, so a hyphen closing one of its lines belongs to a compound ("sixth-order").
  const text = group
    .map((line) =>
      line.cells
        .map((cell) => cellText(cell.filter((run) => Math.abs(run.size - size) <= 0.6)))
        .filter(Boolean)
        .join(' '),
    )
    .reduce((joined, part) => (/[-‐]$/.test(joined) ? joined + part : `${joined} ${part}`))
    .replace(/\s+/g, ' ')
    .trim();
  return { lines: new Set(group), ...(text && { text }) };
}

/**
 * Small lines closing a page's column, set off by a gap below all of its body text:
 * footnotes, affiliations, a correspondence address, a licence statement.
 */
function footnoteLines(lines: Line[], bodySize: number): Set<Line> {
  const small = (line: Line) => line.size < bodySize - 0.3;
  const found = new Set<Line>();
  for (const column of byColumn(lines).values()) {
    let start = column.length;
    while (
      start > 0 &&
      small(column[start - 1] as Line) &&
      !headingOf(column[start - 1] as Line, bodySize)
    )
      start--;
    const zone = column.slice(start);
    const [first] = column;
    const [top] = zone;
    if (!first || !top || zone.some(isCaptionStart)) continue;
    const previous = column[start - 1];
    if (previous && previous.y - top.y <= 1.6 * Math.max(previous.size, top.size)) continue;
    const above = lines.filter(
      (line) =>
        line.page === first.page &&
        !small(line) &&
        (first.column === -1 || line.column === first.column || line.column === -1),
    );
    const floor = Math.min(...above.map((line) => line.y));
    if (zone.every((line) => line.y < floor)) for (const line of zone) found.add(line);
  }
  return found;
}

/** An abstract set without a heading: the longest run of same-style lines in the front matter. */
function unlabeledAbstract(front: Line[], bodySize: number): Line[] {
  const blocks: Line[][] = [];
  for (const line of front) {
    const block = blocks.at(-1);
    const last = block?.at(-1);
    const gap = last ? last.y - line.y : 0;
    const continues =
      last &&
      last.page === line.page &&
      last.column === line.column &&
      Math.abs(last.size - line.size) <= 0.3 &&
      last.bold === line.bold &&
      gap > 0 &&
      gap <= line.size * 1.8;
    if (block && continues) block.push(line);
    else blocks.push([line]);
  }
  const count = (block: Line[]) => words(block.map((line) => line.text).join(' '));
  const [best] = blocks
    .filter((block) => (block[0]?.size ?? 0) >= bodySize * 0.85)
    .sort((a, b) => count(b) - count(a));
  return best && count(best) >= 50 ? best : [];
}

/** The bold runs opening a line that goes on in regular type, and the rest of the line. */
function leadingLabel(line: Line): { label: string; rest: Line } | undefined {
  const [first = [], ...others] = line.cells;
  const count = first.findIndex((run) => !run.bold && run.text.trim() !== '');
  if (count <= 0) return;
  const cells = [first.slice(count), ...others];
  return {
    label: cellText(first.slice(0, count)),
    rest: { ...line, cells, text: cells.map(cellText).join(' ') },
  };
}

/** A structured abstract's run-in label (`Background`, `Case presentation:`), and the rest of the line. */
function abstractLabel(line: Line): { rest: Line; title: string } | undefined {
  const found = leadingLabel(line);
  const title = found?.label.replace(/[.:]$/, '').trim();
  if (
    !found ||
    !title ||
    words(title) > 5 ||
    !(ABSTRACT_PART.test(title) || /[.:]$/.test(found.label))
  )
    return;
  return { rest: found.rest, title };
}

/** A run-in subsection heading: a bold label ending in a full stop that opens a paragraph (`Sampling locations.`). */
function runInHeading(
  line: Line,
  previous: Line | undefined,
): { rest: Line; title: string } | undefined {
  if ((previous && !/[.!?:]["”’)]?$/.test(previous.text)) || isCaptionStart(line)) return;
  const found = leadingLabel(line);
  if (
    !found ||
    !/[.:]$/.test(found.label) ||
    words(found.label) > 10 ||
    !/^(?:(?:\d{1,2}\.)*\d{1,2}\.?\s+)?\p{Lu}/u.test(found.label)
  )
    return;
  return { rest: found.rest, title: found.label.replace(/[.:]$/, '').trim() };
}

/**
 * Walk the lines once, sorting each into the front matter (dropped), the abstract, the
 * keywords, or a section. `lenient` lets any heading end the front matter, for papers
 * whose section headings are neither numbered nor named the usual way.
 */
function collect(
  layout: Layout,
  title: Set<Line>,
  footnotes: Set<Line>,
  lenient: boolean,
): Collected {
  const { bodySize, lines } = layout;
  const edges = columnEdges(lines, bodySize);
  const out: Collected = { abstract: [], keywords: [], roots: [] };
  const stack: RawSection[] = [];
  const front: Line[] = [];
  const partTitles = new Set<string>();
  // Widened so the checks below see the moves `startBody` makes.
  let state = 'front' as 'front' | 'abstract' | 'body';
  let inReferences = false;

  const bodySized = (line: Line) => Math.abs(line.size - bodySize) <= 0.3;
  // An abstract set in its own size ends where body-size text begins.
  const distinctAbstract = () =>
    out.abstractSize !== undefined && Math.abs(out.abstractSize - bodySize) >= 0.5;
  const addPart = (partTitle?: string) => {
    out.abstract.push({ lines: [], ...(partTitle && { title: partTitle }) });
    if (partTitle) partTitles.add(partTitle.toLowerCase());
  };
  const addAbstract = (line: Line) => {
    // A short bold line of its own inside the abstract titles its next part.
    if (
      line.bold &&
      words(line.text) <= 5 &&
      !/[.,;]$/.test(line.text) &&
      out.abstract.at(-1)?.lines.length !== 0
    ) {
      addPart(line.text.replace(/:$/, '').trim());
      return;
    }
    const label = abstractLabel(line);
    if (label) addPart(label.title);
    else if (out.abstract.length === 0) addPart();
    out.abstract.at(-1)?.lines.push(label?.rest ?? line);
    out.abstractSize ??= line.size;
  };
  // Leaving the front matter with no abstract found: look back for one set without a heading.
  const adoptUnlabeled = () => {
    if (state !== 'front' || out.abstract.length > 0) return;
    const found = unlabeledAbstract(front, bodySize);
    if (found.length > 0) {
      out.abstract.push({ lines: found });
      out.abstractSize = (found[0] as Line).size;
    }
  };
  const startBody = () => {
    adoptUnlabeled();
    state = 'body';
  };
  const bodyLine = (line: Line) => {
    if (inReferences) {
      out.references?.lines.push(line);
      return;
    }
    if (stack.length === 0)
      placeSection(
        { lines: [], sections: [], style: { bold: false, size: 0, upper: false }, title: '' },
        out.roots,
        stack,
      );
    stack.at(-1)?.lines.push(line);
  };
  const open = (section: RawSection) => {
    if (!out.references && REFERENCES_HEADING.test(bareTitle(section.title))) {
      // The reference list stands at the top level whatever its heading style.
      out.references = section;
      out.roots.push(section);
      stack.length = 0;
      inReferences = true;
      return;
    }
    // Back matter (acknowledgements, data availability) never sits inside a body section.
    if (
      inReferences ||
      (!section.style.runIn &&
        isBackMatter(section) &&
        stack.some((ancestor) => !isBackMatter(ancestor)))
    ) {
      inReferences = false;
      stack.length = 0;
    }
    placeSection(section, out.roots, stack);
  };

  // Lines set above the title (a journal banner, the article type) are never the article's own.
  let beforeTitle = title.size > 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as Line;
    if (title.has(line)) beforeTitle = false;
    if (beforeTitle || title.has(line) || (!out.references && footnotes.has(line))) continue;

    const keywords = KEYWORDS_LINE.exec(line.text);
    if (keywords && out.keywords.length === 0 && !out.references && line.page <= 2) {
      // A keyword list runs on over the following lines until it ends with a full stop or a gap.
      const texts = [line.text.slice(keywords[0].length)];
      for (let last = line; i + 1 < lines.length && !/\.$/.test(joinLines(texts)); ) {
        const next = lines[i + 1] as Line;
        const gap = last.y - next.y;
        if (
          next.page !== last.page ||
          next.column !== last.column ||
          Math.abs(next.size - last.size) > 0.3 ||
          gap <= 0 ||
          gap > next.size * 1.7 ||
          headingOf(next, bodySize)
        )
          break;
        texts.push(next.text);
        last = next;
        i++;
      }
      out.keywords = joinLines(texts)
        .split(/\s*[;,·•]\s*/)
        .map((keyword) => keyword.replace(/\.$/, '').trim())
        .filter(Boolean);
      adoptUnlabeled();
      if (state === 'abstract') state = 'front';
      continue;
    }

    const heading = headingOf(line, bodySize);
    if (heading) {
      const bare = bareTitle(line.text.trim());
      const style = styleOf(line, line.text.trim());
      const atBodySize = line.size >= bodySize - 0.3;
      if (
        ABSTRACT_HEADING.test(bare) &&
        out.abstract.length === 0 &&
        !out.references &&
        line.page <= 3
      ) {
        state = 'abstract';
        continue;
      }
      // Inside the reference list only a heading as prominent as its own, or a numbered or named one, ends it.
      if (
        inReferences &&
        out.references &&
        !heading.strong &&
        outranks(out.references.style, style)
      ) {
        bodyLine(line);
        continue;
      }
      if (state === 'front' && !lenient) {
        if (out.abstract.length === 0 && !atBodySize && ABSTRACT_PART.test(bare)) {
          state = 'abstract';
          addPart(bare);
          continue;
        }
        if (!(heading.strong && atBodySize)) {
          front.push(line);
          continue;
        }
      }
      if (state === 'abstract') {
        const lower = bare.toLowerCase();
        const structured = partTitles.size > 0;
        const empty = out.abstract.every((part) => part.lines.length === 0);
        const isPart =
          !atBodySize ||
          (!heading.depth &&
            ABSTRACT_PART.test(bare) &&
            !partTitles.has(lower) &&
            (empty || (structured && lower !== 'introduction'))) ||
          (structured && !heading.strong && line.bold && words(bare) <= 5);
        if (isPart) {
          addPart(bare);
          continue;
        }
      }
      if (state !== 'body') startBody();

      // A heading wrapped over several lines: each further line has the same style, and the
      // line before it stopped only because the next word would not fit.
      let text = line.text.trim();
      for (
        let last = line, next = lines[i + 1];
        next && (line.bold || line.size > bodySize + 0.9);
        last = next, next = lines[i + 1]
      ) {
        const joins =
          next.page === last.page &&
          next.size === last.size &&
          next.bold === last.bold &&
          !headingOf(next, bodySize)?.strong &&
          words(next.text) <= 12 &&
          !/[.:]$/.test(text) &&
          last.y - next.y < last.size * 1.6 &&
          !CAPTION_START.test(next.text) &&
          wrapped(last, next, edges);
        if (!joins) break;
        text = `${text} ${next.text.trim()}`;
        i++;
      }
      open({
        lines: [],
        sections: [],
        style,
        title: text,
        ...(heading.depth && { depth: heading.depth }),
      });
      continue;
    }

    if (state === 'front') {
      const runIn = ABSTRACT_RUN_IN.exec(line.text);
      if (runIn && out.abstract.length === 0) {
        state = 'abstract';
        addAbstract({
          ...line,
          cells: trimCells(line, runIn[0]),
          text: line.text.slice(runIn[0].length),
        });
      } else if (
        out.abstract.length > 0 &&
        bodySized(line) &&
        !line.bold &&
        words(line.text) >= 5
      ) {
        // Body text after the abstract with no heading of its own: an untitled opening section.
        startBody();
        bodyLine(line);
      } else {
        front.push(line);
      }
      continue;
    }
    if (state === 'abstract') {
      if (distinctAbstract() && bodySized(line) && words(line.text) >= 5) {
        startBody();
        bodyLine(line);
      } else {
        addAbstract(line);
      }
      continue;
    }
    // Back matter's bold labels (`Conceptualization:`, `Funding:`) are its text, not subsections.
    const inBackMatter = stack.some((ancestor) => !ancestor.style.runIn && isBackMatter(ancestor));
    const runIn =
      inReferences || inBackMatter ? undefined : runInHeading(line, stack.at(-1)?.lines.at(-1));
    if (runIn) {
      const number = /^((?:\d{1,2}\.)*\d{1,2})\.?\s/.exec(runIn.title)?.[1];
      const style = { ...styleOf(line, runIn.title), bold: true, runIn: true };
      open({
        lines: [runIn.rest],
        sections: [],
        style,
        title: runIn.title,
        ...(number && { depth: number.split('.').length }),
      });
      continue;
    }
    bodyLine(line);
  }
  return out;
}

/** Where each page column's text ends on the right: the furthest reach of most of its body lines. */
function columnEdges(lines: Line[], bodySize: number): Map<string, number> {
  const rights = new Map<string, number[]>();
  for (const line of lines) {
    if (Math.abs(line.size - bodySize) > 0.6) continue;
    for (const key of [`${line.page}:${line.column}`, `${line.page}:*`]) {
      const values = rights.get(key);
      if (values) values.push(line.right);
      else rights.set(key, [line.right]);
    }
  }
  return new Map(
    [...rights].map(([key, values]) => [
      key,
      values.sort((a, b) => a - b)[Math.floor(values.length * 0.9)] ?? 0,
    ]),
  );
}

/** Whether `line` ended only because the first word of `next` would not fit before its column's edge. */
function wrapped(line: Line, next: Line, edges: Map<string, number>): boolean {
  const edge =
    edges.get(`${line.page}:${line.column}`) ?? edges.get(`${line.page}:*`) ?? line.right;
  const firstWord = next.text.split(/\s+/)[0] ?? '';
  const wordWidth = ((next.right - next.x) * firstWord.length) / Math.max(1, next.text.length);
  return line.right + wordWidth + line.size * 0.25 >= edge - line.size * 0.5;
}

/** A line's cells without its opening `prefix`, matched by its non-space characters (runs may not carry the spaces between them). */
function trimCells(line: Line, prefix: string): Run[][] {
  let remaining = prefix.replace(/\s/g, '').length;
  return line.cells.map((cell) =>
    cell.flatMap((run) => {
      if (remaining <= 0) return [run];
      let cut = 0;
      while (cut < run.text.length && remaining > 0) {
        if (!/\s/.test(run.text[cut] ?? '')) remaining--;
        cut++;
      }
      const text = run.text.slice(cut).replace(/^\s+/, '');
      return text ? [{ ...run, text }] : [];
    }),
  );
}

/**
 * Whether a heading in style `a` ranks above one in style `b`: larger; or as large and
 * bold where the other is not; or in capitals where the other is not; or on its own line
 * where the other runs in.
 */
function outranks(a: HeadingStyle, b: HeadingStyle): boolean {
  if (Math.abs(a.size - b.size) > 0.4) return a.size > b.size;
  if (a.bold !== b.bold) return a.bold;
  if (a.upper !== b.upper) return a.upper;
  return !a.runIn && !!b.runIn;
}

/** Whether a section is back matter by its heading (acknowledgements, funding, data availability). */
function isBackMatter(raw: RawSection): boolean {
  return kindFromTitle(bareTitle(raw.title)) !== undefined;
}

/** Nest a section by its depth (from numbering) or, unnumbered, by its heading style. */
function placeSection(section: RawSection, roots: RawSection[], stack: RawSection[]): void {
  const above = (a: RawSection, b: RawSection) =>
    a.depth !== undefined && b.depth !== undefined ? a.depth < b.depth : outranks(a.style, b.style);
  while (stack.length > 0 && !above(stack.at(-1) as RawSection, section)) stack.pop();
  const parent = stack.at(-1);
  (parent ? parent.sections : roots).push(section);
  stack.push(section);
}

function convert(
  raw: RawSection,
  kind: SectionKind,
  layout: Layout,
  ctx: PdfContext,
): Section | undefined {
  const printed = splitSectionNumber(escapeInline(raw.title.replace(/[.:]$/, '')), undefined);
  const id = issueId(ctx.sectionIds, undefined, `s${ctx.sectionIds.size + 1}`);
  // Back matter set smaller than the body keeps its text: small means small for this section.
  const blocks = flow(
    raw.lines,
    layout,
    Math.min(layout.bodySize, linesSize(raw.lines) || layout.bodySize),
  );
  const sections = raw.sections
    .map((sub) => convert(sub, kind, layout, ctx))
    .filter((s): s is Section => s !== undefined);
  if (blocks.length === 0 && sections.length === 0 && !printed.title) {
    ctx.sectionIds.delete(id);
    return;
  }
  return {
    blocks,
    id,
    kind,
    ...(printed.label && { label: printed.label }),
    sections,
    ...(printed.title && { title: printed.title }),
  };
}
