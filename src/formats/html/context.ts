/**
 * @fileoverview State one publisher-HTML parse carries, and the rules for what on a
 * page is furniture rather than article: navigation, toolbars, download and share
 * widgets, recommendations, hidden duplicates, and embedded media controls.
 * @module src/formats/html/context
 */

import { tagOf } from '../../html/dom.js';
import type { DiagnosticsCollector } from '../../model/diagnostics.js';
import type { Footnote } from '../../model/document.js';

export interface HtmlContext {
  baseUrl: string | undefined;
  diag: DiagnosticsCollector;
  footnotes: Footnote[];
  sectionIds: Set<string>;
}

const FURNITURE_TAGS: ReadonlySet<string> = new Set([
  'aside',
  'audio',
  'button',
  'canvas',
  'dialog',
  'embed',
  'footer',
  'form',
  'iframe',
  'input',
  'label',
  'link',
  'menu',
  'meta',
  'nav',
  'noscript',
  'object',
  'script',
  'select',
  'style',
  'svg',
  'template',
  'textarea',
  'video',
]);

const FURNITURE_ROLES: ReadonlySet<string> = new Set([
  'alertdialog',
  'banner',
  'complementary',
  'contentinfo',
  'dialog',
  'menu',
  'menubar',
  'navigation',
  'search',
  'tablist',
  'toolbar',
  'tooltip',
]);

/**
 * Words that mark an element as page furniture when one appears as a token of its class
 * or ID (`figure-inline-download`, `c-article-metrics-bar`, `u-hide`, `sr-only`).
 */
const FURNITURE_TOKENS: ReadonlySet<string> = new Set([
  'ad',
  'ads',
  'advert',
  'advertisement',
  'altmetric',
  'banner',
  'breadcrumb',
  'breadcrumbs',
  'carousel',
  'comment',
  'comments',
  'consent',
  'cookie',
  'cookies',
  'download',
  'downloads',
  'dropdown',
  'hide',
  'masthead',
  'metrics',
  'modal',
  'nav',
  'newsletter',
  'offscreen',
  'popover',
  'popup',
  'promo',
  'recommendations',
  'recommended',
  'related',
  'save',
  'share',
  'sharing',
  'sidebar',
  'social',
  'sr',
  'subscribe',
  'toolbar',
  'tooltip',
  'visually',
]);

/** A class or ID split into lowercase word tokens: `c-article-metrics-bar`, `ArticleTable__header`. */
export function nameTokens(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\s+/)
    .flatMap((name) => name.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_:-]+/))
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

/** True for an element that is page furniture and never article content. */
export function isFurniture(element: Element): boolean {
  if (FURNITURE_TAGS.has(tagOf(element))) return true;
  const role = element.getAttribute('role');
  if (role && FURNITURE_ROLES.has(role)) return true;
  if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return true;
  if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(element.getAttribute('style') ?? ''))
    return true;
  if (element.classList.contains('hidden')) return true;
  return [
    ...nameTokens(element.getAttribute('class')),
    ...nameTokens(element.getAttribute('id')),
  ].some((token) => FURNITURE_TOKENS.has(token));
}
