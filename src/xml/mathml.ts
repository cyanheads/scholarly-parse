/**
 * @fileoverview MathML (on the ordered XML tree) to TeX notation, and cleanup of TeX
 * that publishers deposit.
 *
 * Most publishers deposit formulas as MathML only, and flattening MathML to its text
 * turns `x²` into `x2` and a fraction into two numbers side by side. The conversion
 * prefers TeX the document already carries (`@alttext`, a TeX `<annotation>`), then
 * linearizes presentation MathML. The output is TeX a person or model can read, not a
 * guaranteed-compilable document.
 * @module src/xml/mathml
 */
import { attrOf, childrenOf, isTextNode, localNameOf, textOf, type XmlNode } from './ordered.js';

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
 * of the presentation markup. Empty when neither yields anything.
 */
export function mathmlToTex(math: XmlNode): string {
  const alttext = attrOf(math, 'alttext')?.trim();
  if (alttext && looksLikeTex(alttext)) return cleanTex(alttext);
  const annotation = findTexAnnotation(math);
  if (annotation) return cleanTex(annotation);
  return linearize(childrenOf(math)).replace(/\s+/g, ' ').trim();
}

function findTexAnnotation(node: XmlNode): string | undefined {
  for (const child of childrenOf(node)) {
    const name = localNameOf(child);
    if (
      name === 'annotation' &&
      TEX_ENCODINGS.has((attrOf(child, 'encoding') ?? '').toLowerCase())
    ) {
      const text = childrenOf(child).map(textOf).join('').trim();
      if (text) return text;
    }
    if (name === 'semantics' || name === 'mrow') {
      const nested = findTexAnnotation(child);
      if (nested) return nested;
    }
  }
  return;
}

function linearize(nodes: XmlNode[]): string {
  return nodes.map(linearizeNode).join('');
}

function linearizeNode(node: XmlNode): string {
  if (isTextNode(node)) return textOf(node).trim();
  const kids = childrenOf(node).filter((child) => !isTextNode(child) || textOf(child).trim());
  const arg = (i: number) => {
    const child = kids[i];
    return child ? linearizeNode(child) : '';
  };
  switch (localNameOf(node)) {
    case 'mi': {
      const text = linearize(kids);
      const variant = VARIANTS.get(attrOf(node, 'mathvariant') ?? '');
      if (variant && text) return `${variant}{${text}}`;
      return [...text].length > 1 && /^[A-Za-z]+$/.test(text) ? `\\mathrm{${text}}` : text;
    }
    case 'mn': {
      const text = linearize(kids);
      const variant = VARIANTS.get(attrOf(node, 'mathvariant') ?? '');
      return variant && variant !== '\\mathrm' && text ? `${variant}{${text}}` : text;
    }
    case 'mo': {
      const text = linearize(kids);
      return OPERATORS.get(text) ?? text;
    }
    case 'mtext': {
      const text = linearize(kids);
      return text ? `\\text{${text}}` : '';
    }
    case 'ms':
      return `"${linearize(kids)}"`;
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
      return `\\sqrt{${linearize(kids)}}`;
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
      const open = attrOf(node, 'open') ?? '(';
      const close = attrOf(node, 'close') ?? ')';
      const separator = attrOf(node, 'separators')?.trim().charAt(0) ?? ',';
      return `${open}${kids.map(linearizeNode).join(separator)}${close}`;
    }
    case 'mtable':
      return `\\begin{matrix}${kids.map(linearizeNode).join(' \\\\ ')}\\end{matrix}`;
    case 'mtr':
    case 'mlabeledtr':
      return kids.map(linearizeNode).join(' & ');
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
      return linearize(kids.filter((k) => localNameOf(k) !== 'mprescripts'));
    default:
      // mrow, mstyle, mpadded, menclose, merror, mtd, math, and anything unknown:
      // the children in order.
      return linearize(kids);
  }
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
