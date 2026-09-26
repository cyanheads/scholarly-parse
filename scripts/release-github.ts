#!/usr/bin/env bun
/**
 * @fileoverview Create (or repair) a GitHub Release on the current package version's
 * annotated tag, enforcing the `v<VERSION>: <tag subject>` title format that
 * `--notes-from-tag` alone cannot set.
 *
 *   1. Reads `version` from `package.json`.
 *   2. Derives the tag subject via `git for-each-ref refs/tags/v<version>`.
 *   3. Runs `gh release create v<version> --verify-tag --notes-from-tag --title "v<version>: <subject>"`.
 *   4. On "release already exists" (re-run after a partial release), sets the title
 *      with `gh release edit` instead.
 *
 * @module scripts/release-github
 *
 * @example
 * // bun run release:github
 * // bun run release:github -- --dry-run
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const DRY_RUN = process.argv.includes('--dry-run');

/** Run a command and return trimmed stdout, or `{ error }` on a non-zero exit. */
function run(cmd: string, args: string[]): { error: string } | { stdout: string } {
  const result = spawnSync(cmd, args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) return { error: `Failed to spawn '${cmd}': ${result.error.message}` };
  if ((result.status ?? 1) !== 0) return { error: (result.stderr ?? '').trim() };
  return { stdout: (result.stdout ?? '').trim() };
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { version?: string };
const version = pkg.version?.trim() || fail('package.json has no version field.');
const tag = `v${version}`;

const subjectRun = run('git', ['for-each-ref', `refs/tags/${tag}`, '--format=%(contents:subject)']);
const subject = 'stdout' in subjectRun ? subjectRun.stdout : '';
if (!subject) {
  fail(`Tag ${tag} not found locally or has no subject line. Create it first: git tag -a ${tag}`);
}

const title = `${tag}: ${subject}`;
const createArgs = ['release', 'create', tag, '--verify-tag', '--notes-from-tag', '--title', title];

if (DRY_RUN) {
  console.log(`[dry-run] gh ${createArgs.join(' ')}`);
  console.log(`[dry-run] fallback (if release exists): gh release edit ${tag} --title "${title}"`);
  process.exit(0);
}

console.log(`Creating GitHub Release ${tag}\n  title: ${title}`);
const created = run('gh', createArgs);
if ('stdout' in created) {
  if (created.stdout) console.log(created.stdout);
  console.log(`Release ${tag} created.`);
  process.exit(0);
}

if (!/release already exists/i.test(created.error))
  fail(`gh release create failed:\n${created.error}`);

console.log(`Release ${tag} already exists. Setting title: ${title}`);
const edited = run('gh', ['release', 'edit', tag, '--title', title]);
if ('error' in edited) fail(`gh release edit failed:\n${edited.error}`);
console.log(`Release ${tag} repaired.`);
