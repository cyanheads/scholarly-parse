/**
 * @fileoverview Bounds on untrusted input that more than one loader shares, in a module
 * of their own so the HTML loader can use them without pulling in `fast-xml-parser`.
 * @module src/model/limits
 */

/**
 * Deepest element nesting accepted. Real articles stay far shallower — body, section,
 * paragraph, and inline markup rarely pass 20 levels, the deepest MathML seen stays
 * under 60, and the deepest HTML fixture nests 39 levels — so this bounds hostile input
 * and the recursive walks over it.
 */
export const MAX_XML_DEPTH = 256;
