/**
 * @fileoverview A single-pass well-formedness check run before parsing. fast-xml-parser
 * accepts markup that is not well-formed and drops what follows the fault without an
 * error — an unescaped `<` in `p < 0.05` swallows the rest of its section — so input
 * that fails this check is reported as malformed instead of parsed short.
 *
 * The check covers that failure mode: every `<` opens a tag, comment, CDATA section,
 * processing instruction, or declaration; each of those is terminated; end tags match
 * their start tags; nothing is left open. Entity references and attribute syntax are
 * left to the parser.
 * @module src/xml/well-formed
 */

const NAME = /[A-Za-z_:À-￿][\w.:·À-￿-]*/y;

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
      else end = declarationEnd(text, at + 2);
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
function startTagEnd(text: string, from: number): number {
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

/** The `>` ending a `<!DOCTYPE …>` or other declaration, past any `[…]` internal subset. */
function declarationEnd(text: string, from: number): number {
  let quote = '';
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === quote) quote = '';
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
