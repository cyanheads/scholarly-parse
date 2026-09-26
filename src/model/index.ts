/**
 * @fileoverview Public surface of the document model: the types every parser
 * produces and the result wrapper every parser returns.
 * @module src/model
 */
export type * from './document.js';
export {
  failed,
  type ParseFailure,
  type ParseFailureReason,
  type ParseOptions,
  type ParseResult,
  parsed,
} from './result.js';
