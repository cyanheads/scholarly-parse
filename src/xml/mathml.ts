/**
 * @fileoverview MathML to TeX notation, and cleanup of TeX that publishers deposit.
 *
 * Most publishers deposit formulas as MathML only, and flattening MathML to its text
 * turns `x²` into `x2` and a fraction into two numbers side by side. The conversion
 * prefers TeX the document already carries (`@alttext`, a TeX `<annotation>`), then
 * linearizes presentation MathML. The output is TeX a person or model can read, not a
 * guaranteed-compilable document.
 *
 * The converter reads its tree through a {@link MathNodes} accessor: the ordered XML tree
 * by default, or a DOM (`src/html/math.ts`), so one linearization serves every format.
 * @module src/xml/mathml
 */
import { MAX_XML_DEPTH } from '../model/limits.js';
import { attrOf, childrenOf, isTextNode, localNameOf, textOf, type XmlNode } from './ordered.js';

/** How the converter reads a MathML tree whose nodes are `N`. */
export interface MathNodes<N> {
  /** An element's attribute, by its source name. */
  attr(node: N, name: string): string | undefined;
  /** An element's element and text children, in order; empty for a text node. */
  children(node: N): readonly N[];
  /** True for a text node. */
  isText(node: N): boolean;
  /** An element's name without a namespace prefix (`mml:mi` → `mi`); undefined for text. */
  name(node: N): string | undefined;
  /** A text node's text. */
  text(node: N): string;
}

/** The ordered XML tree every XML format parses into. */
const ORDERED_NODES: MathNodes<XmlNode> = {
  attr: attrOf,
  children: childrenOf,
  isText: isTextNode,
  name: localNameOf,
  text: textOf,
};

/** Annotation encodings that carry TeX. */
const TEX_ENCODINGS = new Set(['application/x-tex', 'tex', 'latex', 'application/x-latex']);

/**
 * Accent characters `<mover accent="true">` uses, and the TeX command for each. The
 * tables here are maps because their keys come from the document: an `<mo>constructor`
 * must not find `Object.prototype.constructor`.
 */
const ACCENTS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    '^': '\\hat',
    ˆ: '\\hat',
    '¯': '\\bar',
    '‾': '\\bar',
    '~': '\\tilde',
    '˜': '\\tilde',
    '˙': '\\dot',
    '¨': '\\ddot',
    '→': '\\vec',
    '⃗': '\\vec',
  }),
);

/** Operator characters that need a TeX spelling to survive as math. */
const OPERATORS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    '⁡': '',
    '⁢': '',
    '⁣': '',
    '⁤': '',
    '{': '\\{',
    '}': '\\}',
  }),
);

/** `mathvariant` values on a token (`<mi mathvariant="double-struck">F</mi>`), and the TeX command for each. */
const VARIANTS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    bold: '\\mathbf',
    'bold-fraktur': '\\mathfrak',
    'bold-italic': '\\boldsymbol',
    'bold-script': '\\mathcal',
    'double-struck': '\\mathbb',
    fraktur: '\\mathfrak',
    monospace: '\\mathtt',
    normal: '\\mathrm',
    'sans-serif': '\\mathsf',
    script: '\\mathcal',
  }),
);

/** True when `s` looks like TeX rather than a plain-text alternative. */
function looksLikeTex(s: string): boolean {
  return /[\\^_{}]/.test(s);
}

/** Wrap a script in braces unless it is a single character. */
function group(s: string): string {
  return [...s].length === 1 ? s : `{${s}}`;
}

/**
 * TeX for a `<math>` element: its own TeX when it carries some, else a linearization
 * of the presentation markup. Empty when neither yields anything. Read from the ordered
 * XML tree unless `nodes` says how to read another.
 */
export function mathmlToTex(math: XmlNode): string;
export function mathmlToTex<N>(math: N, nodes: MathNodes<N>): string;
export function mathmlToTex<N>(
  math: N,
  nodes: MathNodes<N> = ORDERED_NODES as unknown as MathNodes<N>,
): string {
  const alttext = nodes.attr(math, 'alttext')?.trim();
  if (alttext && looksLikeTex(alttext)) return cleanTex(alttext);
  const annotation = findTexAnnotation(math, nodes, 1);
  if (annotation) return cleanTex(annotation);
  return linearize(nodes.children(math), nodes, 1).replace(/\s+/g, ' ').trim();
}

