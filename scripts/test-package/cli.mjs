/**
 * @fileoverview Node and Bun entry for the packed-package smoke: `<runtime> cli.mjs
 * <node|bun>`, run from the temp app, reading `fixtures.json` beside it. Fails on any
 * runtime other than the one named, so the Node run can't land on Bun's `node` shim.
 * @module scripts/test-package/cli
 */
import { readFileSync } from 'node:fs';
import { smoke } from './smoke.mjs';

const expected = process.argv[2];
const runtime = 'bun' in process.versions ? 'bun' : 'node';
if (runtime !== expected) {
  console.error(`expected to run on ${expected}, but this is ${runtime} (${process.execPath})`);
  process.exit(1);
}

const fixtures = JSON.parse(readFileSync(new URL('fixtures.json', import.meta.url), 'utf8'));
const { lines, ok } = await smoke(fixtures);
for (const line of lines) console.log(`${runtime} ${process.versions[runtime]} ${line}`);
process.exit(ok ? 0 : 1);
