/**
 * @fileoverview TeX for MathML in an HTML page: the TeX the page keeps beside it, else
 * the presentation markup linearized as `mathmlToTex` does for JATS. Nodes are read
 * through standard DOM properties only, so nothing here loads `linkedom`, and the XML
 * subpaths, which import `src/xml/mathml.ts`, load no DOM code.
 * @module src/html/math
 */
import { type MathNodes, mathmlToTex } from '../xml/mathml.js';
import { isElement, TEXT_NODE, tagOf } from './dom.js';

/** A DOM read as MathML: elements by their lowercase local name, and text. Comments are skipped. */
const DOM_NODES: MathNodes<Node> = {
  attr: (node, name) => (isElement(node) ? (node.getAttribute(name) ?? undefined) : undefined),
  children: (node) =>
    Array.from(node.childNodes).filter((child) => isElement(child) || child.nodeType === TEXT_NODE),
  isText: (node) => node.nodeType === TEXT_NODE,
  name: (node) => {
    if (!isElement(node)) return;
    const tag = tagOf(node);
    return tag.slice(tag.indexOf(':') + 1);
  },
  text: (node) =>
    node.nodeType === TEXT_NODE ? (node.textContent ?? '').replace(/\u00AD/g, '') : '',
};

/**
 * TeX for a MathML `<math>` element: its `application/x-tex` annotation (KaTeX and
 * LaTeXML keep one), else its `alttext`, else the presentation markup linearized. Empty
 * when all three are.
 */
export function domMathTex(math: Element): string {
  const annotation = Array.from(math.getElementsByTagName('annotation')).find(
    (a) => (a.getAttribute('encoding') ?? '').toLowerCase() === 'application/x-tex',
  );
  return (
    (annotation?.textContent ?? '').trim() ||
    (math.getAttribute('alttext') ?? '').trim() ||
    mathmlToTex<Node>(math, DOM_NODES)
  );
}
