/**
 * @fileoverview Input handling every parser shares: the size budget and turning bytes
 * into text with the encoding the document declares.
 * @module src/model/input
 */

/** True when the input is larger than `maxBytes`. Strings are measured as UTF-8. */
export function exceedsBudget(input: string | Uint8Array, maxBytes: number): boolean {
  if (typeof input !== 'string') return input.byteLength > maxBytes;
  // A string needs at most 3 UTF-8 bytes per UTF-16 unit; skip encoding when that bound fits.
  if (input.length * 3 <= maxBytes) return false;
  return new TextEncoder().encode(input).byteLength > maxBytes;
}

/**
 * Text of the input. Bytes are decoded by their byte-order mark, else the encoding an
 * XML declaration or HTML `<meta charset>` names in the first kilobyte, else UTF-8.
 * A leading byte-order mark is dropped from strings too.
 */
export function decodeText(input: string | Uint8Array): string {
  if (typeof input === 'string') return input.replace(/^﻿/, '');
  const label = bomEncoding(input) ?? declaredEncoding(input) ?? 'utf-8';
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(label);
  } catch {
    decoder = new TextDecoder('utf-8');
  }
  return decoder.decode(input).replace(/^﻿/, '');
}

/** The encoding a leading byte-order mark names: UTF-8, UTF-16LE, or UTF-16BE. */
export function bomEncoding(bytes: Uint8Array): 'utf-8' | 'utf-16le' | 'utf-16be' | undefined {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  return;
}

function declaredEncoding(bytes: Uint8Array): string | undefined {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  return (
    /<\?xml[^>]*\bencoding\s*=\s*["']([\w.:-]+)["']/i.exec(head)?.[1] ??
    /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(head)?.[1]
  );
}