function findTexAnnotation<N>(node: N, nodes: MathNodes<N>, depth: number): string | undefined {
  if (depth >= MAX_XML_DEPTH) return;
  for (const child of nodes.children(node)) {
    const name = nodes.name(child);
    if (
      name === 'annotation' &&
      TEX_ENCODINGS.has((nodes.attr(child, 'encoding') ?? '').toLowerCase())
    ) {
      const text = nodes
        .children(child)
        .map((part) => nodes.text(part))
        .join('')
        .trim();
      if (text) return text;
    }
    if (name === 'semantics' || name === 'mrow') {
      const nested = findTexAnnotation(child, nodes, depth + 1);
      if (nested) return nested;
    }
  }
  return;
}

function linearize<N>(list: readonly N[], nodes: MathNodes<N>, depth: number): string {
  return list.map((node) => linearizeNode(node, nodes, depth)).join('');
}

/**
 * One node as TeX, construct by construct. An element `MAX_XML_DEPTH` levels below the
 * `<math>` is written as its text: the XML parser never builds a tree that deep, but a
 * DOM may hold one, and the recursion must not outrun the stack.
 */
function linearizeNode<N>(node: N, nodes: MathNodes<N>, depth: number): string {
  if (nodes.isText(node)) return nodes.text(node).trim();
  if (depth >= MAX_XML_DEPTH) return deepText(node, nodes);
  const kids = nodes
    .children(node)
    .filter((child) => !nodes.isText(child) || nodes.text(child).trim());
  const inner = depth + 1;
  const arg = (i: number) => {
    const child = kids[i];
    return child ? linearizeNode(child, nodes, inner) : '';
  };
  const each = () => kids.map((kid) => linearizeNode(kid, nodes, inner));
  switch (nodes.name(node)) {
    case 'mi': {
      const text = each().join('');
      const variant = VARIANTS.get(nodes.attr(node, 'mathvariant') ?? '');
      if (variant && text) return `${variant}{${text}}`;
      return [...text].length > 1 && /^[A-Za-z]+$/.test(text) ? `\\mathrm{${text}}` : text;
    }
    case 'mn': {
      const text = each().join('');
      const variant = VARIANTS.get(nodes.attr(node, 'mathvariant') ?? '');
      return variant && variant !== '\\mathrm' && text ? `${variant}{${text}}` : text;
    }
    case 'mo': {
      const text = each().join('');
      return OPERATORS.get(text) ?? text;
    }
    case 'mtext': {
      const text = each().join('');
      return text ? `\\text{${text}}` : '';
    }
    case 'ms':
      return `"${each().join('')}"`;
    case 'mspace':
      return ' ';
    case 'msup':
      return `${arg(0)}^${group(arg(1))}`;
    case 'msub':
      return `${arg(0)}_${group(arg(1))}`;
    case 'msubsup':
      return `${arg(0)}_${group(arg(1))}^${group(arg(2))}`;
    case 'mfrac':
      return `\\frac{${arg(0)}}{${arg(1)}}`;
    case 'msqrt':
      return `\\sqrt{${each().join('')}}`;
    case 'mroot':
      return `\\sqrt[${arg(1)}]{${arg(0)}}`;
    case 'mover': {
      const over = arg(1);
      const accent = ACCENTS.get(over);
      return accent ? `${accent}{${arg(0)}}` : `\\overset{${over}}{${arg(0)}}`;
    }
    case 'munder':
      return `\\underset{${arg(1)}}{${arg(0)}}`;
    case 'munderover':
      return `${arg(0)}_${group(arg(1))}^${group(arg(2))}`;
    case 'mfenced': {
      const open = nodes.attr(node, 'open') ?? '(';
      const close = nodes.attr(node, 'close') ?? ')';
      const separator = nodes.attr(node, 'separators')?.trim().charAt(0) ?? ',';
      return `${open}${each().join(separator)}${close}`;
    }
    case 'mtable':
      return `\\begin{matrix}${each().join(' \\\\ ')}\\end{matrix}`;
    case 'mtr':
    case 'mlabeledtr':
      return each().join(' & ');
    case 'mphantom':
    case 'annotation':
    case 'annotation-xml':
    case 'maligngroup':
    case 'malignmark':
    case 'none':
      return '';
    case 'semantics':
      return arg(0);
    case 'mmultiscripts':
      return multiscripts(kids, nodes, inner);
    default:
      // mrow, mstyle, mpadded, menclose, merror, mtd, math, and anything unknown:
      // the children in order.
      return each().join('');
  }
}

