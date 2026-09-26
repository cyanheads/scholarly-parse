/**
 * @fileoverview Package root: the document model, format detection, and renderers.
 * Format parsers live on subpaths (`scholarly-parse/jats`, `/tei`, `/latexml`,
 * `/html`, `/pdf`) so an application loads only the parsers it uses.
 * @module src/index
 */
export * from './model/index.js';
export * from './render/index.js';
