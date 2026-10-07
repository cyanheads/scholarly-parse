/**
 * @fileoverview Bounds on untrusted input that the XML parser (`src/xml/`) and the HTML
 * loader (`src/html/dom.ts`) share, in a module of their own so neither imports the
 * other's module for a constant.
 * @module src/model/limits
 */

/**
 * Deepest element nesting accepted. Real articles stay far shallower — body, section,
 * paragraph, and inline markup rarely pass 20 levels, the deepest MathML seen stays
 * under 60, and the deepest HTML fixture nests 39 levels — so this bounds hostile input
 * and the recursive walks over it.
 */
export const MAX_XML_DEPTH = 256;
