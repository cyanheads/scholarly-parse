/**
 * @fileoverview What lies below an element of a publisher page — which kinds of element,
 * its first image, math, number, or caption element, and its text in the forms the
 * parser reads it — each computed once per element from its children's and kept for the
 * parse. A walk that asks at every level of a deeply nested chain then reads each
 * subtree once, not once per element around it. Each fact reads the tree as the DOM
 * query it stands for does: a selector query leaves a `<template>`'s content out, and
 * `textContent` leaves comments out.
 * @module src/formats/html/subtree
 */

import {
  CDATA_SECTION_NODE,
  childElements,
  childNodes,
  isElement,
  TEXT_NODE,
  tagOf,
  textOfElement,
} from '../../html/dom.js';
import { type HtmlContext, isFurniture, nameTokens } from './context.js';

/** Block-level tags: an element is walked for blocks when one of these sits below it. */
export const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'address',
  'article',
  'blockquote',
  'center',
  'details',
  'div',
  'dl',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'main',
  'ol',
  'p',
  'pre',
  'section',
  'summary',
  'table',
  'ul',
]);

// ─── Elements below ─────────────────────────────────────────────────────────

/** Kinds of element a selector query can find below an element, one bit each. */
export const BELOW = {
  /** One of {@link BLOCK_TAGS}. */
  block: 1,
  /** `a[href]`. */
  link: 2,
  math: 4,
  /** `script[type^="math/"]`. */
  mathScript: 8,
  script: 16,
  table: 32,
  figure: 64,
  /** `img`, `picture`, `object`. */
  image: 128,
  /** `img:not([class*="math"])`: an image that is not a formula's. */
  plainImage: 256,
  /** `h1`, `h2`, `section`, `article`: what makes a region of a class-named wrapper. */
  sectioning: 512,
} as const;

/** What sits below an element. */
export interface Below {
  /** The first, in document order, that reads as a caption and has text, with no furniture between. */
  firstCaption?: Element | undefined;
  firstImage?: Element | undefined;
  firstMath?: Element | undefined;
  /** The first `script[type^="math/"]`. */
  firstMathScript?: Element | undefined;
  /** The first whose class names an equation number (`number`, `label`, `eqno`, `note`). */
  firstNumbered?: Element | undefined;
  /** `<img>`s, counted to 2. */
  images: number;
  /** The {@link BELOW} kinds present. */
  kinds: number;
  /** The child of the element that is or holds {@link firstNumbered}. */
  numberedChild?: Element | undefined;
  /** `<table>`s, counted to 2. */
  tables: number;
}