/**
 * `<mmultiscripts>`: a base, subscript–superscript pairs after it, and past
 * `<mprescripts/>` pairs before it, each pair written `_sub^sup` as `msubsup` is. A
 * prescript pair follows an empty group `{}`, since siblings join with nothing between
 * and a bare `^{14}` would attach to the token before; the first postscript pair attaches
 * to the base and each later one follows `{}`, so tensor indices stay staggered
 * (`R_i{}^j{}_k`). A script written empty (`<none/>`, or the empty `<mrow/>` MathML Core
 * and LaTeXML put in its place) is left out, and a lone last script is a subscript.
 */
function multiscripts<N>(kids: readonly N[], nodes: MathNodes<N>, depth: number): string {
  const [base, ...scripts] = kids;
  const split = scripts.findIndex((kid) => nodes.name(kid) === 'mprescripts');
  const post = split === -1 ? scripts : scripts.slice(0, split);
  const pre = split === -1 ? [] : scripts.slice(split + 1);
  const [first = '', ...later] = scriptPairs(post, nodes, depth);
  const before = scriptPairs(pre, nodes, depth).map((pair) => `{}${pair}`);
  const after = later.map((pair) => `{}${pair}`);
  const core = base ? linearizeNode(base, nodes, depth) : '';
  return `${before.join('')}${core}${first}${after.join('')}`;
}

/** Each subscript–superscript pair that writes anything, as `_sub^sup`. */
function scriptPairs<N>(scripts: readonly N[], nodes: MathNodes<N>, depth: number): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < scripts.length; i += 2) {
    const [sub, sup] = [scripts[i], scripts[i + 1]].map((script) =>
      script === undefined ? '' : linearizeNode(script, nodes, depth),
    );
    const pair = `${sub ? `_${group(sub)}` : ''}${sup ? `^${group(sup)}` : ''}`;
    if (pair) pairs.push(pair);
  }
  return pairs;
}

/** The text under `node`, each text node trimmed, read without recursion. */
function deepText<N>(node: N, nodes: MathNodes<N>): string {
  let out = '';
  const pending: N[] = [node];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (nodes.isText(next)) {
      out += nodes.text(next).trim();
      continue;
    }
    const children = nodes.children(next);
    for (let i = children.length - 1; i >= 0; i--) pending.push(children[i] as N);
  }
  return out;
}

/** The body of a LaTeX document deposited as `<tex-math>`, closing marker optional. */
const TEX_DOCUMENT_BODY = /\\begin\{document\}([\s\S]*?)(?:\\end\{document\}|$)/;

/** Math-mode delimiters a TeX expression may arrive wrapped in. */
const DELIMITERS: [RegExp, RegExp][] = [
  [/^\$\$/, /\$\$$/],
  [/^\$/, /\$$/],
  [/^\\\[/, /\\\]$/],
  [/^\\\(/, /\\\)$/],
];

/**
 * A publisher's TeX reduced to the expression: the `\documentclass…\begin{document}`
 * wrapper some deposit around every formula removed, and one layer of math
 * delimiters stripped, so the caller can wrap it for inline or display use.
 */
export function cleanTex(raw: string): string {
  let tex = (TEX_DOCUMENT_BODY.exec(raw)?.[1] ?? raw).trim();
  for (const [open, close] of DELIMITERS) {
    if (open.test(tex) && close.test(tex) && tex.length > 2) {
      tex = tex.replace(open, '').replace(close, '').trim();
      break;
    }
  }
  return tex;
}
