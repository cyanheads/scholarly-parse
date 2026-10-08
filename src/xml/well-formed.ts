/**
 * @fileoverview A single-pass well-formedness check run before parsing. fast-xml-parser
 * accepts markup that is not well-formed and drops what follows the fault without an
 * error — an unescaped `<` in `p < 0.05` swallows the rest of its section — so input
 * that fails this check is reported as malformed instead of parsed short.
 *
 * The check covers that failure mode: every `<` opens a tag, comment, CDATA section,
 * processing instruction, or `<!DOCTYPE` declaration; each of those is terminated; a start
 * tag's name ends at whitespace, `/`, or `>`; end tags match their start tags; nothing is
 * left open. Entity references and attribute syntax are left to the parser.
 * @module src/xml/well-formed
 */

const NAME = /[A-Za-z_:À-￿][\w.:·À-￿-]*/y;

const DOCTYPE = /^DOCTYPE$/i;

/** What may follow a start tag's name: whitespace, `/`, `>`, or the end, which faults later. */
const AFTER_NAME = /^(?:[\s/>]|)$/;

/** Describes the first well-formedness fault in `text`, or undefined when there is none. */
export function findMarkupFault(text: string): string | undefined {
  const open: string[] = [];
  let at = text.indexOf('<');
  while (at !== -1) {
    let end: number;
    const next = text[at + 1];
    if (next === '!') {
      if (text.startsWith('<!--', at)) end = closingIndex(text, '-->', at + 4);
      else if (text.startsWith('<![CDATA[', at)) end = closingIndex(text, ']]>', at + 9);
      // Any other declaration belongs in a DOCTYPE; the parser drops one in the text.
      else if (DOCTYPE.test(text.slice(at + 2, at + 9))) end = declarationEnd(text, at + 2);
      else return fault(text, at, 'unescaped "<"');
    } else if (next === '?') {
      end = closingIndex(text, '?>', at + 2);
    } else if (next === '/') {
      const name = nameAt(text, at + 2);
      const expected = open.pop();
      if (name === undefined || name !== expected) {
        return fault(
          text,
          at,
          expected
            ? `</${name ?? ''}> where </${expected}> was expected`
            : `</${name ?? ''}> closes no element`,
        );
      }
      end = text.indexOf('>', at + 2 + name.length);
      if (end !== -1 && text.slice(at + 2 + name.length, end).trim() !== '')
        return fault(text, at, `malformed end tag </${name}>`);
    } else {
      const name = nameAt(text, at + 1);
      if (name === undefined) return fault(text, at, 'unescaped "<"');
      // The parser reads a name to the next space, so `<or= 2/>` would be an empty element.
      if (!AFTER_NAME.test(text.charAt(at + 1 + name.length)))
        return fault(text, at, `malformed start tag <${name}`);
      end = startTagEnd(text, at + 1 + name.length);
      if (end !== -1 && text[end - 1] !== '/') open.push(name);
    }
    if (end === -1) return fault(text, at, 'markup never terminated');
    at = text.indexOf('<', end + 1);
  }
  const unclosed = open.at(-1);
  return unclosed === undefined ? undefined : `<${unclosed}> is never closed`;
}

function nameAt(text: string, index: number): string | undefined {
  NAME.lastIndex = index;
  return NAME.exec(text)?.[0];
}

/** Index of the last character of `delimiter` at or after `from`, or -1. */
function closingIndex(text: string, delimiter: string, from: number): number {
  const index = text.indexOf(delimiter, from);
  return index === -1 ? -1 : index + delimiter.length - 1;
}

/** The `>` ending a start tag, skipping quoted attribute values; -1 when a `<` or the end comes first. */
export function startTagEnd(text: string, from: number): number {
  let quote = '';
  for (let i = from; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return i;
    } else if (char === '<') {
      return -1;
    }
  }
  return -1;
}

/**
 * The `>` ending a `<!DOCTYPE …>` or other declaration, past any `[…]` internal subset.
 * A comment or processing instruction in the subset is skipped whole, so a quote or
 * bracket in its text (`<!-- don't -->`) is not read as markup; -1 when one is never closed.
 */
export function declarationEnd(text: string, from: number): number {
  let quote = '';
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '<' && (text.startsWith('<!--', i) || text[i + 1] === '?')) {
      i = text[i + 1] === '?' ? closingIndex(text, '?>', i + 2) : closingIndex(text, '-->', i + 4);
      if (i === -1) return -1;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '[') {
      depth++;
    } else if (char === ']') {
      depth--;
    } else if (char === '>' && depth <= 0) {
      return i;
    }
  }
  return -1;
}

function fault(text: string, index: number, problem: string): string {
  let line = 1;
  for (let i = text.indexOf('\n'); i !== -1 && i < index; i = text.indexOf('\n', i + 1)) line++;
  return `line ${line}: ${problem}`;
}