const NUMBER_TOKENS: ReadonlySet<string> = new Set(['number', 'label', 'eqno', 'note']);
const CAPTION_TAGS: ReadonlySet<string> = new Set([
  'figcaption',
  'caption',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

/** The {@link BELOW} kinds `element` itself is. */
function kindsOf(element: Element, tag: string): number {
  let kinds = BLOCK_TAGS.has(tag) ? BELOW.block : 0;
  if (tag === 'a' && element.hasAttribute('href')) kinds |= BELOW.link;
  else if (tag === 'math') kinds |= BELOW.math;
  else if (tag === 'script')
    kinds |=
      BELOW.script |
      ((element.getAttribute('type') ?? '').startsWith('math/') ? BELOW.mathScript : 0);
  else if (tag === 'table') kinds |= BELOW.table;
  else if (tag === 'figure') kinds |= BELOW.figure;
  else if (tag === 'img')
    kinds |=
      BELOW.image | ((element.getAttribute('class') ?? '').includes('math') ? 0 : BELOW.plainImage);
  else if (tag === 'picture' || tag === 'object') kinds |= BELOW.image;
  if (tag === 'h1' || tag === 'h2' || tag === 'section' || tag === 'article')
    kinds |= BELOW.sectioning;
  return kinds;
}

/** True for an element a caption query matches: a caption or heading tag, or a class naming a caption, title, or label. */
function readsAsCaption(element: Element, tag: string): boolean {
  if (CAPTION_TAGS.has(tag)) return true;
  const className = element.getAttribute('class') ?? '';
  return (
    className.includes('caption') || className.includes('title') || className.includes('label')
  );
}

/** What sits below `element`, as selector queries from it would find. */
export function below(element: Element, ctx: HtmlContext): Below {
  const known = ctx.subtrees.below.get(element);
  if (known) return known;
  const facts: Below = { images: 0, kinds: 0, tables: 0 };
  for (const child of childElements(element)) {
    const tag = tagOf(child);
    const inner = tag === 'template' ? undefined : below(child, ctx);
    facts.kinds |= kindsOf(child, tag) | (inner?.kinds ?? 0);
    facts.images = Math.min(2, facts.images + (tag === 'img' ? 1 : 0) + (inner?.images ?? 0));
    facts.tables = Math.min(2, facts.tables + (tag === 'table' ? 1 : 0) + (inner?.tables ?? 0));
    facts.firstImage ??= tag === 'img' ? child : inner?.firstImage;
    facts.firstMath ??= tag === 'math' ? child : inner?.firstMath;
    facts.firstMathScript ??=
      tag === 'script' && (child.getAttribute('type') ?? '').startsWith('math/')
        ? child
        : inner?.firstMathScript;
    if (!facts.firstNumbered) {
      const numbered = nameTokens(child.getAttribute('class')).some((t) => NUMBER_TOKENS.has(t))
        ? child
        : inner?.firstNumbered;
      if (numbered) {
        facts.firstNumbered = numbered;
        facts.numberedChild = child;
      }
    }
    if (!facts.firstCaption && !isFurniture(child)) {
      facts.firstCaption =
        readsAsCaption(child, tag) && textLength(child, ctx) > 0 ? child : inner?.firstCaption;
    }
  }
  ctx.subtrees.below.set(element, facts);
  return facts;
}

// ─── Text ───────────────────────────────────────────────────────────────────

/** Most characters of an element's text kept; past it, the text is known by its length and head. */
const TEXT_CAP = 256;

/** A run of text with its whitespace collapsed: its length, whether it opens or closes on a space, and its first {@link TEXT_CAP} characters. */
interface Collapsed {
  ends: boolean;
  head: string;
  length: number;
  starts: boolean;
}

/** An element's text in the forms the parser reads it. */
export interface TextFacts extends Collapsed {
  /** An `<a>` sits below the element. */
  links: boolean;
  /** Its text outside links and buttons, comments included, collapsed; undefined past the cap. */
  outside: string | undefined;
  /** The element whose text this is: the one child carrying text's owner, or the element itself. */
  owner: Element;
}

const NO_TEXT: Collapsed = { ends: false, head: '', length: 0, starts: false };

function collapsed(text: string): Collapsed {
  if (!text) return NO_TEXT;
  return {
    ends: text.endsWith(' '),
    head: text.slice(0, TEXT_CAP),
    length: text.length,
    starts: text.startsWith(' '),
  };
}

/** Two runs of collapsed text joined, the space at their seam collapsed. */
function joinText(before: Collapsed, after: Collapsed): Collapsed {
  if (after.length === 0) return before;
  if (before.length === 0) return after;
  const seam = before.ends && after.starts;
  const whole = before.head.length === before.length;
  return {
    ends: after.ends,
    head: whole
      ? (before.head + (seam ? after.head.slice(1) : after.head)).slice(0, TEXT_CAP)
      : before.head,
    length: before.length + after.length - (seam ? 1 : 0),
    starts: before.starts,
  };
}

/** Two runs of collapsed text joined; undefined once either or the whole runs past the cap. */
function joinCapped(before: string | undefined, after: string | undefined): string | undefined {
  if (before === undefined || after === undefined) return;
  const joined =
    before.endsWith(' ') && after.startsWith(' ') ? before + after.slice(1) : before + after;
  return joined.length > TEXT_CAP ? undefined : joined;
}

function trimmedLength(text: Collapsed): number {
  return Math.max(0, text.length - (text.starts ? 1 : 0) - (text.ends ? 1 : 0));
}

/** An element's text facts, built from its children's. */
export function textFacts(element: Element, ctx: HtmlContext): TextFacts {
  const known = ctx.subtrees.text.get(element);
  if (known) return known;
  let text = NO_TEXT;
  let links = false;
  let outside: string | undefined = '';
  let carriers = 0;
  let owner = element;
  for (const node of childNodes(element)) {
    if (isElement(node)) {
      const tag = tagOf(node);
      const inner = textFacts(node, ctx);
      if (tag === 'a' || (tag !== 'template' && inner.links)) links = true;
      text = joinText(text, inner);
      outside = joinCapped(outside, tag === 'a' || tag === 'button' ? '' : inner.outside);
      if (trimmedLength(inner) > 0) {
        carriers++;
        owner = inner.owner;
      }
      continue;
    }
    const data = (node.textContent ?? '').replace(/\s+/g, ' ');
    outside = joinCapped(outside, data);
    if (node.nodeType === TEXT_NODE || node.nodeType === CDATA_SECTION_NODE) {
      text = joinText(text, collapsed(data));
      if (data.trim()) {
        carriers++;
        owner = element;
      }
    }
  }
  const facts: TextFacts = { ...text, links, outside, owner: carriers === 1 ? owner : element };
  ctx.subtrees.text.set(element, facts);
  return facts;
}

/** The length of an element's text, whitespace collapsed and trimmed, as `textOfElement` gives it. */
export function textLength(element: Element, ctx: HtmlContext): number {
  return trimmedLength(textFacts(element, ctx));
}

/** An element's text, whitespace collapsed and trimmed, when it is at most {@link TEXT_CAP} characters. */
export function shortText(element: Element, ctx: HtmlContext): string | undefined {
  const text = textFacts(element, ctx);
  return text.head.length === text.length ? text.head.trim() : undefined;
}

/** The first `n` characters (`n` under {@link TEXT_CAP}) of an element's text, whitespace collapsed and trimmed. */
export function textLead(element: Element, ctx: HtmlContext, n: number): string {
  return (shortText(element, ctx) ?? textFacts(element, ctx).head.trimStart()).slice(0, n);
}

/**
 * An element's text, whitespace collapsed and trimmed, as `textOfElement` gives it. Text
 * past the cap is read from the subtree once per owner: an element whose text is all one
 * child's shares that child's reading.
 */
export function plainText(element: Element, ctx: HtmlContext): string {
  const short = shortText(element, ctx);
  if (short !== undefined) return short;
  const { owner } = textFacts(element, ctx);
  let text = ctx.subtrees.plain.get(owner);
  if (text === undefined) {
    text = textOfElement(owner);
    ctx.subtrees.plain.set(owner, text);
  }
  return text;
}

/**
 * True when an element's text, whitespace collapsed and trimmed, is `wanted`. Lengths are
 * compared first, so text is read only where it could match: along a chain of elements
 * whose texts all match, one reading serves them all.
 */
export function textIs(element: Element, ctx: HtmlContext, wanted: string): boolean {
  return textLength(element, ctx) === wanted.length && plainText(element, ctx) === wanted;
}

// ─── Text besides an equation's number ──────────────────────────────────────

/** The edges of a run of source text, as a check for delimited TeX reads them. */
export interface Edges {
  /** Its first and last characters; empty for an empty run. */
  first: string;
  /** Its first two characters after leading whitespace, and its last two before trailing whitespace. */
  head: string;
  last: string;
  tail: string;
  /** Characters other than whitespace, counted to 5. */
  visible: number;
}

/** An element's own text, furniture left out, and the same with its first numbered element left out too. */
export interface OwnText {
  all: Edges;
  besidesNumber: Edges;
}

const NO_EDGES: Edges = { first: '', head: '', last: '', tail: '', visible: 0 };

function edges(text: string): Edges {
  if (!text) return NO_EDGES;
  return {
    first: text.charAt(0),
    head: text.trimStart().slice(0, 2),
    last: text.charAt(text.length - 1),
    tail: text.trimEnd().slice(-2),
    visible: Math.min(5, text.replace(/\s+/g, '').length),
  };
}

function joinEdges(before: Edges, after: Edges): Edges {
  if (!after.first) return before;
  if (!before.first) return after;
  return {
    first: before.first,
    head:
      before.visible === 0
        ? after.head
        : before.head.length === 2
          ? before.head
          : before.head + after.first,
    last: after.last,
    tail:
      after.visible === 0
        ? before.tail
        : after.tail.length === 2
          ? after.tail
          : before.last + after.tail,
    visible: Math.min(5, before.visible + after.visible),
  };
}

/**
 * The edges of an element's own text: every non-element node's text, comments included,
 * with furniture left out, and also with the element's first numbered element left out.
 */
export function ownText(element: Element, ctx: HtmlContext): OwnText {
  const known = ctx.subtrees.own.get(element);
  if (known) return known;
  const { firstNumbered, numberedChild } = below(element, ctx);
  let all = NO_EDGES;
  let besidesNumber = NO_EDGES;
  for (const node of childNodes(element)) {
    if (!isElement(node)) {
      const text = edges(node.textContent ?? '');
      all = joinEdges(all, text);
      besidesNumber = joinEdges(besidesNumber, text);
      continue;
    }
    if (isFurniture(node)) continue;
    const inner = ownText(node, ctx);
    all = joinEdges(all, inner.all);
    if (node !== firstNumbered)
      besidesNumber = joinEdges(
        besidesNumber,
        node === numberedChild ? inner.besidesNumber : inner.all,
      );
  }
  const facts = { all, besidesNumber };
  ctx.subtrees.own.set(element, facts);
  return facts;
}
