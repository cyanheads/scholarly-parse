#!/usr/bin/env bun
/**
 * @fileoverview Smoke-test the package as a consumer installs it. Packs it into a temp
 * directory, installs the tarball and the optional peers into a temp app under the same
 * install guard as the repo (`bunfig.toml`'s `minimumReleaseAge` and scanner), then runs
 * `scripts/test-package/` there on Node, Bun, and workerd (`workerd test`): one fixture per
 * format, parsed through its subpath and through `parse()`, must reproduce its
 * `expected.md`. Packs `dist/` as it stands, so build first: `bun run test:package` does,
 * and `devcheck` runs this after its clean build. Writes only inside the temp directory,
 * which it removes on every exit.
 * @module scripts/test-package
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { z } from 'zod';
import { fixtureMetaSchema, listFixtures } from '../tests/corpus/fixtures.js';
import { nodeBinary } from './node-binary.js';

const ROOT = resolve(import.meta.dirname, '..');
const SMOKE_DIR = join(import.meta.dirname, 'test-package');
// The Bun running this script, so every Bun step uses the same one.
const BUN = process.execPath;

/** The smallest fixture per format whose parse is clean. */
const SMOKE_FIXTURES = new Set([
  'jats/epmc-pmc11661586',
  'tei/grobid-s13256-024-05002-3',
  'latexml/ar5iv-1906.00591',
  'html/plos-pone.0310152',
  'pdf/arxiv-1906.00591v1',
]);

const installGuardSchema = z.object({
  install: z.object({
    minimumReleaseAge: z.number(),
    security: z.object({ scanner: z.string() }),
  }),
});

const tmp = mkdtempSync(join(tmpdir(), 'scholarly-parse-package-'));
const app = join(tmp, 'app');
const children = new AbortController();
process.on('exit', () => rmSync(tmp, { force: true, recursive: true }));
for (const [signal, code] of [
  ['SIGHUP', 129],
  ['SIGINT', 130],
  ['SIGTERM', 143],
] as const) {
  process.on(signal, () => {
    children.abort();
    process.exit(code);
  });
}

/** Run a command with inherited output; resolves to whether it exited 0. */
async function run(cmd: string[], cwd: string): Promise<boolean> {
  const child = Bun.spawn({
    cmd,
    cwd,
    signal: children.signal,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  return (await child.exited) === 0;
}

function fail(message: string): never {
  console.error(`❌ test-package: ${message}`);
  process.exit(1);
}

function installedVersion(name: string): string {
  const manifest = readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8');
  return z.object({ version: z.string() }).parse(JSON.parse(manifest)).version;
}

const tarball = join(tmp, 'scholarly-parse.tgz');
const pack = [BUN, 'pm', 'pack', '--ignore-scripts', '--quiet', `--filename=${tarball}`];
if (!(await run(pack, ROOT))) fail('bun pm pack failed');

mkdirSync(app);
writeFileSync(join(app, 'package.json'), `${JSON.stringify({ private: true, type: 'module' })}\n`);
const { install } = installGuardSchema.parse(
  Bun.TOML.parse(readFileSync(join(ROOT, 'bunfig.toml'), 'utf8')),
);
const scanner = join(ROOT, 'node_modules', install.security.scanner);
writeFileSync(
  join(app, 'bunfig.toml'),
  `[install]\nminimumReleaseAge = ${install.minimumReleaseAge}\n\n[install.security]\nscanner = ${JSON.stringify(scanner)}\n`,
);
const peers = ['linkedom', 'unpdf'].map((name) => `${name}@${installedVersion(name)}`);
if (!(await run([BUN, 'add', tarball, ...peers], app))) fail('installing the tarball failed');

const fixtures = listFixtures()
  .filter((fixture) => SMOKE_FIXTURES.has(`${fixture.format}/${fixture.name}`))
  .map((fixture) => ({
    baseUrl: fixtureMetaSchema.parse(fixture.meta).url,
    expected: readFileSync(join(fixture.dir, 'expected.md'), 'utf8'),
    format: fixture.format,
    name: `${fixture.format}/${fixture.name}`,
    source: readFileSync(fixture.sourcePath).toString('base64'),
  }));
const missing = [...SMOKE_FIXTURES].filter((name) => !fixtures.some((f) => f.name === name));
if (missing.length > 0) fail(`no such fixture: ${missing.join(', ')}`);
writeFileSync(join(app, 'fixtures.json'), JSON.stringify(fixtures));
for (const file of ['smoke.mjs', 'cli.mjs', 'worker.mjs', 'workerd.capnp']) {
  copyFileSync(join(SMOKE_DIR, file), join(app, file));
}

function smokeOnNode(): Promise<boolean> {
  const node = nodeBinary();
  if (node !== undefined) return run([node, 'cli.mjs', 'node'], app);
  console.error('❌ test-package: no Node.js binary on PATH past the Bun shim');
  return Promise.resolve(false);
}

/** Bundle `worker.mjs` the way wrangler resolves a Worker, then run its `test` handler. */
async function smokeOnWorkerd(): Promise<boolean> {
  const bundle = [
    'worker.mjs',
    '--outfile=worker.bundle.mjs',
    '--target=browser',
    '--conditions=workerd',
    '--conditions=worker',
    '--external=fixtures',
  ];
  const workerd = join(ROOT, 'node_modules', '.bin', 'workerd');
  return (
    (await run([BUN, 'build', ...bundle], app)) &&
    (await run([workerd, 'test', 'workerd.capnp'], app))
  );
}

const results = {
  Node: await smokeOnNode(),
  Bun: await run([BUN, 'cli.mjs', 'bun'], app),
  workerd: await smokeOnWorkerd(),
};
for (const [runtime, ok] of Object.entries(results)) console.log(`${ok ? '✅' : '❌'} ${runtime}`);
process.exit(Object.values(results).every(Boolean) ? 0 : 1);
