/**
 * @fileoverview The value every parser returns. Expected failures (malformed input,
 * the wrong format, an empty body, input over budget) are results, not exceptions;
 * a missing optional peer dependency is a setup error and throws.
 * @module src/model/result
 */
import type { ScholarlyDocument } from './document.js';

/** Why a parse produced no document. */
export type ParseFailureReason =
  /** The bytes are not well-formed for the format (unparseable XML, corrupt PDF). */
  | 'malformed'
  /** Well-formed, but not the format this parser reads (e.g. HTML given to the JATS parser). */
  | 'wrong-format'
  /** Parsed, but carried no article content. */
  | 'empty'
  /** An interstitial rather than the document: a captcha, bot check, or login wall. */
  | 'blocked'
  /** Larger than the configured input budget. */
  | 'too-large';

/** A parse that produced no document, with the reason and a human-readable detail. */
export interface ParseFailure {
  message: string;
  reason: ParseFailureReason;
}

/** The outcome of a parse. */
export type ParseResult =
  | { document: ScholarlyDocument; ok: true }
  | { error: ParseFailure; ok: false };

/** Options every parser accepts. */
export interface ParseOptions {
  /** Reject inputs larger than this many bytes. Defaults vary by format. */
  maxInputBytes?: number;
}

/** Build a successful result. */
export function parsed(document: ScholarlyDocument): ParseResult {
  return { document, ok: true };
}

/** Build a failed result. */
export function failed(reason: ParseFailureReason, message: string): ParseResult {
  return { error: { message, reason }, ok: false };
}

/** A missing optional peer dependency: a setup error, so it throws rather than failing a parse. */
export class MissingPeerError extends Error {}

/**
 * Run a parse so that a throw it did not anticipate — a stack overflow on deep nesting,
 * an engine's internal error — returns as `malformed` instead of escaping the
 * {@link ParseResult} contract. A {@link MissingPeerError} still throws.
 */
export function guard(parse: () => ParseResult): ParseResult {
  try {
    return parse();
  } catch (error) {
    return unexpected(error);
  }
}

/** {@link guard} for a parser that reads asynchronously. */
export async function guardAsync(parse: () => Promise<ParseResult>): Promise<ParseResult> {
  try {
    return await parse();
  } catch (error) {
    return unexpected(error);
  }
}

function unexpected(error: unknown): ParseResult {
  if (error instanceof MissingPeerError) throw error;
  const detail = error instanceof Error ? error.message : String(error);
  return failed('malformed', `The document could not be read: ${detail}`);
}
