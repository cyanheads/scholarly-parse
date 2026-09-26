/**
 * @fileoverview Package root: the document model, format detection, `parse` for any
 * format, and renderers. Format parsers also live on subpaths (`scholarly-parse/jats`,
 * `/tei`, `/latexml`, `/html`, `/pdf`); `parse` loads them on first use, so an
 * application only ever loads the parsers it uses.
 * @module src/index
 */

export { detect } from './detect.js';
export * from './model/index.js';
export { type AutoParseOptions, parse } from './parse.js';
export * from './render/index.js';
